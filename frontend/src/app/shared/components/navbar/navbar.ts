import { Component, inject, computed, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
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
    SearchBarComponent,
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class NavbarComponent implements OnInit {
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

  // UI State
  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);
  notifMenuOpen = signal(false);
  isDarkMode = signal(false);
  scrolled = signal(false);

  ngOnInit(): void {
    if (this.isAuthenticated()) {
      this.notificationService.fetchNotifications();
    }
    // Init dark mode from localStorage (default to 'dark')
    const saved = localStorage.getItem('mh-theme') || 'dark';
    this.setTheme(saved as 'light' | 'dark');
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrolled.set(window.scrollY > 10);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-menu]')) {
      this.userMenuOpen.set(false);
      this.notifMenuOpen.set(false);
    }
  }

  toggleTheme(): void {
    const next = this.isDarkMode() ? 'light' : 'dark';
    this.setTheme(next);
  }

  private setTheme(theme: 'light' | 'dark'): void {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mh-theme', theme);
    this.isDarkMode.set(theme === 'dark');
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update(v => !v);
    this.notifMenuOpen.set(false);
  }

  toggleNotifMenu(): void {
    this.notifMenuOpen.update(v => !v);
    if (this.notifMenuOpen()) this.notificationService.fetchNotifications();
    this.userMenuOpen.set(false);
  }

  markAsRead(notification: Notification): void {
    this.notificationService.markAsRead(notification.id).subscribe();
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  logout(): void {
    this.authService.logout();
    this.userMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  showComingSoon(feature: string): void {
    this.uiService.showComingSoon(feature);
  }
}
