import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { PaymentRecord } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/payments`;

  getHistory(): Observable<PaymentRecord[]> {
    return this.http.get<ApiEnvelope<{ results: PaymentRecord[] }>>(`${this.base}/history/`).pipe(
      map((res) => res.data?.results ?? []),
    );
  }

  createIntent(orderId: number): Observable<PaymentRecord> {
    return this.http
      .post<ApiEnvelope<PaymentRecord>>(`${this.base}/create-intent/`, { order_id: orderId })
      .pipe(map((res) => res.data));
  }

  verify(
    paymentId: number,
    clientSecret: string,
    simulateOutcome?: 'succeeded' | 'failed' | 'processing' | 'pending' | 'random',
  ): Observable<PaymentRecord> {
    const body: Record<string, unknown> = {
      payment_id: paymentId,
      client_secret: clientSecret,
    };
    if (simulateOutcome) {
      body['simulate_outcome'] = simulateOutcome;
    }
    return this.http.post<ApiEnvelope<PaymentRecord>>(`${this.base}/verify/`, body).pipe(map((res) => res.data));
  }
}
