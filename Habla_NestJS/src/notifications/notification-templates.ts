import type {
  NotificationLocale,
  NotificationTemplate,
  NotificationType,
} from './notification.types';
import {
  buildConectaEmail,
  conectaButton,
  escapeEmailHtml,
} from '../email/conecta-email-template';

type TemplateData = Record<string, string | number | Date | null | undefined>;

export function buildNotificationTemplate(
  type: NotificationType,
  data: TemplateData = {},
  locale: NotificationLocale = 'es',
): NotificationTemplate {
  const values = normalizeValues(data);
  const isEnglish = locale === 'en';

  const shared = {
    name: values.name || (isEnglish ? 'User' : 'Usuario'),
    appointmentDate: values.appointmentDate || (isEnglish ? 'date to confirm' : 'fecha por confirmar'),
    appointmentTime: values.appointmentTime || '',
    timezone: values.timezone || 'America/Santiago',
    professionalName: values.professionalName || (isEnglish ? 'your professional' : 'tu profesional'),
    customerName: values.customerName || (isEnglish ? 'patient' : 'paciente'),
    modality: values.modality || '',
    resetUrl: values.resetUrl || '',
    meetingUrl: values.meetingUrl || '',
    fullAddress: values.fullAddress || '',
    arrivalInstructions: values.arrivalInstructions || '',
    mapsUrl: values.mapsUrl || buildMapsUrl(values.fullAddress),
    paymentDeadline: values.paymentDeadline || '',
  };

  // Plazo de pago (citas sin pagar): se muestra arriba del detalle.
  const paymentNotice = shared.paymentDeadline
    ? `<p><strong>${isEnglish ? 'Pay before' : 'Transfiere antes del'}:</strong> ${escapeHtml(shared.paymentDeadline)}.<br>${
        isEnglish
          ? 'If the payment is not registered by then, the slot will be released for other patients.'
          : 'Si el pago no se registra antes de ese plazo, la hora se liberará para otros pacientes.'
      }</p>`
    : '';
  const appointmentDetails = buildAppointmentDetails(shared, isEnglish);
  const detailsWithPayment = `${paymentNotice}${appointmentDetails}`;

  const templates: Record<NotificationType, NotificationTemplate> = {
    REGISTRATION_SUCCESS: {
      subject: isEnglish ? 'Your Conecta account is ready' : 'Tu cuenta en Conecta está lista',
      text: isEnglish
        ? `Hi ${shared.name}, your Conecta account was created successfully.`
        : `Hola ${shared.name}, tu cuenta en Conecta fue creada correctamente.`,
      html: wrapHtml(
        isEnglish ? 'Account created' : 'Cuenta creada',
        isEnglish
          ? `Hi ${shared.name}, your Conecta account was created successfully.`
          : `Hola ${shared.name}, tu cuenta en Conecta fue creada correctamente.`,
      ),
    },
    PASSWORD_RESET: {
      subject: isEnglish ? 'Recover your Conecta access' : 'Recupera tu acceso a Conecta',
      text: isEnglish
        ? `Hi ${shared.name}, recover your password here: ${shared.resetUrl}`
        : `Hola ${shared.name}, puedes recuperar tu contraseña desde: ${shared.resetUrl}`,
      html: wrapHtml(
        isEnglish ? 'Recover your access' : 'Recupera tu acceso',
        isEnglish
          ? `Hi ${shared.name}, recover your password here:<br>${button(shared.resetUrl, 'Reset password')}`
          : `Hola ${shared.name}, puedes recuperar tu contraseña desde este enlace:<br>${button(shared.resetUrl, 'Restablecer contraseña')}`,
      ),
    },
    APPOINTMENT_BOOKED: appointmentTemplate(
      isEnglish ? 'Your appointment request was scheduled' : 'Tu cita fue agendada',
      isEnglish ? 'Appointment scheduled' : 'Cita agendada',
      shared,
      detailsWithPayment,
      isEnglish,
    ),
    APPOINTMENT_MANUAL_CREATED: appointmentTemplate(
      isEnglish
        ? `${shared.professionalName} scheduled an appointment with you`
        : `${shared.professionalName} ha agendado una cita contigo`,
      isEnglish ? 'Appointment scheduled by your professional' : 'Tu profesional agendó una cita',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_CONFIRMATION: appointmentTemplate(
      isEnglish ? 'Your appointment was confirmed' : 'Tu cita fue confirmada',
      isEnglish ? 'Appointment confirmed' : 'Cita confirmada',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_CONTINUATION_LINK: appointmentTemplate(
      isEnglish
        ? 'New link to continue your session'
        : 'Nuevo enlace para continuar tu sesión',
      isEnglish ? 'Continue your session' : 'Continua tu sesión',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_CANCELLATION: appointmentTemplate(
      isEnglish ? 'Your appointment was cancelled' : 'Tu cita fue cancelada',
      isEnglish ? 'Appointment cancelled' : 'Cita cancelada',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_RESCHEDULE: appointmentTemplate(
      isEnglish ? 'Your appointment was rescheduled' : 'Tu cita fue reprogramada',
      isEnglish ? 'Appointment rescheduled' : 'Cita reprogramada',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_REMINDER_SAME_DAY: appointmentTemplate(
      isEnglish ? 'Today you have an appointment' : 'Hoy tienes una cita',
      isEnglish ? 'Appointment today' : 'Cita para hoy',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_REMINDER_24H: appointmentTemplate(
      isEnglish ? 'Reminder: appointment tomorrow' : 'Recordatorio: tienes una cita manana',
      isEnglish ? 'Appointment reminder' : 'Recordatorio de cita',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_REMINDER_2H: appointmentTemplate(
      isEnglish ? 'Reminder: your appointment is soon' : 'Recordatorio: tu cita es pronto',
      isEnglish ? 'Your appointment is soon' : 'Tu cita es pronto',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_REMINDER_1H: appointmentTemplate(
      isEnglish ? 'Reminder: appointment in 1 hour' : 'Recordatorio: cita en 1 hora',
      isEnglish ? 'Appointment in 1 hour' : 'Cita en 1 hora',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_REMINDER_15M: appointmentTemplate(
      isEnglish ? 'Reminder: appointment in 15 minutes' : 'Recordatorio: cita en 15 minutos',
      isEnglish ? 'Appointment in 15 minutes' : 'Cita en 15 minutos',
      shared,
      appointmentDetails,
      isEnglish,
    ),
    APPOINTMENT_PAYMENT_REMINDER: appointmentTemplate(
      isEnglish ? 'Reminder: pay to keep your appointment' : 'Recuerda transferir para mantener tu hora',
      isEnglish ? 'Payment pending' : 'Pago pendiente',
      shared,
      detailsWithPayment,
      isEnglish,
    ),
    APPOINTMENT_PAYMENT_LAST_REMINDER: appointmentTemplate(
      isEnglish ? 'Last notice: your slot will be released' : 'Último aviso: tu hora será liberada',
      isEnglish ? 'Last payment notice' : 'Último aviso de pago',
      shared,
      detailsWithPayment,
      isEnglish,
    ),
    APPOINTMENT_RELEASED_UNPAID: appointmentTemplate(
      isEnglish ? 'Appointment released for lack of payment' : 'Hora liberada por falta de pago',
      isEnglish ? 'Appointment released' : 'Hora liberada',
      shared,
      `<p>${
        isEnglish
          ? 'The payment was not registered before the deadline, so the appointment was cancelled and the slot is available again.'
          : 'No se registró el pago antes del plazo, así que la cita se canceló y la hora quedó disponible nuevamente.'
      }</p>${appointmentDetails}`,
      isEnglish,
    ),
    PROFESSIONAL_WELCOME: {
      subject: isEnglish ? 'Welcome to Conecta' : 'Bienvenido a Conecta',
      text: isEnglish
        ? `Hi ${shared.name}, your professional profile can now receive requests.`
        : `Hola ${shared.name}, tu perfil profesional ya puede recibir solicitudes.`,
      html: wrapHtml(
        isEnglish ? 'Welcome to Conecta' : 'Bienvenido a Conecta',
        isEnglish
          ? `Hi ${shared.name}, your professional profile can now receive requests.`
          : `Hola ${shared.name}, tu perfil profesional ya puede recibir solicitudes.`,
      ),
    },
    CUSTOMER_WELCOME: {
      subject: isEnglish ? 'Welcome to Conecta' : 'Bienvenido a Conecta',
      text: isEnglish
        ? `Hi ${shared.name}, you can now search professionals and request appointments.`
        : `Hola ${shared.name}, ya puedes buscar profesionales y solicitar citas en Conecta.`,
      html: wrapHtml(
        isEnglish ? 'Welcome to Conecta' : 'Bienvenido a Conecta',
        isEnglish
          ? `Hi ${shared.name}, you can now search professionals and request appointments.`
          : `Hola ${shared.name}, ya puedes buscar profesionales y solicitar citas en Conecta.`,
      ),
    },
  };

  return templates[type];
}

function appointmentTemplate(
  subject: string,
  title: string,
  shared: Record<string, string>,
  details: string,
  isEnglish: boolean,
): NotificationTemplate {
  const text = isEnglish
    ? `Hi ${shared.name}, appointment with ${shared.professionalName}: ${shared.appointmentDate} ${shared.appointmentTime} ${shared.timezone}.`
    : `Hola ${shared.name}, cita con ${shared.professionalName}: ${shared.appointmentDate} ${shared.appointmentTime} ${shared.timezone}.`;

  return {
    subject,
    text,
    html: wrapHtml(title, `${text}<br>${details}`),
  };
}

function buildAppointmentDetails(
  shared: Record<string, string>,
  isEnglish: boolean,
): string {
  if (shared.meetingUrl) {
    return `
      <p><strong>${isEnglish ? 'Professional' : 'Profesional'}:</strong> ${escapeHtml(shared.professionalName)}</p>
      <p><strong>${isEnglish ? 'Patient' : 'Paciente'}:</strong> ${escapeHtml(shared.customerName)}</p>
      <p><strong>${isEnglish ? 'Modality' : 'Modalidad'}:</strong> ${escapeHtml(shared.modality || (isEnglish ? 'Online' : 'Online'))}</p>
      ${button(
        shared.meetingUrl,
        isEnglish ? 'Join video call' : 'Unirse a la videollamada',
      )}
    `;
  }

  if (shared.fullAddress) {
    return `
      <p><strong>${isEnglish ? 'Professional' : 'Profesional'}:</strong> ${escapeHtml(shared.professionalName)}</p>
      <p><strong>${isEnglish ? 'Patient' : 'Paciente'}:</strong> ${escapeHtml(shared.customerName)}</p>
      <p><strong>${isEnglish ? 'Modality' : 'Modalidad'}:</strong> ${escapeHtml(shared.modality || (isEnglish ? 'In person' : 'Presencial'))}</p>
      <p><strong>${isEnglish ? 'Address' : 'Dirección'}:</strong><br>${escapeHtml(shared.fullAddress)}</p>
      ${
        shared.arrivalInstructions
          ? `<p><strong>${isEnglish ? 'Arrival instructions' : 'Indicaciones'}:</strong><br>${escapeHtml(shared.arrivalInstructions)}</p>`
          : ''
      }
      ${button(shared.mapsUrl, isEnglish ? 'Open in Google Maps' : 'Abrir en Google Maps')}
    `;
  }

  return '';
}

function buildMapsUrl(address?: string): string {
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function normalizeValues(data: TemplateData): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      value instanceof Date ? value.toLocaleString('es-CL') : String(value || ''),
    ]),
  );
}

function button(url: string, label: string): string {
  return conectaButton(url, label);
}

function wrapHtml(title: string, body: string): string {
  return buildConectaEmail({
    title,
    preview: title,
    body,
  });
}

function escapeHtml(value: string): string {
  return escapeEmailHtml(value);
}
