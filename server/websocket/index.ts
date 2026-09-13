import { createServer } from 'http';
import {
  Server,
  type Socket,
} from 'socket.io';

import { verifySocketToken } from '../middleware/auth.js';
import { query } from '../db/index.js';
import type { AuthUser } from '../types/auth.js';

interface SocketData {
  user?: AuthUser;
}

interface ServerToClientEvents {
  error: (data: { message: string }) => void;
  joined_project: (data: { projectId: string }) => void;
  user_joined: (data: {
    userId: string;
    userName: string;
    projectId: string;
  }) => void;
  user_left: (data: {
    userId: string;
    userName: string;
    projectId: string;
  }) => void;
  online_count: (data: { count: number }) => void;
  task_created: (data: unknown) => void;
  task_updated: (data: unknown) => void;
  task_deleted: (data: unknown) => void;
}

interface ClientToServerEvents {
  join_project: (projectId: string) => void;
  leave_project: (projectId: string) => void;
}

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

let io: Server<
  ClientToServerEvents,
  ServerToClientEvents
> | undefined;

const projectRooms =
  new Map<string, Set<string>>();

const connectedUsers =
  new Map<string, Set<string>>();

const getSocketToken = (
  socket: AppSocket
): string | undefined => {
  const authToken = socket.handshake.auth
    ?.token;

  if (typeof authToken === 'string') {
    return authToken;
  }

  const queryToken =
    socket.handshake.query.token;

  if (typeof queryToken === 'string') {
    return queryToken;
  }

  return undefined;
};

export const initializeWebSocket = (
  server: ReturnType<typeof createServer>
): Server<ClientToServerEvents, ServerToClientEvents> => {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin:
        process.env.CLIENT_URL || '*',
      credentials: true,
    },
    path: '/ws',
  });

  io.use((socket, next) => {
    const appSocket =
      socket as AppSocket;

    const token =
      getSocketToken(appSocket);

    if (!token) {
      next(
        new Error('Authentication required')
      );
      return;
    }

    const user =
      verifySocketToken(token);

    if (!user) {
      next(
        new Error('Invalid access token')
      );
      return;
    }

    appSocket.data.user = user;
    next();
  });

  io.on(
    'connection',
    (rawSocket) => {
      const socket =
        rawSocket as AppSocket;

      const user = socket.data.user;

      if (!user) {
        socket.disconnect();
        return;
      }

      console.log(
        `User ${user.name} (${user.id}) connected: ${socket.id}`
      );

      if (!connectedUsers.has(user.id)) {
        connectedUsers.set(
          user.id,
          new Set()
        );
      }

      connectedUsers
        .get(user.id)!
        .add(socket.id);

      io?.emit('online_count', {
        count: connectedUsers.size,
      });

      socket.on(
        'join_project',
        async (projectId: string) => {
          try {
            const result = await query(
              `
                SELECT owner_id
                FROM projects
                WHERE id = $1
              `,
              [projectId]
            );

            if (result.rows.length === 0) {
              socket.emit('error', {
                message:
                  'Project not found',
              });
              return;
            }

            const project =
              result.rows[0];

            const hasAccess =
              user.role === 'ADMIN' ||
              project.owner_id === user.id;

            if (!hasAccess) {
              socket.emit('error', {
                message:
                  'Access denied',
              });
              return;
            }

            const roomName =
              `project:${projectId}`;

            await socket.join(
              roomName
            );

            if (
              !projectRooms.has(
                projectId
              )
            ) {
              projectRooms.set(
                projectId,
                new Set()
              );
            }

            projectRooms
              .get(projectId)!
              .add(socket.id);

            socket.emit(
              'joined_project',
              {
                projectId,
              }
            );

            socket.to(roomName).emit(
              'user_joined',
              {
                userId: user.id,
                userName: user.name,
                projectId,
              }
            );
          } catch (error) {
            console.error(
              'Join project error:',
              error
            );

            socket.emit('error', {
              message:
                'Failed to join project',
            });
          }
        }
      );

      socket.on(
        'leave_project',
        (projectId: string) => {
          const roomName =
            `project:${projectId}`;

          socket.leave(roomName);

          const sockets =
            projectRooms.get(
              projectId
            );

          if (sockets) {
            sockets.delete(
              socket.id
            );

            if (sockets.size === 0) {
              projectRooms.delete(
                projectId
              );
            }
          }

          socket
            .to(roomName)
            .emit('user_left', {
              userId: user.id,
              userName: user.name,
              projectId,
            });
        }
      );

      socket.on(
        'disconnect',
        () => {
          console.log(
            `User ${user.name} disconnected: ${socket.id}`
          );

          const userSockets =
            connectedUsers.get(
              user.id
            );

          if (userSockets) {
            userSockets.delete(
              socket.id
            );

            if (
              userSockets.size === 0
            ) {
              connectedUsers.delete(
                user.id
              );
            }
          }

          projectRooms.forEach(
            (sockets, projectId) => {
              if (
                sockets.has(
                  socket.id
                )
              ) {
                sockets.delete(
                  socket.id
                );

                if (
                  sockets.size === 0
                ) {
                  projectRooms.delete(
                    projectId
                  );
                }

                socket
                  .to(
                    `project:${projectId}`
                  )
                  .emit(
                    'user_left',
                    {
                      userId: user.id,
                      userName:
                        user.name,
                      projectId,
                    }
                  );
              }
            }
          );

          io?.emit(
            'online_count',
            {
              count:
                connectedUsers.size,
            }
          );
        }
      );
    }
  );

  console.log(
    '✓ WebSocket server initialized'
  );

  return io;
};

export const emitToProject = (
  projectId: string,
  event: keyof ServerToClientEvents,
  data: unknown
): void => {
  if (!io) {
    console.warn('WebSocket not initialized');
    return;
  }

  io.to(`project:${projectId}`).emit(event, data as never);
};
export const getProjectClientCount = (
  projectId: string
): number => {
  return (
    projectRooms.get(projectId)
      ?.size ?? 0
  );
};

export const getOnlineUserCount = (): number => {
  return connectedUsers.size;
};

export default {
  initializeWebSocket,
  emitToProject,
  getProjectClientCount,
  getOnlineUserCount,
};




