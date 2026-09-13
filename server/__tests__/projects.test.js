import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../index.js';

describe('Projects API', () => {
  let authToken;
  let projectId;

  beforeAll(async () => {
    // Create test user and login
    const email = `projecttest${Date.now()}@example.com`;
    const registerResponse = await request(app)
      .post('/auth/register')
      .send({
        name: 'Project Test User',
        email,
        password: 'TestPass123',
      });
    
    authToken = registerResponse.body.token;
  });

  it('should create a new project', async () => {
    const response = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Project',
        description: 'This is a test project',
      })
      .expect(201);

    expect(response.body.project).toHaveProperty('id');
    expect(response.body.project.title).toBe('Test Project');
    projectId = response.body.project.id;
  });

  it('should get all projects', async () => {
    const response = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.projects).toBeInstanceOf(Array);
    expect(response.body.projects.length).toBeGreaterThan(0);
  });

  it('should get a single project', async () => {
    const response = await request(app)
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.project.id).toBe(projectId);
    expect(response.body.project.title).toBe('Test Project');
  });

  it('should update a project', async () => {
    const response = await request(app)
      .put(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Updated Test Project',
      })
      .expect(200);

    expect(response.body.project.title).toBe('Updated Test Project');
  });

  it('should not access project without auth', async () => {
    await request(app)
      .get(`/projects/${projectId}`)
      .expect(401);
  });

  it('should delete a project', async () => {
    await request(app)
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);
  });
});
