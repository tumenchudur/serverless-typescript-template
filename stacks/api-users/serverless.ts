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
      DATABASE_URL: '${ssm:/${self:provider.stage}/app/database-url}',
      LOG_LEVEL: 'info'
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
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers': "'*'"
          }
        }
      },
      GatewayResponseDefault5XX: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
          ResponseType: 'DEFAULT_5XX',
          RestApiId: { Ref: 'ApiGatewayRestApi' },
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers': "'*'"
          }
        }
      }
    }
  }
};

export default serverlessConfig;
