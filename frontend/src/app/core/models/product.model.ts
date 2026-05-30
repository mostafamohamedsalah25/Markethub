export interface ProductImage {
  id: number;
  image: string;
  is_primary: boolean;
  order: number;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  discount_price?: string;
  stock: number;
  is_active: boolean;
  category: number;
  seller: number;
  images: ProductImage[];
  average_rating: number;
  review_count: number;
  created_at: string;
}
