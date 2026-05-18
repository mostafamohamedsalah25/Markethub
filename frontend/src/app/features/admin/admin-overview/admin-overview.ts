import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';

import { AdminApiService } from '../../../core/services/admin-api.service';
import { OrdersService } from '../../../core/services/orders.service';
import { PaymentService } from '../../../core/services/payment.service';
import { PromoService } from '../../../core/services/promo.service';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './admin-overview.html',
  styleUrl: './admin-overview.scss',
})
export class AdminOverviewComponent implements OnInit {
  private adminApi = inject(AdminApiService);
  private ordersService = inject(OrdersService);
  private paymentService = inject(PaymentService);
  private promoService = inject(PromoService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly userCount = signal(0);
  readonly orderCount = signal(0);
  readonly revenue = signal(0);
  readonly paymentSuccess = signal(0);
  readonly paymentFailed = signal(0);
  readonly promoActive = signal(0);
  readonly promoTotal = signal(0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      users: this.adminApi.listUsers(),
      orders: this.ordersService.getSellerOrders(),
      payments: this.paymentService.getHistory(),
      promos: this.promoService.list(),
    }).subscribe({
      next: ({ users, orders, payments, promos }) => {
        this.userCount.set(users.length);
        this.orderCount.set(orders.length);
        const succeeded = payments.filter((p) => p.status === 'succeeded');
        const rev = succeeded.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);
        this.revenue.set(Math.round(rev * 100) / 100);
        this.paymentSuccess.set(succeeded.length);
        this.paymentFailed.set(payments.filter((p) => p.status === 'failed').length);
        this.promoTotal.set(promos.length);
        this.promoActive.set(promos.filter((p) => p.is_active).length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load dashboard metrics. Check your connection or permissions.');
        this.loading.set(false);
      },
    });
  }
}
