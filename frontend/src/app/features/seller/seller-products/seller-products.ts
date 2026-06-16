import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { CategoryService } from '../../../core/services/category.service';
import { UiService } from '../../../core/services/ui.service';
import { Product } from '../../../core/models/product.model';
import { Category } from '../../../core/models/category.model';

@Component({
  selector: 'app-seller-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seller-products.html',
})
export class SellerProductsComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  products: Product[] = [];
  categories: Category[] = [];
  loading = false;
  errorMessage = '';
  isFormOpen = false; // يتحكم في ظهور فورم إضافة المنتج

  newProduct = {
    name: '',
    slug: '',
    description: '',
    price: 0,
    discount_price: null as number | null,
    stock: 0,
    category: '',
  };

  selectedFiles: File[] = [];

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private ui: UiService // استبدال الـ alerts بـ UiService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategories();
  }

  toggleForm(): void {
    this.isFormOpen = !this.isFormOpen;
  }

  loadProducts(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.productService.getSellerProducts().subscribe({
      next: (res: Product[] | { results: Product[] }) => {
        this.products = Array.isArray(res) ? res : res.results || [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err: { error?: { detail?: string } }) => {
        this.loading = false;
        this.errorMessage = err.error?.detail || 'Failed to load products';
        this.ui.showInfo(this.errorMessage);
        this.cdr.markForCheck();
      },
    });
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (res: Category[] | { results: Category[] }) => {
        this.categories = Array.isArray(res) ? res : res.results || [];
      },
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFiles = Array.from(input.files);
    }
  }

  addProduct(): void {
    if (!this.newProduct.category) {
      this.ui.showInfo('Please select a category first.');
      return;
    }

    const formData = new FormData();
    formData.append('name', this.newProduct.name);
    formData.append('slug', this.newProduct.slug);
    formData.append('description', this.newProduct.description);
    formData.append('price', this.newProduct.price.toString());
    if (this.newProduct.discount_price) {
      formData.append('discount_price', this.newProduct.discount_price.toString());
    }
    formData.append('stock', this.newProduct.stock.toString());
    formData.append('category', this.newProduct.category);

    this.selectedFiles.forEach((file) => {
      formData.append('uploaded_images', file);
    });

    this.loading = true;
    this.errorMessage = '';
    
    this.productService.createProduct(formData).subscribe({
      next: () => {
        this.ui.showInfo('Product added successfully!');
        this.loadProducts();
        this.newProduct = {
          name: '',
          slug: '',
          description: '',
          price: 0,
          discount_price: null,
          stock: 0,
          category: '',
        };
        this.selectedFiles = [];
        this.isFormOpen = false; // قفل الفورم بعد النجاح
        this.cdr.markForCheck();
      },
      error: (err: { error?: Record<string, string[] | string> }) => {
        this.loading = false;
        const e = err.error;
        const msg =
          (Array.isArray(e?.['slug']) ? e['slug'][0] : e?.['slug']) ||
          (Array.isArray(e?.['category']) ? e['category'][0] : e?.['category']) ||
          (typeof e?.['detail'] === 'string' ? e['detail'] : '') ||
          'Something went wrong.';
        this.ui.showInfo('Error: ' + msg);
        this.cdr.markForCheck();
      },
    });
  }

  generateSlug(): void {
    this.newProduct.slug = this.newProduct.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  deleteProduct(slug: string): void {
    if (confirm('Are you sure you want to deactivate this product? This action cannot be fully undone.')) {
      this.productService.deleteProduct(slug).subscribe({
        next: () => {
          this.ui.showInfo('Product deactivated successfully.');
          this.loadProducts();
          this.cdr.markForCheck();
        },
        error: () => {
          this.ui.showInfo('Error deactivating product.');
          this.cdr.markForCheck();
        },
      });
    }
  }
}