import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { AttentionModality, Prisma, Role } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import ct from 'countries-and-timezones';

type FindProfessionalsParams = {
  page: number;
  limit: number;
  search?: string;
  specialty?: string;
  professionId?: string;
  professionSlug?: string;
  categorySlug?: string;
  attentionMode?: string;
  country?: string;
  viewer?: {
    id: string;
    role: Role;
  };
};

type SearchSuggestionsParams = {
  q?: string;
  country?: string;
  viewer?: {
    id: string;
    role: Role;
  };
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany();
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: CreateUserDto) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);

      const user = await this.prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          role: data.role ?? Role.CUSTOMER,
        },
      });

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const dataToUpdate: any = {};

    if (dto.name !== undefined) dataToUpdate.name = dto.name;
    if (dto.email !== undefined) dataToUpdate.email = dto.email;
    if (dto.image !== undefined) dataToUpdate.image = dto.image;
    if (dto.timezone !== undefined) dataToUpdate.timezone = dto.timezone;
    if (dto.taxId !== undefined) dataToUpdate.taxId = dto.taxId;
    if (dto.taxName !== undefined) dataToUpdate.taxName = dto.taxName;
    if (dto.taxEmail !== undefined) dataToUpdate.taxEmail = dto.taxEmail;
    if (dto.taxAddress !== undefined) dataToUpdate.taxAddress = dto.taxAddress;
    if (dto.taxCountry !== undefined) dataToUpdate.taxCountry = dto.taxCountry;
    if (dto.taxCity !== undefined) dataToUpdate.taxCity = dto.taxCity;
    if (dto.customerInterests !== undefined) {
      dataToUpdate.customerInterests = dto.customerInterests;
    }
    if (dto.preferredAttentionMode !== undefined) {
      dataToUpdate.preferredAttentionMode = dto.preferredAttentionMode;
    }
    if (dto.preferredCity !== undefined) {
      dataToUpdate.preferredCity = dto.preferredCity;
    }
    if (dto.preferredRegion !== undefined) {
      dataToUpdate.preferredRegion = dto.preferredRegion;
    }
    if (dto.wantsTaxDocumentByDefault !== undefined) {
      dataToUpdate.wantsTaxDocumentByDefault = dto.wantsTaxDocumentByDefault;
    }

    if (dto.country !== undefined) {
      dataToUpdate.country = dto.country;

      if (dto.country === 'CL') {
        dataToUpdate.timezone = 'America/Santiago';
      } else {
        const country = ct.getCountry(dto.country);

        if (country?.timezones?.length) {
          dataToUpdate.timezone = country.timezones[0];
        }
      }
    }

    // USER
    await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
    });

    const existingProfessional = await this.prisma.professional.findUnique({
      where: { userId },
      select: { slug: true },
    });
    const requestedProfessionalName = dto.name || dataToUpdate.name || userId;
    const cleanProfessionalSlug = await this.buildUniqueProfessionalSlug(
      requestedProfessionalName,
      userId,
    );

    const professionalData = {
      ...(existingProfessional &&
        (!existingProfessional.slug ||
          this.shouldRefreshProfessionalSlug(
            existingProfessional.slug,
            requestedProfessionalName,
          )) && {
        slug: cleanProfessionalSlug,
      }),

      ...(dto.name !== undefined && {
        name: dto.name,
      }),

      ...(dto.image !== undefined && {
        image: dto.image,
      }),

      ...(dto.specialty !== undefined && {
        specialty: dto.specialty,
      }),

      ...(dto.professionId !== undefined && {
        professionId: dto.professionId || null,
      }),

      ...(dto.description !== undefined && {
        description: dto.description,
      }),

      ...(dto.rules !== undefined && {
        rules: dto.rules,
      }),

      ...(dto.price !== undefined && {
        price: dto.price,
      }),

      ...(dto.duration !== undefined && {
        duration: dto.duration,
      }),

      ...(dto.taxId !== undefined && {
        taxId: dto.taxId,
      }),

      ...(dto.taxName !== undefined && {
        taxName: dto.taxName,
      }),

      ...(dto.taxEmail !== undefined && {
        taxEmail: dto.taxEmail,
      }),

      ...(dto.taxAddress !== undefined && {
        taxAddress: dto.taxAddress,
      }),

      ...(dto.taxCountry !== undefined && {
        taxCountry: dto.taxCountry,
      }),

      ...(dto.taxCity !== undefined && {
        taxCity: dto.taxCity,
      }),

      ...(dto.documentAutomationEnabled !== undefined && {
        documentAutomationEnabled: dto.documentAutomationEnabled,
      }),

      ...(dto.manualDocumentMode !== undefined && {
        manualDocumentMode: dto.manualDocumentMode,
      }),

      ...(dto.taxProvider !== undefined && {
        taxProvider: dto.taxProvider,
      }),

      ...(dto.attentionMode !== undefined && {
        attentionMode: dto.attentionMode,
      }),

      ...(dto.officeAddress !== undefined && {
        officeAddress: dto.officeAddress,
      }),

      ...(dto.officeCity !== undefined && {
        officeCity: dto.officeCity,
      }),

      ...(dto.officeRegion !== undefined && {
        officeRegion: dto.officeRegion,
      }),

      ...(dto.officeCountry !== undefined && {
        officeCountry: dto.officeCountry,
      }),

      ...(dto.officeLatitude !== undefined && {
        officeLatitude: dto.officeLatitude,
      }),

      ...(dto.officeLongitude !== undefined && {
        officeLongitude: dto.officeLongitude,
      }),

      ...(dto.arrivalInstructions !== undefined && {
        arrivalInstructions: dto.arrivalInstructions,
      }),

      ...(dto.videoProvider !== undefined && {
        videoProvider: dto.videoProvider,
      }),

      ...(dto.customVideoUrl !== undefined && {
        customVideoUrl: dto.customVideoUrl,
      }),

      ...(dto.bankName !== undefined && {
        bankName: dto.bankName,
      }),

      ...(dto.accountType !== undefined && {
        accountType: dto.accountType,
      }),

      ...(dto.accountNumber !== undefined && {
        accountNumber: dto.accountNumber,
      }),

      ...(dto.accountHolder !== undefined && {
        accountHolder: dto.accountHolder,
      }),

      ...(dto.accountEmail !== undefined && {
        accountEmail: dto.accountEmail,
      }),
    };

    if (Object.keys(professionalData).length > 0) {
      await this.prisma.professional.updateMany({
        where: {
          userId: userId,
        },
        data: professionalData,
      });
    }

    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        professional: {
          include: {
            profession: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }
  async updateSessionDuration(userId: string, duration: number) {
    if (duration < 15 || duration > 180) {
      throw new ForbiddenException(
        'Session duration must be between 15 and 180 minutes',
      );
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { sessionDuration: duration },
    });
  }
  async findProfessionals(params: FindProfessionalsParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 12));
    const search = params.search?.trim();
    const specialty = params.specialty?.trim();
    const professionId = params.professionId?.trim();
    const professionSlug = params.professionSlug?.trim();
    const categorySlug = params.categorySlug?.trim();
    const attentionMode = params.attentionMode?.trim();
    const country = await this.resolveProfessionalCountryFilter(params);
    const legacyCatalogTerms: string[] = [];

    if (professionSlug) {
      const profession = await this.prisma.profession.findUnique({
        where: { slug: professionSlug },
        select: { name: true, slug: true, aliases: true },
      });

      if (profession) {
        legacyCatalogTerms.push(
          ...this.getLegacySearchTerms([
            profession.name,
            profession.slug,
            ...profession.aliases,
          ]),
        );
      }
    }

    if (categorySlug) {
      const professions = await this.prisma.profession.findMany({
        where: {
          category: { slug: categorySlug, isActive: true },
          isActive: true,
        },
        select: { name: true, slug: true, aliases: true },
      });

      legacyCatalogTerms.push(
        ...this.getLegacySearchTerms(
          professions.flatMap((profession) => [
            profession.name,
            profession.slug,
            ...profession.aliases,
          ]),
        ),
      );
    }

    const where: Prisma.ProfessionalWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { specialty: { contains: search, mode: 'insensitive' } },
        { customProfession: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { profession: { name: { contains: search, mode: 'insensitive' } } },
        { profession: { slug: { contains: search, mode: 'insensitive' } } },
        { profession: { category: { name: { contains: search, mode: 'insensitive' } } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (specialty) {
      where.OR = [
        ...(where.OR || []),
        { specialty: { contains: specialty, mode: 'insensitive' } },
        { customProfession: { contains: specialty, mode: 'insensitive' } },
        { profession: { name: { contains: specialty, mode: 'insensitive' } } },
        { profession: { slug: { contains: specialty, mode: 'insensitive' } } },
      ];
    }

    if (professionId) {
      where.professionId = professionId;
    }

    if (professionSlug) {
      where.OR = [
        ...(where.OR || []),
        { profession: { slug: professionSlug, isActive: true } },
      ];
    }

    if (categorySlug) {
      where.OR = [
        ...(where.OR || []),
        { profession: { category: { slug: categorySlug, isActive: true } } },
      ];
    }

    if ((professionSlug || categorySlug) && legacyCatalogTerms.length) {
      where.OR = [
        ...(where.OR || []),
        ...legacyCatalogTerms.map((term) => ({
          specialty: { contains: term, mode: 'insensitive' as const },
        })),
      ];
    }

    if (
      attentionMode &&
      attentionMode !== 'ALL' &&
      ['ONLINE', 'PRESENTIAL', 'BOTH'].includes(attentionMode)
    ) {
      where.attentionMode = attentionMode as AttentionModality;
    }

    if (country) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { officeCountry: country },
            {
              AND: [
                {
                  OR: [
                    { officeCountry: null },
                    { officeCountry: '' },
                  ],
                },
                {
                  OR: [
                    { user: { country } },
                    ...(country === 'CL'
                      ? [
                          { user: { country: null } },
                          { user: { country: '' } },
                        ]
                      : []),
                  ],
                },
              ],
            },
          ],
        },
      ];
    }

    const [total, data, specialtyRows] = await this.prisma.$transaction([
      this.prisma.professional.count({ where }),
      this.prisma.professional.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ name: 'asc' }, { user: { name: 'asc' } }],
        include: {
          user: true,
          profession: {
            include: {
              category: true,
            },
          },
        },
      }),
      this.prisma.professional.findMany({
        where: { specialty: { not: null } },
        distinct: ['specialty'],
        select: { specialty: true },
        orderBy: { specialty: 'asc' },
      }),
    ]);
    const reviewSummaries = await this.getReviewSummaries(
      data.map((professional) => professional.userId),
    );

    return {
      data: data.map((p) => {
        const reviewSummary = reviewSummaries.get(p.userId) || {
          ratingAverage: 0,
          reviewsCount: 0,
        };

        return {
        id: p.userId,
        slug: p.slug,
        name: this.getProtectedProfessionalName(p.name || p.user.name),
        firstName: this.getFirstName(p.name || p.user.name),
        lastInitial: this.getLastInitial(p.name || p.user.name),
        specialty: p.profession?.name || p.specialty,
        customProfession: p.customProfession,
        professionId: p.professionId,
        professionName: p.profession?.name || null,
        professionSlug: p.profession?.slug || null,
        categoryName: p.profession?.category?.name || null,
        categorySlug: p.profession?.category?.slug || null,
        city: p.officeCity || null,
        country: p.officeCountry || p.user.country || country || null,
        ratingAverage: reviewSummary.ratingAverage,
        reviewsCount: reviewSummary.reviewsCount,
        shortDescription: this.truncateText(p.description, 140),
        price: p.price,
        duration: p.duration,
        image: p.image,
        documentAutomationEnabled: p.documentAutomationEnabled,
        manualDocumentMode: p.manualDocumentMode,
        taxDocumentReady: this.isProfessionalTaxReady(p),
        attentionMode: p.attentionMode,
        officeCity: p.officeCity,
        officeRegion: p.officeRegion,
        officeCountry: p.officeCountry || p.user.country || country,
        videoProvider: p.videoProvider,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      specialties: specialtyRows
        .map((item) => item.specialty)
        .filter(Boolean),
    };
  }

  async getPublicProfessionalBySlug(slug: string) {
    let professional = await this.prisma.professional.findUnique({
      where: { slug },
      include: {
        user: true,
        profession: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!professional) {
      const legacyMatches = await this.prisma.professional.findMany({
        where: {
          slug: {
            startsWith: `${slug}-`,
          },
        },
        include: {
          user: true,
          profession: {
            include: {
              category: true,
            },
          },
        },
        take: 10,
      });

      professional =
        legacyMatches.find((item) => this.isLegacyRandomSlug(item.slug, slug)) ||
        null;
    }

    if (!professional) return null;

    const reviewSummary = await this.getReviewSummary(professional.userId);
    const reviews = await this.prisma.review.findMany({
      where: { professionalId: professional.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        customer: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });

    return {
      id: professional.userId,
      slug: professional.slug,
      name: this.getProtectedProfessionalName(professional.name || professional.user.name),
      firstName: this.getFirstName(professional.name || professional.user.name),
      lastInitial: this.getLastInitial(professional.name || professional.user.name),
      specialty: professional.profession?.name || professional.specialty || 'Profesional',
      customProfession: professional.customProfession,
      professionId: professional.professionId,
      professionName: professional.profession?.name || null,
      professionSlug: professional.profession?.slug || null,
      categoryName: professional.profession?.category?.name || null,
      categorySlug: professional.profession?.category?.slug || null,
      city: professional.officeCity || null,
      region: professional.officeRegion || null,
      country: professional.officeCountry || professional.user.country || null,
      ratingAverage: reviewSummary.ratingAverage,
      reviewsCount: reviewSummary.reviewsCount,
      reviews,
      shortDescription: this.truncateText(professional.description, 140),
      description: professional.description || '',
      experience: professional.description || '',
      specialties: [
        professional.profession?.name,
        professional.customProfession,
        professional.specialty,
      ].filter(Boolean),
      price: professional.price,
      duration: professional.duration,
      image: professional.image,
      documentAutomationEnabled: professional.documentAutomationEnabled,
      manualDocumentMode: professional.manualDocumentMode,
      taxDocumentReady: this.isProfessionalTaxReady(professional),
      attentionMode: professional.attentionMode,
      officeCity: professional.officeCity,
      officeRegion: professional.officeRegion,
      officeCountry: professional.officeCountry || professional.user.country,
      videoProvider: professional.videoProvider,
    };
  }

  private normalizeSupportedCountry(country?: string | null): 'CL' | 'ES' | null {
    const value = String(country || '').trim().toUpperCase();

    if (value === 'CL' || value === 'ES') {
      return value;
    }

    return null;
  }

  private async getReviewSummaries(professionalIds: string[]) {
    const uniqueIds = Array.from(new Set(professionalIds.filter(Boolean)));
    const summaries = new Map<string, { ratingAverage: number; reviewsCount: number }>();

    if (uniqueIds.length === 0) {
      return summaries;
    }

    const rows = await this.prisma.review.groupBy({
      by: ['professionalId'],
      where: {
        professionalId: {
          in: uniqueIds,
        },
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    for (const row of rows) {
      summaries.set(row.professionalId, {
        ratingAverage: Number((row._avg.rating || 0).toFixed(1)),
        reviewsCount: row._count.rating,
      });
    }

    return summaries;
  }

  private async getReviewSummary(professionalId: string) {
    const summary = await this.prisma.review.aggregate({
      where: { professionalId },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    return {
      ratingAverage: Number((summary._avg.rating || 0).toFixed(1)),
      reviewsCount: summary._count.rating,
    };
  }

  async getSearchSuggestions(params: SearchSuggestionsParams) {
    const query = String(params.q || '').trim();

    if (query.length < 2) {
      return [];
    }

    const country = await this.resolveProfessionalCountryFilter({
      page: 1,
      limit: 8,
      country: params.country,
      viewer: params.viewer,
    });
    const legacyTerms = this.getLegacySearchTerms([query]);
    const textFilters = Array.from(new Set([query, ...legacyTerms]))
      .filter((term) => term.length >= 2);
    const professionalCountryFilter: Prisma.ProfessionalWhereInput = country
      ? {
          OR: [
            { officeCountry: country },
            {
              AND: [
                {
                  OR: [
                    { officeCountry: null },
                    { officeCountry: '' },
                  ],
                },
                {
                  OR: [
                    { user: { country } },
                    ...(country === 'CL'
                      ? [
                          { user: { country: null } },
                          { user: { country: '' } },
                        ]
                      : []),
                  ],
                },
              ],
            },
          ],
        }
      : {};

    const [professions, professionals] = await this.prisma.$transaction([
      this.prisma.profession.findMany({
        where: {
          isActive: true,
          OR: textFilters.flatMap((term) => [
            { name: { contains: term, mode: 'insensitive' as const } },
            { slug: { contains: term, mode: 'insensitive' as const } },
            { aliases: { has: term } },
            { category: { name: { contains: term, mode: 'insensitive' as const } } },
            { category: { slug: { contains: term, mode: 'insensitive' as const } } },
          ]),
        },
        take: 5,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { category: true },
      }),
      this.prisma.professional.findMany({
        where: {
          AND: [
            professionalCountryFilter,
            {
              OR: textFilters.flatMap((term) => [
                { name: { contains: term, mode: 'insensitive' as const } },
                { specialty: { contains: term, mode: 'insensitive' as const } },
                { customProfession: { contains: term, mode: 'insensitive' as const } },
                { description: { contains: term, mode: 'insensitive' as const } },
                { officeCity: { contains: term, mode: 'insensitive' as const } },
                { user: { name: { contains: term, mode: 'insensitive' as const } } },
                { profession: { name: { contains: term, mode: 'insensitive' as const } } },
                { profession: { slug: { contains: term, mode: 'insensitive' as const } } },
                { profession: { category: { name: { contains: term, mode: 'insensitive' as const } } } },
              ]),
            },
          ],
        },
        take: 8,
        orderBy: [{ name: 'asc' }, { user: { name: 'asc' } }],
        include: {
          user: true,
          profession: {
            include: {
              category: true,
            },
          },
        },
      }),
    ]);

    const professionSuggestions = professions.map((profession) => ({
      type: 'profession' as const,
      id: profession.id,
      label: profession.name,
      specialty: profession.name,
      slug: profession.slug,
      categoryName: profession.category?.name || null,
      categorySlug: profession.category?.slug || null,
      city: null,
    }));
    const professionalSuggestions = professionals.map((professional) => ({
      type: 'professional' as const,
      id: professional.userId,
      slug: professional.slug,
      label: this.getProtectedProfessionalName(professional.name || professional.user.name),
      specialty: professional.profession?.name || professional.customProfession || professional.specialty || 'Profesional',
      categoryName: professional.profession?.category?.name || null,
      categorySlug: professional.profession?.category?.slug || null,
      city: professional.officeCity || null,
    }));

    return [...professionSuggestions, ...professionalSuggestions].slice(0, 8);
  }

  private getLegacySearchTerms(terms: Array<string | null | undefined>): string[] {
    const accentMap: Record<string, string[]> = {
      psicologo: ['Psicólogo', 'Psicologia', 'Psicología'],
      psicologia: ['Psicólogo', 'Psicología'],
      kinesiologo: ['Kinesiólogo'],
      cardiologo: ['Cardiólogo'],
      medico: ['Médico'],
      'medico general': ['Médico General'],
      fonoaudiologo: ['Fonoaudiólogo'],
      estetica: ['Estética'],
      cosmetica: ['Cosmética'],
      nutricion: ['Nutrición'],
    };

    const values = terms
      .flatMap((term) => {
        const value = String(term || '').trim();
        const normalized = this.normalizeSearchText(value);
        const spaced = value.replace(/-/g, ' ');
        const normalizedSpaced = this.normalizeSearchText(spaced);

        return [
          value,
          spaced,
          normalized,
          normalizedSpaced,
          ...(accentMap[normalized] || []),
          ...(accentMap[normalizedSpaced] || []),
        ];
      })
      .map((term) => term.trim())
      .filter(Boolean);

    return Array.from(new Set(values));
  }

  private normalizeSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private async resolveProfessionalCountryFilter(
    params: FindProfessionalsParams,
  ): Promise<'CL' | 'ES' | null> {
    const queryCountry = this.normalizeSupportedCountry(params.country);

    if (params.viewer?.role === Role.ADMIN) {
      return queryCountry;
    }

    if (!params.viewer?.id) {
      return queryCountry || 'CL';
    }

    const user = await this.prisma.user.findUnique({
      where: { id: params.viewer.id },
      select: { country: true },
    });

    return this.normalizeSupportedCountry(user?.country) || queryCountry || 'CL';
  }

  async recordProfessionalProfileEvent(slug: string, type: 'VIEW' | 'COPY_LINK' | 'SHARE') {
    const professional = await this.findPublicProfessionalIdBySlug(slug);

    if (!professional) return null;

    const eventId = randomUUID();

    await this.prisma.$executeRaw`
      INSERT INTO "ProfessionalProfileEvent" ("id", "professionalId", "type", "createdAt")
      VALUES (${eventId}, ${professional.id}, ${type}::"ProfileEventType", NOW())
    `;

    return { id: eventId };
  }

  private async findPublicProfessionalIdBySlug(slug: string): Promise<{ id: string } | null> {
    const exact = await this.prisma.professional.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (exact) {
      return exact;
    }

    const legacyMatches = await this.prisma.professional.findMany({
      where: {
        slug: {
          startsWith: `${slug}-`,
        },
      },
      select: {
        id: true,
        slug: true,
      },
      take: 10,
    });

    const legacy = legacyMatches.find((item) =>
      this.isLegacyRandomSlug(item.slug, slug),
    );

    return legacy ? { id: legacy.id } : null;
  }

  private isLegacyRandomSlug(currentSlug: string | null | undefined, cleanSlug: string): boolean {
    if (!currentSlug || !cleanSlug) {
      return false;
    }

    const suffix = currentSlug.replace(`${cleanSlug}-`, '');

    return currentSlug.startsWith(`${cleanSlug}-`) && /^[a-z0-9]{6,}$/.test(suffix);
  }

  private getProtectedProfessionalName(name?: string | null): string {
    const firstName = this.getFirstName(name);
    const lastInitial = this.getLastInitial(name);

    return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
  }

  private getFirstName(name?: string | null): string {
    const parts = String(name || 'Profesional')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return parts[0] || 'Profesional';
  }

  private getLastInitial(name?: string | null): string {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() || '' : '';
  }

  private truncateText(value?: string | null, max = 140): string {
    const cleaned = String(value || '').trim();

    if (cleaned.length <= max) return cleaned;

    return `${cleaned.slice(0, max).trim()}...`;
  }

  private buildProfessionalSlug(name: string): string {
    return String(name || 'profesional')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 70);
  }

  private async buildUniqueProfessionalSlug(
    name: string,
    currentUserId: string,
  ): Promise<string> {
    const base = this.buildProfessionalSlug(name) || 'profesional';

    for (let index = 1; index <= 50; index += 1) {
      const candidate = index === 1 ? base : `${base}-${index}`;
      const existing = await this.prisma.professional.findFirst({
        where: {
          slug: candidate,
          userId: {
            not: currentUserId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${base}-${Date.now().toString(36)}`;
  }

  private shouldRefreshProfessionalSlug(
    currentSlug: string,
    name: string,
  ): boolean {
    const base = this.buildProfessionalSlug(name) || 'profesional';

    if (currentSlug === base) {
      return false;
    }

    const suffix = currentSlug.replace(`${base}-`, '');

    return currentSlug.startsWith(`${base}-`) && /^[a-z0-9]{6,}$/.test(suffix);
  }

  private isProfessionalTaxReady(professional: {
    taxId?: string | null;
    taxName?: string | null;
    taxEmail?: string | null;
    taxAddress?: string | null;
    taxCity?: string | null;
    user?: { email?: string | null } | null;
  }): boolean {
    return !!(
      professional.taxId &&
      professional.taxName &&
      (professional.taxEmail || professional.user?.email) &&
      professional.taxAddress &&
      professional.taxCity
    );
  }

  // PERFIL ACTUAL
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      include: {
        professional: {
          include: {
            profession: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });
  }
  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        country: true,
        timezone: true,
        taxId: true,
        taxName: true,
        taxEmail: true,
        taxAddress: true,
        taxCountry: true,
        taxCity: true,
        wantsTaxDocumentByDefault: true,
        customerInterests: true,
        preferredAttentionMode: true,
        preferredCity: true,
        preferredRegion: true,

        professional: {
          select: {
            id: true,
            slug: true,
            name: true,
            specialty: true,
            professionId: true,
            profession: {
              include: {
                category: true,
              },
            },
            description: true,
            rules: true,
            price: true,
            duration: true,
            image: true,

            bankName: true,
            accountType: true,
            accountNumber: true,
            accountHolder: true,
            accountEmail: true,
            documentAutomationEnabled: true,
            manualDocumentMode: true,
            taxProvider: true,
            taxId: true,
            taxName: true,
            taxEmail: true,
            taxAddress: true,
            taxCountry: true,
            taxCity: true,
            attentionMode: true,
            officeAddress: true,
            officeCity: true,
            officeRegion: true,
            officeCountry: true,
            officeLatitude: true,
            officeLongitude: true,
            arrivalInstructions: true,
            videoProvider: true,
            customVideoUrl: true,
          },
        },
      },
    });
  }
}

