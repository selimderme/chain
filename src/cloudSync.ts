import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  AppDataState,
  AuthProviderType,
  AuthUser,
  DEFAULT_HABITS,
  TABS,
  TabId,
} from './constants';
import {
  DEFAULT_FIREBASE_CONFIG,
  FirebaseConfigOptions,
  isFirebaseConfigured,
} from './firebaseConfig';
import { pad, uid } from './utils';

const AUTH_SESSION_KEY = 'gunluk-plan:auth-session:v1';
const FIREBASE_CONFIG_KEY = 'gunluk-plan:firebase-config:v1';
const PENDING_SYNC_KEY = 'gunluk-plan:pending-sync:v1';
const CLOUD_VAULT_PREFIX = 'gunluk-plan:cloud-vault:v1:';
const LOCAL_ACCOUNTS_KEY = 'gunluk-plan:cloud-accounts:v1';

export interface AuthSessionState {
  hasCompletedOnboarding: boolean;
  user: AuthUser | null;
}

interface StoredAccountRecord {
  uid: string;
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  provider: AuthProviderType;
  createdAt: string;
}

export function formatSyncTimestamp(): string {
  const now = new Date();
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function deterministicUid(provider: AuthProviderType, email: string): string {
  const clean = normalizeEmail(email);
  let hash = 5381;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 33) ^ clean.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16);
  return `${provider}_${clean.replace(/[^a-z0-9]/g, '_')}_${hex}`;
}

function simpleHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// ───────── Firebase Yapılandırma Yönetimi ─────────

export async function loadFirebaseConfig(): Promise<FirebaseConfigOptions> {
  try {
    const raw = await AsyncStorage.getItem(FIREBASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FirebaseConfigOptions>;
      return {
        ...DEFAULT_FIREBASE_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // Varsayılan yapılandırmaya dön
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export async function saveFirebaseConfig(
  config: FirebaseConfigOptions
): Promise<void> {
  try {
    await AsyncStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Yoksay
  }
}

// ───────── Oturum (Session) Yönetimi ─────────

export async function loadAuthSession(): Promise<AuthSessionState> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuthSessionState;
      if (parsed && typeof parsed.hasCompletedOnboarding === 'boolean') {
        return parsed;
      }
    }
  } catch {
    // Yoksay
  }
  return {
    hasCompletedOnboarding: false,
    user: null,
  };
}

export async function saveAuthSession(
  session: AuthSessionState
): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Yoksay
  }
}

export async function clearAuthSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Yoksay
  }
}

// ───────── Çevrimdışı / İnternet Bağlantısı Kontrolü ─────────

export async function checkOnlineStatus(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    if (navigator.onLine === false) {
      return false;
    }
    return true;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok || res.status === 204 || res.status < 500;
  } catch {
    return false;
  }
}

export async function hasPendingCloudSync(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PENDING_SYNC_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

export async function setPendingCloudSync(pending: boolean): Promise<void> {
  try {
    if (pending) {
      await AsyncStorage.setItem(PENDING_SYNC_KEY, '1');
    } else {
      await AsyncStorage.removeItem(PENDING_SYNC_KEY);
    }
  } catch {
    // Yoksay
  }
}

// ───────── Yerel Bulut Hesap Kayıt Defteri ─────────

async function loadAccountRegistry(): Promise<StoredAccountRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Yoksay
  }
  return [];
}

async function saveAccountRegistry(
  accounts: StoredAccountRecord[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Yoksay
  }
}

// ───────── Kimlik Doğrulama (Giriş / Kayıt) İşlemleri ─────────

export async function continueAsGuestUser(): Promise<AuthUser> {
  const guestUser: AuthUser = {
    uid: 'guest_local',
    displayName: 'Misafir Kullanıcı',
    firstName: '',
    lastName: '',
    provider: 'guest',
    createdAt: formatSyncTimestamp(),
  };
  await saveAuthSession({
    hasCompletedOnboarding: true,
    user: guestUser,
  });
  return guestUser;
}

