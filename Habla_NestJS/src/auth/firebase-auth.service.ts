import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAuthService {
  private app?: App;

  constructor(private readonly config: ConfigService) {}

  async verifyGoogleIdToken(idToken: string): Promise<DecodedIdToken> {
    const token = String(idToken || '').trim();

    if (!token) {
      throw new UnauthorizedException('Token de Google requerido.');
    }

    const projectId = this.getProjectId();

    try {
      // Firebase Admin verifies signature, exp, aud and iss against projectId.
      const decoded = await getAuth(this.getApp(projectId)).verifyIdToken(
        token,
        true,
      );
      const expectedIssuer = `https://securetoken.google.com/${projectId}`;

      if (
        decoded.aud !== projectId ||
        decoded.iss !== expectedIssuer ||
        decoded.exp * 1000 <= Date.now() ||
        decoded.email_verified !== true ||
        decoded.firebase?.sign_in_provider !== 'google.com' ||
        !decoded.email ||
        !decoded.uid
      ) {
        throw new UnauthorizedException('Token de Google invalido.');
      }

      return decoded;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Token de Google invalido o expirado.');
    }
  }

  private getProjectId(): string {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID')?.trim();

    if (!projectId) {
      throw new InternalServerErrorException(
        'Google Sign-In no esta configurado en el servidor.',
      );
    }

    return projectId;
  }

  private getApp(projectId: string): App {
    if (this.app) {
      return this.app;
    }

    const existingApp = getApps().find((app) => app.name === 'conecta-auth');
    this.app =
      existingApp ??
      initializeApp(
        {
          credential: this.buildCredential(projectId),
          projectId,
        },
        'conecta-auth',
      );

    return this.app;
  }

  private buildCredential(projectId: string) {
    const clientEmail = this.config
      .get<string>('FIREBASE_CLIENT_EMAIL')
      ?.trim();
    const privateKey = this.config
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n')
      .trim();

    if (clientEmail && privateKey) {
      return cert({
        projectId,
        clientEmail,
        privateKey,
      });
    }

    const serviceAccountBase64 = this.config
      .get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64')
      ?.trim();

    if (serviceAccountBase64) {
      try {
        const serviceAccount = JSON.parse(
          Buffer.from(serviceAccountBase64, 'base64').toString('utf8'),
        );
        return cert(serviceAccount);
      } catch {
        throw new InternalServerErrorException(
          'FIREBASE_SERVICE_ACCOUNT_BASE64 no es valido.',
        );
      }
    }

    return applicationDefault();
  }
}
