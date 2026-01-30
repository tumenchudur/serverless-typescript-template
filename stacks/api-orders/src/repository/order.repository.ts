import { createRecord, queryRecords } from '@template/libs';
import type { Order } from '@template/contracts';
import { randomUUID } from 'crypto';

const ORDERS_TABLE = process.env['ORDERS_TABLE'] || 'orders';

export async function createOrderInDb(
  orderData: Omit<Order, 'orderId' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<Order> {
  const now = new Date().toISOString();
  const order: Order = {
    orderId: randomUUID(),
    ...orderData,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now
  };

  await createRecord({
    tableName: ORDERS_TABLE,
    item: order
  });

  return order;
}

export async function getOrdersByUserId(userId: string): Promise<Order[]> {
  const result = await queryRecords<Order>({
    tableName: ORDERS_TABLE,
    queryRequest: {
      pKey: userId,
      pKeyProp: 'userId'
    }
  });

  return result.items;
}
