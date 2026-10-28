import { GoogleAuthProvider, OAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth, toAppUser } from './firebaseSession';
import { AuthUser } from './constants';
export * from './firebaseSession';

export async function firebaseProviderSignIn(provider: 'google' | 'apple'): Promise<AuthUser> {
  const authProvider = provider === 'google' ? new GoogleAuthProvider() : new OAuthProvider('apple.com');
  if (provider === 'google') authProvider.setCustomParameters({ prompt: 'select_account' });
  else { authProvider.addScope('email'); authProvider.addScope('name'); }
  // Called directly by the click handler, before any storage/network awaits.
  return toAppUser((await signInWithPopup(getFirebaseAuth(), authProvider)).user);
}
