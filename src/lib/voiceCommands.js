import { supabase } from '../supabaseClient.js';
import { EXPENSE_CATEGORIES } from './constants';
import { fmtDate, fmtKg, fmtTL, localDateStr, todayStr } from './format';
import { computeAging } from '../hooks/index';

// ---------- Turkce normalizasyon, bulanik (fuzzy) eslestirme, sayi cozumleme ----------
// Ses tanima motoru isimleri/kelimeleri her zaman birebir dogru yazamaz
// (or. "Mehmet" -> "Muhammed", "Tirilye" -> "Tirilya"). Bu yuzden sadece tam
// string.includes() yerine, dusuk maliyetli bir benzerlik skoruna (Levenshtein)
// gore en yakin adayi da deniyoruz.

export function normalizeTr(str) {
  return String(str || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Cumledeki kelimeler icinde, hedef kelimeye en yakin benzerligi bulur.
function bestWordSimilarity(lower, targetNorm) {
  const words = lower.split(/\s+/).filter((w) => w.length >= 3);
  let best = 0;
  for (const w of words) {
    const s = similarity(w, targetNorm);
    if (s > best) best = s;
  }
  return best;
}

const FUZZY_THRESHOLD = 0.72;
const AMBIGUITY_GAP = 0.08; // en iyi iki aday bu kadar yakinsa netlestirme sorusu sorulur
// Tam isim (1.0) ya da ilk-ad (0.95) eslesmesinin altindaki her skor "emin
// degilim, ama en yakin bu" anlamina gelir. Bu durumda kullaniciya ayri bir
// dogrulama sorusu sorulur ("Mehmet mi dediniz, emin degilim").
const LOW_CONFIDENCE_THRESHOLD = 0.9;
// Bu tutarin (TL) uzerindeki alim/satis/odeme/tahsilat islemlerinde ozete ek
// olarak toplam tutar vurgulanarak ayrica sorulur.
const DEFAULT_HIGH_VALUE_THRESHOLD = 5000;

// Bir isim listesinde (ciftci ya da alici farketmez) metne en yakin adaylari
// skorlarina gore siralar. Tam eslesme skor 1, ilk-ad eslesmesi 0.95, digerleri
// bulanik benzerlik skoru.
function findEntityCandidates(lower, list) {
  const scored = list.map((item) => {
    const fullNorm = normalizeTr(item.name);
    const firstNorm = fullNorm.split(' ')[0];
    let score;
    if (lower.includes(fullNorm)) score = 1;
    else if (firstNorm.length > 2 && lower.includes(firstNorm)) score = 0.95;
    else score = Math.max(bestWordSimilarity(lower, fullNorm), bestWordSimilarity(lower, firstNorm));
    return { item, score };
  }).filter((x) => x.score >= FUZZY_THRESHOLD).sort((a, b) => b.score - a.score);
  return scored;
}

// extractFarmer/extractBuyer icin ortak govde: tek bir net eslesme varsa onu
// dondurur; en iyi iki aday birbirine cok yakinsa (AMBIGUITY_GAP icinde)
// belirsiz oldugunu bildirir, boylece caginin kullaniciya "hangisi?" diye
// sorabilmesi saglanir.
function resolveEntity(lower, list) {
  const candidates = findEntityCandidates(lower, list);
  if (candidates.length === 0) return { entity: null, ambiguous: false, candidates: [], lowConfidence: false };
  if (candidates.length === 1) {
    return { entity: candidates[0].item, ambiguous: false, candidates: [], lowConfidence: candidates[0].score < LOW_CONFIDENCE_THRESHOLD };
  }
  const [first, second] = candidates;
  if (first.score - second.score < AMBIGUITY_GAP) {
    return { entity: null, ambiguous: true, candidates: candidates.slice(0, 4).map((c) => c.item), lowConfidence: false };
  }
  return { entity: first.item, ambiguous: false, candidates: [], lowConfidence: first.score < LOW_CONFIDENCE_THRESHOLD };
}

// Cumlede eslesme bulunamadiginca (ambiguous degil, entity de yok), muhtemel
// bir isim adayi cikarmaya calisir — bas harfi buyuk 1-2 kelimelik dizi
// (orn. "Ali Veli'den 50 kilo..." -> "Ali Veli"). Bu, sesle yeni cari/ciftci
// ekleme onayi akisinda kullanilir. Ham (normalize edilmemis) metin uzerinde
// calisir cunku buyuk/kucuk harf bilgisine ihtiyac duyar.
export function extractCandidateName(rawText) {
  const text = String(rawText || '').trim();
  const m = text.match(/^([A-ZÇĞİÖŞÜ][\wçğıöşüÇĞİÖŞÜ.]*)(?:\s+([A-ZÇĞİÖŞÜ][\wçğıöşüÇĞİÖŞÜ.]*))?/);
  if (!m) return null;
  let name = [m[1], m[2]].filter(Boolean).join(' ');
  // "'den", "'ten", "'e", "'ye" gibi hal eklerini ayir.
  name = name.replace(/'[a-zçğıöşü]+$/i, '').replace(/[’'`]+$/, '').trim();
  if (name.length < 2) return null;
  return name;
}

// Turkce sayi bicimi: nokta binlik ayiraci, virgul ondalik ayiracidir (ornek:
// "1.500,50"). Web Speech API genelde duz rakam ("1500") dondurur ama yazarak
// girilen komutlarda binlik/ondalik karismasini onlemek icin duzgun cozumluyoruz.
function parseTrNumber(raw) {
  let s = String(raw).trim();
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

const TR_ONES = { 'bir': 1, 'iki': 2, 'üç': 3, 'uc': 3, 'dört': 4, 'dort': 4, 'beş': 5, 'bes': 5, 'altı': 6, 'alti': 6, 'yedi': 7, 'sekiz': 8, 'dokuz': 9 };
const TR_TENS = { 'on': 10, 'yirmi': 20, 'otuz': 30, 'kırk': 40, 'kirk': 40, 'elli': 50, 'altmış': 60, 'altmis': 60, 'yetmiş': 70, 'yetmis': 70, 'seksen': 80, 'doksan': 90 };

// Metindeki soylenmis turkce sayilari ("bin beş yüz elli") rakama cevirir
// ("1550"). Ses tanima bazen sayilari rakam yerine kelime olarak dondurebilir;
// bu donusum olmadan tutar/kilo hicbir zaman yakalanamaz.
export function turkishWordsToNumber(text) {
  const tokens = text.split(/\s+/);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const w = normalizeTr(tokens[i]);
    const isNumberWord = TR_ONES[w] || TR_TENS[w] || w === 'yüz' || w === 'yuz' || w === 'bin' || w === 'sıfır' || w === 'sifir' || w === 'yarım' || w === 'yarim';
    if (isNumberWord) {
      let total = 0, current = 0, j = i, consumed = 0;
      while (j < tokens.length) {
        const ww = normalizeTr(tokens[j]);
        if (ww === 'sıfır' || ww === 'sifir') { j++; consumed++; continue; }
        if (ww === 'yarım' || ww === 'yarim') { current += 0.5; j++; consumed++; continue; }
        if (TR_ONES[ww]) { current += TR_ONES[ww]; j++; consumed++; continue; }
        if (TR_TENS[ww]) { current += TR_TENS[ww]; j++; consumed++; continue; }
        if (ww === 'yüz' || ww === 'yuz') { current = (current === 0 ? 1 : current) * 100; j++; consumed++; continue; }
        if (ww === 'bin') { total += (current === 0 ? 1 : current) * 1000; current = 0; j++; consumed++; continue; }
        break;
      }
      if (consumed > 0) {
        let value = total + current;
        // "elli buçuk" -> 50.5 ; sayi grubunun hemen ardindan "buçuk" gelirse yarim ekle.
        if (j < tokens.length && normalizeTr(tokens[j]) === 'buçuk') { value += 0.5; j++; consumed++; }
        out.push(String(value));
        i = j;
        continue;
      }
    }
    out.push(tokens[i]);
    i++;
  }
  return out.join(' ');
}

export function extractFarmer(lower, farmers) {
  return resolveEntity(lower, farmers).entity || undefined;
}

// Aday belirsizse (iki isim birbirine cok yakinsa) netlestirme sorusu
// sorulabilmesi icin ham sonucu doner.
export function extractFarmerWithAmbiguity(lower, farmers) {
  return resolveEntity(lower, farmers);
}

export function extractBuyer(lower, buyers) {
  return resolveEntity(lower, buyers).entity || undefined;
}

export function extractBuyerWithAmbiguity(lower, buyers) {
  return resolveEntity(lower, buyers);
}

// "vadesi yarın", "vadesi 15 gün sonra", "vade 2 hafta", "vadesi 1 ay sonra"
// gibi ifadeleri ISO tarih dizesine cevirir. turkishWordsToNumber ile onceden
// donusum yapildigi icin sozlu sayilar da burada digit olarak yakalanir.
export function extractVadeTarihi(lower) {
  if (/vade[a-zçğıöşü]*\s*(bugün)/.test(lower)) return todayStr();
  if (/vade[a-zçğıöşü]*\s*(yarın)/.test(lower)) {
    const d = new Date(); d.setDate(d.getDate() + 1); return localDateStr(d);
  }
  const gunMatch = lower.match(/vade[a-zçğıöşü]*\s*(\d+)\s*gün/);
  if (gunMatch) {
    const d = new Date(); d.setDate(d.getDate() + parseInt(gunMatch[1], 10)); return localDateStr(d);
  }
  const haftaMatch = lower.match(/vade[a-zçğıöşü]*\s*(\d+)\s*hafta/);
  if (haftaMatch) {
    const d = new Date(); d.setDate(d.getDate() + parseInt(haftaMatch[1], 10) * 7); return localDateStr(d);
  }
  if (/vade[a-zçğıöşü]*\s*hafta\s*sonra/.test(lower)) {
    const d = new Date(); d.setDate(d.getDate() + 7); return localDateStr(d);
  }
  const ayMatch = lower.match(/vade[a-zçğıöşü]*\s*(\d+)\s*ay/);
  if (ayMatch) {
    const d = new Date(); d.setMonth(d.getMonth() + parseInt(ayMatch[1], 10)); return localDateStr(d);
  }
  return null;
}

export function extractAmount(lower) {
  const m = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:lira|tl|₺)/);
  return m ? parseTrNumber(m[1]) : null;
}

// "Lira/TL" sozcugu soylenmeden yapilan tutar komutlari icin (ör. "Ahmet'e
// 500 avans ver") - kilo gecen komutlarda kullanilmamali, aksi halde kilo
// sayisi yanlislikla tutar sanilabilir.
export function extractAmountLoose(lower) {
  const strict = extractAmount(lower);
  if (strict !== null) return strict;
  const m = lower.match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseTrNumber(m[1]) : null;
}

export function parsePurchaseCommand(text, farmers, priceList, scaleKg) {
  const lower = normalizeTr(text);

  const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)/);
  let kg = kgMatch ? parseTrNumber(kgMatch[1]) : null;
  let kgFromScale = false;
  if (!kg && scaleKg != null) { kg = scaleKg; kgFromScale = true; }
  let price = extractAmount(lower);
  const vadeTarihi = extractVadeTarihi(lower);

  const { entity: farmer, ambiguous, candidates, lowConfidence: farmerLowConfidence } = extractFarmerWithAmbiguity(lower, farmers);

  let varietyLabel = null, matchedPrice = null, bestVarietyScore = 0;
  for (const v of priceList) {
    const vNorm = normalizeTr(v.name);
    const score = lower.includes(vNorm) ? 1 : bestWordSimilarity(lower, vNorm);
    if (score >= FUZZY_THRESHOLD && score > bestVarietyScore) {
      bestVarietyScore = score;
      if (v.hasGrades && v.grades.length > 0) {
        const g = v.grades.find((gr) => {
          const gNorm = normalizeTr(gr.name);
          return lower.includes(gNorm) || bestWordSimilarity(lower, gNorm) >= FUZZY_THRESHOLD;
        });
        if (g) { varietyLabel = `${v.name} · ${g.name}`; matchedPrice = g.price; }
        else { varietyLabel = `${v.name} · ${v.grades[0].name}`; matchedPrice = v.grades[0].price; }
      } else {
        varietyLabel = v.name; matchedPrice = v.singlePrice;
      }
    }
  }
  // Fiyat listesinde tek bir tür/ürün varsa (çoğu küçük komisyoncuda durum
  // budur), kullanıcı türü hiç söylemese bile otomatik o türü varsayıyoruz —
  // her seferinde tür adı tekrarlamak zorunda kalmasın.
  if (!varietyLabel && priceList.length === 1) {
    const v = priceList[0];
    if (v.hasGrades && v.grades.length > 0) { varietyLabel = `${v.name} · ${v.grades[0].name}`; matchedPrice = v.grades[0].price; }
    else { varietyLabel = v.name; matchedPrice = v.singlePrice; }
  }
  if (!price && matchedPrice) price = matchedPrice;

  if (ambiguous) {
    return {
      ok: false, ambiguous: true, entityKind: 'farmer', candidates,
      commandKind: 'purchase', partial: { kg, price, varietyLabel, vadeTarihi },
      message: `Birden fazla kişi buldum: ${candidates.map((c) => c.name).join(', ')}. Hangisi?`,
    };
  }
  if (!farmer) {
    // Bilinen ciftciler arasinda hicbir eslesme yoksa, cumleden olasi bir
    // isim adayi cikarip yeni ciftci olarak eklemeyi teklif ederiz.
    const candidateName = extractCandidateName(text);
    if (candidateName) {
      return {
        ok: false, needsNewEntity: true, entityKind: 'farmer', candidateName,
        commandKind: 'purchase', partial: { kg, price, varietyLabel, vadeTarihi },
        message: `"${candidateName}" adında bir çiftçi bulamadım. Yeni çiftçi olarak eklememi ister misiniz?`,
      };
    }
    return { ok: false, message: 'Çiftçi adını anlayamadım. Örnek: "Mehmet\'ten 50 kilo Tirilye 1 numara 100 liradan al".' };
  }

  // Birden fazla alan aynı anda belirsizse tek tek genel "anlayamadım" yerine
  // hepsini tek, hedefli bir soruda toplarız (ör. "kilo mu, fiyat mı net değildi?").
  const missing = [];
  if (!kg) missing.push('kilo');
  if (!varietyLabel) missing.push('tür/sınıf');
  if (!price) missing.push('fiyat');
  if (missing.length > 1) {
    return {
      ok: false, missingFields: missing,
      message: `${farmer.name} anladım ama ${missing.join(' mı, ')} mı net değildi? Örnek: "50 kilo Tirilye 100 liradan" gibi tamamlar mısınız?`,
    };
  }
  if (!kg) return { ok: false, missingFields: ['kilo'], message: `${farmer.name} anladım ama kilo miktarını anlayamadım. "50 kilo" gibi net söyleyin ya da kantarı bağlayın.` };
  if (!varietyLabel) return { ok: false, missingFields: ['tür/sınıf'], message: 'Zeytin türünü/sınıfını anlayamadım. Fiyat listenizdeki bir tür adını (örn. Tirilye) söyleyin.' };
  if (!price) return { ok: false, missingFields: ['fiyat'], message: 'Fiyatı anlayamadım. "100 liradan" gibi belirtin.' };

  return { ok: true, type: 'purchase', farmer, kg, price, varietyLabel, vadeTarihi, kgFromScale, farmerLowConfidence };
}

export function parseAddFarmerCommand(text) {
  const phoneMatch = text.match(/0?5\d{9}|0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/);
  let name = text
    .replace(/(yeni |,)?\s*çiftçi\s*(olarak\s*)?(ekle|kaydet|oluştur)/gi, '')
    .replace(/telefon(u)?\s*[:\-]?\s*/gi, '')
    .replace(phoneMatch ? phoneMatch[0] : '', '')
    .trim();
  if (!name) return { ok: false, message: 'Çiftçi adını anlayamadım. Örnek: "Yeni çiftçi ekle Ali Veli, telefon 0532 111 22 33".' };
  return { ok: true, type: 'add_farmer', name, phone: phoneMatch ? phoneMatch[0] : '' };
}

export function parsePaymentCommand(text, farmers) {
  const lower = normalizeTr(text);
  const { entity: farmer, ambiguous, candidates, lowConfidence: farmerLowConfidence } = extractFarmerWithAmbiguity(lower, farmers);
  const amount = extractAmountLoose(lower);
  const payType = lower.includes('avans') ? 'avans' : 'odeme';
  if (ambiguous) {
    return {
      ok: false, ambiguous: true, entityKind: 'farmer', candidates,
      commandKind: 'payment', partial: { amount, payType },
      message: `Birden fazla kişi buldum: ${candidates.map((c) => c.name).join(', ')}. Hangisi?`,
    };
  }
  if (!farmer) {
    const candidateName = extractCandidateName(text);
    if (candidateName) {
      return {
        ok: false, needsNewEntity: true, entityKind: 'farmer', candidateName,
        commandKind: 'payment', partial: { amount, payType },
        message: `"${candidateName}" adında bir çiftçi bulamadım. Yeni çiftçi olarak eklememi ister misiniz?`,
      };
    }
    return { ok: false, message: 'Hangi çiftçiye ödeme/avans yapıldığını anlayamadım.' };
  }
  if (!amount) return { ok: false, message: `${farmer.name} anladım ama tutarı anlayamadım. "500 lira" gibi net söyleyin.` };
  return { ok: true, type: 'payment', farmer, amount, payType, farmerLowConfidence };
}

export function parseSaleCommand(text, buyers, priceList, scaleKg) {
  const lower = normalizeTr(text);

  const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)/);
  let kg = kgMatch ? parseTrNumber(kgMatch[1]) : null;
  let kgFromScale = false;
  if (!kg && scaleKg != null) { kg = scaleKg; kgFromScale = true; }
  let price = extractAmount(lower);
  const vadeTarihi = extractVadeTarihi(lower);

  const { entity: buyer, ambiguous, candidates, lowConfidence: buyerLowConfidence } = extractBuyerWithAmbiguity(lower, buyers);

  let varietyLabel = null;
  let bestVarietyScore = 0;
  for (const v of priceList || []) {
    const vNorm = normalizeTr(v.name);
    const score = lower.includes(vNorm) ? 1 : bestWordSimilarity(lower, vNorm);
    if (score >= FUZZY_THRESHOLD && score > bestVarietyScore) {
      bestVarietyScore = score;
      const g = (v.grades || []).find((gr) => {
        const gNorm = normalizeTr(gr.name);
        return lower.includes(gNorm) || bestWordSimilarity(lower, gNorm) >= FUZZY_THRESHOLD;
      });
      varietyLabel = g ? `${v.name} · ${g.name}` : v.name;
    }
  }

  if (ambiguous) {
    return {
      ok: false, ambiguous: true, entityKind: 'buyer', candidates,
      commandKind: 'sale', partial: { kg, price, varietyLabel, vadeTarihi },
      message: `Birden fazla cari buldum: ${candidates.map((c) => c.name).join(', ')}. Hangisi?`,
    };
  }
  if (!buyer) {
    const candidateName = extractCandidateName(text);
    if (candidateName) {
      return {
        ok: false, needsNewEntity: true, entityKind: 'buyer', candidateName,
        commandKind: 'sale', partial: { kg, price, varietyLabel, vadeTarihi },
        message: `"${candidateName}" adında bir cari bulamadım. Yeni cari olarak eklememi ister misiniz?`,
      };
    }
    return { ok: false, message: 'Hangi cariye satış yapıldığını anlayamadım. Örnek: "Ege Zeytinyağı\'na 200 kilo 120 liradan sat".' };
  }

  const missing = [];
  if (!kg) missing.push('kilo');
  if (!price) missing.push('fiyat');
  if (missing.length > 1) {
    return {
      ok: false, missingFields: missing,
      message: `${buyer.name} anladım ama ${missing.join(' mı, ')} mı net değildi? Örnek: "200 kilo 120 liradan" gibi tamamlar mısınız?`,
    };
  }
  if (!kg) return { ok: false, missingFields: ['kilo'], message: `${buyer.name} anladım ama kilo miktarını anlayamadım. "200 kilo" gibi net söyleyin ya da kantarı bağlayın.` };
  if (!price) return { ok: false, missingFields: ['fiyat'], message: 'Kilo fiyatını anlayamadım. "120 liradan" gibi belirtin.' };

  return { ok: true, type: 'sale', buyer, kg, price, varietyLabel, vadeTarihi, kgFromScale, buyerLowConfidence };
}

export function parseCollectionCommand(text, buyers) {
  const lower = normalizeTr(text);
  const { entity: buyer, ambiguous, candidates, lowConfidence: buyerLowConfidence } = extractBuyerWithAmbiguity(lower, buyers);
  const amount = extractAmountLoose(lower);
  if (ambiguous) {
    return {
      ok: false, ambiguous: true, entityKind: 'buyer', candidates,
      commandKind: 'collection', partial: { amount },
      message: `Birden fazla cari buldum: ${candidates.map((c) => c.name).join(', ')}. Hangisi?`,
    };
  }
  if (!buyer) {
    const candidateName = extractCandidateName(text);
    if (candidateName) {
      return {
        ok: false, needsNewEntity: true, entityKind: 'buyer', candidateName,
        commandKind: 'collection', partial: { amount },
        message: `"${candidateName}" adında bir cari bulamadım. Yeni cari olarak eklememi ister misiniz?`,
      };
    }
    return { ok: false, message: 'Hangi cariden tahsilat yapıldığını anlayamadım.' };
  }
  if (!amount) return { ok: false, message: `${buyer.name} anladım ama tutarı anlayamadım. "500 lira" gibi net söyleyin.` };
  return { ok: true, type: 'collection', buyer, amount, buyerLowConfidence };
}

export function parseExpenseCommand(text) {
  const lower = normalizeTr(text);
  const amount = extractAmountLoose(lower);
  if (!amount) return { ok: false, message: 'Gider tutarını anlayamadım. "150 lira nakliye gideri ekle" gibi söyleyin.' };
  const categories = EXPENSE_CATEGORIES;
  const category = categories.find((c) => lower.includes(normalizeTr(c))) || 'Diğer';
  return { ok: true, type: 'expense', amount, category, note: text };
}

export function parseReminderCommand(text) {
  const title = text.replace(/hatırlat(ma|ıcı)?( ekle)?/gi, '').trim() || text;
  let date = todayStr();
  if (/yarın/i.test(text)) {
    const d = new Date(); d.setDate(d.getDate() + 1); date = localDateStr(d);
  }
  return { ok: true, type: 'reminder', title, date };
}

function balanceAndAging(debits, credits) {
  const balance = debits.reduce((s, d) => s + d.amount, 0) - credits.reduce((s, c) => s + c.amount, 0);
  const aging = computeAging(debits, credits);
  return { balance, aging };
}

// Vadesi gecmis (acik ve gecikmis) hesap sayisini ve toplam tutarini hesaplar.
// Hem parseQueryCommand'daki "kac hesap gecikmis" sorusunda hem de sabah
// brifinginde kullanilir, boylece iki yerde ayni mantik tekrarlanmaz.
export function countOverdueAccounts(ctx) {
  const { farmers = [], buyers = [], purchases = [], payments = [], sales = [], buyerPayments = [] } = ctx || {};
  let count = 0, total = 0;
  farmers.forEach((f) => {
    const debits = purchases.filter((x) => x.farmerId === f.id).map((x) => ({ amount: x.netPayment, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
    const credits = payments.filter((x) => x.farmerId === f.id).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
    const { balance, aging } = balanceAndAging(debits, credits);
    if (balance > 0 && aging.isOverdue) { count += 1; total += balance; }
  });
  buyers.forEach((b) => {
    const debits = sales.filter((x) => x.buyerId === b.id).map((x) => ({ amount: x.amount, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
    const credits = buyerPayments.filter((x) => x.buyerId === b.id).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
    const { balance, aging } = balanceAndAging(debits, credits);
    if (balance > 0 && aging.isOverdue) { count += 1; total += balance; }
  });
  return { count, total };
}

// "Ahmet'in son işlemi neydi?" gibi sorularda o kişiye ait tum kayit
// turlerinden (alim/satis/odeme/tahsilat) en son olusturulani bulup metne cevirir.
function findLastTransactionText(person, ctx, kind) {
  const { purchases = [], payments = [], sales = [], buyerPayments = [] } = ctx || {};
  const records = [];
  if (kind === 'farmer') {
    purchases.filter((x) => x.farmerId === person.id).forEach((x) => records.push({ createdAt: x.createdAt || 0, text: `${fmtDate(x.date)}: ${fmtKg(x.netKg || x.items?.[0]?.kg || 0)} alım, ${fmtTL(x.netPayment)}` }));
    payments.filter((x) => x.farmerId === person.id).forEach((x) => records.push({ createdAt: x.createdAt || 0, text: `${fmtDate(x.date)}: ${x.payType === 'avans' ? 'avans' : 'ödeme'} ${fmtTL(x.amount)}` }));
  } else {
    sales.filter((x) => x.buyerId === person.id).forEach((x) => records.push({ createdAt: x.createdAt || 0, text: `${fmtDate(x.date)}: ${fmtKg(x.kg)} satış, ${fmtTL(x.amount)}` }));
    buyerPayments.filter((x) => x.buyerId === person.id).forEach((x) => records.push({ createdAt: x.createdAt || 0, text: `${fmtDate(x.date)}: tahsilat ${fmtTL(x.amount)}` }));
  }
  if (records.length === 0) return `${person.name}: henüz hiç kaydı yok.`;
  records.sort((a, b) => b.createdAt - a.createdAt);
  return `${person.name} — son işlem: ${records[0].text}.`;
}

// "Ahmet'in bakiyesi ne kadar?", "vadesi geçmiş kaç hesap var?", "bugün kaç
// kilo aldık?", "Ahmet'in son işlemi neydi?" gibi veri okuma komutlarini
// yanitlar. Islem olusturmadigi icin diger parse*Command fonksiyonlarindan
// farkli olarak dogrudan bir metin cevabi doner (ya da sorgu degilse null
// doner, boylece normal komut akisina devam edilir).
export function parseQueryCommand(text, ctx) {
  const lower = normalizeTr(text);
  const { farmers = [], buyers = [], purchases = [], payments = [], sales = [], buyerPayments = [] } = ctx || {};

  const asksOverdueCount = (lower.includes('gecikmiş') || lower.includes('gecikmis') || lower.includes('vadesi geçmiş') || lower.includes('vadesi gecmis'))
    && (lower.includes('kaç') || lower.includes('kac') || lower.includes('var mı') || lower.includes('var mi'));

  if (asksOverdueCount) {
    const { count, total } = countOverdueAccounts(ctx);
    if (count === 0) return 'Vadesi geçmiş hesap yok, her şey yolunda ✓';
    return `Vadesi geçmiş ${count} hesap var, toplam ${fmtTL(total)}.`;
  }

  // "Ahmet'in son işlemi neydi?", "Ayşe'nin son hareketi ne?" gibi sorular.
  const asksLastTransaction = lower.includes('son işlem') || lower.includes('son islem') || lower.includes('son hareket');
  if (asksLastTransaction) {
    const farmerMatch = extractFarmer(lower, farmers);
    if (farmerMatch) return findLastTransactionText(farmerMatch, ctx, 'farmer');
    const buyerMatch = extractBuyer(lower, buyers);
    if (buyerMatch) return findLastTransactionText(buyerMatch, ctx, 'buyer');
    return 'Kimin son işlemini sorduğunuzu anlayamadım. "Ahmet\'in son işlemi neydi?" gibi sorun.';
  }

  // "Bugün kaç kilo aldık?", "bugün kaç kilo sattık?", "bugün kaç alım var?" gibi sorular.
  const mentionsToday = lower.includes('bugün') || lower.includes('bugun');
  const asksKgToday = mentionsToday && (lower.includes('kilo') || lower.includes('kg'));
  if (asksKgToday) {
    const today = todayStr();
    const wantsSale = lower.includes('sat');
    const wantsPurchase = !wantsSale && (lower.includes('al') || lower.includes('kilo'));
    if (wantsSale) {
      const todaySales = sales.filter((x) => x.date === today);
      const kg = todaySales.reduce((s, x) => s + (x.kg || 0), 0);
      return todaySales.length === 0 ? 'Bugün henüz satış yok.' : `Bugün ${fmtKg(kg)} sattık (${todaySales.length} satış).`;
    }
    if (wantsPurchase) {
      const todayPurchases = purchases.filter((x) => x.date === today);
      const kg = todayPurchases.reduce((s, x) => s + (x.netKg || 0), 0);
      return todayPurchases.length === 0 ? 'Bugün henüz alım yok.' : `Bugün ${fmtKg(kg)} aldık (${todayPurchases.length} alım).`;
    }
  }
  const asksCountToday = mentionsToday && (lower.includes('kaç alım') || lower.includes('kac alim') || lower.includes('kaç satış') || lower.includes('kac satis') || lower.includes('kaç işlem') || lower.includes('kac islem'));
  if (asksCountToday) {
    const today = todayStr();
    const todayPurchases = purchases.filter((x) => x.date === today).length;
    const todaySales = sales.filter((x) => x.date === today).length;
    return `Bugün ${todayPurchases} alım, ${todaySales} satış var.`;
  }

  const asksBalance = lower.includes('bakiye') || lower.includes('ne kadar borç') || lower.includes('ne kadar borc') || lower.includes('ne kadar alacak');
  if (asksBalance) {
    const farmerMatch = extractFarmer(lower, farmers);
    if (farmerMatch) {
      const debits = purchases.filter((x) => x.farmerId === farmerMatch.id).map((x) => ({ amount: x.netPayment, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
      const credits = payments.filter((x) => x.farmerId === farmerMatch.id).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
      const { balance, aging } = balanceAndAging(debits, credits);
      if (balance <= 0) return `${farmerMatch.name}: bakiye kapalı, borç yok.`;
      return `${farmerMatch.name}: ${fmtTL(balance)} ödenecek${aging.isOverdue ? ` (${aging.daysOverdue} gün gecikmiş)` : ''}.`;
    }
    const buyerMatch = extractBuyer(lower, buyers);
    if (buyerMatch) {
      const debits = sales.filter((x) => x.buyerId === buyerMatch.id).map((x) => ({ amount: x.amount, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
      const credits = buyerPayments.filter((x) => x.buyerId === buyerMatch.id).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
      const { balance, aging } = balanceAndAging(debits, credits);
      if (balance <= 0) return `${buyerMatch.name}: bakiye kapalı, alacak yok.`;
      return `${buyerMatch.name}: ${fmtTL(balance)} tahsil edilecek${aging.isOverdue ? ` (${aging.daysOverdue} gün gecikmiş)` : ''}.`;
    }
    return 'Kimin bakiyesini sorduğunuzu anlayamadım. "Ahmet\'in bakiyesi ne kadar?" gibi sorun.';
  }

  return null;
}

// ---------- Sabah / mesai başı sesli özet ----------
// Uygulama acilinca gunun ilk kullaniminda proaktif olarak okunacak kisa
// bir brifing metni uretir: "Bugün 3 alım, 2 satış var, vadesi geçen 2
// hesap var" gibi. Tetikleme (gunde bir kez, ne zaman gosterilecegi)
// VoiceAssistant.jsx tarafinda yapilir; burada sadece metin uretilir.
export function buildMorningBriefing(ctx) {
  const { purchases = [], sales = [] } = ctx || {};
  const today = todayStr();
  const purchaseCount = purchases.filter((x) => x.date === today).length;
  const saleCount = sales.filter((x) => x.date === today).length;
  const { count: overdueCount, total: overdueTotal } = countOverdueAccounts(ctx);

  const parts = [];
  parts.push(purchaseCount > 0 || saleCount > 0
    ? `Bugün ${purchaseCount} alım, ${saleCount} satış var`
    : 'Bugün henüz alım veya satış yok');
  parts.push(overdueCount > 0 ? `vadesi geçen ${overdueCount} hesap var (${fmtTL(overdueTotal)})` : 'vadesi geçen hesap yok');
  return `Günaydın! ${parts.join(', ')}.`;
}

// ---------- Zincirleme komut ayırma ----------
// "Ahmet'ten 50 kilo al, 200 lira da avans ver" gibi tek cümlede birden fazla
// işlem geçen komutları, her biri ayrı ayrı ayrıştırılabilecek parçalara
// böler. Sadece açık bağlaçlarda ("ve", "ayrıca", "bir de") ve virgülde
// böler; virgülle yanlışlıkla bölünmüş çıplak sayı parçalarını (örn. "1,
// 500" gibi bir konuşma tanıma hatası) bir önceki parçaya geri birleştirir.
export function splitChainedCommands(text) {
  const rough = String(text)
    .split(/,|\bve\b|\bayrıca\b|\bayrica\b|\bbir de\b/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  if (rough.length <= 1) return [String(text).trim()];
  const merged = [];
  for (const part of rough) {
    if (merged.length > 0 && part.split(/\s+/).length <= 1) {
      merged[merged.length - 1] += ' ' + part;
    } else {
      merged.push(part);
    }
  }
  return merged.length > 1 ? merged : [String(text).trim()];
}

// ---------- Bağlamsal düzeltme ----------
// Bekleyen (onay bekleyen) bir kayıt varken kullanıcının söylediği kısa
// düzeltmeyi ("hayır 60 kilo", "150 lira olacak") baştan komutu iptal edip
// yeniden söyletmek yerine doğrudan o kaydın ilgili alanına uygular. Yanlışlıkla
// yeni bir işlem başlatma ihtimaline karşı yalnızca "hayır" içeren ya da kısa
// ve eylem sözcüğü barındırmayan ifadelerde denenir.
export function shouldTryCorrection(text) {
  const lower = normalizeTr(text);
  if (lower.includes('hayır') || lower.includes('hayir')) return true;
  const words = lower.trim().split(/\s+/).filter(Boolean);
  const actionWords = ['al', 'sat', 'avans', 'ödeme', 'odeme', 'gider', 'masraf', 'tahsil', 'hatırlat', 'ekle', 'çiftçi', 'ciftci'];
  return words.length > 0 && words.length <= 5 && /\d/.test(lower) && !actionWords.some((w) => lower.includes(w));
}

export function applyVoiceCorrection(text, pending, ctx) {
  const converted = turkishWordsToNumber(text);
  const lower = normalizeTr(converted);

  if (pending.type === 'purchase' || pending.type === 'sale') {
    const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)/);
    if (kgMatch) return { ...pending, kg: parseTrNumber(kgMatch[1]), kgFromScale: false };
    const priceMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:lira|tl|₺)/);
    if (priceMatch) return { ...pending, price: parseTrNumber(priceMatch[1]) };
    if (lower.includes('hayır') || lower.includes('hayir')) {
      const bareMatch = lower.match(/(\d+(?:[.,]\d+)?)/);
      if (bareMatch) return { ...pending, kg: parseTrNumber(bareMatch[1]), kgFromScale: false };
    }
    for (const v of ctx.priceList || []) {
      const vNorm = normalizeTr(v.name);
      if (lower.includes(vNorm) || bestWordSimilarity(lower, vNorm) >= FUZZY_THRESHOLD) {
        return { ...pending, varietyLabel: v.name };
      }
    }
    return null;
  }

  if (pending.type === 'payment' || pending.type === 'collection' || pending.type === 'expense') {
    const amount = extractAmountLoose(lower);
    if (amount != null) return { ...pending, amount };
    return null;
  }

  return null;
}

// ---------- Sesli onay/iptal ----------
// Onay bekleyen bir kayıt varken kullanıcı butona basmadan sadece "evet" ya
// da "hayır" (tek başına) diyerek cevap verebilsin diye. Kısa tutuyoruz ki
// "hayır 60 kilo" gibi düzeltme cümleleri buraya değil applyVoiceCorrection'a
// düşsün (bkz. shouldTryCorrection).
const CONFIRM_WORDS = ['evet', 'tamam', 'onayla', 'onaylıyorum', 'onayliyorum', 'kaydet', 'olur', 'doğru', 'dogru', 'aynen', 'kesinlikle', 'evettir'];
const CANCEL_WORDS = ['hayır', 'hayir', 'iptal', 'vazgeç', 'vazgec', 'yapma', 'boşver', 'bosver', 'gerek yok'];

export function isConfirmCommand(text) {
  const lower = normalizeTr(text).replace(/[.!?,]/g, '').trim();
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  return words.some((w) => CONFIRM_WORDS.includes(w));
}

export function isCancelCommand(text) {
  const lower = normalizeTr(text).replace(/[.!?,]/g, '').trim();
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 2) return false;
  return words.some((w) => CANCEL_WORDS.includes(w));
}

// ---------- Bağlamsal takip komutları ----------
// "Aynısından 30 kilo daha al", "ona 100 lira da avans ver" gibi bir önceki
// işlemdeki kişiye/türe zamirle atıf yapan cümleleri tanır. Gerçek doldurma
// işlemi VoiceAssistant.jsx içinde son kaydedilen işlem hafızasıyla yapılır;
// burada sadece "bu bir takip cümlesi mi?" tespiti yapılır.
const FOLLOWUP_REGEX = /\b(ona|onun|ondan|aynısından|aynisindan|aynısı|aynisi|aynı fiyattan|ayni fiyattan)\b/;

export function isFollowUpReference(text) {
  return FOLLOWUP_REGEX.test(normalizeTr(text));
}

// ---------- Sesli geri alma ----------
// "son işlemi iptal et" / "son kaydı sil" gibi ifadeleri tanır.
export function isUndoCommand(text) {
  const lower = normalizeTr(text);
  const mentionsLast = lower.includes('son işlem') || lower.includes('son islem') || lower.includes('son kayıt') || lower.includes('son kayit') || lower.includes('son kaydı') || lower.includes('son kaydi');
  const mentionsUndo = lower.includes('iptal et') || lower.includes('geri al') || lower.includes(' sil') || lower.endsWith('sil');
  return mentionsLast && mentionsUndo;
}

export function parseVoiceCommandLocal(text, ctx) {
  const converted = turkishWordsToNumber(text);
  const lower = normalizeTr(converted);

  // Sorgu modu (veri okuma) - kayit olusturmaz, dogrudan cevap dondurur.
  const queryAnswer = parseQueryCommand(converted, ctx);
  if (queryAnswer) return { ok: true, type: 'query', answer: queryAnswer };

  if (lower.includes('hatırlat')) return parseReminderCommand(converted);
  if (lower.includes('gider') || lower.includes('masraf')) return parseExpenseCommand(converted);
  if (lower.includes('tahsil')) return parseCollectionCommand(converted, ctx.buyers || []);
  if (lower.includes('avans') || lower.includes('ödeme') || lower.includes('odeme')) return parsePaymentCommand(converted, ctx.farmers);
  if (/\bsatt|satış|satis|\bsat\b/.test(lower)) return parseSaleCommand(converted, ctx.buyers || [], ctx.priceList, ctx.scaleKg);
  if (lower.includes('çiftçi ekle') || lower.includes('ciftci ekle') || lower.includes('yeni çiftçi') || lower.includes('yeni ciftci')) return parseAddFarmerCommand(converted);
  return parsePurchaseCommand(converted, ctx.farmers, ctx.priceList, ctx.scaleKg);
}

export function interpretAiParsedResult(parsed, ctx, text) {
  if (!parsed || parsed.action === 'error' || parsed.action === 'unknown') return null;

  if (parsed.action === 'purchase') {
    const farmer = ctx.farmers.find((f) => f.name.toLowerCase() === String(parsed.farmerName || '').toLowerCase())
      || ctx.farmers.find((f) => f.name.toLowerCase().includes(String(parsed.farmerName || '').toLowerCase()));
    let kg = parsed.kg, kgFromScale = false;
    if (!kg && ctx.scaleKg != null) { kg = ctx.scaleKg; kgFromScale = true; }
    if (!farmer || !kg || !parsed.price) return null;
    const varietyLabel = parsed.grade ? `${parsed.variety} · ${parsed.grade}` : parsed.variety;
    return { ok: true, type: 'purchase', farmer, kg, price: parsed.price, varietyLabel, vadeTarihi: parsed.vadeTarihi || null, kgFromScale, viaAi: true };
  }
  if (parsed.action === 'add_farmer' && parsed.name) {
    return { ok: true, type: 'add_farmer', name: parsed.name, phone: parsed.phone || '', viaAi: true };
  }
  if (parsed.action === 'payment' && parsed.amount) {
    const farmer = ctx.farmers.find((f) => f.name.toLowerCase() === String(parsed.farmerName || '').toLowerCase())
      || ctx.farmers.find((f) => f.name.toLowerCase().includes(String(parsed.farmerName || '').toLowerCase()));
    if (!farmer) return null;
    return { ok: true, type: 'payment', farmer, amount: parsed.amount, payType: parsed.payType === 'avans' ? 'avans' : 'odeme', viaAi: true };
  }
  if (parsed.action === 'sale' && parsed.price) {
    let kg = parsed.kg, kgFromScale = false;
    if (!kg && ctx.scaleKg != null) { kg = ctx.scaleKg; kgFromScale = true; }
    if (!kg) return null;
    const buyer = (ctx.buyers || []).find((b) => b.name.toLowerCase() === String(parsed.buyerName || '').toLowerCase())
      || (ctx.buyers || []).find((b) => b.name.toLowerCase().includes(String(parsed.buyerName || '').toLowerCase()));
    if (!buyer) return null;
    return { ok: true, type: 'sale', buyer, kg, price: parsed.price, varietyLabel: parsed.variety || null, vadeTarihi: parsed.vadeTarihi || null, kgFromScale, viaAi: true };
  }
  if (parsed.action === 'collection' && parsed.amount) {
    const buyer = (ctx.buyers || []).find((b) => b.name.toLowerCase() === String(parsed.buyerName || '').toLowerCase())
      || (ctx.buyers || []).find((b) => b.name.toLowerCase().includes(String(parsed.buyerName || '').toLowerCase()));
    if (!buyer) return null;
    return { ok: true, type: 'collection', buyer, amount: parsed.amount, viaAi: true };
  }
  if (parsed.action === 'expense' && parsed.amount) {
    return { ok: true, type: 'expense', amount: parsed.amount, category: parsed.category || 'Diğer', note: parsed.note || text, viaAi: true };
  }
  if (parsed.action === 'reminder' && parsed.title) {
    return { ok: true, type: 'reminder', title: parsed.title, date: parsed.date || todayStr(), viaAi: true };
  }
  // "query" eylemini kasıtlı olarak burada işlemiyoruz: Groq'a çiftçi/cari
  // isimleri dışında hiçbir gerçek alım/ödeme verisi gönderilmiyor, bu yüzden
  // bakiye/gecikme gibi sorularda AI kendi metnini uyduruyordu (ör. "sorgulanıyor",
  // "bilgi bulunamadı"). Bu tür sorular her zaman gerçek kayıtlara erişimi olan
  // yerel parseQueryCommand'a bırakılır — null dönmek, çağıranın yerel motora
  // düşmesini sağlar.
  return null;
}

export const GROQ_SYSTEM_PROMPT = (ctx) => `Sen bir zeytin komisyonculuğu uygulamasında sesli komutları ayrıştıran bir asistansın. Kullanıcının söylediği Türkçe cümleyi analiz et ve SADECE aşağıdaki JSON formatlarından birini döndür, başka hiçbir açıklama veya metin ekleme:

Alım (çiftçiden) için: {"action":"purchase","farmerName":"...","variety":"...","grade":"...","kg":123,"price":45.5,"vadeTarihi":"YYYY-AA-GG veya null"}
Yeni çiftçi için: {"action":"add_farmer","name":"...","phone":"..."}
Çiftçiye ödeme/avans için: {"action":"payment","farmerName":"...","amount":123,"payType":"odeme"}  (avans ise payType "avans")
Satış (aliciya/cariye) için: {"action":"sale","buyerName":"...","variety":"...","kg":123,"price":45.5,"vadeTarihi":"YYYY-AA-GG veya null"}
Aliciden tahsilat için: {"action":"collection","buyerName":"...","amount":123}
Gider için: {"action":"expense","amount":123,"category":"...","note":"..."}
Hatırlatma için: {"action":"reminder","title":"...","date":"YYYY-AA-GG"}
Bakiye/gecikme/tahsilat gibi bir VERİ SORUSU ise (kayıt oluşturmayan bir soruysa): {"action":"unknown"} döndür — bu tür sorular ayrı bir sistem tarafından gerçek kayıtlarla cevaplanıyor, sen tahmini bir cevap uydurma.
Hiçbiri değilse: {"action":"unknown"}

Bilinen çiftçiler: ${ctx.farmers.map((f) => f.name).join(', ') || 'yok'}
Bilinen cariler (alıcılar): ${(ctx.buyers || []).map((b) => b.name).join(', ') || 'yok'}
Bilinen zeytin türleri: ${ctx.priceList.map((v) => v.name).join(', ') || 'yok'}
Bugünün tarihi: ${todayStr()}${ctx.scaleKg != null ? `\nKantar bağlı ve şu an ${ctx.scaleKg} kg okuyor — kullanıcı alım/satış cümlesinde kilo söylemediyse "kg" alanını boş bırak, otomatik doldurulacak.` : ''}`;

// Tarayıcıdan doğrudan Groq API'sine istek atar — kullanıcı Ayarlar'dan kendi
// ücretsiz Groq API anahtarını girdiyse çalışır. Anahtar tarayıcıda saklanır,
// bu yöntem Supabase Edge Function gerektirmez, hem Claude hem GitHub sürümünde çalışır.

export async function callGroqDirect(text, ctx, apiKey) {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: GROQ_SYSTEM_PROMPT(ctx) },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 300,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

// ---------- Groq Whisper ile ses -> metin ----------
// Tarayıcının kendi SpeechRecognition'ı (Web Speech API) yalnızca masaüstü
// Chrome/Edge'de çalışıyor ve Türkçe tanıma kalitesi düzensiz. Bunun yerine
// mikrofonu kendimiz kaydedip (useVoiceRecorder) ham sesi doğrudan Groq'un
// Whisper modeline gönderiyoruz: hem mobil dahil her tarayıcıda çalışır hem
// de tanıma kalitesi belirgin şekilde daha iyi ve daha hızlıdır.
const GROQ_STT_MODEL = 'whisper-large-v3-turbo';

export async function transcribeAudioGroq(blob, apiKey, { retries = 1 } = {}) {
  if (!blob || !apiKey) return { ok: false, reason: 'no-input' };
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : blob.type.includes('wav') ? 'wav' : 'webm';

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const form = new FormData();
      form.append('file', blob, `ses.${ext}`);
      form.append('model', GROQ_STT_MODEL);
      form.append('language', 'tr');
      form.append('response_format', 'json');
      form.append('temperature', '0');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.status === 401) return { ok: false, reason: 'auth' };
      if (res.status === 429) return { ok: false, reason: 'rate-limit' };
      if (!res.ok) {
        if (attempt < retries) continue;
        return { ok: false, reason: 'server' };
      }
      const data = await res.json();
      const text = data && typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) return { ok: false, reason: 'empty' };
      return { ok: true, text };
    } catch (e) {
      if (attempt < retries && e.name !== 'AbortError') continue;
      return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : 'network' };
    }
  }
  return { ok: false, reason: 'unknown' };
}

// AI destekli ayrıştırma. İki yoldan biri kullanılabilir:
// 1) Ayarlarda kişisel Groq API anahtarı girilmişse tarayıcıdan doğrudan Groq'a istek atılır.
// 2) Yoksa ve "supabase" tanımlıysa (GitHub sürümü) sunucu tarafındaki Edge Function denenir
//    (API anahtarı tarayıcıya hiç inmez).

export async function parseVoiceCommandAI(text, ctx) {
  const apiKey = ctx.settings && ctx.settings.groqApiKey;
  if (apiKey) {
    const parsed = await callGroqDirect(text, ctx, apiKey);
    const result = interpretAiParsedResult(parsed, ctx, text);
    if (result) return result;
    if (parsed) return null; // Groq yanıt verdi ama anlamlandıramadık — yerel motora düşme
  }
  if (typeof supabase === 'undefined' || !supabase.functions) return null;
  try {
    const { data, error } = await supabase.functions.invoke('ai-voice-parse', {
      body: {
        text,
        context: {
          farmerNames: ctx.farmers.map((f) => f.name),
          buyerNames: (ctx.buyers || []).map((b) => b.name),
          varietyNames: ctx.priceList.map((v) => v.name),
          today: todayStr(),
        },
      },
    });
    if (error || !data) return null;
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return interpretAiParsedResult(parsed, ctx, text);
  } catch (e) {
    return null;
  }
}

// ---------- Yuksek tutar dogrulamasi ----------
// Belirlenen esigin (varsayilan 5.000 TL) uzerindeki islemlerde, ozete ek
// olarak toplam tutar ayrica vurgulanarak sorulur — boylece kullanici sadece
// "Kaydedeyim mi?" gibi genel bir soruya degil, acikca soylenmis bir tutara
// "evet" demis olur.
export function highValueThreshold(ctx) {
  const v = ctx && ctx.settings && ctx.settings.voiceHighValueThreshold;
  return typeof v === 'number' && v > 0 ? v : DEFAULT_HIGH_VALUE_THRESHOLD;
}

export function pendingTotal(p) {
  if (p.type === 'purchase' || p.type === 'sale') return p.kg * p.price;
  if (p.type === 'payment' || p.type === 'collection' || p.type === 'expense') return p.amount;
  return 0;
}

export function isHighValue(p, ctx) {
  return pendingTotal(p) >= highValueThreshold(ctx);
}

// Onay sorusunu olusturur; yuksek tutarli islemlerde tutar vurgulu ayrica
// tekrarlanir (ör. "50 kilo, 100 liradan — yani 5.000 lira, doğru mu?").
export function pendingConfirmText(p, ctx) {
  const base = pendingSummaryText(p);
  if (!isHighValue(p, ctx)) return `${base} Kaydedeyim mi?`;
  const total = pendingTotal(p);
  if (p.type === 'purchase' || p.type === 'sale') {
    return `${base} Dikkat, tutar yüksek — ${fmtKg(p.kg)}, ${fmtTL(p.price)}/kg, yani toplam ${fmtTL(total)}. Doğru mu, onaylıyor musunuz?`;
  }
  return `${base} Dikkat, tutar yüksek — toplam ${fmtTL(total)}. Doğru mu, onaylıyor musunuz?`;
}

// Dusuk guven skorlu isim eslesmelerinde ayri bir uyari metni doner (yoksa null).
export function lowConfidenceWarningText(p) {
  if (p.farmerLowConfidence && p.farmer) return `${p.farmer.name} mi dediniz, emin değilim ama en yakın öyle anladım.`;
  if (p.buyerLowConfidence && p.buyer) return `${p.buyer.name} mi dediniz, emin değilim ama en yakın öyle anladım.`;
  return null;
}

export function pendingSummaryText(p) {
  const kgNote = p.kgFromScale ? ' (kantardan)' : '';
  if (p.type === 'purchase') return `Alım: ${p.farmer.name} — ${p.varietyLabel} — ${fmtKg(p.kg)}${kgNote} — ${fmtTL(p.price)}/kg. Toplam ${fmtTL(p.kg * p.price)}.${p.vadeTarihi ? ` Vade: ${fmtDate(p.vadeTarihi)}.` : ''}`;
  if (p.type === 'add_farmer') return `Yeni çiftçi: ${p.name}${p.phone ? ' · ' + p.phone : ''}.`;
  if (p.type === 'payment') return `${p.payType === 'avans' ? 'Avans' : 'Ödeme'}: ${p.farmer.name} — ${fmtTL(p.amount)}.`;
  if (p.type === 'sale') return `Satış: ${p.buyer.name}${p.varietyLabel ? ' — ' + p.varietyLabel : ''} — ${fmtKg(p.kg)}${kgNote} — ${fmtTL(p.price)}/kg. Toplam ${fmtTL(p.kg * p.price)}.${p.vadeTarihi ? ` Vade: ${fmtDate(p.vadeTarihi)}.` : ''}`;
  if (p.type === 'collection') return `Tahsilat: ${p.buyer.name} — ${fmtTL(p.amount)}.`;
  if (p.type === 'expense') return `Gider: ${p.category} — ${fmtTL(p.amount)}.`;
  if (p.type === 'reminder') return `Hatırlatma: "${p.title}" — ${fmtDate(p.date)}.`;
  return '';
}
