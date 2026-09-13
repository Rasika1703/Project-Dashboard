import type { Request, Response } from 'express';
import type { PoolClient } from 'pg';

import { query, transaction } from '../db/index.js';
import { logActivity } from '../services/activity.service.js';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

const getParam = (value: string | string[]): string => {
  return Array.isArray(value) ? value[0] : value;
};

export const getProjects = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    owned,
    limit = '50',
    offset = '0',
  } = req.query;

  const user = req.user!;

  const userId = user.id;
  const isAdmin = user.role === 'ADMIN';

  try {
    let queryText: string;
    let params: unknown[];

    if (isAdmin && owned !== 'true') {
      queryText = `
        SELECT
          p.*,
          u.name AS owner_name,
          u.email AS owner_email,
          (
            SELECT COUNT(*)
            FROM tasks
            WHERE project_id = p.id
          ) AS task_count
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        ORDER BY p.updated_at DESC
        LIMIT $1 OFFSET $2
      `;

      params = [
        Number(limit),
        Number(offset),
      ];
    } else if (user.role === 'DEVELOPER') {
  queryText = `
    SELECT
      p.*,
      u.name AS owner_name,
      u.email AS owner_email,
      (
        SELECT COUNT(*)
        FROM tasks
        WHERE project_id = p.id
          AND assigned_developer_id = $1
      ) AS task_count
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    WHERE EXISTS (
      SELECT 1
      FROM tasks t
      WHERE t.project_id = p.id
        AND t.assigned_developer_id = $1
    )
    ORDER BY p.updated_at DESC
    LIMIT $2 OFFSET $3
  `;

  params = [
    userId,
    Number(limit),
    Number(offset),
  ];
} else {
  queryText = `
    SELECT
      p.*,
      u.name AS owner_name,
      u.email AS owner_email,
      (
        SELECT COUNT(*)
        FROM tasks
        WHERE project_id = p.id
      ) AS task_count
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    WHERE p.owner_id = $1
    ORDER BY p.updated_at DESC
    LIMIT $2 OFFSET $3
  `;

  params = [
    userId,
    Number(limit),
    Number(offset),
  ];
}

    const result = await query(
      queryText,
      params
    );

    res.json({
      projects: result.rows,
    });
  } catch (error: unknown) {
    console.error(
      'Get projects error:',
      getErrorMessage(error)
    );

    res.status(500).json({
      error: 'Failed to fetch projects',
    });
  }
};

export const getProject = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = getParam(req.params.id);
  const user = req.user!;

  const userId = user.id;
  const isAdmin = user.role === 'ADMIN';

  try {
    const result = await query(
      `
        SELECT
          p.*,
          u.name AS owner_name,
          u.email AS owner_email
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        WHERE p.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'Project not found',
      });
      return;
    }

    const project = result.rows[0];

    if (!isAdmin && project.owner_id !== userId) {
      res.status(403).json({
        error: 'Access denied',
      });
      return;
    }

    res.json({
      project,
    });
  } catch (error: unknown) {
    console.error(
      'Get project error:',
      getErrorMessage(error)
    );

    res.status(500).json({
      error: 'Failed to fetch project',
    });
  }
};

export const createProject = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { title, description } = req.body as {
    title: string;
    description?: string;
  };

  const user = req.user!;
  const userId = user.id;

  try {
    const result = await transaction(
      async (client: PoolClient) => {
        const projectResult = await client.query(
          `
            INSERT INTO projects (
              owner_id,
              created_by,
              title,
              description
            )
            VALUES ($1, $2, $3, $4)
            RETURNING *
          `,
          [
            userId,
            userId,
            title,
            description ?? null,
          ]
        );

        const project = projectResult.rows[0];

        await logActivity(client, {
          userId,
          projectId: project.id,
          action: 'create_project',
          metadata: { title },
        });

        return project;
      }
    );

    res.status(201).json({
      project: result,
    });
  } catch (error: unknown) {
    console.error('Create project error:', getErrorMessage(error));

    res.status(500).json({
      error: getErrorMessage(error),
    });
  }
};
export const updateProject = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = getParam(req.params.id);

  const {
    title,
    description,
  } = req.body as {
    title?: string;
    description?: string;
  };

  const user = req.user!;

  const userId = user.id;
  const isAdmin = user.role === 'ADMIN';

  try {
    const result = await transaction(
      async (client: PoolClient) => {
        const checkResult = await client.query(
          'SELECT owner_id FROM projects WHERE id = $1',
          [id]
        );

        if (checkResult.rows.length === 0) {
          throw new Error(
            'Project not found'
          );
        }

        const project =
          checkResult.rows[0];

        if (
          !isAdmin &&
          project.owner_id !== userId
        ) {
          throw new Error(
            'Access denied'
          );
        }

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramCount = 1;

        if (title !== undefined) {
          updates.push(
            `title = $${paramCount++}`
          );
          values.push(title);
        }

        if (description !== undefined) {
          updates.push(
            `description = $${paramCount++}`
          );
          values.push(description);
        }

        if (updates.length === 0) {
          const existing =
            await client.query(
              'SELECT * FROM projects WHERE id = $1',
              [id]
            );

          return existing.rows[0];
        }

        updates.push(
          'updated_at = now()'
        );

        values.push(id);

        const updateResult =
          await client.query(
            `
              UPDATE projects
              SET ${updates.join(', ')}
              WHERE id = $${paramCount}
              RETURNING *
            `,
            values
          );

        await logActivity(client, {
          userId,
          projectId: id,
          action: 'update_project',
          metadata: {
            title,
            description,
          },
        });

        return updateResult.rows[0];
      }
    );

    res.json({
      project: result,
    });
  } catch (error: unknown) {
    const message =
      getErrorMessage(error);

    console.error(
      'Update project error:',
      message
    );

    if (message === 'Project not found') {
      res.status(404).json({
        error: 'Project not found',
      });
      return;
    }

    if (message === 'Access denied') {
      res.status(403).json({
        error: 'Access denied',
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to update project',
    });
  }
};

export const deleteProject = async (
  req: Request,
  res: Response
): Promise<void> => {
  const id = getParam(req.params.id);

  const user = req.user!;

  const userId = user.id;
  const isAdmin = user.role === 'ADMIN';

  try {
    await transaction(
      async (client: PoolClient) => {
        const checkResult = await client.query(
          'SELECT owner_id FROM projects WHERE id = $1',
          [id]
        );

        if (checkResult.rows.length === 0) {
          throw new Error(
            'Project not found'
          );
        }

        const project =
          checkResult.rows[0];

        if (
          !isAdmin &&
          project.owner_id !== userId
        ) {
          throw new Error(
            'Access denied'
          );
        }

        await logActivity(client, {
          userId,
          projectId: id,
          action: 'delete_project',
          metadata: {},
        });

        await client.query(
          'DELETE FROM projects WHERE id = $1',
          [id]
        );
      }
    );

    res.status(204).send();
  } catch (error: unknown) {
    const message =
      getErrorMessage(error);

    console.error(
      'Delete project error:',
      message
    );

    if (message === 'Project not found') {
      res.status(404).json({
        error: 'Project not found',
      });
      return;
    }

    if (message === 'Access denied') {
      res.status(403).json({
        error: 'Access denied',
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to delete project',
    });
  }
};








