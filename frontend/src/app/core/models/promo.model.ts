export type PromoDiscountType = 'percentage' | 'fixed';

export interface PromoValidationResult {
  valid: boolean;
  code: string;
  discount_amount: string;
  message: string;
  subtotal: string;
  total_after_discount: string;
}

export interface PromoCode {
  id: number;
  code: string;
  discount_type: PromoDiscountType;
  value: string;
  is_active: boolean;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  minimum_order_amount: string;
  created_at: string;
  updated_at: string;
}

export interface PromoPayload {
  code: string;
  discount_type: PromoDiscountType;
  value: number;
  is_active: boolean;
  max_uses?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  minimum_order_amount: number;
}
