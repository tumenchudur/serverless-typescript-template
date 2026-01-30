import { createHttpHandler } from '@template/libs';
import { getUserOrders } from '../../services/order.service';

export const getOrdersHandler = createHttpHandler<null>(async (event) => {
  const userId = event.pathParameters?.['userId'];

  if (!userId) {
    throw new Error('userId is required');
  }

  const orders = await getUserOrders(userId);

  return {
    message: 'Orders retrieved successfully',
    data: orders
  };
});
