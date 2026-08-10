import { supabase } from '../supabaseClient.js';
import { EXPENSE_CATEGORIES } from './constants';
import { fmtDate, fmtKg, fmtTL, localDateStr, todayStr } from './format';
import { computeAging } from '../hooks/index';

// ---------- Turkce normalizasyon, bulanik (fuzzy) eslestirme, sayi cozumleme ----------
// Ses tanima motoru isimleri/kelimeleri her zaman birebir dogru yazamaz
// (or. "Mehmet" -> "Muhammed", "Tirilye" -> "Tirilya"). Bu yuzden sadece tam
// string.includes() yerine, dusuk maliyetli bir benzerlik skoruna (Levenshtein)
// gore en yakin adayi da deniyoruz.

function normalizeTr(str) {
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
  if (candidates.length === 0) return { entity: null, ambiguous: false, candidates: [] };
  if (candidates.length === 1) return { entity: candidates[0].item, ambiguous: false, candidates: [] };
  const [first, second] = candidates;
  if (first.score - second.score < AMBIGUITY_GAP) {
    return { entity: null, ambiguous: true, candidates: candidates.slice(0, 4).map((c) => c.item) };
  }
  return { entity: first.item, ambiguous: false, candidates: [] };
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

export function parsePurchaseCommand(text, farmers, priceList) {
  const lower = normalizeTr(text);

  const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)/);
  const kg = kgMatch ? parseTrNumber(kgMatch[1]) : null;
  let price = extractAmount(lower);
  const vadeTarihi = extractVadeTarihi(lower);

  const { entity: farmer, ambiguous, candidates } = extractFarmerWithAmbiguity(lower, farmers);

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
  if (!price && matchedPrice) price = matchedPrice;

  if (ambiguous) {
    return {
      ok: false, ambiguous: true, entityKind: 'farmer', candidates,
      commandKind: 'purchase', partial: { kg, price, varietyLabel, vadeTarihi },
      message: `Birden fazla kişi buldum: ${candidates.map((c) => c.name).join(', ')}. Hangisi?`,
    };
  }
  if (!farmer) return { ok: false, message: 'Çiftçi adını anlayamadım. Örnek: "Mehmet\'ten 50 kilo Tirilye 1 numara 100 liradan al".' };
  if (!kg) return { ok: false, message: `${farmer.name} anladım ama kilo miktarını anlayamadım. "50 kilo" gibi net söyleyin.` };
  if (!varietyLabel) return { ok: false, message: 'Zeytin türünü/sınıfını anlayamadım. Fiyat listenizdeki bir tür adını (örn. Tirilye) söyleyin.' };
  if (!price) return { ok: false, message: 'Fiyatı anlayamadım. "100 liradan" gibi belirtin.' };

  return { ok: true, type: 'purchase', farmer, kg, price, varietyLabel, vadeTarihi };
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
  const { entity: farmer, ambiguous, candidates } = extractFarmerWithAmbiguity(lower, farmers);
  const amount = extractAmountLoose(lower);
  const payType = lower.includes('avans') ? 'avans' : 'odeme';
  if (ambiguous) {
    return {
      ok: false, ambiguous: true, entityKind: 'farmer', candidates,
      commandKind: 'payment', partial: { amount, payType },
      message: `Birden fazla kişi buldum: ${candidates.map((c) => c.name).join(', ')}. Hangisi?`,
    };
  }
  if (!farmer) return { ok: false, message: 'Hangi çiftçiye ödeme/avans yapıldığını anlayamadım.' };
  if (!amount) return { ok: false, message: `${farmer.name} anladım ama tutarı anlayamadım. "500 lira" gibi net söyleyin.` };
  return { ok: true, type: 'payment', farmer, amount, payType };
}

export function parseSaleCommand(text, buyers, priceList) {
  const lower = normalizeTr(text);

  const kgMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo|kg)/);
  const kg = kgMatch ? parseTrNumber(kgMatch[1]) : null;
  let price = extractAmount(lower);
  const vadeTarihi = extractVadeTarihi(lower);

  const { entity: buyer, ambiguous, candidates } = extractBuyerWithAmbiguity(lower, buyers);

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
  if (!buyer) return { ok: false, message: 'Hangi cariye satış yapıldığını anlayamadım. Örnek: "Ege Zeytinyağı\'na 200 kilo 120 liradan sat".' };
  if (!kg) return { ok: false, message: `${buyer.name} anladım ama kilo miktarını anlayamadım. "200 kilo" gibi net söyleyin.` };
  if (!price) return { ok: false, message: 'Kilo fiyatını anlayamadım. "120 liradan" gibi belirtin.' };

  return { ok: true, type: 'sale', buyer, kg, price, varietyLabel, vadeTarihi };
}

