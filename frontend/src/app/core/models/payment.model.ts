export type PaymentProvider = 'mock' | 'stripe';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';

export interface PaymentRecord {
  id: number;
  order_id: number;
  buyer_email: string;
  seller_name: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: string;
  currency: string;
  transaction_id: string | null;
  client_secret: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}
