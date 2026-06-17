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
  createOutline
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
  'create-outline': createOutline
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
  console.log('PROFILE CARGADO:', user);

  this.name = user.professional?.name || user.name;

console.log('IMAGEN:', user.professional?.image);

this.image = user.professional?.image || '';

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
    inputs: [
      {
        name: 'taxId',
        type: 'text',
        value: this.taxId,
        placeholder: this.role === 'PROFESSIONAL' ? 'RUT emisor' : 'RUT',
      },
      {
        name: 'taxName',
        type: 'text',
        value: this.taxName,
        placeholder: this.role === 'PROFESSIONAL' ? 'Razon social' : 'Nombre tributario',
      },
      {
        name: 'taxEmail',
        type: 'email',
        value: this.taxEmail,
        placeholder: 'Email tributario',
      },
      {
        name: 'taxCity',
        type: 'text',
        value: this.taxCity,
        placeholder: 'Ciudad o comuna',
      },
      {
        name: 'taxAddress',
        type: 'text',
        value: this.taxAddress,
        placeholder: 'Direccion tributaria',
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
            value: 'habla',
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
                documentAutomationEnabled: selected === 'habla',
                manualDocumentMode: selected !== 'habla',
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
}
