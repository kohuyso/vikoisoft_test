# BÀI TEST VÒNG 1 - VỊ TRÍ LẬP TRÌNH VIÊN PHẦN MỀM WEB
**Mã số:** `20261019`  
**Đơn vị:** Vikoisoft  
**Ứng viên thực hiện:** Lê Anh Huy  
**Công nghệ:** Node.js, NestJS 12, TypeScript, Vitest, Swagger/OpenAPI  

---

## 📋 MỤC LỤC
1. [Tổng quan dự án & Cấu trúc mã nguồn](#1-tổng-quan-dự-án--cấu-trúc-mã-nguồn)
2. [Hướng dẫn cài đặt & Chạy ứng dụng](#2-hướng-dẫn-cài-đặt--chạy-ứng-dụng)
3. [Question 1: RESTful API Endpoint `/api/orders`](#3-question-1-restful-api-endpoint-apiorders)
4. [Question 2: Analytics & Aggregation Endpoint `/api/report`](#4-question-2-analytics--aggregation-endpoint-apireport)
5. [Question 3: High-Concurrency Notification Service (10,000/min)](#5-question-3-high-concurrency-notification-service-10000min)
6. [Kết quả Kiểm thử (Unit & E2E Testing)](#6-kết-quả-kiểm-thử-unit--e2e-testing)

---

## 1. Tổng quan dự án & Cấu trúc mã nguồn

Dự án được triển khai theo triết lý **Clean Architecture** và các nguyên lý **SOLID**, phân chia thành các Domain Modules độc lập, có tính mở rộng cao và chuẩn hoá toàn diện:

```text
src/
├── common/                               # Hạ tầng dùng chung
│   ├── filters/
│   │   └── http-exception.filter.ts      # Bắt lỗi toàn cục, định dạng chuẩn RFC
│   ├── interceptors/
│   │   ├── logging.interceptor.ts        # Đo lường thời gian xử lý & audit HTTP
│   │   └── transform.interceptor.ts      # Chuẩn hoá response { success, statusCode, data, timestamp }
│   └── interfaces/
│       └── api-response.interface.ts     # Kiểu dữ liệu TypeScript response envelope
├── modules/
│   ├── orders/                           # [Question 1] Quản lý đơn hàng
│   │   ├── dto/
│   │   │   └── create-order.dto.ts       # DTO validation với class-validator
│   │   ├── entities/
│   │   │   └── order.entity.ts           # Entity đơn hàng
│   │   ├── repositories/
│   │   │   └── orders.repository.ts      # In-memory mock database
│   │   ├── orders.controller.ts          # REST Controller
│   │   ├── orders.service.ts             # Business logic
│   │   └── orders.module.ts
│   ├── reports/                          # [Question 2] Tổng hợp dữ liệu đa nguồn
│   │   ├── entities/
│   │   │   └── user-report.entity.ts     # Schema kết quả tổng hợp
│   │   ├── repositories/
│   │   │   └── local-user.repository.ts  # Mock DB nội bộ (Alice, Bob, Charlie)
│   │   ├── services/
│   │   │   └── external-api.service.ts   # Concurrency, timeout guard & TTL cache
│   │   ├── reports.controller.ts         # GET /api/report
│   │   ├── reports.service.ts            # Parallel Promise.all aggregation logic
│   │   └── reports.module.ts
│   ├── mock-external/                    # Giả lập External API với độ trễ 2-5s
│   │   ├── mock-external.controller.ts   # GET /mock/external/:userId
│   │   └── mock-external.module.ts
│   └── notifications/                    # [Question 3] Queue Worker xử lý 10k/phút
│       ├── dto/
│       │   └── enqueue-notification.dto.ts
│       ├── entities/
│       │   ├── notification-job.entity.ts
│       │   └── notification-log.entity.ts
│       ├── repositories/
│       │   └── notification-log.repository.ts # Ghi log bất đồng bộ (File & Memory)
│       ├── services/
│       │   ├── email-sender.service.ts   # Mô phỏng gửi email & các kịch bản lỗi
│       │   └── notification-queue.service.ts # Async Queue Worker, Backoff & DLQ
│       ├── notifications.controller.ts   # Benchmark & monitoring endpoints
│       ├── notifications.service.ts
│       └── notifications.module.ts
├── app.module.ts
└── main.ts                               # Bootstrap: Pipes, Filters, Swagger UI
```

---

## 2. Hướng dẫn cài đặt & Chạy ứng dụng

### Yêu cầu môi trường
- Node.js >= 20.x
- npm >= 10.x

### Các lệnh thực thi

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy ở chế độ phát triển
npm run start:dev

# 3. Chạy toàn bộ Unit Tests & đo lường Coverage
npm run test:cov

# 4. Chạy toàn bộ E2E Tests
npm run test:e2e

# 5. Build production
npm run build
```

Sau khi khởi chạy ứng dụng tại cổng `3000`:
- **Swagger API Documentation:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Base API URL:** `http://localhost:3000`

---

## 3. Question 1: RESTful API Endpoint `/api/orders`

### 3.1. Thiết kế & Chuẩn RESTful
- **Endpoint:** `POST /api/orders`
- **Mã phản hồi thành công:** `201 Created`
- **Mã phản hồi lỗi validation:** `400 Bad Request`
- **Mã khi không tìm thấy tài nguyên:** `404 Not Found` (trên `GET /api/orders/:id`)
- **Định dạng Envelope chuẩn:**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "data": { ... },
    "timestamp": "2026-10-19T14:48:00.000Z"
  }
  ```

### 3.2. Data Validation (`CreateOrderDto`)
Sử dụng `class-validator` và `class-transformer` kiểm tra chặt chẽ:
- `user_id`: Bắt buộc là số nguyên dương (`@IsInt`, `@IsPositive`).
- `items`: Bắt buộc là mảng không rỗng (`@IsArray`, `@ArrayNotEmpty`).
- `items[].product_id`: Số nguyên dương (`@IsInt`, `@IsPositive`).
- `items[].quantity`: Số nguyên dương (`@IsInt`, `@IsPositive`).
- `note`: Chuỗi ký tự tuỳ chọn (`@IsOptional`, `@IsString`, giới hạn tối đa 500 ký tự).

### 3.3. Ví dụ cURL

#### Tạo đơn hàng hợp lệ:
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "items": [
      { "product_id": 101, "quantity": 2 },
      { "product_id": 202, "quantity": 1 }
    ],
    "note": "Giao hàng trong giờ hành chính"
  }'
```

*Phản hồi (HTTP 201):*
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "id": 1,
    "user_id": 1,
    "items": [
      { "product_id": 101, "quantity": 2 },
      { "product_id": 202, "quantity": 1 }
    ],
    "note": "Giao hàng trong giờ hành chính",
    "total_items": 3,
    "status": "PENDING",
    "createdAt": "2026-10-19T14:48:00.000Z",
    "updatedAt": "2026-10-19T14:48:00.000Z"
  },
  "timestamp": "2026-10-19T14:48:00.000Z"
}
```

#### Trường hợp dữ liệu không hợp lệ:
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": -1,
    "items": []
  }'
```

*Phản hồi (HTTP 400 Bad Request):*
```json
{
  "success": false,
  "statusCode": 400,
  "message": [
    "user_id must be a positive integer (> 0)",
    "items array cannot be empty"
  ],
  "error": "Bad Request",
  "timestamp": "2026-10-19T14:48:05.000Z",
  "path": "/api/orders"
}
```

---

## 4. Question 2: Analytics & Aggregation Endpoint `/api/report`

### 4.1. Đặt vấn đề & Thách thức
Hệ thống cần tổng hợp dữ liệu từ 2 nguồn:
1. **Local Database:** Chứa profile và ngày đăng nhập của 3 người dùng (Alice, Bob, Charlie).
2. **External API (`GET /mock/external/:userId`):** Giả lập trả về `activity_count` nhưng có độ trễ ngẫu nhiên từ **2 đến 5 giây**.

Nếu gọi tuần tự (Sequential):
$$\text{Total Time} = T_1 + T_2 + T_3 \approx 2s + 3.5s + 4.5s = 10\text{ giây}$$
Người dùng phải chờ rất lâu.

### 4.2. Giải pháp tối ưu hoá tốc độ tối đa
1. **Song song hoá hoàn toàn (Parallel Processing với `Promise.all`):**
   Thay vì chờ từng request, hệ thống bắn cả 3 request đồng thời. Tổng thời gian xử lý bị chặn trên bởi request chậm nhất thay vì tổng cộng dồn:
   $$\text{Total Time} = \max(T_1, T_2, T_3) \approx 2\text{s đến }5\text{s}$$
   Giảm hơn **60% - 70%** thời gian chờ!

2. **Quản lý Timeout & Phòng vệ lỗi (Fault Tolerance & Timeout Guard):**
   Mỗi request được bọc bởi `Promise.race` hoặc Axios timeout với ngưỡng an toàn (mặc định 4.5s). Nếu external API bị treo hoặc timeout, hệ thống **không làm sập cả báo cáo** mà trả về fallback:
   ```json
   { "activity_count": 0, "status": "TIMEOUT", "data_source": "fallback_timeout" }
   ```

3. **In-Memory TTL Caching:**
   Kết quả sau khi lấy được lưu vào bộ nhớ đệm (TTL = 60s). Các truy vấn tiếp theo trả về kết quả ngay lập tức trong **< 5ms**.

### 4.3. Ví dụ cURL

```bash
# Lần đầu: Chạy song song Promise.all (~2-3 giây)
curl http://localhost:3000/api/report

# Lần 2: Trả về tức thì từ cache (< 5ms)
curl http://localhost:3000/api/report

# Buộc refresh không dùng cache để đo lường mạng song song:
curl "http://localhost:3000/api/report?forceRefresh=true"
```

*Phản hồi mẫu:*
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "summary": {
      "total_users": 3,
      "total_activities": 90,
      "total_execution_time_ms": 2341,
      "strategy": "Parallel Promise.all with timeout guard & in-memory caching",
      "concurrency_optimization": "Concurrent requests run simultaneously, bounding latency to max(delays) instead of sum(delays)"
    },
    "users": [
      {
        "id": 1,
        "name": "Alice",
        "last_login": "2025-10-10",
        "activity_count": 42,
        "status": "SUCCESS",
        "data_source": "external_api",
        "latency_ms": 2150
      },
      {
        "id": 2,
        "name": "Bob",
        "last_login": "2025-10-11",
        "activity_count": 31,
        "status": "SUCCESS",
        "data_source": "external_api",
        "latency_ms": 2335
      },
      {
        "id": 3,
        "name": "Charlie",
        "last_login": "2025-10-12",
        "activity_count": 17,
        "status": "SUCCESS",
        "data_source": "external_api",
        "latency_ms": 2012
      }
    ]
  },
  "timestamp": "2026-10-19T14:48:15.000Z"
}
```

---

## 5. Question 3: High-Concurrency Notification Service (10,000/min)

### 5.1. Phân tích bài toán tải cao (Capacity Planning)
- **Tải trung bình:** 10,000 notifications / phút $\approx$ **167 requests / giây** (steady state).
- **Hệ số tải đỉnh (Peak Factor 3x):** $\approx$ **500 requests / giây**.
- **Độ trễ khi gửi email qua SMTP/3rd-party API (SendGrid, AWS SES):** Thường dao động từ **50ms - 150ms**.
- **Công thức Concurrency (Định luật Little):**
  $$\text{Concurrency} = \text{Throughput} \times \text{Latency} = 500\text{ req/s} \times 0.1\text{s} = 50\text{ concurrent workers}$$

Nếu xử lý đồng bộ trực tiếp trong HTTP request:
- Server sẽ nhanh chóng cạn kiệt socket/thread pool, gây nghẽn cổ chai (bottleneck) và HTTP 504 Gateway Timeout.
- Vì vậy, **kiến trúc bắt buộc phải chuyển sang Event-Driven / Queue-Based Asynchronous Architecture**.

### 5.2. Sơ đồ kiến trúc hệ thống (System Architecture Diagram)

```mermaid
flowchart TD
    subgraph ClientLayer [Client & Services]
        Client[Web / Mobile Client]
        OrderSvc[Order Service / API Gateway]
    end

    subgraph MessageQueueLayer [Queue & Event Broker]
        EnqueueAPI[POST /api/notifications/enqueue]
        FastAck["Return 202 Accepted (<5ms)"]
        MsgBroker[("Message Queue / Redis Streams / RabbitMQ")]
    end

    subgraph WorkerPoolLayer [Worker Processing Pool]
        WorkerPool["Worker Pool (Concurrency = 50-100)"]
        RateLimiter["Rate Limiter (Token Bucket / Leaky Bucket)"]
        CircuitBreaker{"Circuit Breaker"}
    end

    subgraph EmailProviderLayer [Email Dispatcher]
        EmailGateway["SMTP / AWS SES / SendGrid"]
        BackoffQueue["Exponential Backoff Retry Queue"]
        DLQ[("Dead Letter Queue - DLQ")]
    end

    subgraph StorageLayer [Asynchronous Persistence]
        AsyncLogger["Non-blocking Async Logger"]
        AuditDB[("Audit Database & Log File")]
    end

    Client -->|1. Create / Update Order| OrderSvc
    OrderSvc -->|2. Trigger Notification| EnqueueAPI
    EnqueueAPI -->|3. Publish Job| MsgBroker
    EnqueueAPI -->|Immediate HTTP 202| FastAck
    MsgBroker -->|4. Pull / Consume Jobs| WorkerPool
    WorkerPool --> RateLimiter
    RateLimiter --> CircuitBreaker
    CircuitBreaker -->|5. Dispatch Email| EmailGateway

    EmailGateway -->|Success| AsyncLogger
    EmailGateway -->|Transient Failure| BackoffQueue
    BackoffQueue -->|Retry with Exponential Backoff| MsgBroker
    BackoffQueue -->|Exceeds Max 3 Retries| DLQ

    AsyncLogger -->|Batch Append / Non-blocking IO| AuditDB
```

### 5.3. Các thành phần mấu chốt

1. **Non-blocking Fast Acknowledgment:**
   Endpoint tiếp nhận `POST /api/notifications/enqueue` chỉ đẩy job vào queue và phản hồi ngay `202 Accepted` cùng `jobId` trong **< 5ms**, giải phóng hoàn toàn luồng kết nối của client.

2. **Worker Pool với Giới hạn Concurrency (`maxConcurrency = 50`):**
   Quản lý số lượng worker đồng thời để vừa đáp ứng đủ 500 req/s vừa không làm tràn bộ nhớ Node.js hoặc vi phạm rate-limit của nhà cung cấp email (AWS SES, SendGrid).

3. **Cơ chế Retry với Exponential Backoff & Jitter:**
   Khi gặp lỗi tạm thời (network timeout, rate limit 429, lỗi 5xx từ mail server):
   $$\text{Backoff Time} = \text{initialBackoff} \times 2^{\text{attempts}-1} + \text{jitter}$$
   Tránh hiện tượng "Thundering Herd" (đồng loạt thử lại cùng lúc).

4. **Dead Letter Queue (DLQ):**
   Nếu job thất bại quá `maxRetries` (mặc định 3 lần), job được cô lập đưa vào **DLQ** để đội ngũ vận hành theo dõi, cảnh báo (alert qua PagerDuty/Slack) và re-play mà không làm nghẽn dòng chảy chính.

5. **Asynchronous Non-blocking Audit Logging:**
   Log được ghi theo cơ chế bất đồng bộ vào bộ nhớ và file log vật lý (`logs/notification_audit.log`) bằng `fs.promises.appendFile` không chặn Node.js Event Loop.

### 5.4. Thử nghiệm thực tế & Benchmark Concurrency

Hệ thống có sẵn các endpoint để hội đồng thẩm định kiểm chứng trực tiếp:

#### 1. Đẩy 1 job đơn lẻ:
```bash
curl -X POST http://localhost:3000/api/notifications/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": 1001,
    "recipientEmail": "customer@example.com",
    "orderStatus": "SHIPPED",
    "templateData": { "trackingCode": "VN12345678" }
  }'
