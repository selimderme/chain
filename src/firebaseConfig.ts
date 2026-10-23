// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE BULUT VERİTABANI VE KİMLİK DOĞRULAMA YAPILANDIRMASI (YÖNTEM B)
// ─────────────────────────────────────────────────────────────────────────────
// Kendi Firebase projenizi bağlamak için Firebase Console (https://console.firebase.google.com)
// üzerinden ücretsiz bir proje oluşturup "Web Uygulaması" ayarlarındaki bilgileri
// aşağıya yapıştırabilir veya uygulama içindeki Profil > Bulut Ayarları bölümünden girebilirsiniz.
//
// Not: Buradaki alanlar boş bırakıldığında uygulama otomatik olarak "Yerel Bulut Simülasyonu"
// modunda çalışır; böylece Google, Apple, E-posta/Şifre ve Misafir girişlerini ve
// hesap bazlı yedekleme/geri yükleme akışını anında test edebilirsiniz.

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
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
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
