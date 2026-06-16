import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PaymentRecord, PaymentStatus, PaymentProvider } from '../../../core/models/payment.model';
import { PaymentService } from '../../../core/services/payment.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-payments.html',
  styleUrl: './admin-payments.scss',
})
export class AdminPaymentsComponent implements OnInit {
  private paymentService = inject(PaymentService);
  private ui = inject(UiService);

  readonly Math = Math;
  readonly statusFilter = signal<PaymentStatus | 'all'>('all');
  readonly providerFilter = signal<PaymentProvider | 'all'>('all');
  readonly searchOrderId = signal('');

  readonly loading = signal(true);
  readonly rows = signal<PaymentRecord[]>([]);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(15);
  readonly pageSizeOptions = [10, 15, 50];

  readonly filtered = computed(() => {
    let list = this.rows();
    const st = this.statusFilter();
    if (st !== 'all') list = list.filter((p) => p.status === st);
    const pr = this.providerFilter();
    if (pr !== 'all') list = list.filter((p) => p.provider === pr);
    const q = this.searchOrderId().trim();
    if (q) list = list.filter((p) => String(p.order_id).includes(q));
    return list;
  });

  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.paymentService.getHistory().subscribe({
      next: (data) => {
        this.rows.set(data);
        this.pageIndex.set(0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.ui.showInfo('Could not load payments.');
      },
    });
  }

  goToPage(index: number): void {
    if (index >= 0 && index < this.totalPages()) {
      this.pageIndex.set(index);
    }
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(0);
  }

  statusChipClass(status: string): string {
    const map: Record<string, string> = {
      succeeded: 'bg-emerald-100/80 text-emerald-700 border-emerald-200',
      failed: 'bg-red-100/80 text-red-700 border-red-200',
      pending: 'bg-amber-100/80 text-amber-700 border-amber-200',
      processing: 'bg-blue-100/80 text-blue-700 border-blue-200',
      refunded: 'bg-slate-200/80 text-slate-700 border-slate-300',
    };
    return map[status] ?? 'bg-surface-container-highest text-on-surface-variant border-outline';
  }
}