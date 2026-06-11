export function groupByDate(list: any[]) {
  const groups: any = {};

  list.forEach(appt => {
    if (!appt.date) return;

    const dateStr = appt.date.split('T')[0];

    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }

    groups[dateStr].push(appt);
  });

  return Object.keys(groups).map(key => ({
    date: new Date(key + 'T00:00:00'),
    items: groups[key]
  }));
}

export function getLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Hoy';
  }

  if (date.toDateString() === tomorrow.toDateString()) {
    return 'MaÃ±ana';
  }

  return date.toLocaleDateString();
}

export function getStatusLabel(status: string): string {
  const map: any = {
    PENDING: 'Pendiente',
    PENDING_PAYMENT: 'Pendiente de pago',
    PAYMENT_REVIEW: 'Pago en revisiÃ³n',
    CONFIRMED: 'Confirmada',
    CANCELLED: 'Cancelada',
    RESCHEDULED: 'Reagendada',
    REFUNDED: 'Reembolsado'
  };

  return map[status] || status;
}

export function getStatusColor(status: string): string {
  const map: any = {
    PENDING: 'warning',
    PENDING_PAYMENT: 'medium',
    PAYMENT_REVIEW: 'warning',
    CONFIRMED: 'success',
    CANCELLED: 'danger',
    RESCHEDULED: 'tertiary',
    REFUNDED: 'medium'
  };

  return map[status] || 'medium';
}

export function canPay(appt: any): boolean {
  return appt.status === 'PENDING';
}

export function canShowPaymentWaiting(appt: any): boolean {
  return appt.status === 'PAYMENT_REVIEW';
}

export function canReschedule(appt: any): boolean {
  if (
    appt.status === 'CANCELLED' ||
    appt.status === 'REFUNDED'
  ) {
    return false;
  }

  return true;
}

export function canCancel(appt: any): boolean {
  if (
    appt.status === 'CANCELLED' ||
    appt.status === 'REFUNDED'
  ) {
    return false;
  }

  return true;
}
