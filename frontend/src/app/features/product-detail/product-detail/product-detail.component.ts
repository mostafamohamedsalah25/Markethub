import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
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

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent, StarRatingComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private cartActions = inject(CartActionsService);
  private configService = inject(ConfigService);
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
