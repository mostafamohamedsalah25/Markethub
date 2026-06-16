import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PaymentService } from '../../../core/services/payment.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-payment-mock',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './payment-mock.html',
})
export class PaymentMockComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private paymentService = inject(PaymentService);
  private ui = inject(UiService);

  paymentId = 0;
  clientSecret = '';
  readonly processing = signal(false);

  ngOnInit(): void {
    this.paymentId = Number(this.route.snapshot.queryParamMap.get('payment_id'));
    this.clientSecret = this.route.snapshot.queryParamMap.get('client_secret') || '';
  }

  confirm(outcome: 'succeeded' | 'failed'): void {
    if (!this.paymentId || !this.clientSecret) {
      this.ui.showInfo('Invalid payment session.');
      return;
    }
    this.processing.set(true);
    this.paymentService.verify(this.paymentId, this.clientSecret, outcome).subscribe({
      next: () => {
        this.processing.set(false);
        if (outcome === 'succeeded') {
          this.ui.showInfo('Payment successful!');
          this.router.navigate(['/my-orders']);
        } else {
          this.ui.showInfo('Payment failed (mock).');
          this.router.navigate(['/my-orders']);
        }
      },
      error: (err) => {
        this.processing.set(false);
        this.ui.showInfo(err.error?.message || 'Verification failed.');
      },
    });
  }
}