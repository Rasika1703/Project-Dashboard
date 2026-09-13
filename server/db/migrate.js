import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations() {
  console.log('🚀 Running database migrations...\n');

  try {
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No SQL migrations found.');
      process.exit(0);
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(migrationsDir, file);

      console.log(
        `Running migration ${i + 1}/${files.length}: ${file}`
      );

      const sql = fs.readFileSync(filePath, 'utf8');

      await query(sql);

      console.log(`✓ ${file} completed\n`);
    }

    console.log('✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();