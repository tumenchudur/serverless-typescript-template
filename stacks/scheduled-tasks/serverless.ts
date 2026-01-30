import type { AWS } from '@serverless/typescript';
import { SCHEDULED_FUNCTIONS } from './src/functions';

const serverlessConfig: AWS = {
  service: 'template-scheduled-tasks',
  frameworkVersion: '4',
  plugins: ['serverless-prune-plugin', 'serverless-esbuild'],
  provider: {
    name: 'aws',
    stage: "${opt:stage, 'prod'}",
    runtime: 'nodejs22.x',
    region: 'ap-southeast-1',
    architecture: 'arm64',
    timeout: 60,
    memorySize: 512,
    logRetentionInDays: 365,
    environment: {
      STAGE: '${self:provider.stage}',
      REGION: '${self:provider.region}',
      LOG_LEVEL: 'info'
    },
    iam: {
      role: {
        statements: [
          {
            Effect: 'Allow',
            Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            Resource: '*'
          }
        ]
      }
    }
  },
  functions: SCHEDULED_FUNCTIONS,
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
  }
};

export default serverlessConfig;
