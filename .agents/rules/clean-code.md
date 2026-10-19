# NestJS & TypeScript Clean Code Guidelines

## 1. Core Principles
- **Separation of Concerns (SoC)**:
  - **Controllers**: Thin layer responsible only for HTTP mapping, route definitions, applying DTO validation, and returning responses. Never include business calculations or data mutation directly in controllers.
  - **Services**: Contain pure business logic, orchestration, validation of business rules, and error throwing.
  - **Repositories / In-Memory Stores**: Responsible solely for data access, CRUD operations, and atomic state updates.
- **Single Responsibility Principle (SRP)**: Each class, method, and function should have one reason to change.
- **Fail Fast & Explicit Errors**: Throw specific NestJS HTTP exceptions (`BadRequestException`, `NotFoundException`, `ConflictException`, `GatewayTimeoutException`) rather than generic `Error`.

## 2. TypeScript & Code Standards
- **Strict Typing**:
  - Never use `any`. Use `unknown`, generic types, or specific interfaces/types.
  - Explicitly declare method return types on all controller handlers, service methods, and helper functions.
  - Avoid type assertions (`as Type`) unless interfacing with untyped third-party libraries.
- **Clean Syntax & Immutability**:
  - Prefer `const` over `let`. Never use `var`.
  - Use early returns to reduce nesting and cognitive load.
  - Use optional chaining (`?.`) and nullish coalescing (`??`).

## 3. DTOs & Validation
- **DTO Definitions**:
  - Use separate DTO classes for Request inputs (e.g. `CreateOrderDto`, `QueryReportDto`) and Response outputs.
  - Decorate every input property with appropriate `class-validator` rules (`@IsNotEmpty`, `@IsInt`, `@IsArray`, `@ValidateNested`, `@IsOptional`).
  - Use `@Type(() => SubClass)` from `class-transformer` for nested objects or arrays of objects.
  - Decorate all DTO fields with `@ApiProperty()` or `@ApiPropertyOptional()` to provide clean, self-documenting Swagger OpenAPI specs.

## 4. API Response & Error Standards
- **Consistent Response Envelope**:
  - Success responses must adhere to a standardized envelope:
    ```typescript
    {
      "success": true,
      "statusCode": 200,
      "data": T,
      "timestamp": "2026-10-19T21:40:00.000Z"
    }
    ```
  - Error responses must follow:
    ```typescript
    {
      "success": false,
      "statusCode": 400,
      "message": "Validation failed: items must contain at least 1 item",
      "error": "Bad Request",
      "timestamp": "2026-10-19T21:40:00.000Z",
      "path": "/api/orders"
    }
    ```
- Use global `TransformInterceptor` and `HttpExceptionFilter` instead of manually formatting responses in controllers.

## 5. Concurrency, Queues & Resilience
- **External Calls & Aggregations**:
  - Always enforce explicit timeouts (e.g., using `AbortSignal.timeout(ms)` or Axios `timeout`).
  - Use `Promise.allSettled` when aggregating multiple external sources to prevent one failure from dropping the entire report, unless all are strictly required.
  - Implement fallback defaults or partial degradation where appropriate.
- **Queues & Asynchronous Processing**:
  - Ensure thread-safe or atomic queue processing.
  - Implement retry mechanisms with exponential backoff and jitter.
  - Log asynchronously to avoid blocking the Node.js event loop.

## 6. Testing Conventions
- Use **Vitest** for both Unit and E2E tests:
  - Unit tests: Mock dependencies using Vitest mocks (`vi.fn()`, `vi.spyOn()`) with `@nestjs/testing`.
  - E2E tests: Use `supertest` with NestJS testing module to test full HTTP request-response cycles.
  - Ensure tests are deterministic, isolated, and leave no residual state in memory.
