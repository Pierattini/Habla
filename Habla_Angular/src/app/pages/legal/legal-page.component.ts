import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type LegalPage = {
  title: string;
  eyebrow: string;
  updatedAt: string;
  intro: string;
  sections: Array<{
    title: string;
    body: string[];
  }>;
};

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
  ],
  templateUrl: './legal-page.component.html',
  styleUrls: ['./legal-page.component.scss'],
})
export class LegalPageComponent {
  private readonly pages: Record<string, LegalPage> = {
    privacy: {
      eyebrow: 'Privacidad',
      title: 'Privacy Policy',
      updatedAt: '17 de junio de 2026',
      intro: 'Esta politica explica como Habla trata informacion personal para operar una plataforma de atencion profesional, agenda, mensajeria y gestion de servicios.',
      sections: [
        {
          title: 'Datos que podemos recopilar',
          body: [
            'Datos de cuenta como nombre, email, rol, pais, zona horaria e imagen de perfil.',
            'Datos de uso de la plataforma, incluyendo citas, mensajes, preferencias, historial de actividad y configuraciones de agenda.',
            'Datos profesionales, tributarios o de pago cuando sean necesarios para prestar servicios, emitir documentos o gestionar actividad profesional.',
          ],
        },
        {
          title: 'Para que usamos los datos',
          body: [
            'Crear y administrar cuentas de pacientes, profesionales y administradores.',
            'Permitir reservas, mensajes, gestion de agenda, soporte y documentos asociados a la atencion.',
            'Mejorar seguridad, prevenir abuso, cumplir obligaciones legales y mantener la continuidad operativa del servicio.',
          ],
        },
        {
          title: 'Con quien compartimos informacion',
          body: [
            'Compartimos informacion solo cuando es necesario para prestar el servicio, por ejemplo entre paciente y profesional dentro de una cita.',
            'Podemos usar proveedores tecnicos para hosting, almacenamiento, correo, pagos, analitica operativa o soporte.',
            'No vendemos informacion personal.',
          ],
        },
        {
          title: 'Derechos del usuario',
          body: [
            'Puedes solicitar acceso, actualizacion, eliminacion o correccion de tus datos cuando corresponda.',
            'Tambien puedes solicitar informacion sobre el tratamiento de tus datos y retirar consentimientos no esenciales.',
          ],
        },
      ],
    },
    terms: {
      eyebrow: 'Condiciones',
      title: 'Terms and Conditions',
      updatedAt: '17 de junio de 2026',
      intro: 'Estos terminos regulan el uso de Habla como plataforma digital para conectar usuarios con profesionales y administrar servicios relacionados.',
      sections: [
        {
          title: 'Uso de la plataforma',
          body: [
            'Debes entregar informacion veraz, mantener segura tu cuenta y usar la plataforma de forma responsable.',
            'Habla puede actualizar funciones, suspender cuentas inactivas o restringir usos que afecten la seguridad o integridad del servicio.',
          ],
        },
        {
          title: 'Profesionales',
          body: [
            'Los profesionales son responsables de mantener actualizada su informacion, precios, disponibilidad, especialidad y condiciones de atencion.',
            'Cada profesional es responsable de cumplir sus obligaciones legales, tributarias y profesionales segun corresponda.',
          ],
        },
        {
          title: 'Citas, pagos y cancelaciones',
          body: [
            'Las reservas, reagendamientos, cancelaciones, documentos y pagos se gestionan segun las reglas visibles dentro de la plataforma.',
            'El historial de citas y actividad puede conservarse para fines operativos, soporte, seguridad y cumplimiento.',
          ],
        },
        {
          title: 'Limitacion de responsabilidad',
          body: [
            'Habla facilita herramientas tecnologicas para agenda, comunicacion y gestion. La relacion profesional se desarrolla entre usuario y profesional.',
            'El servicio puede requerir conexion a internet, disponibilidad de terceros y mantenimiento tecnico.',
          ],
        },
      ],
    },
    cookies: {
      eyebrow: 'Preferencias',
      title: 'Cookies and Tracking',
      updatedAt: '17 de junio de 2026',
      intro: 'Esta politica describe tecnologias de almacenamiento, cookies o identificadores similares que podrian usarse en versiones web o moviles de Habla.',
      sections: [
        {
          title: 'Tecnologias necesarias',
          body: [
            'Podemos usar almacenamiento local o identificadores tecnicos para mantener sesion, recordar preferencias y proteger la cuenta.',
            'Estas tecnologias son necesarias para que la plataforma funcione correctamente.',
          ],
        },
        {
          title: 'Analitica y mejora',
          body: [
            'En futuras versiones podriamos usar analitica para entender rendimiento, errores, navegacion y estabilidad.',
            'Cuando corresponda, se informara al usuario y se solicitaran consentimientos segun la normativa aplicable.',
          ],
        },
        {
          title: 'Cookies en app movil',
          body: [
            'En una app movil nativa las cookies pueden no funcionar igual que en una web, pero pueden existir tecnologias equivalentes como almacenamiento local, tokens o identificadores.',
            'Si Habla incorpora webviews, pagos externos, analitica o herramientas de soporte, podrian aplicar politicas adicionales de proveedores.',
          ],
        },
      ],
    },
  };

  page: LegalPage = this.pages['privacy'];

  constructor() {
    const path = window.location.pathname;
    const key = path.includes('terms')
      ? 'terms'
      : path.includes('cookies')
        ? 'cookies'
        : 'privacy';

    this.page = this.pages[key];
  }
}
