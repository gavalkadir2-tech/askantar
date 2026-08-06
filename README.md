# Zeytin Defteri

Zeytin komisyonculuğu için çiftçi/müstahsil kayıtları, kantar entegreli alım,
müstahsil makbuzu (stopaj/BAĞ-KUR hesabı), depo & satış takibi, filo yönetimi,
AI destekli analiz ve raporlama içeren, Google ile giriş korumalı, **çok kiracılı**
(her hesap kendi verisini görür) web uygulaması.

## Çok kiracılı yapı nasıl çalışır?

- `gavalkadir2@gmail.com` ve `sadeeraytac@gmail.com` **yönetici (admin)** hesaplardır.
- Yöneticiler, sağ üstteki **"Kullanıcı Yönetimi"** butonuyla yeni Google hesapları
  ekleyip çıkarabilir.
- Bir yönetici tarafından eklenen her yeni hesap kendi bağımsız işletmesi gibi
  çalışır: kendi çiftçileri, alımları, araçları, her şeyi ayrı ve izole olur.
  Başka bir hesabın verisini göremez.
- Kayıtlı olmayan bir Google hesabı giriş yapmaya çalışırsa "Yetkiniz yok" ekranı görür.

## İlk kurulum sırası (sıfırdan)

Zaten Supabase + Google girişini kurduysanız (daha önce yaptıysak), sadece
**"Çok kiracılı yapıya geçiş"** bölümüne bakmanız yeterli. Sıfırdan kuruyorsanız:

### 1. Supabase projesi oluşturma

1. https://supabase.com adresine gidin, ücretsiz bir hesap açın.
2. **New Project** deyin, isim ve veritabanı şifresi belirleyip oluşturun.

### 2. Veritabanını kurma

1. Sol menüden **SQL Editor**'a girin, **New query** deyin.
2. Bu projedeki `supabase_multitenant_migration.sql` dosyasının tüm içeriğini
   yapıştırıp **Run** deyin. (Bu betik hem temel tabloyu hem çok kiracılı
   yapıyı tek seferde kurar.)

### 3-4. Google Cloud + Supabase Google sağlayıcısı

README'nin önceki sürümündeki adımlarla aynı — Google Cloud Console'da OAuth
Client ID oluşturup Supabase → Authentication → Providers → Google'a
Client ID/Secret'ı girin, Authentication → URL Configuration'da Site URL'i
kendi GitHub Pages adresinize ayarlayın.

### 5. Kodu bağlama

`src/supabaseClient.js` içindeki `SUPABASE_URL` ve `SUPABASE_ANON_KEY`
değerlerini kendi projenizinkiyle değiştirin (Project Settings → API sayfasında,
"Publishable key" adıyla bulunur).

## Çok kiracılı yapıya geçiş (daha önce tek kullanıcılı kurmuşsanız)

Eğer daha önce sadece 2 sabit e-posta ile çalışan sürümü kurduysanız:

1. SQL Editor'de `supabase_multitenant_migration.sql` dosyasının tamamını çalıştırın
   (mevcut verileriniz otomatik olarak ilk admin hesaba atanır, kaybolmaz).
2. Bu projedeki şu dosyaları deponuzdaki `src/` klasörüne yükleyin (üzerine yazacak/yeni ekleyecek):
   `App.jsx`, `main.jsx`, `supabaseClient.js`, `AuthGate.jsx`, `AdminPanel.jsx`, `currentUser.js`
3. Kök dizindeki `package.json`'ı da güncelleyin.
4. Commit edip Actions'ın bitmesini bekleyin.

## Kullanıcı Yönetimi paneli

Sadece admin hesaplarla giriş yaptığınızda sağ üstte **"Kullanıcı Yönetimi"**
butonu çıkar. Buradan:
- Yeni bir Google hesabı (e-posta + opsiyonel işletme adı) ekleyebilirsiniz —
  o hesap ilk giriş yaptığında sıfırdan kendi verisini oluşturmaya başlar.
- Var olan bir kullanıcıyı "Kaldır" ile silebilirsiniz — hesabın verileri
  veritabanında kalır ama artık giriş yapamaz.

## GitHub'a yükleme ve yayınlama

