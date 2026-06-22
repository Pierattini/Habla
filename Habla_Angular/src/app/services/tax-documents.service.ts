import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../core/config/api.config';

export interface PendingTaxDocument {
  id: string;
  appointmentId: string;
  fileName?: string;
  generatedAt?: string;
  uploadedAt?: string;
  sentAt?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  type?: string;
  provider?: string;
  providerDocumentId?: string;
  dteCode?: number;
  folio?: string;
  siiTrackId?: string;
  siiStatus?: string;
  siiStatusDetail?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  customer: {
    id: string;
    email: string;
    name?: string;
  };
  appointmentDate: string;
  amount?: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface TaxDocument {
  id: string;
  appointmentId: string;
  fileName?: string;
  generatedAt?: string;
  uploadedAt?: string;
  sentAt?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  status: string;
  type?: string;
  provider?: string;
  providerDocumentId?: string;
  dteCode?: number;
  folio?: string;
  siiTrackId?: string;
  siiStatus?: string;
  siiStatusDetail?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  createdAt?: string;
  amount?: number;
  currency?: string;
  customer?: {
    id?: string;
    email?: string;
    name?: string;
  };
  appointment?: {
    date?: string;
    customer?: {
      id?: string;
      email?: string;
      name?: string;
    };
  };
}

export interface TaxDocumentView {
  customerName: string;
  appointmentDate: string | null;
  issueDate: string | null;
  sentDate: string | null;
  statusLabel: string;
  typeLabel: string;
}

export interface DashboardTaxDocument {
  id: string;
  appointmentId: string;
  fileName?: string;
  generatedAt?: string;
  uploadedAt?: string;
  sentAt?: string;
  emailSent?: boolean;
  emailSentAt?: string;
  status: string;
  type?: string;
  provider?: string;
  providerDocumentId?: string;
  dteCode?: number;
  folio?: string;
  siiTrackId?: string;
  siiStatus?: string;
  siiStatusDetail?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  createdAt?: string;
  amount?: number;
  currency?: string;
  appointmentDate?: string;
  customer?: {
    id?: string;
    email?: string;
    name?: string;
  };
  appointment?: {
    date?: string;
    customer?: {
      id?: string;
      email?: string;
      name?: string;
    };
  };
  view?: TaxDocumentView;
}

@Injectable({
  providedIn: 'root'
})
export class TaxDocumentsService {
  private api = API_URL;

  constructor(private http: HttpClient) {}

  getProfessionalDocuments() {
    return this.http.get<TaxDocument[]>(
      `${this.api}/tax-documents/professional`
    );
  }

  getMyDocuments() {
    return this.http.get<TaxDocument[]>(
      `${this.api}/tax-documents/my`
    );
  }

  getPendingDocuments() {
    return this.http.get<PendingTaxDocument[]>(
      `${this.api}/tax-documents/professional/pending`
    );
  }

  uploadDocument(documentId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<TaxDocument>(
      `${this.api}/tax-documents/${documentId}/upload-file`,
      formData
    );
  }

  markGenerated(documentId: string) {
    return this.http.patch<TaxDocument>(
      `${this.api}/tax-documents/${documentId}/generated`,
      {}
    );
  }

  markSent(documentId: string) {
    return this.http.patch<TaxDocument>(
      `${this.api}/tax-documents/${documentId}/sent`,
      {}
    );
  }

  resendEmail(documentId: string) {
    return this.http.post<TaxDocument>(
      `${this.api}/tax-documents/${documentId}/resend-email`,
      {}
    );
  }

  issueLibreDte(documentId: string, kind?: string) {
    return this.http.post<TaxDocument>(
      `${this.api}/tax-documents/${documentId}/issue-libredte`,
      kind ? { kind } : {}
    );
  }

  syncProviderStatus(documentId: string) {
    return this.http.post<TaxDocument>(
      `${this.api}/tax-documents/${documentId}/sync-provider-status`,
      {}
    );
  }

  getProviderPdf(documentId: string) {
    return this.http.get<{ url: string }>(
      `${this.api}/tax-documents/${documentId}/pdf`
    );
  }

  getProviderXml(documentId: string) {
    return this.http.get<{ url: string }>(
      `${this.api}/tax-documents/${documentId}/xml`
    );
  }
}
