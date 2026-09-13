import type { Request, Response } from 'express';
import type { PoolClient } from 'pg';

import { query, transaction } from '../db/index.js';
import { logActivity } from '../services/activity.service.js';
import { emitToProject } from '../websocket/index.js';

const getParam = (value: string | string[]): string => {
  return Array.isArray(value) ? value[0] : value;
};

type TaskDiffValue = {
  old: unknown;
  new: unknown;
};

type TaskDiff = Record<string, TaskDiffValue>;

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : 'Unknown error';
};

const checkProjectAccess = async (
  client: Pick<PoolClient, 'query'>,
  projectId: string,
  userId: string,
  role: string
): Promise<void> => {
  const result = await client.query(
    'SELECT owner_id FROM projects WHERE id = $1',
    [projectId]
  );

  if (result.rows.length === 0) {
    throw new Error('Project not found');
  }

  // Admin has global access.
  if (role === 'ADMIN') {
    return;
  }

  // Project Managers can access only their own projects.
  if (role === 'PROJECT_MANAGER') {
    if (result.rows[0].owner_id !== userId) {
      throw new Error('Access denied');
    }

    return;
  }

  // Developers do not get project-level access.
  // Their access is determined at task level.
  throw new Error('Access denied');
};

const checkTaskAccess = async (
  client: Pick<PoolClient, 'query'>,
  taskId: string,
  userId: string,
  role: string
): Promise<Record<string, any>> => {
  const result = await client.query(
    `
      SELECT
        t.*,
        p.owner_id AS project_owner_id
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.id = $1
    `,
    [taskId]
  );

  if (result.rows.length === 0) {
    throw new Error('Task not found');
  }

  const task = result.rows[0];

  if (role === 'ADMIN') {
    return task;
  }

  if (role === 'PROJECT_MANAGER') {
    if (task.project_owner_id !== userId) {
      throw new Error('Access denied');
    }

    return task;
  }

  if (role === 'DEVELOPER') {
    if (task.assigned_developer_id !== userId) {
      throw new Error('Access denied');
    }

    return task;
  }

  throw new Error('Access denied');
};

