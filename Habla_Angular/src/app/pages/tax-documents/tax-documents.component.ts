import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, Observable, timeout } from 'rxjs';
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
  reportMonth = new Date().toISOString().slice(0, 7);
  downloadingReport = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly documentFilters = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Pendiente', value: 'DOCUMENT_PENDING' },
    { label: 'Emitido', value: 'DOCUMENT_GENERATED' },
    { label: 'Enviado', value: 'DOCUMENT_SENT' },
    { label: 'Error', value: 'DOCUMENT_FAILED' },
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
    this.status = 'ALL';
    this.fromDate = '';
    this.toDate = '';
    this.loadDocuments(true);
  }

  // Boleta manual: para sesiones que no se agendaron por Conecta.
  manualFormOpen = false;
  manualSaving = false;
  manualMessage = '';
  manual = this.emptyManualForm();

  // Abierto: conserva lo ingresado para emitir varias seguidas. Al cerrar se limpia todo.
  toggleManualForm(): void {
    this.manualFormOpen = !this.manualFormOpen;
    if (!this.manualFormOpen) {
      this.manual = this.emptyManualForm();
      this.manualMessage = '';
    }
  }

  private emptyManualForm() {
    return {
    customerName: '',
    customerEmail: '',
    customerTaxId: '',
    customerAddress: '',
    customerCity: '',
    amount: '' as string | number,
    description: 'Sesión psicoterapia individual',
    sessionDate: '',
    };
  }

  createManualBoleta(): void {
    const m = this.manual;
    // Acepta "45000", "45.000" o "$45.000".
    const amount = Number(String(m.amount ?? '').replace(/[^\d]/g, ''));

    if (!m.customerName.trim() || !m.customerEmail.trim() || !m.sessionDate || !(amount > 0) || !m.description.trim()) {
      this.manualMessage = 'Completa nombre, correo, monto, descripción y fecha de la sesión.';
      return;
    }

    this.manualSaving = true;
    this.manualMessage = '';
    this.taxDocumentsService.createManualBoleta({
      customerName: m.customerName.trim(),
      customerEmail: m.customerEmail.trim(),
      customerTaxId: m.customerTaxId.trim() || undefined,
      customerAddress: m.customerAddress.trim() || undefined,
      customerCity: m.customerCity.trim() || undefined,
      amount: Math.round(amount),
      description: m.description.trim(),
      sessionDate: m.sessionDate,
    }).pipe(
      timeout(60_000),
      finalize(() => {
        this.manualSaving = false;
      }),
    ).subscribe({
      next: () => {
        const [y, mo, d] = m.sessionDate.split('-');
        this.manualMessage = `Boleta de la sesión del ${d}/${mo}/${y} enviada a emitir. Puedes ingresar la siguiente fecha.`;
        // Se mantienen paciente, monto y descripción para emitir varias seguidas.
        m.sessionDate = '';
        this.loadDocuments(true, true);
      },
      error: (err: any) => {
        const reason = err?.error?.message;
        this.manualMessage = Array.isArray(reason)
          ? `No se pudo emitir: ${reason.join(', ')}`
          : reason || 'No se pudo emitir la boleta.';
      },
    });
  }

  loadMore(): void {
    if (this.loading || this.loadingMore || this.page >= this.totalPages) return;

    this.page += 1;
    this.loadDocuments(false);
  }

  // silent: actualiza la lista sin vaciarla (tras reenviar, reintentar, etc.), así no parpadea.
  loadDocuments(reset: boolean, silent = false): void {
    if (reset) {
      this.page = 1;
      if (!silent) {
        this.documents = [];
        this.loading = true;
      }
    } else {
      this.loadingMore = true;
    }

    this.taxDocumentsService.getProfessionalDocumentsPage({
      search: this.search,
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
        this.loadDocuments(true, true);
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

  // Informe del mes en Excel (CSV): pacientes pagados, folios usados y estado de cada boleta.
  downloadMonthlyReport(): void {
    if (!this.reportMonth || this.downloadingReport) return;

    this.downloadingReport = true;
    this.taxDocumentsService.downloadMonthlyReport(this.reportMonth).subscribe({
      next: (file) => {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = `informe-${this.reportMonth}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        this.downloadingReport = false;
      },
      error: (err: unknown) => {
        console.error('No se pudo descargar el informe:', err);
        this.feedbackMessage = 'No se pudo descargar el informe del mes.';
        this.downloadingReport = false;
      },
    });
  }

  retryDocumentIssue(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.retryIssue(documentId),
      'Reintento en curso. La boleta se emitirá en unos segundos.',
      'No se pudo reintentar la boleta.',
    );
  }

  canRetryIssue(document: DashboardTaxDocument): boolean {
    return document.status === 'DOCUMENT_FAILED' && document.mode === 'AUTOMATED';
  }

  getFailureReason(document: DashboardTaxDocument): string {
    const reasons: Record<string, string> = {
      MISSING_TAX_PROVIDER_CREDENTIALS:
        'Falta configurar la emisión automática (certificado digital) en tu perfil.',
    };

    return (
      (document.siiStatus && reasons[document.siiStatus]) ||
      document.siiStatusDetail ||
      'El SII o el sistema no respondió. Puedes reintentar.'
    );
  }

  // Las boletas automáticas las emite Conecta con el SII: no llevan acciones manuales.
  isAutomatic(document: DashboardTaxDocument): boolean {
    return document.mode === 'AUTOMATED';
  }

  // Las citas se agendan en hora de Chile; se muestran igual sin importar dónde esté el navegador.
  formatChileDateTime(value?: string | Date | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value)).replace(/-/g, '/').replace(',', '');
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

    // Límite de tiempo: si el servidor se reinicia o no responde, el botón no queda pegado.
    action().pipe(
      timeout(60_000),
      finalize(() => {
        this.documentActionIds[documentId] = false;
      }),
    ).subscribe({
      next: () => {
        this.feedbackMessage = successMessage;
        this.loadDocuments(true, true);
      },
      error: (err: any) => {
        console.error(errorMessage, err);
        const reason = err?.name === 'TimeoutError'
          ? 'el servidor no respondió a tiempo, inténtalo de nuevo'
          : err?.error?.message;
        this.feedbackMessage = reason ? `${errorMessage} (${reason})` : errorMessage;
      },
    });
  }

  isDocumentActionRunning(documentId: string): boolean {
    return this.documentActionIds[documentId] === true;
  }

  isUploadingDocument(documentId: string): boolean {
    return this.uploadingDocumentIds[documentId] === true;
  }

  openDocument(taxDocument: DashboardTaxDocument): void {
    if (!taxDocument.pdfUrl || this.documentActionIds[taxDocument.id]) return;

    this.documentActionIds[taxDocument.id] = true;
    this.taxDocumentsService.downloadPdf(taxDocument.id).pipe(
      timeout(60_000),
      finalize(() => {
        this.documentActionIds[taxDocument.id] = false;
      }),
    ).subscribe({
      next: (file) => {
        const url = URL.createObjectURL(new Blob([file], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = taxDocument.folio ? `boleta-${taxDocument.folio}.pdf` : 'documento.pdf';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      },
      error: (err: unknown) => {
        console.error('No se pudo descargar el PDF:', err);
        this.feedbackMessage = 'No se pudo descargar el PDF. Inténtalo de nuevo.';
      },
    });
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
      (document as any)?.customerTaxName ||
      (document as any)?.appointment?.guestCustomerName ||
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
      DOCUMENT_UPLOADED: 'Emitido',
      DOCUMENT_GENERATED: 'Emitido',
      DOCUMENT_SENT: 'Enviado',
      DOCUMENT_FAILED: 'Error',
      DOCUMENT_NOT_REQUIRED: 'No requerido',
      DOCUMENT_CANCELLED: 'Cancelado',
    };

    return labels[status] || status || 'Sin estado';
  }

  getDocumentTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      BOLETA: 'Boleta',
      FACTURA: 'Boleta',
      INVOICE: 'Invoice',
      RECEIPT: 'Recibo',
    };

    return type ? labels[type] || type : 'Documento';
  }
}
