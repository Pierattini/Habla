# Google Sign-In en Conecta

## Cambios realizados

La autenticacion por email/contrasena sigue intacta. Google usa Firebase
Authentication en Web y el SDK nativo mediante Capacitor en Android. Ambos
flujos entregan un Firebase ID Token a `POST /auth/google`; NestJS lo valida con
Firebase Admin y responde con el mismo `access_token` y el mismo objeto `user`
del login tradicional.

La migracion `20260723143000_add_google_authentication` agrega:

- `User.googleId`: UID de Firebase unico, para impedir que una identidad quede
  vinculada a dos usuarios.
- `User.lastLoginAt`: fecha del ultimo login tradicional o Google.

La vinculacion se hace por el correo verificado del token. Si existe, se
conservan contraseña, rol y datos actuales y se agrega `googleId`. Si no existe,
se crea la cuenta. La restriccion unica de `email` y el `upsert` evitan
duplicados. Las cuentas Google nuevas reciben un hash aleatorio no utilizable
como contraseña; pueden usar el restablecimiento de contraseña si mas adelante
quieren habilitar acceso tradicional.

Firebase Admin verifica firma, expiracion, audiencia e issuer. El backend
tambien exige `email_verified=true`, `firebase.sign_in_provider=google.com`,
correo y UID. Se usa `checkRevoked=true`.

## Dependencias

Frontend:

```bash
cd Habla_Angular
npm install
npx cap sync android
```

Backend:

```bash
cd Habla_NestJS
npm install
npx prisma generate
```

## Crear y configurar Firebase

1. Crear o elegir un proyecto en Firebase Console.
2. En **Authentication > Sign-in method**, habilitar **Google** y definir el
   email de soporte.
3. Registrar una app Web y una app Android dentro del mismo proyecto Firebase.
4. En Google Cloud Console, revisar la pantalla de consentimiento OAuth:
   nombre Conecta, dominio autorizado `turedpro.com`, enlaces de privacidad y
   terminos publicados y email de soporte.
5. Si la pantalla OAuth esta en modo externo y testing, agregar testers o
   publicarla antes de produccion.

No se solicitan scopes adicionales: solo autenticacion basica (`openid`,
`email`, `profile`).

## Web

Copiar la configuracion de la app Web de Firebase en:

- `Habla_Angular/src/environments/environment.ts`
- `Habla_Angular/src/environments/environment.production.ts`

Campos:

```ts
firebase: {
  apiKey: '...',
  authDomain: '<firebase-project-id>.firebaseapp.com',
  projectId: '<firebase-project-id>',
  appId: '...',
}
```

La `apiKey` Web de Firebase no es una credencial secreta. Debe restringirse en
Google Cloud a las APIs y referers necesarios.

En **Firebase Authentication > Settings > Authorized domains**, agregar:

- `localhost` para desarrollo.
- `app.turedpro.com` para produccion.

Verificar que `https://app.turedpro.com` sirve por HTTPS y que su Content
Security Policy permite los dominios de Firebase/Google usados por Auth. El
flujo Web usa el popup oficial de Firebase y persistencia local. Si el navegador
bloquea popups, el usuario recibe un error amigable.

## Android y Capacitor

El identificador usado por el proyecto nativo es:

```text
app.conecta.mobileapp
```

Debe coincidir exactamente en Firebase, `capacitor.config.ts`, `namespace` y
`applicationId` de Gradle. Descargar `google-services.json` desde la app Android
de Firebase y guardarlo en:

```text
Habla_Angular/android/app/google-services.json
```

No reutilizar un archivo de otro package ni publicar su contenido. Tras
reemplazarlo:

```bash
cd Habla_Angular
npx cap sync android
```

El plugin esta configurado con `providers: ['google.com']`,
`rgcfaIncludeGoogle=true` y Android Credential Manager.

### SHA-1 y SHA-256

Registrar en la app Android de Firebase las huellas de todos los certificados
que puedan firmar la app:

1. Debug local:

   ```powershell
   cd Habla_Angular\android
   .\gradlew signingReport
   ```

