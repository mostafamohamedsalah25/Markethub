import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import { Product } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { UiService } from '../../../core/services/ui.service';
import { CartActionsService } from '../../../core/services/cart-actions.service';
import { ConfigService } from '../../../core/services/config';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private uiService = inject(UiService);
  private cartActions = inject(CartActionsService);
  private configService = inject(ConfigService);
  private cdr = inject(ChangeDetectorRef);

  categories: Category[] = [];
  featuredProducts: Product[] = [];
  isLoading = true;
  error: string | null = null;

  readonly heroBanner = {
    badge: 'Curated Selections',
    title: 'Discover. Shop. Elevate.',
    description: 'Explore curated collections and trends, selected for your lifestyle.',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80',
    cta: 'Shop Now'
  };

  readonly fallbackCategories: Category[] = [
    { id: 1, name: 'Minimalist Laptops', slug: 'laptops', image: 'https://images.unsplash.com/photo-1496181130204-755241524eab?auto=format&fit=crop&w=600&q=80', subcategories: [], created_at: new Date().toISOString() },
    { id: 2, name: 'Pro Gaming Gear', slug: 'gaming', image: 'https://images.unsplash.com/photo-1605901309584-818e25960a8f?auto=format&fit=crop&w=600&q=80', subcategories: [], created_at: new Date().toISOString() },
    { id: 3, name: 'Luxury Cosmetics', slug: 'beauty', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80', subcategories: [], created_at: new Date().toISOString() },
    { id: 4, name: 'Curated Books', slug: 'books', image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80', subcategories: [], created_at: new Date().toISOString() },
    { id: 5, name: 'Premium Audio', slug: 'beauty-headphones', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80', subcategories: [], created_at: new Date().toISOString() },
    { id: 6, name: 'Smart Electronics', slug: 'hectronics', image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80', subcategories: [], created_at: new Date().toISOString() },
    { id: 7, name: 'Chic Apparel', slug: 'rooutes', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80', subcategories: [], created_at: new Date().toISOString() }
  ];

  readonly fallbackProducts: Product[] = [
    {
      id: 101,
      name: 'Premium Leather Backpack',
      slug: 'premium-leather-backpack',
      description: 'Handcrafted luxury leather backpack designed for everyday travel and style.',
      price: '180.00',
      discount_price: '150.00',
      stock: 10,
      is_active: true,
      category: 1,
      seller: 1,
      images: [{ id: 1, image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80', is_primary: true, order: 0 }],
      average_rating: 5.0,
      review_count: 24,
      created_at: new Date().toISOString()
    },
    {
      id: 102,
      name: 'High-end Headphones',
      slug: 'high-end-headphones',
      description: 'Studio-quality wireless over-ear headphones with active noise cancellation.',
      price: '299.00',
      stock: 15,
      is_active: true,
      category: 1,
      seller: 1,
      images: [{ id: 2, image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80', is_primary: true, order: 0 }],
      average_rating: 4.9,
      review_count: 48,
      created_at: new Date().toISOString()
    },
    {
      id: 103,
      name: 'Designer Sneakers',
      slug: 'designer-sneakers',
      description: 'Sleek luxury design sneakers merging athletic comfort with high-end aesthetic.',
      price: '120.00',
      discount_price: '99.00',
      stock: 5,
      is_active: true,
      category: 1,
      seller: 1,
      images: [{ id: 3, image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80', is_primary: true, order: 0 }],
      average_rating: 4.8,
      review_count: 16,
      created_at: new Date().toISOString()
    },
    {
      id: 104,
      name: 'Curated Home Decor Essentials',
      slug: 'curated-home-decor',
      description: 'Beautiful ceramic accessories to elevate your living room and modern workspace.',
      price: '85.00',
      stock: 8,
      is_active: true,
      category: 1,
      seller: 1,
      images: [{ id: 4, image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80', is_primary: true, order: 0 }],
      average_rating: 4.6,
      review_count: 12,
      created_at: new Date().toISOString()
    }
  ];

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
        const cats = Array.isArray(data.categories) ? data.categories : (data.categories.results || []);
        const prods = Array.isArray(data.products) ? data.products : (data.products.results || []);
        
        this.categories = cats.length > 0 ? cats : this.fallbackCategories;
        this.featuredProducts = prods.length > 0 ? prods.slice(0, 8) : this.fallbackProducts;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading home data', err);
        // Load fallback premium data on error so UI looks polished and doesn't break
        this.categories = this.fallbackCategories;
        this.featuredProducts = this.fallbackProducts;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  addToCart(event: Event, product: Product): void {
    event.stopPropagation();
    event.preventDefault();
    this.cartActions.addToCart(product);
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
