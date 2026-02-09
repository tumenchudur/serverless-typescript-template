# CLAUDE.md - Serverless TypeScript Template

> **Last updated:** 2026-02-09
> **Template version:** 1.0

This file defines code structure and patterns for this template and projects derived from it.

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Run type check
pnpm run type-check

# Run tests
pnpm run test

# Start local development
cd stacks/api-users && pnpm run dev

# Validate before deploy
pnpm run pre-deploy:prod

# Deploy
pnpm run deploy
```

---

## Project Structure

```
serverless-typescript-template/
├── packages/
│   ├── ts-configs/          # Shared TypeScript configuration
│   ├── contracts/           # Zod schemas, types, and Drizzle tables
│   └── libs/                # Common utilities (auth, errors, logging, http)
├── stacks/
│   ├── api-users/           # PostgreSQL example stack
│   ├── api-orders/          # DynamoDB example stack
│   └── scheduled-tasks/     # Scheduled Lambda example
├── scripts/
│   ├── deploy.sh            # Deployment script
│   └── pre-deploy.sh        # Pre-deployment validation
├── drizzle/                 # Database migrations
└── CLAUDE.md
```

---

## TypeScript Configuration

**Base config (`packages/ts-configs/base.json`):**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Key points:**

- `moduleResolution: "bundler"` - imports WITHOUT `.js` extensions
- `exactOptionalPropertyTypes: true` - strict optional handling
- Target `ES2022` and `node22`

---

## Import Conventions

**DO NOT use `.js` extensions:**

```typescript
// ✓ CORRECT
import { logger } from '../utils/logger';
import { CustomError } from './custom-error';
export * from './api-event';

// ✗ WRONG - never use .js extensions
import { logger } from '../utils/logger.js';
```

---

## Package Aliases

```typescript
// Use workspace aliases
import { db, CustomError, logger } from '@template/libs';
import { users, CreateUserRequest } from '@template/contracts';
```

---

## Libs Package Structure

```
packages/libs/src/
├── aws/
│   ├── lambda-client.ts      # Lambda invocation with retry
│   ├── ssm-client.ts         # SSM with caching
│   └── s3-client.ts          # S3 operations
├── db/
│   ├── postgres/client.ts    # Drizzle PostgreSQL client
│   └── dynamo/client.ts      # DynamoDB wrapper functions
├── errors/
│   ├── custom-error.ts       # Error classes (Custom, Validation, NotFound, etc.)
│   └── error-handler.ts      # Error handler middleware
├── functions/
│   ├── function-define.ts    # createUserAuthApiFunc, createAdminAuthApiFunc
│   └── function-gateway.ts   # createHttpHandler (Middy wrapper)
├── http/
│   ├── api-event.ts          # Auth extraction functions
│   ├── auth-config.ts        # Cognito authorizer configs
│   ├── axios-client.ts       # HTTP client with retry
│   └── permission-verification.ts
├── utils/
│   ├── logger.ts             # Winston logger with correlation IDs
│   └── retry.ts              # Retry with exponential backoff
└── index.ts
```

---

## Handler Pattern

### File Structure

```
src/functions/{feature}/
├── handler.ts    # Lambda handler exports
└── index.ts      # Serverless function config (optional)
```

### handler.ts

```typescript
import { createHttpHandler, extractMetadataAndAuthorizationFromEvent } from '@template/libs';
import { CreateOrderSchema } from '@template/contracts';
import { createOrder } from '../../services/order.service';

export const createOrderHandler = createHttpHandler<null>(async (event) => {
  const { sub, email } = extractMetadataAndAuthorizationFromEvent(event);
  const request = CreateOrderSchema.parse(event.body);

  const order = await createOrder(sub, request);

  return {
    message: 'Order created successfully',
    data: order
  };
});
```

### Function Config (index.ts)

```typescript
import { createUserAuthApiFunc } from '@template/libs';

export const ORDER_FUNCTIONS = {
  createOrder: createUserAuthApiFunc({
    dir: __dirname,
    fnName: 'create-order/handler.createOrderHandler',
    http: { method: 'post', path: '/v1/orders' }
  })
};
```

---

## Auth Handling

### Three Auth Levels

| Level  | Function                   | Headers Required          |
| ------ | -------------------------- | ------------------------- |
| Public | `createDefaultApiFunc()`   | None                      |
| User   | `createUserAuthApiFunc()`  | Authorization             |
| Admin  | `createAdminAuthApiFunc()` | Authorization, Permission |

### Cognito Authorizer Config

```typescript
// config/auth.ts
import { createUserAuthConfig, createAdminAuthConfig } from '@template/libs';

