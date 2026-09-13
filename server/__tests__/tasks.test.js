import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../index.js';

describe('Tasks API', () => {
  let authToken;
  let projectId;
  let taskId;

  beforeAll(async () => {
    // Create test user and project
    const email = `tasktest${Date.now()}@example.com`;
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        name: 'Task Test User',
        email,
        password: 'TestPass123',
      });
    
    authToken = registerResponse.body.token;

    const projectResponse = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Task Test Project',
        description: 'For testing tasks',
      });

    projectId = projectResponse.body.project.id;
  });

  it('should create a new task', async () => {
    const response = await request(app)
      .post(`/tasks/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Task',
        description: 'This is a test task',
        priority: 'high',
      })
      .expect(201);

    expect(response.body.task).toHaveProperty('id');
    expect(response.body.task.title).toBe('Test Task');
    expect(response.body.task.status).toBe('todo');
    expect(response.body.task.priority).toBe('high');
    taskId = response.body.task.id;
  });

  it('should get all tasks for a project', async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.tasks).toBeInstanceOf(Array);
    expect(response.body.tasks.length).toBeGreaterThan(0);
  });

  it('should update task status', async () => {
    const response = await request(app)
      .put(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        status: 'in-progress',
      })
      .expect(200);

    expect(response.body.task.status).toBe('in-progress');
    expect(response.body.task.started_at).not.toBeNull();
  });

  it('should mark task as done', async () => {
    const response = await request(app)
      .put(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        status: 'done',
      })
      .expect(200);

    expect(response.body.task.status).toBe('done');
    expect(response.body.task.completed_at).not.toBeNull();
  });

  it('should filter tasks by status', async () => {
    const response = await request(app)
      .get(`/tasks/projects/${projectId}/tasks?status=done`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.tasks.every(t => t.status === 'done')).toBe(true);
  });

  it('should delete a task', async () => {
    await request(app)
      .delete(`/tasks/${taskId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);
  });
});
