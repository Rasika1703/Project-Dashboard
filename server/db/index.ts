import pg, {
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

pool.on('connect', () => {
  console.log('✓ Database connected');
});

pool.on('error', (err: Error) => {
  console.error('Unexpected database error:', err);
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: any[] = []
): Promise<QueryResult<T>> => {
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', {
        text,
        duration,
        rows: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  return pool.connect();
};

export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
