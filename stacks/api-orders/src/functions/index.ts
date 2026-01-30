import { createUserAuthApiFunc } from '@template/libs';

export const ORDER_FUNCTIONS = {
  createOrder: createUserAuthApiFunc({
    dir: __dirname,
    fnName: 'create-order/handler.createOrderHandler',
    http: { method: 'post', path: '/v1/orders' }
  }),
  getOrders: createUserAuthApiFunc({
    dir: __dirname,
    fnName: 'get-orders/handler.getOrdersHandler',
    http: { method: 'get', path: '/v1/orders/{userId}' }
  })
};
