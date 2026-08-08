# Zeytin Defteri — src/App.jsx bölünmüş hali

`src/App.jsx` (9437 satır, 516 KB, 70+ bileşen/fonksiyon tek dosyada) 37 dosyaya
bölündü. Hiçbir mantık değiştirilmedi — sadece kod, ilgili olduğu yere taşındı ve
gerekli `import`/`export` ifadeleri otomatik olarak eklendi.

Bölünmüş hal, esbuild ile tam bir bundle denemesinden geçirildi (tüm import'lar
çözüldü, eksik/yanlış export kalmadı) — yani dosyalar birbirini doğru şekilde
buluyor.

## Klasör yapısı

```
src/
  App.jsx                        <- artık sadece ana ZeytinDefteri bileşeni (479 satır)
  lib/
    format.js                    <- tarih/sayı formatlama, storage, matematik yardımcıları
    whatsapp.js                  <- WhatsApp mesaj şablonları
    theme.js                     <- COLORS, THEME_PRESETS, ACCENT_PRESETS
    constants.js                 <- kategori/tip listeleri
    voiceCommands.js             <- sesli komut ayrıştırma + Groq AI entegrasyonu
  hooks/
    index.js                     <- usePagedList, useSortableColumns
  components/
    common/index.jsx             <- SortableTh, Modal, StatCard, ScaleWidget, GlobalStyle, vb.
    print/PrintComponents.jsx    <- yazdırma alanları (makbuz/satış/ödeme)
    modals/index.jsx             <- ekleme/düzenleme modal'ları
    fleet/FleetSections.jsx      <- araç bakım/yakıt/belge/sigorta/lastik/maliyet bölümleri
    ai/AiSections.jsx            <- AI asistan alt bölümleri (özet, anomali, tahmin, vb.)
    accounting/AccountingSections.jsx <- banka hesapları, çek/senet, tahsilat
    settings/SettingsHelpers.jsx <- ayarlar sekmesi yardımcı bileşenleri
    VoiceAssistant.jsx
    NotificationCenter.jsx
    CustomerDisplayView.jsx
    tabs/                        <- her ana sekme kendi dosyasında (DashboardTab, PurchaseTab,
                                     WarehouseTab, FleetTab, SettingsTab, ReportsTab, ...)
```

## Depoya uygulama

1. Bu `src/` klasörünün içeriğini deponuzdaki `src/` klasörünün üzerine kopyalayın
   (eski `App.jsx` üzerine yazılacak, yeni alt klasörler eklenecek).
2. `pdfHelper.js`, `qrHelper.js`, `offlineStorage.js`, `supabaseClient.js`,
   `currentUser.js`, `main.jsx`, `AuthGate.jsx` dosyalarına dokunmadım — onlar
   zaten ayrı dosyalardaydı, aynı kalabilir.
3. Commit + push edin, GitHub Actions otomatik derleyip yayınlayacak.
4. Yerelde önce `npm run dev` ile deneyip sekmelerin (Panel, Çiftçiler, Alım,
   Depo, Filo, Muhasebe, Ayarlar, AI Asistan vb.) hepsinin açıldığını kontrol
   etmenizi öneririm.

## Notlar

- Her modül sadece ihtiyaç duyduğu şeyi import ediyor (React hook'ları, ikonlar,
  recharts bileşenleri, diğer modüllerdeki fonksiyon/bileşenler).
- Bazı gruplar (`FleetSections.jsx`, `AiSections.jsx`, `AccountingSections.jsx`,
  `common/index.jsx`, `modals/index.jsx`) birden fazla küçük, birbiriyle ilişkili
  bileşeni tek dosyada topluyor — bunları tek tek 70 dosyaya bölmek yerine daha
  yönetilebilir bir orta nokta seçtim. İstersen bunları da daha ince parçalara
  bölebilirim.
- `App.jsx` artık sadece sekme yönlendirmesi, oturum/çevrimdışı senkron mantığı ve
  üst düzey state'i içeriyor.
