import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import { Product } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';
import { ConfigService } from '../../../core/services/config';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating';
import { PrimaryImagePipe } from '../../../shared/pipes/primary-image-pipe';
import { CartActionsService } from '../../../core/services/cart-actions.service';
import { WishlistService } from '../../../core/services/wishlist.service';
import { ReviewService, ProductReview } from '../../../core/services/review.service';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent, StarRatingComponent, FormsModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  public authService = inject(AuthService);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private cartActions = inject(CartActionsService);
  private configService = inject(ConfigService);
  private wishlistService = inject(WishlistService);
  private reviewService = inject(ReviewService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private primaryImagePipe = new PrimaryImagePipe();

  product: Product | null = null;
  relatedProducts: Product[] = [];
  quantity = 1;
  selectedImageUrl = '';
  categoryName = '';
  categorySlug = '';

  isLoading = true;
  hasError = false;
  notFound = false;

  // Wishlist state
  reviews: ProductReview[] = [];
  isLoadingReviews = false;

  // New Review Form
  newRating = 5;
  newComment = '';
  isSubmittingReview = false;

  isAuthenticated = this.authService.isAuthenticated;

  private routeSub!: Subscription;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) {
        this.loadProduct(slug);
      } else {
        this.notFound = true;
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }

  loadProduct(slug: string): void {
    this.isLoading = true;
    this.hasError = false;
    this.notFound = false;
    this.product = null;
    this.relatedProducts = [];
    this.quantity = 1;

    this.productService.getProductBySlug(slug).subscribe({
      next: (product: Product) => {
        this.product = product;
        this.selectedImageUrl = this.primaryImagePipe.transform(product.images);
        this.resolveCategory(product.category);
        this.loadReviews(product.id);
        if (this.authService.isAuthenticated()) {
          this.wishlistService.loadWishlist();
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        if (err.status === 404) {
          this.notFound = true;
        } else {
          this.hasError = true;
        }
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadReviews(productId: number): void {
    this.isLoadingReviews = true;
    this.reviewService.getReviews(productId).subscribe({
      next: (res: any) => {
        this.reviews = Array.isArray(res) ? res : (res.results || []);
        this.isLoadingReviews = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingReviews = false;
        this.cdr.markForCheck();
      }
    });
  }

  isInWishlist = computed(() => this.product ? this.wishlistService.isWishlisted(this.product.id) : false);

  toggleWishlist(): void {
    if (!this.product) return;

    if (!this.authService.isAuthenticated()) {
      this.snackBar.open('Please login to manage your wishlist', 'Login', { duration: 3000 });
      return;
    }

    if (this.isInWishlist()) {
      this.wishlistService.removeFromWishlistByProductId(this.product.id).subscribe({
        next: () => {
          this.snackBar.open('Removed from wishlist', 'OK', { duration: 2000 });
          this.cdr.markForCheck();
        },
        error: () => {
          this.snackBar.open('Failed to remove from wishlist', 'OK', { duration: 2000 });
        }
      });
    } else {
      this.wishlistService.addToWishlist(this.product.id).subscribe({
        next: () => {
          this.snackBar.open('Added to wishlist', 'OK', { duration: 2000 });
          this.cdr.markForCheck();
        },
        error: () => {
          this.snackBar.open('Failed to add to wishlist', 'OK', { duration: 2000 });
        }
      });
    }
  }

  submitReview(): void {
    if (!this.product || !this.newComment.trim()) return;

    this.isSubmittingReview = true;
    this.reviewService.createReview({
      product: this.product.id,
      rating: this.newRating,
      comment: this.newComment
    }).subscribe({
      next: (review) => {
        this.reviews = [review, ...this.reviews];
        this.newComment = '';
        this.newRating = 5;
        this.isSubmittingReview = false;

        // Refresh product stats (average rating)
        if (this.product) {
          this.loadProduct(this.product.slug);
        }

        this.snackBar.open('Review submitted successfully!', 'OK', { duration: 2000 });
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        const message = err.error?.detail || err.error?.message || 'Failed to submit review';
        this.snackBar.open(message, 'OK', { duration: 3000 });
        this.isSubmittingReview = false;
        this.cdr.markForCheck();
      }
    });
  }

  setRating(rating: number): void {
    this.newRating = rating;
  }

  resolveCategory(categoryId: number): void {
    this.categoryService.getCategories().subscribe({
      next: (res: any) => {
        const categories = Array.isArray(res) ? res : (res.results || []);
        const cat = categories.find((c: Category) => c.id === categoryId);
        if (cat) {
          this.categoryName = cat.name;
          this.categorySlug = cat.slug;
          this.loadRelatedProducts(cat.slug);
        }
        this.cdr.markForCheck();
      }
    });
  }

  loadRelatedProducts(categorySlug: string): void {
    this.productService.getProducts({ category: categorySlug }).subscribe({
      next: (res: any) => {
        const products = Array.isArray(res) ? res : (res.results || []);
        this.relatedProducts = products
          .filter((p: Product) => p.id !== this.product?.id)
          .slice(0, 4);
        this.cdr.markForCheck();
      }
    });
  }

  increaseQty(): void {
    if (this.product && this.quantity < this.product.stock) {
      this.quantity++;
    }
  }

  decreaseQty(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  selectImage(url: string): void {
    this.selectedImageUrl = url;
  }

  addToCart(): void {
    if (!this.product) return;
    this.cartActions.addToCart(this.product, this.quantity);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.configService.catalogConfig.placeholders.productImage;
  }
}
