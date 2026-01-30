import { createHttpHandler } from '@template/libs';
import { CreateOrderRequestSchema } from '@template/contracts';
import { createOrder } from '../../services/order.service';

export const createOrderHandler = createHttpHandler<null>(async (event) => {
  const request = CreateOrderRequestSchema.parse(event.body);
  const order = await createOrder(request);

  return {
    message: 'Order created successfully',
    data: order
  };
});
