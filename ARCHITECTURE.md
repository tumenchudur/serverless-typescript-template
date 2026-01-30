# Architecture Documentation

This document describes the architecture, patterns, and design decisions of the serverless TypeScript template.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│  (CORS, Throttling, Authorization Headers)                  │
└───────────────┬──────────────────────┬──────────────────────┘
                │                      │
                v                      v
    ┌──────────────────┐    ┌──────────────────┐
    │   api-users      │    │   api-orders     │
    │   (PostgreSQL)   │    │   (DynamoDB)     │
    └────────┬─────────┘    └────────┬─────────┘
             │                       │
             v                       v
    ┌──────────────────┐    ┌──────────────────┐
    │   PostgreSQL     │    │   DynamoDB       │
    │   (via VPC)      │    │   (Pay-per-req)  │
    └──────────────────┘    └──────────────────┘

    ┌──────────────────────────────────────┐
    │      EventBridge                     │
    │  (Scheduled Rules - Rate/Cron)       │
    └─────────────┬────────────────────────┘
                  │
                  v
         ┌──────────────────┐
         │ scheduled-tasks  │
         │ (Sync, Cleanup)  │
         └──────────────────┘
```

## Monorepo Structure

### Packages (Shared Code)

```
packages/
│
├── ts-configs/              # Shared TypeScript Configuration
│   └── base.json           # Strict TypeScript settings
│
├── contracts/               # Schemas & Types (Zero Business Logic)
│   ├── tables/             # Drizzle ORM table definitions
│   ├── schemas/            # Zod validation schemas
│   └── types/              # Shared TypeScript interfaces
│
└── libs/                    # Core Utilities & Clients
    ├── aws/                # AWS service clients
    ├── db/                 # Database clients
    │   ├── postgres/       # Drizzle client with lazy init
    │   └── dynamo/         # DynamoDB wrapper functions
    ├── errors/             # Error classes & handlers
    ├── functions/          # Lambda function builders
    ├── http/               # API utilities & middleware
    └── utils/              # Logger, helpers
```

### Stacks (Services)

```
stacks/
│
├── api-users/              # PostgreSQL-based User Service
│   ├── functions/          # Lambda handlers (HTTP endpoints)
│   ├── services/           # Business logic layer
│   ├── repository/         # Data access layer
│   └── serverless.ts       # Infrastructure as Code
│
├── api-orders/             # DynamoDB-based Order Service
│   └── [same structure]
│
└── scheduled-tasks/        # EventBridge Scheduled Functions
    ├── functions/          # Lambda handlers (scheduled)
    └── serverless.ts
```

## Design Patterns

### 1. Three-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│ HANDLER LAYER (functions/*/handler.ts)          │
│ - Validate input (Zod schemas)                  │
│ - Extract parameters                            │
│ - Call service layer                            │
│ - Format response                               │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│ SERVICE LAYER (services/*.service.ts)           │
│ - Business logic                                │
│ - Business rule validation                      │
│ - Coordinate multiple repositories              │
│ - Transaction management                        │
└────────────────┬────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────┐
│ REPOSITORY LAYER (repository/*.repository.ts)   │
│ - Direct database access                        │
│ - CRUD operations                               │
│ - Query building                                │
│ - Data mapping                                  │
└─────────────────────────────────────────────────┘
```

**Benefits:**

- Clear separation of concerns
- Easy to test each layer independently
- Business logic isolated from infrastructure
- Database implementation can be swapped easily

### 2. Repository Pattern

Abstracts data access from business logic:

```typescript
// Repository - "How" to access data
export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

// Service - "What" business rules to apply
export async function getUser(id: string): Promise<User> {
  const user = await getUserById(id);
  if (!user) throw new NotFoundError('User not found');
  if (user.status !== 'ACTIVE') throw new ForbiddenError('User is not active');
  return user;
}
```

### 3. Dependency Injection via Imports

Uses ES modules for dependency injection:

```typescript
// Services import from repositories
import { createUserInDb } from '../repository/user.repository';

// Handlers import from services
import { createUser } from '../../services/user.service';

// Easy to mock in tests
vi.mock('../repository/user.repository');
```

### 4. Factory Functions for Lambda Config

Consistent function definitions:

