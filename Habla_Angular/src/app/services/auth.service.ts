import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private api = API_URL;

  constructor(private http: HttpClient) {}

  // 🔐 LOGIN
  login(email: string, password: string) {
    return this.http.post(`${this.api}/auth/login`, {
      email,
      password
    });
  }

  register(data: {
    name: string;
    email: string;
    password: string;
    role: 'CUSTOMER' | 'PROFESSIONAL';
    customerInterests?: string[];
    preferredAttentionMode?: 'ONLINE' | 'PRESENTIAL' | 'BOTH';
    specialty?: string;
    attentionMode?: 'ONLINE' | 'PRESENTIAL' | 'BOTH';
  }) {
    return this.http.post(`${this.api}/auth/register`, data);
  }

  // 🔥 HEADERS CON TOKEN
  getHeaders() {
    const token = localStorage.getItem('token');

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  // 👤 PERFIL (🔥 ESTE ES CLAVE)
  getProfile() {
    return this.http.get(`${this.api}/auth/me`, {
      headers: this.getHeaders()
    });
  }

  // 📅 CITAS DEL USUARIO
  getMyAppointments() {
  return this.http.get<any[]>(`${this.api}/appointments/mine`, {
    headers: this.getHeaders()
  });
}

  // 👨‍⚕️ PROFESIONALES
  getProfessionals(params?: {
    page?: number;
    limit?: number;
    search?: string;
    specialty?: string;
    professionId?: string;
    professionSlug?: string;
    categorySlug?: string;
    attentionMode?: string;
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

    const suffix = query.toString() ? `?${query.toString()}` : '';

    return this.http.get(`${this.api}/users/professionals${suffix}`, {
      headers: this.getHeaders()
    });
  }
  // ✏️ ACTUALIZAR PERFIL
updateProfile(data: any) {
  return this.http.patch(`${this.api}/users/me`, data, {
    headers: this.getHeaders()
  });
}
// ⏰ SLOTS DISPONIBLES (🔥 ESTE FALTABA)
getAvailableSlots(professionalId: string, date: string) {
  return this.http.get<string[]>(
    `${this.api}/appointments/available-slots?professionalId=${professionalId}&date=${date}`,
    {
      headers: this.getHeaders()
    }
  );
}
}
