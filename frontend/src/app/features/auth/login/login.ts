import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { UiService } from '../../../core/services/ui.service';
import { safeReturnUrl } from '../../../core/utils/safe-return-url';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private uiService = inject(UiService);

  loginForm: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  hidePassword = signal<boolean>(true);

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.getRawValue()).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const returnUrl = safeReturnUrl(this.route.snapshot.queryParams['returnUrl']);
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
          return;
        }
        const role = res.data.user.role;
        if (role === 'admin') this.router.navigate(['/admin']);
        else if (role === 'seller') this.router.navigate(['/seller']);
        else this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err.error?.detail;
        const message = Array.isArray(detail) ? detail[0] : detail;
        this.errorMessage.set(message || 'Invalid email or password. Please try again.');
      },
    });
  }

  showComingSoon(feature: string): void {
    this.uiService.showComingSoon(feature);
  }
}
