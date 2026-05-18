import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PaymentRecord, PaymentStatus, PaymentProvider } from '../../../core/models/payment.model';
import { PaymentService } from '../../../core/services/payment.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatPaginatorModule,
    MatTooltipModule,
  ],
  templateUrl: './admin-payments.html',
  styleUrl: './admin-payments.scss',
})
export class AdminPaymentsComponent implements OnInit {
  private paymentService = inject(PaymentService);
  private ui = inject(UiService);

  readonly statusFilter = signal<PaymentStatus | 'all'>('all');
  readonly providerFilter = signal<PaymentProvider | 'all'>('all');
  readonly searchOrderId = signal('');

  readonly loading = signal(true);
  readonly rows = signal<PaymentRecord[]>([]);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(15);

  readonly displayedColumns: string[] = [
    'id',
    'order',
    'buyer',
    'seller',
    'amount',
    'provider',
    'status',
    'paid_at',
  ];

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

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  statusChipClass(status: string): string {
    const map: Record<string, string> = {
      succeeded: 'bg-emerald-100 text-emerald-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-amber-100 text-amber-900',
      processing: 'bg-blue-100 text-blue-800',
      refunded: 'bg-slate-200 text-slate-800',
    };
    return map[status] ?? 'bg-slate-100 text-slate-700';
  }
}
