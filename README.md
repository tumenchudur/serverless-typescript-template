# Expert-Level Serverless TypeScript Template

A production-ready serverless TypeScript monorepo template integrating both **DynamoDB** and **PostgreSQL (Drizzle ORM)**, incorporating enterprise-grade best practices for AWS Lambda development.

## Quick Start (5 Minutes)

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Set up database
createdb template_db
pnpm run db:generate
pnpm run db:migrate

# 4. Start local development
cd stacks/api-users
pnpm run dev
# API available at http://localhost:3000

# 5. Test the API
curl -X POST http://localhost:3000/dev/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"email":"john@example.com","firstName":"John","lastName":"Doe"}'

# 6. Run tests
pnpm run test
```

**Next steps:** See [Documentation](#documentation) below.

## Documentation

📚 **Complete Guides:**

- **[EXAMPLES.md](./EXAMPLES.md)** - Comprehensive code examples for all features (PostgreSQL, DynamoDB, Axios, SSM, Lambda, testing, etc.)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, design patterns, and best practices

## Features

- **Dual Database Support**: DynamoDB and PostgreSQL with Drizzle ORM
- **Type Safety**: Strict TypeScript with Zod validation schemas
- **Production Ready**: Comprehensive error handling, structured logging, CORS, VPC support
- **Developer Experience**: Hot reload with serverless-offline, testing with Vitest, linting, formatting
- **Serverless Optimized**: Individual function packaging, esbuild bundling, ARM64 architecture
- **Monorepo Architecture**: Turborepo + pnpm workspaces for efficient builds
- **Best Practices**: Repository pattern, service layer, middleware architecture
- **Complete Tooling**: Prettier, Husky, ESLint v9, Git hooks

## Tech Stack

- **Runtime**: Node.js 22.x (ARM64)
- **Language**: TypeScript 5.8.2 (strict mode)
- **Framework**: Serverless Framework v4
- **Databases**: PostgreSQL (Drizzle ORM), DynamoDB
- **Testing**: Vitest with coverage
- **Bundler**: esbuild via serverless-esbuild
- **Package Manager**: pnpm 10.17.1
- **Monorepo**: Turborepo

## Common Commands

```bash
# Development
pnpm run build          # Build all packages
pnpm run dev            # Start local development (from stack directory)
pnpm run test           # Run all tests
pnpm run test:coverage  # Run tests with coverage

# Code Quality
pnpm run lint           # Lint all code
pnpm run format         # Format all code
pnpm run format:check   # Check formatting
pnpm run type-check     # TypeScript type checking

# Database (PostgreSQL)
pnpm run db:generate    # Generate migrations from schema changes
pnpm run db:migrate     # Run pending migrations
pnpm run db:studio      # Open Drizzle Studio (visual database editor)

# Deployment
./scripts/deploy.sh dev api-users        # Deploy single stack to dev
./scripts/deploy.sh prod                 # Deploy all stacks to production

# Utilities
pnpm run clean          # Clean all build artifacts
```

## Project Structure

```
serverless-ts-template/
├── .husky/                           # Git hooks (pre-commit)
├── .vscode/                          # VSCode workspace settings
├── drizzle/migrations/               # PostgreSQL migrations
├── packages/
│   ├── ts-configs/                   # Shared TypeScript config
│   ├── contracts/                    # Schemas & types
│   │   ├── src/
│   │   │   ├── tables/              # Drizzle table definitions
│   │   │   ├── schemas/             # Zod validation schemas
│   │   │   └── types/               # Shared TypeScript types
│   └── libs/                         # Core utilities
│       ├── src/
│       │   ├── aws/                 # S3, Lambda, SSM clients
│       │   ├── db/
│       │   │   ├── dynamo/          # DynamoDB client wrapper
│       │   │   └── postgres/        # Drizzle client
│       │   ├── errors/              # CustomError, error handlers
│       │   ├── functions/           # Lambda function builders
│       │   ├── http/                # API utilities, Middy middleware
│       │   └── utils/               # Logger, pagination
├── stacks/
│   ├── api-users/                    # PostgreSQL service example
│   ├── api-orders/                   # DynamoDB service example
│   └── scheduled-tasks/              # Scheduled functions example
└── scripts/
    └── deploy.sh                     # Deployment automation
