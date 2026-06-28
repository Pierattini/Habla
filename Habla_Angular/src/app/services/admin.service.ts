import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from '../core/config/api.config';

export type AdminRole = 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN';
export type AdminAttentionMode = 'ONLINE' | 'PRESENTIAL' | 'BOTH';

export interface AdminPage<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminSummary {
  totalUsers: number;
  totalProfessionals: number;
  totalAdmins: number;
  appointmentsToday: number;
  appointmentsThisWeek: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  activeProfessionals: number;
  premiumProfessionals: number;
  pendingRequests: number;
  countries: { CL: number; ES: number };
  newUsersThisMonth: number;
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: AdminRole;
  isActive: boolean;
  country: string | null;
  timezone: string | null;
  createdAt: string;
  professional?: {
    id: string;
    specialty: string | null;
    customProfession: string | null;
    planStatus: string;
    subscription?: {
      status: string;
      currentPeriodEnd: string | null;
    } | null;
  } | null;
}

export interface AdminProfessional {
  id: string;
  name: string | null;
  specialty: string | null;
  customProfession: string | null;
  attentionMode: AdminAttentionMode;
  officeCity: string | null;
  officeCountry: string | null;
  planStatus: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    isActive: boolean;
    country: string | null;
    createdAt: string;
  };
  profession?: {
    id?: string;
    name: string;
    category?: { name: string; slug: string } | null;
  } | null;
  subscription?: {
    status: string;
    currentPeriodEnd: string | null;
    lastPaymentAt?: string | null;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = `${API_URL}/admin`;

  constructor(private http: HttpClient) {}

  getSummary() {
    return this.http.get<AdminSummary>(`${this.api}/summary`, {
      headers: this.headers(),
    });
  }

  getUsers(params: Record<string, string | number | boolean | undefined>) {
    return this.http.get<AdminPage<AdminUser>>(`${this.api}/users`, {
      headers: this.headers(),
      params: this.params(params),
    });
  }

  updateUser(id: string, payload: Partial<AdminUser>) {
    return this.http.patch<AdminUser>(`${this.api}/users/${id}`, payload, {
      headers: this.headers(),
    });
  }

  setUserActive(id: string, active: boolean) {
    const action = active ? 'activate' : 'deactivate';
    return this.http.patch<AdminUser>(`${this.api}/users/${id}/${action}`, {}, {
      headers: this.headers(),
    });
  }

  getProfessionals(params: Record<string, string | number | boolean | undefined>) {
    return this.http.get<AdminPage<AdminProfessional>>(`${this.api}/professionals`, {
      headers: this.headers(),
      params: this.params(params),
    });
  }

  updateProfessional(id: string, payload: Record<string, unknown>) {
    return this.http.patch<AdminProfessional>(`${this.api}/professionals/${id}`, payload, {
      headers: this.headers(),
    });
  }

  suspendProfessional(id: string) {
    return this.http.patch<AdminProfessional>(`${this.api}/professionals/${id}/suspend`, {}, {
      headers: this.headers(),
    });
  }

  activateProfessional(id: string) {
    return this.http.patch<AdminProfessional>(`${this.api}/professionals/${id}/activate`, {}, {
      headers: this.headers(),
    });
  }

  private headers() {
    return new HttpHeaders({
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    });
  }

  private params(values: Record<string, string | number | boolean | undefined>) {
    let params = new HttpParams();

    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return params;
  }
}