```typescript
export const functions = {
  myApi: createUserAuthApiFunc({
    dir: __dirname,
    fnName: 'handler.myHandler',
    http: { method: 'post', path: '/v1/resource' }
  })
};
```

### 5. Proxy Pattern for Lazy Initialization

Database connections initialized only when used:

```typescript
export const db = new Proxy({} as PostgresJsDatabase, {
  get(_, prop) {
    return (getDb() as never)[prop];
  }
});
```

**Benefits:**

- Faster Lambda cold starts
- Connections reused across invocations
- Environment variables validated at runtime

## Data Flow

### HTTP Request Flow

```
1. API Gateway
   ↓ (validates headers, throttles)
2. Lambda Handler
   ↓ (Middy middleware)
3. JSON Body Parser
   ↓
4. Zod Schema Validation
   ↓
5. Service Layer
   ↓ (business logic)
6. Repository Layer
   ↓ (database query)
7. Database (PostgreSQL/DynamoDB)
   ↓
8. Response Formatting
   ↓
9. API Gateway
   ↓
10. Client
```

### Error Flow

```
Error Thrown (anywhere)
   ↓
Caught by createHttpHandler
   ↓
handleApiFuncError
   ↓
Match Error Type:
   - CustomError → Return statusCode & message
   - ZodError → Return 400 with field errors
   - Error → Return 500 with generic message
   ↓
formatApiResponse
   ↓
Return to client with proper HTTP code
```

## Infrastructure Architecture

### Lambda Configuration

```yaml
Runtime: nodejs22.x
Architecture: ARM64
Memory: 256 MB (users), 512 MB (scheduled)
Timeout: 29s (API), 60s (scheduled)
Environment: STAGE, REGION, DATABASE_URL, etc.
VPC: Optional (for RDS access)
IAM: Least privilege per function
```

### API Gateway

```yaml
Compression: 1024 bytes minimum
Throttling:
  Burst: 150 requests
  Rate: 100 requests/second
CORS: Enabled via GatewayResponse
Authorization: Headers validated per endpoint
```

### Database Configuration

**PostgreSQL via Drizzle:**

- Connection pooling: max 1 (Lambda best practice)
- Lazy initialization
- Transaction support
- Migration system

**DynamoDB:**

- Pay-per-request billing (no provisioned capacity)
- On-demand scaling
- Streams enabled for change data capture
- GSI support ready

## Security Architecture

### Defense in Depth

```
Layer 1: API Gateway
  - Request throttling
  - Header validation
  - CORS policies

Layer 2: Lambda Authorization
  - JWT verification
  - Role-based checks
  - Custom authorizers (ready to add)

Layer 3: Input Validation
  - Zod schema validation
  - Type checking
  - SQL injection prevention (ORM)

Layer 4: IAM Policies
  - Least privilege
  - Resource-specific permissions
  - Service-to-service auth

Layer 5: VPC Isolation
  - Private subnets for RDS access
  - Security groups
  - Network ACLs
```

### Secrets Management

```
Development:
  .env file (git-ignored)

Production:
  AWS Systems Manager Parameter Store
  - Encrypted with KMS
  - Access via IAM
  - Versioned
```

## Performance Optimizations

### Cold Start Reduction

1. **ARM64 Architecture**: 20% better price-performance
2. **Minimal Dependencies**: Smaller bundle sizes
3. **esbuild**: Fast bundling with tree-shaking
4. **Lazy Initialization**: Connect to DB only when needed
5. **Individual Packaging**: Each function bundles only what it needs

### Runtime Performance

1. **Connection Reuse**: PostgreSQL/DynamoDB clients cached
2. **Single DB Connection**: Lambda best practice (max: 1)
3. **Async Operations**: Non-blocking I/O throughout
4. **Indexed Queries**: Database indexes on common queries

### Build Performance

1. **Turborepo**: Caches unchanged packages
2. **pnpm**: Fast, space-efficient installs
3. **Parallel Builds**: Turbo runs tasks concurrently
4. **Incremental Compilation**: TypeScript project references

## Monitoring & Observability

### Logging Strategy

```typescript
// Structured logging with context
logger.info('Operation completed', {
  userId,
  operation: 'createOrder',
  duration: Date.now() - start,
  stage: process.env['STAGE']
});
```

**CloudWatch Integration:**

