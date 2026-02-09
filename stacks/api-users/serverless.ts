import type { AWS } from '@serverless/typescript';
import { USER_FUNCTIONS } from './src/functions';

const serverlessConfig: AWS = {
  service: 'template-api-users',
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
      DATABASE_URL: '${ssm:/${self:provider.stage}/app/database-url}',
      CORS_ORIGIN: '${self:custom.corsOrigin.${self:provider.stage}, self:custom.corsOrigin.default}',
      LOG_LEVEL: '${self:custom.logLevel.${self:provider.stage}, self:custom.logLevel.default}'
    },
    vpc: {
      securityGroupIds: ['${ssm:/${self:provider.stage}/app/security-group-id}'],
      subnetIds: ['${ssm:/${self:provider.stage}/app/subnet-1}', '${ssm:/${self:provider.stage}/app/subnet-2}']
    },
    iam: {
      role: {
        statements: [
          {
            Effect: 'Allow',
            Action: ['ec2:CreateNetworkInterface', 'ec2:DescribeNetworkInterfaces', 'ec2:DeleteNetworkInterface'],
            Resource: '*'
          },
          {
            Effect: 'Allow',
            Action: ['ssm:GetParameter'],
            Resource: 'arn:aws:ssm:${self:provider.region}:*:parameter/${self:provider.stage}/app/*'
          }
        ]
      }
    }
  },
  functions: USER_FUNCTIONS,
  package: {
    individually: true
  },
  custom: {
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
