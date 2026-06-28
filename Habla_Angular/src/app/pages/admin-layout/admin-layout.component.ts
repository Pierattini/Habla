import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { clearStoredSession } from '../../core/auth/session.util';

interface AdminNavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss'],
})
export class AdminLayoutComponent {
  readonly navItems: AdminNavItem[] = [
    { label: 'Dashboard', route: '/admin/dashboard', icon: '◼' },
    { label: 'Soporte', route: '/admin/support', icon: '○' },
    { label: 'Usuarios', route: '/admin/users', icon: '◇' },
    { label: 'Profesionales', route: '/admin/professionals', icon: '□' },
    { label: 'Citas', route: '/admin/dashboard', icon: '△' },
    { label: 'Catalogo', route: '/admin/dashboard', icon: '◎' },
  ];

  constructor(private router: Router) {}

  logout(): void {
    clearStoredSession();
    this.router.navigateByUrl('/login');
  }
}