- Automatic log collection
- 365-day retention
- Searchable with CloudWatch Insights
- Alerting ready

### Metrics (Optional Add-ons)

- AWS X-Ray for distributed tracing
- Custom CloudWatch metrics
- API Gateway metrics (latency, errors, throttles)
- Lambda metrics (invocations, duration, errors, throttles)

## Scalability Considerations

### Horizontal Scaling

- **Lambda**: Auto-scales to 1000 concurrent by default
- **DynamoDB**: On-demand scaling, no limits
- **PostgreSQL**: Connection pooling required (already configured)

### Database Scaling

**PostgreSQL:**

- Use RDS Proxy for connection pooling
- Read replicas for read-heavy workloads
- Aurora Serverless for auto-scaling

**DynamoDB:**

- Partition key design for even distribution
- GSIs for additional query patterns
- DynamoDB Streams for event processing

## Testing Strategy

### Test Pyramid

```
           /\
          /E2E\         Few, critical paths
         /──────\
        /  INT   \      Some, key integrations
       /──────────\
      /   UNIT     \    Many, fast, isolated
     /──────────────\
```

**Unit Tests:**

- Mock all external dependencies
- Test business logic
- Fast, isolated

**Integration Tests:**

- Real database connections
- Test repository layer
- Use test database

**E2E Tests:**

- Full API flow
- Deployed to test environment
- Critical user journeys

## Deployment Strategy

### Environments

```
dev → staging → prod
```

**Configuration:**

- Environment-specific SSM parameters
- Stage-based resource naming
- Region-specific deployments

### Deployment Process

```bash
1. Build: pnpm run build
   ↓
2. Tests: pnpm run test
   ↓
3. Lint: pnpm run lint
   ↓
4. Package: serverless package
   ↓
5. Deploy: serverless deploy
   ↓
6. Verify: Health checks
```

### Rollback Strategy

```bash
# List previous versions
serverless deploy list

# Rollback to previous version
serverless rollback --timestamp [timestamp]
```

## Extension Points

The template is designed to be extended:

### Adding New Middleware

```typescript
// packages/libs/src/http/middleware/
export const authMiddleware = () => ({
  before: async (request) => {
    // Verify JWT, attach user to event
  }
});

// Use in handlers
export const handler = createHttpHandler(async (event) => {
  // handler logic
}).use(authMiddleware());
```

### Adding New Database Tables

```typescript
// 1. Define schema
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull()
});

// 2. Generate migration
pnpm run db:generate

// 3. Apply migration
pnpm run db:migrate
```

### Adding New Stacks

```bash
# Copy existing stack
cp -r stacks/api-users stacks/api-products

# Update serverless.ts service name
# Update package.json name
# Modify functions, services, repositories
```

### Adding Custom Validators

```typescript
// packages/libs/src/validators/
export const validateEmail = (email: string) => {
  const schema = z.string().email();
  return schema.parse(email);
};
```

### Creating Custom API Clients

The template includes a production-ready Axios HTTP client that can be used to create service-specific API clients for external integrations.

```typescript
// packages/libs/src/integrations/stripe-client.ts
import { createAxiosClient, getSSMParameter } from '@template/libs';

class StripeClient {
  private client;

  async initialize() {
    // Load API key from SSM Parameter Store with caching
    const apiKey = await getSSMParameter('/prod/stripe/secret-key', {
      withDecryption: true,
      cacheTTL: 3600 // Cache for 1 hour
    });

    // Create configured client
    this.client = createAxiosClient({
      baseURL: 'https://api.stripe.com/v1',
      timeout: 10000,
      authToken: `Bearer ${apiKey}`,
      headers: {
        'Stripe-Version': '2024-01-01'
      },
      retryConfig: {
        retries: 3,
        retryDelay: 1000,
        retryableStatuses: [429, 503],
        exponentialBackoff: true
      },
      enableLogging: true
    });

    return this;
  }

  async createCharge(amount: number, currency: string, source: string) {
    const response = await this.client.post('/charges', {
      amount,
      currency,
      source
    });
    return response.data;
  }

  async getCustomer(customerId: string) {
    const response = await this.client.get(`/customers/${customerId}`);
    return response.data;
  }
}

// Export singleton
export const stripeClient = new StripeClient();

// Usage in handlers/services
import { stripeClient } from '@template/libs';

export async function processPayment(orderId: string, amount: number) {
  await stripeClient.initialize();
  const charge = await stripeClient.createCharge(amount, 'usd', 'tok_visa');
  logger.info('Payment processed', { orderId, chargeId: charge.id });
  return charge;
}
```