```bash
cd zeytin-defteri
git add .
git commit -m "Coklu kiracili yapi + Supabase + Google giris"
git push
```

Push sonrası GitHub Actions otomatik derleyip yayınlayacak (Settings → Pages
→ Source: GitHub Actions olarak ayarlı olmalı).

## Yerelde çalıştırma / geliştirme

```bash
npm install
npm run dev
```

Yerelde test ederken Supabase'in **Redirect URLs** listesine
`http://localhost:5173` adresini de eklemeniz gerekir.

## AI destekli sesli asistan (opsiyonel, ÜCRETSİZ — Groq API)

Varsayılan olarak sesli asistan tamamen **ücretsiz, tarayıcıda çalışan kural
tabanlı bir motorla** çalışır (alım, çiftçi ekleme, ödeme/avans, gider,
hatırlatma gibi komutları anlar). İsterseniz bunun yerine gerçek bir yapay
zeka ile çok daha esnek/doğal cümleleri anlamasını sağlayabilirsiniz —
**Groq** kullanıyoruz çünkü kredi kartı istemeyen, gerçekten ücretsiz bir
katmanı var ve çok hızlı çalışıyor. Güvenlik için API anahtarı **tarayıcıya
hiç inmez** — Supabase'in sunucu tarafında (Edge Function) saklanır.

### 1. Groq API anahtarı alma (ücretsiz, kredi kartı istemiyor)

1. https://console.groq.com/keys adresine gidin.
2. Google/GitHub hesabınızla veya e-posta ile ücretsiz kayıt olun (30 saniye sürer, kredi kartı istenmez).
3. **Create API Key** deyip bir anahtar oluşturun, kopyalayın.

Ücretsiz katman dakikada 30 istek / günde 1.000 istek gibi cömert bir
sınırla geliyor — bu uygulamanın sesli komut kullanımı için fazlasıyla
yeterli.

### 2. Edge Function'ı Supabase'e yükleme (CLI gerekmez, tarayıcıdan)

1. Supabase Dashboard'da sol menüden **Edge Functions**'a girin.
2. **Deploy a new function** / **Create a new function** deyin, adını tam olarak `ai-voice-parse` yazın.
3. Açılan kod editörüne bu projedeki `supabase/functions/ai-voice-parse/index.ts` dosyasının tüm içeriğini yapıştırın.
4. **Deploy** deyin.

### 3. API anahtarını sır (secret) olarak tanımlama

1. Aynı Edge Functions sayfasında (veya Project Settings → Edge Functions) **Secrets** / **Manage secrets** bölümüne girin.
2. Yeni bir secret ekleyin: **Name:** `GROQ_API_KEY`, **Value:** Groq'tan aldığınız anahtar.
3. Kaydedin.

### 4. Uygulamada etkinleştirme

1. Uygulamada **Ayarlar → Genel** sekmesine gidin.
2. **"AI destekli sesli komut kullan"** kutusunu işaretleyip **Tüm ayarları kaydet** deyin.
3. Sesli asistanı açtığınızda başlıkta küçük bir **"AI"** rozeti görünecek — bu, komutların artık Groq/Llama tarafından anlaşıldığı anlamına gelir.

Bir sorun olursa (Edge Function kurulmamışsa, secret eksikse, günlük ücretsiz
kota dolmuşsa, internet yoksa) uygulama otomatik olarak ücretsiz yerel
motora geri döner, hiçbir şey bozulmaz.

## Kantar (HC-05 / ESP32) bağlantısı

Uygulama Web Serial / Web Bluetooth API kullanıyor — bu yüzden yalnızca
**masaüstü Chrome veya Edge**'de çalışır. Telefon veya Safari desteklemez.

## AI Asistan hakkında

AI Asistan sekmesindeki tüm analizler ücretli bir yapay zeka API'si kullanmaz —
verileriniz üzerinde tarayıcınızda çalışan istatistiksel/kural tabanlı
hesaplamalardır. Harici bir servise veri gönderilmez.

## Önemli not

Stopaj oranları ve BAĞ-KUR mantığı genel bilgiye göre kodlanmıştır; gerçek
işletmenizde kullanmadan önce güncel oranları muhasebecinizle teyit edin.


