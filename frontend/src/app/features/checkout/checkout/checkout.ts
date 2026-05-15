import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { OrdersService, Cart, CartItem } from '../../../core/services/orders.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private uiService = inject(UiService);

  cart: Cart | null = null;
  shippingAddress = '';
  contactPhone = '';
  loading = true;
  processing = false;

  ngOnInit(): void {
    this.loading = true;
    this.ordersService.getCart().subscribe({
      next: (data) => {
        this.cart = data;
        this.loading = false;
        this.cdr.markForCheck();
        if (!this.cart?.items.length) {
          this.router.navigate(['/cart']);
        }
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
        this.router.navigate(['/cart']);
      },
    });
  }

  lineTotal(item: CartItem): string {
    const price = Number(item.product_details?.discount_price || item.product_details?.price || 0);
    return (item.quantity * price).toFixed(2);
  }

  placeOrder(): void {
    if (!this.shippingAddress.trim() || !this.contactPhone.trim()) {
      this.uiService.showInfo('Please fill in shipping address and phone.');
      return;
    }

    this.processing = true;
    this.cdr.markForCheck();
    this.ordersService.checkout(this.shippingAddress.trim(), this.contactPhone.trim()).subscribe({
      next: () => {
        this.processing = false;
        this.uiService.showInfo('Order placed successfully!');
        this.router.navigate(['/my-orders']);
      },
      error: (err) => {
        this.processing = false;
        this.cdr.markForCheck();
        const msg = err.error?.error || err.error?.detail || 'Could not place order.';
        this.uiService.showInfo(typeof msg === 'string' ? msg : JSON.stringify(msg));
      },
    });
  }
}
