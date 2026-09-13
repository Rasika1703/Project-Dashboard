export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface Project {
  id: string;
  owner_id: string;
  owner_name?: string;
  owner_email?: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  task_count?: number;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'low' | 'medium' | 'high';

// Type for tasksByStatus object
export type TasksByStatus = {
  [key in TaskStatus]: Task[];
};

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  user_name?: string;
  project_id: string;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ProjectSummary {
  taskCountsByStatus: {
    todo: number;
    'in-progress': number;
    done: number;
  };
  tasksCompletedPerDay: Array<{
    date: string;
    count: number;
  }>;
  avgCompletionTimeHours: number;
  activeUsers: Array<{
    user_id: string;
    name: string;
    actions_count: number;
  }>;
  taskCountsByPriority: {
    low: number;
    medium: number;
    high: number;
  };
  recentActivity: ActivityLog[];
}

export interface UserActivity {
  totalActions: number;
  actionsByType: Array<{
    action: string;
    count: number;
  }>;
  actionsPerDay: Array<{
    date: string;
    count: number;
  }>;
  projectsContributed: Array<{
    project_id: string;
    title: string;
    actions_count: number;
  }>;
  tasksCreated: number;
  tasksCompleted: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}


