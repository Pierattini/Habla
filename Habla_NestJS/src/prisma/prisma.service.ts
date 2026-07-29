import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const adapter = new PrismaPg(pool);

    super({
      adapter,
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logSafeDatabaseTarget();
  }

  private logSafeDatabaseTarget() {
    try {
      const databaseUrl = new URL(process.env.DATABASE_URL || '');
      const databaseName = databaseUrl.pathname.replace(/^\//, '') || 'unknown';

      this.logger.log(
        `DATABASE_CONNECTED host=${databaseUrl.hostname || 'unknown'} database=${databaseName}`,
      );
    } catch {
      this.logger.warn(
        'DATABASE_CONNECTED target=unavailable (DATABASE_URL could not be parsed)',
      );
    }
  }
}
