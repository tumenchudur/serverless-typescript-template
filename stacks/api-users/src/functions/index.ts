import { createUserAuthApiFunc } from '@template/libs';

export const USER_FUNCTIONS = {
  createUser: createUserAuthApiFunc({
    dir: __dirname,
    fnName: 'create-user/handler.createUserHandler',
    http: { method: 'post', path: '/v1/users' }
  }),
  getUser: createUserAuthApiFunc({
    dir: __dirname,
    fnName: 'get-user/handler.getUserHandler',
    http: { method: 'get', path: '/v1/users/{userId}' }
  })
};
