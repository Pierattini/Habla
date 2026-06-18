import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PROFESSION_CATALOG } from './profession-catalog';

@Injectable()
export class ProfessionsService {
  private catalogReady = false;

  constructor(private prisma: PrismaService) {}

  async findCategories() {
    await this.ensureDefaultCatalog();

    return this.prisma.professionalCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        professions: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
  }

  async findProfessions(params: { categorySlug?: string; search?: string }) {
    await this.ensureDefaultCatalog();

    const search = params.search?.trim();
    const where: Prisma.ProfessionWhereInput = {
      isActive: true,
      ...(params.categorySlug && {
        category: { slug: params.categorySlug, isActive: true },
      }),
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { aliases: { has: search } },
      ];
    }

    return this.prisma.profession.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: true },
    });
  }

  async ensureDefaultCatalog() {
    if (this.catalogReady) return;

    for (const [categoryIndex, category] of PROFESSION_CATALOG.entries()) {
      const savedCategory = await this.prisma.professionalCategory.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          icon: category.icon,
          sortOrder: categoryIndex,
          isActive: true,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          sortOrder: categoryIndex,
          isActive: true,
        },
      });

      for (const [professionIndex, profession] of category.professions.entries()) {
        await this.prisma.profession.upsert({
          where: { slug: profession.slug },
          update: {
            categoryId: savedCategory.id,
            name: profession.name,
            icon: profession.icon,
            aliases: profession.aliases || [],
            sortOrder: professionIndex,
            isActive: true,
          },
          create: {
            categoryId: savedCategory.id,
            name: profession.name,
            slug: profession.slug,
            icon: profession.icon,
            aliases: profession.aliases || [],
            sortOrder: professionIndex,
            isActive: true,
          },
        });
      }
    }

    this.catalogReady = true;
  }
}
