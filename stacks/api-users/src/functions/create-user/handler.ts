import { createHttpHandler } from '@template/libs';
import { CreateUserRequestSchema } from '@template/contracts';
import { createUser } from '../../services/user.service';

export const createUserHandler = createHttpHandler<null>(async (event) => {
  const request = CreateUserRequestSchema.parse(event.body);
  const user = await createUser(request);

  return {
    message: 'User created successfully',
    data: user
  };
});
