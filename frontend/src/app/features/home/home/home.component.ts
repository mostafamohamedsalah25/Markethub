import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, catchError, map, of, finalize, forkJoin } from 'rxjs';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import { Product } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { UiService } from '../../../core/services/ui.service';
import { ConfigService } from '../../../core/services/config';
import { NewsletterComponent } from '../../../shared/components/newsletter/newsletter.component';
import { PrimaryImagePipe } from '../../../shared/pipes/primary-image-pipe';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent, PrimaryImagePipe, NewsletterComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private uiService = inject(UiService);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  categories: Category[] = [];
  featuredProducts: Product[] = [];
  isLoading = true;
  error: string | null = null;

  readonly heroBanner = this.configService.homeConfig.hero;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    
    forkJoin({
      categories: this.categoryService.getCategories(),
      products: this.productService.getProducts({ ordering: '-created_at' })
    }).subscribe({
      next: (data: any) => {
        // Handle both flat array and paginated { results: [] } responses
        const cats = Array.isArray(data.categories) ? data.categories : (data.categories.results || []);
        const prods = Array.isArray(data.products) ? data.products : (data.products.results || []);
        
        this.categories = cats;
        this.featuredProducts = prods.slice(0, 8);
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading home data', err);
        this.error = 'Failed to load home content';
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  addToCart(event: Event, product: Product): void {
    event.stopPropagation(); // prevent card navigation
    this.uiService.showComingSoon('Cart');
  }

  showComingSoon(feature: string): void {
    this.uiService.showComingSoon(feature);
  }

  isNew(dateString: string): boolean {
    const createdDate = new Date(dateString);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return createdDate > thirtyDaysAgo;
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = this.configService.catalogConfig.placeholders.productImage;
  }
}

