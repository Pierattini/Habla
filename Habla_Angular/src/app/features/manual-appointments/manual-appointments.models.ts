export interface CustomerSearchResult { id: string; name: string | null; email: string; }
export interface ManualAppointment { id: string; customerId: string | null; guestCustomerName?: string | null; professionalId: string; date: string; status: 'CONFIRMED'; source: 'PROFESSIONAL_MANUAL'; }
