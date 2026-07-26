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
      title: 'Política de privacidad',
      updatedAt: '28 de junio de 2026',
      intro: 'Esta política explica cómo Conecta trata los datos personales de pacientes, profesionales y usuarios de la plataforma para operar cuentas, búsqueda de profesionales, solicitudes, agenda, mensajería, soporte y documentos asociados.',
      sections: [
        {
          title: 'Responsable del tratamiento',
          body: [
            'Responsable de la aplicación: Conecta.',
            'País principal de operación: Chile, con soporte para usuarios y profesionales que puedan encontrarse en otros países.',
            'Conecta opera como plataforma digital para agenda, comunicación, reservas, pagos informados por los usuarios y gestión entre pacientes y profesionales.',
            'Para solicitudes relacionadas con datos personales, privacidad o soporte legal, utiliza el correo oficial indicado abajo.',
            'Email de contacto: app.info.conect@gmail.com.',
          ],
        },
        {
          title: 'Marco legal',
          body: [
            'Conecta busca aplicar principios de transparencia, minimización de datos, seguridad, confidencialidad y control del usuario sobre su información.',
            'Cuando corresponda, el tratamiento se interpretará conforme a la normativa aplicable de protección de datos, incluyendo reglas chilenas, europeas y otras normas locales según el país del usuario.',
          ],
        },
        {
          title: 'Datos que podemos recopilar',
          body: [
            'Datos de cuenta como nombre, email, rol, país, zona horaria e imagen de perfil.',
            'Datos de uso de la plataforma, incluyendo citas, mensajes, preferencias, historial de actividad y configuraciones de agenda.',
            'Datos profesionales como especialidad, descripción, modalidad de atención, ciudad, país, disponibilidad, precios y experiencia.',
            'Datos de citas como profesional, paciente, fecha, hora, modalidad, estado, reagendamientos, cancelaciones, recordatorios y enlace de videollamada cuando exista.',
            'Datos de mensajería enviados dentro de Conecta, incluyendo texto, archivos asociados y metadatos necesarios para entregar soporte y comunicación entre las partes.',
            'Datos tributarios cuando el usuario solicita boleta, factura o documento tributario, por ejemplo nombre tributario, identificación fiscal, dirección, ciudad y correo.',
            'Datos de pago necesarios para operar el flujo de transferencia, confirmación de pago, reembolsos, creditos y estados de citas.',
            'Datos técnicos como dirección IP, dispositivo, sistema operativo, navegador, idioma, errores, eventos de seguridad y datos derivados de cookies o tecnologías equivalentes.',
          ],
        },
        {
          title: 'Para que usamos los datos',
          body: [
            'Crear y administrar cuentas de pacientes, profesionales y administradores.',
            'Permitir reservas, mensajes, gestión de agenda, soporte y documentos asociados a la atención.',
            'Mostrar profesionales compatibles con intereses, país, modalidad de atención y busquedas realizadas por el usuario.',
            'Enviar notificaciones operativas, como confirmaciones, recordatorios, recuperación de contraseña y avisos relacionados con citas.',
            'Gestionar solicitudes de documentos tributarios, conservar comprobantes, enviar documentos al paciente y permitir al profesional revisar historial operativo.',
            'Mejorar seguridad, prevenir abuso, proteger datos de contacto, cumplir obligaciones legales y mantener la continuidad operativa del servicio.',
          ],
        },
        {
          title: 'Base legal o fundamento del tratamiento',
          body: [
            'Consentimiento del usuario cuando entrega datos voluntariamente o acepta comunicaciones y preferencias opcionales.',
            'Ejecucion de una relación contractual o precontractual cuando el tratamiento es necesario para crear cuenta, solicitar cita, gestionar agenda o prestar servicios.',
            'Interes legitimo para mantener la seguridad, responder solicitudes, prevenir fraude y mejorar el funcionamiento de la plataforma.',
            'Obligacion legal cuando sea necesario conservar o comunicar información por requerimientos normativos, tributarios, administrativos o judiciales.',
          ],
        },
        {
          title: 'Con quien compartimos información',
          body: [
            'Compartimos información solo cuando es necesario para prestar el servicio, por ejemplo entre paciente y profesional dentro de una cita.',
            'Podemos usar proveedores tecnicos para hosting, almacenamiento, correo, notificaciones, pagos, analitica operativa, seguridad o soporte.',
            'Los proveedores deben acceder solo a la información necesaria para cumplir su funcion y tratarla bajo obligaciones de confidencialidad y seguridad.',
            'No vendemos información personal.',
          ],
        },
        {
          title: 'Transferencias internacionales',
          body: [
            'Algunos proveedores tecnologicos podrian operar fuera del país del usuario. Si esto ocurre, Conecta buscara aplicar mecanismos razonables de protección, contratos adecuados y medidas de seguridad proporcionales al riesgo.',
          ],
        },
        {
          title: 'Conservacion de datos',
          body: [
            'Conservaremos los datos durante el tiempo necesario para cumplir la finalidad para la que fueron recopilados, prestar el servicio, resolver incidencias, cumplir obligaciones legales o defender posibles reclamaciones.',
            'Los mensajes, citas y documentos asociados pueden conservarse por motivos de seguridad, soporte, trazabilidad, obligaciones tributarias o historial operativo de la relación entre paciente y profesional.',
            'Los datos asociados a comunicaciones comerciales o preferencias opcionales se conservarán hasta que el usuario retire su consentimiento o solicite su eliminación cuando corresponda.',
          ],
        },
        {
          title: 'Eliminación de cuenta y datos',
          body: [
            'El usuario puede solicitar la eliminación de su cuenta desde la app o mediante la página publica /delete-account si ya no tiene acceso a la aplicación.',
            'Al eliminar una cuenta, Conecta desactiva el acceso y anonimiza o elimina datos personales según corresponda.',
            'Podemos conservar información limitada cuando sea necesaria para seguridad, prevención de fraude, soporte, historial de citas, documentos tributarios u obligaciones legales.',
          ],
        },
        {
          title: 'Seguridad',
          body: [
            'Aplicamos medidas tecnicas y organizativas razonables para proteger la confidencialidad, integridad y disponibilidad de los datos.',
            'Recomendamos verificar siempre el dominio o la app oficial de Conecta, no compartir contrasenas y mantener actualizado el dispositivo.',
          ],
        },
        {
          title: 'Derechos del usuario',
          body: [
            'Puedes solicitar acceso, actualización, eliminación o corrección de tus datos cuando corresponda.',
            'También puedes solicitar información sobre el tratamiento de tus datos, oponerte cuando proceda, limitar ciertos tratamientos y retirar consentimientos no esenciales.',
            'Para ejercer tus derechos puedes escribir a app.info.conect@gmail.com indicando en el asunto: Derechos de datos personales.',
          ],
        },
        {
          title: 'Menores de edad',
          body: [
            'El uso de Conecta por menores de edad debe realizarse con autorización y supervisión de sus padres, tutores o representantes legales cuando la ley lo exija.',
          ],
        },
        {
          title: 'Actualizaciones',
          body: [
            'Esta política puede actualizarse periódicamente. La versión publicada en la app o sitio web será la vigente al momento de uso.',
          ],
        },
      ],
    },
    terms: {
      eyebrow: 'Condiciones',
      title: 'Términos y condiciones',
      updatedAt: '28 de junio de 2026',
      intro: 'Estos términos regulan el uso de Conecta como plataforma digital para conectar usuarios con profesionales y administrar servicios relacionados.',
      sections: [
        {
          title: 'Identificación de la plataforma',
          body: [
            'Conecta es una plataforma digital para buscar profesionales, solicitar citas, gestionar agenda, comunicación, documentos y servicios asociados.',
            'Responsable de la aplicación: Conecta.',
            'País principal de operación: Chile.',
            'Contacto oficial: app.info.conect@gmail.com.',
          ],
        },
        {
          title: 'Uso de la plataforma',
          body: [
            'Debes entregar información veraz, mantener segura tu cuenta y usar la plataforma de forma responsable.',
            'Conecta puede actualizar funciones, suspender cuentas inactivas o restringir usos que afecten la seguridad o integridad del servicio.',
            'No está permitido usar la plataforma para actividades ilegales, suplantación, abuso, spam, extracción masiva de datos o contacto directo destinado a evadir las reglas de Conecta.',
          ],
        },
        {
          title: 'Profesionales',
          body: [
            'Los profesionales son responsables de mantener actualizada su información, precios, disponibilidad, especialidad y condiciones de atención.',
            'Cada profesional es responsable de cumplir sus obligaciones legales, tributarias y profesionales según corresponda.',
            'Conecta puede ocultar información de contacto en perfiles públicos para proteger la experiencia de pacientes y profesionales dentro de la plataforma.',
          ],
        },
        {
          title: 'Citas, pagos y cancelaciones',
          body: [
            'Las reservas, reagendamientos, cancelaciones, documentos y pagos se gestionan según las reglas visibles dentro de la plataforma.',
            'Cuando el pago se informa por transferencia, el profesional debe confirmar su recepción para que la cita quede confirmada según el flujo de Conecta.',
            'Las reglas de cancelación y penalización se aplican según el estado de la cita, el pago confirmado y la anticipacion indicada dentro de la app.',
            'El historial de citas y actividad puede conservarse para fines operativos, soporte, seguridad y cumplimiento.',
          ],
        },
        {
          title: 'Documentos tributarios',
          body: [
            'El paciente puede solicitar datos para boleta, factura u otro documento tributario cuando el flujo lo permita.',
            'El profesional es responsable de emitir correctamente los documentos tributarios que correspondan a su actividad, salvo funciones automatizadas expresamente habilitadas por Conecta.',
            'Conecta puede almacenar datos, archivos y estados de documentos para permitir historial, reenvio, descarga y soporte.',
          ],
        },
        {
          title: 'Limitacion de responsabilidad',
          body: [
            'Conecta facilita herramientas tecnológicas para agenda, comunicación y gestión. La relación profesional se desarrolla entre usuario y profesional.',
            'El servicio puede requerir conexión a internet, disponibilidad de terceros y mantenimiento técnico.',
          ],
        },
        {
          title: 'Propiedad intelectual',
          body: [
            'Los textos, diseños, marcas, código, imágenes, logos y elementos de Conecta pertenecen a sus titulares o licenciantes y no pueden copiarse o explotarse sin autorización.',
          ],
        },
        {
          title: 'Cambios en el servicio',
          body: [
            'Conecta puede modificar estos términos, mejorar funcionalidades o ajustar reglas operativas. Los cambios aplicarán desde su publicación, salvo que se indique otra fecha.',
          ],
        },
      ],
    },
    cookies: {
      eyebrow: 'Cookies',
      title: 'Política de cookies',
      updatedAt: '28 de junio de 2026',
      intro: 'Esta política describe cookies, almacenamiento local, tokens e identificadores técnicos que pueden usarse en versiones web o móviles de Conecta.',
      sections: [
        {
          title: 'Tecnologías necesarias',
          body: [
            'Podemos usar almacenamiento local o identificadores tecnicos para mantener sesión, recordar preferencias y proteger la cuenta.',
            'Estas tecnologías son necesarias para que la plataforma funcione correctamente.',
          ],
        },
        {
          title: 'Analitica y mejora',
          body: [
            'En futuras versiones podriamos usar analitica para entender rendimiento, errores, navegacion y estabilidad.',
            'Cuando corresponda, se informara al usuario y se solicitaran consentimientos según la normativa aplicable.',
          ],
        },
        {
          title: 'Cookies de terceros',
          body: [
            'Si Conecta integra pagos, mapas, videollamadas, soporte, analitica o proveedores externos, esos servicios podrian usar cookies o tecnologías propias según sus politicas.',
            'Conecta no controla completamente las cookies de sitios externos a los que el usuario acceda mediante enlaces o integraciones.',
          ],
        },
        {
          title: 'Cookies en app móvil',
          body: [
            'En una app móvil nativa las cookies pueden no funcionar igual que en una web, pero pueden existir tecnologías equivalentes como almacenamiento local, tokens o identificadores.',
            'Si Conecta incorpora webviews, pagos externos, analitica o herramientas de soporte, podrian aplicar politicas adicionales de proveedores.',
          ],
        },
        {
          title: 'Gestión de preferencias',
          body: [
            'Puedes configurar cookies desde el navegador cuando uses la versión web. En la app móvil, algunas preferencias pueden depender del sistema operativo, permisos del dispositivo o configuraciones internas de Conecta.',
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