export async function signInWithGoogleAccount(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  idToken?: string;
}): Promise<AuthUser> {
  const cleanEmail = normalizeEmail(params.email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Lütfen geçerli bir Google e-posta adresi girin.');
  }

  const defaultNamePart = cleanEmail.split('@')[0] || 'Google';
  const firstName = (params.firstName || '').trim() || defaultNamePart;
  const lastName = (params.lastName || '').trim();
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const fbConfig = await loadFirebaseConfig();
  let userUid = deterministicUid('google', cleanEmail);
  let idToken = params.idToken;
  let refreshToken: string | undefined;

  if (isFirebaseConfigured(fbConfig) && params.idToken) {
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(
          fbConfig.apiKey.trim()
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postBody: `id_token=${encodeURIComponent(
              params.idToken
            )}&providerId=google.com`,
            requestUri: 'http://localhost',
            returnIdpCredential: true,
            returnSecureToken: true,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.localId) userUid = data.localId;
        if (data.idToken) idToken = data.idToken;
        if (data.refreshToken) refreshToken = data.refreshToken;
      }
    } catch {
      // Çevrimdışı veya özel oturumda yerel UID ile devam et
    }
  }

  const registry = await loadAccountRegistry();
  const existing = registry.find(
    (a) => a.email === cleanEmail && a.provider === 'google'
  );
  const finalFirstName = params.firstName?.trim() || existing?.firstName || firstName;
  const finalLastName = params.lastName?.trim() || existing?.lastName || lastName;

  const updatedRecord: StoredAccountRecord = {
    uid: existing?.uid || userUid,
    email: cleanEmail,
    firstName: finalFirstName,
    lastName: finalLastName,
    provider: 'google',
    createdAt: existing?.createdAt || formatSyncTimestamp(),
  };

  const nextRegistry = [
    updatedRecord,
    ...registry.filter(
      (a) => !(a.email === cleanEmail && a.provider === 'google')
    ),
  ];
  await saveAccountRegistry(nextRegistry);

  const authUser: AuthUser = {
    uid: updatedRecord.uid,
    email: cleanEmail,
    firstName: finalFirstName,
    lastName: finalLastName,
    displayName: [finalFirstName, finalLastName].filter(Boolean).join(' ') || displayName,
    provider: 'google',
    idToken,
    refreshToken,
    createdAt: updatedRecord.createdAt,
  };

  await saveAuthSession({
    hasCompletedOnboarding: true,
    user: authUser,
  });

  return authUser;
}

export async function signInWithAppleAccount(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  idToken?: string;
}): Promise<AuthUser> {
  const cleanEmail = normalizeEmail(params.email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Lütfen geçerli bir Apple ID (e-posta) girin.');
  }

  const defaultNamePart = cleanEmail.split('@')[0] || 'Apple';
  const firstName = (params.firstName || '').trim() || defaultNamePart;
  const lastName = (params.lastName || '').trim();
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const userUid = deterministicUid('apple', cleanEmail);
  const registry = await loadAccountRegistry();
  const existing = registry.find(
    (a) => a.email === cleanEmail && a.provider === 'apple'
  );
  const finalFirstName = params.firstName?.trim() || existing?.firstName || firstName;
  const finalLastName = params.lastName?.trim() || existing?.lastName || lastName;

  const updatedRecord: StoredAccountRecord = {
    uid: existing?.uid || userUid,
    email: cleanEmail,
    firstName: finalFirstName,
    lastName: finalLastName,
    provider: 'apple',
    createdAt: existing?.createdAt || formatSyncTimestamp(),
  };

  const nextRegistry = [
    updatedRecord,
    ...registry.filter(
      (a) => !(a.email === cleanEmail && a.provider === 'apple')
    ),
  ];
  await saveAccountRegistry(nextRegistry);

  const authUser: AuthUser = {
    uid: updatedRecord.uid,
    email: cleanEmail,
    firstName: finalFirstName,
    lastName: finalLastName,
    displayName: [finalFirstName, finalLastName].filter(Boolean).join(' ') || displayName,
    provider: 'apple',
    idToken: params.idToken,
    createdAt: updatedRecord.createdAt,
  };

  await saveAuthSession({
    hasCompletedOnboarding: true,
    user: authUser,
  });

  return authUser;
}

