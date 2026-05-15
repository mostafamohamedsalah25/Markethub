import { Component, Input, HostBinding, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Product } from '../../../core/models/product.model';
import { ConfigService } from '../../../core/services/config';
import { PrimaryImagePipe } from '../../../shared/pipes/primary-image-pipe';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating';
import { CartActionsService } from '../../../core/services/cart-actions.service';
import { UiService } from '../../../core/services/ui.service';

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

  @HostBinding('class') get hostClasses() {
    return 'block cursor-pointer group';
  }

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
  }

  toggleWishlist(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.uiService.showComingSoon('Wishlist');
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.configService.catalogConfig.placeholders.productImage;
  }
}
