import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { OrdersService, Order } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './my-orders.html',
})
export class MyOrdersComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  private router = inject(Router);
  private ui = inject(UiService);
  private cdr = inject(ChangeDetectorRef);

  payingOrderId: number | null = null;
  orders: Order[] = [];
  loading = true;

  ngOnInit(): void {
    this.loading = true;
    this.ordersService.getBuyerOrders().subscribe({
      next: (data) => {
        this.orders = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // Updated to use Premium Tailwind colors
  statusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-600 border-amber-200',
      accepted: 'bg-blue-50 text-blue-600 border-blue-200',
      rejected: 'bg-red-50 text-red-600 border-red-200',
      shipped: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      delivered: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
    };
    return map[status] ?? 'bg-surface-container-highest text-on-surface-variant border-outline';
  }

  payOrder(order: Order): void {
    this.payingOrderId = order.id;
    this.paymentService.createIntent(order.id).subscribe({
      next: (payment) => {
        this.payingOrderId = null;
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
        this.payingOrderId = null;
        this.cdr.markForCheck();
        this.ui.showInfo(err.error?.message || 'Could not start payment.');
      },
    });
  }
}