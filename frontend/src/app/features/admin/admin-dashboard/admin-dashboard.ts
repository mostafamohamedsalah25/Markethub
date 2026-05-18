import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboardComponent {
  constructor(public router: Router) {}

  getLink(path: string): string {
    const base = this.router.url.startsWith('/admin') ? '/admin' : '/seller';
    return base + path;
  }
}
