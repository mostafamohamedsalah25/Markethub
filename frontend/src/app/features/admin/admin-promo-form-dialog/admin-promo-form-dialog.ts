import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { PromoCode, PromoDiscountType } from '../../../core/models/promo.model';
import { PromoService } from '../../../core/services/promo.service';
import { UiService } from '../../../core/services/ui.service';

export interface AdminPromoFormDialogData {
  promo: PromoCode | null;
}

@Component({
  selector: 'app-admin-promo-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-promo-form-dialog.html',
})
export class AdminPromoFormDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<AdminPromoFormDialogComponent>);
  private promoService = inject(PromoService);
  private ui = inject(UiService);
  readonly data = inject<AdminPromoFormDialogData>(MAT_DIALOG_DATA);

  readonly isEdit = !!this.data.promo;
  saving = false;

  form = this.fb.nonNullable.group({
    code: [this.data.promo?.code ?? '', [Validators.required, Validators.maxLength(64)]],
    discount_type: [this.data.promo?.discount_type ?? 'percentage', Validators.required],
    value: [this.data.promo?.value ?? '', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    is_active: [this.data.promo?.is_active ?? true],
    max_uses: [this.data.promo?.max_uses != null ? String(this.data.promo.max_uses) : ''],
    minimum_order_amount: [this.data.promo?.minimum_order_amount ?? '0', Validators.required],
    starts_at: [this.data.promo?.starts_at ? this.data.promo.starts_at.slice(0, 16) : ''],
    expires_at: [this.data.promo?.expires_at ? this.data.promo.expires_at.slice(0, 16) : ''],
  });

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const value = this.toNumberOrNull(v.value);
    const minimumOrderAmount = this.toNumberOrNull(v.minimum_order_amount);
    const maxUses = this.toNumberOrNull(v.max_uses);

    if (value === null || minimumOrderAmount === null) {
      this.ui.showInfo('Please enter valid numeric values.');
      return;
    }

    const payload = {
      code: v.code.trim(),
      discount_type: v.discount_type as PromoDiscountType,
      value,
      is_active: v.is_active,
      max_uses: maxUses,
      minimum_order_amount: minimumOrderAmount,
      starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : null,
      expires_at: v.expires_at ? new Date(v.expires_at).toISOString() : null,
    };

    if (payload.discount_type === 'percentage' && payload.value > 100) {
      this.ui.showInfo('Percentage cannot exceed 100.');
      return;
    }

    this.saving = true;
    const req = this.isEdit && this.data.promo
      ? this.promoService.update(this.data.promo.id, payload)
      : this.promoService.create(payload);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
        this.ui.showInfo('Could not save promo. Check the form and try again.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
