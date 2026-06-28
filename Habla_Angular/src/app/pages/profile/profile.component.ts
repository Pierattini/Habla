import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AlertController } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';


type Appointment = {
  id: string;
  date: string;
  professional: {
    name: string;
    professional: {
      specialty?: string;
      price?: number;
      duration?: number;
    };
  };
};

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  mailOutline,
  shieldOutline,
  logOutOutline,
  createOutline,
  imageOutline,
  closeCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    RouterLink
  ]
})

export class ProfileComponent {
  loading = true;
  loaded = false;
  private profileRequestsPending = 0;

  // 👤 USUARIO
  name = '';
  email = '';
  image = '';
  role = '';
  country = '';
  timezone = '';
  taxId = '';
  taxName = '';
  taxEmail = '';
  taxAddress = '';
  taxCountry = '';
  taxCity = '';
  wantsTaxDocumentByDefault = false;
  documentAutomationEnabled = false;
  manualDocumentMode = true;
  defaultAvatars = [
    this.buildDefaultAvatar('#a855f7', '#ec4899'),
    this.buildDefaultAvatar('#7c3aed', '#38bdf8'),
    this.buildDefaultAvatar('#14b8a6', '#a855f7'),
    this.buildDefaultAvatar('#f97316', '#facc15'),
    this.buildDefaultAvatar('#2563eb', '#22c55e'),
  ];

  availableCountries = [
  { label: 'Chile', value: 'CL' },
  { label: 'España', value: 'ES' },
  { label: 'Argentina', value: 'AR' },
  { label: 'Colombia', value: 'CO' },
  { label: 'Alemania', value: 'DE' },
  { label: 'Estados Unidos', value: 'US' },
  { label: 'Canadá', value: 'CA' },
  { label: 'Australia', value: 'AU' },
  { label: 'China', value: 'CN' },
];

  // 📅 CITAS
  nextAppointment: any = null;
  totalAppointments = 0;

  constructor(
  private auth: AuthService,
  private alertCtrl: AlertController,
  private router: Router,
  private cdr: ChangeDetectorRef
) {
    addIcons({
  'person-circle-outline': personCircleOutline,
  'mail-outline': mailOutline,
  'shield-outline': shieldOutline,
  'log-out-outline': logOutOutline,
  'create-outline': createOutline,
  'image-outline': imageOutline,
  'close-circle-outline': closeCircleOutline
});
  }

  ionViewWillEnter() {
    this.loadProfileData();
  }

  loadProfileData() {
    this.loading = true;
    this.loaded = false;
    this.profileRequestsPending = 2;

    // 👤 PERFIL
    this.auth.getProfile().subscribe({
      next: (user: any) => {
  this.name = user.professional?.name || user.name;

this.image = user.professional?.image || user.image || '';

this.email = user.email;
this.role = user.role;
this.country = user.country || '';
this.timezone = user.timezone || '';
const professionalTax = user.professional || {};
this.taxId = professionalTax.taxId || user.taxId || '';
this.taxName = professionalTax.taxName || user.taxName || '';
this.taxEmail = professionalTax.taxEmail || user.taxEmail || '';
this.taxAddress = professionalTax.taxAddress || user.taxAddress || '';
this.taxCountry = professionalTax.taxCountry || user.taxCountry || user.country || '';
this.taxCity = professionalTax.taxCity || user.taxCity || '';
this.wantsTaxDocumentByDefault = user.wantsTaxDocumentByDefault === true;
this.documentAutomationEnabled = professionalTax.documentAutomationEnabled === true;
this.manualDocumentMode = professionalTax.manualDocumentMode !== false;
this.finishProfileRequest();
},
      error: (err) => {
  console.error('ERROR PERFIL:', err);
  this.finishProfileRequest();
}
    });

    // 📅 CITAS
    this.auth.getMyAppointments().subscribe({
  next: (appointments: Appointment[]) => {

    this.totalAppointments = appointments.length;

    const sorted = appointments.sort((a: Appointment, b: Appointment) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const now = new Date();

    this.nextAppointment = sorted.find((a: Appointment) =>
      new Date(a.date) > now
    ) || null;
    this.finishProfileRequest();
  },
  error: (err) => {
    console.error('Error citas:', err);
    this.totalAppointments = 0;
    this.nextAppointment = null;
    this.finishProfileRequest();
  }
});
  }

finishProfileRequest() {
  this.profileRequestsPending = Math.max(0, this.profileRequestsPending - 1);

  if (this.profileRequestsPending === 0) {
    this.loading = false;
    this.loaded = true;
    this.cdr.detectChanges();
  }
}
async editName() {
  const alert = await this.alertCtrl.create({
    header: 'Editar nombre',
    inputs: [
      {
        name: 'name',
        type: 'text',
        value: this.name,
        placeholder: 'Nuevo nombre'
      }
    ],
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Guardar',
        handler: (data) => {
          if (!data.name) return false;

          this.auth.updateProfile({ name: data.name }).subscribe(() => {
            this.name = data.name;
          });

          return true;
        }
      }
    ]
  });

