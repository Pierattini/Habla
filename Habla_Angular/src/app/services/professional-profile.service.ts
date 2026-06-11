import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ProfessionalProfileService {
  private api = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  getProfile() {
    return this.http.get(`${this.api}/users/me`);
  }

  updateProfile(data: { name: string; image: string }) {
    return this.http.patch(`${this.api}/users/me`, data);
  }
}
