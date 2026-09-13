import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, tasksApi, analyticsApi } from '@/lib/api';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { ArrowLeft, Plus, BarChart3, GripVertical } from 'lucide-react';
import type { Task, TaskStatus, TasksByStatus } from '@/types';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0ea5e9', '#f59e0b', '#10b981'];

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { joinProject, leaveProject } = useWebSocket();
  const [newTask, setNewTask] = useState({
  title: '',
  description: '',
  priority: 'MEDIUM',
  assignedDeveloperId: '',
});  const [showAnalytics, setShowAnalytics] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.getProject(id!),
  });

  const { data: developers = [] } = useQuery({
  queryKey: ['developers'],
  queryFn: tasksApi.getDevelopers,
});

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => tasksApi.getTasks(id!),
  });

  const { data: analytics } = useQuery({
    queryKey: ['analytics', id],
    queryFn: () => analyticsApi.getProjectSummary(id!),
    enabled: showAnalytics,
  });

  useEffect(() => {
    if (id) {
      joinProject(id);
      return () => leaveProject(id);
    }
  }, [id, joinProject, leaveProject]);

  const createTaskMutation = useMutation({
    mutationFn: (data: any) => tasksApi.createTask(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      setNewTask({
  title: '',
  description: '',
  priority: 'MEDIUM',
  assignedDeveloperId: '',
});    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: any }) => tasksApi.updateTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: tasksApi.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    },
  });

 const tasksByStatus: TasksByStatus = {
  TODO: tasks.filter((t: Task) => t.status === 'TODO'),
  IN_PROGRESS: tasks.filter((t: Task) => t.status === 'IN_PROGRESS'),
  IN_REVIEW: tasks.filter((t: Task) => t.status === 'IN_REVIEW'),
  DONE: tasks.filter((t: Task) => t.status === 'DONE'),
};

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.title.trim()) {
      createTaskMutation.mutate(newTask);
    }
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTaskMutation.mutate({ taskId, data: { status: newStatus } });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTaskId) {
      const task = tasks.find((t: Task) => t.id === draggedTaskId);
      if (task && task.status !== newStatus) {
        handleStatusChange(draggedTaskId, newStatus);
      }
      setDraggedTaskId(null);
    }
  };

  const renderKanbanColumn = (status: TaskStatus, title: string) => (
    <div
      key={status}
      className="flex-1 bg-gray-50 rounded-lg p-4 min-h-[400px]"
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, status)}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
          {tasksByStatus[status].length}
        </span>
      </div>
      <div className="space-y-3 min-h-[300px]">
        {tasksByStatus[status].map((task: Task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragEnd={() => setDraggedTaskId(null)}
            className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-200 cursor-move ${
              draggedTaskId === task.id ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="mt-1 text-gray-400 hover:text-gray-600">
                <GripVertical className="h-4 w-4" />
              </div>
              <h4 className="font-medium text-gray-900 flex-1">{task.title}</h4>
              <button
                onClick={() => {
                  if (confirm('Delete this task?')) {
                    deleteTaskMutation.mutate(task.id);
                  }
                }}
                className="text-gray-400 hover:text-red-600 text-sm"
              >
                ×
              </button>
            </div>
            {task.description && (
              <p className="text-sm text-gray-600 mb-3 ml-6">{task.description}</p>
            )}
            <div className="flex items-center justify-between ml-6">
              <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </span>
              <select
                value={task.status}
                onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
             <option value="TODO">To Do</option>
<option value="IN_PROGRESS">In Progress</option>
<option value="IN_REVIEW">In Review</option>
<option value="DONE">Done</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project?.title}</h1>
            <p className="text-sm text-gray-600 mt-1">{project?.description}</p>
          </div>
        </div>
        <button
          onClick={() => setShowAnalytics(!showAnalytics)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            showAnalytics ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <BarChart3 className="h-5 w-5" />
          <span>{showAnalytics ? 'Hide Analytics' : 'Show Analytics'}</span>
        </button>
      </div>

      {showAnalytics && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Tasks Completed Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.tasksCompletedPerDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Task Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'To Do', value: analytics.taskCountsByStatus.todo },
                    { name: 'In Progress', value: analytics.taskCountsByStatus['in-progress'] },
                    { name: 'Done', value: analytics.taskCountsByStatus.done },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[0, 1, 2].map((index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Active Users</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.activeUsers.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="actions_count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-gray-600">Avg Completion Time</span>
                <span className="font-semibold text-gray-900">
                  {analytics.avgCompletionTimeHours.toFixed(1)} hours
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-gray-600">Total Tasks</span>
                <span className="font-semibold text-gray-900">{tasks.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-gray-600">Completed</span>
                <span className="font-semibold text-green-600">
                  {analytics.taskCountsByStatus.done}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Create New Task</h3>
        <form onSubmit={handleCreateTask} className="flex gap-3">
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="Task title"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            required
          />

          <select
            value={newTask.assignedDeveloperId}
            onChange={(e) =>
              setNewTask({
                ...newTask,
                assignedDeveloperId: e.target.value,
              })
            }
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            required
          >
            <option value="">Assign Developer</option>
            {developers.map((developer) => (
              <option key={developer.id} value={developer.id}>
                {developer.name}
              </option>
            ))}
          </select>

          <select
            value={newTask.priority}
            onChange={(e) =>
              setNewTask({
                ...newTask,
                priority: e.target.value,
              })
            }
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>

          <button
            type="submit"
            disabled={createTaskMutation.isPending}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
            <span>Add</span>
          </button>
        </form>      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
   {renderKanbanColumn('TODO', 'To Do')}
{renderKanbanColumn('IN_PROGRESS', 'In Progress')}
{renderKanbanColumn('IN_REVIEW', 'In Review')}
{renderKanbanColumn('DONE', 'Done')}
      </div>
    </div>
  );
}


