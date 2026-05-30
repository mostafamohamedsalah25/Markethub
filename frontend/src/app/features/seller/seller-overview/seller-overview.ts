import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';

import { ProductService } from '../../../core/services/product.service';
import { SellerProfileService } from '../../../core/services/seller-profile.service';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-seller-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './seller-overview.html',
  styleUrl: './seller-overview.scss',
})
export class SellerOverviewComponent implements OnInit {
  private sellerProfileService = inject(SellerProfileService);
  private authService = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly orderCount = signal(0);
  readonly productCount = signal(0);
  readonly salesCount = signal(0);
  readonly averageRating = signal(0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const user = this.authService.currentUser();
    const profileId = user?.seller_profile?.id;

    if (!profileId) {
      this.error.set('Seller profile not found.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.sellerProfileService.getProfile(profileId).subscribe({
      next: (res: any) => {
        const stats = res.data || res;
        this.productCount.set(stats.total_products);
        this.orderCount.set(stats.total_orders);
        this.salesCount.set(stats.total_sales);
        this.averageRating.set(stats.average_rating);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load seller dashboard.');
        this.loading.set(false);
      },
    });
  }
}
