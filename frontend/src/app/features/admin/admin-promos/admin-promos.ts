import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { PromoCode } from '../../../core/models/promo.model';
import { PromoService } from '../../../core/services/promo.service';
import { UiService } from '../../../core/services/ui.service';
import {
  AdminPromoFormDialogComponent,
  AdminPromoFormDialogData,
} from '../admin-promo-form-dialog/admin-promo-form-dialog';

@Component({
  selector: 'app-admin-promos',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSlideToggleModule,
  ],
  templateUrl: './admin-promos.html',
  styleUrl: './admin-promos.scss',
})
export class AdminPromosComponent implements OnInit {
  private promoService = inject(PromoService);
  private dialog = inject(MatDialog);
  private ui = inject(UiService);

  readonly displayedColumns: string[] = [
    'code',
    'type',
    'value',
    'active',
    'usage',
    'min',
    'actions',
  ];

  readonly loading = signal(true);
  readonly promos = signal<PromoCode[]>([]);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.promoService.list().subscribe({
      next: (rows) => {
        this.promos.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.ui.showInfo('Failed to load promo codes.');
      },
    });
  }

  pagedPromos(): PromoCode[] {
    const start = this.pageIndex() * this.pageSize();
    return this.promos().slice(start, start + this.pageSize());
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  openCreate(): void {
    this.openForm({ promo: null });
  }

  edit(promo: PromoCode): void {
    this.openForm({ promo });
  }

  private openForm(data: AdminPromoFormDialogData): void {
    this.dialog
      .open(AdminPromoFormDialogComponent, {
        width: '520px',
        data,
        disableClose: true,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.load();
          this.ui.showInfo('Promo saved.');
        }
      });
  }

  toggleActive(promo: PromoCode, active: boolean): void {
    this.promoService.update(promo.id, { is_active: active }).subscribe({
      next: (updated) => {
        this.promos.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
        this.ui.showInfo(active ? 'Promo activated.' : 'Promo deactivated.');
      },
      error: () => this.ui.showInfo('Update failed.'),
    });
  }

  remove(promo: PromoCode): void {
    if (!confirm(`Delete promo ${promo.code}?`)) return;
    this.promoService.delete(promo.id).subscribe({
      next: () => {
        this.promos.update((list) => list.filter((p) => p.id !== promo.id));
        this.ui.showInfo('Promo deleted.');
      },
      error: () => this.ui.showInfo('Delete failed.'),
    });
  }
}