**Example: Twilio SMS Client**

```typescript
// packages/libs/src/integrations/twilio-client.ts
import { createAxiosClient, getSSMParameter } from '@template/libs';

class TwilioClient {
  private client;
  private accountSid: string;

  async initialize() {
    this.accountSid = await getSSMParameter('/prod/twilio/account-sid', {
      cacheTTL: 3600
    });

    const authToken = await getSSMParameter('/prod/twilio/auth-token', {
      withDecryption: true,
      cacheTTL: 3600
    });

    this.client = createAxiosClient({
      baseURL: `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`,
      authToken: `Basic ${Buffer.from(`${this.accountSid}:${authToken}`).toString('base64')}`,
      timeout: 15000
    });

    return this;
  }

  async sendSMS(to: string, body: string) {
    const from = await getSSMParameter('/prod/twilio/phone-number', {
      cacheTTL: 3600
    });

    const response = await this.client.post('/Messages.json', {
      To: to,
      From: from,
      Body: body
    });

    return response.data;
  }
}

export const twilioClient = new TwilioClient();
```

**Benefits:**

- **SSM Integration**: API keys stored securely and cached efficiently
- **Automatic Retry**: Built-in retry logic for transient failures
- **Error Handling**: Errors automatically converted to CustomError with proper status codes
- **Logging**: Request/response logging via Winston for observability
- **Type Safety**: Full TypeScript support with generics
- **Testability**: Easy to mock in unit tests

## Design Decisions

### Why Drizzle ORM?

- **Type Safety**: Full TypeScript inference
- **Performance**: Lightweight, minimal overhead
- **Developer Experience**: Great autocomplete, clear errors
- **Flexibility**: Can drop to raw SQL when needed
- **Migration System**: Built-in with drizzle-kit

### Why DynamoDB Wrapper Instead of ORM?

- **Flexibility**: DynamoDB is NoSQL, ORMs add overhead
- **Control**: Full control over queries and performance
- **Simplicity**: Direct SDK usage, clear what's happening
- **Type Safety**: TypeScript interfaces for type checking

### Why Middy?

- **Standard**: De facto middleware for Lambda
- **Ecosystem**: Many pre-built middleware
- **Composable**: Easy to add/remove middleware
- **Type Safe**: Full TypeScript support

### Why pnpm?

- **Fast**: Fastest package manager
- **Efficient**: Saves disk space with content-addressable storage
- **Strict**: Better dependency resolution
- **Workspace**: First-class monorepo support

### Why Turborepo?

- **Caching**: Smart caching of build outputs
- **Parallelization**: Runs tasks concurrently
- **Dependency Graph**: Understands workspace dependencies
- **Developer Experience**: Fast, incremental builds

### Why ESLint v9 Flat Config?

- **Modern**: Latest ESLint configuration format
- **Simpler**: Easier to understand and maintain
- **Performant**: Faster than legacy config
- **Future Proof**: New standard going forward

## Security Considerations

### Data Protection

- **Encryption at Rest**: RDS encryption, DynamoDB encryption
- **Encryption in Transit**: TLS for all connections
- **Secrets**: SSM Parameter Store with KMS
- **Least Privilege**: Minimal IAM permissions per function

### Input Validation

```typescript
// All inputs validated with Zod
const request = CreateUserSchema.parse(event.body);

// SQL injection prevented by ORM
const user = await db.select().from(users).where(eq(users.email, email));

// No direct SQL string concatenation
```

### Authentication & Authorization

Ready for:

- AWS Cognito integration
- JWT verification middleware
- API keys
- Custom authorizers

### CORS Configuration

```typescript
headers: {
  'Access-Control-Allow-Origin': '*',  // Configure per environment
  'Access-Control-Allow-Credentials': true
}
```

## Cost Optimization

### Lambda

- **ARM64**: 20% cost reduction vs x86
- **Right-sizing**: Memory tuned per function
- **Timeout**: Minimized to prevent runaway costs
- **Provisioned Concurrency**: Not used (on-demand only)

