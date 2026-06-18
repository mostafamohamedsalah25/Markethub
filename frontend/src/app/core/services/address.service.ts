import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserAddress {
  id: string;
  address_title: string;
  recipient_name: string;
  recipient_phone: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UserAddressService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/addresses/`;

  getAddresses(): Observable<UserAddress[]> {
    return this.http.get<UserAddress[]>(this.apiUrl);
  }

  getAddress(id: string): Observable<UserAddress> {
    return this.http.get<UserAddress>(`${this.apiUrl}${id}/`);
  }

  createAddress(address: Partial<UserAddress>): Observable<UserAddress> {
    return this.http.post<UserAddress>(this.apiUrl, address);
  }

  updateAddress(id: string, address: Partial<UserAddress>): Observable<UserAddress> {
    return this.http.patch<UserAddress>(`${this.apiUrl}${id}/`, address);
  }

  deleteAddress(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }

  setDefaultAddress(id: string): Observable<UserAddress> {
    return this.http.post<UserAddress>(`${this.apiUrl}${id}/set_default/`, {});
  }
}
