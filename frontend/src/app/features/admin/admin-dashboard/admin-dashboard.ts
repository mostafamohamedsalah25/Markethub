import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboardComponent {
  router = inject(Router);
  authService = inject(AuthService);

  // إشارة للتحكم في السايد بار على الموبايل
  isSidebarOpen = signal(false);

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
  }

  getLink(path: string): string {
    const base = this.router.url.startsWith('/admin') ? '/admin' : '/seller';
    return base + path;
  }

  logout(): void {
    this.authService.logout();
  }
}