```

## Getting Started

### Prerequisites

- Node.js 22.x or higher
- pnpm 10.17.1 or higher
- PostgreSQL (for local development)
- AWS CLI configured with appropriate credentials

### Installation

1. **Clone or use this template**

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Initialize Git hooks**
   ```bash
   pnpm run prepare
   ```

## Database Setup

### PostgreSQL (Drizzle ORM)

1. **Create a PostgreSQL database**

   ```bash
   createdb template_db
   ```

2. **Generate migrations**

   ```bash
   pnpm run db:generate
   ```

3. **Run migrations**

   ```bash
   pnpm run db:migrate
   ```

4. **Optional: Open Drizzle Studio**
   ```bash
   pnpm run db:studio
   ```

### DynamoDB

For local development, you can use DynamoDB Local:

```bash
docker run -p 8000:8000 amazon/dynamodb-local
```

For production, the DynamoDB tables are created automatically via the serverless.ts resources section.

## Development

### Local Development

Run a specific stack locally with serverless-offline:

```bash
# Users API (PostgreSQL)
cd stacks/api-users
pnpm run dev

# Orders API (DynamoDB)
cd stacks/api-orders
pnpm run dev
```

The API will be available at `http://localhost:3000`.

### Build All Packages

```bash
pnpm run build
```

### Run Tests

```bash
# Run all tests
pnpm run test

# Run tests for a specific stack
cd stacks/api-users
pnpm run test

# Run tests with coverage
pnpm run test:coverage
```

### Linting & Formatting

```bash
# Lint all code
pnpm run lint

# Format all code
pnpm run format

# Check formatting
pnpm run format:check
```

## Deployment

### Prerequisites

1. **Configure AWS SSM Parameters** (for production):
   ```bash
   aws ssm put-parameter --name "/prod/app/database-url" --value "postgresql://..." --type "SecureString"
   aws ssm put-parameter --name "/prod/app/security-group-id" --value "sg-..." --type "String"
   aws ssm put-parameter --name "/prod/app/subnet-1" --value "subnet-..." --type "String"
   aws ssm put-parameter --name "/prod/app/subnet-2" --value "subnet-..." --type "String"
   ```

### Deploy to AWS

**Deploy all stacks:**

```bash
./scripts/deploy.sh prod
```

**Deploy specific stack:**

```bash
./scripts/deploy.sh prod api-users
```

**Deploy to dev environment:**

```bash
./scripts/deploy.sh dev api-users
```

## Adding New Features

### Creating a New API Endpoint

1. **Define the schema** in `packages/contracts/src/schemas/`
2. **Create the handler** in `stacks/[stack-name]/src/functions/[endpoint-name]/handler.ts`
3. **Add business logic** in `stacks/[stack-name]/src/services/`
4. **Add data access** in `stacks/[stack-name]/src/repository/`
5. **Register the function** in `stacks/[stack-name]/src/functions/index.ts`

### Adding a New Database Table (PostgreSQL)

1. **Define the table schema** in `packages/contracts/src/tables/[table-name].ts`
2. **Export from** `packages/contracts/src/tables/index.ts`
3. **Generate migration**: `pnpm run db:generate`
4. **Run migration**: `pnpm run db:migrate`

### Adding a New Stack

1. **Create directory**: `stacks/[stack-name]/`
2. **Copy structure** from existing stack (api-users or api-orders)
3. **Update** `serverless.ts` with your service name and functions
4. **Add scripts** in package.json

## Best Practices

### Error Handling

Use custom error classes for proper HTTP status codes:

```typescript
import { CustomError, NotFoundError, ValidationError } from '@template/libs';

// 404 Not Found
throw new NotFoundError('User not found');

// 400 Bad Request
throw new ValidationError('Invalid email format');

// Custom status code
throw new CustomError('Custom error message', 409);
```

### Logging

Use the structured logger:

```typescript
import { logger } from '@template/libs';

logger.info('Operation completed', { userId: '123' });
logger.warn('Deprecated endpoint used');
logger.error('Failed to process request', error);
```

### Type Safety

- Always use Zod schemas for request validation
- Leverage Drizzle's type inference for database operations
- Use strict TypeScript configuration

### Database Operations

**PostgreSQL (Drizzle):**

```typescript
import { db } from '@template/libs';
import { users } from '@template/contracts';
import { eq } from 'drizzle-orm';

// Insert
const [user] = await db.insert(users).values(userData).returning();

// Select
const user = await db.select().from(users).where(eq(users.id, userId));

// Update
const [updated] = await db.update(users).set(data).where(eq(users.id, userId)).returning();
```

