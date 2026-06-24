import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProfessionalSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  getPricing(country?: string | null) {
    const normalizedCountry = this.normalizeSupportedCountry(country);

    if (normalizedCountry === 'ES') {
      return {
        country: 'ES',
        amount: 15,
        currency: 'EUR',
        label: '15 EUR/mes',
      };
    }

    return {
      country: 'CL',
      amount: 10000,
      currency: 'CLP',
      label: '$10.000 CLP/mes',
    };
  }

  async activateManual(userId: string) {
    this.ensureDemoActionsEnabled();
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
    this.ensureDemoActionsEnabled();
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

  private normalizeSupportedCountry(country?: string | null): 'CL' | 'ES' {
    const value = String(country || '').trim().toUpperCase();

    return value === 'ES' ? 'ES' : 'CL';
  }

  private ensureDemoActionsEnabled() {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.APP_ENV === 'production'
    ) {
      throw new ForbiddenException('Demo subscription actions are disabled');
    }
  }
}
