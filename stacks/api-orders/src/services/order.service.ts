import type { CreateOrderRequest } from '@template/contracts';
import { createOrderInDb, getOrdersByUserId } from '../repository/order.repository';

export async function createOrder(request: CreateOrderRequest) {
  return await createOrderInDb(request);
}

export async function getUserOrders(userId: string) {
  return await getOrdersByUserId(userId);
}