**DynamoDB:**

```typescript
import { createRecord, queryRecords, getRecordByKey } from '@template/libs';

// Create
await createRecord({ tableName: 'orders', item: orderData });

// Query
const { items } = await queryRecords({
  tableName: 'orders',
  queryRequest: { pKey: userId, pKeyProp: 'userId' }
});

// Get
const record = await getRecordByKey({ tableName: 'orders', key: { orderId } });
```

### Lambda Function Builders

Use the function builders for consistent configuration:

```typescript
import { createUserAuthApiFunc, createDefaultFunction } from '@template/libs';

// API with user auth
export const myFunction = createUserAuthApiFunc({
  dir: __dirname,
  fnName: 'my-function/handler.myHandler',
  http: { method: 'post', path: '/v1/resource' }
});

// Scheduled function
export const scheduledFunc = createDefaultFunction({
  dir: __dirname,
  fnName: 'scheduled/handler.scheduledHandler',
  other: { timeout: 60 }
});
```

## Architecture Patterns

### Three-Layer Architecture

1. **Handler Layer** (`functions/*/handler.ts`)
   - Validates request input using Zod schemas
   - Delegates to service layer
   - Returns formatted responses

2. **Service Layer** (`services/*.service.ts`)
   - Contains business logic
   - Coordinates between repositories
   - Handles business rules and validations

3. **Repository Layer** (`repository/*.repository.ts`)
   - Direct database access
   - Abstracts data storage implementation
   - Returns typed entities

### Middleware with Middy

The template uses Middy for Lambda middleware:

```typescript
export const handler = createHttpHandler<RequestSchema>(async (event) => {
  // Automatic JSON body parsing
  // Automatic error handling
  // Formatted responses
  return { data: result };
});
```

## Testing

Example test structure:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createUser } from './user.service';

describe('User Service', () => {
  beforeEach(() => {
    // Setup test data
  });

  it('should create a user', async () => {
    const user = await createUser({ email: 'test@example.com', firstName: 'John', lastName: 'Doe' });
    expect(user.email).toBe('test@example.com');
  });
});
```

## Environment Variables

### Local Development (.env)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/template_db
AWS_REGION=ap-southeast-1
NODE_ENV=development
LOG_LEVEL=info
```

### Production (AWS SSM)

Store sensitive values in AWS Systems Manager Parameter Store:

- `/${stage}/app/database-url` - PostgreSQL connection string
- `/${stage}/app/security-group-id` - VPC security group
- `/${stage}/app/subnet-1` - VPC subnet 1
- `/${stage}/app/subnet-2` - VPC subnet 2

## Monorepo Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run all tests
pnpm run test

# Lint all code
pnpm run lint

# Format all code
pnpm run format

# Clean build artifacts
pnpm run clean

# Database operations
pnpm run db:generate   # Generate migrations
pnpm run db:migrate    # Run migrations
pnpm run db:studio     # Open Drizzle Studio
```

## Troubleshooting

### Build Errors

If you encounter TypeScript errors, ensure all dependencies are installed:

```bash
pnpm install
pnpm run build
```

### Database Connection Issues

- Verify `DATABASE_URL` is set correctly in `.env`
- Check PostgreSQL is running: `pg_isready`
- For Lambda: Ensure VPC configuration and security groups allow database access

### Deployment Failures

- Verify AWS credentials: `aws sts get-caller-identity`
- Check SSM parameters exist: `aws ssm get-parameter --name "/prod/app/database-url"`
- Review CloudFormation stack events in AWS Console

## Performance Optimization

- **Cold Starts**: Template uses ARM64 architecture and minimal dependencies for faster cold starts
- **Connection Pooling**: PostgreSQL client uses max: 1 connection for Lambda
- **Individual Packaging**: Each function is packaged separately to minimize bundle size
- **esbuild**: Fast TypeScript compilation and tree-shaking

## Security

- **VPC Integration**: Lambda functions can run in VPC for database access
- **IAM Roles**: Minimal permissions following least privilege principle
- **Secrets Management**: Use AWS SSM Parameter Store for sensitive values
- **CORS**: Configured in API Gateway responses
- **Input Validation**: Zod schemas validate all incoming requests

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `pnpm run test`
4. Run linting: `pnpm run lint`
5. Format code: `pnpm run format`
6. Commit (pre-commit hooks will run automatically)

## License

MIT

## Support

For issues or questions, please open an issue in the repository.
