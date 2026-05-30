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
    private apiUrl = `${environment.apiUrl}/notifications/notifications/`;

    private _notifications = signal<Notification[]>([]);
    notifications = this._notifications.asReadonly();

    unreadCount = computed(() =>
        this._notifications().filter(n => !n.is_read).length
    );

    fetchNotifications(): void {
        this.getNotifications().subscribe({
            next: (res: any) => {
                const results = Array.isArray(res) ? res : (res.results || []);
                this._notifications.set(results);
            }
        });
    }

    getNotifications(): Observable<Notification[] | { results: Notification[] }> {
        return this.http.get<Notification[] | { results: Notification[] }>(this.apiUrl);
    }

    markAsRead(id: number): Observable<any> {
        return this.http.post(`${this.apiUrl}${id}/mark_as_read/`, {}).pipe(
            tap(() => {
                this._notifications.update(list =>
                    list.map(n => n.id === id ? { ...n, is_read: true } : n)
                );
            })
        );
    }

    markAllAsRead(): Observable<any> {
        return this.http.post(`${this.apiUrl}mark_all_as_read/`, {}).pipe(
            tap(() => {
                this._notifications.update(list =>
                    list.map(n => ({ ...n, is_read: true }))
                );
            })
        );
    }
}
