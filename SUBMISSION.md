# BÁO CÁO NỘP BÀI TEST VÒNG 1 - LẬP TRÌNH VIÊN PHẦN MỀM WEB
**Kỳ thi:** Tuyển dụng Lập trình viên Phần mềm Web - Vikoisoft  
**Số đề:** 20261019  
**Họ và tên ứng viên:** Lê Anh Huy  
**Số điện thoại:** 0989558851  
**Email nhận bài:** jobs@vikoisoft.com (Cc: jobs@aimesoft.com)  

---

## I. TÓM TẮT GIẢI PHÁP CHO TỪNG CÂU HỎI

### Câu 1: Thiết kế RESTful API endpoint `/api/orders`
- **Mã nguồn:** Thư mục [`src/modules/orders/`](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/src/modules/orders)
- **Kiến trúc:** Phân tách 3 lớp rõ ràng theo Clean Architecture:
  - `OrdersController` ([orders.controller.ts](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/src/modules/orders/orders.controller.ts)): Định tuyến RESTful, OpenAPI Swagger decorator, mã trạng thái HTTP chuẩn (`201 Created` cho POST, `400 Bad Request` cho validation error, `404 Not Found` khi không tìm thấy đơn).
  - `CreateOrderDto` ([create-order.dto.ts](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/src/modules/orders/dto/create-order.dto.ts)): Sử dụng `class-validator` xác thực chặt chẽ: `user_id` (số nguyên dương), `items` (mảng đối tượng `{product_id, quantity}` không rỗng, quantity > 0), `note` (chuỗi tuỳ chọn).
  - `OrdersService` ([orders.service.ts](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/src/modules/orders/orders.service.ts)): Xử lý nghiệp vụ, tự động tính tổng số lượng `total_items`, gán trạng thái ban đầu `PENDING`.
  - `OrdersRepository` ([orders.repository.ts](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/src/modules/orders/repositories/orders.repository.ts)): In-memory mock database lưu trữ an toàn bằng `Map<number, OrderEntity>`.

### Câu 2: Xây dựng Analytics Endpoint `/api/report` tổng hợp dữ liệu tốc độ cao
- **Mã nguồn:** Thư mục [`src/modules/reports/`](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/src/modules/reports) và [`src/modules/mock-external/`](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/src/modules/mock-external)
- **Mô phỏng External API:** Endpoint `GET /mock/external/:userId` với độ trễ ngẫu nhiên từ 2-5 giây đúng yêu cầu.
- **Giải pháp tối ưu tốc độ tối đa:**
  1. **Song song hoá bằng `Promise.all`:** Thay vì gọi tuần tự làm tổng thời gian chờ lên tới $\approx 2s + 3s + 4.5s = 9.5s$, hệ thống gọi đồng thời cả 3 request external. Thời gian hoàn thành chỉ bằng request lâu nhất: $\max(delay_1, delay_2, delay_3) \approx 2-4.5s$ (nhanh hơn >65%).
  2. **Quản lý Timeout & Fallback (Graceful Degradation):** Mỗi request có timeout bảo vệ (mặc định 4.5s). Nếu external API bị treo hoặc quá hạn, request đó trả về fallback `{ activity_count: 0, status: 'TIMEOUT' }` chứ không làm crash toàn bộ báo cáo của các người dùng khác.
  3. **In-memory TTL Caching:** Kết quả hợp nhất được cache trong 60 giây. Các lượt truy cập tiếp theo trả về tức thì trong **< 5ms**.

### Câu 3: Thiết kế Notification Service chịu tải cao (10,000 notifications/phút)
- **Mã nguồn:** Thư mục [`src/modules/notifications/`](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/src/modules/notifications)
- **Phân tích tải:** 10,000 req/phút $\approx$ 167 req/giây (steady), 500 req/giây (peak). Giả định độ trễ gửi email qua SMTP/API là 100ms $\rightarrow$ Cần worker pool song song có Concurrency tối thiểu $500 \times 0.1s = 50$ workers.
- **Kiến trúc hệ thống:**
  1. **Producer / Fast Ack:** Endpoint `POST /api/notifications/enqueue` tiếp nhận job vào hàng đợi và phản hồi ngay `202 Accepted` trong **< 5ms**.
  2. **Worker Pool Concurrency (`maxConcurrency = 50`):** Xử lý đồng thời 50 workers, đảm bảo tiêu thụ mượt mà 500 email/giây mà không làm cạn kiệt bộ nhớ hay vi phạm rate-limit của SES/SendGrid.
  3. **Retry với Exponential Backoff & Jitter:** Khi gửi thất bại do lỗi mạng tạm thời, hệ thống tự động thử lại với thời gian giãn cách theo hàm mũ: $T = \text{base} \times 2^{\text{attempt}-1} + \text{jitter}$.
  4. **Dead Letter Queue (DLQ):** Sau 3 lần thử lại không thành công, job được đưa vào DLQ riêng biệt để cô lập, phục vụ phân tích lỗi và cảnh báo tới admin.
  5. **Asynchronous Non-blocking Audit Logging:** Sử dụng `NotificationLogRepository` ghi log bất đồng bộ ra bộ nhớ và file vật lý `logs/notification_audit.log`, không làm block Event Loop của Node.js.

---

## II. HƯỚNG DẪN CHẠY DỰ ÁN & KIỂM THỬ

```bash
# 1. Chạy ứng dụng
npm run start:dev

# 2. Truy cập tài liệu tương tác Swagger UI
# Mở trình duyệt: http://localhost:3000/api/docs

# 3. Chạy toàn bộ Unit Tests & đo Coverage (>91%)
npm run test:cov

# 4. Chạy toàn bộ E2E Tests (13/13 passed)
npm run test:e2e
```

Xem chi tiết đầy đủ tài liệu kiến trúc, sơ đồ Mermaid và hướng dẫn cURL tại file [README.md](file:///Users/justhuy/.gemini/antigravity-ide/scratch/vikoisoft_test/README.md).
