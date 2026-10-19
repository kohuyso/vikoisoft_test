export interface OrderItem {
  product_id: number;
  quantity: number;
}

export type OrderStatus =
  'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export interface OrderEntity {
  id: number;
  user_id: number;
  items: OrderItem[];
  note?: string;
  total_items: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}
