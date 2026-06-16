import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-register',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  registerForm: FormGroup;
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  hidePassword = signal<boolean>(true);
  isSeller = signal<boolean>(false);

  constructor() {
    this.registerForm = this.fb.nonNullable.group(
      {
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.pattern('^[0-9]{10,15}$')]],
        role: ['customer', Validators.required],
        store_name: [''],
        password: ['', [Validators.required, Validators.minLength(8)]],
        password_confirm: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  ngOnInit(): void {
    this.registerForm
      .get('role')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => {
        const storeNameCtrl = this.registerForm.get('store_name');
        if (role === 'seller') {
          this.isSeller.set(true);
          storeNameCtrl?.setValidators([Validators.required, Validators.minLength(3)]);
        } else {
          this.isSeller.set(false);
          storeNameCtrl?.clearValidators();
          storeNameCtrl?.setValue('');
        }
        storeNameCtrl?.updateValueAndValidity();
      });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirm = control.get('password_confirm')?.value;
    if (password !== confirm) {
      control.get('password_confirm')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService.register(this.registerForm.getRawValue()).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set(
          'Registration successful! Please check your email to verify your account.',
        );
        this.registerForm.reset();
        setTimeout(() => this.router.navigate(['/auth/login']), 3000);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errors = err.error?.data || {};
        const errorMsg =
          Object.values(errors).flat().join(', ') || 'Registration failed. Please try again.';
        this.errorMessage.set(errorMsg);
      },
    });
  }

  showComingSoon(feature: string): void {
    inject(UiService).showComingSoon(feature);
  }
}
