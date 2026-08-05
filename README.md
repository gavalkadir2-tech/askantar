# Zeytin Defteri

Zeytin komisyonculuğu için çiftçi/müstahsil kayıtları, kantar entegreli alım,
müstahsil makbuzu (stopaj/BAĞ-KUR hesabı), depo & satış takibi ve raporlama
içeren tek kullanıcılık web uygulaması.

Veriler tarayıcının **localStorage**'ında tutulur — yani veriler bu bilgisayardaki
bu tarayıcıya bağlıdır, başka bir cihazdan aynı veriler görünmez.

## GitHub'a yükleme

Bu klasörün tamamını (gizli `.github` klasörü dahil) bir GitHub deposuna
yükleyin. Terminalden:

```bash
cd zeytin-defteri
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/zeytin-defteri.git
git push -u origin main
```

(`KULLANICI_ADINIZ` kısmını kendi GitHub kullanıcı adınızla değiştirin. Depoyu
önce github.com üzerinden "New repository" ile oluşturmanız gerekir — "zeytin-defteri"
adını verirseniz yukarıdaki komut aynen çalışır.)

## GitHub Pages'i açma

1. Depo sayfasında **Settings → Pages** sekmesine gidin.
2. "Build and deployment" altında **Source** olarak **GitHub Actions** seçin.
3. `main` dalına her push yaptığınızda `.github/workflows/deploy.yml` otomatik
   olarak siteyi derleyip yayınlayacak. İlk push'tan birkaç dakika sonra
   sayfa `https://KULLANICI_ADINIZ.github.io/zeytin-defteri/` adresinde
   yayında olacak.

## Yerelde çalıştırma / geliştirme

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` açılır.

## Kantar (HC-05 / ESP32) bağlantısı

Uygulama Web Serial / Web Bluetooth API kullanıyor — bu yüzden yalnızca
**masaüstü Chrome veya Edge**'de çalışır (GitHub Pages HTTPS ile sunduğu
için bu konuda ek bir ayara gerek yok). Telefon veya Safari desteklemez.

## Önemli not

Stopaj oranları ve BAĞ-KUR mantığı genel bilgiye göre kodlanmıştır; gerçek
işletmenizde kullanmadan önce güncel oranları muhasebecinizle teyit edin.