export async function signUpWithEmailPassword(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthUser> {
  const cleanEmail = normalizeEmail(params.email);
  const password = params.password || '';
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();

  if (!firstName) {
    throw new Error('Lütfen adınızı girin.');
  }
  if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    throw new Error('Lütfen geçerli bir e-posta adresi girin.');
  }
  if (password.length < 6) {
    throw new Error('Şifreniz en az 6 karakter olmalıdır.');
  }

  const fbConfig = await loadFirebaseConfig();
  let userUid = deterministicUid('email', cleanEmail);
  let idToken: string | undefined;
  let refreshToken: string | undefined;

  if (isFirebaseConfigured(fbConfig)) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
        fbConfig.apiKey.trim()
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          returnSecureToken: true,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || '';
      if (msg.includes('EMAIL_EXISTS')) {
        throw new Error(
          'Bu e-posta adresi zaten kayıtlı. Lütfen "Giriş Yap" sekmesini kullanın.'
        );
      }
      if (msg.includes('WEAK_PASSWORD')) {
        throw new Error('Şifre çok zayıf. En az 6 karakterli bir şifre seçin.');
      }
      if (msg.includes('INVALID_EMAIL')) {
        throw new Error('Geçersiz e-posta adresi formatı.');
      }
      throw new Error(`Kayıt işlemi başarısız oldu: ${msg || 'Bilinmeyen hata'}`);
    }
    if (data.localId) userUid = data.localId;
    if (data.idToken) idToken = data.idToken;
    if (data.refreshToken) refreshToken = data.refreshToken;
  } else {
    const registry = await loadAccountRegistry();
    const existing = registry.find(
      (a) => a.email === cleanEmail && a.provider === 'email'
    );
    if (existing) {
      throw new Error(
        'Bu e-posta adresi ile zaten bir hesap var. Lütfen "Giriş Yap" sekmesinden giriş yapın.'
      );
    }
  }

  const registry = await loadAccountRegistry();
  const newRecord: StoredAccountRecord = {
    uid: userUid,
    email: cleanEmail,
    passwordHash: simpleHash(password),
    firstName,
    lastName,
    provider: 'email',
    createdAt: formatSyncTimestamp(),
  };

  await saveAccountRegistry([
    newRecord,
    ...registry.filter(
      (a) => !(a.email === cleanEmail && a.provider === 'email')
    ),
  ]);

  const authUser: AuthUser = {
    uid: userUid,
    email: cleanEmail,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(' '),
    provider: 'email',
    idToken,
    refreshToken,
    createdAt: newRecord.createdAt,
  };

  await saveAuthSession({
    hasCompletedOnboarding: true,
    user: authUser,
  });

  return authUser;
}

