import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import {
  IonContent,
  IonCard,
  IonItem,
  IonAvatar,
  IonLabel,
  IonButton,
  IonSearchbar,
  IonSpinner,
  IonCardContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonCard,
    IonItem,
    IonAvatar,
    IonLabel,
    IonButton,
    IonSearchbar,
    IonSpinner,
    IonCardContent,
  ]
})
export class HomePage implements OnInit {

  search = '';
  professionals: any[] = [];
  filteredProfessionals: any[] = [];
  loading = true;

  quickFilters: string[] = [];

  constructor(
    private auth: AuthService,
    private router: Router,
    //private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadProfessionals();
  }

  loadProfessionals() {
    this.loading = true;

    this.auth.getProfessionals().subscribe({
      next: (res: any) => {
        this.professionals = res || [];
        this.filteredProfessionals = [];

        const dynamic = this.getCategoriesFromData();

        const defaults = [
          'Psicólogo',
          'Nutricionista',
          'Kinesiologo',
          'Terapeuta',
          'Cardiólogo',
          'Dentista',
          'Coach',
          'Psiquiatra'
        ];

        this.quickFilters = [
          ...dynamic,
          ...defaults.filter(d => !dynamic.includes(d))
        ].slice(0, 8);

        this.loading = false;
       // this.cd.detectChanges();
      },

      error: () => {
        this.professionals = [];
        this.filteredProfessionals = [];
        this.loading = false;
      //  this.cd.detectChanges();
      }
    });
  }

  onSearch() {
    const s = (this.search || '').toLowerCase().trim();

    if (!s) {
      this.filteredProfessionals = [];
      return;
    }

    this.filteredProfessionals = this.professionals.filter(p =>
      p.name?.toLowerCase().includes(s) ||
      p.specialty?.toLowerCase().includes(s) ||
      p.email?.toLowerCase().includes(s)
    );
  }

  filterCategory(category: string) {
    this.search = category;
    this.onSearch();
  }

  getCategoriesFromData(): string[] {
    return [...new Set(this.professionals.map(p => p.specialty).filter(Boolean))];
  }

  getIcon(category: string): string {
    const map: any = {
      'psicólogo': '🧠',
      'nutricionista': '🥗',
      'kinesiologo': '🦴',
      'terapeuta': '🧘',
      'cardiólogo': '❤️',
      'dentista': '🦷',
    };

    return map[category?.toLowerCase()] || '👨‍⚕️';
  }

  goToDetail(id: string) {
    this.router.navigate(['/tabs/professional', id]);
  }

  goToProfile() {
    this.router.navigate(['/tabs/profile']);
  }
}