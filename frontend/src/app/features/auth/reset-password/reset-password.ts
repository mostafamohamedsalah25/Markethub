import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './reset-password.html',
  styleUrl: '../login/login.scss',
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private uiService = inject(UiService);

  resetForm!: FormGroup;
  token: string = '';

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  hidePassword = signal<boolean>(true);

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.errorMessage.set('Invalid or missing password reset token.');
    }

    this.resetForm = this.fb.nonNullable.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirm: ['', [Validators.required]],
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(g: AbstractControl): ValidationErrors | null {
    const pass = g.get('password')?.value;
    const confirm = g.get('password_confirm')?.value;
    return pass === confirm ? null : { mismatch: true };
  }

  onSubmit(): void {
    if (this.resetForm.invalid || !this.token) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const payload = {
      token: this.token,
      password: this.resetForm.value.password,
      password_confirm: this.resetForm.value.password_confirm,
    };

    this.authService.resetPassword(payload).subscribe({
      next: (res: any) => {
        this.isLoading.set(false);
        this.successMessage.set(res.message || 'Password has been reset successfully.');
        this.uiService.showInfo('Password reset successfully. You can now login.');
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (err) => {
        this.isLoading.set(false);
        const detail = err.error?.detail || err.error?.error || err.error?.message;
        const message = Array.isArray(detail) ? detail[0] : detail;
        this.errorMessage.set(message || 'Failed to reset password. The link may have expired.');
      },
    });
  }
}
