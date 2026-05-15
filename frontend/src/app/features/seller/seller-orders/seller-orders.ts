import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdersService, Order } from '../../../core/services/orders.service';

@Component({
  selector: 'app-seller-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seller-orders.html',
  styleUrl: './seller-orders.scss',
})
export class SellerOrdersComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private cdr = inject(ChangeDetectorRef);

  orders: Order[] = [];
  loading = true;
  statusOptions = ['pending', 'accepted', 'rejected', 'shipped', 'delivered', 'cancelled'];

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.ordersService.getSellerOrders().subscribe({
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

  statusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'status-pending',
      accepted: 'status-accepted',
      rejected: 'status-rejected',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled',
    };
    return map[status] ?? 'status-pending';
  }

  updateStatus(order: Order, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStatus = select.value;
    if (newStatus === order.status) return;

    if (confirm(`Change order #${order.id} to "${newStatus}"?`)) {
      this.ordersService.updateOrderStatus(order.id, newStatus).subscribe({
        next: (updated) => {
          order.status = updated.status;
          this.cdr.markForCheck();
        },
        error: () => {
          select.value = order.status;
          alert('Failed to update status');
        },
      });
    } else {
      select.value = order.status;
    }
  }
}
