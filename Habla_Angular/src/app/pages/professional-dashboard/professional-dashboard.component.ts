import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TaxDocumentsService
} from '../../services/tax-documents.service';
import { ProfessionalProfileService } from '../../services/professional-profile.service';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardContent,
  IonButton,
  IonInput,
  IonTextarea,
  IonItem,
  IonLabel,
  IonIcon
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  imageOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  templateUrl: './professional-dashboard.component.html',
  styleUrls: ['./professional-dashboard.component.scss'],
  imports: [
    CommonModule,
    FormsModule,

    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardContent,
    IonButton,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonIcon
  ]
})
export class ProfessionalDashboardComponent {
  imageVersion = Date.now();
  selectedDocumentFiles: Record<string, File> = {};
  uploadingDocumentIds: Record<string, boolean> = {};
  documentActionIds: Record<string, boolean> = {};
  selectedDocumentFilter = 'ALL';
  documentFilters = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Pendientes', value: 'DOCUMENT_PENDING' },
    { label: 'Subidos', value: 'DOCUMENT_UPLOADED' },
    { label: 'Enviados', value: 'DOCUMENT_SENT' },
    { label: 'Fallidos', value: 'DOCUMENT_FAILED' },
  ];
  private readonly allowedTaxDocumentTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png'
  ];

  constructor(
    private professionalProfileService: ProfessionalProfileService,
    private taxDocumentsService: TaxDocumentsService
  ) {

    addIcons({
      'image-outline': imageOutline
    });

  }

  ionViewWillEnter() {
    this.loadProfile();
    this.loadPendingTaxDocuments();
    this.loadTaxDocuments();
  }

  profile = {
    name: '',
    specialty: '',
    description: '',
    price: 0,

    // duración real sesión
    duration: 90,

    // cada cuánto aparece una nueva hora
    interval: 15,

    rules: '',
    image: ''
  };

  // 🔥 BLOQUES HORARIOS
  availability = [

    {
      day: 'Lunes',
      enabled: true,
      start: '09:00',
      end: '18:00'
    },

    {
      day: 'Martes',
      enabled: true,
      start: '09:00',
      end: '18:00'
    },

    {
      day: 'Miércoles',
      enabled: false,
      start: '09:00',
      end: '18:00'
    },

    {
      day: 'Jueves',
      enabled: false,
      start: '09:00',
      end: '18:00'
    },

    {
      day: 'Viernes',
      enabled: false,
      start: '09:00',
      end: '18:00'
    }

  ];

  pendingTaxDocuments: any[] = [];
  taxDocuments: any[] = [];
  dashboardView = {
    pendingDocumentsCount: 0,
    sentDocumentsCount: 0,
    emittedThisMonthCount: 0,
    filteredTaxDocuments: [] as any[],
  };

  saveProfile() {

  this.professionalProfileService.updateProfile({
      name: this.profile.name,
      image: this.profile.image
    }).subscribe({
    
    next: (res) => {

      console.log('GUARDADO:', res);
      //this.imageVersion = Date.now();
      alert('Perfil actualizado');

      this.loadProfile();

    },

    error: (err) => {

      console.error(err);

      alert('Error actualizando perfil');

    }

  });

}
onFileSelected(event: any) {

  console.log('INPUT OK');

  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e: any) => {

    console.log('IMAGEN CARGADA');

    this.profile = {
      ...this.profile,
      image: e.target.result
    };
    //this.imageVersion = Date.now();
  };

  reader.readAsDataURL(file);

  }
  loadProfile() {

    this.professionalProfileService.getProfile().subscribe((res: any) => {

      console.log('PROFILE:', res);

      this.profile = {
        name: res.professional?.name || '',
        specialty: res.professional?.specialty || '',
        description: res.professional?.description || '',
        price: res.professional?.price || 0,
        duration: res.professional?.duration || 90,
        interval: res.professional?.interval || 15,
        rules: res.professional?.rules || '',
        image: res.professional?.image || ''
      };

    });

  }

  loadPendingTaxDocuments(): void {
    this.taxDocumentsService.getPendingDocuments().subscribe({
      next: (documents) => {
        this.pendingTaxDocuments = documents.map((document) =>
          this.prepareDocumentView(document)
        );
        this.updateDashboardView();
      },
      error: (err) => {
        console.error('Error cargando documentos pendientes:', err);
        this.pendingTaxDocuments = [];
      }
    });
  }

  loadTaxDocuments(): void {
    this.taxDocumentsService.getProfessionalDocuments().subscribe({
      next: (documents) => {
        this.taxDocuments = documents.map((document) =>
          this.prepareDocumentView(document)
        );
        this.updateDashboardView();
      },
      error: (err) => {
        console.error('Error cargando documentos tributarios:', err);
        this.taxDocuments = [];
      }
    });
  }

  get filteredTaxDocuments(): any[] {
    if (this.selectedDocumentFilter === 'ALL') {
      return this.taxDocuments;
    }

    return this.taxDocuments.filter(
      (document) => document.status === this.selectedDocumentFilter
    );
  }

  get pendingDocumentsCount(): number {
    return this.taxDocuments.filter(
      (document) => document.status === 'DOCUMENT_PENDING'
    ).length;
  }

  get sentDocumentsCount(): number {
    return this.taxDocuments.filter(
      (document) => document.status === 'DOCUMENT_SENT'
    ).length;
  }

  get emittedThisMonthCount(): number {
    const now = new Date();

    return this.taxDocuments.filter((document) => {
      const dateValue = document.generatedAt || document.uploadedAt || document.sentAt;

      if (!dateValue) return false;

      const date = new Date(dateValue);

      return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
    }).length;
  }

  setDocumentFilter(filter: string): void {
    this.selectedDocumentFilter = filter;
    this.updateDashboardView();
  }

  updateDashboardView(): void {
    const filteredTaxDocuments = this.selectedDocumentFilter === 'ALL'
      ? this.taxDocuments
      : this.taxDocuments.filter(
        (document) => document.status === this.selectedDocumentFilter
      );

    this.dashboardView = {
      pendingDocumentsCount: this.pendingDocumentsCount,
      sentDocumentsCount: this.sentDocumentsCount,
      emittedThisMonthCount: this.emittedThisMonthCount,
      filteredTaxDocuments,
    };
  }

  prepareDocumentView(document: any): any {
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

  onTaxDocumentFileSelected(documentId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!this.allowedTaxDocumentTypes.includes(file.type)) {
      input.value = '';
      delete this.selectedDocumentFiles[documentId];
      alert('Solo puedes subir PDF, JPG, JPEG o PNG');
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
        this.loadPendingTaxDocuments();
        this.loadTaxDocuments();
      },
      error: (err) => {
        console.error('Error subiendo documento tributario:', err);
        this.uploadingDocumentIds[documentId] = false;
        alert('No se pudo subir el documento');
      },
      complete: () => {
        this.uploadingDocumentIds[documentId] = false;
      }
    });
  }

  markDocumentGenerated(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.markGenerated(documentId),
      'No se pudo marcar como generado'
    );
  }

  markDocumentSent(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.markSent(documentId),
      'No se pudo marcar como enviado'
    );
  }

  resendDocumentEmail(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.resendEmail(documentId),
      'No se pudo reenviar el correo'
    );
  }

  runDocumentAction(
    documentId: string,
    action: () => any,
    errorMessage: string
  ): void {
    if (this.documentActionIds[documentId]) return;

    this.documentActionIds[documentId] = true;

    action().subscribe({
      next: () => {
        this.loadPendingTaxDocuments();
        this.loadTaxDocuments();
      },
      error: (err: any) => {
        console.error(errorMessage, err);
        this.documentActionIds[documentId] = false;
        alert(errorMessage);
      },
      complete: () => {
        this.documentActionIds[documentId] = false;
      }
    });
  }

  isDocumentActionRunning(documentId: string): boolean {
    return this.documentActionIds[documentId] === true;
  }

  isUploadingDocument(documentId: string): boolean {
    return this.uploadingDocumentIds[documentId] === true;
  }

  openDocument(document: any): void {
    if (!document.pdfUrl) return;

    const url = document.pdfUrl.startsWith('http')
      ? document.pdfUrl
      : `http://localhost:3000${document.pdfUrl}`;

    window.open(url, '_blank', 'noopener');
  }

  getDocumentCustomerName(document: any): string {
    return document?.customer?.name ||
      document?.customer?.email ||
      document?.appointment?.customer?.name ||
      document?.appointment?.customer?.email ||
      'Cliente';
  }

  getDocumentAppointmentDate(document: any): string | null {
    return document?.appointmentDate || document?.appointment?.date || null;
  }

  getDocumentIssueDate(document: any): string | null {
    return document?.generatedAt || document?.uploadedAt || document?.createdAt || null;
  }

  getDocumentSentDate(document: any): string | null {
    return document?.sentAt || document?.emailSentAt || null;
  }

  getDocumentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DOCUMENT_PENDING: 'Pendiente',
      DOCUMENT_UPLOADED: 'Documento cargado',
      DOCUMENT_GENERATED: 'Generado',
      DOCUMENT_SENT: 'Enviado',
      DOCUMENT_FAILED: 'Falló',
      DOCUMENT_NOT_REQUIRED: 'No requerido',
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
