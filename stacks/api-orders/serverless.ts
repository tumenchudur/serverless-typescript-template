import type { AWS } from '@serverless/typescript';
import { ORDER_FUNCTIONS } from './src/functions';

const serverlessConfig: AWS = {
  service: 'template-api-orders',
  frameworkVersion: '4',
  plugins: ['serverless-offline', 'serverless-prune-plugin', 'serverless-esbuild'],
  provider: {
    name: 'aws',
    stage: "${opt:stage, 'prod'}",
    runtime: 'nodejs22.x',
    region: 'ap-southeast-1',
    architecture: 'arm64',
    timeout: 29,
    memorySize: 256,
    logRetentionInDays: 365,
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
      usagePlan: {
        throttle: {
          burstLimit: 150,
          rateLimit: 100
        }
      }
    },
    environment: {
      STAGE: '${self:provider.stage}',
      REGION: '${self:provider.region}',
      SERVICE_NAME: '${self:service}',
      ORDERS_TABLE: '${self:custom.ordersTableName}',
      CORS_ORIGIN: '${self:custom.corsOrigin.${self:provider.stage}, self:custom.corsOrigin.default}',
      LOG_LEVEL: '${self:custom.logLevel.${self:provider.stage}, self:custom.logLevel.default}'
    },
    iam: {
      role: {
        statements: [
          {
            Effect: 'Allow',
            Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query', 'dynamodb:UpdateItem'],
            Resource: 'arn:aws:dynamodb:${self:provider.region}:*:table/${self:custom.ordersTableName}'
          }
        ]
      }
    }
  },
  functions: ORDER_FUNCTIONS,
  package: {
    individually: true
  },
  custom: {
    ordersTableName: '${self:provider.stage}-orders',
    corsOrigin: {
      dev: '*',
      staging: 'https://staging.example.com',
      prod: 'https://example.com',
      default: '*'
    },
    logLevel: {
      dev: 'debug',
      staging: 'info',
      prod: 'info',
      default: 'info'
    },
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ['aws-sdk'],
      target: 'node22',
      platform: 'node',
      concurrency: 10
    },
    prune: {
      automatic: true,
      number: 2
    }
  },
  resources: {
    Resources: {
      OrdersTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          TableName: '${self:custom.ordersTableName}',
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'orderId', AttributeType: 'S' }
          ],
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'orderId', KeyType: 'RANGE' }
          ],
          StreamSpecification: {
            StreamViewType: 'NEW_AND_OLD_IMAGES'
          }
        }
      },
      GatewayResponseDefault4XX: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
          ResponseType: 'DEFAULT_4XX',
          RestApiId: { Ref: 'ApiGatewayRestApi' },
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin':
              "'${self:custom.corsOrigin.${self:provider.stage}, self:custom.corsOrigin.default}'",
            'gatewayresponse.header.Access-Control-Allow-Headers':
              "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Permission'"
          }
        }
      },
      GatewayResponseDefault5XX: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
          ResponseType: 'DEFAULT_5XX',
          RestApiId: { Ref: 'ApiGatewayRestApi' },
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin':
              "'${self:custom.corsOrigin.${self:provider.stage}, self:custom.corsOrigin.default}'",
            'gatewayresponse.header.Access-Control-Allow-Headers':
              "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Permission'"
          }
        }
      }
    }
  }
};

export default serverlessConfig;
