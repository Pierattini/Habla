import { chileDate } from '../sii/sii-format';

export type MonthlyReportAppointment = {
  date: Date;
  paidAt: Date | null;
  guestCustomerName: string | null;
  serviceNameSnapshot: string | null;
  servicePriceAmountSnapshot: number | null;
  customer: {
    name: string | null;
    email: string;
    taxId: string | null;
    taxName: string | null;
    taxAddress: string | null;
    taxCity: string | null;
  } | null;
  taxDocument: {
    amount: number | null;
    dteCode: number | null;
    folio: string | null;
    status: string;
    generatedAt: Date | null;
    siiStatus: string | null;
  } | null;
};

const DOCUMENT_TYPES: Record<number, string> = {
  39: 'Boleta afecta (39)',
  41: 'Boleta exenta (41)',
};

const STATUS_LABELS: Record<string, string> = {
  DOCUMENT_PENDING: 'Pendiente',
  DOCUMENT_UPLOADED: 'Subida',
  DOCUMENT_GENERATED: 'Emitida',
  DOCUMENT_SENT: 'Enviada al paciente',
  DOCUMENT_FAILED: 'Falló',
  DOCUMENT_CANCELLED: 'Cancelada',
};

const HEADERS = [
  'Fecha de pago',
  'Fecha de la sesión',
  'Paciente',
  'RUT',
  'Correo',
  'Dirección',
  'Servicio',
  'Monto',
  'Tipo de documento',
  'Folio',
  'Fecha de emisión',
  'Estado del documento',
];

// Informe del mes en CSV para Excel: las citas pagadas con los datos para emitir boletas
// a mano (honorarios) y, si se emitieron por Habla, su folio y estado (informe de folios).
export function buildMonthlyReportCsv(appointments: MonthlyReportAppointment[]): string {
  const rows = appointments.map((appointment) => {
    const customer = appointment.customer;
    const document = appointment.taxDocument;

    return [
      appointment.paidAt ? chileDate(appointment.paidAt) : '',
      chileDate(appointment.date),
      customer?.taxName || customer?.name || appointment.guestCustomerName || '',
      customer?.taxId || '',
      customer?.email || '',
      [customer?.taxAddress, customer?.taxCity].filter(Boolean).join(', '),
      appointment.serviceNameSnapshot || '',
      document?.amount ?? appointment.servicePriceAmountSnapshot ?? '',
      document?.dteCode ? DOCUMENT_TYPES[document.dteCode] ?? `Tipo ${document.dteCode}` : '',
      document?.folio || '',
      document?.generatedAt ? chileDate(document.generatedAt) : '',
      document ? STATUS_LABELS[document.status] ?? document.status : 'Sin documento',
    ];
  });

  // BOM + punto y coma: así Excel en español abre bien acentos y columnas.
  return '﻿' + [HEADERS, ...rows].map((row) => row.map(toCsvCell).join(';')).join('\r\n');
}

// Rango UTC que cubre el mes en hora de Chile, con un día de margen a cada lado;
// el filtro exacto se hace después con la fecha de Chile.
export function monthWindow(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);

  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 0)),
    to: new Date(Date.UTC(year, monthNumber, 2)),
  };
}

export function isInChileMonth(date: Date, month: string) {
  return chileDate(date).startsWith(month);
}

function toCsvCell(value: string | number): string {
  const text = String(value);
  // Evita que Excel interprete como fórmula un texto que empieza con = + - @.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
