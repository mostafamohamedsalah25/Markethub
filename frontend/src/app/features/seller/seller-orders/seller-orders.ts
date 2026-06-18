import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { OrdersService, Order } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PaymentRecord } from '../../../core/models/payment.model';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-seller-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seller-orders.html',
})
export class SellerOrdersComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  private ui = inject(UiService);
  readonly router = inject(Router);

  readonly isAdmin = computed(() => this.router.url.startsWith('/admin'));

  readonly loading = signal(true);
  readonly orders = signal<Order[]>([]);
  readonly paymentByOrder = signal<Map<number, PaymentRecord>>(new Map());

  readonly statusOptions = ['pending', 'accepted', 'rejected', 'shipped', 'delivered', 'cancelled'];
  private readonly sellerTransitions: Record<string, string[]> = {
    pending: ['accepted'],
    accepted: ['shipped'],
    shipped: ['delivered'],
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      orders: this.ordersService.getSellerOrders().pipe(catchError(() => of([]))),
      payments: this.paymentService.getHistory().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ orders, payments }) => {
        this.orders.set(orders);
        const byOrder = new Map<number, PaymentRecord[]>();
        for (const p of payments) {
          const list = byOrder.get(p.order_id) ?? [];
          list.push(p);
          byOrder.set(p.order_id, list);
        }
        const map = new Map<number, PaymentRecord>();
        for (const [oid, list] of byOrder) {
          const succeeded = list.find((x) => x.status === 'succeeded');
          if (succeeded) {
            map.set(oid, succeeded);
          } else {
            const latest = [...list].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            )[0];
            map.set(oid, latest);
          }
        }
        this.paymentByOrder.set(map);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.ui.showInfo('Could not load orders.');
      },
    });
  }

  paymentLabel(orderId: number): string {
    const p = this.paymentByOrder().get(orderId);
    if (!p) return '—';
    return p.status;
  }

  paymentClass(orderId: number): string {
    const p = this.paymentByOrder().get(orderId);
    if (!p) return 'text-on-surface-variant font-medium opacity-50';
    const map: Record<string, string> = {
      succeeded: 'text-emerald-600 font-extrabold',
      failed: 'text-error font-extrabold',
      pending: 'text-amber-600 font-extrabold',
      processing: 'text-blue-600 font-extrabold',
      refunded: 'text-on-surface-variant font-bold',
    };
    return map[p.status] ?? 'text-on-surface-variant font-bold';
  }

  orderStatusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200 focus:border-amber-400',
      accepted: 'bg-blue-50 text-blue-700 border-blue-200 focus:border-blue-400',
      rejected: 'bg-red-50 text-red-700 border-red-200 focus:border-red-400',
      shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200 focus:border-indigo-400',
      delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:border-emerald-400',
      cancelled: 'bg-surface-container text-on-surface-variant border-outline focus:border-outline-variant',
    };
    return map[status] ?? 'bg-surface text-on-surface border-outline';
  }

  itemsSummary(order: Order): string {
    if (!order.items?.length) return '—';
    return order.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ');
  }

  availableStatuses(order: Order): string[] {
    if (this.isAdmin()) {
      return this.statusOptions;
    }
    return [order.status, ...(this.sellerTransitions[order.status] ?? [])].filter(
      (value, index, self) => self.indexOf(value) === index,
    );
  }

  updateStatus(order: Order, newStatus: string): void {
    if (newStatus === order.status) return;
    if (!this.isAdmin() && !(this.sellerTransitions[order.status] ?? []).includes(newStatus)) {
      this.ui.showInfo(`Sellers can only move ${order.status} orders to the next valid state.`);
      return;
    }
    this.ordersService.updateOrderStatus(order.id, newStatus).subscribe({
      next: (updated) => {
        this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
        this.ui.showInfo('Order status updated.');
      },
      error: () => this.ui.showInfo('Failed to update order.'),
    });
  }
}
