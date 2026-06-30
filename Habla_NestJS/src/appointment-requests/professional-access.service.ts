import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ProfessionalAccess = {
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  canReceiveRequests: boolean;
  canReceiveUnlimitedRequests: boolean;
  canManageRequests: boolean;
  canReplyMessages: boolean;
  canViewStats: boolean;
  canUsePremiumTools: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  lastPaymentAt?: Date | null;
  activationMessage?: string;
};

export type ProfessionalStats = {
  profileViews: number;
  profileShares: number;
  linkCopies: number;
  appointmentRequests: number;
  acceptedRequests: number;
  conversionRate: number;
};

@Injectable()
export class ProfessionalAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessByUserId(userId: string): Promise<ProfessionalAccess> {
    const professional = await (this.prisma as any).professional.findUnique({
      where: { userId },
      include: {
        subscription: true,
        user: {
          select: {
            country: true,
          },
        },
      },
    });

    if (!professional) {
      return this.freeAccess('TRIAL');
    }

    const subscription = professional.subscription ||
      await this.ensureTrialSubscription(professional.id);

    const isActive = this.isSubscriptionActive(subscription);

    if (isActive) {
      return {
        subscriptionStatus: 'ACTIVE',
        canReceiveRequests: true,
        canReceiveUnlimitedRequests: true,
        canManageRequests: true,
        canReplyMessages: true,
        canViewStats: true,
        canUsePremiumTools: true,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        lastPaymentAt: subscription.lastPaymentAt,
      };
    }

    return this.freeAccess(
      subscription?.status || 'TRIAL',
      professional.officeCountry || professional.user?.country,
    );
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const access = await this.getAccessByUserId(userId);
    return access.subscriptionStatus === 'ACTIVE';
  }

  async assertCanReceiveRequests(userId: string): Promise<ProfessionalAccess> {
    const professional = await (this.prisma as any).professional.findUnique({
      where: { userId },
      include: {
        subscription: true,
        user: {
          select: {
            isActive: true,
            country: true,
          },
        },
      },
    });

    if (!professional || !professional.user?.isActive) {
      throw new ForbiddenException({
        code: 'PROFESSIONAL_NOT_AVAILABLE',
        message: 'Este profesional no puede recibir solicitudes en este momento.',
      });
    }

    if (['SUSPENDED', 'CANCELLED'].includes(professional.planStatus)) {
      throw new ForbiddenException({
        code: 'PROFESSIONAL_NOT_AVAILABLE',
        message: 'Este profesional no puede recibir solicitudes en este momento.',
      });
    }

    const access = await this.getAccessByUserId(userId);

    if (!access.canReceiveRequests) {
      throw new ForbiddenException({
        code: 'PROFESSIONAL_SUBSCRIPTION_REQUIRED',
        message: access.activationMessage || 'Este profesional debe activar su plan Conecta para recibir nuevas solicitudes.',
      });
    }

    return access;
  }

  async getStatsByUserId(userId: string): Promise<ProfessionalStats> {
    const access = await this.getAccessByUserId(userId);

    if (!access.canViewStats) {
      throw new ForbiddenException(
        'Las estadisticas estan disponibles para profesionales con Plan Conecta activo.',
      );
    }

    const professional = await (this.prisma as any).professional.findUnique({
      where: { userId },
      select: { id: true, userId: true },
    });

    if (!professional) {
      return this.emptyStats();
    }

    const [
      profileViews,
      profileShares,
      linkCopies,
      appointmentRequests,
      acceptedRequests,
    ] = await Promise.all([
      (this.prisma as any).professionalProfileEvent.count({
        where: { professionalId: professional.id, type: 'VIEW' },
      }),
      (this.prisma as any).professionalProfileEvent.count({
        where: { professionalId: professional.id, type: 'SHARE' },
      }),
      (this.prisma as any).professionalProfileEvent.count({
        where: { professionalId: professional.id, type: 'COPY_LINK' },
      }),
      (this.prisma as any).appointmentRequest.count({
        where: { professionalId: professional.userId },
      }),
      (this.prisma as any).appointmentRequest.count({
        where: { professionalId: professional.userId, status: 'ACCEPTED' },
      }),
    ]);

    return {
      profileViews,
      profileShares,
      linkCopies,
      appointmentRequests,
      acceptedRequests,
      conversionRate: appointmentRequests > 0
        ? Math.round((acceptedRequests / appointmentRequests) * 100)
        : 0,
    };
  }

  private async ensureTrialSubscription(professionalId: string) {
    return (this.prisma as any).professionalSubscription.create({
      data: {
        professionalId,
        status: 'TRIAL',
        autoRenew: false,
      },
    });
  }

  private isSubscriptionActive(subscription: any): boolean {
    if (!subscription || subscription.status !== 'ACTIVE') return false;
    if (!subscription.currentPeriodEnd) return true;

    return new Date(subscription.currentPeriodEnd).getTime() >= Date.now();
  }

  private freeAccess(
    status: ProfessionalAccess['subscriptionStatus'],
    country?: string | null,
  ): ProfessionalAccess {
    return {
      subscriptionStatus: status,
      canReceiveRequests: status === 'TRIAL',
      canReceiveUnlimitedRequests: false,
      canManageRequests: false,
      canReplyMessages: false,
      canViewStats: false,
      canUsePremiumTools: false,
      activationMessage:
        `Activa tu plan profesional por ${this.getPricingLabel(country)} para acceder a los datos de la solicitud y comenzar a recibir pacientes.`,
    };
  }

  private getPricingLabel(country?: string | null): string {
    return String(country || '').trim().toUpperCase() === 'ES'
      ? '15 EUR/mes'
      : '$10.000 CLP/mes';
  }

  private emptyStats(): ProfessionalStats {
    return {
      profileViews: 0,
      profileShares: 0,
      linkCopies: 0,
      appointmentRequests: 0,
      acceptedRequests: 0,
      conversionRate: 0,
    };
  }
}
