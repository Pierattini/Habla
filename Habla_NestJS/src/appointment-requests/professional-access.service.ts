import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ProfessionalAccess = {
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
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

@Injectable()
export class ProfessionalAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessByUserId(userId: string): Promise<ProfessionalAccess> {
    const professional = await (this.prisma as any).professional.findUnique({
      where: { userId },
      include: { subscription: true },
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

    return this.freeAccess(subscription?.status || 'TRIAL');
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const access = await this.getAccessByUserId(userId);
    return access.subscriptionStatus === 'ACTIVE';
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

  private freeAccess(status: ProfessionalAccess['subscriptionStatus']): ProfessionalAccess {
    return {
      subscriptionStatus: status,
      canReceiveUnlimitedRequests: false,
      canManageRequests: false,
      canReplyMessages: false,
      canViewStats: false,
      canUsePremiumTools: false,
      activationMessage:
        'Activa tu plan profesional por $10.000 CLP mensuales para acceder a los datos de la solicitud y comenzar a recibir pacientes.',
    };
  }
}
