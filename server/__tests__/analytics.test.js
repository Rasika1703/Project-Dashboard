import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../index.js';

describe('Analytics API', () => {
  let authToken;
  let projectId;
  let userId;

  beforeAll(async () => {
    // Create test user and project with tasks
    const email = `analyticstest${Date.now()}@example.com`;
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        name: 'Analytics Test User',
        email,
        password: 'TestPass123',
      });
    
    authToken = registerResponse.body.token;
    userId = registerResponse.body.user.id;

    const projectResponse = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Analytics Test Project',
        description: 'For testing analytics',
      });

    projectId = projectResponse.body.project.id;

    // Create some tasks
    await request(app)
      .post(`/tasks/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Task 1', priority: 'high' });

    await request(app)
      .post(`/tasks/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Task 2', priority: 'medium' });
  });

  it('should get project summary analytics', async () => {
    const response = await request(app)
      .get(`/analytics/projects/${projectId}/summary`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('taskCountsByStatus');
    expect(response.body).toHaveProperty('tasksCompletedPerDay');
    expect(response.body).toHaveProperty('avgCompletionTimeHours');
    expect(response.body).toHaveProperty('activeUsers');
    expect(response.body).toHaveProperty('taskCountsByPriority');
  });

  it('should get user activity analytics', async () => {
    const response = await request(app)
      .get(`/analytics/users/${userId}/activity`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('totalActions');
    expect(response.body).toHaveProperty('actionsByType');
    expect(response.body).toHaveProperty('actionsPerDay');
    expect(response.body).toHaveProperty('projectsContributed');
  });

  it('should get project snapshot', async () => {
    const response = await request(app)
      .get(`/analytics/projects/${projectId}/snapshot`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('project');
    expect(response.body).toHaveProperty('tasks');
    expect(response.body).toHaveProperty('recentActivity');
    expect(response.body.tasks).toBeInstanceOf(Array);
  });

  it('should support date range filtering', async () => {
    const today = new Date().toISOString().split('T')[0];
    const response = await request(app)
      .get(`/analytics/projects/${projectId}/summary?from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.tasksCompletedPerDay).toBeInstanceOf(Array);
  });
});
