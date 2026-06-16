import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface WishlistItem {
    id: number;
    product: any;
    product_details?: any; // <-- السطر ده اللي كان ناقص
    created_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class WishlistService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/products/wishlist/`;

    private _items = signal<WishlistItem[]>([]);
    items = this._items.asReadonly();

    // Set of product IDs in wishlist for fast lookup
    wishlistedProductIds = computed(() =>
        new Set(this._items().map(item => item.product.id || item.product))
    );

    loadWishlist(): void {
        this.getWishlist().subscribe({
            next: (res: any) => {
                const results = Array.isArray(res) ? res : (res.results || []);
                this._items.set(results);
            }
        });
    }

    getWishlist(): Observable<WishlistItem[] | { results: WishlistItem[] }> {
        return this.http.get<WishlistItem[] | { results: WishlistItem[] }>(this.apiUrl);
    }

    addToWishlist(productId: string | number): Observable<WishlistItem> {
        return this.http.post<WishlistItem>(this.apiUrl, { product: productId }).pipe(
            tap(newItem => {
                this._items.update(list => [...list, newItem]);
            })
        );
    }

    removeFromWishlist(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}${id}/`).pipe(
            tap(() => {
                this._items.update(list => list.filter(item => item.id !== id));
            })
        );
    }

    removeFromWishlistByProductId(productId: number): Observable<void> {
        const item = this._items().find(i => (i.product.id || i.product) === productId);
        if (item) {
            return this.removeFromWishlist(item.id);
        }
        return new Observable(obs => obs.error('Item not in wishlist'));
    }

    isWishlisted(productId: number): boolean {
        return this.wishlistedProductIds().has(productId);
    }

    getWishlistId(productId: number): number | null {
        const item = this._items().find(i => (i.product.id || i.product) === productId);
        return item ? item.id : null;
    }
}