import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { API_URL } from '../../core/config/api.config';
import {
  DashboardTaxDocument,
  TaxDocument,
  TaxDocumentsService,
} from '../../services/tax-documents.service';

@Component({
  selector: 'app-tax-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonButton],
  templateUrl: './tax-documents.component.html',
  styleUrls: ['./tax-documents.component.scss'],
})
export class TaxDocumentsComponent {
  documents: DashboardTaxDocument[] = [];
  selectedDocumentFiles: Record<string, File> = {};
  uploadingDocumentIds: Record<string, boolean> = {};
  documentActionIds: Record<string, boolean> = {};
  search = '';
  patient = '';
  status = 'ALL';
  fromDate = '';
  toDate = '';
  page = 1;
  limit = 20;
  total = 0;
  totalPages = 1;
  loading = false;
  loadingMore = false;
  feedbackMessage = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly documentFilters = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Pendientes', value: 'DOCUMENT_PENDING' },
    { label: 'Subidos', value: 'DOCUMENT_UPLOADED' },
    { label: 'Generados', value: 'DOCUMENT_GENERATED' },
    { label: 'Enviados', value: 'DOCUMENT_SENT' },
    { label: 'Con error', value: 'DOCUMENT_FAILED' },
  ];

  private readonly allowedTaxDocumentTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
  ];

  constructor(
    private readonly taxDocumentsService: TaxDocumentsService,
    private readonly router: Router,
  ) {}

  ionViewWillEnter(): void {
    this.loadDocuments(true);
  }

  goBack(): void {
    this.router.navigate(['/tabs/professional-dashboard']);
  }

  onSearchChange(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => this.loadDocuments(true), 300);
  }

  applyFilters(): void {
    this.loadDocuments(true);
  }

  clearFilters(): void {
    this.search = '';
    this.patient = '';
    this.status = 'ALL';
    this.fromDate = '';
    this.toDate = '';
    this.loadDocuments(true);
  }

  loadMore(): void {
    if (this.loading || this.loadingMore || this.page >= this.totalPages) return;

    this.page += 1;
    this.loadDocuments(false);
  }

  loadDocuments(reset: boolean): void {
    if (reset) {
      this.page = 1;
      this.documents = [];
      this.loading = true;
    } else {
      this.loadingMore = true;
    }

    this.taxDocumentsService.getProfessionalDocumentsPage({
      search: this.search,
      patient: this.patient,
      status: this.status === 'ALL' ? '' : this.status,
      fromDate: this.fromDate,
      toDate: this.toDate,
      page: this.page,
      limit: this.limit,
    }).subscribe({
      next: (response) => {
        const mapped = response.data.map((document) =>
          this.prepareDocumentView(document)
        );

        this.documents = reset ? mapped : [...this.documents, ...mapped];
        this.total = response.total;
        this.totalPages = response.totalPages;
      },
      error: (err) => {
        console.error('Error cargando documentos tributarios:', err);
        this.feedbackMessage = 'No se pudieron cargar los documentos.';
      },
      complete: () => {
        this.loading = false;
        this.loadingMore = false;
      },
    });
  }

  onTaxDocumentFileSelected(documentId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!this.allowedTaxDocumentTypes.includes(file.type)) {
      input.value = '';
      delete this.selectedDocumentFiles[documentId];
      this.feedbackMessage = 'Solo puedes subir PDF, JPG, JPEG o PNG.';
      return;
    }

    this.selectedDocumentFiles[documentId] = file;
  }

  getSelectedDocumentFileName(documentId: string): string {
    return this.selectedDocumentFiles[documentId]?.name || '';
  }

  uploadTaxDocument(documentId: string): void {
    const file = this.selectedDocumentFiles[documentId];

    if (!file || this.uploadingDocumentIds[documentId]) return;

    this.uploadingDocumentIds[documentId] = true;

    this.taxDocumentsService.uploadDocument(documentId, file).subscribe({
      next: () => {
        delete this.selectedDocumentFiles[documentId];
        this.feedbackMessage = 'Documento subido correctamente.';
        this.loadDocuments(true);
      },
      error: (err) => {
        console.error('Error subiendo documento tributario:', err);
        this.feedbackMessage = 'No se pudo subir el documento.';
        this.uploadingDocumentIds[documentId] = false;
      },
      complete: () => {
        this.uploadingDocumentIds[documentId] = false;
      },
    });
  }

  markDocumentGenerated(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.markGenerated(documentId),
      'Documento marcado como generado.',
      'No se pudo marcar como generado.',
    );
  }

  markDocumentSent(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.markSent(documentId),
      'Documento marcado como enviado.',
      'No se pudo marcar como enviado.',
    );
  }

  resendDocumentEmail(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.resendEmail(documentId),
      'Correo reenviado al paciente.',
      'No se pudo reenviar el correo.',
    );
  }

  finalizeLibreDteDocument(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.finalizeLibreDte(documentId),
      'Archivos y correo procesados.',
      'No se pudo completar el documento.',
    );
  }

  issueLibreDteDocument(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.issueLibreDte(documentId),
      'Emision solicitada a LibreDTE.',
      'No se pudo emitir con LibreDTE.',
    );
  }

  syncProviderStatus(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.syncProviderStatus(documentId),
      'Estado sincronizado.',
      'No se pudo sincronizar el estado.',
    );
  }

  runDocumentAction(
    documentId: string,
    action: () => Observable<TaxDocument>,
    successMessage: string,
    errorMessage: string,
  ): void {
    if (this.documentActionIds[documentId]) return;

    this.documentActionIds[documentId] = true;

    action().subscribe({
      next: () => {
        this.feedbackMessage = successMessage;
        this.loadDocuments(true);
      },
      error: (err: unknown) => {
        console.error(errorMessage, err);
        this.feedbackMessage = errorMessage;
        this.documentActionIds[documentId] = false;
      },
      complete: () => {
        this.documentActionIds[documentId] = false;
      },
    });
  }

  isDocumentActionRunning(documentId: string): boolean {
    return this.documentActionIds[documentId] === true;
  }

  isUploadingDocument(documentId: string): boolean {
    return this.uploadingDocumentIds[documentId] === true;
  }

  openDocument(document: DashboardTaxDocument): void {
    if (!document.pdfUrl) return;

    const url = document.pdfUrl.startsWith('http')
      ? document.pdfUrl
      : `${API_URL}${document.pdfUrl}`;

    window.open(url, '_blank', 'noopener');
  }

  openDocumentXml(document: DashboardTaxDocument): void {
    if (!document.xmlUrl) return;

    const url = document.xmlUrl.startsWith('http')
      ? document.xmlUrl
      : `${API_URL}${document.xmlUrl}`;

    window.open(url, '_blank', 'noopener');
  }

  canFinalizeLibreDte(document: DashboardTaxDocument): boolean {
    return !!document.providerDocumentId && (
      !document.pdfUrl ||
      !document.xmlUrl ||
      !document.emailSent
    );
  }

  prepareDocumentView(document: DashboardTaxDocument): DashboardTaxDocument {
    return {
      ...document,
      view: {
        customerName: this.getDocumentCustomerName(document),
        appointmentDate: this.getDocumentAppointmentDate(document),
        issueDate: this.getDocumentIssueDate(document),
        sentDate: this.getDocumentSentDate(document),
        statusLabel: this.getDocumentStatusLabel(document.status),
        typeLabel: this.getDocumentTypeLabel(document.type),
      },
    };
  }

  getDocumentCustomerName(document: DashboardTaxDocument): string {
    return document?.customer?.name ||
      document?.customer?.email ||
      document?.appointment?.customer?.name ||
      document?.appointment?.customer?.email ||
      'Paciente';
  }

  getDocumentAppointmentDate(document: DashboardTaxDocument): string | null {
    return document?.appointmentDate || document?.appointment?.date || null;
  }

  getDocumentIssueDate(document: DashboardTaxDocument): string | null {
    return document?.generatedAt || document?.uploadedAt || document?.createdAt || null;
  }

  getDocumentSentDate(document: DashboardTaxDocument): string | null {
    return document?.sentAt || document?.emailSentAt || null;
  }

  getDocumentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DOCUMENT_PENDING: 'Pendiente',
      DOCUMENT_UPLOADED: 'Documento cargado',
      DOCUMENT_GENERATED: 'Generado',
      DOCUMENT_SENT: 'Enviado',
      DOCUMENT_FAILED: 'Con error',
      DOCUMENT_NOT_REQUIRED: 'No requerido',
      DOCUMENT_CANCELLED: 'Cancelado',
    };

    return labels[status] || status || 'Sin estado';
  }

  getDocumentTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      BOLETA: 'Boleta',
      FACTURA: 'Factura',
      INVOICE: 'Invoice',
      RECEIPT: 'Recibo',
    };

    return type ? labels[type] || type : 'Documento';
  }
}
