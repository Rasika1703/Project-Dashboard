# Developer Dashboard

A full-stack application for managing projects and tasks with real-time synchronization, built-in analytics, and role-based access control.

## Features

- **Authentication**: JWT-based auth with role-based access control (admin/user)
- **Projects & Tasks**: Full CRUD operations with ownership and permissions
- **Real-time Sync**: WebSocket-based live updates across all connected clients
- **Analytics Engine**: Built-in analytics with task completion trends, time tracking, and user activity
- **Activity Logging**: Complete audit trail for all operations
- **Modern UI**: React + TypeScript with Kanban board, charts, and live activity feed

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL with optimized indexes
- Socket.IO for WebSocket
- JWT authentication
- Bcrypt password hashing

### Frontend
- React 18 + TypeScript
- React Query for state management
- Socket.IO client
- TailwindCSS + shadcn/ui
- Recharts for analytics visualization
- React Beautiful DnD for Kanban

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Installation

1. **Clone the repository:**

2. **Install dependencies:**
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

3. **Set up environment variables:**
```bash
# Backend environment
cp .env.example .env
# Edit .env with your database credentials and secrets

# Frontend environment
cd client
cp .env.example .env
# Edit .env with your API URL (use public IP if deploying)
cd ..
```

**Important:** Update these values in your `.env` files:
- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET`: Generate a strong secret key
- `REFRESH_TOKEN_SECRET`: Generate another strong secret key
- `CLIENT_URL`: Your frontend URL (for CORS)
- `VITE_API_URL` (in client/.env): Your backend API URL
- `VITE_WS_URL` (in client/.env): Your WebSocket URL

4. **Create database and run migrations:**
```bash
# Create PostgreSQL database
createdb devdashboard

# Run migrations
npm run migrate
```

5. **(Optional) Seed with sample data:**
```bash
npm run seed
```

This creates test users:
- Admin: `admin@example.com` / `admin123`
- User: `alice@example.com` / `user123`
- User: `bob@example.com` / `user123`

6. **Start development servers:**
```bash
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:5173

### Deployment Notes

For production deployment:
- Set `NODE_ENV=production`
- Use strong, unique secrets for JWT tokens
- Configure proper CORS origins
- Set up SSL/TLS certificates
- Use environment-specific database credentials
- Open necessary ports in your firewall/security groups (3001, 5173)

## API Documentation

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token

### Projects
- `GET /projects` - List projects (filtered by role)
- `POST /projects` - Create project
- `PUT /projects/:id` - Update project
- `DELETE /projects/:id` - Delete project

### Tasks
- `GET /projects/:id/tasks` - List tasks with filters
- `POST /projects/:id/tasks` - Create task
- `PUT /tasks/:id` - Update task (auto-tracks timestamps)
- `DELETE /tasks/:id` - Delete task

### Analytics
- `GET /analytics/projects/:id/summary` - Project analytics with date range
- `GET /analytics/users/:id/activity` - User activity metrics

### WebSocket Events
Connect to `/ws/projects/:projectId` with JWT token:
- `task_created` - New task added
- `task_updated` - Task modified
- `task_deleted` - Task removed
- `activity_logged` - New activity entry

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm test:watch
```

## Architecture Highlights

### Database Design
- Optimized indexes for common queries
- Cascade deletes for data integrity
- JSONB for flexible metadata storage
- Timestamp tracking for analytics

### Real-time Protocol
- Per-project WebSocket namespaces
- JWT authentication on connection
- Optimistic UI updates with reconciliation
- Automatic reconnection handling

### Analytics Algorithms
- Time-series aggregation with gap filling
- Average completion time calculation
- Active user ranking
- Status distribution analysis

### Security
- Bcrypt password hashing (cost 12)
- JWT with short expiry
- Rate limiting on auth endpoints
- Parameterized queries (SQL injection prevention)
- Role-based access control
- WebSocket authentication

## Performance Considerations

- Indexed queries for fast lookups
- Pagination for large datasets
- Row-level locking for concurrent updates
- React Query caching strategy
- Optimistic UI updates

## License

MIT
