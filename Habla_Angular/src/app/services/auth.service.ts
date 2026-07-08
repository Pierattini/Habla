import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private api = API_URL;

  constructor(private http: HttpClient) {}

  // ðŸ” LOGIN
  login(email: string, password: string) {
    return this.http.post(`${this.api}/auth/login`, {
      email,
      password
    });
  }

  requestPasswordReset(email: string) {
    return this.http.post(`${this.api}/auth/request-password-reset`, { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post(`${this.api}/auth/reset-password`, {
      token,
      password,
    });
  }

  checkEmailAvailability(email: string) {
    const params = new URLSearchParams({ email });

    return this.http.get<{ available: boolean }>(
      `${this.api}/auth/email-available?${params.toString()}`
    );
  }

  register(data: {
    name: string;
    email: string;
    password: string;
    role: 'CUSTOMER' | 'PROFESSIONAL';
    customerInterests?: string[];
    preferredAttentionMode?: 'ONLINE' | 'PRESENTIAL' | 'BOTH';
    specialty?: string;
    professionId?: string;
    customProfession?: string;
    attentionMode?: 'ONLINE' | 'PRESENTIAL' | 'BOTH';
    acceptedTerms: boolean;
    recaptchaToken?: string;
  }) {
    return this.http.post(`${this.api}/auth/register`, data);
  }

  // ðŸ”¥ HEADERS CON TOKEN
  getHeaders() {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  // ðŸ‘¤ PERFIL (ðŸ”¥ ESTE ES CLAVE)
  getProfile() {
    return this.http.get(`${this.api}/auth/me`, {
      headers: this.getHeaders()
    });
  }

  // ðŸ“… CITAS DEL USUARIO
  getMyAppointments() {
  return this.http.get<any[]>(`${this.api}/appointments/mine`, {
    headers: this.getHeaders()
  });
}

  // ðŸ‘¨â€âš•ï¸ PROFESIONALES
  getProfessionals(params?: {
    page?: number;
    limit?: number;
    search?: string;
    specialty?: string;
    professionId?: string;
    professionSlug?: string;
    categorySlug?: string;
    attentionMode?: string;
    country?: 'CL' | 'ES';
  }) {
    const query = new URLSearchParams();

    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.specialty) query.set('specialty', params.specialty);
    if (params?.professionId) query.set('professionId', params.professionId);
    if (params?.professionSlug) query.set('professionSlug', params.professionSlug);
    if (params?.categorySlug) query.set('categorySlug', params.categorySlug);
    if (params?.attentionMode) query.set('attentionMode', params.attentionMode);
    if (params?.country) query.set('country', params.country);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    const url = `${this.api}/users/professionals${suffix}`;

    return this.http.get(url, {
      headers: this.getHeaders()
    });
  }

  getSearchSuggestions(params: { q: string; country?: 'CL' | 'ES' }) {
    const query = new URLSearchParams();

    query.set('q', params.q);
    if (params.country) query.set('country', params.country);

    return this.http.get<Array<{
      type: 'profession' | 'professional';
      id: string;
      slug?: string;
      label: string;
      specialty?: string;
      categoryName?: string | null;
      categorySlug?: string | null;
      city?: string | null;
    }>>(`${this.api}/users/search-suggestions?${query.toString()}`, {
      headers: this.getHeaders()
    });
  }
// ACTUALIZAR PERFIL
updateProfile(data: any) {
  return this.http.patch(`${this.api}/users/me`, data, {
    headers: this.getHeaders()
  });
}

deleteMyAccount(confirmation: string) {
  return this.http.delete(`${this.api}/auth/me/delete-account`, {
    headers: this.getHeaders(),
    body: { confirmation },
  });
}
// â° SLOTS DISPONIBLES (ðŸ”¥ ESTE FALTABA)
getAvailableSlots(professionalId: string, date: string) {
  return this.http.get<string[]>(
    `${this.api}/appointments/available-slots?professionalId=${professionalId}&date=${date}`,
    {
      headers: this.getHeaders()
    }
  );
}
}

