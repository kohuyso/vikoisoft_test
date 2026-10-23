import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Redis Infrastructure API (e2e)', () => {
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

  it('GET /api/redis/status should return Redis connectivity info', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/redis/status')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(['redis', 'fallback_in_memory']).toContain(response.body.data.mode);
    expect(response.body.data.host).toBeDefined();
    expect(response.body.data.port).toBeDefined();
    expect(typeof response.body.data.keysCount).toBe('number');
  });

  it('Cache-aside: creating and retrieving orders interacts smoothly with Redis cache', async () => {
    // 1. Create order
    const createRes = await request(app.getHttpServer())
      .post('/api/orders')
      .send({
        user_id: 88,
        items: [{ product_id: 1, quantity: 5 }],
      })
      .expect(201);

    const orderId = createRes.body.data.id;

    // 2. First fetch (populates/reads cache)
    const fetch1 = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .expect(200);
    expect(fetch1.body.data.user_id).toBe(88);

    // 3. Second fetch (hits cache)
    const fetch2 = await request(app.getHttpServer())
      .get(`/api/orders/${orderId}`)
      .expect(200);
    expect(fetch2.body.data).toEqual(fetch1.body.data);
  });
});
