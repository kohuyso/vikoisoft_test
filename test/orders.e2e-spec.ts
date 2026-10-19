import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Orders API (e2e)', () => {
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

  describe('POST /api/orders', () => {
    it('should create an order successfully with HTTP 201 Created', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          user_id: 1,
          items: [
            { product_id: 101, quantity: 2 },
            { product_id: 202, quantity: 1 },
          ],
          note: 'Please deliver to front door',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.statusCode).toBe(201);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.user_id).toBe(1);
      expect(response.body.data.items.length).toBe(2);
      expect(response.body.data.total_items).toBe(3);
      expect(response.body.data.note).toBe('Please deliver to front door');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('should reject request with HTTP 400 when items is empty', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          user_id: 1,
          items: [],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should reject request with HTTP 400 when user_id is missing or non-positive', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          user_id: -5,
          items: [{ product_id: 101, quantity: 1 }],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
    });

    it('should reject request with HTTP 400 when item quantity is not positive', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          user_id: 1,
          items: [{ product_id: 101, quantity: 0 }],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
    });
  });

  describe('GET /api/orders & GET /api/orders/:id', () => {
    it('should list all orders and retrieve an order by ID', async () => {
      // 1. Create an order
      const createRes = await request(app.getHttpServer())
        .post('/api/orders')
        .send({
          user_id: 42,
          items: [{ product_id: 99, quantity: 4 }],
        })
        .expect(201);

      const createdId = createRes.body.data.id;

      // 2. Query all orders
      const listRes = await request(app.getHttpServer())
        .get('/api/orders')
        .expect(200);

      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data)).toBe(true);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      // 3. Query specific order by ID
      const getRes = await request(app.getHttpServer())
        .get(`/api/orders/${createdId}`)
        .expect(200);

      expect(getRes.body.data.id).toBe(createdId);
      expect(getRes.body.data.user_id).toBe(42);
    });

    it('should return HTTP 404 when order ID does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders/999999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(404);
    });
  });
});
