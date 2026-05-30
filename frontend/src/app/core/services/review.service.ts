import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ProductReview {
    id: number;
    product: string | number;
    user_email: string;
    rating: number;
    comment: string;
    is_verified_purchase: boolean;
    created_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class ReviewService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/products/reviews/`;

    getReviews(productId?: string | number): Observable<ProductReview[] | { results: ProductReview[] }> {
        let params = new HttpParams();
        if (productId) {
            params = params.append('product', productId.toString());
        }
        return this.http.get<ProductReview[] | { results: ProductReview[] }>(this.apiUrl, { params });
    }

    createReview(review: { product: string | number; rating: number; comment: string }): Observable<ProductReview> {
        return this.http.post<ProductReview>(this.apiUrl, review);
    }

    deleteReview(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}${id}/`);
    }
}
