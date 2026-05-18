import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

import { OrdersService, Order } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PaymentRecord } from '../../../core/models/payment.model';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-seller-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatIconModule,
  ],
  templateUrl: './seller-orders.html',
  styleUrl: './seller-orders.scss',
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

  readonly displayedColumns = computed(() => {
    const base = ['id', 'customer', 'items', 'total', 'payment', 'date', 'status'];
    if (this.isAdmin()) {
      return ['id', 'seller', 'customer', 'items', 'total', 'payment', 'date', 'status'];
    }
    return base;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      orders: this.ordersService.getSellerOrders(),
      payments: this.paymentService.getHistory(),
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
    if (!p) return 'text-slate-400';
    const map: Record<string, string> = {
      succeeded: 'text-emerald-700 font-semibold',
      failed: 'text-red-600 font-semibold',
      pending: 'text-amber-700',
      processing: 'text-blue-700',
      refunded: 'text-slate-600',
    };
    return map[p.status] ?? 'text-slate-700';
  }

  itemsSummary(order: Order): string {
    if (!order.items?.length) return '—';
    return order.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ');
  }

  updateStatus(order: Order, newStatus: string): void {
    if (newStatus === order.status) return;
    this.ordersService.updateOrderStatus(order.id, newStatus).subscribe({
      next: (updated) => {
        this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
        this.ui.showInfo('Order status updated.');
      },
      error: () => this.ui.showInfo('Failed to update order.'),
    });
  }
}
