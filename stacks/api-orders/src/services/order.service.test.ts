import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrder, getUserOrders } from './order.service';
import * as orderRepository from '../repository/order.repository';

vi.mock('../repository/order.repository');

describe('Order Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order successfully', async () => {
      const mockOrder = {
        orderId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user-123',
        productId: 'product-456',
        quantity: 2,
        totalAmount: 99.99,
        status: 'PENDING' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vi.mocked(orderRepository.createOrderInDb).mockResolvedValue(mockOrder);

      const result = await createOrder({
        userId: 'user-123',
        productId: 'product-456',
        quantity: 2,
        totalAmount: 99.99
      });

      expect(result).toEqual(mockOrder);
      expect(orderRepository.createOrderInDb).toHaveBeenCalled();
    });
  });

  describe('getUserOrders', () => {
    it('should return orders for a user', async () => {
      const mockOrders = [
        {
          orderId: '123',
          userId: 'user-123',
          productId: 'product-456',
          quantity: 2,
          totalAmount: 99.99,
          status: 'PENDING' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      vi.mocked(orderRepository.getOrdersByUserId).mockResolvedValue(mockOrders);

      const result = await getUserOrders('user-123');

      expect(result).toEqual(mockOrders);
      expect(orderRepository.getOrdersByUserId).toHaveBeenCalledWith('user-123');
    });
  });
});
