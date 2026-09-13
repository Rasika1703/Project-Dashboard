import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, UserRole } from '../types/auth.js';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
};

const isUserRole = (role: unknown): role is UserRole => {
  return (
    role === 'ADMIN' ||
    role === 'PROJECT_MANAGER' ||
    role === 'DEVELOPER'
  );
};

const getAuthUser = (decoded: string | JwtPayload): AuthUser | null => {
  if (
    typeof decoded === 'string' ||
    typeof decoded.id !== 'string' ||
    typeof decoded.email !== 'string' ||
    typeof decoded.name !== 'string' ||
    !isUserRole(decoded.role)
  ) {
    return null;
  }

  return {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    name: decoded.name,
  };
};

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : undefined;

  if (!token) {
    res.status(401).json({
      error: 'Access token required',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = getAuthUser(decoded);

    if (!user) {
      res.status(401).json({
        error: 'Invalid access token',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Access token expired',
      });
      return;
    }

    res.status(401).json({
      error: 'Invalid access token',
    });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Admin access required',
    });
    return;
  }

  next();
};

export const verifySocketToken = (
  token: string
): AuthUser | null => {
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return getAuthUser(decoded);
  } catch {
    return null;
  }
};
