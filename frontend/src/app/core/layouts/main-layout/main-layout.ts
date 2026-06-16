import { Component, inject, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../../shared/components/navbar/navbar';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <div class="min-h-screen flex flex-col" [style.background]="'var(--mh-bg)'">
      <app-navbar></app-navbar>
      <main class="flex-grow flex flex-col w-full">
        <router-outlet></router-outlet>
      </main>
      <app-footer></app-footer>

      <!-- Scroll to Top Button -->
      @if (showScrollTop()) {
        <button
          (click)="scrollToTop()"
          class="fixed bottom-8 right-8 z-50 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 animate-scale-in"
          style="background: var(--mh-brand); box-shadow: var(--mh-shadow-brand);"
          aria-label="Scroll to top"
        >
          <span class="material-symbols-outlined text-xl">arrow_upward</span>
        </button>
      }
    </div>
  `,
})
export class MainLayoutComponent {
  showScrollTop = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.showScrollTop.set(window.scrollY > 400);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
