import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private api = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  // 🔐 LOGIN
  login(email: string, password: string) {
    return this.http.post(`${this.api}/auth/login`, {
      email,
      password
    });
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
  getProfessionals() {
    return this.http.get(`${this.api}/users/professionals`, {
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