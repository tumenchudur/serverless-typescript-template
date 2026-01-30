import { createHttpHandler } from '@template/libs';
import { getUser } from '../../services/user.service';

export const getUserHandler = createHttpHandler<null>(async (event) => {
  const userId = event.pathParameters?.['userId'];

  if (!userId) {
    throw new Error('userId is required');
  }

  const user = await getUser(userId);

  return {
    message: 'User retrieved successfully',
    data: user
  };
});
