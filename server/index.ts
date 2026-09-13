import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { initializeWebSocket } from './websocket/index.js';

import authRoutes from './routes/auth.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

dotenv.config();

const app = express();
const server = createServer(app);

initializeWebSocket(server);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', authRoutes);
app.use('/projects', projectsRoutes);
app.use('/tasks', tasksRoutes);
app.use('/analytics', analyticsRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
  });
});

app.use(
  (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error('Unhandled error:', err);

    res.status(500).json({
      error: 'Internal server error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : undefined,
    });
  }
);

const PORT = Number(process.env.PORT) || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║   Developer Dashboard Server              ║
║                                            ║
║   🚀 Server running on port ${PORT}         ║
║   🌐 API: http://0.0.0.0:${PORT}            ║
║   🔌 WebSocket: ws://0.0.0.0:${PORT}/ws     ║
║                                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                  ║
╚════════════════════════════════════════════╝
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
