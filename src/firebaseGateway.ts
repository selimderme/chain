import { AuthUser } from './constants';
export * from './firebaseSession';

export async function firebaseProviderSignIn(_provider: 'google' | 'apple'): Promise<AuthUser> {
  throw new Error('Bu cihazdaki Google/Apple girişi için native uygulama kimliklerinin kurulumu gerekiyor. Şimdilik web sürümünü veya e-posta girişini kullan.');
}