2. Certificado de upload/release local.
3. Certificado de **Google Play App Signing**, obtenido en Google Play Console
   > Configuracion > Integridad de la aplicacion > Certificado de firma de la
   aplicacion.

Las huellas de upload y Play App Signing suelen ser distintas. Agregar tanto
SHA-1 como SHA-256, volver a descargar `google-services.json` y sincronizar. El
cliente OAuth Android generado por Firebase debe usar
`app.conecta.mobileapp`.

Probar una build instalada desde un track interno de Play, no solo una build
local, para validar la huella de Play.

## NestJS / Firebase Admin

Variables obligatorias:

```env
FIREBASE_PROJECT_ID=<firebase-project-id>
```

Elegir **una** forma de credenciales.

Opcion recomendada en infraestructura con identidad de Google:

```env
GOOGLE_APPLICATION_CREDENTIALS=/ruta/segura/service-account.json
```

Opcion con secreto base64:

```env
FIREBASE_SERVICE_ACCOUNT_BASE64=<json-completo-codificado-en-base64>
```

Opcion con campos separados:

```env
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@<project>.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

No incluir credenciales Admin ni `google-services.json` en repositorios
publicos, imágenes Docker o frontend. El `FIREBASE_PROJECT_ID` del backend debe
ser exactamente el `projectId` del cliente; Firebase Admin lo usa para validar
`aud` e `iss`.

Aplicar la migracion en cada entorno antes de desplegar el backend:

```bash
cd Habla_NestJS
npx prisma migrate deploy
npx prisma generate
npm run build
```

## Despliegue a produccion

Orden recomendado:

1. Crear backup de PostgreSQL.
2. Configurar los secretos de Firebase Admin.
3. Ejecutar `npx prisma migrate deploy`.
4. Desplegar NestJS y comprobar `POST /auth/login` tradicional.
5. Completar la configuracion Web de produccion y construir Angular.
6. Ejecutar `npx cap sync android`, generar el AAB firmado y subirlo a un track
   interno.
7. Probar estos casos en Web y desde Play:
   - cuenta nueva con Google;
   - correo que ya tiene contraseña (debe vincular, no duplicar);
   - segundo login Google;
   - cancelacion del selector;
   - token alterado/expirado;
   - usuario inactivo;
   - login, registro y recuperacion tradicionales.
8. Confirmar en PostgreSQL que el correo sigue siendo unico y `googleId` se
   completa sin cambiar el rol de cuentas existentes.

## Google Play y privacidad

Antes de produccion:

- Completar **Data safety** según los datos realmente recogidos por Conecta y
  por los SDK incluidos (identificadores, email, nombre/foto y diagnosticos que
  correspondan).
- Mantener visibles y vigentes la politica de privacidad, terminos y el flujo
  de eliminacion de cuenta ya existente en Conecta.
- Explicar en la politica que se usa Firebase Authentication/Google Sign-In y
  para que se procesan esos datos.
- Usar el texto y apariencia aprobados de “Continuar con Google”; no insinuar
  patrocinio de Google.
- No pedir scopes de Google que no sean necesarios.
- Mantener `targetSdkVersion` conforme al nivel exigido por Play al publicar.
- Probar el AAB firmado por Play y revisar Pre-launch report.

La conformidad final requiere completar y revisar estos pasos en Firebase,
Google Cloud y Play Console; el codigo no puede configurar esas consolas por si
solo.

## Operacion y resolucion de errores

- `Token de Google invalido o expirado`: comprobar proyecto Firebase coincidente,
  reloj del servidor y credenciales Admin.
- Error solo en Android release/Play: falta SHA del certificado de Play o el
  `google-services.json` quedo desactualizado.
- `Developer error` en Android: revisar package, SHA y cliente OAuth Android.
- Error solo en `app.turedpro.com`: agregar el dominio autorizado y revisar
  `authDomain`/CSP.
- El endpoint Google tiene rate limit. Nunca registrar ID tokens, credenciales
  Admin ni respuestas completas de Firebase en logs.
