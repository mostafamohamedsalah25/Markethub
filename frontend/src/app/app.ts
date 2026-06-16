import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../environments/environment';
import { UiService } from './core/services/ui.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    MatSnackBarModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private http = inject(HttpClient);
  private uiService = inject(UiService);

  ngOnInit(): void {
    this.checkApiHealth();
  }

  private checkApiHealth(): void {
    if (environment.production) {
      return;
    }
    this.http.get(`${environment.apiUrl}/products/products/?page_size=1`).subscribe({
      error: () => {
        this.uiService.showInfo('API connection issue. Some features may not work.');
      },
    });
  }
}
