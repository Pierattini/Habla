import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AttentionModality,
  Prisma,
  ProfessionalPlanStatus,
  ProfessionalSubscriptionStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PageQuery = {
  page?: string;
  limit?: string;
};

type AdminUsersQuery = PageQuery & {
  search?: string;
  role?: string;
  country?: string;
  isActive?: string;
};

type AdminProfessionalsQuery = PageQuery & {
  search?: string;
  country?: string;
  attentionMode?: string;
  planStatus?: string;
  subscriptionStatus?: string;
  isActive?: string;
};

type AdminUserUpdate = {
  name?: string;
  email?: string;
  role?: Role;
  country?: string | null;
  isActive?: boolean;
};

type AdminProfessionalUpdate = {
  name?: string;
  specialty?: string | null;
  attentionMode?: AttentionModality;
  country?: string | null;
  city?: string | null;
  isActive?: boolean;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [
      totalUsers,
      totalProfessionals,
      totalAdmins,
      appointmentsToday,
      appointmentsThisWeek,
      confirmedAppointments,
      cancelledAppointments,
      activeProfessionals,
      premiumProfessionals,
      pendingRequests,
      chileProfessionals,
      spainProfessionals,
      newUsersThisMonth,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.PROFESSIONAL } }),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.appointment.count({
        where: { date: { gte: todayStart, lt: todayEnd } },
      }),
      this.prisma.appointment.count({
        where: { date: { gte: todayStart, lt: weekEnd } },
      }),
      this.prisma.appointment.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.appointment.count({ where: { status: 'CANCELLED' } }),
      this.prisma.professional.count({ where: { user: { isActive: true } } }),
      this.prisma.professional.count({
        where: { subscription: { status: ProfessionalSubscriptionStatus.ACTIVE } },
      }),
      this.prisma.appointmentRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.professional.count({
        where: { OR: [{ officeCountry: 'CL' }, { user: { country: 'CL' } }] },
      }),
      this.prisma.professional.count({
        where: { OR: [{ officeCountry: 'ES' }, { user: { country: 'ES' } }] },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    return {
      totalUsers,
      totalProfessionals,
      totalAdmins,
      appointmentsToday,
      appointmentsThisWeek,
      confirmedAppointments,
      cancelledAppointments,
      activeProfessionals,
      premiumProfessionals,
      pendingRequests,
      countries: {
        CL: chileProfessionals,
        ES: spainProfessionals,
      },
      newUsersThisMonth,
    };
  }

  async listUsers(query: AdminUsersQuery) {
    const page = this.getPage(query.page);
    const limit = this.getLimit(query.limit);
    const where: Prisma.UserWhereInput = {};

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.role) {
      if (!this.isRole(query.role)) throw new BadRequestException('Invalid role');
      where.role = query.role;
    }

    if (query.country) where.country = query.country;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          country: true,
          timezone: true,
          createdAt: true,
          professional: {
            select: {
              id: true,
              specialty: true,
              customProfession: true,
              planStatus: true,
              subscription: { select: { status: true, currentPeriodEnd: true } },
            },
          },
        },
      }),
    ]);

    return this.paginate(users, total, page, limit);
  }

  async updateUser(id: string, data: AdminUserUpdate, adminId: string) {
    if (id === adminId && data.isActive === false) {
      throw new BadRequestException('No puedes desactivar tu propio usuario admin');
    }

    if (data.role && !this.isRole(data.role)) {
      throw new BadRequestException('Invalid role');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: this.cleanNullable(data.name) }),
        ...(data.email !== undefined && { email: data.email.trim().toLowerCase() }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.country !== undefined && { country: this.cleanNullable(data.country) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        country: true,
        timezone: true,
        createdAt: true,
      },
    });
  }

  async setUserActive(id: string, isActive: boolean, adminId: string) {
    return this.updateUser(id, { isActive }, adminId);
  }

  async listProfessionals(query: AdminProfessionalsQuery) {
    const page = this.getPage(query.page);
    const limit = this.getLimit(query.limit);
    const where: Prisma.ProfessionalWhereInput = {};
    const andFilters: Prisma.ProfessionalWhereInput[] = [];

    if (query.search?.trim()) {
      const search = query.search.trim();
      andFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { specialty: { contains: search, mode: 'insensitive' } },
          { customProfession: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { profession: { name: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    if (query.country) {
      andFilters.push({
        OR: [
          { officeCountry: query.country },
          { user: { country: query.country } },
        ],
      });
    }

    if (query.attentionMode) {
      if (!this.isAttentionMode(query.attentionMode)) {
        throw new BadRequestException('Invalid attention mode');
      }
      where.attentionMode = query.attentionMode;
    }

    if (query.planStatus) {
      if (!this.isPlanStatus(query.planStatus)) {
        throw new BadRequestException('Invalid plan status');
      }
      where.planStatus = query.planStatus;
    }

    if (query.subscriptionStatus) {
      if (!this.isSubscriptionStatus(query.subscriptionStatus)) {
        throw new BadRequestException('Invalid subscription status');
      }
      where.subscription = { status: query.subscriptionStatus };
    }

    if (query.isActive !== undefined) {
      andFilters.push({
        user: {
          isActive: query.isActive === 'true',
        },
      });
    }

    if (andFilters.length) {
      where.AND = andFilters;
    }

    const [total, professionals] = await this.prisma.$transaction([
      this.prisma.professional.count({ where }),
      this.prisma.professional.findMany({
        where,
        orderBy: { user: { createdAt: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              isActive: true,
              country: true,
              createdAt: true,
            },
          },
          profession: {
            select: {
              id: true,
              name: true,
              category: { select: { name: true, slug: true } },
            },
          },
          subscription: {
            select: {
              status: true,
              currentPeriodEnd: true,
              lastPaymentAt: true,
            },
          },
        },
      }),
    ]);

    return this.paginate(professionals, total, page, limit);
  }

  async updateProfessional(id: string, data: AdminProfessionalUpdate) {
    const attentionMode = data.attentionMode;

    if (attentionMode && !this.isAttentionMode(attentionMode)) {
      throw new BadRequestException('Invalid attention mode');
    }

    const professional = await this.prisma.professional.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: this.cleanNullable(data.name) }),
        ...(data.specialty !== undefined && { specialty: this.cleanNullable(data.specialty) }),
        ...(attentionMode !== undefined && { attentionMode }),
        ...(data.city !== undefined && { officeCity: this.cleanNullable(data.city) }),
        ...(data.country !== undefined && { officeCountry: this.cleanNullable(data.country) }),
        ...(data.isActive !== undefined && {
          user: { update: { isActive: data.isActive } },
        }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true, country: true } },
        profession: { select: { name: true } },
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
    });

    if (data.country !== undefined) {
      await this.prisma.user.update({
        where: { id: professional.userId },
        data: { country: this.cleanNullable(data.country) },
      });
    }

    return professional;
  }

  async suspendProfessional(id: string) {
    return this.prisma.professional.update({
      where: { id },
      data: {
        planStatus: ProfessionalPlanStatus.SUSPENDED,
        user: { update: { isActive: false } },
      },
    });
  }

  async activateProfessional(id: string) {
    return this.prisma.professional.update({
      where: { id },
      data: {
        planStatus: ProfessionalPlanStatus.FREE,
        user: { update: { isActive: true } },
      },
    });
  }

  private getPage(value?: string): number {
    const page = Number(value || 1);
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  }

  private getLimit(value?: string): number {
    const limit = Number(value || 12);
    if (!Number.isFinite(limit) || limit < 1) return 12;
    return Math.min(Math.floor(limit), 50);
  }

  private paginate<T>(data: T[], total: number, page: number, limit: number) {
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private cleanNullable(value?: string | null): string | null {
    const cleaned = String(value || '').trim();
    return cleaned || null;
  }

  private isRole(value: string): value is Role {
    return Object.values(Role).includes(value as Role);
  }

  private isAttentionMode(value: string): value is AttentionModality {
    return Object.values(AttentionModality).includes(value as AttentionModality);
  }

  private isPlanStatus(value: string): value is ProfessionalPlanStatus {
    return Object.values(ProfessionalPlanStatus).includes(value as ProfessionalPlanStatus);
  }

  private isSubscriptionStatus(value: string): value is ProfessionalSubscriptionStatus {
    return Object.values(ProfessionalSubscriptionStatus).includes(value as ProfessionalSubscriptionStatus);
  }
}
