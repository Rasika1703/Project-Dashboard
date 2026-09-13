ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users
SET role = 'ADMIN'
WHERE role = 'admin';

UPDATE users
SET role = 'PROJECT_MANAGER'
WHERE role = 'user';

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('ADMIN', 'PROJECT_MANAGER', 'DEVELOPER'));

ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'DEVELOPER';

CREATE INDEX IF NOT EXISTS idx_users_role
ON users(role);


CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    company VARCHAR(200),
    phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_name
ON clients(name);


ALTER TABLE projects
ADD COLUMN IF NOT EXISTS client_id UUID
REFERENCES clients(id) ON DELETE RESTRICT;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS created_by UUID
REFERENCES users(id) ON DELETE RESTRICT;

UPDATE projects
SET created_by = owner_id
WHERE created_by IS NULL;

ALTER TABLE projects
ALTER COLUMN created_by SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_created_by
ON projects(created_by);

CREATE INDEX IF NOT EXISTS idx_projects_client_id
ON projects(client_id);

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_priority_check;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS assigned_developer_id UUID
REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS overdue_at TIMESTAMPTZ;

UPDATE tasks
SET status = CASE
    WHEN status = 'todo' THEN 'TODO'
    WHEN status = 'in-progress' THEN 'IN_PROGRESS'
    WHEN status = 'done' THEN 'DONE'
    ELSE status
END;

UPDATE tasks
SET priority = CASE
    WHEN priority = 'low' THEN 'LOW'
    WHEN priority = 'medium' THEN 'MEDIUM'
    WHEN priority = 'high' THEN 'HIGH'
    ELSE priority
END;
-- Convert existing task data before applying the new constraints
UPDATE tasks
SET status = CASE
    WHEN LOWER(status) = 'todo' THEN 'TODO'
    WHEN LOWER(status) IN ('in-progress', 'in_progress') THEN 'IN_PROGRESS'
    WHEN LOWER(status) IN ('in-review', 'in_review') THEN 'IN_REVIEW'
    WHEN LOWER(status) = 'done' THEN 'DONE'
    ELSE UPPER(status)
END;

UPDATE tasks
SET priority = CASE
    WHEN LOWER(priority) = 'low' THEN 'LOW'
    WHEN LOWER(priority) = 'medium' THEN 'MEDIUM'
    WHEN LOWER(priority) = 'high' THEN 'HIGH'
    WHEN LOWER(priority) = 'critical' THEN 'CRITICAL'
    ELSE UPPER(priority)
END;

ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
ADD CONSTRAINT tasks_status_check
CHECK (
    status IN (
        'TODO',
        'IN_PROGRESS',
        'IN_REVIEW',
        'DONE'
    )
);
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_priority_check;

ALTER TABLE tasks
ADD CONSTRAINT tasks_priority_check
CHECK (
    priority IN (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    )
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_developer
ON tasks(assigned_developer_id);

CREATE INDEX IF NOT EXISTS idx_tasks_status
ON tasks(status);

CREATE INDEX IF NOT EXISTS idx_tasks_priority
ON tasks(priority);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_overdue
ON tasks(is_overdue);


CREATE TABLE IF NOT EXISTS task_status_history (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID NOT NULL
        REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_status_history_task
ON task_status_history(task_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_status_history_changed_by
ON task_status_history(changed_by);


ALTER TABLE activity_logs
ADD COLUMN IF NOT EXISTS task_id UUID
REFERENCES tasks(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_activity_task_time
ON activity_logs(task_id, created_at DESC);


CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    project_id UUID
        REFERENCES projects(id) ON DELETE CASCADE,
    task_id UUID
        REFERENCES tasks(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_created
ON notifications(created_at DESC);


CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
ON refresh_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry
ON refresh_tokens(expires_at);


CREATE INDEX IF NOT EXISTS idx_projects_owner_id
ON projects(owner_id);