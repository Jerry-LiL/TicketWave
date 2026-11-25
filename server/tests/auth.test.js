const request = require('supertest');
const { createApp } = require('../src/app');
const { closePool } = require('../src/db');
const { resetDatabase, register } = require('./helpers');

describe('auth', () => {
  const app = createApp();

  beforeEach(resetDatabase);
  afterAll(closePool);

  test('register, login, and me', async () => {
    const created = await register(app, {
      name: 'Vineet Kumar',
      email: 'vineet@example.com',
      password: 'correct-horse',
    });

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${created.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      id: created.user.id,
      email: 'vineet@example.com',
      name: 'Vineet Kumar',
    });

    const login = await request(app).post('/api/auth/login').send({
      email: 'Vineet@Example.com',
      password: 'correct-horse',
    });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('vineet@example.com');

    const again = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(again.status).toBe(200);
  });

  test('rejects a duplicate email, a short password, and a wrong password', async () => {
    await register(app, { email: 'ada@example.com' });

    const duplicate = await request(app).post('/api/auth/register').send({
      name: 'Ada Lopez',
      email: 'ada@example.com',
      password: 'correct-horse',
    });
    expect(duplicate.status).toBe(409);

    const short = await request(app).post('/api/auth/register').send({
      name: 'Ada Lopez',
      email: 'other@example.com',
      password: 'short',
    });
    expect(short.status).toBe(400);

    const wrong = await request(app).post('/api/auth/login').send({
      email: 'ada@example.com',
      password: 'not-the-password',
    });
    expect(wrong.status).toBe(401);

    const missing = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'correct-horse',
    });
    expect(missing.status).toBe(401);
    expect(missing.body.error).toBe(wrong.body.error);

    const me = await request(app).get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});
