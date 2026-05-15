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
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () => import('./features/profile/profile/profile').then(m => m.ProfileComponent)
      },
    ],
  },
  {
    path: 'seller',
    canActivate: [roleGuard(['seller', 'admin'])],
    loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent),
    children: [
      {
        path: 'products',
        loadComponent: () => import('./features/seller/seller-products/seller-products').then(m => m.SellerProductsComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/seller/seller-orders/seller-orders').then(m => m.SellerOrdersComponent)
      },
      { path: '', redirectTo: 'products', pathMatch: 'full' }
    ]
  },
  {
    path: 'admin',
    canActivate: [roleGuard(['admin'])],
    loadComponent: () => import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent),
    children: [
      {
        path: 'products',
        loadComponent: () => import('./features/seller/seller-products/seller-products').then(m => m.SellerProductsComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./features/seller/seller-orders/seller-orders').then(m => m.SellerOrdersComponent)
      },
      { path: '', redirectTo: 'products', pathMatch: 'full' }
    ]
  },

  // Fallback Route
  { path: '**', redirectTo: '' },
];
