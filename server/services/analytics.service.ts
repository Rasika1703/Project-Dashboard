import { query } from '../db/index.js';

interface DateCountRow {
  date: string;
  count: string | number;
}

interface ActivityRow {
  date: string;
  count: string | number;
}

type Status =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE';

type Priority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

const fillDateGaps = (
  data: DateCountRow[],
  fromDate: string,
  toDate: string
): DateCountRow[] => {
  const dataMap = new Map(
    data.map((item) => [
      item.date,
      Number(item.count),
    ])
  );

  const result: DateCountRow[] = [];

  const current = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);

  while (current <= end) {
    const date = current
      .toISOString()
      .split('T')[0];

    result.push({
      date,
      count: dataMap.get(date) ?? 0,
    });

    current.setUTCDate(
      current.getUTCDate() + 1
    );
  }

  return result;
};

export const computeProjectSummary = async (
  projectId: string,
  fromDate: string,
  toDate: string
) => {
  const activityResult = await query<DateCountRow>(
    `
      SELECT
        DATE(created_at)::text AS date,
        COUNT(*)::int AS count
      FROM activity_logs
      WHERE project_id = $1
        AND created_at >= $2::date
        AND created_at < ($3::date + INTERVAL '1 day')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `,
    [
      projectId,
      fromDate,
      toDate,
    ]
  );

  const activityByDate = fillDateGaps(
    activityResult.rows,
    fromDate,
    toDate
  );

  const statusResult = await query<{
    status: Status;
    count: string | number;
  }>(
    `
      SELECT
        status,
        COUNT(*)::int AS count
      FROM tasks
      WHERE project_id = $1
      GROUP BY status
    `,
    [projectId]
  );

  const taskCountsByStatus: Record<
    Status,
    number
  > = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
  };

  for (const row of statusResult.rows) {
    if (row.status in taskCountsByStatus) {
      taskCountsByStatus[row.status] =
        Number(row.count);
    }
  }

  const priorityResult = await query<{
    priority: Priority;
    count: string | number;
  }>(
    `
      SELECT
        priority,
        COUNT(*)::int AS count
      FROM tasks
      WHERE project_id = $1
      GROUP BY priority
    `,
    [projectId]
  );

  const taskCountsByPriority: Record<
    Priority,
    number
  > = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  for (const row of priorityResult.rows) {
    if (
      row.priority in
      taskCountsByPriority
    ) {
      taskCountsByPriority[
        row.priority
      ] = Number(row.count);
    }
  }

  const overdueResult = await query<{
    count: string | number;
  }>(
    `
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE project_id = $1
        AND due_date IS NOT NULL
        AND due_date < NOW()
        AND status <> 'DONE'
    `,
    [projectId]
  );

  const completedResult = await query<{
    count: string | number;
  }>(
    `
      SELECT COUNT(*)::int AS count
      FROM tasks
      WHERE project_id = $1
        AND status = 'DONE'
        AND completed_at >= $2::date
        AND completed_at < ($3::date + INTERVAL '1 day')
    `,
    [
      projectId,
      fromDate,
      toDate,
    ]
  );

  return {
    activityByDate,
    taskCountsByStatus,
    taskCountsByPriority,
    overdueTasks: Number(
      overdueResult.rows[0]?.count ?? 0
    ),
    completedTasks: Number(
      completedResult.rows[0]?.count ?? 0
    ),
  };
};

export const computeUserActivity = async (
  userId: string,
  fromDate: string,
  toDate: string
) => {
  const result = await query<ActivityRow>(
    `
      SELECT
        DATE(created_at)::text AS date,
        COUNT(*)::int AS count
      FROM activity_logs
      WHERE user_id = $1
        AND created_at >= $2::date
        AND created_at < ($3::date + INTERVAL '1 day')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `,
    [
      userId,
      fromDate,
      toDate,
    ]
  );

  return {
    activityByDate: fillDateGaps(
      result.rows,
      fromDate,
      toDate
    ),
  };
};
