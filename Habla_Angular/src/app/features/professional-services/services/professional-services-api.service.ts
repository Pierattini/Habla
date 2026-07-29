import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_URL } from '../../../core/config/api.config';
import {
  CreateProfessionalServicePayload,
  ProfessionalService,
  ProfessionalServiceMode,
  ProfessionalServiceModeResponse,
  ProfessionalServicesCatalog,
  ProfessionalServiceStatus,
  PublicProfessionalServicesCatalog,
  UpdateProfessionalServicePayload,
} from '../models/professional-service.models';

@Injectable({ providedIn: 'root' })
export class ProfessionalServicesApiService {
  private readonly api = `${API_URL}/professional-services`;

  constructor(private readonly http: HttpClient) {}

  getOwnCatalog() {
    return this.http.get<ProfessionalServicesCatalog>(this.api);
  }

  getOwnService(id: string) {
    return this.http.get<ProfessionalService>(`${this.api}/${encodeURIComponent(id)}`);
  }

  create(payload: CreateProfessionalServicePayload) {
    return this.http.post<ProfessionalService>(this.api, payload);
  }

  update(id: string, payload: UpdateProfessionalServicePayload) {
    return this.http.patch<ProfessionalService>(`${this.api}/${encodeURIComponent(id)}`, payload);
  }

  changeMode(serviceMode: ProfessionalServiceMode) {
    return this.http.patch<ProfessionalServiceModeResponse>(`${this.api}/mode`, { serviceMode });
  }

  changeStatus(id: string, status: ProfessionalServiceStatus) {
    return this.http.patch<ProfessionalService>(`${this.api}/${encodeURIComponent(id)}/status`, {
      status,
    });
  }

  changeVisibility(id: string, showInProfile: boolean) {
    return this.http.patch<ProfessionalService>(
      `${this.api}/${encodeURIComponent(id)}/visibility`,
      { showInProfile },
    );
  }

  reorder(orderedIds: string[]) {
    return this.http.patch<ProfessionalService[]>(`${this.api}/reorder`, { orderedIds });
  }

  archive(id: string) {
    return this.http.delete<ProfessionalService>(`${this.api}/${encodeURIComponent(id)}`);
  }

  getPublicCatalog(slug: string) {
    return this.http.get<PublicProfessionalServicesCatalog>(
      `${API_URL}/professionals/public/${encodeURIComponent(slug)}/services`,
    );
  }
}
