import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { PaymentProvider, PaymentRecord } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/payments`;

  getHistory(): Observable<PaymentRecord[]> {
    return this.http.get<ApiEnvelope<{ results: PaymentRecord[] }>>(`${this.base}/history/`).pipe(
      map((res) => res.data?.results ?? []),
    );
  }

  createIntent(orderId: number, provider: PaymentProvider = 'mock'): Observable<PaymentRecord> {
    return this.http
      .post<ApiEnvelope<PaymentRecord>>(`${this.base}/create-intent/`, {
        order_id: orderId,
        provider,
      })
      .pipe(map((res) => res.data));
  }

  verify(
    paymentId: number,
    clientSecret: string,
    simulateOutcome?: 'succeeded' | 'failed' | 'processing' | 'pending' | 'random',
    sessionId?: string,
  ): Observable<PaymentRecord> {
    const body: Record<string, unknown> = { payment_id: paymentId };
    if (sessionId) {
      body['session_id'] = sessionId;
    } else {
      body['client_secret'] = clientSecret;
    }
    if (simulateOutcome) {
      body['simulate_outcome'] = simulateOutcome;
    }
    return this.http.post<ApiEnvelope<PaymentRecord>>(`${this.base}/verify/`, body).pipe(map((res) => res.data));
  }

  /** Redirect to Stripe Checkout or mock payment page. */
  startPayment(payment: PaymentRecord): void {
    const url = payment.checkout_url?.trim();
    if (url) {
      window.location.href = url;
      return;
    }
  }
}
