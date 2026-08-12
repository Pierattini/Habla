import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AppointmentSource, AppointmentStatus, AttentionModality, ProfessionalServiceMode, ProfessionalServicePriceType, Role, ScheduleMode, WeekDay } from '@prisma/client';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService manual appointments', () => {
  const date = new Date('2026-08-18T14:00:00.000Z');
  const availability = { day: WeekDay.TUE, scheduleMode: ScheduleMode.CONTINUOUS, startMinute: 540, endMinute: 720, breakMinute: 0, specificSlots: null, blockedRanges: [] };

  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-11T00:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  function setup(customer = { id:'customer-1', role:Role.CUSTOMER, isActive:true, deletedAt:null }) {
    const professional = { id:'profile-1', serviceMode:ProfessionalServiceMode.SINGLE_PRICE, price:45_000, duration:60, attentionMode:AttentionModality.ONLINE, user:{ role:Role.PROFESSIONAL, sessionDuration:60 } };
    const created = { id:'manual-1', customerId:'customer-1', professionalId:'professional-1', date, status:AppointmentStatus.CONFIRMED, source:AppointmentSource.PROFESSIONAL_MANUAL };
    const tx:any = { professional:{ findUnique:jest.fn().mockResolvedValue(professional) }, professionalService:{ findFirst:jest.fn() }, user:{ findUnique:jest.fn().mockResolvedValue(customer) }, availability:{ findMany:jest.fn().mockResolvedValue([availability]) }, professionalTimeBlock:{ findFirst:jest.fn() }, appointment:{ findMany:jest.fn().mockResolvedValue([]), create:jest.fn().mockResolvedValue(created) } };
    const prisma:any = {
      professional:{ findUnique:jest.fn().mockResolvedValue(professional) }, professionalService:{ findFirst:jest.fn() },
      user:{ findUnique:jest.fn().mockResolvedValue(customer) }, availability:{ findMany:jest.fn().mockResolvedValue([availability]) }, appointment:{ findUnique:jest.fn(), update:jest.fn() },
    };
    const conflicts:any = { runExclusive:jest.fn((_id, operation) => operation(tx)), assertRangeAvailable:jest.fn(), findTimeBlocks:jest.fn().mockResolvedValue([]), rangesOverlap:jest.fn() };
    const service = new AppointmentsService(prisma, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, conflicts);
    jest.spyOn(service as any, 'sendAppointmentNotificationById').mockResolvedValue(undefined);
    return { service, prisma, tx, conflicts, created };
  }

  it('creates a confirmed PROFESSIONAL_MANUAL appointment without payment, credit or document', async () => {
    const { service, tx, created } = setup();
    await expect(service.createManual('professional-1','customer-1',date)).resolves.toEqual(created);
    expect(tx.appointment.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      status:AppointmentStatus.CONFIRMED, source:AppointmentSource.PROFESSIONAL_MANUAL,
      penalty:0, creditUsed:null, remainingToPay:0, documentRequested:false,
    }) });
    expect((service as any).sendAppointmentNotificationById).toHaveBeenCalledWith('manual-1','APPOINTMENT_MANUAL_CREATED',['EMAIL','PUSH']);
  });

  it('creates a guest manual appointment using only the patient name', async () => {
    const { service, tx } = setup();

    await service.createManual(
      'professional-1',
      undefined,
      date,
      undefined,
      '  Paciente Invitado  ',
    );

    expect(tx.user.findUnique).not.toHaveBeenCalled();
    expect(tx.appointment.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      customerId: undefined,
      guestCustomerName: 'Paciente Invitado',
      status: AppointmentStatus.CONFIRMED,
      source: AppointmentSource.PROFESSIONAL_MANUAL,
      penalty: 0,
      creditUsed: null,
      remainingToPay: 0,
      documentRequested: false,
    }) });
    expect((service as any).sendAppointmentNotificationById).not.toHaveBeenCalled();
  });

  it('rejects a manual appointment without registered patient or guest name', async () => {
    const { service, tx } = setup();
    await expect(
      service.createManual('professional-1', undefined, date),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ id:'admin-1', role:Role.ADMIN, isActive:true, deletedAt:null }],
    [{ id:'professional-2', role:Role.PROFESSIONAL, isActive:true, deletedAt:null }],
    [{ id:'customer-1', role:Role.CUSTOMER, isActive:false, deletedAt:null }],
  ])('rejects a non-eligible patient', async (customer) => {
    const { service, tx } = setup(customer);
    await expect(service.createManual('professional-1',customer.id,date)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it('rejects a range that became occupied inside the transaction', async () => {
    const { service, conflicts, tx } = setup();
    conflicts.assertRangeAvailable.mockRejectedValue(new ConflictException('ocupado'));
    await expect(service.createManual('professional-1','customer-1',date)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it('persists service snapshots for a catalog manual appointment without creating payment', async () => {
    const { service, prisma, tx } = setup();
    const catalogProfile = {
      id: 'profile-1', serviceMode: ProfessionalServiceMode.SERVICE_CATALOG,
      price: 45_000, duration: 60, attentionMode: AttentionModality.ONLINE,
      user: { role: Role.PROFESSIONAL, sessionDuration: 60 },
    };
    const catalogService = {
      id: 'service-1', name: 'Evaluación extendida',
      priceType: ProfessionalServicePriceType.FIXED, priceAmount: 60_000,
      currency: 'CLP', durationMinutes: 90,
    };
    prisma.professional.findUnique.mockResolvedValue(catalogProfile);
    prisma.professionalService.findFirst.mockResolvedValue(catalogService);
    tx.professional.findUnique.mockResolvedValue(catalogProfile);
    tx.professionalService.findFirst.mockResolvedValue(catalogService);

    await service.createManual('professional-1', 'customer-1', date, 'service-1');

    expect(tx.appointment.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      serviceId: 'service-1',
      serviceNameSnapshot: 'Evaluación extendida',
      servicePriceAmountSnapshot: 60_000,
      serviceDurationMinutesSnapshot: 90,
      penalty: 0,
      creditUsed: null,
      remainingToPay: 0,
      documentRequested: false,
    }) });
    expect(tx.professionalService.findFirst).toHaveBeenCalled();
  });

  it('cancels a manual appointment without penalty', async () => {
    const { service, prisma } = setup();
    prisma.appointment.findUnique.mockResolvedValue({ id:'manual-1', customerId:'customer-1', professionalId:'professional-1', source:AppointmentSource.PROFESSIONAL_MANUAL, status:AppointmentStatus.CONFIRMED, date });
    prisma.appointment.update.mockResolvedValue({ id:'manual-1', status:AppointmentStatus.CANCELLED, penalty:0 });
    jest.spyOn(service as any, 'deleteExternalMeetingIfNeeded').mockResolvedValue(undefined);
    await expect(service.cancelAppointment('manual-1','customer-1')).resolves.toEqual(expect.objectContaining({ requiresPenaltyResolution:false, penalty:0 }));
  });
});
