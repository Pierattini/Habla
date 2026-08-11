export function buildServiceAvailabilityParams(
  professionalId: string,
  date: string,
  serviceId: string | null,
): Record<string, string> {
  return serviceId
    ? { professionalId, date, serviceId }
    : { professionalId, date };
}

export function withSelectedProfessionalService<T extends object>(
  payload: T,
  serviceId: string | null,
): T & { serviceId?: string } {
  return serviceId ? { ...payload, serviceId } : payload;
}
