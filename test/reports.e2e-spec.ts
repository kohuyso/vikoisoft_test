import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Reports API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /mock/external/:userId should return user activity stats', async () => {
    const response = await request(app.getHttpServer())
      .get('/mock/external/1?delayMs=20')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.activity_count).toBe(42);
  });

  it('GET /api/report should return combined report data for all local users', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/report?timeoutMs=1000')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBe(3);

    const userNames = response.body.data.map((u: { name: string }) => u.name);
    expect(userNames).toContain('Alice');
    expect(userNames).toContain('Bob');
    expect(userNames).toContain('Charlie');
  }, 10000);
});
