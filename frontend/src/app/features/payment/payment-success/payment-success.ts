import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PaymentService } from '../../../core/services/payment.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-payment-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment-success.html',
})
export class PaymentSuccessComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private paymentService = inject(PaymentService);
  private ui = inject(UiService);

  readonly loading = signal(true);
  readonly success = signal(false);
  readonly message = signal('Confirming your secure payment...');

  ngOnInit(): void {
    const paymentId = Number(this.route.snapshot.queryParamMap.get('payment_id'));
    const sessionId = this.route.snapshot.queryParamMap.get('session_id') || '';

    if (!paymentId) {
      this.loading.set(false);
      this.message.set('Missing payment reference.');
      return;
    }

    this.paymentService.verify(paymentId, '', undefined, sessionId || undefined).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        this.message.set('Your payment was successful. We are preparing your order!');
        this.clearPendingOrders();
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.message || 'Payment confirmation failed. It may still process shortly.';
        this.message.set(msg);
        this.ui.showInfo(msg);
      },
    });
  }

  private clearPendingOrders(): void {
    sessionStorage.removeItem('pending_order_ids');
  }
}
