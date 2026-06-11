import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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

interface PendingTaxDocument {
  id: string;
  appointmentId: string;
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

interface TaxDocument {
  id: string;
  appointmentId: string;
  fileName?: string;
  uploadedAt?: string;
  status: string;
  type?: string;
}

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
  constructor(private http: HttpClient) {

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

  pendingTaxDocuments: PendingTaxDocument[] = [];
  taxDocuments: TaxDocument[] = [];

  saveProfile() {

  this.http.patch(
    'http://localhost:3000/users/me',
    {
      name: this.profile.name,
      image: this.profile.image
    }
  ).subscribe({
    
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

    this.http.get(
      'http://localhost:3000/users/me'
    ).subscribe((res: any) => {

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

  loadPendingTaxDocuments() {
    this.http.get<PendingTaxDocument[]>(
      'http://localhost:3000/tax-documents/professional/pending'
    ).subscribe({
      next: (documents) => {
        this.pendingTaxDocuments = documents;
      },
      error: (err) => {
        console.error('Error cargando documentos pendientes:', err);
        this.pendingTaxDocuments = [];
      }
    });
  }

  loadTaxDocuments() {
    this.http.get<TaxDocument[]>(
      'http://localhost:3000/tax-documents/professional'
    ).subscribe({
      next: (documents) => {
        this.taxDocuments = documents;
      },
      error: (err) => {
        console.error('Error cargando documentos tributarios:', err);
        this.taxDocuments = [];
      }
    });
  }

  getDocumentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DOCUMENT_PENDING: 'Pendiente',
      DOCUMENT_UPLOADED: 'Cargado',
      DOCUMENT_GENERATED: 'Generado',
      DOCUMENT_SENT: 'Enviado'
    };

    return labels[status] || status;
  }

  getDocumentTypeLabel(type?: string): string {
    return type || 'Sin tipo';
  }

}
