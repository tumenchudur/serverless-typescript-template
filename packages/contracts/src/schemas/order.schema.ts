import { z } from 'zod';

export const CreateOrderRequestSchema = z.object({
  userId: z.string().uuid(),
  productId: z.string(),
  quantity: z.number().int().positive(),
  totalAmount: z.number().positive()
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export interface Order {
  orderId: string;
  userId: string;
  productId: string;
  quantity: number;
  totalAmount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}
