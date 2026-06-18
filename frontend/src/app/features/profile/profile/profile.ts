import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth';
import { UserAddressService, UserAddress } from '../../../core/services/address.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './profile.html',
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);
  addressService = inject(UserAddressService);
  uiService = inject(UiService);
  fb = inject(FormBuilder);

  user = this.authService.currentUser;
  activeTab = signal<'info' | 'addresses'>('info');

  // Address signals
  addresses = signal<UserAddress[]>([]);
  isLoadingAddresses = signal<boolean>(false);
  showAddressModal = signal<boolean>(false);
  isModalSaving = signal<boolean>(false);
  editingAddressId = signal<string | null>(null);

  addressForm!: FormGroup;

  ngOnInit(): void {
    this.initAddressForm();
    this.loadAddresses();
  }

  initAddressForm(): void {
    this.addressForm = this.fb.nonNullable.group({
      address_title: ['', [Validators.required, Validators.maxLength(100)]],
      recipient_name: ['', [Validators.required, Validators.maxLength(150)]],
      recipient_phone: ['', [Validators.required, Validators.pattern('^\\+?[0-9]{10,15}$')]],
      street_address: ['', [Validators.required]],
      city: ['', [Validators.required, Validators.maxLength(100)]],
      state: ['', [Validators.required, Validators.maxLength(100)]],
      postal_code: ['', [Validators.required, Validators.maxLength(20)]],
      country: ['', [Validators.required, Validators.maxLength(100)]],
      is_default: [false],
    });
  }

  loadAddresses(): void {
    this.isLoadingAddresses.set(true);
    this.addressService.getAddresses().subscribe({
      next: (data) => {
        this.addresses.set(data);
        this.isLoadingAddresses.set(false);
      },
      error: () => {
        this.isLoadingAddresses.set(false);
        this.uiService.showError('Failed to load addresses.');
      }
    });
  }

  getUsername(): string {
    const email = this.user()?.email;
    return email ? email.split('@')[0] : 'User';
  }

  getInitials(): string {
    const email = this.user()?.email;
    return email ? email[0].toUpperCase() : 'U';
  }

  openAddModal(): void {
    this.editingAddressId.set(null);
    this.addressForm.reset({ is_default: false });
    this.showAddressModal.set(true);
  }

  openEditModal(address: UserAddress): void {
    this.editingAddressId.set(address.id);
    this.addressForm.patchValue({
      address_title: address.address_title,
      recipient_name: address.recipient_name,
      recipient_phone: address.recipient_phone,
      street_address: address.street_address,
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
      is_default: address.is_default,
    });
    this.showAddressModal.set(true);
  }

  closeAddressModal(): void {
    this.showAddressModal.set(false);
    this.editingAddressId.set(null);
  }

  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }

    this.isModalSaving.set(true);
    const payload = this.addressForm.value;
    const addressId = this.editingAddressId();

    const request = addressId
      ? this.addressService.updateAddress(addressId, payload)
      : this.addressService.createAddress(payload);

    request.subscribe({
      next: () => {
        this.isModalSaving.set(false);
        this.closeAddressModal();
        this.loadAddresses();
        this.uiService.showInfo(addressId ? 'Address updated.' : 'Address added.');
      },
      error: (err) => {
        this.isModalSaving.set(false);
        const detail = err.error?.detail || err.error?.message;
        const msg = Array.isArray(detail) ? detail[0] : detail;
        this.uiService.showError(msg || 'Failed to save address.');
      }
    });
  }

  deleteAddress(id: string): void {
    if (!confirm('Are you sure you want to delete this address?')) {
      return;
    }

    this.addressService.deleteAddress(id).subscribe({
      next: () => {
        this.loadAddresses();
        this.uiService.showInfo('Address deleted.');
      },
      error: () => {
        this.uiService.showError('Failed to delete address.');
      }
    });
  }

  setDefaultAddress(id: string): void {
    this.addressService.setDefaultAddress(id).subscribe({
      next: () => {
        this.loadAddresses();
        this.uiService.showInfo('Default address updated.');
      },
      error: () => {
        this.uiService.showError('Failed to set default address.');
      }
    });
  }
}