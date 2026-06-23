import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfessionalSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async activateManual(userId: string) {
    const professional = await this.getProfessionalRecord(userId);
    const now = new Date();
    const currentPeriodEnd = new Date(now);
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    const subscription = await (this.prisma as any).professionalSubscription.upsert({
      where: { professionalId: professional.id },
      create: {
        professionalId: professional.id,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodStart: now,
        currentPeriodEnd,
        lastPaymentAt: now,
        autoRenew: false,
      },
      update: {
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodStart: now,
        currentPeriodEnd,
        lastPaymentAt: now,
        cancelledAt: null,
        autoRenew: false,
      },
    });

    await (this.prisma as any).professional.update({
      where: { id: professional.id },
      data: {
        planStatus: 'ACTIVE',
        subscriptionStartAt: now,
        subscriptionEndAt: currentPeriodEnd,
      },
    });

    await this.unlockPendingRequests(userId);

    return {
      ok: true,
      subscription,
    };
  }

  async deactivateManual(userId: string) {
    const professional = await this.getProfessionalRecord(userId);
    const now = new Date();

    const subscription = await (this.prisma as any).professionalSubscription.upsert({
      where: { professionalId: professional.id },
      create: {
        professionalId: professional.id,
        status: 'CANCELLED',
        provider: 'MANUAL',
        cancelledAt: now,
        autoRenew: false,
      },
      update: {
        status: 'CANCELLED',
        cancelledAt: now,
        autoRenew: false,
      },
    });

    await (this.prisma as any).professional.update({
      where: { id: professional.id },
      data: {
        planStatus: 'CANCELLED',
        subscriptionEndAt: now,
      },
    });

    return {
      ok: true,
      subscription,
    };
  }

  private async getProfessionalRecord(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        professional: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user || user.role !== Role.PROFESSIONAL || !user.professional) {
      throw new ForbiddenException('Only professionals can manage subscriptions');
    }

    return user.professional;
  }

  private async unlockPendingRequests(professionalId: string) {
    await (this.prisma as any).appointmentRequest.updateMany({
      where: {
        professionalId,
        status: 'LOCKED_PENDING_SUBSCRIPTION',
      },
      data: {
        status: 'PENDING',
        unlockedAt: new Date(),
      },
    });
  }
}
