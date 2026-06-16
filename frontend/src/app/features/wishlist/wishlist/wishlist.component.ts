import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../../core/services/wishlist.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { UiService } from '../../../core/services/ui.service';

@Component({
    selector: 'app-wishlist',
    standalone: true,
    imports: [CommonModule, RouterLink, ProductCardComponent],
    templateUrl: './wishlist.component.html'
})
export class WishlistComponent implements OnInit {
    public wishlistService = inject(WishlistService);
    private ui = inject(UiService);

    wishlistItems = this.wishlistService.items;
    clearing = signal(false);

    ngOnInit(): void {
        this.wishlistService.loadWishlist();
    }

    clearWishlist(): void {
        if (!this.wishlistItems().length) return;
        
        if (confirm('Are you sure you want to clear your entire wishlist?')) {
            this.clearing.set(true);
            
            // بافتراض إنك أضفت دالة clear() في الـ WishlistService بتكلم الـ Endpoint الجديد:
            // this.wishlistService.clearWishlist().subscribe({...})
            
            // وللضمان لو معندكش الدالة دي، ده Fallback بيمسحهم واحد واحد (Sequential Delete)
            let pending = this.wishlistItems().length;
            this.wishlistItems().forEach(item => {
                this.wishlistService.removeFromWishlist(item.id).subscribe({
                    next: () => {
                        if (--pending === 0) {
                            this.clearing.set(false);
                            this.wishlistService.loadWishlist();
                            this.ui.showInfo('Wishlist cleared successfully.');
                        }
                    },
                    error: () => {
                        if (--pending === 0) {
                            this.clearing.set(false);
                            this.wishlistService.loadWishlist();
                        }
                    }
                });
            });
        }
    }
}