export const getTasks = async (
  req: Request,
  res: Response
): Promise<void> => {
  const projectId = getParam(req.params.id);
  const { status, search, limit = '100', offset = '0' } = req.query;

  const user = req.user!;

  const userId = user.id;
  const isAdmin = user.role === 'ADMIN';

  try {
    const db = { query } as Pick<PoolClient, 'query'>;

    if (user.role === 'DEVELOPER') {
      const accessResult = await db.query(
        `
          SELECT id
          FROM tasks
          WHERE project_id = $1
            AND assigned_developer_id = $2
          LIMIT 1
        `,
        [projectId, userId]
      );

      if (accessResult.rows.length === 0) {
        throw new Error('Access denied');
      }
    } else {
      await checkProjectAccess(
        db,
        projectId,
        userId,
        user.role
      );
    }

    let queryText = `
      SELECT t.*, u.name AS created_by_name
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.project_id = $1
    `;

    const params: unknown[] = [projectId];
    let paramCount = 2;

    if (user.role === 'DEVELOPER') {
      queryText += ` AND t.assigned_developer_id = $${paramCount++}`;
      params.push(userId);
    }

    if (typeof status === 'string') {
      queryText += ` AND t.status = $${paramCount++}`;
      params.push(status);
    }

    if (typeof search === 'string' && search.trim()) {
      queryText += `
        AND (
          t.title ILIKE $${paramCount}
          OR t.description ILIKE $${paramCount + 1}
        )
      `;

      params.push(`%${search}%`, `%${search}%`);
      paramCount += 2;
    }

    queryText += `
      ORDER BY
        CASE t.priority
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
          ELSE 5
        END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT $${paramCount++}
      OFFSET $${paramCount++}
    `;

    params.push(Number(limit), Number(offset));

    const result = await query(queryText, params);

    res.json({
      tasks: result.rows,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    console.error('Get tasks error:', error);

    if (message === 'Project not found') {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (message === 'Access denied') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.status(500).json({
      error: 'Failed to fetch tasks',
    });
  }
};

export const createTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  const projectId = getParam(req.params.id);

  const {
    title,
    description,
    assignedDeveloperId,
    status = 'TODO',
    priority = 'MEDIUM',
    dueDate,
  } = req.body as {
    title: string;
    description?: string;
    assignedDeveloperId?: string;
    status?: string;
    priority?: string;
    dueDate?: string | null;
  };

  const user = req.user!;

  const userId = user.id;

  try {
    if (user.role !== 'ADMIN' && user.role !== 'PROJECT_MANAGER') {
        const error = new Error('Access denied');
        (error as any).statusCode = 403;
        throw error;
      }

    const task = await transaction(async (client) => {
      await checkProjectAccess(
        client,
        projectId,
        userId,
        user.role
      );

      if (assignedDeveloperId) {
        const developerResult = await client.query(
          `
            SELECT id
            FROM users
            WHERE id = $1
              AND role = 'DEVELOPER'
          `,
          [assignedDeveloperId]
        );

        if (developerResult.rows.length === 0) {
          throw new Error('Developer not found');
        }
      }

      const result = await client.query(
        `
          INSERT INTO tasks (
            project_id,
            title,
            description,
            assigned_developer_id,
            status,
            priority,
            due_date,
            created_by
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        [
          projectId,
          title,
          description ?? null,
          assignedDeveloperId ?? null,
          status,
          priority,
          dueDate ?? null,
          userId,
        ]
      );

      const newTask = result.rows[0];

      const userResult = await client.query(
        'SELECT name FROM users WHERE id = $1',
        [userId]
      );

      newTask.created_by_name = userResult.rows[0]?.name;

      await logActivity(client, {
        userId,
        projectId,
        action: 'create_task',
        metadata: {
          taskId: newTask.id,
          title,
          assignedDeveloperId,
        },
      });

      return newTask;
    });

    emitToProject(projectId, 'task_created', {
      task,
    });

    res.status(201).json({
      task,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    console.error('Create task error:', error);

    if (message === 'Project not found') {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (message === 'Developer not found') {
      res.status(400).json({ error: 'Assigned developer not found' });
      return;
    }

    if (message === 'Access denied') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.status(500).json({
      error: 'Failed to create task',
    });
  }
};

export const updateTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  const taskId = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;
  const updates = req.body as Record<string, unknown>;

  const user = req.user!;

  const userId = user.id;
  const isAdmin = user.role === 'ADMIN';

  try {
    const { task, diff } = await transaction(async (client) => {
      const currentResult = await client.query(
        'SELECT * FROM tasks WHERE id = $1 FOR UPDATE',
        [taskId]
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Task not found');
      }

      const currentTask = currentResult.rows[0];

      await checkTaskAccess(
        client,
        taskId,
        userId,
        user.role
      );

      if (user.role === 'DEVELOPER') {
        for (const key of Object.keys(updates)) {
          if (key !== 'status') {
            throw new Error('Developer can only update task status');
          }
        }
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      let paramCount = 1;

      const taskDiff: TaskDiff = {};

      const allowedFields = [
        'title',
        'description',
        'status',
        'priority',
        'assigned_developer_id',
        'due_date',
      ];

      for (const [key, value] of Object.entries(updates)) {
        if (!allowedFields.includes(key)) {
          continue;
        }

        if (currentTask[key] !== value) {
          fields.push(`${key} = $${paramCount++}`);
          values.push(value);

          taskDiff[key] = {
            old: currentTask[key],
            new: value,
          };
        }
      }

      const requestedStatus = updates.status;

      if (typeof requestedStatus === 'string') {
        if (
          requestedStatus === 'IN_PROGRESS' &&
          !currentTask.started_at
        ) {
          fields.push('started_at = now()');

          taskDiff.started_at = {
            old: null,
            new: 'now',
          };
        }

        if (
          requestedStatus === 'DONE' &&
          !currentTask.completed_at
        ) {
          fields.push('completed_at = now()');

          taskDiff.completed_at = {
            old: null,
            new: 'now',
          };
        }

        if (
          currentTask.status === 'DONE' &&
          requestedStatus !== 'DONE'
        ) {
          fields.push('completed_at = NULL');

          taskDiff.completed_at = {
            old: currentTask.completed_at,
            new: null,
          };
        }
      }

      if (fields.length === 0) {
        return {
          task: currentTask,
          diff: taskDiff,
        };
      }

      fields.push('updated_at = now()');

      values.push(taskId);

      const result = await client.query(
        `
          UPDATE tasks
          SET ${fields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `,
        values
      );

      const updatedTask = result.rows[0];

      const userResult = await client.query(
        'SELECT name FROM users WHERE id = $1',
        [updatedTask.created_by]
      );

      updatedTask.created_by_name =
        userResult.rows[0]?.name;

      await logActivity(client, {
        userId,
        projectId: currentTask.project_id,
        action: 'update_task',
        metadata: {
          taskId,
          diff: taskDiff,
        },
      });

      return {
        task: updatedTask,
        diff: taskDiff,
      };
    });

    emitToProject(task.project_id, 'task_updated', {
      task,
      diff,
    });

    res.json({
      task,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    console.error('Update task error:', error);

    if (message === 'Task not found') {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (message === 'Project not found') {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (message === 'Access denied') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (message === 'Developer can only update task status') {
      res.status(403).json({
        error: 'Developers can only update task status',
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to update task',
    });
  }
};

export const deleteTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id: taskId } = req.params;

  const user = req.user!;

  const userId = user.id;

  try {
    if (user.role !== 'ADMIN' && user.role !== 'PROJECT_MANAGER') {
        const error = new Error('Access denied');
        (error as any).statusCode = 403;
        throw error;
      }

    const projectId = await transaction(async (client) => {
      const taskResult = await client.query(
        'SELECT project_id FROM tasks WHERE id = $1',
        [taskId]
      );

      if (taskResult.rows.length === 0) {
        throw new Error('Task not found');
      }

      const projectId = taskResult.rows[0].project_id;

      await checkProjectAccess(
        client,
        projectId,
        userId,
        user.role
      );

      await logActivity(client, {
        userId,
        projectId,
        action: 'delete_task',
        metadata: {
          taskId,
        },
      });

      await client.query(
        'DELETE FROM tasks WHERE id = $1',
        [taskId]
      );

      return projectId;
    });

    emitToProject(projectId, 'task_deleted', {
      taskId,
    });

    res.status(204).send();
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    console.error('Delete task error:', error);

    if (message === 'Task not found') {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (message === 'Project not found') {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    if (message === 'Access denied') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.status(500).json({
      error: 'Failed to delete task',
    });
  }
};









