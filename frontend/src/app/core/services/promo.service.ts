import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';
import { PromoCode, PromoPayload } from '../models/promo.model';

@Injectable({ providedIn: 'root' })
export class PromoService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/promos`;

  list(): Observable<PromoCode[]> {
    return this.http.get<ApiEnvelope<{ results: PromoCode[] }>>(`${this.base}/`).pipe(
      map((res) => res.data?.results ?? []),
    );
  }

  create(payload: PromoPayload): Observable<PromoCode> {
    return this.http.post<ApiEnvelope<PromoCode>>(`${this.base}/`, payload).pipe(map((res) => res.data));
  }

  update(id: number, partial: Partial<PromoPayload>): Observable<PromoCode> {
    return this.http.patch<ApiEnvelope<PromoCode>>(`${this.base}/${id}/`, partial).pipe(map((res) => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<ApiEnvelope<unknown>>(`${this.base}/${id}/`).pipe(map(() => undefined));
  }
}
