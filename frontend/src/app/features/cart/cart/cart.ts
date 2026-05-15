import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { OrdersService, Cart, CartItem } from '../../../core/services/orders.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class CartComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  cart: Cart | null = null;
  loading = true;

  ngOnInit(): void {
    this.loadCart();
  }

  loadCart(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.ordersService.getCart().subscribe({
      next: (data) => {
        this.cart = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  updateQuantity(item: CartItem, change: number): void {
    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
      this.removeItem(item);
      return;
    }

    this.ordersService.updateCartItem(item.id, newQuantity).subscribe({
      next: () => this.loadCart(),
      error: (err) => alert(err.error?.error || 'Error updating quantity'),
    });
  }

  removeItem(item: CartItem): void {
    if (confirm('Are you sure you want to remove this item?')) {
      this.ordersService.removeCartItem(item.id).subscribe({
        next: () => this.loadCart(),
        error: () => alert('Error removing item'),
      });
    }
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  lineTotal(item: CartItem): string {
    const price = Number(item.product_details?.discount_price || item.product_details?.price || 0);
    return (item.quantity * price).toFixed(2);
  }
}
