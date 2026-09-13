import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../index.js';

describe('Authentication API', () => {
  let authToken;
  const testUser = {
    name: 'Test User',
    email: `test${Date.now()}@example.com`,
    password: 'TestPass123',
  };

  it('should register a new user', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(testUser.email);
    expect(response.body.user.name).toBe(testUser.name);
    authToken = response.body.token;
  });

  it('should not register duplicate email', async () => {
    await request(app)
      .post('/auth/register')
      .send(testUser)
      .expect(409);
  });

  it('should login with correct credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body.user.email).toBe(testUser.email);
  });

  it('should not login with incorrect password', async () => {
    await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      })
      .expect(401);
  });

  it('should get current user with valid token', async () => {
    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(response.body.user.email).toBe(testUser.email);
  });

  it('should not get user without token', async () => {
    await request(app)
      .get('/auth/me')
      .expect(401);
  });
});
