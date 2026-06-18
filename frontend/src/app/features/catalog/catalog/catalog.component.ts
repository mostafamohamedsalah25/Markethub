import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import { Product } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';
import { UiService } from '../../../core/services/ui.service';
import { CartActionsService } from '../../../core/services/cart-actions.service';
import { ConfigService } from '../../../core/services/config';
import { PrimaryImagePipe } from '../../../shared/pipes/primary-image-pipe';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating';
import { WishlistService } from '../../../core/services/wishlist.service';
import { AuthService } from '../../../core/services/auth';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ProductCardComponent,
    PrimaryImagePipe,
    StarRatingComponent
  ],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private uiService = inject(UiService);
  private cartActions = inject(CartActionsService);
  private configService = inject(ConfigService);
  private wishlistService = inject(WishlistService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  isWishlisted(productId: number) {
    return this.wishlistService.isWishlisted(productId);
  }

  toggleWishlist(event: Event, product: Product): void {
    event.stopPropagation();
    event.preventDefault();

    if (!this.authService.isAuthenticated()) {
      this.snackBar.open('Please login to manage your wishlist', 'Login', { duration: 3000 });
      return;
    }

    if (this.isWishlisted(product.id)) {
      this.wishlistService.removeFromWishlistByProductId(product.id).subscribe({
        next: () => this.snackBar.open('Removed from wishlist', 'OK', { duration: 2000 }),
        error: () => this.snackBar.open('Failed to remove from wishlist', 'OK', { duration: 2000 })
      });
    } else {
      this.wishlistService.addToWishlist(product.id).subscribe({
        next: () => this.snackBar.open('Added to wishlist', 'OK', { duration: 2000 }),
        error: () => this.snackBar.open('Failed to add to wishlist', 'OK', { duration: 2000 })
      });
    }
  }

  filtersOpen = {
    categories: true,
    price: true,
    availability: true,
    rating: false
  };

  readonly ratingFilters = [
    { value: 5, label: '5 Stars' },
    { value: 4, label: '4 Stars & Up' },
    { value: 3, label: '3 Stars & Up' },
    { value: 2, label: '2 Stars & Up' },
  ];

  toggleFilter(section: 'categories' | 'price' | 'availability' | 'rating'): void {
    this.filtersOpen[section] = !this.filtersOpen[section];
  }

  // Filter state
  searchTerm = '';
  selectedCategory: string | null = null;
  minPrice: number | null = null;
  maxPrice: number | null = null;
  minRating: number | null = null;
  availability: boolean | null = null;
  ordering = this.configService.catalogConfig.defaultOrdering;

  // UI state
  products: Product[] = [];
  categories: Category[] = [];
  isLoading = false;
  hasError = false;
  viewMode: 'grid' | 'list' = 'grid';
  catalogView: 'all' | 'categories' = 'all';

  // Pagination
  page = 1;
  pageSize = this.configService.catalogConfig.defaultPageSize;
  totalCount = 0;
  totalPages = 0;
  readonly pageSizeOptions = [12, 24, 48];

  // Subscriptions
  private searchSubject = new Subject<string>();
  private routeSub!: Subscription;
  private searchSub!: Subscription;

  // Computed helpers for "Showing X - Y of Z"
  get showingFrom(): number {
    return this.totalCount === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }
  get showingTo(): number {
    return Math.min(this.page * this.pageSize, this.totalCount);
  }

  ngOnInit(): void {
    this.fetchCategories();

    this.searchSub = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(term => {
      this.updateUrlParams({ search: term || null, page: null });
    });

    this.routeSub = this.route.queryParams.subscribe(params => {
      this.catalogView = params['view'] === 'categories' ? 'categories' : 'all';
      this.searchTerm = params['search'] || '';
      this.selectedCategory = params['category'] || null;
      this.minPrice = params['min_price'] ? +params['min_price'] : null;
      this.maxPrice = params['max_price'] ? +params['max_price'] : null;
      this.minRating = params['min_rating'] ? +params['min_rating'] : null;
      this.availability = params['availability'] === 'true' ? true : null;
      this.ordering = params['ordering'] || '-created_at';
      this.page = params['page'] ? +params['page'] : 1;
      this.pageSize = params['page_size'] ? +params['page_size'] : this.configService.catalogConfig.defaultPageSize;

      if (this.catalogView === 'all') {
        this.fetchProducts();
      } else {
        this.isLoading = false;
        this.products = [];
      }

      if (this.authService.isAuthenticated()) {
        this.wishlistService.loadWishlist();
      }

      this.cdr.markForCheck();
    });
  }

  addToCart(event: Event, product: Product): void {
    event.stopPropagation();
    event.preventDefault();
    this.cartActions.addToCart(product);
  }

  browseCategory(slug: string): void {
    this.router.navigate(['/catalog'], { queryParams: { view: 'all', category: slug } });
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.searchSub) this.searchSub.unsubscribe();
  }

  fetchCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : (res.results || []);
        this.cdr.markForCheck();
      },
      error: (err: any) => console.error('Failed to load categories', err)
    });
  }

  fetchProducts(): void {
    this.isLoading = true;
    this.hasError = false;

    const params: any = {
      ordering: this.ordering,
      page: this.page,
      page_size: this.pageSize
    };

    if (this.searchTerm) params.search = this.searchTerm;
    if (this.selectedCategory) params.category = this.selectedCategory;
    if (this.minPrice !== null) params.min_price = this.minPrice;
    if (this.maxPrice !== null) params.max_price = this.maxPrice;
    if (this.minRating !== null) params.min_rating = this.minRating;
    if (this.availability !== null) params.availability = this.availability;

    this.productService.getProducts(params).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          // Flat array response (no pagination from backend)
          this.totalCount = res.length;

          const startIndex = (this.page - 1) * this.pageSize;
          const endIndex = startIndex + this.pageSize;
          this.products = res.slice(startIndex, endIndex);
        } else {
          // DRF paginated response: { count, next, previous, results }
          this.products = res.results || [];
          this.totalCount = res.count || 0;
        }
        this.totalPages = Math.ceil(this.totalCount / this.pageSize);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Failed to load products', err);
        this.hasError = true;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearchChange(term: string): void {
    this.searchSubject.next(term);
  }

  onCategorySelect(categorySlug: string | null): void {
    this.updateUrlParams({ category: categorySlug, page: null });
  }

  onPriceChange(): void {
    this.updateUrlParams({
      min_price: this.minPrice,
      max_price: this.maxPrice,
      page: null
    });
  }

  onRatingChange(rating: number | null): void {
    this.updateUrlParams({
      min_rating: rating,
      page: null
    });
  }

  onAvailabilityChange(): void {
    this.updateUrlParams({
      availability: this.availability ? 'true' : null,
      page: null
    });
  }

  onOrderingChange(): void {
    this.updateUrlParams({ ordering: this.ordering, page: null });
  }

  clearAllFilters(): void {
    this.router.navigate(['/catalog']);
  }

  // --- Pagination ---

  goToPage(pageNum: number): void {
    if (pageNum < 1 || pageNum > this.totalPages || pageNum === this.page) return;
    this.updateUrlParams({ page: pageNum });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onPageSizeChange(newSize: number): void {
    this.updateUrlParams({ page_size: newSize, page: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Returns an array of page numbers and ellipsis markers for the pagination bar.
   * Always shows first, last, current, and neighbors. Uses -1 for ellipsis.
   */
  getVisiblePages(): number[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    const current = this.page;

    // Always show page 1
    pages.push(1);

    if (current > 3) {
      pages.push(-1); // left ellipsis
    }

    // Pages around current
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (current < total - 2) {
      pages.push(-1); // right ellipsis
    }

    // Always show last page
    pages.push(total);

    return pages;
  }

  showComingSoon(feature: string): void {
    this.uiService.showComingSoon(feature);
  }

  private updateUrlParams(params: any): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge'
    });
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.configService.catalogConfig.placeholders.productImage;
  }
}
