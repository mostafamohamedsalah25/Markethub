import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, MatDialogModule, FormsModule],
  templateUrl: './admin-promos.html',
  styleUrl: './admin-promos.scss',
})
export class AdminPromosComponent implements OnInit {
  private promoService = inject(PromoService);
  private dialog = inject(MatDialog);
  private ui = inject(UiService);

  readonly loading = signal(true);
  readonly promos = signal<PromoCode[]>([]);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [5, 10, 25];

  readonly pagedPromos = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.promos().slice(start, start + this.pageSize());
  });
  
  readonly totalPages = computed(() => Math.ceil(this.promos().length / this.pageSize()));
  readonly Math = Math; // To use Math.min in template

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

  goToPage(index: number): void {
    if (index >= 0 && index < this.totalPages()) this.pageIndex.set(index);
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(0);
  }

  openCreate(): void {
    this.openForm({ promo: null });
  }

  edit(promo: PromoCode): void {
    this.openForm({ promo });
  }

  private openForm(data: AdminPromoFormDialogData): void {
    // Customizing the dialog wrapper via panelClass to make it blend with Tailwind
    this.dialog.open(AdminPromoFormDialogComponent, {
        width: '520px',
        data,
        disableClose: true,
        panelClass: 'custom-tailwind-dialog'
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.load();
          this.ui.showInfo('Promo saved.');
        }
      });
  }

  toggleActive(promo: PromoCode, event: Event): void {
    const active = (event.target as HTMLInputElement).checked;
    this.promoService.update(promo.id, { is_active: active }).subscribe({
      next: (updated) => {
        this.promos.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
        this.ui.showInfo(active ? 'Promo activated.' : 'Promo deactivated.');
      },
      error: () => {
        (event.target as HTMLInputElement).checked = !active; // Revert UI on fail
        this.ui.showInfo('Update failed.');
      },
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