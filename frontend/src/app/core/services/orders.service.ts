import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CartItem {
  id: number;
  product: number;
  product_details: any;
  quantity: number;
}

export interface Cart {
  id: number;
  items: CartItem[];
  total_price: string;
}

export interface OrderItem {
  id: number;
  product_details: any;
  product_name: string;
  price: string;
  quantity: number;
}

export interface Order {
  id: number;
  seller_name: string;
  buyer_email: string;
  status: string;
  total_amount: string;
  shipping_address: string;
  contact_phone: string;
  created_at: string;
  items: OrderItem[];
}

@Injectable({
  providedIn: 'root'
})
export class OrdersService {
  private apiUrl = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  getCart(): Observable<Cart> {
    return this.http.get<Cart>(`${this.apiUrl}/cart/`);
  }

  addToCart(productId: number, quantity: number = 1): Observable<Cart> {
    return this.http.post<Cart>(`${this.apiUrl}/cart/items/`, { product: productId, quantity });
  }

  updateCartItem(itemId: number, quantity: number): Observable<CartItem> {
    return this.http.patch<CartItem>(`${this.apiUrl}/cart/items/${itemId}/quantity/`, { quantity });
  }

  removeCartItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/cart/items/${itemId}/`);
  }

  checkout(shippingAddress: string, contactPhone: string): Observable<Order[]> {
    return this.http.post<Order[]>(`${this.apiUrl}/checkout/`, { shipping_address: shippingAddress, contact_phone: contactPhone });
  }

  getBuyerOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/my-orders/`);
  }

  getSellerOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/seller-orders/`);
  }

  updateOrderStatus(orderId: number, status: string): Observable<Order> {
    return this.http.patch<Order>(`${this.apiUrl}/seller-orders/${orderId}/status/`, { status });
  }
}