### DynamoDB

- **Pay-per-request**: No wasted provisioned capacity
- **Efficient Queries**: Use indexes, avoid scans
- **TTL**: Auto-delete old records (add if needed)

### API Gateway

- **Compression**: Reduce data transfer costs
- **Caching**: Can add if needed
- **Regional**: Not edge-optimized (lower cost)

### Data Transfer

- **VPC Endpoints**: Reduce NAT gateway costs (add if needed)
- **S3 Transfer Acceleration**: Optional for uploads

## Reliability & Resilience

### Error Recovery

- **Automatic Retries**: Lambda retries on error
- **Dead Letter Queues**: Can add for failed events
- **Idempotency**: Design operations to be idempotent
- **Circuit Breaker**: Can add for external services

### Database Resilience

**PostgreSQL:**

- Multi-AZ RDS deployment
- Automated backups
- Point-in-time recovery

**DynamoDB:**

- Multi-AZ replication (automatic)
- Point-in-time recovery (enable in production)
- Global tables (for multi-region)

### Monitoring

- CloudWatch Logs (365-day retention)
- CloudWatch Alarms (add for critical metrics)
- AWS X-Ray (optional tracing)
- API Gateway metrics

## Development Workflow

### Local Development

```
1. Developer writes code
   ↓
2. TypeScript type checks (real-time in IDE)
   ↓
3. serverless-offline (local testing)
   ↓
4. Unit tests (Vitest)
   ↓
5. Pre-commit hooks
   ↓
6. Format → Lint → Type-check → Build
   ↓
7. Commit & Push
   ↓
8. CI/CD (add GitHub Actions/GitLab CI)
   ↓
9. Deploy to dev
   ↓
10. Integration tests
   ↓
11. Deploy to prod
```

### Testing Workflow

```
Unit Tests (Vitest)
  ↓
Run locally with mocks
  ↓
Fast feedback (~100ms per test)

Integration Tests
  ↓
Use test database
  ↓
Slower but more confident (~1s per test)

E2E Tests
  ↓
Deploy to test environment
  ↓
Real AWS resources (~10s per test)
```

## Maintenance & Operations

### Database Migrations

```bash
# Add new column
# 1. Update schema in packages/contracts/src/tables/
# 2. Generate migration
pnpm run db:generate

# 3. Review migration in drizzle/migrations/
# 4. Test in dev
DATABASE_URL=... pnpm run db:migrate

# 5. Apply to prod
DATABASE_URL=prod-url pnpm run db:migrate
```

### Dependency Updates

```bash
# Check for updates
pnpm outdated

# Update all
pnpm update --latest

# Test after updates
pnpm run build && pnpm run test
```

### Log Analysis

```bash
# View logs for a function
aws logs tail /aws/lambda/template-api-users-prod-createUser --follow

# Search logs
aws logs filter-pattern /aws/lambda/template-api-users-prod-createUser --filter-pattern "ERROR"
```

## Performance Benchmarks

Expected performance (approximate):

| Metric       | Target  | Notes                    |
| ------------ | ------- | ------------------------ |
| Cold Start   | < 1s    | ARM64 with minimal deps  |
| Warm Latency | < 100ms | Without DB query         |
| DB Query     | < 50ms  | PostgreSQL with indexes  |
| Build Time   | < 30s   | Full monorepo with cache |
| Test Suite   | < 5s    | All unit tests           |

## Future Improvements

Potential enhancements:

1. **CI/CD Pipeline**: GitHub Actions, GitLab CI
2. **Custom Authorizers**: Cognito, JWT verification
3. **API Documentation**: OpenAPI/Swagger generation
4. **GraphQL**: Add Apollo Server stack
5. **WebSockets**: API Gateway WebSocket support
6. **Event Sourcing**: DynamoDB Streams processing
7. **Caching**: Redis/ElastiCache integration
8. **CDN**: CloudFront for static assets
9. **Observability**: X-Ray, CloudWatch dashboards
10. **Cost Tracking**: AWS Cost Explorer tags

## Conclusion

This template provides a solid foundation for building production-grade serverless applications with:

- Strong type safety
- Clear architectural patterns
- Excellent developer experience
- Production-ready infrastructure
- Comprehensive testing
- Scalable design

Start building, and extend as needed for your specific use case!
