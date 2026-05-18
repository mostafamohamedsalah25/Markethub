import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models/api-envelope.model';

/** Minimal shape for admin user listing (backend may return additional fields). */
export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  is_active?: boolean;
  is_verified?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  listUsers(): Observable<AdminUserRow[]> {
    return this.http.get<ApiEnvelope<AdminUserRow[]>>(`${this.base}/admin/users/`).pipe(
      map((res) => (Array.isArray(res.data) ? res.data : [])),
    );
  }
}
