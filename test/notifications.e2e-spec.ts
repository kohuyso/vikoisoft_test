import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Notifications API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/notifications/enqueue should accept notification with HTTP 202', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/notifications/enqueue')
      .send({
        orderId: 501,
        recipientEmail: 'e2e_user@example.com',
        orderStatus: 'CONFIRMED',
        templateData: { customerName: 'Alice' },
      })
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.statusCode).toBe(202);
    expect(response.body.data.jobId).toBeDefined();
  });

  it('GET /api/notifications/metrics should return worker pool metrics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/notifications/metrics')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.maxConcurrency).toBe(50);
    expect(typeof response.body.data.activeWorkers).toBe('number');
  });

  it('POST /api/notifications/batch-benchmark should accept burst of jobs', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/notifications/batch-benchmark')
      .send({ count: 20 })
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.data.enqueued).toBe(20);
  });

  it('GET /api/notifications/logs should return audit logs', async () => {
    // Wait briefly for previous enqueued jobs to process
    await new Promise((r) => setTimeout(r, 100));

    const response = await request(app.getHttpServer())
      .get('/api/notifications/logs?limit=10')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('POST /api/notifications/enqueue should reject invalid email format with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/notifications/enqueue')
      .send({
        orderId: 501,
        recipientEmail: 'not_an_email',
        orderStatus: 'CONFIRMED',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(400);
  });

  it('POST /api/notifications/batch-benchmark should reject count > 5000 with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/notifications/batch-benchmark')
      .send({ count: 99999 })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(400);
  });

  it('GET /api/notifications/logs should reject negative limit with 400 (not 500)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/notifications/logs?limit=-5')
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.statusCode).toBe(400);
  });
});
