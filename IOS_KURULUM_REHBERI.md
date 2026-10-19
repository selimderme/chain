# Günlük Plan — Ücretsiz iOS (.ipa) Oluşturma ve iPhone'a Kurulum Rehberi

Apple Developer ($99/yıl) hesabına ihtiyaç duymadan, **GitHub Actions**'ın ücretsiz macOS sunucularında **imzasız `.ipa`** üretip **Sideloadly** ile kendi iPhone'unuza ücretsiz kurabilirsiniz.

---

## Adım 1: Projeyi GitHub'a Yükleyin

1. [github.com/new](https://github.com/new) adresinden yeni bir repo oluşturun (Örn: `gunluk-plan`).
   > **Önemli:** GitHub Actions'ın tamamen ücretsiz sınırsız dakikalarından yararlanmak için repoyu **Public** (Açık) olarak oluşturmanız önerilir.
2. Oluşturduğunuz repoda **"uploading an existing file"** linkine tıklayın.
3. Bilgisayarınızdaki `gunluk-plan` klasöründe **`node_modules` hariç** tüm dosya ve klasörleri (özellikle `.github`, `assets`, `src`, `app.json`, `package.json`, `index.js`, `tsconfig.json`) sürükleyip bırakın ve **Commit changes** butonuna basın.

---

## Adım 2: GitHub Actions'tan `.ipa` Dosyasını İndirin

1. Dosyaları yüklediğiniz anda GitHub sayfasındaki **Actions** sekmesine tıklayın.
2. **"Ücretsiz iOS IPA Derleme (Unsigned - Sideloadly / AltStore)"** iş akışının otomatik başladığını göreceksiniz (veya sol taraftan seçip **Run workflow** butonuna basabilirsiniz).
3. Derleme yaklaşık **8–12 dakika** sürer. Tamamlandığında (yeşil onay işareti çıktığında) çalışmanın içine girin ve en alttaki **Artifacts** bölümünden **`GunlukPlan-IPA`** dosyasını indirin.
4. İndirdiğiniz `.zip` dosyasını klasöre çıkarttığınızda içinden **`GunlukPlan.ipa`** dosyası çıkacaktır.

---

## Adım 3: `.ipa` Dosyasını Sideloadly ile iPhone'unuza Kurun (Windows)

1. Bilgisayarınıza **[Sideloadly](https://sideloadly.io/)** (ve eğer kurulu değilse web sürümlü iTunes + iCloud) kurun.
2. iPhone'unuzu USB kablosuyla bilgisayarınıza bağlayın ve telefonda çıkan **"Bu Bilgisayara Güven"** uyarısını onaylayın.
3. **Sideloadly** programını açın:
   - **IPA** kutusuna indirdiğiniz `GunlukPlan.ipa` dosyasını sürükleyin.
   - **Apple ID** kısmına kendi normal (ücretsiz) Apple e-posta adresinizi yazın.
   - **Start** butonuna basın (ilk seferde Apple ID şifrenizi ve telefonunuza gelen 2FA kodunu isteyecektir).
4. Kurulum bittiğinde uygulama iPhone ana ekranınıza gelecektir.
5. Uygulamayı ilk kez açmadan önce iPhone'unuzda şu ayarları yapın:
   - **Ayarlar → Genel → VPN ve Aygıt Yönetimi** menüsüne girip kendi Apple ID'nize tıklayın ve **"Güven (Trust)"** deyin.
   - **Ayarlar → Gizlilik ve Güvenlik → Geliştirici Modu (Developer Mode)** seçeneğini açıp telefonu yeniden başlatın.
