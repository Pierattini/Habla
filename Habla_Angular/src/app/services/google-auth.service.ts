import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  Auth,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
} from 'firebase/auth';
import { environment } from '../../environments/environment';

export class GoogleSignInCancelledError extends Error {}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private webAuthPromise: Promise<Auth> | null = null;

  preload(): Promise<void> {
    if (Capacitor.isNativePlatform()) return Promise.resolve();
    return this.getWebAuth().then(() => undefined);
  }

  async signIn(): Promise<string> {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signInWithGoogle({
          useCredentialManager: false,
        });
        const { token } = await FirebaseAuthentication.getIdToken({
          forceRefresh: true,
        });

        if (!token) {
          throw new Error('Firebase no devolvio un ID token.');
        }

        return token;
      }

      const auth = await this.getWebAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);

      return credential.user.getIdToken(true);
    } catch (error: any) {
      const code = String(error?.code || '').toLowerCase();
      const message = String(error?.message || '').toLowerCase();

      if (
        code.includes('popup-closed') ||
        code.includes('cancelled') ||
        code.includes('canceled') ||
        message.includes('cancelled') ||
        message.includes('canceled')
      ) {
        throw new GoogleSignInCancelledError();
      }

      throw error;
    }
  }

  private getWebAuth(): Promise<Auth> {
    if (this.webAuthPromise) return this.webAuthPromise;

    this.webAuthPromise = (async () => {
      const config = environment.firebase;
      if (!config.apiKey || !config.authDomain || !config.projectId) {
        throw new Error('Firebase Web no esta configurado.');
      }

      const firebaseConfig = {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        ...(config.appId ? { appId: config.appId } : {}),
      };
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
      return auth;
    })().catch((error) => {
      this.webAuthPromise = null;
      throw error;
    });

    return this.webAuthPromise;
  }
}
