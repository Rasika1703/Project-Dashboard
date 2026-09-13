import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import type { Task } from '@/types';

const WS_URL = (import.meta.env.VITE_WS_URL as string) || 'http://localhost:3001';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const newSocket = io(WS_URL, {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Handle task events
    newSocket.on('task_created', ({ task }: { task: Task }) => {
      console.log('Task created:', task);
      queryClient.setQueryData<Task[]>(
        ['tasks', task.project_id],
        (old) => (old ? [task, ...old] : [task])
      );
    });

    newSocket.on('task_updated', ({ task }: { task: Task }) => {
      console.log('Task updated:', task);
      queryClient.setQueryData<Task[]>(
        ['tasks', task.project_id],
        (old) => (old ? old.map((t) => (t.id === task.id ? task : t)) : [task])
      );
    });

    newSocket.on('task_deleted', ({ taskId }: { taskId: string }) => {
      console.log('Task deleted:', taskId);
      // Update all task queries
      queryClient.setQueriesData<Task[]>(
        { queryKey: ['tasks'] },
        (old) => (old ? old.filter((t) => t.id !== taskId) : [])
      );
    });

    newSocket.on('activity_logged', () => {
      // Invalidate activity queries
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, queryClient]);

  const joinProject = useCallback(
    (projectId: string) => {
      if (socket && isConnected) {
        socket.emit('join_project', projectId);
      }
    },
    [socket, isConnected]
  );

  const leaveProject = useCallback(
    (projectId: string) => {
      if (socket && isConnected) {
        socket.emit('leave_project', projectId);
      }
    },
    [socket, isConnected]
  );

  return (
    <WebSocketContext.Provider value={{ socket, isConnected, joinProject, leaveProject }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
