import { InstantButton as TouchableOpacity } from './InstantButton';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { AuthUser } from './constants';
import Svg, { Circle, Path } from 'react-native-svg';
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

type AuthScreenMode = 'google' | 'apple' | 'email';
type EmailTabMode = 'login' | 'register';

export default function AuthScreen({
  onAuthenticated,
  onCancel,
  initialDefaultFirstName = '',
  initialDefaultLastName = '',
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthScreenMode>('email');
  const [emailTab, setEmailTab] = useState<EmailTabMode>('login');

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      setLoading(true);
      const user = await signInWithGoogleAccount();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      setLoading(true);
      const user = await signInWithAppleAccount();
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

  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const provider = mode === 'google' || mode === 'apple';
  const registering = !provider && emailTab === 'register';
  const canSubmit = !loading && /.+@.+\..+/.test(email.trim()) &&
    (provider || (password.length >= 6 && (!registering || !!firstName.trim())));
  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'google') return handleGoogleSubmit();
    if (mode === 'apple') return handleAppleSubmit();
    return handleEmailSubmit();
  };
  const changeMode = (next: AuthScreenMode, tab: EmailTabMode = 'login') => {
    setEmailTab(tab); setShowPassword(false); handleSelectMode(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const title = provider ? (mode === 'google' ? 'Google ile devam et' : 'Apple ile devam et')
    : registering ? 'Hesap oluştur' : 'Giriş yap';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <View style={styles.nav}>
              {(onCancel || provider || registering) && (
              <TouchableOpacity disabled={loading} accessibilityLabel={provider || registering ? 'Giriş sayfasına dön' : 'Giriş sayfasını kapat'}
                onPress={() => provider || registering ? changeMode('email') : onCancel?.()} style={styles.back}>
                <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
                  <Path d="m14.5 5-7 7 7 7" fill="none" stroke="#EEF0F6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
              )}
            </View>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {!!errorMsg && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{errorMsg}</Text></View>}
            {!!infoMsg && <View accessibilityLiveRegion="polite" style={styles.info}><Text style={styles.infoText}>{infoMsg}</Text></View>}

            {(registering || provider) && (
              <View style={styles.nameRow}>
                <View style={[styles.field, styles.flex]}>
                  <Text style={styles.label}>{provider ? 'AD (İSTEĞE BAĞLI)' : 'AD'}</Text>
                  <TextInput accessibilityLabel="Ad" editable={!loading} value={firstName} onChangeText={setFirstName} autoComplete="given-name" placeholder="Adın" placeholderTextColor="#9298A6" style={styles.input} />
                </View>
                <View style={[styles.field, styles.flex]}>
                  <Text style={styles.label}>SOYAD</Text>
                  <TextInput accessibilityLabel="Soyad" editable={!loading} value={lastName} onChangeText={setLastName} autoComplete="family-name" placeholder="Soyadın" placeholderTextColor="#9298A6" style={styles.input} />
                </View>
              </View>
            )}

            <View style={[styles.field, focusedField === 'email' && styles.fieldFocused]}>
              <Text style={styles.label}>E-POSTA</Text>
              <TextInput accessibilityLabel="E-posta" editable={!loading} value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                style={styles.input} returnKeyType={provider ? 'done' : 'next'}
                onSubmitEditing={() => provider ? submit() : passwordRef.current?.focus()} />
            </View>
            {!provider && (
              <View style={[styles.field, focusedField === 'password' && styles.fieldFocused]}>
                <Text style={styles.label}>ŞİFRE</Text>
                <View style={styles.passwordRow}>
                  <TextInput ref={passwordRef} accessibilityLabel="Şifre" editable={!loading} value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
                    onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                    autoCapitalize="none" autoCorrect={false} autoComplete={registering ? 'new-password' : 'current-password'}
                    style={[styles.input, styles.flex]}
                    returnKeyType="go" onSubmitEditing={submit} />
                  <TouchableOpacity accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} accessibilityState={{ selected: showPassword }} onPress={() => setShowPassword(value => !value)} style={styles.eye}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
                      <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" fill="none" stroke="#9298A6" strokeWidth={1.8} />
                      <Circle cx={12} cy={12} r={3} stroke="#9298A6" strokeWidth={1.8} fill="none" />
                      {showPassword && <Path d="M3 3 21 21" stroke="#9298A6" strokeWidth={1.8} strokeLinecap="round" />}
                    </Svg>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {!provider && !registering && <TouchableOpacity disabled={loading} onPress={handleForgotPassword} style={styles.forgot}><Text style={styles.forgotText}>Şifreni mi unuttun?</Text></TouchableOpacity>}
            <TouchableOpacity onPress={submit} disabled={!canSubmit} style={[styles.submit, !canSubmit && styles.submitDisabled]}>
              {loading ? <ActivityIndicator color="#F0F1F6" /> : <Text style={[styles.submitText, !canSubmit && styles.submitTextDisabled]}>{provider ? 'Devam et' : registering ? 'Hesap oluştur' : 'Giriş yap'}</Text>}
            </TouchableOpacity>
            {!provider && <>
              <Text style={styles.divider}>YA DA</Text>
              <View style={styles.providers}>
                {(['apple', 'google'] as const).map(value => (
                  <TouchableOpacity key={value} disabled={loading} onPress={value === 'google' ? handleGoogleSubmit : handleAppleSubmit} style={styles.provider}>
                    <ProviderIcon provider={value} />
                    <Text style={styles.providerText}>{value === 'apple' ? 'Apple' : 'Google'} ile devam et</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.accountRow}>
                <Text style={styles.secondaryText}>{registering ? 'Zaten hesabın var mı?' : 'Hesabın yok mu?'}</Text>
                <TouchableOpacity disabled={loading} onPress={() => changeMode('email', registering ? 'login' : 'register')} style={styles.textLink}>
                  <Text style={styles.linkText}>{registering ? 'Giriş yap' : 'Kayıt ol'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity disabled={loading} onPress={handleGuestContinue} style={styles.guest}>
                <Text style={styles.secondaryText}>Üye olmadan devam et</Text>
              </TouchableOpacity>
            </>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProviderIcon({ provider }: { provider: 'google' | 'apple' }) {
  return provider === 'apple' ? (
    <Svg width={23} height={23} viewBox="0 0 24 24" accessible={false}>
      <Path fill="#F0F1F6" d="M17.1 12.5c0-2 1.6-3 1.7-3.1-1-1.5-2.5-1.7-3-1.7-1.3-.1-2.5.8-3.2.8-.6 0-1.6-.8-2.7-.8-1.4 0-2.7.8-3.4 2-1.4 2.5-.4 6.3 1 8.3.7 1 1.5 2.1 2.5 2 1-.1 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7s1.8-1 2.5-2c.8-1.1 1.2-2.2 1.2-2.3-.1 0-2-.8-2-3.2ZM15 6.4c.6-.8 1.1-1.9 1-3-.9 0-2 .6-2.7 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3Z" />
    </Svg>
  ) : (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
      <Path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2.2H12v4h5.6c-.3 1.3-1 2.3-2.1 3v2.5H19c2-1.8 3-4.3 3-7.3Z" />
      <Path fill="#34A853" d="M12 22c2.8 0 5.2-.9 7-2.5L15.5 17c-1 .6-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.2H2.6v2.7C4.3 19.8 7.9 22 12 22Z" />
      <Path fill="#FBBC05" d="M6.2 13.8A6 6 0 0 1 6 12c0-.6.1-1.2.2-1.8V7.5H2.6A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.1-2.7Z" />
      <Path fill="#EA4335" d="M12 6c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 12 2C7.9 2 4.3 4.2 2.6 7.5l3.6 2.7A6 6 0 0 1 12 6Z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#05070B' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 28 },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  nav: { height: 52, justifyContent: 'center' },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101A2A' },
  title: { color: '#F1F2F6', fontSize: 25, lineHeight: 32, fontWeight: '700', marginTop: 20, marginBottom: 28 },
  nameRow: { flexDirection: 'row', gap: 12 },
  field: { minHeight: 64, backgroundColor: '#0C1424', borderWidth: 1, borderColor: '#253753', borderRadius: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, marginBottom: 16 },
  fieldFocused: { borderColor: '#5478AF', backgroundColor: '#101D33' },
  label: { color: '#B3B8C5', fontSize: 10, lineHeight: 15, letterSpacing: 0.6 },
  input: { minWidth: 0, color: '#F0F1F6', fontSize: 16, lineHeight: 23, padding: 0, paddingTop: 5, paddingBottom: 1, borderWidth: 0, backgroundColor: 'transparent', ...Platform.select({ web: { outlineStyle: 'solid' as const, outlineWidth: 0, outlineColor: 'transparent' } }) },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { minWidth: 36, minHeight: 32, justifyContent: 'center', alignItems: 'flex-end' },
  forgot: { alignItems: 'center', paddingVertical: 7, marginTop: -2, marginBottom: 14, minHeight: 36, justifyContent: 'center' },
  forgotText: { color: '#E0E2EA', fontSize: 14, lineHeight: 20 },
  submit: { minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#173B72', marginTop: 2 },
  submitDisabled: { backgroundColor: '#10213B' },
  submitText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  submitTextDisabled: { color: '#7890B3' },
  divider: { color: '#CFD2DC', textAlign: 'center', fontSize: 11, letterSpacing: 0.4, marginVertical: 26 },
  providers: { gap: 16 },
  provider: { minHeight: 50, borderWidth: 1, borderColor: '#243B5D', borderRadius: 10, backgroundColor: '#0C172A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 },
  providerText: { fontSize: 14, color: '#EEF0F6', fontWeight: '600' },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', marginTop: 26, columnGap: 6 },
  secondaryText: { color: '#AEB4C4', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  textLink: { minHeight: 36, justifyContent: 'center' },
  linkText: { color: '#86ABDF', fontWeight: '600', fontSize: 12 },
  guest: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 10, marginTop: 2 },
  error: { padding: 12, backgroundColor: '#39242D', borderRadius: 10, marginBottom: 16 },
  errorText: { color: '#FFB4C4', fontSize: 13, lineHeight: 19 },
  info: { padding: 12, backgroundColor: '#0E2039', borderRadius: 10, marginBottom: 16 },
  infoText: { color: '#C0D2FF', fontSize: 13, lineHeight: 19 },
});
