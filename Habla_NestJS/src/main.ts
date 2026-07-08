import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '1mb';

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(json({ limit: requestBodyLimit }));
  app.use(urlencoded({ extended: true, limit: requestBodyLimit }));

  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production';
  const developmentOrigins = [
    'http://localhost:4200',
    'http://localhost:8100',
    'capacitor://localhost',
    'https://localhost',
  ];
  const configuredOrigins = (
    process.env.CORS_ORIGINS ||
    process.env.PUBLIC_FRONTEND_URL ||
    (!isProduction ? developmentOrigins.join(',') : '')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction && configuredOrigins.length === 0) {
    throw new Error('CORS_ORIGINS debe configurarse en produccion.');
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origen CORS no permitido'), false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