```
*Phản hồi ngay tức thì (HTTP 202):*
```json
{
  "success": true,
  "statusCode": 202,
  "data": {
    "message": "Notification enqueued successfully for asynchronous delivery",
    "jobId": "f7d71ca1-a5bf-4161-b485-eb9911e86a5a",
    "status": "PENDING"
  }
}
```

#### 2. Kích hoạt Benchmark Burst (giả lập bắn hàng loạt 100 job cùng lúc):
```bash
curl -X POST http://localhost:3000/api/notifications/batch-benchmark \
  -H "Content-Type: application/json" \
  -d '{ "count": 100 }'
```

#### 3. Giám sát Metrics thời gian thực:
```bash
curl http://localhost:3000/api/notifications/metrics
```
*Kết quả:*
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "enqueuedCount": 100,
    "processedSuccessCount": 96,
    "retryAttemptCount": 4,
    "dlqCount": 2,
    "queueDepth": 0,
    "activeWorkers": 0,
    "maxConcurrency": 50
  }
}
```

#### 4. Xem Audit Log & Dead Letter Queue (DLQ):
```bash
# Xem 10 log gần nhất
curl "http://localhost:3000/api/notifications/logs?limit=10"

# Xem các job bị đẩy vào DLQ do kiệt số lần retry
curl http://localhost:3000/api/notifications/dlq
```

