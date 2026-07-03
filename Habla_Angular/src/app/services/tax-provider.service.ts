import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from '../core/config/api.config';

export interface TaxProviderCredentialStatus {
  configured: boolean;
  provider: 'LIBREDTE';
  rut: string | null;
  status: 'CONFIGURED' | 'INVALID' | 'DISABLED' | null;
  lastValidatedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class TaxProviderService {
  private api = API_URL;

  constructor(private http: HttpClient) {}

  getMyCredential() {
    return this.http.get<TaxProviderCredentialStatus>(
      `${this.api}/tax-provider/me`
    );
  }

  saveMyCredential(data: { rut: string; apiToken: string }) {
    return this.http.post<TaxProviderCredentialStatus>(
      `${this.api}/tax-provider/me`,
      data
    );
  }

  deleteMyCredential() {
    return this.http.delete<TaxProviderCredentialStatus>(
      `${this.api}/tax-provider/me`
    );
  }
}
