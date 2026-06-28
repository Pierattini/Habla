import { BadRequestException, Injectable } from '@nestjs/common';
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
  constructor(private readonly configService: ConfigService) {}

  async verify(token: string | undefined, expectedAction: string): Promise<void> {
    const secret = this.configService.get<string>('RECAPTCHA_SECRET_KEY');
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (!secret) {
      if (isProduction) {
        throw new BadRequestException('Falta configuracion reCAPTCHA.');
      }

      return;
    }

    if (!token) {
      throw new BadRequestException('No pudimos verificar tu solicitud. Intentalo nuevamente.');
    }

    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret,
          response: token,
        }).toString(),
      },
    );

    if (!response.ok) {
      throw new BadRequestException('No pudimos verificar tu solicitud. Intentalo nuevamente.');
    }

    const result = (await response.json()) as RecaptchaVerifyResponse;
    const minScore = Number(this.configService.get<string>('RECAPTCHA_MIN_SCORE') || 0.5);

    if (
      !result.success ||
      result.action !== expectedAction ||
      Number(result.score || 0) < minScore
    ) {
      throw new BadRequestException('No pudimos verificar tu solicitud. Intentalo nuevamente.');
    }
  }
}