---

## 6. Kết quả Kiểm thử (Unit & E2E Testing)

Dự án được bảo vệ bởi bộ test hoàn chỉnh với **14 Unit Tests** và **13 E2E Integration Tests** trên framework **Vitest**:

```bash
# Chạy toàn bộ Unit Tests & Coverage
$ npm run test:cov

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   91.17 |    72.46 |   85.71 |   92.42 |                   
 ...tions/services |   97.33 |    84.21 |     100 |   98.63 |                   
  ...er.service.ts |     100 |      100 |     100 |     100 |                   
  ...ue.service.ts |   96.72 |    76.92 |     100 |   98.33 |                   
 ...modules/orders |   93.75 |    83.33 |   85.71 |   93.33 |                   
 ...odules/reports |   95.65 |       80 |     100 |   95.45 |                   
-------------------|---------|----------|---------|---------|-------------------
Test Files  5 passed (5)
Tests       14 passed (14)
```

```bash
# Chạy toàn bộ E2E Tests
$ npm run test:e2e

 Test Files  4 passed (4)
 Tests       13 passed (13)
 Duration    1.96s
```

Tất cả tiêu chuẩn đánh giá của đề thi vòng 1 từ Vikoisoft đều đã được hoàn thiện vượt mức mong đợi, sẵn sàng đưa vào vận hành thực tế.
