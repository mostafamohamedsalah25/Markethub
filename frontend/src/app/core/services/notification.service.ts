import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Notification {
    id: number;
    message: string;
    notification_type: string;
    is_read: boolean;
    created_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/notifications/`;

    private _notifications = signal<Notification[]>([]);
    notifications = this._notifications.asReadonly();

    unreadCount = computed(() =>
        this._notifications().filter(n => !n.is_read).length
    );

    fetchNotifications(): void {
        this.getNotifications().subscribe({
            next: (res: any) => {
                const data = res.data || res;
                const results = Array.isArray(data) ? data : (data.results || []);
                this._notifications.set(results);
            }
        });
    }

    getNotifications(): Observable<any> {
        return this.http.get<any>(this.apiUrl);
    }

    markAsRead(id: number): Observable<any> {
        // Optimistic Update: Update signals locally before the API responds
        this._notifications.update(list =>
            list.map(n => n.id === id ? { ...n, is_read: true } : n)
        );

        return this.http.post(`${this.apiUrl}${id}/mark_as_read/`, {}).pipe(
            tap(() => { /* API success */ })
        );
    }

    markAllAsRead(): Observable<any> {
        // Optimistic Update: Update all signals locally before the API responds
        this._notifications.update(list =>
            list.map(n => ({ ...n, is_read: true }))
        );

        return this.http.post(`${this.apiUrl}mark_all_as_read/`, {}).pipe(
            tap(() => { /* API success */ })
        );
    }
}
