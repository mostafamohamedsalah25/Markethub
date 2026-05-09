import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <footer class="bg-white border-t border-slate-200 mt-auto font-inter">
      <div
        class="max-w-[1280px] mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6"
      >
        <div class="flex flex-col gap-2 text-center md:text-left">
          <span class="font-bold text-slate-900 text-lg">NexusCommerce</span>
          <p class="text-xs text-slate-500">© 2026 NexusCommerce. All rights reserved.</p>
        </div>
        <div class="flex flex-wrap justify-center gap-6">
          <a
            routerLink="/terms"
            class="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >Terms of Service</a
          >
          <a
            routerLink="/privacy"
            class="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >Privacy Policy</a
          >
          <a
            routerLink="/shipping"
            class="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >Shipping Info</a
          >
          <a
            routerLink="/returns"
            class="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >Returns</a
          >
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {}
