export interface Item {
  id: string;
  name: string;
  price: number;
  priority: 'low' | 'medium' | 'high';
  createdAt: number;
  cooldownUntil: number;
  status: 'cooling' | 'bought' | 'canceled';
}
