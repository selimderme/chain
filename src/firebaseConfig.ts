// Public Firebase web-app configuration; authorization is enforced by Firebase Auth
// and Firestore Security Rules. No service-account or Apple private keys belong here.

export interface FirebaseConfigOptions {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  googleWebClientId?: string;
}

export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigOptions = {
  apiKey: 'AIzaSyCsdEACatTqgQRx6dLwlVynIjR5cah1bvg',
  authDomain: 'chain-4913a.firebaseapp.com',
  projectId: 'chain-4913a',
  storageBucket: 'chain-4913a.firebasestorage.app',
  messagingSenderId: '353197873761',
  appId: '1:353197873761:web:7f5d1e4be1b42a7d44a820',
  googleWebClientId: '',
};

export function isFirebaseConfigured(config: FirebaseConfigOptions): boolean {
  return Boolean(
    config &&
      config.apiKey &&
      config.apiKey.trim().length > 10 &&
      config.projectId &&
      config.projectId.trim().length > 2
  );
}
