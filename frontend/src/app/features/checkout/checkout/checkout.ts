import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { OrdersService, Cart, CartItem, Order } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout.html',
})
export class CheckoutComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private uiService = inject(UiService);

  cart: Cart | null = null;
  shippingAddress = '';
  streetAddress = '';
  city = '';
  postalCode = '';
  country = 'Egypt';
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
    const addressParts = [this.streetAddress, this.city, this.postalCode, this.country].filter(Boolean);
    const combinedAddress = addressParts.join(', ');

    if (!combinedAddress.trim() || !this.contactPhone.trim()) {
      this.uiService.showInfo('Please fill in your shipping address and phone number.');
      return;
    }
    this.shippingAddress = combinedAddress;

    this.processing = true;
    this.cdr.markForCheck();
    
    this.ordersService.checkout(this.shippingAddress.trim(), this.contactPhone.trim()).subscribe({
      next: (orders) => {
        this.processing = false;
        this.cdr.markForCheck();
        if (!orders?.length) {
          this.uiService.showInfo('No orders were created.');
          return;
        }
        if (orders.length > 1) {
          sessionStorage.setItem(
            'pending_order_ids',
            JSON.stringify(orders.slice(1).map((o) => o.id)),
          );
        }
        this.startPayment(orders[0]);
      },
      error: (err) => {
        this.processing = false;
        this.cdr.markForCheck();
        const msg = err.error?.error || err.error?.detail || 'Could not place order.';
        this.uiService.showInfo(typeof msg === 'string' ? msg : JSON.stringify(msg));
      },
    });
  }

  private startPayment(order: Order): void {
    this.processing = true;
    this.cdr.markForCheck();
    
    this.paymentService.createIntent(order.id).subscribe({
      next: (payment) => {
        this.processing = false;
        this.cdr.markForCheck();
        if (payment.checkout_url) {
          this.paymentService.startPayment(payment);
          return;
        }
        this.router.navigate(['/payment/mock'], {
          queryParams: { payment_id: payment.id, client_secret: payment.client_secret },
        });
      },
      error: (err) => {
        this.processing = false;
        this.cdr.markForCheck();
        const msg = err.error?.message || 'Could not start payment. Please try paying from My Orders.';
        this.uiService.showInfo(msg);
        this.router.navigate(['/my-orders']);
      },
    });
  }
}