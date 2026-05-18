import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';

import { OrdersService } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';
import { ProductService } from '../../../core/services/product.service';

@Component({
  selector: 'app-seller-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './seller-overview.html',
  styleUrl: './seller-overview.scss',
})
export class SellerOverviewComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  private productService = inject(ProductService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orderCount = signal(0);
  readonly productCount = signal(0);
  readonly revenue = signal(0);
  readonly paidCount = signal(0);
  readonly pendingPayments = signal(0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      orders: this.ordersService.getSellerOrders(),
      payments: this.paymentService.getHistory(),
      products: this.productService.getSellerProducts(),
    }).subscribe({
      next: ({ orders, payments, products }) => {
        this.orderCount.set(orders.length);
        const plist = Array.isArray(products) ? products : (products as { results?: unknown[] }).results ?? [];
        this.productCount.set(plist.length);
        const mine = new Set(orders.map((o) => o.id));
        const relevant = payments.filter((p) => mine.has(p.order_id));
        const ok = relevant.filter((p) => p.status === 'succeeded');
        const rev = ok.reduce((s, p) => s + parseFloat(p.amount || '0'), 0);
        this.revenue.set(Math.round(rev * 100) / 100);
        this.paidCount.set(ok.length);
        this.pendingPayments.set(relevant.filter((p) => p.status === 'pending' || p.status === 'processing').length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load seller dashboard.');
        this.loading.set(false);
      },
    });
  }
}
