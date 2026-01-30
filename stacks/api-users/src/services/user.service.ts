import type { CreateUserRequest, UpdateUserRequest } from '@template/contracts';
import { NotFoundError, ValidationError } from '@template/libs';
import { createUserInDb, getUserById, getUserByEmail, updateUserInDb } from '../repository/user.repository';

export async function createUser(request: CreateUserRequest) {
  // Check if user already exists
  const existingUser = await getUserByEmail(request.email);
  if (existingUser) {
    throw new ValidationError('User with this email already exists');
  }

  return await createUserInDb(request);
}

export async function getUser(userId: string) {
  const user = await getUserById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

export async function updateUser(userId: string, request: UpdateUserRequest) {
  const existingUser = await getUserById(userId);
  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await updateUserInDb(userId, request);
  if (!updatedUser) {
    throw new Error('Failed to update user');
  }

  return updatedUser;
}
