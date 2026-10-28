import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AppDataState, AuthUser, DEFAULT_HABITS, TABS, TabId } from './constants';
import { DEFAULT_FIREBASE_CONFIG, FirebaseConfigOptions, isFirebaseConfigured } from './firebaseConfig';
import { pad, uid } from './utils';
import {
  firebaseProviderSignIn, firebaseEmailSignIn, firebaseEmailSignUp, firebasePasswordReset,
  firebaseSignOut, restoreFirebaseUser, firebaseIdToken, firebaseErrorMessage,
} from './firebaseGateway';

const AUTH_SESSION_KEY = 'gunluk-plan:auth-session:v1';
const PENDING_SYNC_KEY = 'gunluk-plan:pending-sync:v1';
const CLOUD_VAULT_PREFIX = 'gunluk-plan:cloud-vault:v1:';

export interface AuthSessionState { hasCompletedOnboarding: boolean; user: AuthUser | null; }

export function formatSyncTimestamp(): string {
  const now = new Date();
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// One application uses one developer-owned project; users cannot change the backend.
export async function loadFirebaseConfig(): Promise<FirebaseConfigOptions> { return DEFAULT_FIREBASE_CONFIG; }

export async function saveAuthSession(session: AuthSessionState): Promise<void> {
  const user = session.user ? { ...session.user } : null;
  if (user) { delete user.idToken; delete user.refreshToken; }
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ ...session, user }));
}

export async function loadAuthSession(): Promise<AuthSessionState> {
  let cached: AuthSessionState = { hasCompletedOnboarding: false, user: null };
  try {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}
  // Metadata is only a UI preference. SDK-restored credentials establish identity.
  try {
    if (isFirebaseConfigured(DEFAULT_FIREBASE_CONFIG)) {
      const user = await restoreFirebaseUser();
      if (user) return { hasCompletedOnboarding: true, user };
    }
  } catch {}
  return { hasCompletedOnboarding: !!cached.hasCompletedOnboarding, user: cached.user?.provider === 'guest' ? cached.user : null };
}

export async function clearAuthSession(): Promise<void> {
  await firebaseSignOut();
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
}

export async function checkOnlineStatus(): Promise<boolean> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') return navigator.onLine !== false;
  // Real cloud operations distinguish service failures from loss of connectivity.
  return true;
}

export async function hasPendingCloudSync(user?: AuthUser): Promise<boolean> {
  return !!user && (await AsyncStorage.getItem(`${PENDING_SYNC_KEY}:${user.uid}`)) === '1';
}
export async function setPendingCloudSync(pending: boolean, uid: string): Promise<void> {
  if (pending) await AsyncStorage.setItem(`${PENDING_SYNC_KEY}:${uid}`, '1');
  else await AsyncStorage.removeItem(`${PENDING_SYNC_KEY}:${uid}`);
}

export async function continueAsGuestUser(): Promise<AuthUser> {
  const guest: AuthUser = { uid: 'guest_local', displayName: 'Misafir Kullanıcı', firstName: '', lastName: '', provider: 'guest', createdAt: formatSyncTimestamp() };
  await firebaseSignOut();
  await saveAuthSession({ hasCompletedOnboarding: true, user: guest });
  return guest;
}

async function remember(user: AuthUser): Promise<AuthUser> {
  await saveAuthSession({ hasCompletedOnboarding: true, user });
  return user;
}

export async function signInWithGoogleAccount(): Promise<AuthUser> {
  try { return await remember(await firebaseProviderSignIn('google')); }
  catch (error) { throw new Error(firebaseErrorMessage(error)); }
}
export async function signInWithAppleAccount(): Promise<AuthUser> {
  try { return await remember(await firebaseProviderSignIn('apple')); }
  catch (error) { throw new Error(firebaseErrorMessage(error)); }
}
export async function signUpWithEmailPassword(params: { email: string; password: string; firstName: string; lastName: string }): Promise<AuthUser> {
  if (!params.firstName.trim()) throw new Error('Lütfen adını gir.');
  try {
    return await remember(await firebaseEmailSignUp(params.email, params.password, [params.firstName.trim(), params.lastName.trim()].filter(Boolean).join(' ')));
  } catch (error) { throw new Error(firebaseErrorMessage(error)); }
}
export async function signInWithEmailPassword(params: { email: string; password: string }): Promise<AuthUser> {
  try { return await remember(await firebaseEmailSignIn(params.email, params.password)); }
  catch (error) { throw new Error(firebaseErrorMessage(error)); }
}
export async function sendPasswordResetEmail(email: string): Promise<string> {
  if (!email.trim()) throw new Error('Şifre sıfırlamak için önce e-posta adresini gir.');
  try { await firebasePasswordReset(email); return 'Bu adres için hesap varsa şifre sıfırlama bağlantısı gönderildi.'; }
  catch (error) { throw new Error(firebaseErrorMessage(error)); }
}
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

