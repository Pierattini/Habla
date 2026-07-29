import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';
import { API_URL } from '../core/config/api.config';

export type AdminRole = 'CUSTOMER' | 'PROFESSIONAL' | 'ADMIN';
export type AdminAttentionMode = 'ONLINE' | 'PRESENTIAL' | 'BOTH';
export type AdminActivationMode = 'THIRTY_DAYS' | 'INDEFINITE';

export interface AdminPage<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type AdminPageWireResponse<T> =
  | AdminPage<T>
  | {
      data?: T[] | AdminPage<T>;
      items?: T[];
      results?: T[];
      total?: number;
      page?: number;
      limit?: number;
      totalPages?: number;
      meta?: {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
      };
    };

type AdminPagePayload<T> = {
  data?: T[];
  items?: T[];
  results?: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

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
    return this.http
      .get<AdminPageWireResponse<AdminProfessional>>(`${this.api}/professionals`, {
        headers: this.headers(),
        params: this.params(params),
      })
      .pipe(map((response) => this.normalizePage(response, params)));
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

  activateProfessional(id: string, mode: AdminActivationMode) {
    return this.http.patch<AdminProfessional>(`${this.api}/professionals/${id}/activate`, { mode }, {
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

  private normalizePage<T>(
    response: AdminPageWireResponse<T>,
    requested: Record<string, string | number | boolean | undefined>,
  ): AdminPage<T> {
    const outer = response as Exclude<
      AdminPageWireResponse<T>,
      AdminPage<T>
    >;
    const payload = (
      outer.data && !Array.isArray(outer.data)
        ? outer.data
        : outer
    ) as AdminPagePayload<T>;
    const data = Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.results)
          ? payload.results
          : [];
    const meta = 'meta' in payload ? payload.meta : undefined;
    const totalValue = payload.total ?? meta?.total;
    const page = Number(payload.page ?? meta?.page ?? requested['page'] ?? 1);
    const limit = Number(
      payload.limit ??
        meta?.limit ??
        requested['limit'] ??
        (data.length || 1),
    );
    const total =
      typeof totalValue === 'number' && totalValue >= data.length
        ? totalValue
        : data.length;
    const totalPages = Number(
      payload.totalPages ??
        meta?.totalPages ??
        Math.max(1, Math.ceil(total / Math.max(1, limit))),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
