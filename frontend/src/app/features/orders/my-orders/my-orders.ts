import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { OrdersService, Order } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PaymentRecord } from '../../../core/models/payment.model';
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
  paymentByOrder = new Map<number, PaymentRecord>();
  loading = true;

  ngOnInit(): void {
    this.loading = true;
    forkJoin({
      orders: this.ordersService.getBuyerOrders().pipe(catchError(() => of([]))),
      payments: this.paymentService.getHistory().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ orders, payments }) => {
        this.orders = orders;
        const map = new Map<number, PaymentRecord>();
        for (const payment of payments) {
          const existing = map.get(payment.order_id);
          if (!existing || new Date(payment.created_at).getTime() > new Date(existing.created_at).getTime()) {
            map.set(payment.order_id, payment);
          }
        }
        this.paymentByOrder = map;
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

  paymentForOrder(orderId: number): PaymentRecord | undefined {
    return this.paymentByOrder.get(orderId);
  }

  hasActivePayment(orderId: number): boolean {
    const payment = this.paymentForOrder(orderId);
    return !!payment && ['pending', 'processing', 'succeeded'].includes(payment.status);
  }

  canPay(order: Order): boolean {
    return order.status === 'pending' && !this.hasActivePayment(order.id);
  }

  canCancel(order: Order): boolean {
    return order.status === 'pending' && !this.hasActivePayment(order.id);
  }

  cancelOrder(order: Order): void {
    this.payingOrderId = order.id;
    this.ordersService.cancelOrder(order.id).subscribe({
      next: (updated) => {
        this.orders = this.orders.map((o) => (o.id === updated.id ? updated : o));
        this.paymentByOrder.delete(order.id);
        this.payingOrderId = null;
        this.ui.showInfo('Order cancelled.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.payingOrderId = null;
        this.ui.showInfo(err.error?.error || 'Could not cancel order.');
        this.cdr.markForCheck();
      },
    });
  }

  payOrder(order: Order): void {
    this.payingOrderId = order.id;
    this.paymentService.createIntent(order.id, 'stripe').subscribe({
      next: (payment) => {
        this.payingOrderId = null;
        this.paymentByOrder.set(order.id, payment);
        this.cdr.markForCheck();
        if (payment.status === 'succeeded') {
          this.ui.showInfo('Payment completed successfully.');
          this.cdr.markForCheck();
          return;
        }
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
