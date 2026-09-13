import type { Request, Response } from 'express';

import {
  computeProjectSummary,
  computeUserActivity,
} from '../services/analytics.service.js';

import { query } from '../db/index.js';

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

const getParam = (value: string | string[]): string => {
  return Array.isArray(value) ? value[0] : value;
};

export const getProjectSummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  const projectId = getParam(req.params.id);
  const user = req.user!;

  const userId = user.id;
  const isAdmin = user.role === 'ADMIN';

  const toDate =
    typeof req.query.to === 'string'
      ? req.query.to
      : new Date().toISOString().split('T')[0];

  const fromDate =
    typeof req.query.from === 'string'
      ? req.query.from
      : new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split('T')[0];

  try {
    const projectResult = await query(
      'SELECT owner_id FROM projects WHERE id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      res.status(404).json({
        error: 'Project not found',
      });
      return;
    }

    if (
      !isAdmin &&
      projectResult.rows[0].owner_id !== userId
    ) {
      res.status(403).json({
        error: 'Access denied',
      });
      return;
    }

    const summary = await computeProjectSummary(
      projectId,
      fromDate,
      toDate
    );

    res.json(summary);
  } catch (error: unknown) {
    console.error(
      'Get project summary error:',
      getErrorMessage(error)
    );

    res.status(500).json({
      error: 'Failed to fetch analytics',
    });
  }
};

export const getUserActivity = async (
  req: Request,
  res: Response
): Promise<void> => {
  const targetUserId = getParam(req.params.id);
  const user = req.user!;

  const requestUserId = user.id;
  const isAdmin = user.role === 'ADMIN';

  if (!isAdmin && targetUserId !== requestUserId) {
    res.status(403).json({
      error: 'Access denied',
    });
    return;
  }

  const toDate =
    typeof req.query.to === 'string'
      ? req.query.to
      : new Date().toISOString().split('T')[0];

  const fromDate =
    typeof req.query.from === 'string'
      ? req.query.from
      : new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split('T')[0];

  try {
    const activity = await computeUserActivity(
      targetUserId,
      fromDate,
      toDate
    );

    res.json(activity);
  } catch (error: unknown) {
    console.error(
      'Get user activity error:',
      getErrorMessage(error)
    );

    res.status(500).json({
      error: 'Failed to fetch user activity',
    });
  }
};

export const getProjectSnapshot = async (
  req: Request,
  res: Response
): Promise<void> => {
  const projectId = getParam(req.params.id);
  const user = req.user!;

  const userId = user.id;
  const isAdmin = user.role === 'ADMIN';

  try {
    const projectResult = await query(
      `
        SELECT p.*, u.name AS owner_name
        FROM projects p
        JOIN users u ON p.owner_id = u.id
        WHERE p.id = $1
      `,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      res.status(404).json({
        error: 'Project not found',
      });
      return;
    }

    const project = projectResult.rows[0];

    if (!isAdmin && project.owner_id !== userId) {
      res.status(403).json({
        error: 'Access denied',
      });
      return;
    }

    const tasksResult = await query(
      `
        SELECT t.*, u.name AS created_by_name
        FROM tasks t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.project_id = $1
        ORDER BY t.created_at DESC
      `,
      [projectId]
    );

    const activityResult = await query(
      `
        SELECT al.*, u.name AS user_name
        FROM activity_logs al
        JOIN users u ON al.user_id = u.id
        WHERE al.project_id = $1
        ORDER BY al.created_at DESC
        LIMIT 50
      `,
      [projectId]
    );

    res.json({
      project,
      tasks: tasksResult.rows,
      recentActivity: activityResult.rows,
    });
  } catch (error: unknown) {
    console.error(
      'Get project snapshot error:',
      getErrorMessage(error)
    );

    res.status(500).json({
      error: 'Failed to fetch project snapshot',
    });
  }
};
