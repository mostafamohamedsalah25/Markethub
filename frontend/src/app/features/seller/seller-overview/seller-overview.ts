import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ProductService } from '../../../core/services/product.service';
import { SellerProfileService } from '../../../core/services/seller-profile.service';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-seller-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './seller-overview.html',
})
export class SellerOverviewComponent {
  private sellerProfileService = inject(SellerProfileService);
  private authService = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orderCount = signal(0);
  readonly productCount = signal(0);
  readonly salesCount = signal(0);
  readonly averageRating = signal(0);

  constructor() {
    // السحر هنا: effect بيراقب أي تغيير في بيانات اليوزر ويشتغل لوحده
    effect(() => {
      const user = this.authService.currentUser();
      
      if (user) {
        if (user.seller_profile?.id) {
          // أول ما يلاقي الـ ID بيحمل البيانات تلقائياً
          this.load(user.seller_profile.id);
        } else {
          // لو اليوزر موجود بس مش بائع
          this.error.set('Seller profile not found. Please contact support.');
          this.loading.set(false);
        }
      }
    }, { allowSignalWrites: true }); // ضرورية عشان نقدر نعدل في الـ loading signal جوه الـ effect
  }

  // مسحنا الـ ngOnInit وعدلنا الـ load عشان تستقبل الـ ID مباشرة
  load(profileId?: string | number): void {
    const idToLoad = profileId || this.authService.currentUser()?.seller_profile?.id;
    
    if (!idToLoad) return;

    this.loading.set(true);
    this.error.set(null);

    this.sellerProfileService.getProfile(idToLoad).subscribe({
      next: (res: any) => {
        const stats = res.data || res;
        this.productCount.set(stats.total_products);
        this.orderCount.set(stats.total_orders);
        this.salesCount.set(stats.total_sales);
        this.averageRating.set(stats.average_rating);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load seller dashboard metrics.');
        this.loading.set(false);
      },
    });
  }
}