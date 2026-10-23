import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { AuthUser } from './constants';
import {
  continueAsGuestUser,
  sendPasswordResetEmail,
  signInWithAppleAccount,
  signInWithEmailPassword,
  signInWithGoogleAccount,
  signUpWithEmailPassword,
} from './cloudSync';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => Promise<void> | void;
  onCancel?: () => void;
  initialDefaultFirstName?: string;
  initialDefaultLastName?: string;
}

type AuthScreenMode = 'welcome' | 'google' | 'apple' | 'email';
type EmailTabMode = 'login' | 'register';

export default function AuthScreen({
  onAuthenticated,
  onCancel,
  initialDefaultFirstName = '',
  initialDefaultLastName = '',
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthScreenMode>('welcome');
  const [emailTab, setEmailTab] = useState<EmailTabMode>('register');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState(initialDefaultFirstName);
  const [lastName, setLastName] = useState(initialDefaultLastName);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const resetMessages = () => {
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleSelectMode = (nextMode: AuthScreenMode) => {
    Haptics.selectionAsync().catch(() => {});
    resetMessages();
    setMode(nextMode);
  };

  const handleGuestContinue = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setLoading(true);
      resetMessages();
      const guest = await continueAsGuestUser();
      await onAuthenticated(guest);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Misafir girişi sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSubmit = async () => {
    try {
      resetMessages();
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        setErrorMsg('Lütfen Google e-posta adresinizi girin (örn: adiniz@gmail.com).');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      setLoading(true);
      const user = await signInWithGoogleAccount({
        email: trimmedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await onAuthenticated(user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google ile giriş yapılırken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSubmit = async () => {
    try {
      resetMessages();
      const trimmedEmail = email.trim();
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        setErrorMsg('Lütfen Apple ID e-posta adresinizi girin (örn: adiniz@icloud.com).');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      setLoading(true);
      const user = await signInWithAppleAccount({
        email: trimmedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await onAuthenticated(user);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Apple ile giriş yapılırken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    try {
      resetMessages();
      setLoading(true);
      if (emailTab === 'register') {
        const user = await signUpWithEmailPassword({
          email,
          password,
          firstName,
          lastName,
        });
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        await onAuthenticated(user);
      } else {
        const user = await signInWithEmailPassword({
          email,
          password,
        });
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        await onAuthenticated(user);
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );
      setErrorMsg(err?.message || 'İşlem sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      resetMessages();
      setLoading(true);
      const msg = await sendPasswordResetEmail(email);
      setInfoMsg(msg);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Şifre sıfırlama bağlantısı gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Üst Geri / Kapat Çubuğu */}
          <View style={styles.topRow}>
            {mode !== 'welcome' ? (
              <TouchableOpacity
                onPress={() => handleSelectMode('welcome')}
                style={styles.backBtn}
                activeOpacity={0.75}
              >
                <Text style={styles.backBtnText}>‹ Giriş Seçenekleri</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            {onCancel && (
              <TouchableOpacity
                onPress={onCancel}
                style={styles.closeBtn}
                activeOpacity={0.75}
              >
                <Text style={styles.closeBtnText}>✕ Kapat</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Logo ve Karşılama Başlığı */}
          <View style={styles.heroHeader}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🗓️</Text>
            </View>
            <Text style={styles.appTitle}>Günlük Plan</Text>
            <Text style={styles.appSubtitle}>
              Alışkanlıklarını takip et, görevlerini planla ve tüm verilerini
              bulutta güvende tut.
            </Text>

            <View style={styles.featurePillsRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>⚡ İnternetsiz Çalışır</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>☁️ Otomatik Bulut Yedek</Text>
              </View>
            </View>
          </View>

          {/* Hata / Bilgi Mesajları */}
          {Boolean(errorMsg) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text>
            </View>
          )}
          {Boolean(infoMsg) && (
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>ℹ️ {infoMsg}</Text>
            </View>
          )}

          {/* EKRAN 1: 4 ANA GİRİŞ SEÇENEĞİ */}
          {mode === 'welcome' && (
            <View style={styles.optionsCard}>
              <Text style={styles.sectionTitle}>Nasıl devam etmek istersiniz?</Text>

              {/* 1. Google ile Devam Et */}
              <TouchableOpacity
                onPress={() => handleSelectMode('google')}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.googleBtn}
              >
                <View style={styles.providerIconCircleGoogle}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <View style={styles.providerBtnTextCol}>
                  <Text style={styles.googleBtnTitle}>Google ile Devam Et</Text>
                  <Text style={styles.googleBtnSub}>
                    Google hesabına otomatik yedekle ve senkronize et
                  </Text>
                </View>
                <Text style={styles.googleChevron}>›</Text>
              </TouchableOpacity>

              {/* 2. Apple ile Giriş Yap */}
              <TouchableOpacity
                onPress={() => handleSelectMode('apple')}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.appleBtn}
              >
                <View style={styles.providerIconCircleApple}>
                  <Text style={styles.appleIconText}></Text>
                </View>
                <View style={styles.providerBtnTextCol}>
                  <Text style={styles.appleBtnTitle}>Apple ile Giriş Yap</Text>
                  <Text style={styles.appleBtnSub}>
                    Apple ID ile hızlı giriş ve bulut yedekleme
                  </Text>
                </View>
                <Text style={styles.appleChevron}>›</Text>
              </TouchableOpacity>

              {/* 3. E-posta ve Şifre ile Kayıt Ol / Giriş Yap */}
              <TouchableOpacity
                onPress={() => {
                  setEmailTab('register');
                  handleSelectMode('email');
                }}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.emailBtn}
              >
                <View style={styles.providerIconCircleEmail}>
                  <Text style={styles.emailIconText}>✉️</Text>
                </View>
                <View style={styles.providerBtnTextCol}>
                  <Text style={styles.emailBtnTitle}>
                    E-posta ve Şifre ile Kayıt Ol / Giriş Yap
                  </Text>
                  <Text style={styles.emailBtnSub}>
                    E-posta hesabınızla bulut senkronizasyonu açın
                  </Text>
                </View>
                <Text style={styles.emailChevron}>›</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>veya</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* 4. Üye Olmadan Devam Et (Misafir Modu) */}
              <TouchableOpacity
                onPress={handleGuestContinue}
                disabled={loading}
                activeOpacity={0.82}
                style={styles.guestBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#e2e8f0" />
                ) : (
                  <>
                    <Text style={styles.guestBtnTitle}>
                      👤 Üye Olmadan Devam Et (Misafir Modu)
                    </Text>
                    <Text style={styles.guestBtnSub}>
                      Verileriniz cihazınızda (AsyncStorage) saklanır. İstediğiniz
                      zaman Profil sayfasından Google/Apple hesabınızı bağlayabilirsiniz.
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* EKRAN 2: GOOGLE İLE DEVAM ET */}
          {mode === 'google' && (
            <View style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <View style={styles.providerIconCircleGoogle}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>Google ile Giriş Yap</Text>
                  <Text style={styles.formSubtitle}>
                    Bulut Veritabanı + Çevrimdışı Öncelikli Senkronizasyon
                  </Text>
                </View>
              </View>

              <View style={styles.syncExplainBox}>
                <Text style={styles.syncExplainText}>
                  • Verileriniz önce telefonunuza kaydedilir, internet yokken de
                  kesintisiz çalışır.{'\n'}
                  • İnternet olduğunda arka planda otomatik olarak Google
                  hesabınıza bağlı bulut veritabanına yedeklenir.{'\n'}
                  • Yeni bir cihazda aynı Google hesabıyla giriş yaptığınızda
                  yedeğiniz otomatik olarak indirilir.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Google E-posta Adresiniz *</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ornek@gmail.com"
                placeholderTextColor="#64748b"
                style={styles.textInput}
              />

              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Ad (İsteğe bağlı)</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Adınız"
                    placeholderTextColor="#64748b"
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Soyad (İsteğe bağlı)</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Soyadınız"
                    placeholderTextColor="#64748b"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleGoogleSubmit}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.submitPrimaryBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitPrimaryBtnText}>
                    Google Hesabımla Bağlan ve Eşitle
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* EKRAN 3: APPLE İLE GİRİŞ YAP */}
          {mode === 'apple' && (
            <View style={styles.formCard}>
              <View style={styles.formHeaderRow}>
                <View style={styles.providerIconCircleApple}>
                  <Text style={styles.appleIconText}></Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formTitle}>Apple ile Giriş Yap</Text>
                  <Text style={styles.formSubtitle}>
                    Apple Kimliği ile Bulut Yedekleme ve Eşitleme
                  </Text>
                </View>
              </View>

              <View style={styles.syncExplainBox}>
                <Text style={styles.syncExplainText}>
                  • Apple ID hesabınızla giriş yaptığınızda tüm rutinleriniz ve
                  görevleriniz bulutta hesabınıza özel olarak saklanır ve yeni
                  cihazınıza otomatik indirilir.
                </Text>
              </View>

              <Text style={styles.inputLabel}>Apple ID (E-posta) *</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ornek@icloud.com"
                placeholderTextColor="#64748b"
                style={styles.textInput}
              />

              <View style={styles.nameRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Ad (İsteğe bağlı)</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Adınız"
                    placeholderTextColor="#64748b"
                    style={styles.textInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Soyad (İsteğe bağlı)</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Soyadınız"
                    placeholderTextColor="#64748b"
                    style={styles.textInput}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleAppleSubmit}
                disabled={loading}
                activeOpacity={0.85}
                style={[styles.submitPrimaryBtn, { backgroundColor: '#f8fafc' }]}
              >
                {loading ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text
                    style={[styles.submitPrimaryBtnText, { color: '#0f172a' }]}
                  >
                     Apple ile Devam Et
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* EKRAN 4: E-POSTA VE ŞİFRE İLE KAYIT OL / GİRİŞ YAP */}
          {mode === 'email' && (
            <View style={styles.formCard}>
              <View style={styles.emailTabSwitch}>
                <TouchableOpacity
                  onPress={() => {
                    resetMessages();
                    setEmailTab('register');
                  }}
                  style={[
                    styles.emailTabBtn,
                    emailTab === 'register' && styles.emailTabBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.emailTabBtnText,
                      emailTab === 'register' && styles.emailTabBtnTextActive,
                    ]}
                  >
                    Kayıt Ol
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    resetMessages();
                    setEmailTab('login');
                  }}
                  style={[
                    styles.emailTabBtn,
                    emailTab === 'login' && styles.emailTabBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.emailTabBtnText,
                      emailTab === 'login' && styles.emailTabBtnTextActive,
                    ]}
                  >
                    Giriş Yap
                  </Text>
                </TouchableOpacity>
              </View>

              {emailTab === 'register' && (
                <View style={styles.nameRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Ad *</Text>
                    <TextInput
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="Adınız"
                      placeholderTextColor="#64748b"
                      style={styles.textInput}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Soyad</Text>
                    <TextInput
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Soyadınız"
                      placeholderTextColor="#64748b"
                      style={styles.textInput}
                    />
                  </View>
                </View>
              )}

              <Text style={styles.inputLabel}>E-posta Adresi *</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="ornek@eposta.com"
                placeholderTextColor="#64748b"
                style={styles.textInput}
              />

              <Text style={styles.inputLabel}>Şifre *</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder={
                  emailTab === 'register'
                    ? 'En az 6 karakterli şifre'
                    : 'Şifrenizi girin'
                }
                placeholderTextColor="#64748b"
                style={styles.textInput}
              />

              <TouchableOpacity
                onPress={handleEmailSubmit}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.submitPrimaryBtn}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitPrimaryBtnText}>
                    {emailTab === 'register'
                      ? 'Hesap Oluştur ve Yedeklemeyi Başlat'
                      : 'Giriş Yap ve Yedeğimi İndir'}
                  </Text>
                )}
              </TouchableOpacity>

              {emailTab === 'login' && (
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={loading}
                  style={styles.forgotPassBtn}
                >
                  <Text style={styles.forgotPassText}>Şifremi Unuttum</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 38,
    marginBottom: 8,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  backBtnText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  heroHeader: {
    alignItems: 'center',
    marginBottom: 22,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(249, 115, 22, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  featurePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  featurePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.32)',
  },
  featurePillText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
  },
  infoBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    color: '#bfdbfe',
    fontSize: 13,
    fontWeight: '600',
  },
  optionsCard: {
    backgroundColor: '#131B2E',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  sectionTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  providerIconCircleGoogle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  googleIconText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ea4335',
  },
  providerBtnTextCol: {
    flex: 1,
  },
  googleBtnTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  googleBtnSub: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  googleChevron: {
    color: '#64748b',
    fontSize: 22,
    fontWeight: '700',
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    gap: 12,
  },
  providerIconCircleApple: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleIconText: {
    fontSize: 20,
    color: '#ffffff',
  },
  appleBtnTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  appleBtnSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  appleChevron: {
    color: '#94a3b8',
    fontSize: 22,
    fontWeight: '700',
  },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.4)',
    gap: 12,
  },
  providerIconCircleEmail: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailIconText: {
    fontSize: 18,
  },
  emailBtnTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  emailBtnSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  emailChevron: {
    color: '#94a3b8',
    fontSize: 22,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  guestBtn: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  guestBtnTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  guestBtnSub: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#131B2E',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  formTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  formSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  syncExplainBox: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  syncExplainText: {
    color: '#bbf7d0',
    fontSize: 12.5,
    lineHeight: 18,
  },
  emailTabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#0B0F19',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  emailTabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  emailTabBtnActive: {
    backgroundColor: '#f97316',
  },
  emailTabBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  emailTabBtnTextActive: {
    color: '#ffffff',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: '#0B0F19',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  submitPrimaryBtn: {
    backgroundColor: '#f97316',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  forgotPassBtn: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  forgotPassText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
});
