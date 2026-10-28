import { getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthUser, AuthProviderType } from './constants';
import { DEFAULT_FIREBASE_CONFIG, isFirebaseConfigured } from './firebaseConfig';

let authClient: FirebaseAuth.Auth | undefined;

export function getFirebaseAuth(): FirebaseAuth.Auth {
  if (authClient) return authClient;
  if (!isFirebaseConfigured(DEFAULT_FIREBASE_CONFIG)) throw new Error('Firebase bağlantısı henüz yapılandırılmadı.');
  const app = getApps().find(item => item.name === 'chain-auth') || initializeApp(DEFAULT_FIREBASE_CONFIG, 'chain-auth');
  if (Platform.OS === 'web') authClient = FirebaseAuth.getAuth(app);
  else {
    const nativeAuth = FirebaseAuth as typeof FirebaseAuth & {
      getReactNativePersistence: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
    };
    authClient = nativeAuth.initializeAuth(app, { persistence: nativeAuth.getReactNativePersistence(AsyncStorage) });
  }
  return authClient;
}

export function toAppUser(user: FirebaseAuth.User): AuthUser {
  const providerId = user.providerData[0]?.providerId;
  const provider: AuthProviderType = providerId === 'google.com' ? 'google' : providerId === 'apple.com' ? 'apple' : 'email';
  const parts = (user.displayName || '').trim().split(/\s+/);
  return { uid: user.uid, email: user.email || undefined, displayName: user.displayName || undefined,
    firstName: parts[0] || '', lastName: parts.slice(1).join(' '), provider,
    createdAt: user.metadata.creationTime || new Date().toISOString() };
}

export function firebaseErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Giriş penceresi kapatıldı. Tekrar deneyebilirsin.',
    'auth/cancelled-popup-request': 'Önceki giriş işlemi iptal edildi.',
    'auth/popup-blocked': 'Tarayıcı giriş penceresini engelledi. Bu site için açılır pencerelere izin ver.',
    'auth/unauthorized-domain': 'Bu adres Firebase girişine yetkili değil. Authentication → Settings → Authorized domains bölümüne bu sitenin alan adını ekle.',
    'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase panelinde henüz etkinleştirilmedi.',
    'auth/configuration-not-found': 'Firebase Authentication henüz kurulmadı. Panelde Authentication → Get started adımını tamamla.',
    'auth/invalid-api-key': 'Firebase bağlantı anahtarı geçersiz.',
    'auth/network-request-failed': 'Giriş sunucusuna ulaşılamadı. İnternet bağlantını kontrol et.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/user-not-found': 'E-posta veya şifre hatalı.',
    'auth/wrong-password': 'E-posta veya şifre hatalı.',
    'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı. Giriş yap seçeneğini kullan.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/invalid-email': 'Geçerli bir e-posta adresi gir.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Bir süre sonra tekrar dene.',
    'auth/account-exists-with-different-credential': 'Bu adres farklı bir giriş yöntemiyle kayıtlı. Önce o yöntemle giriş yap.',
  };
  return messages[code] || (error instanceof Error && !code ? error.message : 'Giriş tamamlanamadı. Lütfen tekrar dene.');
}

export async function restoreFirebaseUser(): Promise<AuthUser | null> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  return auth.currentUser ? toAppUser(auth.currentUser) : null;
}

export async function firebaseIdToken(uid: string): Promise<string> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser || auth.currentUser.uid !== uid) throw new Error('Bulut erişimi için hesabına yeniden giriş yap.');
  // The SDK refreshes expired tokens; never trust the app's cached profile as authorization.
  return auth.currentUser.getIdToken();
}

export async function firebaseEmailSignIn(email: string, password: string): Promise<AuthUser> {
  return toAppUser((await FirebaseAuth.signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)).user);
}

export async function firebaseEmailSignUp(email: string, password: string, displayName: string): Promise<AuthUser> {
  const { user } = await FirebaseAuth.createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  await FirebaseAuth.updateProfile(user, { displayName });
  return toAppUser(user);
}

export async function firebasePasswordReset(email: string): Promise<void> {
  await FirebaseAuth.sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function firebaseSignOut(): Promise<void> {
  await FirebaseAuth.signOut(getFirebaseAuth());
}
