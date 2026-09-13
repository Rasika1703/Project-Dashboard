import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { query } from '../db/index.js';
import type { AuthUser } from '../types/auth.js';

const BCRYPT_ROUNDS = Number.parseInt(
  process.env.BCRYPT_ROUNDS ?? '12',
  10
);

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
};

const getRefreshSecret = (): string => {
  const secret = process.env.REFRESH_TOKEN_SECRET;

  if (!secret) {
    throw new Error('REFRESH_TOKEN_SECRET is not configured');
  }

  return secret;
};

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/auth',
});

const generateAccessToken = (user: AuthUser): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    },
    getJwtSecret(),
    {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '24h') as jwt.SignOptions['expiresIn'],
    }
  );
};

const generateRefreshToken = (user: AuthUser): string => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      type: 'refresh',
    },
    getRefreshSecret(),
    {
      expiresIn: '7d',
    }
  );
};

const hashToken = (token: string): string => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

const saveRefreshToken = async (
  userId: string,
  refreshToken: string
): Promise<void> => {
  const decoded = jwt.verify(refreshToken, getRefreshSecret());

  if (typeof decoded === 'string' || !decoded.exp) {
    throw new Error('Invalid refresh token');
  }

  await query(
    `INSERT INTO refresh_tokens
      (user_id, token_hash, expires_at)
     VALUES ($1, $2, to_timestamp($3))`,
    [userId, hashToken(refreshToken), decoded.exp]
  );
};

const buildAuthUser = (user: {
  id: string;
  name: string;
  email: string;
  role: string;
}): AuthUser => {
  if (
    user.role !== 'ADMIN' &&
    user.role !== 'PROJECT_MANAGER' &&
    user.role !== 'DEVELOPER'
  ) {
    throw new Error('Invalid user role');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
};

const sendAuthResponse = async (
  res: Response,
  user: AuthUser,
  statusCode = 200
): Promise<void> => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await saveRefreshToken(user.id, refreshToken);

  res
    .cookie(
      'refreshToken',
      refreshToken,
      getRefreshCookieOptions()
    )
    .status(statusCode)
    .json({
      token: accessToken,
      user,
    });
};

export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      res.status(409).json({
        error: 'Email already registered',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(
      password,
      BCRYPT_ROUNDS
    );

    const result = await query(
      `INSERT INTO users
        (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, 'DEVELOPER']
    );

    const user = result.rows[0];

    const authUser = buildAuthUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    await sendAuthResponse(res, authUser, 201);
  } catch (error: unknown) {
    console.error('Register error:', error);

    res.status(500).json({
      error: 'Registration failed',
    });
  }
};

export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, password } = req.body;

  try {
    const result = await query(
      `SELECT
        id,
        name,
        email,
        password_hash,
        role,
        created_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    const user = result.rows[0];

    const isValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isValid) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    const authUser = buildAuthUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    await sendAuthResponse(res, authUser);
  } catch (error: unknown) {
    console.error('Login error:', error);

    res.status(500).json({
      error: 'Login failed',
    });
  }
};

export const refresh = async (
  req: Request,
  res: Response
): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    res.status(401).json({
      error: 'Refresh token required',
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      getRefreshSecret()
    );

    if (
      typeof decoded === 'string' ||
      decoded.type !== 'refresh' ||
      typeof decoded.id !== 'string'
    ) {
      res.status(401).json({
        error: 'Invalid refresh token',
      });
      return;
    }

    const tokenHash = hashToken(refreshToken);

    const result = await query(
      `SELECT
        rt.id,
        rt.user_id,
        u.id,
        u.name,
        u.email,
        u.role
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
         AND rt.revoked_at IS NULL
         AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        error: 'Refresh token expired or revoked',
      });
      return;
    }

    const row = result.rows[0];

    await query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE id = $1`,
      [row.refresh_token_id]
    );

    const user = buildAuthUser({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
    });

    await sendAuthResponse(res, user);
  } catch (error: unknown) {
    console.error('Refresh token error:', error);

    res.status(401).json({
      error: 'Invalid refresh token',
    });
  }
};

export const logout = async (
  req: Request,
  res: Response
): Promise<void> => {
  const refreshToken = req.cookies?.refreshToken;

  try {
    if (refreshToken) {
      await query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE token_hash = $1
           AND revoked_at IS NULL`,
        [hashToken(refreshToken)]
      );
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
    });

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error: unknown) {
    console.error('Logout error:', error);

    res.status(500).json({
      error: 'Logout failed',
    });
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
      });
      return;
    }

    const result = await query(
      `SELECT
        id,
        name,
        email,
        role,
        created_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    res.json({
      user: result.rows[0],
    });
    } catch (error: unknown) {
    console.error('Get current user error:', error);

    res.status(500).json({
      error: 'Failed to fetch user',
    });
  }
};

export const getDevelopers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT id, name, email
       FROM users
       WHERE role = 'DEVELOPER'
       ORDER BY name ASC`
    );

    res.json({
      users: result.rows,
    });
  } catch (error: unknown) {
    console.error('Get developers error:', error);
    res.status(500).json({
      error: 'Failed to fetch developers',
    });
  }
};

