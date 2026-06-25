import type {
  NotificationLocale,
  NotificationTemplate,
  NotificationType,
} from './notification.types';

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
    resetUrl: values.resetUrl || '',
    meetingUrl: values.meetingUrl || '',
    fullAddress: values.fullAddress || '',
    mapsUrl: values.mapsUrl || buildMapsUrl(values.fullAddress),
  };

  const appointmentDetails = buildAppointmentDetails(shared, isEnglish);

  const templates: Record<NotificationType, NotificationTemplate> = {
    REGISTRATION_SUCCESS: {
      subject: isEnglish ? 'Your Conecta account is ready' : 'Tu cuenta en Conecta esta lista',
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
        : `Hola ${shared.name}, puedes recuperar tu contrasena desde: ${shared.resetUrl}`,
      html: wrapHtml(
        isEnglish ? 'Recover your access' : 'Recupera tu acceso',
        isEnglish
          ? `Hi ${shared.name}, recover your password here:<br>${button(shared.resetUrl, 'Reset password')}`
          : `Hola ${shared.name}, puedes recuperar tu contrasena desde este enlace:<br>${button(shared.resetUrl, 'Restablecer contrasena')}`,
      ),
    },
    APPOINTMENT_BOOKED: appointmentTemplate(
      isEnglish ? 'Your appointment request was scheduled' : 'Tu cita fue agendada',
      isEnglish ? 'Appointment scheduled' : 'Cita agendada',
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
        : 'Nuevo enlace para continuar tu sesion',
      isEnglish ? 'Continue your session' : 'Continua tu sesion',
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
    APPOINTMENT_REMINDER_15M: appointmentTemplate(
      isEnglish ? 'Reminder: appointment in 15 minutes' : 'Recordatorio: cita en 15 minutos',
      isEnglish ? 'Appointment in 15 minutes' : 'Cita en 15 minutos',
      shared,
      appointmentDetails,
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
    return button(
      shared.meetingUrl,
      isEnglish ? 'Join video call' : 'Unirse a la videollamada',
    );
  }

  if (shared.fullAddress) {
    return `
      <p><strong>${isEnglish ? 'Address' : 'Direccion'}:</strong><br>${escapeHtml(shared.fullAddress)}</p>
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
  if (!url) return '';

  return `
    <p>
      <a href="${escapeHtml(url)}" style="display: inline-block; padding: 12px 18px; background: #8b5cf6; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 800;">
        ${escapeHtml(label)}
      </a>
    </p>
  `;
}

function wrapHtml(title: string, body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px; color: #20172f;">
      <h2 style="margin: 0 0 18px; color: #8b5cf6;">${escapeHtml(title)}</h2>
      <p style="font-size: 15px; line-height: 1.55;">${body}</p>
      <p style="margin-top: 24px; color: #6b6478;">Equipo Conecta</p>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