export function cloudPayload(user: AuthUser, state: AppDataState): AppDataState {
  // Preserve existing device-local category behavior while connecting the real backend.
  const habits = state.habits.filter(habit => TABS.some(tab => tab.id === habit.tab));
  const ids = new Set(habits.map(habit => habit.id));
  return {
    v: 1, updatedAt: state.updatedAt || Date.now(), section: state.section,
    tab: TABS.some(tab => tab.id === state.tab) ? state.tab : TABS[0].id,
    habits,
    marks: Object.fromEntries(Object.entries(state.marks).filter(([id]) => ids.has(id))),
    progress: Object.fromEntries(Object.entries(state.progress || {}).filter(([id]) => ids.has(id))),
    tasks: state.tasks || [],
    profile: { ...state.profile, firstName: state.profile?.firstName || user.firstName || '',
      lastName: state.profile?.lastName || user.lastName || '', email: user.email, authProvider: user.provider },
  };
}

function backupUrl(user: AuthUser): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(DEFAULT_FIREBASE_CONFIG.projectId)}/databases/(default)/documents/user_backups/${encodeURIComponent(user.uid)}`;
}

async function cloudFailure(response: Response): Promise<string> {
  if (response.status === 403) return 'Bulut erişimine izin verilmedi. Firestore veritabanı ve güvenlik kurallarını kontrol et.';
  if (response.status === 401) return 'Oturum doğrulanamadı. Hesabına yeniden giriş yap.';
  if (response.status === 429) return 'Bulut kullanım kotası doldu. Değişiklikler cihazda bekliyor.';
  if (response.status === 404) return 'Firestore veritabanı henüz oluşturulmadı veya bulunamadı.';
  return 'Buluta ulaşılamadı. Değişiklikler cihazda bekliyor.';
}

export async function syncStateToCloud(user: AuthUser, state: AppDataState): Promise<{ ok: boolean; offline?: boolean; syncedAt?: string; error?: string }> {
  if (!user || user.provider === 'guest') return { ok: false };
  const payload = cloudPayload(user, state);
  await AsyncStorage.setItem(`${CLOUD_VAULT_PREFIX}${user.uid}`, JSON.stringify(payload));
  await setPendingCloudSync(true, user.uid);
  if (!isFirebaseConfigured(DEFAULT_FIREBASE_CONFIG)) return { ok: false, error: 'Firebase bağlantısı yapılandırılmadı.' };
  if (!(await checkOnlineStatus())) return { ok: false, offline: true };
  try {
    const token = await firebaseIdToken(user.uid);
    const syncedAt = formatSyncTimestamp();
    const json = JSON.stringify(payload);
    // Leave room for metadata and Firestore's document-size overhead.
    if (new TextEncoder().encode(json).length > 900000) return { ok: false, error: 'Bulut yedeği boyut sınırına ulaştı. Veriler cihazda saklanıyor.' };
    const response = await fetch(backupUrl(user), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: {
        uid: { stringValue: user.uid }, updatedAt: { integerValue: String(payload.updatedAt) },
        syncedAt: { stringValue: syncedAt }, stateJson: { stringValue: json },
      } }),
    });
    if (!response.ok) return { ok: false, error: await cloudFailure(response) };
    await setPendingCloudSync(false, user.uid);
    return { ok: true, syncedAt };
  } catch (error) {
    return { ok: false, offline: !(await checkOnlineStatus()), error: error instanceof Error ? error.message : 'Bulut bağlantısı kurulamadı.' };
  }
}

export async function fetchStateFromCloud(user: AuthUser): Promise<AppDataState | null> {
  if (!user || user.provider === 'guest') return null;
  if (!isFirebaseConfigured(DEFAULT_FIREBASE_CONFIG)) throw new Error('Firebase bağlantısı yapılandırılmadı.');
  if (!(await checkOnlineStatus())) {
    throw new Error('Bu hesabın verilerini yüklemek için internet bağlantısı gerekiyor.');
  }
  try {
    const token = await firebaseIdToken(user.uid);
    const response = await fetch(backupUrl(user), { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 404) {
      const details = await response.json();
      // A missing database is a setup failure, not proof that this is a new account.
      if (/database.+does not exist/i.test(details?.error?.message || '')) throw new Error('Firebase panelinde Cloud Firestore veritabanını oluştur.');
      return null;
    }
    if (!response.ok) throw new Error(await cloudFailure(response));
    const doc = await response.json();
    const raw = doc?.fields?.stateJson?.stringValue;
    if (typeof raw !== 'string') throw new Error('Bulut yedeği okunamadı; mevcut veriler korunuyor.');
    const restored = sanitizeRestoredState(JSON.parse(raw), user);
    await AsyncStorage.setItem(`${CLOUD_VAULT_PREFIX}${user.uid}`, JSON.stringify(restored));
    return restored;
  } catch (error) {
    // A local snapshot is not confirmation that the remote backup is synchronized.
    throw error;
  }
}


