import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RecaptchaVerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
};

@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(token: string | undefined, expectedAction: string): Promise<void> {
    const secret =
      this.configService.get<string>('RECAPTCHA_SECRET_KEY') ||
      this.configService.get<string>('GOOGLE_RECAPTCHA_SECRET') ||
      this.configService.get<string>('GOOGLE_RECAPTCHA_SECRET_KEY');
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production' ||
      this.configService.get<string>('APP_ENV') === 'production';

    if (!secret) {
      if (isProduction) {
        this.logger.error(
          `RECAPTCHA_CONFIG_MISSING action=${expectedAction}`,
        );
        throw new BadRequestException('Falta configuración reCAPTCHA.');
      }

      this.logger.warn(
        `RECAPTCHA_SKIPPED_NO_SECRET action=${expectedAction} environment=development`,
      );
      return;
    }

    if (!token) {
      this.logger.warn(`RECAPTCHA_TOKEN_MISSING action=${expectedAction}`);
      throw new BadRequestException(
        'No pudimos verificar tu solicitud. Inténtalo nuevamente.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let response: Response;

    try {
      response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: token,
        }).toString(),
        signal: controller.signal,
      });
    } catch (error) {
      this.logger.error(
        `RECAPTCHA_GOOGLE_REQUEST_FAILED action=${expectedAction} error=${
          error instanceof Error ? error.name : 'unknown'
        }`,
      );
      throw new BadRequestException(
        'No pudimos verificar tu solicitud. Inténtalo nuevamente.',
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      this.logger.error(
        `RECAPTCHA_GOOGLE_HTTP_ERROR action=${expectedAction} status=${response.status}`,
      );
      throw new BadRequestException(
        'No pudimos verificar tu solicitud. Inténtalo nuevamente.',
      );
    }

    const result = (await response.json()) as RecaptchaVerifyResponse;
    const minScore = Number(
      this.configService.get<string>('RECAPTCHA_MIN_SCORE') || 0.5,
    );
    const score = Number(result.score || 0);

    if (
      !result.success ||
      result.action !== expectedAction ||
      score < minScore
    ) {
      this.logger.warn(
        `RECAPTCHA_REJECTED action=${expectedAction} googleAction=${
          result.action || 'missing'
        } success=${Boolean(result.success)} score=${score} minScore=${minScore} hostname=${
          result.hostname || 'missing'
        } errors=${(result['error-codes'] || []).join(',') || 'none'}`,
      );
      throw new BadRequestException(
        'No pudimos verificar tu solicitud. Inténtalo nuevamente.',
      );
    }

    this.logger.log(
      `RECAPTCHA_ACCEPTED action=${expectedAction} score=${score} hostname=${
        result.hostname || 'missing'
      }`,
    );
  }
}
