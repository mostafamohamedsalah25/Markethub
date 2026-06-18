import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, RouterLink } from '@angular/router';
import { OrdersService, Cart, CartItem } from '../../../core/services/orders.service';
import { PromoService } from '../../../core/services/promo.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RouterLink],
  templateUrl: './cart.html',
})
export class CartComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private promoService = inject(PromoService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ui = inject(UiService);

  cart: Cart | null = null;
  loading = true;
  promoCode = '';
  promoError = '';
  promoLoading = false;
  
  // بنخزن فيه الـ IDs بتاعة المنتجات اللي بيتغير عددها دلوقتي عشان نوقف زرايرها ثواني
  updatingItems = new Set<number>(); 

  ngOnInit(): void {
    // تحميل أولي للسلة (هنا بس بنظهر الـ Spinner الكبير)
    this.loadCart(true); 
  }

  // ضفنا باراميتر showSpinner عشان نتحكم امتى نظهر التحميل وامتى نحدث بصمت
  loadCart(showSpinner = true): void {
    if (showSpinner) {
      this.loading = true;
      this.cdr.markForCheck();
    }
    
    this.ordersService.getCart().subscribe({
      next: (data) => {
        this.cart = data;
        this.promoCode = data.applied_promo_code || this.promoCode;
        this.promoError = '';
        if (showSpinner) this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (showSpinner) this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  updateQuantity(item: CartItem, change: number): void {
    const newQuantity = item.quantity + change;
    if (newQuantity <= 0) {
      this.removeItem(item);
      return;
    }

    // 1. Optimistic Update: بنغير الرقم فوراً قدام اليوزر بدون انتظار الباك إند
    const oldQuantity = item.quantity;
    item.quantity = newQuantity;
    this.updatingItems.add(item.id);
    
    // 2. بنكلم الباك إند في الخلفية
    this.ordersService.updateCartItem(item.id, newQuantity).subscribe({
      next: () => {
        this.updatingItems.delete(item.id);
        // تحديث صامت عشان نظبط الـ Subtotal والـ Total بدون ما نكسر الشاشة
        this.loadCart(false); 
      },
      error: (err) => {
        // لو حصل مشكلة بنرجع الرقم القديم ونظهر رسالة
        item.quantity = oldQuantity;
        this.updatingItems.delete(item.id);
        this.ui.showError(err.error?.error || 'Error updating quantity');
        this.cdr.markForCheck();
      },
    });
  }

  removeItem(item: CartItem): void {
    // مسح متفائل (بنشيله من الشاشة فوراً)
    if (this.cart) {
       this.cart.items = this.cart.items.filter(i => i.id !== item.id);
    }
    
    this.ordersService.removeCartItem(item.id).subscribe({
      next: () => this.loadCart(false),
      error: () => {
        this.loadCart(false); // بنعمل ريلود لو مسح الفاشل عشان يرجع يظهر
        this.ui.showError('Error removing item');
      },
    });
  }

  clearCart(): void {
    if (!this.cart?.items?.length) return;
    
    const ids = this.cart.items.map(i => i.id);
    // مسح متفائل لكل السلة
    this.cart.items = []; 
    
    let pending = ids.length;
    ids.forEach(id => {
      this.ordersService.removeCartItem(id).subscribe({
        next: () => { if (--pending === 0) this.loadCart(false); },
        error: () => { if (--pending === 0) this.loadCart(false); },
      });
    });
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  applyPromo(): void {
    const code = this.promoCode.trim();
    if (!code) {
      this.promoError = 'Enter a promo code.';
      this.ui.showError(this.promoError);
      return;
    }

    this.promoLoading = true;
    this.promoError = '';
    this.cdr.markForCheck();

    this.promoService.apply(code).subscribe({
      next: (result) => {
        this.promoLoading = false;
        this.promoCode = '';
        this.ui.showInfo(result.message);
        this.loadCart(false);
      },
      error: (err) => {
        this.promoLoading = false;
        this.promoError = err.error?.message || 'Could not apply promo code.';
        this.ui.showError(this.promoError);
        this.cdr.markForCheck();
      },
    });
  }

  removePromo(): void {
    if (!this.cart?.applied_promo_code) return;

    this.promoLoading = true;
    this.promoError = '';
    this.cdr.markForCheck();

    this.promoService.removeFromCart().subscribe({
      next: (cart) => {
        this.promoLoading = false;
        this.cart = cart;
        this.promoCode = '';
        this.ui.showInfo('Promo removed from cart.');
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.promoLoading = false;
        this.promoError = err.error?.message || 'Could not remove promo code.';
        this.ui.showError(this.promoError);
        this.cdr.markForCheck();
      },
    });
  }

  lineTotal(item: CartItem): string {
    const price = Number(item.product_details?.discount_price || item.product_details?.price || 0);
    return (item.quantity * price).toFixed(2);
  }
  
  isUpdating(id: number): boolean {
    return this.updatingItems.has(id);
  }
}
