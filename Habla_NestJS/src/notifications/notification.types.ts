export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'PUSH';

export type NotificationType =
  | 'REGISTRATION_SUCCESS'
  | 'PASSWORD_RESET'
  | 'APPOINTMENT_BOOKED'
  | 'APPOINTMENT_CONFIRMATION'
  | 'APPOINTMENT_CONTINUATION_LINK'
  | 'APPOINTMENT_CANCELLATION'
  | 'APPOINTMENT_RESCHEDULE'
  | 'APPOINTMENT_REMINDER_SAME_DAY'
  | 'APPOINTMENT_REMINDER_24H'
  | 'APPOINTMENT_REMINDER_1H'
  | 'APPOINTMENT_REMINDER_2H'
  | 'APPOINTMENT_REMINDER_15M'
  | 'PROFESSIONAL_WELCOME'
  | 'CUSTOMER_WELCOME';

export type NotificationLocale = 'es' | 'en';

export interface NotificationRecipient {
  email?: string;
  phone?: string;
  userId?: string;
  name?: string;
}

export interface NotificationPayload {
  type: NotificationType;
  recipient: NotificationRecipient;
  channels?: NotificationChannel[];
  locale?: NotificationLocale;
  data?: Record<string, string | number | Date | null | undefined>;
}

export interface NotificationTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface NotificationResult {
  channel: NotificationChannel;
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  provider?: string;
}
