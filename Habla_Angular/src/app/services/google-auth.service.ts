import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
} from 'firebase/auth';
import { environment } from '../../environments/environment';

export class GoogleSignInCancelledError extends Error {}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  async signIn(): Promise<string> {
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseAuthentication.signInWithGoogle();
        const { token } = await FirebaseAuthentication.getIdToken({
          forceRefresh: true,
        });

        if (!token) {
          throw new Error('Firebase no devolvio un ID token.');
        }

        return token;
      }

      const config = environment.firebase;
      if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
        throw new Error('Firebase Web no esta configurado.');
      }

      const app = getApps().length ? getApp() : initializeApp(config);
      const auth = getAuth(app);
      await setPersistence(auth, browserLocalPersistence);
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
}
