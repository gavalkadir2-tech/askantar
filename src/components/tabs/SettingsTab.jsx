import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  Download,
  Upload,
  Trash2,
} from 'lucide-react';
import { ExcelFarmerImport, TagChipList, TaxRateList, VarietyEditor } from '../settings/SettingsHelpers';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../lib/constants';
import { applyAppearance, fmtDate, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { ACCENT_PRESETS, COLORS } from '../../lib/theme';

export function SettingsTab({ settings, setSettings, priceList, setPriceList, onBackup, onRestore, restoreStatus, farmers, setFarmers, autoBackups, onRestoreAutoBackup, allData }) {
  const [tab, setTab] = useState('genel');

  const [decimalPlaces, setDecimalPlaces] = useState(settings.decimalPlaces ?? 2);
  const [purchaseReceiptNext, setPurchaseReceiptNext] = useState(settings.purchaseReceiptNext ?? 1);
  const [salesReceiptNext, setSalesReceiptNext] = useState(settings.salesReceiptNext ?? 1);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat || 'DMY');
  const [defaultVatRate, setDefaultVatRate] = useState(settings.defaultVatRate ?? 20);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(settings.aiVoiceEnabled ?? false);
  const [groqApiKey, setGroqApiKey] = useState(settings.groqApiKey || '');
  const [defaultFuelPrice, setDefaultFuelPrice] = useState(settings.defaultFuelPrice ?? '');
  const [crateWeight, setCrateWeight] = useState(settings.crateWeight ?? 2);
  const [defaultCrateCount, setDefaultCrateCount] = useState(settings.defaultCrateCount ?? 5);
  const [defaultCommissionRate, setDefaultCommissionRate] = useState(settings.defaultCommissionRate ?? 3);
  const [defaultBagkurRate, setDefaultBagkurRate] = useState(settings.defaultBagkurRate ?? 1);
  const [defaultNoDeduction, setDefaultNoDeduction] = useState(settings.defaultNoDeduction ?? true);
  const [docWarningDays, setDocWarningDays] = useState(settings.docWarningDays ?? 30);
  const [cariRiskDays, setCariRiskDays] = useState(settings.cariRiskDays ?? 45);
  const [cariRiskWarningDays, setCariRiskWarningDays] = useState(settings.cariRiskWarningDays ?? 20);
  const [maintenanceWarningKm, setMaintenanceWarningKm] = useState(settings.maintenanceWarningKm ?? 500);
  const [openingCashBalance, setOpeningCashBalance] = useState(settings.openingCashBalance ?? 0);

  const [logo, setLogo] = useState(settings.logo || '');
  const [businessName, setBusinessName] = useState(settings.businessName || '');
  const [address, setAddress] = useState(settings.address || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [taxNo, setTaxNo] = useState(settings.taxNo || '');
  const [taxOffice, setTaxOffice] = useState(settings.taxOffice || '');

  const [incomeCategories, setIncomeCategories] = useState(settings.incomeCategories && settings.incomeCategories.length > 0 ? settings.incomeCategories : INCOME_CATEGORIES);
  const [expenseCategories, setExpenseCategories] = useState(settings.expenseCategories && settings.expenseCategories.length > 0 ? settings.expenseCategories : EXPENSE_CATEGORIES);

  const [taxRates, setTaxRates] = useState(settings.taxRates || [
    { id: uid(), name: 'KDV %20', rate: 20 },
    { id: uid(), name: 'KDV %10', rate: 10 },
    { id: uid(), name: 'KDV %1', rate: 1 },
    { id: uid(), name: 'KDV %0 (İstisna)', rate: 0 },
  ]);

  const [theme, setTheme] = useState(settings.theme || 'light');
  const [accentColor, setAccentColor] = useState(settings.accentColor || '#B3892B');
  const [sidebarDensity, setSidebarDensity] = useState(settings.sidebarDensity || 'normal');
  const [fontSize, setFontSize] = useState(settings.fontSize || 'normal');

  const [newVarietyName, setNewVarietyName] = useState('');
  const [savedNote, setSavedNote] = useState('');

  const buildNext = () => ({
    decimalPlaces, dateFormat,
    purchaseReceiptNext: parseInt(purchaseReceiptNext, 10) || 1,
    salesReceiptNext: parseInt(salesReceiptNext, 10) || 1,
    defaultVatRate: parseFloat(defaultVatRate) || 0,
    defaultFuelPrice: parseFloat(defaultFuelPrice) || 0,
    crateWeight: parseFloat(crateWeight) || 0,
    defaultCrateCount: Math.max(0, Math.min(7, parseInt(defaultCrateCount, 10) || 0)),
    defaultCommissionRate: parseFloat(defaultCommissionRate) || 0,
    defaultBagkurRate: parseFloat(defaultBagkurRate) || 0,
    defaultNoDeduction,
    docWarningDays: parseInt(docWarningDays, 10) || 30,
    cariRiskDays: parseInt(cariRiskDays, 10) || 45,
    cariRiskWarningDays: parseInt(cariRiskWarningDays, 10) || 20,
    maintenanceWarningKm: parseInt(maintenanceWarningKm, 10) || 500,
    logo, businessName, address, phone, taxNo, taxOffice,
    incomeCategories, expenseCategories, taxRates,
    theme, accentColor, sidebarDensity, fontSize,
    aiVoiceEnabled,
    groqApiKey,
    openingCashBalance: parseFloat(openingCashBalance) || 0,
  });

  const save = async () => {
    const next = buildNext();
    applyAppearance(next);
    setSettings(next);
    await storageSet('zk:settings', next);
    setSavedNote('Ayarlar kaydedildi.');
    setTimeout(() => setSavedNote(''), 2500);
  };

  const handleLogoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 200;
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setLogo(canvas.toDataURL('image/png'));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const updateVariety = async (updated) => {
    const next = priceList.map((v) => (v.id === updated.id ? updated : v));
    setPriceList(next);
    await storageSet('zk:priceList', next);
  };

  const [bulkMode, setBulkMode] = useState('percent');
  const [bulkValue, setBulkValue] = useState('');
  const bulkUpdatePrices = async () => {
    const v = parseFloat(bulkValue);
    if (!v && v !== 0) return;
    if (!window.confirm(bulkMode === 'percent' ? `Tüm fiyatlar %${v} oranında değiştirilecek. Onaylıyor musunuz?` : `Tüm fiyatlara ${fmtTL(v)} eklenecek. Onaylıyor musunuz?`)) return;
    const adjust = (price) => {
      const newPrice = bulkMode === 'percent' ? price * (1 + v / 100) : price + v;
      return Math.max(0, Math.round(newPrice * 100) / 100);
    };
    const next = priceList.map((variety) => {
      if (!variety.hasGrades) return { ...variety, singlePrice: adjust(variety.singlePrice || 0) };
      return { ...variety, grades: variety.grades.map((g) => ({ ...g, price: adjust(g.price || 0) })) };
    });
    setPriceList(next);
    await storageSet('zk:priceList', next);
    const nextSettings = { ...settings, priceListUpdatedAt: Date.now() };
    setSettings(nextSettings);
    await storageSet('zk:settings', nextSettings);
    setBulkValue('');
  };

  const removeVariety = async (id) => {
    if (!window.confirm('Bu türü ve tüm fiyat listesini silmek istediğinize emin misiniz?')) return;
    const next = priceList.filter((v) => v.id !== id);
    setPriceList(next);
    await storageSet('zk:priceList', next);
  };

  const addVariety = async () => {
    if (!newVarietyName.trim()) return;
    const next = [...priceList, { id: uid(), name: newVarietyName.trim(), hasGrades: true, singlePrice: 0, grades: [] }];
    setPriceList(next);
    await storageSet('zk:priceList', next);
    setNewVarietyName('');
  };

  const settingsTabs = [
    { key: 'genel', label: 'Genel' },
    { key: 'firma', label: 'Firma' },
    { key: 'fiyat', label: 'Fiyat Listesi' },
    { key: 'kategoriler', label: 'Kategoriler' },
    { key: 'vergi', label: 'Vergi' },
    { key: 'gorunum', label: 'Görünüm' },
    { key: 'yedek', label: 'Yedekleme' },
  ];

  return (
    <div>
      <div className="zk-h1">Ayarlar</div>
      <div className="zk-h1-sub">İşletme bilgileri, alım varsayılanları, kategoriler, vergi ve görünüm ayarları</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {settingsTabs.map((t) => (
          <button key={t.key} className={`zk-btn ${tab === t.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ fontSize: 12 }} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 920 }}>
        {tab === 'genel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Biçim</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Ondalık basamak sayısı</label>
                  <select className="zk-select" value={decimalPlaces} onChange={(e) => setDecimalPlaces(parseInt(e.target.value, 10))}>
                    <option value={0}>0 — örn. 1.234 ₺</option>
                    <option value={1}>1 — örn. 1.234,5 ₺</option>
                    <option value={2}>2 — örn. 1.234,56 ₺</option>
                  </select>
                </div>
                <div>
                  <label className="zk-label">Tarih formatı</label>
                  <select className="zk-select" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                    <option value="DMY">GG.AA.YYYY (31.12.2026)</option>
                    <option value="YMD">YYYY-AA-GG (2026-12-31)</option>
                  </select>
                </div>
                <div>
                  <label className="zk-label">Varsayılan KDV oranı (%)</label>
                  <input className="zk-input" type="number" value={defaultVatRate} onChange={(e) => setDefaultVatRate(e.target.value)} placeholder="20" />
                </div>
                <div>
                  <label className="zk-label">Varsayılan yakıt fiyatı (₺/Lt)</label>
                  <input className="zk-input" type="number" value={defaultFuelPrice} onChange={(e) => setDefaultFuelPrice(e.target.value)} placeholder="örn. 45" />
                </div>
              </div>
              <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 10 }}>
                KDV oranı henüz ayrı bir fatura modülü olmadığı için şu an sadece Vergi sekmesindeki hızlı seçim listesinin varsayılanı olarak saklanır.
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>🧾 Makbuz numaralandırma</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>
                Bir sonraki kaydedilecek alım/satış makbuzunun alacağı numara. Örneğin defterinizdeki mevcut numaralandırmaya devam etmek için buradan ayarlayabilirsiniz.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Sonraki alış (müstahsil) makbuz no</label>
                  <input className="zk-input" type="number" min="1" value={purchaseReceiptNext} onChange={(e) => setPurchaseReceiptNext(e.target.value)} />
                </div>
                <div>
                  <label className="zk-label">Sonraki satış makbuz no</label>
                  <input className="zk-input" type="number" min="1" value={salesReceiptNext} onChange={(e) => setSalesReceiptNext(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>🎙️ Sesli asistan</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>
                Kapalıyken sesli komutlar tarayıcıda çalışan ücretsiz, kural tabanlı bir motorla anlaşılır (alım, çiftçi ekleme, ödeme, gider, hatırlatma). AI desteğini iki şekilde açabilirsiniz: aşağıya kendi ücretsiz Groq API anahtarınızı girerek (tarayıcıdan doğrudan çalışır, en kolay ve her yerde çalışan yöntem) — ya da GitHub sürümünde Edge Function kurup sadece kutucuğu işaretleyerek.
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="zk-label">Groq API anahtarı (opsiyonel)</label>
                <input className="zk-input" type="password" value={groqApiKey} onChange={(e) => setGroqApiKey(e.target.value)} placeholder="gsk_..." />
                <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 4 }}>
                  Ücretsiz anahtar almak için <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.olive }}>console.groq.com/keys</a> adresine kredi kartsız kayıt olabilirsiniz. Anahtar sadece bu cihazda saklanır, girildiği anda AI destekli anlama otomatik devreye girer.
                </div>
              </div>
              <label className="zk-checkbox-row">
                <input type="checkbox" checked={aiVoiceEnabled} onChange={(e) => setAiVoiceEnabled(e.target.checked)} />
                Edge Function ile AI destekli sesli komut kullan (GitHub sürümü, API anahtarı girilmediyse)
              </label>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>💰 Nakit kasa açılış bakiyesi</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>
                Muhasebe → Kasa sayfasındaki güncel bakiye hesaplaması bu değerden başlar.
              </div>
              <div style={{ maxWidth: 240 }}>
                <label className="zk-label">Açılış bakiyesi (TL)</label>
                <input className="zk-input" type="number" value={openingCashBalance} onChange={(e) => setOpeningCashBalance(e.target.value)} />
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Kasa / dara</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Kasa ağırlığı (kg)</label>
                  <input className="zk-input" type="number" value={crateWeight} onChange={(e) => setCrateWeight(e.target.value)} placeholder="2" />
                </div>
                <div>
                  <label className="zk-label">Varsayılan kasa sayısı (dara)</label>
                  <input className="zk-input" type="number" min="0" max="7" value={defaultCrateCount} onChange={(e) => setDefaultCrateCount(e.target.value)} placeholder="5" />
                </div>
              </div>
              <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 8 }}>
                Alım ekranında her satıra otomatik gelir ({defaultCrateCount || 0} kasa × {crateWeight || 0} kg = {((parseFloat(defaultCrateCount) || 0) * (parseFloat(crateWeight) || 0)).toFixed(1)} kg dara), orada değiştirilebilir.
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Alım varsayılanları</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>Yeni alım ekranı her açıldığında bu değerlerle başlar, siz orada değiştirebilirsiniz.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Varsayılan komisyon oranı (%)</label>
                  <input className="zk-input" type="number" value={defaultCommissionRate} onChange={(e) => setDefaultCommissionRate(e.target.value)} placeholder="3" />
                </div>
                <div>
                  <label className="zk-label">Varsayılan BAĞ-KUR oranı (%)</label>
                  <input className="zk-input" type="number" value={defaultBagkurRate} onChange={(e) => setDefaultBagkurRate(e.target.value)} placeholder="1" />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 10 }}>
                  <label className="zk-checkbox-row">
                    <input type="checkbox" checked={defaultNoDeduction} onChange={(e) => setDefaultNoDeduction(e.target.checked)} />
                    Kesintisiz hesaplama varsayılan açık gelsin
                  </label>
                </div>
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Bildirim eşikleri</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>Bildirim Merkezi ve AI Asistan'daki uyarıların kaç gün/km öncesinden tetikleneceğini belirler.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
                <div>
                  <label className="zk-label">Evrak/sigorta uyarısı (gün kala)</label>
                  <input className="zk-input" type="number" value={docWarningDays} onChange={(e) => setDocWarningDays(e.target.value)} placeholder="30" />
                </div>
                <div>
                  <label className="zk-label">Cari risk — "yüksek" eşiği (gün)</label>
                  <input className="zk-input" type="number" value={cariRiskDays} onChange={(e) => setCariRiskDays(e.target.value)} placeholder="45" />
                </div>
                <div>
                  <label className="zk-label">Cari risk — "orta" eşiği (gün)</label>
                  <input className="zk-input" type="number" value={cariRiskWarningDays} onChange={(e) => setCariRiskWarningDays(e.target.value)} placeholder="20" />
                </div>
                <div>
                  <label className="zk-label">Bakım uyarısı (km kala)</label>
                  <input className="zk-input" type="number" value={maintenanceWarningKm} onChange={(e) => setMaintenanceWarningKm(e.target.value)} placeholder="500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'firma' && (
          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Firma logosu</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              {logo ? (
                <img src={logo} alt="Logo" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: `1px solid ${COLORS.border}` }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, border: `1px dashed ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.inkSoft, fontSize: 10 }}>Logo yok</div>
              )}
              <div>
                <label className="zk-btn zk-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', marginRight: 8 }}>
                  <Upload size={13} /> Logo yükle
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) handleLogoUpload(e.target.files[0]); e.target.value = ''; }} />
                </label>
                {logo && <button className="zk-btn zk-btn-secondary" onClick={() => setLogo('')}><Trash2 size={13} /> Logoyu kaldır</button>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 20 }}>
              Logo; kenar çubuğunda ve müstahsil makbuzunda görünür. Otomatik olarak küçültülür.
            </div>

            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Firma bilgileri</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 14 }}>
              <div>
                <label className="zk-label">Firma / komisyoncu adı</label>
                <input className="zk-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="örn. Ahmet Yılmaz Zeytin Komisyonculuğu" />
              </div>
              <div>
                <label className="zk-label">Telefon</label>
                <input className="zk-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 xxx xx xx" />
              </div>
              <div>
                <label className="zk-label">Vergi no</label>
                <input className="zk-input" value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
              </div>
              <div>
                <label className="zk-label">Vergi dairesi</label>
                <input className="zk-input" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} placeholder="örn. Bergama V.D." />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="zk-label">Adres</label>
                <input className="zk-input" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {tab === 'fiyat' && (
          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Zeytin türleri ve fiyat listesi (bu hafta)</div>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>
              Her tür için numaraya ayrılıp ayrılmadığını seçin. Yeni alım ekranında otomatik gelir.
              {settings.priceListUpdatedAt && ` Son toplu güncelleme: ${new Date(settings.priceListUpdatedAt).toLocaleString('tr-TR')}.`}
            </div>

            <div style={{ background: COLORS.paper, borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Toplu fiyat güncelleme</div>
              <div style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 8 }}>
                Piyasa fiyatı değiştiğinde tüm tür ve numaraların fiyatını tek seferde güncelleyin (örn. borsa fiyatı %5 arttıysa).
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <select className="zk-select" style={{ width: 140 }} value={bulkMode} onChange={(e) => setBulkMode(e.target.value)}>
                  <option value="percent">Yüzde (%)</option>
                  <option value="fixed">Sabit tutar (₺)</option>
                </select>
                <input
                  className="zk-input" type="number" style={{ width: 130 }}
                  placeholder={bulkMode === 'percent' ? 'örn. 5 veya -3' : 'örn. 2 veya -1.5'}
                  value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}
                />
                <button className="zk-btn zk-btn-gold" onClick={bulkUpdatePrices}>Tüm fiyatları güncelle</button>
              </div>
            </div>

            {priceList.map((v) => (
              <VarietyEditor key={v.id} variety={v} onChange={updateVariety} onRemove={() => removeVariety(v.id)} />
            ))}
            {priceList.length === 0 && <div className="zk-empty">Henüz tür eklenmedi.</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input className="zk-input" value={newVarietyName} onChange={(e) => setNewVarietyName(e.target.value)} placeholder="örn. Edremit" />
              <button className="zk-btn zk-btn-gold" onClick={addVariety}><Plus size={13} /> Tür ekle</button>
            </div>
          </div>
        )}

        {tab === 'kategoriler' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>💵 Gelir kategorileri</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>Kasa'da "Giriş" kaydederken kategori seçimi için kullanılır.</div>
              <TagChipList items={incomeCategories} onChange={setIncomeCategories} placeholder="örn. Hizmet Bedeli" />
            </div>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>💸 Gider kategorileri</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>Giderler ekranındaki kategori seçiminde kullanılır.</div>
              <TagChipList items={expenseCategories} onChange={setExpenseCategories} placeholder="örn. Ofis Gideri" />
            </div>
          </div>
        )}

        {tab === 'vergi' && (
          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>🧮 Vergi oranları</div>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>
              Farklı KDV dilimleri veya stopaj gibi hızlı seçim listeleri için kullanılır. "Varsayılan KDV Oranı" (Genel sekmesi) ilk açılışta öntanımlı değeri belirler.
            </div>
            <TaxRateList rates={taxRates} onChange={setTaxRates} />
          </div>
        )}

        {tab === 'gorunum' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Tema</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { key: 'dark', label: '🌙 Koyu' },
                  { key: 'light', label: '☀️ Açık' },
                  { key: 'navy', label: '🌌 Lacivert' },
                  { key: 'highContrast', label: '🔆 Yüksek Kontrast' },
                ].map((t) => (
                  <button
                    key={t.key}
                    className={`zk-btn ${theme === t.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`}
                    onClick={() => setTheme(t.key)}
                  >
                    {t.label}{theme === t.key ? ' ✓' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Vurgu rengi</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAccentColor(c)}
                    style={{
                      width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: accentColor === c ? `3px solid ${COLORS.ink}` : '1px solid rgba(0,0,0,0.15)',
                    }}
                    aria-label={c}
                  />
                ))}
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ width: 34, height: 34, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer' }} />
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Kenar çubuğu yoğunluğu</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`zk-btn ${sidebarDensity === 'normal' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setSidebarDensity('normal')}>Normal</button>
                <button className={`zk-btn ${sidebarDensity === 'compact' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setSidebarDensity('compact')}>Kompakt</button>
              </div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>📏 Yazı boyutu</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`zk-btn ${fontSize === 'small' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setFontSize('small')}>Küçük</button>
                <button className={`zk-btn ${fontSize === 'normal' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setFontSize('normal')}>Normal</button>
                <button className={`zk-btn ${fontSize === 'large' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => setFontSize('large')}>Büyük</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'yedek' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Yedekleme (JSON)</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>Tüm verileri (çiftçiler, alımlar, satışlar, giderler, ayarlar) tek bir dosyaya indirin veya daha önce indirdiğiniz bir yedeği geri yükleyin. Tam yedekleme/geri yükleme için önerilen yöntem budur.</div>
              <button className="zk-btn zk-btn-primary" onClick={onBackup} style={{ marginBottom: 12 }}><Download size={14} /> Yedeği indir (.json)</button>
              <div>
                <label className="zk-btn zk-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                  <Upload size={14} /> Yedekten geri yükle
                  <input
                    type="file"
                    accept="application/json"
                    style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files[0]) onRestore(e.target.files[0]); e.target.value = ''; }}
                  />
                </label>
              </div>
              {restoreStatus && <div style={{ fontSize: 12, color: COLORS.olive, marginTop: 10 }}>{restoreStatus}</div>}
              <div style={{ fontSize: 11, color: COLORS.red, marginTop: 10 }}>Geri yükleme, o an ekrandaki tüm verilerin üzerine yazar — dikkatli kullanın.</div>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>🔄 Otomatik yedekler</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>
                Uygulama her gün ilk açılışta otomatik olarak bir anlık görüntü kaydeder (son 7 gün saklanır). Bu, cihaz içi bir güvenlik ağıdır — yine de düzenli olarak yukarıdaki "Yedeği indir" ile dışarıya (telefon/bilgisayara) tam yedek almanızı öneririz, çünkü otomatik yedekler tarayıcı verisi silinirse kaybolur.
              </div>
              {(!autoBackups || autoBackups.length === 0) ? (
                <div className="zk-empty">Henüz otomatik yedek oluşmadı — yarın ilk açılışta ilk yedek alınacak.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...autoBackups].reverse().map((b) => (
                    <div key={b.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COLORS.paper, borderRadius: 8, padding: '8px 12px', flexWrap: 'wrap', gap: 8,}}>
                      <span style={{ fontSize: 12.5 }}>{fmtDate(b.date)}{b.date === todayStr() ? ' (bugün)' : ''}</span>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => onRestoreAutoBackup(b.key)}>
                        <Upload size={12} /> Bu yedeği geri yükle
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Excel'e dışa aktarma</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>Tüm modülleri (çiftçiler, alımlar, satışlar, giderler, filo, kasa vb.) her biri ayrı sayfa olacak şekilde tek bir Excel dosyasına indirir.</div>
              <button
                className="zk-btn zk-btn-blue"
                onClick={() => {
                  const wb = XLSX.utils.book_new();
                  const addSheet = (rows, sheetName) => {
                    if (!rows || rows.length === 0) return;
                    const ws = XLSX.utils.json_to_sheet(rows);
                    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
                  };
                  addSheet(allData.farmers.map((f) => ({ 'Ad Soyad': f.name, 'Telefon': f.phone || '', 'TC No': f.tcNo || '', 'Adres': f.address || '', 'BAĞ-KUR': f.bagkurStatus ? 'Evet' : 'Hayır' })), 'Ciftciler');
                  addSheet(allData.purchases.map((p) => ({ 'Makbuz No': p.makbuzNo, 'Tarih': p.date, 'Ciftci Id': p.farmerId, 'Net kg': p.netKg, 'Tutar': p.amount, 'Net Odeme': p.netPayment })), 'Alimlar');
                  addSheet(allData.sales.map((s) => ({ 'Tarih': s.date, 'Alici Id': s.buyerId, 'Sinif': s.grade || '', 'Kg': s.kg, 'Fiyat': s.pricePerKg, 'Tutar': s.amount })), 'Satislar');
                  addSheet(allData.buyers.map((b) => ({ 'Ad': b.name, 'Telefon': b.phone || '' })), 'Alicilar');
                  addSheet(allData.expenses.map((e) => ({ 'Tarih': e.date, 'Kategori': e.category, 'Tutar': e.amount, 'Not': e.note || '' })), 'Giderler');
                  addSheet(allData.payments.map((p) => ({ 'Tarih': p.date, 'Ciftci Id': p.farmerId, 'Tur': p.payType, 'Tutar': p.amount, 'Not': p.note || '' })), 'Odemeler');
                  addSheet(allData.vehicles.map((v) => ({ 'Plaka': v.plaka, 'Marka': v.marka || '', 'Kapasite': v.kapasite || '' })), 'Araclar');
                  addSheet(allData.personnel.map((p) => ({ 'Ad Soyad': p.name, 'Telefon': p.phone || '', 'Gorev': p.role || '' })), 'Personel');
                  addSheet(allData.maintenance.map((m) => ({ 'Tarih': m.date, 'Arac Id': m.vehicleId, 'Km': m.km, 'Tur': m.type, 'Maliyet': m.cost, 'Not': m.note || '' })), 'Bakim');
                  addSheet(allData.fuel.map((f) => ({ 'Tarih': f.date, 'Arac Id': f.vehicleId, 'Km': f.km, 'Litre': f.liters, 'Litre Fiyati': f.pricePerLiter, 'Tutar': f.totalCost })), 'Yakit');
                  addSheet(allData.documents.map((d) => ({ 'Arac Id': d.vehicleId, 'Belge': d.docType, 'Duzenleme': d.issueDate || '', 'Bitis': d.expiryDate })), 'Evrak');
                  addSheet(allData.insurance.map((i) => ({ 'Arac Id': i.vehicleId, 'Tur': i.policyType, 'Sirket': i.company, 'Bitis': i.endDate, 'Prim': i.premium })), 'Sigorta');
                  addSheet(allData.fines.map((f) => ({ 'Arac Id': f.vehicleId, 'Tarih': f.date, 'Aciklama': f.description, 'Tutar': f.amount, 'Odendi': f.paid ? 'Evet' : 'Hayir' })), 'Cezalar');
                  addSheet(allData.cashEntries.map((c) => ({ 'Tarih': c.date, 'Tur': c.type, 'Kategori': c.category || '', 'Tutar': c.amount, 'Not': c.note || '' })), 'Kasa');
                  addSheet(allData.crateMovements.map((c) => ({ 'Tarih': c.date, 'Ciftci Id': c.farmerId, 'Hareket': c.type, 'Adet': c.quantity, 'Depozito': c.deposit || '', 'Not': c.note || '' })), 'Kasa-Cuval');
                  addSheet(allData.labResults.map((l) => ({ 'Tarih': l.date, 'Ciftci Id': l.farmerId, 'Randiman': l.randiman, 'Asit': l.asit, 'Nem': l.nem, 'Kalite': l.kalite || '' })), 'Laboratuvar');
                  addSheet(allData.bankAccounts.map((b) => ({ 'Banka': b.bankName, 'Hesap': b.accountName || '', 'IBAN': b.iban || '', 'Bakiye': b.balance })), 'Banka Hesaplari');
                  addSheet(allData.checksNotes.map((c) => ({ 'Tur': c.type, 'Yon': c.direction, 'Kimden-Kime': c.party, 'Tutar': c.amount, 'Vade': c.dueDate, 'Durum': c.status })), 'Cek-Senet');
                  addSheet(allData.shipments.map((s) => ({ 'Tarih': s.date, 'Irsaliye No': s.waybillNo, 'Plaka': s.vehiclePlaka, 'Sofor': s.driverName, 'Alici': s.buyerName, 'Kg': s.kg, 'Durum': s.status })), 'Sevkiyat');
                  XLSX.writeFile(wb, `zeytin-defteri-tum-veri-${todayStr()}.xlsx`);
                }}
              >
                <Download size={14} /> Tümünü Excel'e aktar
              </button>
            </div>

            <div className="zk-card">
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Excel'den çiftçi içe aktarma</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>
                Excel dosyanızda şu sütun başlıkları olmalı: <strong>Ad Soyad</strong> (zorunlu), Telefon, TC No, Adres. İlk satır başlık satırı olarak kabul edilir, mevcut çiftçi listenize eklenir (üzerine yazmaz).
              </div>
              <ExcelFarmerImport farmers={farmers} setFarmers={setFarmers} />
            </div>
          </div>
        )}

        {tab !== 'fiyat' && tab !== 'yedek' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button className="zk-btn zk-btn-primary" onClick={save}>Tüm ayarları kaydet</button>
            {savedNote && <span style={{ fontSize: 12, color: COLORS.olive }}>{savedNote}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
