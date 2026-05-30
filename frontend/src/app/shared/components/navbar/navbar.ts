import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../../core/services/auth';
import { MatDividerModule } from '@angular/material/divider';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { UiService } from '../../../core/services/ui.service';
import { NotificationService, Notification } from '../../../core/services/notification.service';
import { ConfigService } from '../../../core/services/config';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    SearchBarComponent,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent {
  public authService = inject(AuthService);
  private uiService = inject(UiService);
  private configService = inject(ConfigService);
  public notificationService = inject(NotificationService);

  readonly navLinks = this.configService.navLinks;

  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;

  isSellerOrAdmin = computed(() => {
    const user = this.currentUser();
    return user && (user.role === 'seller' || user.role === 'admin');
  });

  unreadNotifications = this.notificationService.unreadCount;
  notifications = this.notificationService.notifications;

  ngOnInit(): void {
    if (this.isAuthenticated()) {
      this.notificationService.fetchNotifications();
    }
  }

  markAsRead(notification: Notification): void {
    this.notificationService.markAsRead(notification.id).subscribe();
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  logout(): void {
    this.authService.logout();
  }

  showComingSoon(feature: string): void {
    this.uiService.showComingSoon(feature);
  }
}
