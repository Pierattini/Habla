import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from '../core/config/api.config';

export interface TaxProviderCredentialStatus {
  configured: boolean;
  provider: 'SII';
  rut: string | null;
  status: 'CONFIGURED' | 'INVALID' | 'DISABLED' | null;
  lastValidatedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  environment: 'CERTIFICATION' | 'PRODUCTION' | null;
  certificateFileName: string | null;
  certificateFingerprint: string | null;
  certificateUploadedAt: string | null;
}

export interface TaxProviderAuthTestResult {
  ok: boolean;
  provider: 'SII';
  environment: 'CERTIFICATION' | 'PRODUCTION';
  tokenPreview: string;
  lastValidatedAt: string | null;
  message: string;
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

  saveMyCredential(data: {
    rut: string;
    certificatePassword: string;
    certificate: File;
    environment: 'CERTIFICATION' | 'PRODUCTION';
  }) {
    const formData = new FormData();
    formData.append('rut', data.rut);
    formData.append('certificatePassword', data.certificatePassword);
    formData.append('environment', data.environment);
    formData.append('certificate', data.certificate);

    return this.http.post<TaxProviderCredentialStatus>(
      `${this.api}/tax-provider/me`,
      formData
    );
  }

  deleteMyCredential() {
    return this.http.delete<TaxProviderCredentialStatus>(
      `${this.api}/tax-provider/me`
    );
  }

  testSiiAuthentication() {
    return this.http.post<TaxProviderAuthTestResult>(
      `${this.api}/tax-provider/me/test-auth`,
      {}
    );
  }
}