export async function signInWithEmailPassword(params: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const cleanEmail = normalizeEmail(params.email);
  const password = params.password || '';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Lütfen geçerli bir e-posta adresi girin.');
  }
  if (!password) {
    throw new Error('Lütfen şifrenizi girin.');
  }

  const fbConfig = await loadFirebaseConfig();
  const registry = await loadAccountRegistry();
  const localRecord = registry.find(
    (a) => a.email === cleanEmail && a.provider === 'email'
  );

  let userUid = localRecord?.uid || deterministicUid('email', cleanEmail);
  let idToken: string | undefined;
  let refreshToken: string | undefined;

  if (isFirebaseConfigured(fbConfig)) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
        fbConfig.apiKey.trim()
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          returnSecureToken: true,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || '';
      if (
        msg.includes('EMAIL_NOT_FOUND') ||
        msg.includes('INVALID_LOGIN_CREDENTIALS') ||
        msg.includes('INVALID_PASSWORD')
      ) {
        throw new Error('E-posta adresi veya şifre hatalı.');
      }
      throw new Error(`Giriş yapılamadı: ${msg || 'Lütfen bilgilerinizi kontrol edin.'}`);
    }
    if (data.localId) userUid = data.localId;
    if (data.idToken) idToken = data.idToken;
    if (data.refreshToken) refreshToken = data.refreshToken;
  } else {
    if (!localRecord) {
      throw new Error(
        'Bu e-posta adresine ait kayıt bulunamadı. Lütfen önce "Kayıt Ol" sekmesinden hesap oluşturun.'
      );
    }
    if (
      localRecord.passwordHash &&
      localRecord.passwordHash !== simpleHash(password)
    ) {
      throw new Error('Girdiğiniz şifre hatalı. Lütfen tekrar deneyin.');
    }
  }

  const firstName =
    localRecord?.firstName || cleanEmail.split('@')[0] || 'Kullanıcı';
  const lastName = localRecord?.lastName || '';

  const authUser: AuthUser = {
    uid: userUid,
    email: cleanEmail,
    firstName,
    lastName,
    displayName: [firstName, lastName].filter(Boolean).join(' '),
    provider: 'email',
    idToken,
    refreshToken,
    createdAt: localRecord?.createdAt || formatSyncTimestamp(),
  };

  await saveAuthSession({
    hasCompletedOnboarding: true,
    user: authUser,
  });

  return authUser;
}

export async function sendPasswordResetEmail(email: string): Promise<string> {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Şifre sıfırlama için lütfen e-posta adresinizi girin.');
  }

  const fbConfig = await loadFirebaseConfig();
  if (isFirebaseConfigured(fbConfig)) {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(
        fbConfig.apiKey.trim()
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email: cleanEmail,
        }),
      }
    );
    if (!res.ok) {
      throw new Error('Şifre sıfırlama e-postası gönderilemedi.');
    }
    return `${cleanEmail} adresine şifre sıfırlama bağlantısı gönderildi.`;
  }

  return `${cleanEmail} için şifre sıfırlama talebi alındı (Firebase bağlandığında e-posta olarak gönderilir).`;
}

// ───────── Bulut Veritabanı (Firestore + Yerel Bulut Kasası) Yedekleme & İndirme ─────────

function sanitizeRestoredState(
  parsed: Partial<AppDataState>,
  user: AuthUser
): AppDataState {
  const habits = Array.isArray(parsed.habits) ? [...parsed.habits] : [];
  for (const [tab, items] of Object.entries(DEFAULT_HABITS) as [
    TabId,
    [string, string][],
  ][]) {
    if (!habits.some((h) => h.tab === tab)) {
      for (const [name, detail] of items) {
        habits.push({ id: uid(), tab, name, detail });
      }
    }
  }

  const firstName =
    parsed.profile?.firstName || user.firstName || '';
  const lastName =
    parsed.profile?.lastName || user.lastName || '';

  return {
    v: 1,
    updatedAt: parsed.updatedAt || Date.now(),
    section:
      parsed.section === 'gorevler' || parsed.section === 'rutin'
        ? parsed.section
        : 'rutin',
    tab: TABS.some((t) => t.id === parsed.tab) ? (parsed.tab as TabId) : TABS[0].id,
    habits,
    marks:
      parsed.marks && typeof parsed.marks === 'object' ? parsed.marks : {},
    progress:
      parsed.progress && typeof parsed.progress === 'object'
        ? parsed.progress
        : {},
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    profile: {
      firstName,
      lastName,
      email: user.email,
      authProvider: user.provider,
      lastBackupAt: parsed.profile?.lastBackupAt,
      lastRestoreAt: parsed.profile?.lastRestoreAt,
      lastCloudSyncAt: parsed.profile?.lastCloudSyncAt || formatSyncTimestamp(),
    },
  };
}

