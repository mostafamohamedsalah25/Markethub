import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboardComponent {
  constructor(public router: Router) {}

  isRoot(): boolean {
    return this.router.url === '/admin' || this.router.url === '/seller';
  }

  getLink(path: string): string {
    const base = this.router.url.startsWith('/admin') ? '/admin' : '/seller';
    return base + path;
  }
}