export function parseCollectionCommand(text, buyers) {
  const lower = normalizeTr(text);
  const { entity: buyer, ambiguous, candidates } = extractBuyerWithAmbiguity(lower, buyers);
  const amount = extractAmountLoose(lower);
  if (ambiguous) {
    return {
      ok: false, ambiguous: true, entityKind: 'buyer', candidates,
      commandKind: 'collection', partial: { amount },
      message: `Birden fazla cari buldum: ${candidates.map((c) => c.name).join(', ')}. Hangisi?`,
    };
  }
  if (!buyer) return { ok: false, message: 'Hangi cariden tahsilat yapıldığını anlayamadım.' };
  if (!amount) return { ok: false, message: `${buyer.name} anladım ama tutarı anlayamadım. "500 lira" gibi net söyleyin.` };
  return { ok: true, type: 'collection', buyer, amount };
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

// "Ahmet'in bakiyesi ne kadar?", "vadesi geçmiş kaç hesap var?" gibi veri
// okuma komutlarini yanitlar. Islem olusturmadigi icin diger parse*Command
// fonksiyonlarindan farkli olarak dogrudan bir metin cevabi doner (ya da
// sorgu degilse null doner, boylece normal komut akisina devam edilir).
export function parseQueryCommand(text, ctx) {
  const lower = normalizeTr(text);
  const { farmers = [], buyers = [], purchases = [], payments = [], sales = [], buyerPayments = [] } = ctx || {};

  const asksOverdueCount = (lower.includes('gecikmiş') || lower.includes('gecikmis') || lower.includes('vadesi geçmiş') || lower.includes('vadesi gecmis'))
    && (lower.includes('kaç') || lower.includes('kac') || lower.includes('var mı') || lower.includes('var mi'));

  if (asksOverdueCount) {
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
    if (count === 0) return 'Vadesi geçmiş hesap yok, her şey yolunda ✓';
    return `Vadesi geçmiş ${count} hesap var, toplam ${fmtTL(total)}.`;
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
  if (/\bsatt|satış|satis|\bsat\b/.test(lower)) return parseSaleCommand(converted, ctx.buyers || [], ctx.priceList);
  if (lower.includes('çiftçi ekle') || lower.includes('ciftci ekle') || lower.includes('yeni çiftçi') || lower.includes('yeni ciftci')) return parseAddFarmerCommand(converted);
  return parsePurchaseCommand(converted, ctx.farmers, ctx.priceList);
}

export function interpretAiParsedResult(parsed, ctx, text) {
  if (!parsed || parsed.action === 'error' || parsed.action === 'unknown') return null;

  if (parsed.action === 'purchase') {
    const farmer = ctx.farmers.find((f) => f.name.toLowerCase() === String(parsed.farmerName || '').toLowerCase())
      || ctx.farmers.find((f) => f.name.toLowerCase().includes(String(parsed.farmerName || '').toLowerCase()));
    if (!farmer || !parsed.kg || !parsed.price) return null;
    const varietyLabel = parsed.grade ? `${parsed.variety} · ${parsed.grade}` : parsed.variety;
    return { ok: true, type: 'purchase', farmer, kg: parsed.kg, price: parsed.price, varietyLabel, vadeTarihi: parsed.vadeTarihi || null, viaAi: true };
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
  if (parsed.action === 'sale' && parsed.kg && parsed.price) {
    const buyer = (ctx.buyers || []).find((b) => b.name.toLowerCase() === String(parsed.buyerName || '').toLowerCase())
      || (ctx.buyers || []).find((b) => b.name.toLowerCase().includes(String(parsed.buyerName || '').toLowerCase()));
    if (!buyer) return null;
    return { ok: true, type: 'sale', buyer, kg: parsed.kg, price: parsed.price, varietyLabel: parsed.variety || null, vadeTarihi: parsed.vadeTarihi || null, viaAi: true };
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
  if (parsed.action === 'query' && parsed.queryAnswer) {
    return { ok: true, type: 'query', answer: parsed.queryAnswer, viaAi: true };
  }
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
Veri sorgusu (bakiye/gecikme sorma, kayit OLUŞTURMAZ) için: {"action":"query","queryAnswer":"kisa ve net cevap metni"}
Hiçbiri değilse: {"action":"unknown"}

Bilinen çiftçiler: ${ctx.farmers.map((f) => f.name).join(', ') || 'yok'}
Bilinen cariler (alıcılar): ${(ctx.buyers || []).map((b) => b.name).join(', ') || 'yok'}
Bilinen zeytin türleri: ${ctx.priceList.map((v) => v.name).join(', ') || 'yok'}
Bugünün tarihi: ${todayStr()}`;

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

export function pendingSummaryText(p) {
  if (p.type === 'purchase') return `Alım: ${p.farmer.name} — ${p.varietyLabel} — ${fmtKg(p.kg)} — ${fmtTL(p.price)}/kg. Toplam ${fmtTL(p.kg * p.price)}.${p.vadeTarihi ? ` Vade: ${fmtDate(p.vadeTarihi)}.` : ''}`;
  if (p.type === 'add_farmer') return `Yeni çiftçi: ${p.name}${p.phone ? ' · ' + p.phone : ''}.`;
  if (p.type === 'payment') return `${p.payType === 'avans' ? 'Avans' : 'Ödeme'}: ${p.farmer.name} — ${fmtTL(p.amount)}.`;
  if (p.type === 'sale') return `Satış: ${p.buyer.name}${p.varietyLabel ? ' — ' + p.varietyLabel : ''} — ${fmtKg(p.kg)} — ${fmtTL(p.price)}/kg. Toplam ${fmtTL(p.kg * p.price)}.${p.vadeTarihi ? ` Vade: ${fmtDate(p.vadeTarihi)}.` : ''}`;
  if (p.type === 'collection') return `Tahsilat: ${p.buyer.name} — ${fmtTL(p.amount)}.`;
  if (p.type === 'expense') return `Gider: ${p.category} — ${fmtTL(p.amount)}.`;
  if (p.type === 'reminder') return `Hatırlatma: "${p.title}" — ${fmtDate(p.date)}.`;
  return '';
}