export async function syncStateToCloud(
  user: AuthUser,
  state: AppDataState
): Promise<{ ok: boolean; offline?: boolean; syncedAt?: string }> {
  if (!user || user.provider === 'guest') {
    return { ok: false };
  }

  const online = await checkOnlineStatus();
  if (!online) {
    await setPendingCloudSync(true);
    return { ok: false, offline: true };
  }

  const syncedAt = formatSyncTimestamp();
  const payloadToStore: AppDataState = {
    ...state,
    v: 1,
    updatedAt: state.updatedAt || Date.now(),
    profile: {
      firstName: state.profile?.firstName || user.firstName || '',
      lastName: state.profile?.lastName || user.lastName || '',
      ...state.profile,
      email: user.email,
      authProvider: user.provider,
      lastCloudSyncAt: syncedAt,
    },
  };

  try {
    // 1. Hesap bazlı yerel bulut kasasına kaydet (anında erişim ve simülasyon desteği)
    await AsyncStorage.setItem(
      `${CLOUD_VAULT_PREFIX}${user.uid}`,
      JSON.stringify(payloadToStore)
    );

    // 2. Firebase Firestore yapılandırılmışsa gerçek bulut veritabanına (Firestore) yaz
    const fbConfig = await loadFirebaseConfig();
    if (isFirebaseConfigured(fbConfig)) {
      const projectId = fbConfig.projectId.trim();
      const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/databases/(default)/documents/user_backups/${encodeURIComponent(
        user.uid
      )}${
        fbConfig.apiKey
          ? `?key=${encodeURIComponent(fbConfig.apiKey.trim())}`
          : ''
      }`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (user.idToken) {
        headers.Authorization = `Bearer ${user.idToken}`;
      }

      const firestoreBody = {
        fields: {
          uid: { stringValue: user.uid },
          email: { stringValue: user.email || '' },
          provider: { stringValue: user.provider },
          updatedAt: { integerValue: String(payloadToStore.updatedAt || Date.now()) },
          syncedAt: { stringValue: syncedAt },
          stateJson: { stringValue: JSON.stringify(payloadToStore) },
        },
      };

      const res = await fetch(docUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(firestoreBody),
      });

      if (!res.ok) {
        // Firestore hatası olsa bile yerel bulut kasası kaydedildi
      }
    }

    await setPendingCloudSync(false);
    return { ok: true, syncedAt };
  } catch {
    await setPendingCloudSync(true);
    return { ok: false, offline: true };
  }
}

export async function fetchStateFromCloud(
  user: AuthUser
): Promise<AppDataState | null> {
  if (!user || user.provider === 'guest') {
    return null;
  }

  const fbConfig = await loadFirebaseConfig();
  const online = await checkOnlineStatus();

  // 1. Önce çevrimiçiyse ve Firebase yapılandırılmışsa Firestore'dan çekmeyi dene
  if (online && isFirebaseConfigured(fbConfig)) {
    try {
      const projectId = fbConfig.projectId.trim();
      const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        projectId
      )}/databases/(default)/documents/user_backups/${encodeURIComponent(
        user.uid
      )}${
        fbConfig.apiKey
          ? `?key=${encodeURIComponent(fbConfig.apiKey.trim())}`
          : ''
      }`;

      const headers: Record<string, string> = {};
      if (user.idToken) {
        headers.Authorization = `Bearer ${user.idToken}`;
      }

      const res = await fetch(docUrl, { method: 'GET', headers });
      if (res.ok) {
        const doc = await res.json();
        const rawJson = doc?.fields?.stateJson?.stringValue;
        if (rawJson) {
          const parsed = JSON.parse(rawJson) as Partial<AppDataState>;
          const sanitized = sanitizeRestoredState(parsed, user);
          await AsyncStorage.setItem(
            `${CLOUD_VAULT_PREFIX}${user.uid}`,
            JSON.stringify(sanitized)
          );
          return sanitized;
        }
      }
    } catch {
      // Firestore erişilemezse yerel bulut kasasına bak
    }
  }

  // 2. Hesap bazlı yerel bulut kasasından kontrol et
  try {
    const raw = await AsyncStorage.getItem(`${CLOUD_VAULT_PREFIX}${user.uid}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppDataState>;
      return sanitizeRestoredState(parsed, user);
    }
  } catch {
    // Yoksay
  }

  return null;
}
