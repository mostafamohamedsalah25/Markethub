export type Role = 'customer' | 'seller' | 'admin';

export interface SellerProfile {
  store_name: string;
  description: string | null;
  is_approved: boolean;
  balance: string;
}

export interface User {
  id: string;
  email: string;
  phone: string | null;
  role: Role;
  is_verified: boolean;
  created_at: string;
  seller_profile?: SellerProfile | null;
}

export interface AuthResponse {
  status: string;
  message: string;
  data: {
    access: string;
    refresh: string;
    user: {
      email: string;
      role: Role;
      is_new?: boolean;
    };
  };
}
