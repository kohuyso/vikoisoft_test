# 🚀 HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY DỰ ÁN

> **Bài test tuyển dụng:** Vị trí Lập trình viên Phần mềm Web - Vikoisoft  
> **Ứng viên:** Lê Anh Huy  
> **Công nghệ:** Node.js (NestJS 12), TypeScript, Vitest, Redis (Graceful In-Memory Fallback), Swagger/OpenAPI

---

## 📌 1. Yêu Cầu Môi Trường
- **Node.js**: Phiên bản `>= 20.x` (khuyến nghị 20.x hoặc 22.x LTS)
- **npm**: Phiên bản `>= 10.x` (đi kèm sẵn với Node.js)
- **Hệ điều hành**: Windows / macOS / Linux

---

## 📦 2. Cài Đặt Dependencies (Cực Kỳ Đơn Giản)

Sau khi giải nén mã nguồn dự án:

1. Mở Terminal / PowerShell / Command Prompt tại thư mục dự án.
2. File cấu hình `.env` đã được thiết lập sẵn trong mã nguồn. Nếu cần cấu hình lại, có thể sao chép từ `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Chạy lệnh cài đặt toàn bộ thư viện:
   ```bash
   npm install
   ```

*(Nhờ có tệp `package-lock.json`, toàn bộ dependencies sẽ được cài đặt chính xác 100% phiên bản ổn định nhất).*

---

## ▶️ 3. Khởi Chạy Ứng Dụng

### Cách 1: Chế độ Phát triển (Development - Hot Reload)
```bash
npm run start:dev
```

### Cách 2: Chế độ Production (Khuyến nghị để đánh giá hiệu năng)
```bash
npm run build
npm run start:prod
```

Khi server khởi động thành công, màn hình sẽ hiển thị:
```text
[NestApplication] Nest application successfully started
[Bootstrap] Application is running on: http://localhost:3000
[Bootstrap] Swagger documentation available at: http://localhost:3000/api/docs
```

---

## 🌐 4. Giao Diện Kiểm Thử Trực Quan (Swagger UI)

Mở trình duyệt web và truy cập vào đường dẫn:
👉 **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

Tại đây, bạn có thể thực hiện kiểm thử trực tiếp (`Try it out`) toàn bộ các API tương ứng với 3 câu hỏi:
- **Question 1 (Orders):** `POST /api/orders` (Tạo đơn hàng với DTO Validation), `GET /api/orders`, `GET /api/orders/:id`
- **Question 2 (Reports):** `GET /api/report` (Tổng hợp dữ liệu song song đa nguồn + Cache)
- **Question 3 (Notifications):** `POST /api/notifications/enqueue`, `POST /api/notifications/batch-benchmark`, `GET /api/notifications/metrics`, `GET /api/notifications/logs`, `GET /api/notifications/dlq`
- **Redis Health & Mode:** `GET /api/redis/status` (Xem trạng thái kết nối Redis / Fallback In-memory)

---

## 🧪 5. Chạy Kiểm Thử Tự Động (Unit & E2E Testing)

Dự án được bao phủ bài bản bằng bộ kiểm thử với **Vitest**:

### 5.1. Chạy Unit Tests
```bash
npm run test
```
*(Kết quả: 19/19 unit tests passed)*

### 5.2. Chạy E2E Tests (End-to-End API Integration)
```bash
npm run test:e2e
```
*(Kết quả: 25/25 e2e integration tests passed)*

### 5.3. Xem Báo Cáo Coverage
```bash
npm run test:cov
```

### 5.4. Kiểm Tra Chuẩn Code (Linter)
```bash
npm run lint
```
*(0 lỗi, 0 cảnh báo trên toàn bộ 45 tệp nguồn).*

---

## 💡 6. Lưu Ý Về Cơ Sở Dữ Liệu & Redis

- **Cơ chế Graceful In-Memory Fallback:** Dự án được thiết kế cao cấp với cơ chế tự phát hiện Redis. Nếu máy bạn **không cài Redis hoặc chưa bật Docker**, dự án **vẫn chạy hoàn toàn mượt mà 100%** nhờ hệ thống bộ nhớ trong mô phỏng (hỗ trợ đầy đủ TTL Cache, Queue FIFO, Atomic Counters, Dead Letter Queue).
- **Nếu muốn chạy Redis thật qua Docker:**
  ```bash
  docker compose up -d
  ```
  *(Redis sẽ chạy tại port 6379, giao diện Redis Commander tại `http://localhost:8081`).*

---
*Cảm ơn Quý Công ty Vikoisoft đã xem xét bài làm!*