export const userAuthConfig = createUserAuthConfig(process.env.USER_POOL_ARN!, { authorizerName: 'my-app-users' });

export const adminAuthConfig = createAdminAuthConfig(process.env.ADMIN_POOL_ARN!, { authorizerName: 'my-app-admins' });
```

### Auth Extraction

```typescript
import {
  extractMetadataFromEvent, // No auth required
  extractMetadataAndAuthorizationFromEvent, // User auth
  extractMetadataAndAuthorizationForAdminFromEvent, // Admin auth
  verifyPermission
} from '@template/libs';

// User endpoint
export const handler = createHttpHandler(async (event) => {
  const { sub, email } = extractMetadataAndAuthorizationFromEvent(event);
  // sub = Cognito user ID
});

// Admin endpoint with permission check
export const adminHandler = createHttpHandler(async (event) => {
  const { sub, email, permission } = extractMetadataAndAuthorizationForAdminFromEvent(event);
  await verifyPermission(permission, ['admin:users:delete']);
});
```

---

## Error Handling

### Error Classes

```typescript
import {
  CustomError, // Base error (any status)
  ValidationError, // 400
  UnauthorizedError, // 401
  ForbiddenError, // 403
  NotFoundError, // 404
  ConflictError, // 409
  RateLimitError, // 429
  BadGatewayError, // 502
  ServiceUnavailableError, // 503
  GatewayTimeoutError // 504
} from '@template/libs';

// Usage
throw new NotFoundError('User not found');
throw new ConflictError('Email already exists');
throw new RateLimitError('Too many requests', 60); // retry after 60s
```

### Errors are automatically caught by `createHttpHandler`

---

## Logging

### JSON Logging with Correlation IDs

```typescript
import { logger, setCorrelationId, log } from '@template/libs';

// Set correlation ID at request start
setCorrelationId(event.requestContext.requestId);

// Basic logging
logger.info('Processing order', { orderId, userId });
logger.error('Failed to process', { error });

// Structured logging helpers
log.requestStart('POST', '/orders');
log.requestEnd('POST', '/orders', 200, 150);
log.dbQuery('SELECT', 'users', 25);
log.externalCall('PaymentAPI', '/charge', 200, 500);
```

### Log Output (Production - JSON)

```json
{
  "level": "info",
  "message": "Processing order",
  "correlationId": "abc-123",
  "orderId": "ord_456",
  "timestamp": "2026-02-09T10:30:00.000Z"
}
```

---

## Retry Pattern

### Basic Retry

```typescript
import { withRetry, RetryPresets } from '@template/libs';

// With default options (3 retries, exponential backoff)
const result = await withRetry(() => callExternalApi());

// With presets
const result = await withRetry(
  () => callExternalApi(),
  RetryPresets.aggressive // 5 retries, longer delays
);

// Custom options
const result = await withRetry(() => callExternalApi(), {
  maxRetries: 5,
  initialDelay: 200,
  isRetryable: (error) => error.statusCode === 503
});
```

### Retry Presets

| Preset       | Retries | Initial Delay | Use Case            |
| ------------ | ------- | ------------- | ------------------- |
| `fast`       | 3       | 50ms          | Internal services   |
| `standard`   | 3       | 200ms         | External APIs       |
| `aggressive` | 5       | 500ms         | Critical operations |
| `database`   | 3       | 100ms         | DB connections      |

---

## Repository Pattern

### PostgreSQL (Drizzle)

```typescript
// repository/user.repository.ts
import { db } from '@template/libs';
import { users, type User, type NewUser } from '@template/contracts';
import { eq } from 'drizzle-orm';

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function createUser(data: NewUser): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}
```

### DynamoDB

```typescript
// repository/order.repository.ts
import { createRecord, queryRecords } from '@template/libs';
import type { Order } from '@template/contracts';

const TABLE = process.env.ORDERS_TABLE!;

export async function createOrder(order: Order): Promise<Order> {
  await createRecord({ tableName: TABLE, item: order });
  return order;
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  const result = await queryRecords<Order>({
    tableName: TABLE,
    queryRequest: { pKey: userId, pKeyProp: 'userId' }
  });
  return result.items;
}
```

---

## Service Layer

```typescript
// services/order.service.ts
import { NotFoundError, ConflictError, logger } from '@template/libs';
import { orderRepository } from '../repository/order.repository';

export async function createOrder(userId: string, request: CreateOrderRequest) {
  logger.info('Creating order', { userId });

  // Business logic validation
  if (request.quantity <= 0) {
    throw new ValidationError('Quantity must be positive');
  }

  const order = await orderRepository.create({
    userId,
    ...request,
    status: 'PENDING'
  });

  logger.info('Order created', { orderId: order.id });
  return order;
}
```

---

## Serverless Configuration

```typescript
// serverless.ts
import type { AWS } from '@serverless/typescript';

