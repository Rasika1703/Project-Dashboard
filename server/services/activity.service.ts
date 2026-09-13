import type { PoolClient, QueryResultRow } from 'pg';

export interface ActivityMetadata {
  [key: string]: unknown;
}

export interface ActivityInput {
  userId: string;
  projectId: string;
  action: string;
  metadata?: ActivityMetadata;
}

export const logActivity = async (
  client: Pick<PoolClient, 'query'>,
  {
    userId,
    projectId,
    action,
    metadata = {},
  }: ActivityInput
): Promise<void> => {
  await client.query(
    `
      INSERT INTO activity_logs (
        user_id,
        project_id,
        action,
        metadata
      )
      VALUES ($1, $2, $3, $4)
    `,
    [
      userId,
      projectId,
      action,
      JSON.stringify(metadata),
    ]
  );
};

export const getActivityLogs = async (
  client: Pick<PoolClient, 'query'>,
  projectId: string,
  limit = 50
): Promise<QueryResultRow[]> => {
  const result = await client.query(
    `
      SELECT
        al.*,
        u.name AS user_name,
        u.email AS user_email
      FROM activity_logs al
      JOIN users u
        ON u.id = al.user_id
      WHERE al.project_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2
    `,
    [
      projectId,
      limit,
    ]
  );

  return result.rows;
};
