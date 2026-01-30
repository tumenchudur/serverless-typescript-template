import { describe, it, expect } from 'vitest';
import { createCognitoAuthorizer, createUserAuthConfig, createAdminAuthConfig } from './auth-config';

describe('auth-config', () => {
  const testUserPoolArn = 'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_ABC123';
  const testAdminPoolArn = 'arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_XYZ789';

  describe('createCognitoAuthorizer', () => {
    it('should create Cognito authorizer configuration', () => {
      const authorizer = createCognitoAuthorizer('test-authorizer', testUserPoolArn);

      expect(authorizer).toEqual({
        name: 'test-authorizer',
        arn: testUserPoolArn,
        type: 'COGNITO_USER_POOLS'
      });
    });
  });

  describe('createUserAuthConfig', () => {
    it('should create user auth config with default settings', () => {
      const config = createUserAuthConfig(testUserPoolArn);

      expect(config.authorizer).toEqual({
        name: 'user-authorizer',
        arn: testUserPoolArn,
        type: 'COGNITO_USER_POOLS'
      });

      expect(config.cors).toEqual({
        origin: '*',
        headers: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token']
      });
    });

    it('should create user auth config with custom authorizer name', () => {
      const config = createUserAuthConfig(testUserPoolArn, {
        authorizerName: 'my-users'
      });

      expect(config.authorizer.name).toBe('my-users');
    });

    it('should create user auth config with custom CORS', () => {
      const config = createUserAuthConfig(testUserPoolArn, {
        cors: {
          origin: 'https://app.example.com',
          headers: ['Content-Type', 'Authorization'],
          allowCredentials: true
        }
      });

      expect(config.cors).toEqual({
        origin: 'https://app.example.com',
        headers: ['Content-Type', 'Authorization'],
        allowCredentials: true
      });
    });
  });

  describe('createAdminAuthConfig', () => {
    it('should create admin auth config with default settings', () => {
      const config = createAdminAuthConfig(testAdminPoolArn);

      expect(config.authorizer).toEqual({
        name: 'admin-authorizer',
        arn: testAdminPoolArn,
        type: 'COGNITO_USER_POOLS'
      });

      expect(config.cors).toEqual({
        origin: '*',
        headers: ['Content-Type', 'Authorization', 'Permission', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token']
      });
    });

    it('should include Permission header in CORS', () => {
      const config = createAdminAuthConfig(testAdminPoolArn);

      expect(config.cors?.headers).toContain('Permission');
    });

    it('should create admin auth config with custom authorizer name', () => {
      const config = createAdminAuthConfig(testAdminPoolArn, {
        authorizerName: 'my-admins'
      });

      expect(config.authorizer.name).toBe('my-admins');
    });

    it('should create admin auth config with custom CORS', () => {
      const config = createAdminAuthConfig(testAdminPoolArn, {
        cors: {
          origin: 'https://admin.example.com',
          headers: ['Content-Type', 'Authorization', 'Permission', 'X-Custom-Header']
        }
      });

      expect(config.cors).toEqual({
        origin: 'https://admin.example.com',
        headers: ['Content-Type', 'Authorization', 'Permission', 'X-Custom-Header']
      });
    });
  });
});
