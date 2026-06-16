import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.html',
})
export class ProfileComponent {
  authService = inject(AuthService);
  user = this.authService.currentUser;

  getUsername(): string {
    const email = this.user()?.email;
    return email ? email.split('@')[0] : 'User';
  }

  getInitials(): string {
    const email = this.user()?.email;
    return email ? email[0].toUpperCase() : 'U';
  }
}