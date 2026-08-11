import { ConflictException } from '@nestjs/common';
import { AppointmentRequestsService } from './appointment-requests.service';

describe('AppointmentRequestsService schedule conflicts', () => {
  it('rejects acceptance with a date when the range is already occupied', async () => {
    const requestedDate = new Date('2026-08-18T14:00:00.000Z');
    const request = {
      id: 'request-1',
      customerId: 'customer-1',
      professionalId: 'professional-1',
      requestedDate,
      requestedMode: 'ONLINE',
      convertedAppointmentId: null,
      conversationId: 'conversation-1',
      unlockedAt: new Date(),
    };
    const tx = {
      appointmentRequest: {
        findUnique: jest.fn().mockResolvedValue(request),
        update: jest.fn(),
      },
      appointment: { create: jest.fn() },
    };
    const prisma: any = {
      appointmentRequest: {
        findUnique: jest.fn().mockResolvedValue(request),
      },
    };
    const professionalAccess: any = {
      getAccessByUserId: jest.fn().mockResolvedValue({ canManageRequests: true }),
    };
    const conflicts: any = {
      runExclusive: jest.fn((_professionalId, operation) => operation(tx)),
      getProfessionalDuration: jest.fn().mockResolvedValue(60),
      assertRangeAvailable: jest
        .fn()
        .mockRejectedValue(new ConflictException('Horario ocupado')),
    };
    const service = new AppointmentRequestsService(
      prisma,
      professionalAccess,
      conflicts,
    );

    await expect(
      service.accept('request-1', 'professional-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(conflicts.runExclusive).toHaveBeenCalledWith(
      'professional-1',
      expect.any(Function),
    );
    expect(conflicts.assertRangeAvailable).toHaveBeenCalledWith(
      tx,
      {
        professionalId: 'professional-1',
        startAt: requestedDate,
        endAt: new Date('2026-08-18T15:00:00.000Z'),
      },
      60,
    );
    expect(tx.appointment.create).not.toHaveBeenCalled();
    expect(tx.appointmentRequest.update).not.toHaveBeenCalled();
  });
});
