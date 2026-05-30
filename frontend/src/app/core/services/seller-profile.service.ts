import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SellerProfileStats {
    store_name: string;
    description: string;
    total_products: number;
    total_sales: number;
    average_rating: number;
    total_orders: number;
}

@Injectable({
    providedIn: 'root'
})
export class SellerProfileService {
    private http = inject(HttpClient);
    private apiUrl = `${environment.apiUrl}/seller-profiles/`;

    getProfile(id: string | number): Observable<SellerProfileStats | { data: SellerProfileStats }> {
        return this.http.get<SellerProfileStats | { data: SellerProfileStats }>(`${this.apiUrl}${id}/`);
    }

    updateProfile(id: string | number, profileData: Partial<SellerProfileStats>): Observable<SellerProfileStats> {
        return this.http.patch<SellerProfileStats>(`${this.apiUrl}${id}/`, profileData);
    }
}
