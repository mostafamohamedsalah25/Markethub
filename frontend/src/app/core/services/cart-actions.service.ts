import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OrdersService } from './orders.service';
import { AuthService } from './auth';
import { UiService } from './ui.service';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CartActionsService {
  private ordersService = inject(OrdersService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private uiService = inject(UiService);

  addToCart(product: Product, quantity = 1, returnUrl?: string): void {
    if (product.stock <= 0) {
      this.uiService.showInfo('This product is out of stock.');
      return;
    }

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: returnUrl ?? this.router.url },
      });
      return;
    }

    this.ordersService.addToCart(product.id, quantity).subscribe({
      next: () => this.uiService.showInfo('Added to cart!'),
      error: (err) => {
        if (err.status === 401) {
          this.router.navigate(['/auth/login'], {
            queryParams: { returnUrl: returnUrl ?? this.router.url },
          });
          return;
        }
        const msg = err.error?.error || 'Could not add to cart.';
        this.uiService.showInfo(msg);
      },
    });
  }
}