  await alert.present();
}

onProfileImageSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    window.alert('Selecciona una imagen valida.');
    input.value = '';
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    window.alert('La imagen no puede superar 2 MB.');
    input.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = (e: ProgressEvent<FileReader>) => {
    const image = String(e.target?.result || '');

    if (!image) return;

    this.saveProfileImage(image);
    input.value = '';
  };

  reader.readAsDataURL(file);
}

selectDefaultAvatar(avatar: string) {
  this.saveProfileImage(avatar);
}

clearProfileImage() {
  this.saveProfileImage('');
}

private saveProfileImage(image: string) {
  this.auth.updateProfile({ image }).subscribe({
    next: (updatedUser: any) => {
      this.image = updatedUser.professional?.image || updatedUser.image || image;
      this.cdr.detectChanges();
    },
    error: () => {
      window.alert('No se pudo actualizar la imagen. Intenta nuevamente.');
    },
  });
}

async editEmail() {
  const alert = await this.alertCtrl.create({
    header: 'Editar email',
    inputs: [
      {
        name: 'email',
        type: 'email',
        value: this.email,
        placeholder: 'Nuevo email'
      }
    ],
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Guardar',
        handler: (data) => {
          if (!data.email) return false;

          this.auth.updateProfile({ email: data.email }).subscribe(() => {
            this.email = data.email;
          });

          return true;
        }
      }
    ]
  });

  await alert.present();
}
async editCountry() {
  const alert = await this.alertCtrl.create({
    header: 'Selecciona tu país',
    inputs: this.availableCountries.map(country => ({
      type: 'radio',
      label: country.label,
      value: country.value,
      checked: this.country === country.value
    })),
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Guardar',
        handler: (selectedCountry) => {
          if (!selectedCountry) return false;

          this.auth.updateProfile({
            country: selectedCountry
          }).subscribe((updatedUser: any) => {

            this.country = updatedUser.country;
            this.timezone = updatedUser.timezone;

          });

          return true;
        }
      }
    ]
  });

  await alert.present();
}

async editTimezone() {
  const alert = await this.alertCtrl.create({
    header: 'Editar zona horaria',
    inputs: [
      {
        name: 'timezone',
        type: 'text',
        value: this.timezone,
        placeholder: 'Ej: America/Santiago'
      }
    ],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Guardar',
        handler: (data) => {
          if (!data.timezone) return false;

          this.auth.updateProfile({
            timezone: data.timezone
          }).subscribe(() => {
            this.timezone = data.timezone;
          });

          return true;
        }
      }
    ]
  });

  await alert.present();
}

async editTaxInfo() {
  const alert = await this.alertCtrl.create({
    header: this.role === 'PROFESSIONAL' ? 'Datos tributarios emisor' : 'Datos para boleta',
    message: 'Usa datos reales para documentos tributarios. RUT/NIF/DNI: 6 a 20 caracteres. Nombre: 3 a 120. Email valido. Ciudad: 2 a 80. Direccion: 5 a 160.',
    inputs: [
      {
        name: 'taxId',
        type: 'text',
        value: this.taxId,
        placeholder: this.role === 'PROFESSIONAL' ? 'RUT emisor' : 'RUT',
        attributes: {
          maxlength: 20,
          inputmode: 'text',
        },
      },
      {
        name: 'taxName',
        type: 'text',
        value: this.taxName,
        placeholder: this.role === 'PROFESSIONAL' ? 'Razon social' : 'Nombre tributario',
        attributes: {
          maxlength: 120,
        },
      },
      {
        name: 'taxEmail',
        type: 'email',
        value: this.taxEmail,
        placeholder: 'Email tributario',
        attributes: {
          maxlength: 120,
          inputmode: 'email',
        },
      },
      {
        name: 'taxCity',
        type: 'text',
        value: this.taxCity,
        placeholder: 'Ciudad o comuna',
        attributes: {
          maxlength: 80,
        },
      },
      {
        name: 'taxAddress',
        type: 'text',
        value: this.taxAddress,
        placeholder: 'Direccion tributaria',
        attributes: {
          maxlength: 160,
        },
      },
    ],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Guardar',
        handler: (data) => {
          const payload = {
            taxId: this.cleanOptional(data.taxId),
            taxName: this.cleanOptional(data.taxName),
            taxEmail: this.cleanOptional(data.taxEmail),
            taxAddress: this.cleanOptional(data.taxAddress),
            taxCountry: this.taxCountry || this.country,
            taxCity: this.cleanOptional(data.taxCity),
          };

          const validationError = this.validateTaxPayload(payload);

          if (validationError) {
            window.alert(validationError);
            return false;
          }

          this.auth.updateProfile(payload).subscribe((updatedUser: any) => {
            const professionalTax = updatedUser.professional || {};
            this.taxId = professionalTax.taxId || updatedUser.taxId || '';
            this.taxName = professionalTax.taxName || updatedUser.taxName || '';
            this.taxEmail = professionalTax.taxEmail || updatedUser.taxEmail || '';
            this.taxAddress = professionalTax.taxAddress || updatedUser.taxAddress || '';
            this.taxCountry = professionalTax.taxCountry || updatedUser.taxCountry || updatedUser.country || '';
            this.taxCity = professionalTax.taxCity || updatedUser.taxCity || '';
          });

          return true;
        }
      }
    ]
  });

  await alert.present();
}

