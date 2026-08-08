import { supabase } from '../supabaseClient.js';
import { currentUser } from '../currentUser.js';
import { offlineGet, offlineSet, queuePendingWrite } from '../offlineStorage.js';
import { COLORS, THEME_PRESETS } from './theme';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function nextReceiptNo(records, configuredNext) {
  const maxExisting = records.reduce((m, r) => Math.max(m, r.makbuzNo || 0), 0);
  return Math.max(maxExisting, (configuredNext || 1) - 1) + 1;
}

export const localDateStr = (d) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
};

export const todayStr = () => localDateStr(new Date());

// Ayarlar sayfasından değiştirilebilen, tüm dosyada paylaşılan biçimlendirme durumu.
// React state değil çünkü fmtTL/fmtDate gibi yardımcılar yüzlerce yerde çağrılıyor;
// bunun yerine değerler mutasyona uğratılır ve React'in normal render döngüsü
// (ayarlar değiştiğinde tetiklenen re-render) yeni değerleri otomatik yansıtır.

export const CURRENCY_CODE_MAP = { '₺': 'TRY', '$': 'USD', '€': 'EUR' };

export let FORMAT_STATE = { dateFormat: 'DMY', decimalPlaces: 2 };

export const fmtTL = (n) => {
  const num = Number(n) || 0;
  const sign = num < 0 ? '-' : '';
  const decimals = FORMAT_STATE.decimalPlaces ?? 2;
  const abs = Math.abs(num).toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${sign}${abs} ₺`;
};

export const fmtKg = (n) => (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';

export const fmtDate = (d) => {
  const date = new Date(d);
  if (FORMAT_STATE.dateFormat === 'YMD') return date.toLocaleDateString('sv-SE');
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateShort = (d) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });

// Bu proje bagimsiz calistigi icin Claude artifact ortamindaki window.storage
// yerine Supabase (gercek Postgres veritabani) kullanir. Her satir giris yapan
// kullanicinin e-postasina (owner_email) baglidir, boylece her hesap sadece
// kendi verisini gorur/degistirir. Ayrica CEVRIMDISI-ONCELIKLI calisir: her
// okuma/yazma once yerel tarayici onbellegine uygulanir (internetsiz de
// calisir), Supabase'e yazma basarisiz olursa bekleyen kuyruga eklenir ve
// baglanti gelince otomatik gonderilir (bkz. offlineStorage.js).

export async function storageGet(key) {
  const cached = offlineGet(currentUser.email, key);
  try {
    const { data, error } = await supabase.from('app_data').select('value').eq('key', key).eq('owner_email', currentUser.email).maybeSingle();
    if (error) throw error;
    if (data) { offlineSet(currentUser.email, key, data.value); return data.value; }
    return cached;
  } catch (e) {
    return cached;
  }
}

export async function storageSet(key, value) {
  offlineSet(currentUser.email, key, value);
  try {
    const { error } = await supabase.from('app_data').upsert({ key, value, owner_email: currentUser.email, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (e) {
    queuePendingWrite(currentUser.email, key, value);
  }
}

export function applyAppearance(settings) {
  const preset = THEME_PRESETS[settings.theme] || THEME_PRESETS.light;
  Object.assign(COLORS, preset);
  if (settings.accentColor) COLORS.gold = settings.accentColor;
  FORMAT_STATE = { dateFormat: settings.dateFormat || 'DMY', decimalPlaces: settings.decimalPlaces ?? 2 };
}

export function stopajOraniHesapla(borsaTescilli) {
  return borsaTescilli ? 2 : 4;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date(todayStr());
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function mean(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }

export function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
}

export function linearTrend(points) {
  // points: [{x, y}] -> en küçük kareler ile eğim/kesişim
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function monthKey(dateStr) { return dateStr.slice(0, 7); }

export function lastNMonthKeys(n) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}
