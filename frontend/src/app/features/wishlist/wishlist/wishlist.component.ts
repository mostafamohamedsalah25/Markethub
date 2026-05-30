import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../../core/services/wishlist.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-wishlist',
    standalone: true,
    imports: [CommonModule, RouterLink, ProductCardComponent, MatButtonModule, MatIconModule],
    templateUrl: './wishlist.component.html',
    styleUrl: './wishlist.component.scss'
})
export class WishlistComponent implements OnInit {
    public wishlistService = inject(WishlistService);

    wishlistItems = this.wishlistService.items;

    ngOnInit(): void {
        this.wishlistService.loadWishlist();
    }

    clearWishlist(): void {
        // Optional: Implement clearing wishlist if needed
    }
}
