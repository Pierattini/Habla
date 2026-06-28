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
      title: 'Politica de privacidad',
      updatedAt: '28 de junio de 2026',
      intro: 'Esta politica explica como Conecta trata los datos personales de pacientes, profesionales y usuarios de la plataforma para operar cuentas, busqueda de profesionales, solicitudes, agenda, mensajeria, soporte y documentos asociados.',
      sections: [
        {
          title: 'Responsable del tratamiento',
          body: [
            'Entidad: Conecta / [Nombre legal de la empresa pendiente de completar].',
            'Comentario: reemplazar este texto por la razon social definitiva antes de publicar la version final.',
            'Registro o identificacion legal: [pendiente de completar].',
            'Domicilio: [pendiente de completar].',
            'Email de contacto: app.info.conect@gmail.com.',
          ],
        },
        {
          title: 'Marco legal',
          body: [
            'Conecta busca aplicar principios de transparencia, minimizacion de datos, seguridad, confidencialidad y control del usuario sobre su informacion.',
            'Cuando corresponda, el tratamiento se interpretara conforme a la normativa aplicable de proteccion de datos, incluyendo reglas chilenas, europeas y otras normas locales segun el pais del usuario.',
          ],
        },
        {
          title: 'Datos que podemos recopilar',
          body: [
            'Datos de cuenta como nombre, email, rol, pais, zona horaria e imagen de perfil.',
            'Datos de uso de la plataforma, incluyendo citas, mensajes, preferencias, historial de actividad y configuraciones de agenda.',
            'Datos profesionales como especialidad, descripcion, modalidad de atencion, ciudad, pais, disponibilidad, precios y experiencia.',
            'Datos tributarios cuando el usuario solicita boleta, factura o documento tributario, por ejemplo nombre tributario, identificacion fiscal, direccion, ciudad y correo.',
            'Datos tecnicos como direccion IP, dispositivo, sistema operativo, navegador, idioma, errores, eventos de seguridad y datos derivados de cookies o tecnologias equivalentes.',
          ],
        },
        {
          title: 'Para que usamos los datos',
          body: [
            'Crear y administrar cuentas de pacientes, profesionales y administradores.',
            'Permitir reservas, mensajes, gestion de agenda, soporte y documentos asociados a la atencion.',
            'Mostrar profesionales compatibles con intereses, pais, modalidad de atencion y busquedas realizadas por el usuario.',
            'Enviar notificaciones operativas, como confirmaciones, recordatorios, recuperacion de contrasena y avisos relacionados con citas.',
            'Mejorar seguridad, prevenir abuso, proteger datos de contacto, cumplir obligaciones legales y mantener la continuidad operativa del servicio.',
          ],
        },
        {
          title: 'Base legal o fundamento del tratamiento',
          body: [
            'Consentimiento del usuario cuando entrega datos voluntariamente o acepta comunicaciones y preferencias opcionales.',
            'Ejecucion de una relacion contractual o precontractual cuando el tratamiento es necesario para crear cuenta, solicitar cita, gestionar agenda o prestar servicios.',
            'Interes legitimo para mantener la seguridad, responder solicitudes, prevenir fraude y mejorar el funcionamiento de la plataforma.',
            'Obligacion legal cuando sea necesario conservar o comunicar informacion por requerimientos normativos, tributarios, administrativos o judiciales.',
          ],
        },
        {
          title: 'Con quien compartimos informacion',
          body: [
            'Compartimos informacion solo cuando es necesario para prestar el servicio, por ejemplo entre paciente y profesional dentro de una cita.',
            'Podemos usar proveedores tecnicos para hosting, almacenamiento, correo, notificaciones, pagos, analitica operativa, seguridad o soporte.',
            'Los proveedores deben acceder solo a la informacion necesaria para cumplir su funcion y tratarla bajo obligaciones de confidencialidad y seguridad.',
            'No vendemos informacion personal.',
          ],
        },
        {
          title: 'Transferencias internacionales',
          body: [
            'Algunos proveedores tecnologicos podrian operar fuera del pais del usuario. Si esto ocurre, Conecta buscara aplicar mecanismos razonables de proteccion, contratos adecuados y medidas de seguridad proporcionales al riesgo.',
          ],
        },
        {
          title: 'Conservacion de datos',
          body: [
            'Conservaremos los datos durante el tiempo necesario para cumplir la finalidad para la que fueron recopilados, prestar el servicio, resolver incidencias, cumplir obligaciones legales o defender posibles reclamaciones.',
            'Los datos asociados a comunicaciones comerciales o preferencias opcionales se conservaran hasta que el usuario retire su consentimiento o solicite su eliminacion cuando corresponda.',
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
            'Puedes solicitar acceso, actualizacion, eliminacion o correccion de tus datos cuando corresponda.',
            'Tambien puedes solicitar informacion sobre el tratamiento de tus datos, oponerte cuando proceda, limitar ciertos tratamientos y retirar consentimientos no esenciales.',
            'Para ejercer tus derechos puedes escribir a app.info.conect@gmail.com indicando en el asunto: Derechos de datos personales.',
          ],
        },
        {
          title: 'Menores de edad',
          body: [
            'El uso de Conecta por menores de edad debe realizarse con autorizacion y supervision de sus padres, tutores o representantes legales cuando la ley lo exija.',
          ],
        },
        {
          title: 'Actualizaciones',
          body: [
            'Esta politica puede actualizarse periodicamente. La version publicada en la app o sitio web sera la vigente al momento de uso.',
          ],
        },
      ],
    },
    terms: {
      eyebrow: 'Condiciones',
      title: 'Terminos y condiciones',
      updatedAt: '28 de junio de 2026',
      intro: 'Estos terminos regulan el uso de Conecta como plataforma digital para conectar usuarios con profesionales y administrar servicios relacionados.',
      sections: [
        {
          title: 'Identificacion de la plataforma',
          body: [
            'Conecta es una plataforma digital para buscar profesionales, solicitar citas, gestionar agenda, comunicacion, documentos y servicios asociados.',
            'Entidad operadora: Conecta / [Nombre legal de la empresa pendiente de completar].',
            'Comentario: completar la razon social, identificacion fiscal y domicilio antes de publicar la version definitiva.',
          ],
        },
        {
          title: 'Uso de la plataforma',
          body: [
            'Debes entregar informacion veraz, mantener segura tu cuenta y usar la plataforma de forma responsable.',
            'Conecta puede actualizar funciones, suspender cuentas inactivas o restringir usos que afecten la seguridad o integridad del servicio.',
            'No esta permitido usar la plataforma para actividades ilegales, suplantacion, abuso, spam, extraccion masiva de datos o contacto directo destinado a evadir las reglas de Conecta.',
          ],
        },
        {
          title: 'Profesionales',
          body: [
            'Los profesionales son responsables de mantener actualizada su informacion, precios, disponibilidad, especialidad y condiciones de atencion.',
            'Cada profesional es responsable de cumplir sus obligaciones legales, tributarias y profesionales segun corresponda.',
            'Conecta puede ocultar informacion de contacto en perfiles publicos para proteger la experiencia de pacientes y profesionales dentro de la plataforma.',
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
            'Conecta facilita herramientas tecnologicas para agenda, comunicacion y gestion. La relacion profesional se desarrolla entre usuario y profesional.',
            'El servicio puede requerir conexion a internet, disponibilidad de terceros y mantenimiento tecnico.',
          ],
        },
        {
          title: 'Propiedad intelectual',
          body: [
            'Los textos, disenos, marcas, codigo, imagenes, logos y elementos de Conecta pertenecen a sus titulares o licenciantes y no pueden copiarse o explotarse sin autorizacion.',
          ],
        },
        {
          title: 'Cambios en el servicio',
          body: [
            'Conecta puede modificar estos terminos, mejorar funcionalidades o ajustar reglas operativas. Los cambios aplicaran desde su publicacion, salvo que se indique otra fecha.',
          ],
        },
      ],
    },
    cookies: {
      eyebrow: 'Cookies',
      title: 'Politica de cookies',
      updatedAt: '28 de junio de 2026',
      intro: 'Esta politica describe cookies, almacenamiento local, tokens e identificadores tecnicos que pueden usarse en versiones web o moviles de Conecta.',
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
          title: 'Cookies de terceros',
          body: [
            'Si Conecta integra pagos, mapas, videollamadas, soporte, analitica o proveedores externos, esos servicios podrian usar cookies o tecnologias propias segun sus politicas.',
            'Conecta no controla completamente las cookies de sitios externos a los que el usuario acceda mediante enlaces o integraciones.',
          ],
        },
        {
          title: 'Cookies en app movil',
          body: [
            'En una app movil nativa las cookies pueden no funcionar igual que en una web, pero pueden existir tecnologias equivalentes como almacenamiento local, tokens o identificadores.',
            'Si Conecta incorpora webviews, pagos externos, analitica o herramientas de soporte, podrian aplicar politicas adicionales de proveedores.',
          ],
        },
        {
          title: 'Gestion de preferencias',
          body: [
            'Puedes configurar cookies desde el navegador cuando uses la version web. En la app movil, algunas preferencias pueden depender del sistema operativo, permisos del dispositivo o configuraciones internas de Conecta.',
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
