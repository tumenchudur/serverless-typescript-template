import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser, getUser } from './user.service';
import * as userRepository from '../repository/user.repository';
import { ValidationError, NotFoundError } from '@template/libs';

vi.mock('../repository/user.repository');

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      const mockUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'ACTIVE',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(userRepository.getUserByEmail).mockResolvedValue(undefined);
      vi.mocked(userRepository.createUserInDb).mockResolvedValue(mockUser);

      const result = await createUser({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      expect(result).toEqual(mockUser);
      expect(userRepository.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userRepository.createUserInDb).toHaveBeenCalled();
    });

    it('should throw ValidationError if user already exists', async () => {
      vi.mocked(userRepository.getUserByEmail).mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'ACTIVE',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await expect(
        createUser({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe'
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getUser', () => {
    it('should return a user by id', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        status: 'ACTIVE',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      vi.mocked(userRepository.getUserById).mockResolvedValue(mockUser);

      const result = await getUser('123');

      expect(result).toEqual(mockUser);
      expect(userRepository.getUserById).toHaveBeenCalledWith('123');
    });

    it('should throw NotFoundError if user does not exist', async () => {
      vi.mocked(userRepository.getUserById).mockResolvedValue(undefined);

      await expect(getUser('123')).rejects.toThrow(NotFoundError);
    });
  });
});