async editDocumentPreference() {
  const isProfessional = this.role === 'PROFESSIONAL';
  const alert = await this.alertCtrl.create({
    header: isProfessional ? 'Gestion de documentos' : 'Preferencia de boleta',
    inputs: isProfessional
      ? [
          {
            type: 'radio',
            label: 'Emitire documentos por mi cuenta',
            value: 'manual',
            checked: !this.documentAutomationEnabled,
          },
          {
            type: 'radio',
            label: 'Quiero que Conecta los gestione',
            value: 'conecta',
            checked: this.documentAutomationEnabled,
          },
        ]
      : [
          {
            type: 'radio',
            label: 'Decidir al reservar',
            value: 'no',
            checked: !this.wantsTaxDocumentByDefault,
          },
          {
            type: 'radio',
            label: 'Pedir boleta por defecto',
            value: 'yes',
            checked: this.wantsTaxDocumentByDefault,
          },
        ],
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Guardar',
        handler: (selected) => {
          if (!selected) return false;

          const payload = isProfessional
            ? {
                documentAutomationEnabled: selected === 'conecta',
                manualDocumentMode: selected !== 'conecta',
              }
            : {
                wantsTaxDocumentByDefault: selected === 'yes',
              };

          this.auth.updateProfile(payload).subscribe((updatedUser: any) => {
            this.wantsTaxDocumentByDefault = updatedUser.wantsTaxDocumentByDefault === true;
            this.documentAutomationEnabled = updatedUser.professional?.documentAutomationEnabled === true;
            this.manualDocumentMode = updatedUser.professional?.manualDocumentMode !== false;
          });

          return true;
        }
      }
    ]
  });

  await alert.present();
}
getCountryLabel(code: string): string {
  const found = this.availableCountries.find(c => c.value === code);
  return found ? found.label : code;
}

formatTimezone(tz: string): string {
  return tz.replace('_', ' ').replace('/', ' / ');
}

formatTimezoneNice(tz: string): string {
  if (!tz) return '';

  const map: any = {
    'Santiago': 'Hora de Chile',
    'Madrid': 'Hora de España',
    'Bogota': 'Hora de Colombia',
    'Buenos_Aires': 'Hora de Argentina',
    'Berlin': 'Hora de Alemania'
  };

  const key = Object.keys(map).find(k => tz.includes(k));
  return key ? map[key] : tz.replace('_', ' ').replace('/', ' / ');
}

logout() {
  localStorage.clear();
  window.location.href = '/login';
}

goToAppointments() {
  this.router.navigateByUrl('/tabs/appointments');
}

getDocumentPreferenceLabel(): string {
  if (this.role === 'PROFESSIONAL') {
    return this.documentAutomationEnabled
      ? 'Conecta gestionara documentos'
      : 'Emision manual por profesional';
  }

  return this.wantsTaxDocumentByDefault
    ? 'Pedir boleta por defecto'
    : 'Decidir al reservar';
}

private cleanOptional(value: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

private validateTaxPayload(payload: {
  taxId?: string;
  taxName?: string;
  taxEmail?: string;
  taxAddress?: string;
  taxCity?: string;
}): string | null {
  const taxIdPattern = /^[a-zA-Z0-9.\-\s]{6,20}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (payload.taxId && !taxIdPattern.test(payload.taxId)) {
    return 'El RUT / NIF / DNI debe tener entre 6 y 20 caracteres. Usa solo letras, numeros, puntos, guion o espacios.';
  }

  if (payload.taxName && (payload.taxName.length < 3 || payload.taxName.length > 120)) {
    return 'El nombre tributario debe tener entre 3 y 120 caracteres.';
  }

  if (payload.taxEmail && (payload.taxEmail.length > 120 || !emailPattern.test(payload.taxEmail))) {
    return 'Ingresa un email tributario valido.';
  }

  if (payload.taxCity && (payload.taxCity.length < 2 || payload.taxCity.length > 80)) {
    return 'La ciudad o comuna debe tener entre 2 y 80 caracteres.';
  }

  if (payload.taxAddress && (payload.taxAddress.length < 5 || payload.taxAddress.length > 160)) {
    return 'La direccion tributaria debe tener entre 5 y 160 caracteres.';
  }

  return null;
}

private buildDefaultAvatar(primary: string, secondary: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${primary}"/>
          <stop offset="100%" stop-color="${secondary}"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="44" fill="#fbf7ff"/>
      <circle cx="80" cy="62" r="28" fill="url(#g)"/>
      <path d="M38 132c6-30 22-46 42-46s36 16 42 46" fill="url(#g)"/>
      <circle cx="80" cy="80" r="70" fill="none" stroke="url(#g)" stroke-width="8"/>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
}
