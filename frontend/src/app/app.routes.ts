import { Routes } from '@angular/router';
import { MainLayoutComponent } from './core/layouts/main-layout/main-layout';
import { roleGuard } from './core/guards/role-guard';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register').then((m) => m.RegisterComponent),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: 'verify-email/:token',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'verify_email/:token',
    loadComponent: () =>
      import('./features/auth/verify-email/verify-email').then((m) => m.VerifyEmailComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/home/home-routing-module').then((m) => m.HomeRoutingModule),
      },
      {
        path: 'catalog',
        loadChildren: () =>
          import('./features/catalog/catalog-routing-module').then((m) => m.CatalogRoutingModule),
      },
      {
        path: 'products/:slug',
        loadChildren: () =>
          import('./features/product-detail/product-detail-routing-module').then((m) => m.ProductDetailRoutingModule),
      },
      {
        path: 'cart',
        canActivate: [authGuard],
        loadComponent: () => import('./features/cart/cart/cart').then(m => m.CartComponent)
      },
      {
        path: 'checkout',
        canActivate: [authGuard],
        loadComponent: () => import('./features/checkout/checkout/checkout').then(m => m.CheckoutComponent)
      },
      {
        path: 'my-orders',
        canActivate: [authGuard],
        loadComponent: () => import('./features/orders/my-orders/my-orders').then(m => m.MyOrdersComponent)
      },
      {
        path: 'payment/success',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/payment/payment-success/payment-success').then((m) => m.PaymentSuccessComponent),
      },
      {
        path: 'payment/cancel',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/payment/payment-cancel/payment-cancel').then((m) => m.PaymentCancelComponent),
      },
      {
        path: 'payment/mock',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/payment/payment-mock/payment-mock').then((m) => m.PaymentMockComponent),
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () => import('./features/profile/profile/profile').then(m => m.ProfileComponent)
      },
      {
        path: 'wishlist',
        canActivate: [authGuard],
        loadComponent: () => import('./features/wishlist/wishlist/wishlist.component').then(m => m.WishlistComponent)
      },
    ],
  },
  {
    path: 'seller',
    canActivate: [roleGuard(['seller', 'admin'])],
    loadComponent: () =>
      import('./features/admin/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboardComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./features/seller/seller-overview/seller-overview').then((m) => m.SellerOverviewComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/seller/seller-products/seller-products').then((m) => m.SellerProductsComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/seller/seller-orders/seller-orders').then((m) => m.SellerOrdersComponent),
      },
      {
        path: 'revenue',
        loadComponent: () =>
          import('./features/seller/seller-revenue/seller-revenue').then((m) => m.SellerRevenueComponent),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/admin/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboardComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () =>
          import('./features/admin/admin-overview/admin-overview').then((m) => m.AdminOverviewComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/seller/seller-products/seller-products').then((m) => m.SellerProductsComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/seller/seller-orders/seller-orders').then((m) => m.SellerOrdersComponent),
      },
      {
        path: 'promos',
        loadComponent: () =>
          import('./features/admin/admin-promos/admin-promos').then((m) => m.AdminPromosComponent),
      },
      {
        path: 'payments',
        loadComponent: () =>
          import('./features/admin/admin-payments/admin-payments').then((m) => m.AdminPaymentsComponent),
      },
    ],
  },

  // Fallback Route
  { path: '**', redirectTo: '' },
];
