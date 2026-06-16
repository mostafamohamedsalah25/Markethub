import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { PaymentRecord } from '../../../core/models/payment.model';
import { OrdersService, Order } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';

interface MonthBucket {
  label: string;
  total: number;
}

@Component({
  selector: 'app-seller-revenue',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './seller-revenue.html',
})
export class SellerRevenueComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly payments = signal<PaymentRecord[]>([]);
  readonly orders = signal<Order[]>([]);

  readonly recentPayments = computed(() =>
    [...this.payments()]
      .filter((p) => p.status === 'succeeded')
      .sort((a, b) => (a.paid_at && b.paid_at ? b.paid_at.localeCompare(a.paid_at) : 0))
      .slice(0, 8),
  );

  readonly monthBuckets = computed(() => this.buildBuckets(this.payments(), this.orders()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      orders: this.ordersService.getSellerOrders().pipe(catchError(() => of([]))),
      payments: this.paymentService.getHistory().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ orders, payments }) => {
        this.orders.set(orders);
        const mine = new Set(orders.map((o) => o.id));
        this.payments.set(payments.filter((p) => mine.has(p.order_id)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load revenue data. Please check your connection.');
        this.loading.set(false);
      },
    });
  }

  private buildBuckets(payments: PaymentRecord[], orders: Order[]): MonthBucket[] {
    const mine = new Set(orders.map((o) => o.id));
    const succeeded = payments.filter(
      (p) => p.status === 'succeeded' && mine.has(p.order_id) && p.paid_at,
    );
    const map = new Map<string, number>();
    for (const p of succeeded) {
      const d = new Date(p.paid_at as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) ?? 0) + parseFloat(p.amount || '0'));
    }
    const keys = [...map.keys()].sort();
    return keys.map((k) => {
      const [y, m] = k.split('-');
      const label = new Date(parseInt(y, 10), parseInt(m, 10) - 1).toLocaleString('default', {
        month: 'short',
        year: 'numeric',
      });
      return { label, total: Math.round((map.get(k) ?? 0) * 100) / 100 };
    });
  }

  barWidth(bucket: MonthBucket): number {
    const buckets = this.monthBuckets();
    const max = Math.max(...buckets.map((b) => b.total), 1);
    return Math.round((bucket.total / max) * 100);
  }
}