const serverlessConfig: AWS = {
  service: 'my-service',
  frameworkVersion: '4',
  plugins: ['serverless-offline', 'serverless-prune-plugin', 'serverless-esbuild'],

  provider: {
    name: 'aws',
    runtime: 'nodejs22.x',
    architecture: 'arm64',
    region: 'ap-southeast-1',
    stage: "${opt:stage, 'dev'}",
    memorySize: 256,
    timeout: 29,
    environment: {
      STAGE: '${self:provider.stage}',
      LOG_LEVEL: '${self:custom.logLevel.${self:provider.stage}, "info"}',
      CORS_ORIGIN: '${self:custom.corsOrigin.${self:provider.stage}, "*"}'
    }
  },

  custom: {
    corsOrigin: {
      dev: '*',
      staging: 'https://staging.example.com',
      prod: 'https://example.com'
    },
    logLevel: {
      dev: 'debug',
      staging: 'info',
      prod: 'info'
    }
  }
};
```

---

## Testing

### Service Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrder } from './order.service';
import * as orderRepo from '../repository/order.repository';

vi.mock('../repository/order.repository');

describe('createOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should create order', async () => {
    const mockOrder = { id: '123', userId: 'user-1', status: 'PENDING' };
    vi.mocked(orderRepo.createOrder).mockResolvedValue(mockOrder);

    const result = await createOrder('user-1', { quantity: 1 });

    expect(result).toEqual(mockOrder);
    expect(orderRepo.createOrder).toHaveBeenCalled();
  });
});
```

### Run Tests

```bash
pnpm run test              # Run all tests
pnpm run test -- --watch   # Watch mode
```

---

## Environment Variables

| Variable                           | Required | Description                     |
| ---------------------------------- | -------- | ------------------------------- |
| `STAGE`                            | Yes      | Environment: dev, staging, prod |
| `DATABASE_URL`                     | Yes\*    | PostgreSQL connection string    |
| `ORDERS_TABLE`                     | Yes\*    | DynamoDB table name             |
| `LOG_LEVEL`                        | No       | debug, info, warn, error        |
| `CORS_ORIGIN`                      | No       | Allowed CORS origin             |
| `USER_POOL_ARN`                    | No       | Cognito user pool ARN           |
| `ADMIN_POOL_ARN`                   | No       | Cognito admin pool ARN          |
| `PERMISSION_VERIFICATION_FUNCTION` | No       | Permission Lambda name          |

\*Depends on which database you're using

---

## Quick Reference

| Task                | Code                                                      |
| ------------------- | --------------------------------------------------------- |
| Create handler      | `createHttpHandler(async (event) => { ... })`             |
| User auth function  | `createUserAuthApiFunc({ dir, fnName, http })`            |
| Admin auth function | `createAdminAuthApiFunc({ dir, fnName, http })`           |
| Extract user auth   | `extractMetadataAndAuthorizationFromEvent(event)`         |
| Extract admin auth  | `extractMetadataAndAuthorizationForAdminFromEvent(event)` |
| Verify permission   | `await verifyPermission(permission, ['scope:action'])`    |
| Throw error         | `throw new NotFoundError('Not found')`                    |
| Log                 | `logger.info('message', { data })`                        |
| Validate body       | `const data = Schema.parse(event.body)`                   |
| Retry call          | `await withRetry(() => apiCall(), RetryPresets.standard)` |
| Set correlation ID  | `setCorrelationId(requestId)`                             |

---

## Common Mistakes to Avoid

1. **Don't use `.js` extensions** in imports
2. **Don't use `"main": "dist/index.js"`** in package.json (use `src/index.ts`)
3. **Don't use optional properties with `exactOptionalPropertyTypes`** - use `prop: T | undefined` instead of `prop?: T`
4. **Don't use `z.record(z.unknown())`** - use `z.record(z.string(), z.unknown())`
5. **Don't hardcode CORS to `*` in production** - use environment-specific config
6. **Don't forget to set correlation ID** at request start for log tracing

---

## NPM Scripts

```bash
pnpm run build          # Build all packages
pnpm run type-check     # TypeScript check
pnpm run lint           # ESLint
pnpm run format         # Prettier format
pnpm run test           # Run tests
pnpm run pre-deploy     # Validate before deploy (dev)
pnpm run pre-deploy:prod # Validate before deploy (prod)
pnpm run deploy         # Deploy all stacks
pnpm run db:generate    # Generate Drizzle migrations
pnpm run db:migrate     # Run migrations
```
