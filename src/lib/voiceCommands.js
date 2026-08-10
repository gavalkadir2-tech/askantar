import { supabase } from '../supabaseClient.js';
import { EXPENSE_CATEGORIES } from './constants';
import { fmtDate, fmtKg, fmtTL, localDateStr, todayStr } from './format';

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
    const isNumberWord = TR_ONES[w] || TR_TENS[w] || w === 'yüz' || w === 'yuz' || w === 'bin' || w === 'sıfır' || w === 'sifir';
    if (isNumberWord) {
      let total = 0, current = 0, j = i, consumed = 0;
      while (j < tokens.length) {
        const ww = normalizeTr(tokens[j]);
        if (ww === 'sıfır' || ww === 'sifir') { j++; consumed++; continue; }
        if (TR_ONES[ww]) { current += TR_ONES[ww]; j++; consumed++; continue; }
        if (TR_TENS[ww]) { current += TR_TENS[ww]; j++; consumed++; continue; }
        if (ww === 'yüz' || ww === 'yuz') { current = (current === 0 ? 1 : current) * 100; j++; consumed++; continue; }
        if (ww === 'bin') { total += (current === 0 ? 1 : current) * 1000; current = 0; j++; consumed++; continue; }
        break;
      }
      if (consumed > 0) {
        out.push(String(total + current));
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
  // 1) Tam eslesme (en guvenilir) - ad soyad ya da ilk ad.
  let farmer = farmers.find((f) => lower.includes(normalizeTr(f.name)));
  if (farmer) return farmer;
  farmer = farmers.find((f) => {
    const first = normalizeTr(f.name).split(' ')[0];
    return first.length > 2 && lower.includes(first);
  });
  if (farmer) return farmer;
  // 2) Bulanik eslesme - ses tanimanin ismi hafif yanlis duydugu durumlar icin.
  let best = null, bestScore = 0;
  for (const f of farmers) {
    const fullNorm = normalizeTr(f.name);
    const firstNorm = fullNorm.split(' ')[0];
    const score = Math.max(bestWordSimilarity(lower, fullNorm), bestWordSimilarity(lower, firstNorm));
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return bestScore >= FUZZY_THRESHOLD ? best : undefined;
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

  const farmer = extractFarmer(lower, farmers);

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

  if (!farmer) return { ok: false, message: 'Çiftçi adını anlayamadım. Örnek: "Mehmet\'ten 50 kilo Tirilye 1 numara 100 liradan al".' };
  if (!kg) return { ok: false, message: `${farmer.name} anladım ama kilo miktarını anlayamadım. "50 kilo" gibi net söyleyin.` };
  if (!varietyLabel) return { ok: false, message: 'Zeytin türünü/sınıfını anlayamadım. Fiyat listenizdeki bir tür adını (örn. Tirilye) söyleyin.' };
  if (!price) return { ok: false, message: 'Fiyatı anlayamadım. "100 liradan" gibi belirtin.' };

  return { ok: true, type: 'purchase', farmer, kg, price, varietyLabel };
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
  const farmer = extractFarmer(lower, farmers);
  const amount = extractAmountLoose(lower);
  const payType = lower.includes('avans') ? 'avans' : 'odeme';
  if (!farmer) return { ok: false, message: 'Hangi çiftçiye ödeme/avans yapıldığını anlayamadım.' };
  if (!amount) return { ok: false, message: `${farmer.name} anladım ama tutarı anlayamadım. "500 lira" gibi net söyleyin.` };
  return { ok: true, type: 'payment', farmer, amount, payType };
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

export function parseVoiceCommandLocal(text, ctx) {
  const converted = turkishWordsToNumber(text);
  const lower = normalizeTr(converted);
  if (lower.includes('hatırlat')) return parseReminderCommand(converted);
  if (lower.includes('gider') || lower.includes('masraf')) return parseExpenseCommand(converted);
  if (lower.includes('avans') || lower.includes('ödeme') || lower.includes('odeme')) return parsePaymentCommand(converted, ctx.farmers);
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
    return { ok: true, type: 'purchase', farmer, kg: parsed.kg, price: parsed.price, varietyLabel, viaAi: true };
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
  if (parsed.action === 'expense' && parsed.amount) {
    return { ok: true, type: 'expense', amount: parsed.amount, category: parsed.category || 'Diğer', note: parsed.note || text, viaAi: true };
  }
  if (parsed.action === 'reminder' && parsed.title) {
    return { ok: true, type: 'reminder', title: parsed.title, date: parsed.date || todayStr(), viaAi: true };
  }
  return null;
}

export const GROQ_SYSTEM_PROMPT = (ctx) => `Sen bir zeytin komisyonculuğu uygulamasında sesli komutları ayrıştıran bir asistansın. Kullanıcının söylediği Türkçe cümleyi analiz et ve SADECE aşağıdaki JSON formatlarından birini döndür, başka hiçbir açıklama veya metin ekleme:

Alım için: {"action":"purchase","farmerName":"...","variety":"...","grade":"...","kg":123,"price":45.5}
Yeni çiftçi için: {"action":"add_farmer","name":"...","phone":"..."}
Ödeme/avans için: {"action":"payment","farmerName":"...","amount":123,"payType":"odeme"}  (avans ise payType "avans")
Gider için: {"action":"expense","amount":123,"category":"...","note":"..."}
Hatırlatma için: {"action":"reminder","title":"...","date":"YYYY-AA-GG"}
Hiçbiri değilse: {"action":"unknown"}

Bilinen çiftçiler: ${ctx.farmers.map((f) => f.name).join(', ') || 'yok'}
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
  if (p.type === 'purchase') return `Alım: ${p.farmer.name} — ${p.varietyLabel} — ${fmtKg(p.kg)} — ${fmtTL(p.price)}/kg. Toplam ${fmtTL(p.kg * p.price)}.`;
  if (p.type === 'add_farmer') return `Yeni çiftçi: ${p.name}${p.phone ? ' · ' + p.phone : ''}.`;
  if (p.type === 'payment') return `${p.payType === 'avans' ? 'Avans' : 'Ödeme'}: ${p.farmer.name} — ${fmtTL(p.amount)}.`;
  if (p.type === 'expense') return `Gider: ${p.category} — ${fmtTL(p.amount)}.`;
  if (p.type === 'reminder') return `Hatırlatma: "${p.title}" — ${fmtDate(p.date)}.`;
  return '';
}
      } else {
        varietyLabel = v.name; matchedPrice = v.singlePrice;
      }
      break;
    }
  }
  if (!price && matchedPrice) price = matchedPrice;

  if (!farmer) return { ok: false, message: 'Çiftçi adını anlayamadım. Örnek: "Mehmet\'ten 50 kilo Tirilye 1 numara 100 liradan al".' };
  if (!kg) return { ok: false, message: `${farmer.name} anladım ama kilo miktarını anlayamadım. "50 kilo" gibi net söyleyin.` };
  if (!varietyLabel) return { ok: false, message: 'Zeytin türünü/sınıfını anlayamadım. Fiyat listenizdeki bir tür adını (örn. Tirilye) söyleyin.' };
  if (!price) return { ok: false, message: 'Fiyatı anlayamadım. "100 liradan" gibi belirtin.' };

  return { ok: true, type: 'purchase', farmer, kg, price, varietyLabel };
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
  const lower = text.toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı');
  const farmer = extractFarmer(lower, farmers);
  const amount = extractAmount(lower);
  const payType = lower.includes('avans') ? 'avans' : 'odeme';
  if (!farmer) return { ok: false, message: 'Hangi çiftçiye ödeme/avans yapıldığını anlayamadım.' };
  if (!amount) return { ok: false, message: `${farmer.name} anladım ama tutarı anlayamadım. "500 lira" gibi net söyleyin.` };
  return { ok: true, type: 'payment', farmer, amount, payType };
}

export function parseExpenseCommand(text) {
  const lower = text.toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı');
  const amount = extractAmount(lower);
  if (!amount) return { ok: false, message: 'Gider tutarını anlayamadım. "150 lira nakliye gideri ekle" gibi söyleyin.' };
  const categories = EXPENSE_CATEGORIES;
  const category = categories.find((c) => lower.includes(c.toLowerCase())) || 'Diğer';
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

export function parseVoiceCommandLocal(text, ctx) {
  const lower = text.toLowerCase().replace(/İ/g, 'i').replace(/I/g, 'ı');
  if (lower.includes('hatırlat')) return parseReminderCommand(text);
  if (lower.includes('gider') || lower.includes('masraf')) return parseExpenseCommand(text);
  if (lower.includes('avans') || lower.includes('ödeme') || lower.includes('odeme')) return parsePaymentCommand(text, ctx.farmers);
  if (lower.includes('çiftçi ekle') || lower.includes('ciftci ekle') || lower.includes('yeni çiftçi') || lower.includes('yeni ciftci')) return parseAddFarmerCommand(text);
  return parsePurchaseCommand(text, ctx.farmers, ctx.priceList);
}

export function interpretAiParsedResult(parsed, ctx, text) {
  if (!parsed || parsed.action === 'error' || parsed.action === 'unknown') return null;

  if (parsed.action === 'purchase') {
    const farmer = ctx.farmers.find((f) => f.name.toLowerCase() === String(parsed.farmerName || '').toLowerCase())
      || ctx.farmers.find((f) => f.name.toLowerCase().includes(String(parsed.farmerName || '').toLowerCase()));
    if (!farmer || !parsed.kg || !parsed.price) return null;
    const varietyLabel = parsed.grade ? `${parsed.variety} · ${parsed.grade}` : parsed.variety;
    return { ok: true, type: 'purchase', farmer, kg: parsed.kg, price: parsed.price, varietyLabel, viaAi: true };
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
  if (parsed.action === 'expense' && parsed.amount) {
    return { ok: true, type: 'expense', amount: parsed.amount, category: parsed.category || 'Diğer', note: parsed.note || text, viaAi: true };
  }
  if (parsed.action === 'reminder' && parsed.title) {
    return { ok: true, type: 'reminder', title: parsed.title, date: parsed.date || todayStr(), viaAi: true };
  }
  return null;
}

export const GROQ_SYSTEM_PROMPT = (ctx) => `Sen bir zeytin komisyonculuğu uygulamasında sesli komutları ayrıştıran bir asistansın. Kullanıcının söylediği Türkçe cümleyi analiz et ve SADECE aşağıdaki JSON formatlarından birini döndür, başka hiçbir açıklama veya metin ekleme:

Alım için: {"action":"purchase","farmerName":"...","variety":"...","grade":"...","kg":123,"price":45.5}
Yeni çiftçi için: {"action":"add_farmer","name":"...","phone":"..."}
Ödeme/avans için: {"action":"payment","farmerName":"...","amount":123,"payType":"odeme"}  (avans ise payType "avans")
Gider için: {"action":"expense","amount":123,"category":"...","note":"..."}
Hatırlatma için: {"action":"reminder","title":"...","date":"YYYY-AA-GG"}
Hiçbiri değilse: {"action":"unknown"}

Bilinen çiftçiler: ${ctx.farmers.map((f) => f.name).join(', ') || 'yok'}
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
  if (p.type === 'purchase') return `Alım: ${p.farmer.name} — ${p.varietyLabel} — ${fmtKg(p.kg)} — ${fmtTL(p.price)}/kg. Toplam ${fmtTL(p.kg * p.price)}.`;
  if (p.type === 'add_farmer') return `Yeni çiftçi: ${p.name}${p.phone ? ' · ' + p.phone : ''}.`;
  if (p.type === 'payment') return `${p.payType === 'avans' ? 'Avans' : 'Ödeme'}: ${p.farmer.name} — ${fmtTL(p.amount)}.`;
  if (p.type === 'expense') return `Gider: ${p.category} — ${fmtTL(p.amount)}.`;
  if (p.type === 'reminder') return `Hatırlatma: "${p.title}" — ${fmtDate(p.date)}.`;
  return '';
}
