# Code Examples

This document provides practical examples for common use cases in the template.

## Table of Contents

1. [PostgreSQL Examples](#postgresql-examples)
2. [DynamoDB Examples](#dynamodb-examples)
3. [Error Handling](#error-handling)
4. [Authentication](#authentication)
5. [Middleware](#middleware)
6. [Testing](#testing)
7. [External API Integration with Axios](#external-api-integration-with-axios)
8. [Advanced SSM Parameter Management](#advanced-ssm-parameter-management)
9. [Advanced Lambda Invocations](#advanced-lambda-invocations)

## PostgreSQL Examples

### Basic CRUD Operations

```typescript
import { db } from '@template/libs';
import { users } from '@template/contracts';
import { eq, and, or, like, desc } from 'drizzle-orm';

// Create
const [newUser] = await db
  .insert(users)
  .values({
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe'
  })
  .returning();

// Read - Single record
const [user] = await db
  .select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

// Read - Multiple with conditions
const activeUsers = await db
  .select()
  .from(users)
  .where(
    and(
      eq(users.status, 'ACTIVE'),
      eq(users.emailVerified, true)
    )
  )
  .orderBy(desc(users.createdAt));

// Update
const [updatedUser] = await db
  .update(users)
  .set({
    firstName: 'Jane',
    updatedAt: new Date()
  })
  .where(eq(users.id, userId))
  .returning();

// Delete
await db.delete(users).where(eq(users.id, userId));

// Search with LIKE
const searchResults = await db
  .select()
  .from(users)
  .where(
    or(
      like(users.firstName, '%John%'),
      like(users.lastName, '%John%')
    )
  );
```

### Transactions

```typescript
import { db } from '@template/libs';
import { users, orders } from '@template/contracts';

const result = await db.transaction(async (tx) => {
  // Create user
  const [user] = await tx
    .insert(users)
    .values(userData)
    .returning();

  // Create order for user
  const [order] = await tx
    .insert(orders)
    .values({
      userId: user.id,
      productId: 'product-123',
      totalAmount: 99.99
    })
    .returning();

  return { user, order };
});

// If any operation fails, the entire transaction rolls back
```

### Joins

```typescript
import { db } from '@template/libs';
import { users, orders } from '@template/contracts';
import { eq } from 'drizzle-orm';

const usersWithOrders = await db
  .select({
    userId: users.id,
    userName: users.firstName,
    orderId: orders.id,
    orderTotal: orders.totalAmount
  })
  .from(users)
  .leftJoin(orders, eq(users.id, orders.userId));
```

### Pagination

```typescript
const PAGE_SIZE = 20;

async function getUsersPaginated(page: number = 0) {
  return await db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE)
    .offset(page * PAGE_SIZE);
}
```

## DynamoDB Examples

### Basic Operations

```typescript
import { createRecord, getRecordByKey, queryRecords, updateRecord } from '@template/libs';

// Create
const order = await createRecord({
  tableName: 'orders',
  item: {
    orderId: randomUUID(),
    userId: 'user-123',
    productId: 'product-456',
    totalAmount: 99.99,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  }
});

// Get by key
const order = await getRecordByKey({
  tableName: 'orders',
  key: { userId: 'user-123', orderId: 'order-456' }
});

// Query by partition key
const { items, lastEvaluatedKey } = await queryRecords({
  tableName: 'orders',
  queryRequest: {
    pKey: 'user-123',
    pKeyProp: 'userId'
  }
});

// Query with pagination
const { items, lastEvaluatedKey } = await queryRecords({
  tableName: 'orders',
  queryRequest: {
    pKey: 'user-123',
    pKeyProp: 'userId',
    limit: 20,
    lastEvaluatedKey: previousPageToken
  }
});

// Update
const updated = await updateRecord({
  tableName: 'orders',
  key: { userId: 'user-123', orderId: 'order-456' },
  item: { status: 'COMPLETED' }
});
```

### Query with Sort Key

```typescript
const recentOrders = await queryRecords({
  tableName: 'orders',
  queryRequest: {
    pKey: 'user-123',
    pKeyProp: 'userId',
    sKey: new Date('2026-01-01').toISOString(),
    sKeyProp: 'createdAt'
  },
  scanIdxForward: false // descending order
});
```

### Conditional Writes

```typescript
// Only create if doesn't exist
await createRecord({
  tableName: 'orders',
  item: orderData,
  conditionExpression: 'attribute_not_exists(orderId)',
  expressionAttributeNames: { '#orderId': 'orderId' }
});

// Update with condition
await updateRecord({
  tableName: 'orders',
  key: { orderId: 'order-123' },
  item: { status: 'COMPLETED' },
  conditionExpression: '#status = :pendingStatus',
  expressionAttributeNames: { '#status': 'status' },
  expressionAttributeValues: { ':pendingStatus': 'PENDING' }
});
```

## Error Handling

### Using Custom Errors

```typescript
import { CustomError, NotFoundError, ValidationError, UnauthorizedError } from '@template/libs';

// 404 Not Found
throw new NotFoundError('User not found');

// 400 Bad Request
throw new ValidationError('Invalid email format');

// 401 Unauthorized
throw new UnauthorizedError('Invalid token');

// 403 Forbidden
throw new ForbiddenError('Insufficient permissions');

// Custom status code
throw new CustomError('Rate limit exceeded', 429);
```

### Service Layer Error Handling

```typescript
export async function createUser(request: CreateUserRequest) {
  // Check if user exists
  const existing = await getUserByEmail(request.email);
  if (existing) {
    throw new ValidationError('User with this email already exists');
  }

  // Create user
  const user = await createUserInDb(request);
  if (!user) {
    throw new CustomError('Failed to create user', 500);
  }

  return user;
}
```

### Handler Error Handling

Errors are automatically handled by `createHttpHandler`:

```typescript
export const handler = createHttpHandler<RequestSchema>(async (event) => {
  // Any thrown error is caught and formatted automatically
  const data = await someOperation();
  return { data };
});
```

## Authentication

### JWT Verification Example

```typescript
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '@template/libs';

export function verifyToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, process.env['JWT_SECRET'] || '') as { userId: string };
    return decoded;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

// Use in handler
export const handler = createHttpHandler<null>(async (event) => {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!authHeader) {
    throw new UnauthorizedError('Missing authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const { userId } = verifyToken(token);

  // Use userId for authorization
  const user = await getUser(userId);
  return { data: user };
});
```

## Middleware

### Custom Middy Middleware

```typescript
import middy from '@middy/core';
import { createHttpHandler } from '@template/libs';

// Custom middleware example
const customMiddleware = () => ({
  before: async (request) => {
    // Runs before handler
    console.log('Before handler');
  },
  after: async (request) => {
    // Runs after handler
    console.log('After handler');
  },
  onError: async (request) => {
    // Runs on error
    console.error('Error occurred');
  }
});

export const handler = createHttpHandler<null>(async (event) => {
  return { data: 'success' };
}).use(customMiddleware());
```

## Testing

### Service Layer Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser } from './user.service';
import * as userRepository from '../repository/user.repository';

vi.mock('../repository/user.repository');

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a user', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    vi.mocked(userRepository.createUserInDb).mockResolvedValue(mockUser);

    const result = await createUser({ email: 'test@example.com', firstName: 'John', lastName: 'Doe' });

    expect(result).toEqual(mockUser);
  });
});
```

### Handler Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createUserHandler } from './handler';
import * as userService from '../../services/user.service';

vi.mock('../../services/user.service');

describe('createUserHandler', () => {
  it('should return 200 with user data', async () => {
    const mockUser = { id: '123', email: 'test@example.com' };
    vi.mocked(userService.createUser).mockResolvedValue(mockUser);

    const event = {
      body: { email: 'test@example.com', firstName: 'John', lastName: 'Doe' }
    };

    const result = await createUserHandler(event as any);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body || '')).toHaveProperty('data');
  });
});
```

### Repository Tests (Integration)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@template/libs';
import { createUserInDb, getUserById } from './user.repository';

describe('User Repository', () => {
  beforeAll(async () => {
    // Setup test database
  });

  afterAll(async () => {
    // Cleanup test data
  });

  it('should create and retrieve a user', async () => {
    const user = await createUserInDb({
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    });

    expect(user.id).toBeDefined();

    const retrieved = await getUserById(user.id);
    expect(retrieved?.email).toBe('test@example.com');
  });
});
```

## External API Integration with Axios

The template includes a production-ready Axios HTTP client with retry logic, logging, and error handling.

### Basic Usage

```typescript
import { get, post, put, patch, del } from '@template/libs';

// Simple GET request
const user = await get<User>('https://api.example.com/users/123');

// POST request with data
const newUser = await post<User>('https://api.example.com/users', {
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe'
});

// PUT request
const updated = await put<User>('https://api.example.com/users/123', {
  firstName: 'Jane'
});

// PATCH request
const patched = await patch<User>('https://api.example.com/users/123', {
  email: 'jane@example.com'
});

// DELETE request
await del('https://api.example.com/users/123');
```

### Creating a Custom Client

```typescript
import { createAxiosClient } from '@template/libs';

// Create a client with custom configuration
const apiClient = createAxiosClient({
  baseURL: 'https://api.stripe.com/v1',
  timeout: 10000,
  headers: {
    'X-Custom-Header': 'value'
  },
  authToken: 'Bearer sk_test_...',
  enableLogging: true,
  retryConfig: {
    retries: 5,
    retryDelay: 2000,
    retryableStatuses: [429, 503, 504],
    exponentialBackoff: true
  }
});

// Use the custom client
const charge = await apiClient.post('/charges', {
  amount: 2000,
  currency: 'usd',
  source: 'tok_visa'
});
```

### With Authentication from SSM

```typescript
import { createAxiosClient, getSSMParameter } from '@template/libs';

// Retrieve API key from SSM Parameter Store
const apiKey = await getSSMParameter('/prod/external-api/key', {
  withDecryption: true,
  cacheTTL: 300 // Cache for 5 minutes
});

// Create authenticated client
const externalApi = createAxiosClient({
  baseURL: 'https://api.external-service.com',
  authToken: `Bearer ${apiKey}`,
  timeout: 15000
});

// Make authenticated requests
const response = await externalApi.get('/v1/data');
```

### Error Handling

```typescript
import { get } from '@template/libs';
import { CustomError } from '@template/libs';

export async function fetchUserData(userId: string) {
  try {
    const userData = await get<UserData>(
      `https://api.example.com/users/${userId}`
    );
    return userData;
  } catch (error) {
    // Errors are automatically converted to CustomError with proper status codes
    if (error instanceof CustomError) {
      logger.error('API request failed', {
        status: error.statusCode,
        code: error.code,
        details: error.details
      });
    }
    throw error;
  }
}
```

### Retry Behavior

The Axios client automatically retries failed requests with the following defaults:

- **Retries**: 3 attempts
- **Delay**: 1000ms (with exponential backoff)
- **Retryable Status Codes**: 408, 429, 500, 502, 503, 504

```typescript
import { createAxiosClient } from '@template/libs';

// Customize retry behavior
const resilientClient = createAxiosClient({
  retryConfig: {
    retries: 5, // More attempts for critical services
    retryDelay: 500, // Shorter initial delay
    exponentialBackoff: true, // 500ms, 1s, 2s, 4s, 8s
    retryableStatuses: [429, 503] // Only retry specific errors
  }
});
```

## Advanced SSM Parameter Management

Enhanced SSM client with batch operations, caching, and CRUD operations.

### Basic Parameter Operations

```typescript
import {
  getSSMParameter,
  putSSMParameter,
  deleteSSMParameter
} from '@template/libs';

// Get a single parameter (backward compatible)
const dbPassword = await getSSMParameter('/prod/db/password', true);

// Or with options object
const apiKey = await getSSMParameter('/prod/api-key', {
  withDecryption: true
});

// Create or update a parameter
await putSSMParameter('/prod/api-key', 'new-secret-key', {
  type: 'SecureString',
  description: 'Production API key for external service',
  overwrite: true,
  tags: {
    Environment: 'production',
    Team: 'backend',
    CostCenter: 'engineering'
  }
});

// Delete a parameter
await deleteSSMParameter('/prod/old-config');
```

### Batch Operations

```typescript
import { getSSMParameters, deleteSSMParameters } from '@template/libs';

// Retrieve multiple parameters at once (auto-chunks at 10 items)
const params = await getSSMParameters([
  '/prod/db/host',
  '/prod/db/port',
  '/prod/db/name',
  '/prod/db/username',
  '/prod/api-key',
  '/prod/jwt-secret'
], { withDecryption: true });

// Access values from the Map
const dbHost = params.get('/prod/db/host');
const dbPort = params.get('/prod/db/port');

// Delete multiple parameters
await deleteSSMParameters([
  '/prod/temp-config-1',
  '/prod/temp-config-2',
  '/prod/old-feature-flag'
]);
```

### Parameter Caching

Reduce AWS API calls and improve performance with built-in caching:

```typescript
import { getSSMParameter } from '@template/libs';

// Cache parameter for 5 minutes (300 seconds)
const config = await getSSMParameter('/prod/app-config', {
  withDecryption: false,
  cacheTTL: 300
});

// Second call within 5 minutes will use cached value (no AWS API call)
const cachedConfig = await getSSMParameter('/prod/app-config', {
  withDecryption: false,
  cacheTTL: 300
});

// Batch retrieval with caching
const params = await getSSMParameters(
  ['/prod/key1', '/prod/key2', '/prod/key3'],
  { cacheTTL: 600 } // Cache for 10 minutes
);
```

### Clear Cache

```typescript
import { clearSSMCache } from '@template/libs';

// Clear specific parameter from cache
clearSSMCache('/prod/app-config');

// Clear all cached parameters
clearSSMCache();
```

### Hierarchical Parameters

```typescript
import { getSSMParametersByPath } from '@template/libs';

// Get all parameters under a path
const dbParams = await getSSMParametersByPath('/prod/database/', {
  recursive: false, // Only direct children
  withDecryption: true
});

// Get all parameters recursively
const allProdParams = await getSSMParametersByPath('/prod/', {
  recursive: true, // Include all nested paths
  withDecryption: true,
  maxResults: 50
});

// Iterate through results
for (const [name, value] of allProdParams) {
  console.log(`${name}: ${value}`);
}
```

### List and Filter Parameters

```typescript
import { listSSMParameters } from '@template/libs';

// List all parameters
const allParams = await listSSMParameters({
  maxResults: 100
});

// List with filters
const appParams = await listSSMParameters({
  maxResults: 50,
  filters: [{
    key: 'Name',
    values: ['/prod/app/']
  }]
});

// Access metadata
for (const param of appParams) {
  console.log({
    name: param.name,
    type: param.type,
    description: param.description,
    lastModified: param.lastModifiedDate
  });
}
```

### Best Practices

```typescript
// 1. Cache frequently accessed, rarely changed parameters
const JWT_SECRET = await getSSMParameter('/prod/jwt-secret', {
  withDecryption: true,
  cacheTTL: 3600 // Cache for 1 hour
});

// 2. Batch load configuration at startup
const config = await getSSMParameters([
  '/prod/db/host',
  '/prod/db/port',
  '/prod/redis/host',
  '/prod/s3/bucket'
], { cacheTTL: 300 });

// 3. Clear cache after updates
await putSSMParameter('/prod/feature-flag', 'true');
clearSSMCache('/prod/feature-flag');

// 4. Use hierarchical structure for organization
// /prod/app/api-key
// /prod/app/db/host
// /prod/app/db/port
// /prod/app/redis/host
```

## Advanced Lambda Invocations

Enhanced Lambda client with async invocation, DryRun validation, retry logic, and batch operations.

### Basic Invocation (Backward Compatible)

```typescript
import { invokeLambda } from '@template/libs';

// Synchronous invocation (RequestResponse)
const result = await invokeLambda<ProcessResult>(
  'data-processor-function',
  { userId: '123', action: 'process' }
);

console.log(result); // { success: true, processedCount: 42 }
```

### Async Invocation (Fire and Forget)

```typescript
import { invokeLambdaAsync } from '@template/libs';

// Asynchronous invocation (Event type)
// Returns immediately without waiting for function to complete
await invokeLambdaAsync('send-notification', {
  userId: '123',
  type: 'email',
  template: 'welcome'
});

// Or using invokeLambda with options
await invokeLambda('send-notification', payload, {
  invocationType: 'Event'
});
```

### DryRun Validation

```typescript
import { validateLambdaInvocation } from '@template/libs';

// Validate function can be invoked without actually executing it
const isValid = await validateLambdaInvocation('my-function', {
  test: 'payload'
});

if (isValid) {
  console.log('Function invocation is valid');
  // Proceed with actual invocation
  const result = await invokeLambda('my-function', { test: 'payload' });
} else {
  console.error('Function invocation would fail');
}
```

### Detailed Invocation Results

```typescript
import { invokeLambdaWithDetails } from '@template/libs';

// Get full invocation details including logs and metadata
const result = await invokeLambdaWithDetails<ResponseType>(
  'my-function',
  { key: 'value' },
  { logType: 'Tail' } // Include execution logs
);

console.log('Status Code:', result.statusCode); // 200
console.log('Executed Version:', result.executedVersion); // $LATEST or version number
console.log('Function Error:', result.functionError); // undefined if no error

// Decode and view execution logs
if (result.logResult) {
  const logs = Buffer.from(result.logResult, 'base64').toString();
  console.log('Execution Logs:\n', logs);
}

console.log('Response:', result.payload);
```

### Retry Configuration

```typescript
import { invokeLambda } from '@template/libs';

// Custom retry logic for critical operations
const result = await invokeLambda<ResultType>(
  'critical-function',
  { data: 'important' },
  {
    retryConfig: {
      maxRetries: 5,
      retryDelay: 2000, // 2 seconds
      exponentialBackoff: true, // 2s, 4s, 8s, 16s, 32s
      retryableErrors: [
        'ServiceException',
        'TooManyRequestsException',
        'ResourceNotReadyException'
      ]
    }
  }
);
```

### Batch Parallel Invocations

```typescript
import { batchInvokeLambda } from '@template/libs';

// Invoke multiple functions in parallel
const results = await batchInvokeLambda<ProcessResult>([
  { functionName: 'process-user-1', payload: { userId: '1' } },
  { functionName: 'process-user-2', payload: { userId: '2' } },
  { functionName: 'process-user-3', payload: { userId: '3' } },
  { functionName: 'process-user-4', payload: { userId: '4' } }
]);

// Handle results
for (const result of results) {
  if (result.success) {
    console.log(`${result.functionName} succeeded:`, result.result);
  } else {
    console.error(`${result.functionName} failed:`, result.error);
  }
}

// Separate successes and failures
const successes = results.filter(r => r.success);
const failures = results.filter(r => !r.success);

console.log(`Successful: ${successes.length}, Failed: ${failures.length}`);
```

### Streaming Responses

```typescript
import { invokeLambdaWithStreaming } from '@template/libs';

// For large payloads or real-time data
const streamData = await invokeLambdaWithStreaming<LargeDataset>(
  'analytics-function',
  { query: 'get-all-transactions', year: 2026 }
);

console.log('Streamed data:', streamData);
```

### Advanced Use Cases

```typescript
import {
  invokeLambda,
  invokeLambdaAsync,
  batchInvokeLambda,
  validateLambdaInvocation
} from '@template/libs';

// 1. Chain Lambda invocations with error handling
export async function processWorkflow(data: WorkflowData) {
  // Step 1: Validate
  const step1 = await invokeLambda<ValidationResult>('validate-data', data);

  if (!step1.valid) {
    throw new Error('Validation failed');
  }

  // Step 2: Process
  const step2 = await invokeLambda<ProcessResult>('process-data', {
    ...data,
    validationId: step1.id
  });

  // Step 3: Notify (async - don't wait)
  await invokeLambdaAsync('send-notifications', {
    processId: step2.id,
    recipients: data.recipients
  });

  return step2;
}

// 2. Fan-out pattern with batch invocations
export async function processBatchUsers(userIds: string[]) {
  const requests = userIds.map(userId => ({
    functionName: 'process-user',
    payload: { userId }
  }));

  const results = await batchInvokeLambda<UserProcessResult>(requests);

  // Aggregate results
  const summary = {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    failedUsers: results
      .filter(r => !r.success)
      .map(r => ({ functionName: r.functionName, error: r.error?.message }))
  };

  return summary;
}

// 3. Conditional invocation with validation
export async function safeLambdaInvoke<T>(
  functionName: string,
  payload: unknown
): Promise<T | null> {
  // First validate
  const isValid = await validateLambdaInvocation(functionName, payload);

  if (!isValid) {
    logger.warn('Lambda validation failed, skipping invocation', {
      functionName
    });
    return null;
  }

  // Invoke with retry
  try {
    return await invokeLambda<T>(functionName, payload, {
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
        retryableErrors: ['ServiceException', 'TooManyRequestsException']
      }
    });
  } catch (error) {
    logger.error('Lambda invocation failed after retries', {
      functionName,
      error
    });
    return null;
  }
}
```

### Best Practices

```typescript
// 1. Use async invocation for non-critical background tasks
await invokeLambdaAsync('update-analytics', { eventType: 'page_view' });

// 2. Validate before costly operations
const canInvoke = await validateLambdaInvocation('expensive-function', payload);
if (canInvoke) {
  await invokeLambda('expensive-function', payload);
}

// 3. Use batch operations for parallel processing
const requests = items.map(item => ({
  functionName: 'process-item',
  payload: { itemId: item.id }
}));
const results = await batchInvokeLambda(requests);

// 4. Configure retries for transient errors only
await invokeLambda('api-function', payload, {
  retryConfig: {
    maxRetries: 3,
    retryableErrors: ['ServiceException', 'TooManyRequestsException']
    // Don't retry validation or business logic errors
  }
});

// 5. Use detailed results when debugging
const { payload, statusCode, logResult } = await invokeLambdaWithDetails(
  'debug-function',
  { test: true },
  { logType: 'Tail' }
);
```

## Advanced Examples

### Batch Operations (DynamoDB)

```typescript
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

async function batchCreateOrders(orders: Order[]) {
  const putRequests = orders.map((item) => ({
    PutRequest: { Item: item }
  }));

  await docClient.send(
    new BatchWriteCommand({
      RequestItems: {
        [ORDERS_TABLE]: putRequests
      }
    })
  );
}
```

### Complex Queries (PostgreSQL)

```typescript
import { db } from '@template/libs';
import { users } from '@template/contracts';
import { sql } from 'drizzle-orm';

// Aggregation
const userCount = await db
  .select({ count: sql<number>`count(*)` })
  .from(users)
  .where(eq(users.status, 'ACTIVE'));

// Subqueries
const recentUsers = await db
  .select()
  .from(users)
  .where(
    sql`${users.createdAt} > NOW() - INTERVAL '7 days'`
  );
```

### Environment-Specific Configuration

```typescript
const config = {
  dev: {
    timeout: 60,
    memorySize: 512
  },
  prod: {
    timeout: 29,
    memorySize: 1024
  }
};

export const FUNCTIONS = {
  myFunction: createDefaultApiFunc({
    dir: __dirname,
    fnName: 'handler.myHandler',
    http: { method: 'post', path: '/v1/resource' },
    other: config[process.env['STAGE'] === 'prod' ? 'prod' : 'dev']
  })
};
```

## Lambda Optimization Tips

### Cold Start Optimization

1. **Use ARM64 architecture** (already configured)
2. **Minimize dependencies**
   ```typescript
   // Instead of importing entire lodash
   import get from 'lodash/get';
   ```

3. **Lazy load heavy dependencies**
   ```typescript
   let heavyLib: typeof import('heavy-lib') | null = null;

   async function useHeavyLib() {
     if (!heavyLib) {
       heavyLib = await import('heavy-lib');
     }
     return heavyLib.doSomething();
   }
   ```

4. **Use esbuild bundling** (already configured)

### Connection Reuse

The template already implements connection reuse for both databases:

```typescript
// PostgreSQL - connections persist across invocations
export const db = new Proxy(...);

// DynamoDB - client persists across invocations
const docClient = DynamoDBDocumentClient.from(dynamoDb);
```

### Environment Variables Caching

```typescript
// Cache at module level
const DATABASE_URL = process.env['DATABASE_URL'];
const TABLE_NAME = process.env['ORDERS_TABLE'];

export function handler() {
  // Use cached values
}
```

## Monitoring & Observability

### Structured Logging

```typescript
import { logger } from '@template/libs';

export async function processOrder(orderId: string) {
  logger.info('Processing order', { orderId, stage: process.env['STAGE'] });

  try {
    const result = await someOperation();
    logger.info('Order processed successfully', { orderId, result });
    return result;
  } catch (error) {
    logger.error('Failed to process order', { orderId, error });
    throw error;
  }
}
```

### CloudWatch Insights Queries

Query logs in CloudWatch:

```
fields @timestamp, @message
| filter @message like /Error/
| sort @timestamp desc
| limit 20
```

### X-Ray Tracing (Optional)

To add AWS X-Ray tracing, install and use the middleware:

```typescript
import middy from '@middy/core';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer';

export const handler = middy(baseHandler)
  .use(captureLambdaHandler());
```

## Security Examples

### Input Sanitization

```typescript
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional()
});
```

### Rate Limiting

API Gateway usage plan is already configured in `serverless.ts`:

```typescript
usagePlan: {
  throttle: {
    burstLimit: 150,
    rateLimit: 100
  }
}
```

### SQL Injection Prevention

Drizzle ORM uses parameterized queries by default:

```typescript
// Safe - parameters are escaped
const user = await db
  .select()
  .from(users)
  .where(eq(users.email, userInput));

// Also safe with raw SQL
const result = await db.execute(
  sql`SELECT * FROM users WHERE email = ${userInput}`
);
```

## Deployment Examples

### Multi-Region Deployment

Modify `serverless.ts`:

```typescript
const regions = ['ap-southeast-1', 'us-east-1'];

// Deploy to multiple regions
regions.forEach(region => {
  // serverless deploy --region ${region}
});
```

### Blue-Green Deployment

Use Lambda aliases and traffic shifting:

```typescript
// In serverless.ts
provider: {
  deploymentMethod: 'direct',
  versionFunctions: true
}

// Create alias
aws lambda create-alias --function-name my-function --name live --function-version 1

// Update with traffic shifting
aws lambda update-alias --function-name my-function --name live --function-version 2 \
  --routing-config AdditionalVersionWeights={"1"=0.5}
```

## Integration Examples

### Calling Another Lambda

```typescript
import { invokeLambda } from '@template/libs';

export async function notifyUser(userId: string, message: string) {
  const result = await invokeLambda<{ success: boolean }>(
    'notification-service-sendEmail',
    { userId, message }
  );

  return result;
}
```

### S3 Integration

```typescript
import { getObjectFromS3, putObjectToS3 } from '@template/libs';

// Read from S3
const content = await getObjectFromS3('my-bucket', 'path/to/file.json');
const data = JSON.parse(content);

// Write to S3
await putObjectToS3('my-bucket', 'path/to/output.json', JSON.stringify(data));
```

### SSM Parameter Store

```typescript
import { getSSMParameter } from '@template/libs';

const apiKey = await getSSMParameter('/prod/app/external-api-key', true);
```

## Custom Utilities Examples

### Retry Logic

```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

// Usage
const result = await withRetry(() => externalApiCall());
```

### Response Caching

```typescript
const cache = new Map<string, { data: unknown; expires: number }>();

export function cached<T>(key: string, fn: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return Promise.resolve(cached.data as T);
  }

  return fn().then(data => {
    cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
    return data;
  });
}
```

## Next Steps

- Explore the full codebase in `packages/` and `stacks/`
- Review the [Best Practices](#best-practices) section in README.md
- Check out the [Troubleshooting](#troubleshooting) guide
- Experiment with the examples above in your local environment
