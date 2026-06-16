import { Component, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../../../core/models/product.model';
import { ConfigService } from '../../../core/services/config';
import { PrimaryImagePipe } from '../../../shared/pipes/primary-image-pipe';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating';
import { CartActionsService } from '../../../core/services/cart-actions.service';
import { UiService } from '../../../core/services/ui.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { AuthService } from '../../../core/services/auth';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, PrimaryImagePipe, StarRatingComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  
  private cartActions = inject(CartActionsService);
  private uiService = inject(UiService);
  private configService = inject(ConfigService);
  private wishlistService = inject(WishlistService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  isInWishlist = computed(() => this.wishlistService.isWishlisted(this.product.id));

  get hasDiscount(): boolean {
    return !!(
      this.product.discount_price &&
      parseFloat(this.product.discount_price) < parseFloat(this.product.price)
    );
  }

  addToCart(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.cartActions.addToCart(this.product);
    // Optional: Add a subtle toast here confirming addition
  }

  toggleWishlist(event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    if (!this.authService.isAuthenticated()) {
      this.snackBar.open('Please sign in to save items.', 'Sign In', { duration: 4000 })
        .onAction().subscribe(() => {
          // Route to login
        });
      return;
    }

    if (this.isInWishlist()) {
      this.wishlistService.removeFromWishlistByProductId(this.product.id).subscribe({
        next: () => this.snackBar.open('Item removed from wishlist.', 'Dismiss', { duration: 3000 }),
        error: () => this.snackBar.open('Unable to update wishlist.', 'Dismiss', { duration: 3000, panelClass: 'snackbar-error' })
      });
    } else {
      this.wishlistService.addToWishlist(this.product.id).subscribe({
        next: () => this.snackBar.open('Item saved to wishlist.', 'View', { duration: 3000 }),
        error: () => this.snackBar.open('Unable to save item.', 'Dismiss', { duration: 3000, panelClass: 'snackbar-error' })
      });
    }
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.configService.catalogConfig.placeholders.productImage;
  }
}