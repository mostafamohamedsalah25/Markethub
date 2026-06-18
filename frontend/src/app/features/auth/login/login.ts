import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { UiService } from '../../../core/services/ui.service';
import { safeReturnUrl } from '../../../core/utils/safe-return-url';
import { environment } from '../../../../environments/environment';

declare var google: any;

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
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

  // Google OAuth properties
  showRoleModal = signal<boolean>(false);
  googleRole = signal<'customer' | 'seller'>('customer');
  googleStoreName = signal<string>('');

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

  startGoogleLogin(): void {
    this.googleRole.set('customer');
    this.googleStoreName.set('');
    this.showRoleModal.set(true);
  }

  triggerGoogleAuth(): void {
    this.showRoleModal.set(false);
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (response: any) => this.handleGoogleCredentialResponse(response),
      });

      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const container = document.getElementById('google-btn-container');
          if (container) {
            google.accounts.id.renderButton(container, {
              theme: 'outline',
              size: 'large',
              width: 320,
            });
            this.isLoading.set(false);
            this.uiService.showInfo('Please click the Google button to authenticate.');
          } else {
            this.isLoading.set(false);
            this.errorMessage.set('Google authentication prompt failed to open.');
          }
        }
      });
    } catch (err) {
      this.isLoading.set(false);
      this.errorMessage.set('Google Identity SDK failed to load.');
    }
  }

  handleGoogleCredentialResponse(response: any): void {
    if (!response.credential) {
      this.errorMessage.set('Google authentication failed.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.authService.googleLogin({
      token: response.credential,
      role: this.googleRole(),
      store_name: this.googleRole() === 'seller' ? this.googleStoreName().trim() : undefined,
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const role = res.data.user.role;
        if (role === 'admin') this.router.navigate(['/admin']);
        else if (role === 'seller') this.router.navigate(['/seller']);
        else this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || err.error?.detail || 'Google Sign-In failed.';
        this.errorMessage.set(typeof msg === 'string' ? msg : JSON.stringify(msg));
      },
    });
  }

  showComingSoon(feature: string): void {
    this.uiService.showComingSoon(feature);
  }
}
