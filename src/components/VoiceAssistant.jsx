import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Scale as ScaleIcon,
} from 'lucide-react';
import { nextReceiptNo, storageSet, todayStr, uid } from '../lib/format';
import { COLORS } from '../lib/theme';
import {
  applyVoiceCorrection,
  isCancelCommand,
  isConfirmCommand,
  isFollowUpReference,
  isHighValue,
  isUndoCommand,
  lowConfidenceWarningText,
  parseQueryCommand,
  parseVoiceCommandAI,
  parseVoiceCommandLocal,
  pendingConfirmText,
  pendingSummaryText,
  shouldTryCorrection,
  splitChainedCommands,
  transcribeAudioGroq,
  turkishWordsToNumber,
} from '../lib/voiceCommands';
import { useScaleConnection } from '../hooks/useScaleConnection';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

export function VoiceAssistant({ farmers, setFarmers, priceList, purchases, setPurchases, payments, setPayments, expenses, setExpenses, reminders, setReminders, settings, buyers, setBuyers, sales, setSales, buyerPayments, setBuyerPayments }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Merhaba! Alım, satış, çiftçi ekleme, ödeme/avans, tahsilat, gider ve hatırlatma gibi işlemleri sesli veya yazarak yapabilirsiniz. Bakiye de sorabilirsiniz. Örnek: "Mehmet\'ten 50 kilo Tirilye 100 liradan al", "Ayşe\'ye 200 kilo 120 liradan sat", "Ahmet\'in bakiyesi ne kadar?". Tek cümlede iki işlem de yapabilirsiniz: "Ahmet\'ten 50 kilo al, 200 lira da avans ver". Bir kayıt onay beklerken sadece "evet" ya da "hayır" diyerek de cevap verebilirsiniz; "hayır 60 kilo" derseniz düzeltirim; "son işlemi iptal et" derseniz geri alırım. "Aynısından 30 kilo daha al" gibi bir önceki işleme atıfta bulunabilirsiniz. Kantar bağlıysa ağırlık sabitlenince size kendiliğinden sorarım.' },
  ]);
  const [pending, setPending] = useState(null);
  const [pendingBatch, setPendingBatch] = useState(null);
  const [ambiguity, setAmbiguity] = useState(null);
  // Sesle söylenen ama bilinen çiftçi/cari listesinde bulunamayan bir isim
  // için "yeni ekleyeyim mi?" onayı beklerken tutulan durum. { entityKind,
  // candidateName, commandKind, partial, message }
  const [newEntityPrompt, setNewEntityPrompt] = useState(null);
  const [typedText, setTypedText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('zk:voiceTts') !== '0'; } catch (e) { return true; }
  });
  const [recLevel, setRecLevel] = useState(0);
  const [micStage, setMicStage] = useState('idle'); // 'idle' | 'recording' | 'transcribing'
  const recognitionRef = useRef(null);
  const logEndRef = useRef(null);
  const hintShownRef = useRef(false);
  const lastSavedRef = useRef(null);
  // Takip komutları için ("aynısından 30 kilo daha al", "ona 100 lira da avans
  // ver") en son kaydedilen işlemdeki kişi/tür/fiyatı hatırlar.
  const lastEntityRef = useRef(null);
  // Kantar ile proaktif öneri: ağırlık ne zaman sabitlendi, hangi değer için
  // zaten soru sorduk, ve şu an bir öneri döngüsü ("kimden alıyorsun?" bekleniyor)
  // aktif mi — bunları izler.
  const scaleWatchRef = useRef({ value: null, since: 0, prompted: null });
  const scalePromptActiveRef = useRef(false);
  // Asistan meşgulken (onay bekliyor, dinliyor, düşünüyor...) kantar önerisinin
  // araya girmemesi için her render'da güncellenen bir "meşgul mü" özeti.
  const busyRef = useRef(false);
  // promptScaleWeight her render'da en güncel closure'ı (ttsEnabled, ctx vs.)
  // kullanabilsin diye ref üzerinden çağrılır (interval'in closure'ı bayatlamasın diye).
  const promptScaleWeightRef = useRef(() => {});
  const dragStateRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [bubblePos, setBubblePos] = useState(() => {
    if (typeof window !== 'undefined') return { x: window.innerWidth - 76, y: window.innerHeight - 86 };
    return { x: 300, y: 300 };
  });

  const scale = useScaleConnection();
  const speechSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsSupported = typeof window !== 'undefined' && !!window.speechSynthesis;
  const aiEnabled = !!(settings && (settings.aiVoiceEnabled || settings.groqApiKey));
  const groqApiKey = (settings && settings.groqApiKey) || '';

  // ---------- Gelişmiş sesli komut girişi (Groq Whisper) ----------
  // Groq API anahtarı tanımlıysa ve tarayıcı mikrofon kaydını destekliyorsa
  // (masaüstü + mobil dahil hemen her modern tarayıcı), sesi kendimiz
  // kaydedip Groq'un Whisper modeline gönderiyoruz. Bu, tarayıcının kendi
  // SpeechRecognition'ından (yalnızca masaüstü Chrome/Edge) hem daha doğru
  // hem de çok daha geniş cihaz desteğine sahip. Anahtar yoksa ya da kayıt
  // desteklenmiyorsa tarayıcının yerleşik ses tanımasına geri düşülür.
  const recorder = useVoiceRecorder({
    onLevel: (lvl) => setRecLevel(lvl),
    onAutoStop: () => { stopListening(); },
  });
  const micEngine = groqApiKey && recorder.supported ? 'groq' : (speechSupported ? 'browser' : 'none');

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Bileşen kapanırken/unmount olurken mikrofon açık kalmasın diye kaydı iptal et.
  useEffect(() => () => { recorder.cancel(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kantar önerisinin (aşağıda) araya girip girmeyeceğine karar verirken
  // kullanılan "meşgul mü" özeti — her render'da güncellenir.
  useEffect(() => {
    busyRef.current = !!(pending || pendingBatch || ambiguity || newEntityPrompt || listening || micStage !== 'idle' || thinking);
  }, [pending, pendingBatch, ambiguity, newEntityPrompt, listening, micStage, thinking]);

  // ---------- Sesli geri okuma (TTS) ----------
  // Asistan cevabini sesli de okur, boylece eller kirliyken/tartida iken
  // ekrana bakmaya gerek kalmaz. Her yeni cevaptan once oncekini keser.
  // onEnd verilirse (ör. kantar önerisi sonrası otomatik dinlemeye geçmek
  // için) konuşma bitince/başarısız olunca çağrılır. TTS kapalıysa hiç
  // çağrılmaz — bu, "sesle yönlendirme yoksa otomatik mikrofon açma" kuralını
  // sağlar (sessiz modda kullanıcı hâlâ elle başlatır).
  const speak = (text, onEnd) => {
    if (!ttsEnabled || !ttsSupported) return;
    const clean = String(text || '').replace(/[✨✓]/g, '').trim();
    if (!clean) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = 'tr-TR';
      utter.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      const trVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('tr'));
      if (trVoice) utter.voice = trVoice;
      if (onEnd) { utter.onend = onEnd; utter.onerror = onEnd; }
      window.speechSynthesis.speak(utter);
    } catch (e) { /* sessizce yut, ekran metni zaten gosteriliyor */ if (onEnd) onEnd(); }
  };

  const toggleTts = () => {
    setTtsEnabled((v) => {
      const next = !v;
      try { localStorage.setItem('zk:voiceTts', next ? '1' : '0'); } catch (e) {}
      if (!next && ttsSupported) window.speechSynthesis.cancel();
      return next;
    });
  };

  const addAssistantMessage = (text, onSpoken) => {
    setMessages((m) => [...m, { role: 'assistant', text }]);
    speak(text, onSpoken);
  };

  // ---------- Başlama/bitiş bip sesi ----------
  // Kayıt başlarken/biterken kısa bir ton çalar; ekrana bakmadan (tartıda,
  // eller kirliyken) "duyuyor mu, bitti mi" bilinsin diye. TTS ile aynı
  // sessizlik tercihine bağlı değildir — kısa bir cihaz sesi olduğu için
  // kullanıcı sesli okumayı kapatmış olsa bile faydalıdır.
  const playTone = (freq, durationMs, type = 'sine') => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.03);
      osc.onended = () => { try { ctx.close(); } catch (e) {} };
    } catch (e) { /* sessizce yut */ }
  };
  const playStartBeep = () => playTone(880, 110);
  const playEndBeep = () => playTone(520, 130);

  // ---------- Kantar entegrasyonu ----------
  const scaleWeight = scale.connected && scale.lastValue != null ? scale.lastValue : null;

  const buildCtx = () => ({
    farmers, priceList, settings, buyers: buyers || [], purchases, payments,
    sales: sales || [], buyerPayments: buyerPayments || [], scaleKg: scaleWeight,
  });

  // ---------- Kantar ile proaktif öneri ----------
  // Ağırlık kısa bir süre sabit kalınca (kantar oturunca) asistan kendiliğinden
  // sorar: "42 kilo okundu, kimden alıyorsun?" Kullanıcı sadece isim (ve
  // gerekirse fiyat) söyler; kilo zaten kantardan otomatik gelir. Sesli okuma
  // açıksa, soru bitince mikrofon da kendiliğinden açılır (tam elleri
  // serbest bırakan akış); kapalıysa kullanıcı elle mikrofona basar.
  // Ref üzerinden tanımlanır ki interval'in closure'ı bayatlamasın (her
  // render'da en güncel ttsEnabled/ctx ile güncellenir).
  promptScaleWeightRef.current = (weight) => {
    setOpen(true);
    addAssistantMessage(`${weight.toFixed(1)} kilo okundu. Kimden alıyorsun?`, () => {
      if (micEngine !== 'none') startListening();
    });
  };

  useEffect(() => {
    if (!scale.connected) {
      scaleWatchRef.current = { value: null, since: 0, prompted: null };
      return;
    }
    const iv = setInterval(() => {
      const v = scale.lastValue;
      const w = scaleWatchRef.current;
      // Boş/çok hafif tartı okumalarını (gürültü, henüz ürün konmamış) yok say.
      if (v == null || v < 0.5) {
        scaleWatchRef.current = { value: v, since: 0, prompted: w.prompted };
        return;
      }
      const now = Date.now();
      if (w.value == null || Math.abs(v - w.value) > 0.05) {
        // Değer hâlâ değişiyor (ürün konuyor/tartılıyor) — sabitlenmesini bekle.
        scaleWatchRef.current = { value: v, since: now, prompted: w.prompted };
        return;
      }
      const stableFor = now - w.since;
      if (stableFor >= 1200 && w.prompted !== v && !busyRef.current && !scalePromptActiveRef.current) {
        scaleWatchRef.current.prompted = v;
        scalePromptActiveRef.current = true;
        // Kullanıcı hiç cevap vermezse öneri döngüsü sonsuza dek kilitli
        // kalmasın diye bir süre sonra otomatik serbest bırakılır.
        setTimeout(() => { scalePromptActiveRef.current = false; }, 30000);
        promptScaleWeightRef.current(v);
      }
    }, 300);
    return () => clearInterval(iv);
  }, [scale.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const parseOne = async (text, ctx) => {
    // Bakiye/gecikme gibi veri sorularını her zaman önce gerçek kayıtlarla
    // yerelde cevaplarız. AI'ye (Groq) çiftçi/cari isimleri dışında hiçbir
    // alım/ödeme verisi gönderilmiyor; sorguyu AI'ye bırakmak, gerçek bir
    // hesaplama yerine uydurma bir cevap ("sorgulanıyor" gibi) almak demekti.
    const converted = turkishWordsToNumber(text);
    const localAnswer = parseQueryCommand(converted, ctx);
    if (localAnswer) return { ok: true, type: 'query', answer: localAnswer };

    let result = null;
    if (aiEnabled) {
      setThinking(true);
      result = await parseVoiceCommandAI(text, ctx);
      setThinking(false);
    }
    if (!result) result = parseVoiceCommandLocal(text, ctx);
    return result;
  };

  const reportResult = (result, ctx) => {
    if (result.ok && result.type === 'query') {
      setPending(null);
      setPendingBatch(null);
      setAmbiguity(null);
      setNewEntityPrompt(null);
      addAssistantMessage(`${result.viaAi ? '✨ ' : ''}${result.answer}`);
      return;
    }
    if (!result.ok && result.ambiguous) {
      setPending(null);
      setPendingBatch(null);
      setNewEntityPrompt(null);
      setAmbiguity(result);
      addAssistantMessage(result.message);
      return;
    }
    if (!result.ok && result.needsNewEntity) {
      setPending(null);
      setPendingBatch(null);
      setAmbiguity(null);
      setNewEntityPrompt(result);
      addAssistantMessage(result.message);
      return;
    }
    if (result.ok) {
      setAmbiguity(null);
      setPendingBatch(null);
      setNewEntityPrompt(null);
      setPending(result);
      // Dusuk guven uyarisi varsa, onay mesajinin basina eklenir (tek mesaj
      // olarak) — boylece TTS acik/kapali fark etmeksizin her zaman gorulur/duyulur.
      const warning = lowConfidenceWarningText(result);
      const confirmMsg = `${warning ? warning + ' ' : ''}${result.viaAi ? '✨ ' : ''}Anladığım: ${pendingConfirmText(result, ctx || buildCtx())}`;
      addAssistantMessage(confirmMsg);
    } else {
      setPending(null);
      setPendingBatch(null);
      setAmbiguity(null);
      setNewEntityPrompt(null);
      let msg = result.message || 'Anlayamadım, tekrar deneyin.';
      if (!aiEnabled && !hintShownRef.current) {
        msg += ' İpucu: Ayarlar\'dan ücretsiz bir Groq API anahtarı ekleyerek sesli komutları çok daha akıllı hale getirebilirsiniz.';
        hintShownRef.current = true;
      }
      addAssistantMessage(msg);
    }
  };

  // ---------- Zincirleme komut ----------
  // "Ahmet'ten 50 kilo al, 200 lira da avans ver" gibi cümleleri parçalayıp
  // her parçayı ayrı ayrı ayrıştırır; hepsi anlaşılırsa tek onayla toplu kaydeder.
  const handleChainedCommand = async (segments, ctx) => {
    const actionable = [];
    for (const seg of segments) {
      const r = await parseOne(seg, ctx);
      if (r.ok && r.type === 'query') {
        addAssistantMessage(`${r.viaAi ? '✨ ' : ''}${r.answer}`);
        continue;
      }
      if (!r.ok && r.ambiguous) {
        setPending(null);
        setPendingBatch(null);
        setNewEntityPrompt(null);
        setAmbiguity(r);
        addAssistantMessage(`"${seg}" için: ${r.message}`);
        return;
      }
      if (!r.ok && r.needsNewEntity) {
        setPending(null);
        setPendingBatch(null);
        setAmbiguity(null);
        setNewEntityPrompt(r);
        addAssistantMessage(`"${seg}" için: ${r.message}`);
        return;
      }
      if (!r.ok) {
        addAssistantMessage(`"${seg}" kısmını anlayamadım: ${r.message || 'tekrar deneyin.'}`);
        continue;
      }
      const warning = lowConfidenceWarningText(r);
      if (warning) addAssistantMessage(warning);
      actionable.push(r);
    }
    if (actionable.length === 0) return;
    if (actionable.length === 1) {
      reportResult(actionable[0], ctx);
      return;
    }
    setAmbiguity(null);
    setPending(null);
    setNewEntityPrompt(null);
    setPendingBatch(actionable);
    const highValueNote = actionable.some((r) => isHighValue(r, ctx)) ? ' Dikkat, içlerinde yüksek tutarlı işlem(ler) var.' : '';
    const summary = actionable.map((r, i) => `${i + 1}) ${pendingSummaryText(r)}`).join('  ');
    addAssistantMessage(`Anladığım: ${summary}${highValueNote} Hepsini kaydedeyim mi?`);
  };

  const handleCommand = async (text) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    // Kullanıcı herhangi bir şekilde cevap verdi; kantar tarafından açılmış
    // bekleyen bir öneri döngüsü varsa artık kapanabilir.
    scalePromptActiveRef.current = false;

    // ---------- Sesli geri alma ----------
    if (isUndoCommand(text)) {
      await undoLast();
      return;
    }

    // ---------- Sesli onay/iptal ----------
    // "Kaydedeyim mi?" sorusuna dokunmadan sadece "evet" ya da "hayır"
    // diyerek cevap verilebilsin — elleri tamamen serbest bırakır.
    if (pending || pendingBatch) {
      if (isConfirmCommand(text)) { await confirmSave(); return; }
      if (isCancelCommand(text)) { cancelPending(); return; }
    }

    // ---------- Yeni çiftçi/cari onayı ----------
    // "'Ali Veli' adında bir çiftçi bulamadım, yeni çiftçi olarak ekleyeyim
    // mi?" sorusuna sesle "evet"/"hayır" ile cevap verilebilsin diye.
    if (newEntityPrompt) {
      if (isConfirmCommand(text)) { await confirmNewEntity(); return; }
      if (isCancelCommand(text)) { cancelNewEntity(); return; }
    }

    // ---------- Bağlamsal düzeltme ----------
    // Onay bekleyen tek bir kayıt varken ("hayır 60 kilo" gibi) kısa bir
    // düzeltme algılanırsa, iptal edip yeniden söyletmek yerine doğrudan
    // o kaydın alanını günceller ve tekrar onay sorar.
    if (pending && !pendingBatch && shouldTryCorrection(text)) {
      const corrected = applyVoiceCorrection(text, pending, buildCtx());
      if (corrected) {
        setPending(corrected);
        addAssistantMessage(`Güncelledim: ${pendingSummaryText(corrected)} Kaydedeyim mi?`);
        return;
      }
    }

    // ---------- Takip komutları (bağlam hafızası) ----------
    // "Aynısından 30 kilo daha al", "ona 100 lira da avans ver" gibi bir
    // önceki işlemdeki kişiye/türe zamirle atıf yapan cümlelerde, o kişinin/
    // türün adını cümlenin önüne ekleyip normal ayrıştırma akışına sokarız.
    // Böylece isim çözümleme (fuzzy eşleştirme) ve kilo/fiyat çıkarımı gibi
    // tüm mevcut mantık aynen çalışır; kullanıcı sadece "ona"/"aynısından"
    // dediği için ayrı bir kod yolu yazmaya gerek kalmaz.
    let effectiveText = text;
    if (lastEntityRef.current && isFollowUpReference(text)) {
      const le = lastEntityRef.current;
      const name = (le.farmer && le.farmer.name) || (le.buyer && le.buyer.name) || '';
      if (name) {
        const hasOwnPrice = /\d+(?:[.,]\d+)?\s*(lira|tl|₺)/i.test(text);
        const parts = [name];
        if (le.varietyLabel) parts.push(le.varietyLabel);
        parts.push(text);
        if (!hasOwnPrice && le.price) parts.push(`${le.price} liradan`);
        effectiveText = parts.join(' ');
      }
    }

    const ctx = buildCtx();
    const segments = splitChainedCommands(effectiveText);
    if (segments.length > 1) {
      await handleChainedCommand(segments, ctx);
      return;
    }

    const result = await parseOne(effectiveText, ctx);
    reportResult(result);
  };

  // Belirsizlik durumunda kullanıcı adaylardan birine tıklayınca, o an
  // anlaşılmış olan diğer alanlarla (kg, fiyat, tutar vs.) birleştirip
  // normal onay akışına sokar.
  const resolveAmbiguity = (chosenEntity) => {
    if (!ambiguity) return;
    const p = ambiguity.partial || {};
    let result = null;
    if (ambiguity.commandKind === 'purchase') result = { ok: true, type: 'purchase', farmer: chosenEntity, kg: p.kg, price: p.price, varietyLabel: p.varietyLabel, vadeTarihi: p.vadeTarihi };
    if (ambiguity.commandKind === 'payment') result = { ok: true, type: 'payment', farmer: chosenEntity, amount: p.amount, payType: p.payType };
    if (ambiguity.commandKind === 'sale') result = { ok: true, type: 'sale', buyer: chosenEntity, kg: p.kg, price: p.price, varietyLabel: p.varietyLabel, vadeTarihi: p.vadeTarihi };
    if (ambiguity.commandKind === 'collection') result = { ok: true, type: 'collection', buyer: chosenEntity, amount: p.amount };
    setAmbiguity(null);
    if (!result || (result.type === 'purchase' && (!result.kg || !result.price || !result.varietyLabel)) || (result.type === 'sale' && (!result.kg || !result.price))) {
      addAssistantMessage(`${chosenEntity.name} seçildi ama komutun geri kalanını tam anlayamadım, lütfen tekrar söyleyin.`);
      return;
    }
    setPending(result);
    addAssistantMessage(`Anladığım: ${pendingConfirmText(result, buildCtx())}`);
  };

  // Yeni çiftçi/cari ekleme onayı sesle/tıkla "evet" alınca: önce ilgili
  // listeye yeni kaydı ekler, sonra bekleyen işlemi (varsa) o kayıtla
  // tamamlayıp normal onay akışına sokar.
  const confirmNewEntity = async () => {
    if (!newEntityPrompt) return;
    const { entityKind, candidateName, commandKind, partial } = newEntityPrompt;
    setNewEntityPrompt(null);

    let entity;
    if (entityKind === 'farmer') {
      entity = { id: uid(), name: candidateName, phone: '', tcNo: '', address: '', bagkurStatus: false, createdAt: Date.now() };
      const next = [...farmers, entity];
      setFarmers(next);
      await storageSet('zk:farmers', next);
    } else {
      if (!setBuyers) {
        addAssistantMessage('Yeni cari ekleme özelliği bu ekranda henüz bağlı değil, lütfen cariyi elle ekleyin.');
        return;
      }
      entity = { id: uid(), name: candidateName, phone: '', address: '', createdAt: Date.now() };
      const next = [...(buyers || []), entity];
      setBuyers(next);
      await storageSet('zk:buyers', next);
    }

    const p = partial || {};
    let result = null;
    if (commandKind === 'purchase') result = { ok: true, type: 'purchase', farmer: entity, kg: p.kg, price: p.price, varietyLabel: p.varietyLabel, vadeTarihi: p.vadeTarihi };
    if (commandKind === 'payment') result = { ok: true, type: 'payment', farmer: entity, amount: p.amount, payType: p.payType };
    if (commandKind === 'sale') result = { ok: true, type: 'sale', buyer: entity, kg: p.kg, price: p.price, varietyLabel: p.varietyLabel, vadeTarihi: p.vadeTarihi };
    if (commandKind === 'collection') result = { ok: true, type: 'collection', buyer: entity, amount: p.amount };

    const incomplete = !result
      || (result.type === 'purchase' && (!result.kg || !result.price || !result.varietyLabel))
      || (result.type === 'sale' && (!result.kg || !result.price))
      || (result.type === 'payment' && !result.amount)
      || (result.type === 'collection' && !result.amount);
    if (incomplete) {
      addAssistantMessage(`${entity.name} ${entityKind === 'farmer' ? 'çiftçi' : 'cari'} olarak eklendi ✓ Şimdi işlemin geri kalanını (kilo/tutar vb.) tekrar söyler misiniz?`);
      return;
    }
    setPending(result);
    addAssistantMessage(`${entity.name} ${entityKind === 'farmer' ? 'çiftçi' : 'cari'} olarak eklendi ✓ Anladığım: ${pendingConfirmText(result, buildCtx())}`);
  };

  const cancelNewEntity = () => {
    setNewEntityPrompt(null);
    addAssistantMessage('Tamam, eklemedim.');
  };

  // Groq anahtarı varsa mikrofonu kendimiz kaydedip Whisper'a göndeririz;
  // kullanıcı konuşmayı bitirip ~1.4 sn sessiz kalınca kayıt otomatik durur
  // ve komut kendiliğinden gönderilir (elle "durdur"a basmaya gerek kalmaz).
  const startListening = async () => {
    // ---------- Barge-in ----------
    // Asistan cevabı seslendirirken kullanıcı mikrofona basarsa, konuşmanın
    // bitmesini beklemeden TTS'i hemen keseriz — aksi halde asistanın kendi
    // sesi mikrofonla çakışabilir.
    if (ttsSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (micEngine === 'groq') {
      setRecLevel(0);
      try {
        await recorder.start();
        setMicStage('recording');
        setListening(true);
        playStartBeep();
      } catch (e) {
        setListening(false);
        setMicStage('idle');
        if (e && e.name === 'NotAllowedError') {
          addAssistantMessage('Mikrofon izni verilmedi. Tarayıcı/site ayarlarından mikrofon erişimine izin verip tekrar deneyin.');
        } else if (e && e.name === 'NotFoundError') {
          addAssistantMessage('Bir mikrofon bulunamadı. Cihazınızda mikrofon olduğundan emin olun.');
        } else {
          addAssistantMessage('Mikrofona erişilemedi. Aşağıya yazarak devam edebilirsiniz.');
        }
      }
      return;
    }

    if (micEngine !== 'browser') {
      addAssistantMessage('Sesli komut için mikrofon erişimi olan bir tarayıcı gerekiyor. Aşağıya yazarak devam edebilirsiniz.');
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      handleCommand(text);
    };
    recognition.onerror = () => { setListening(false); playEndBeep(); };
    recognition.onend = () => { setListening(false); playEndBeep(); };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    playStartBeep();
  };

  const stopListening = async () => {
    if (recorder.recording) {
      setListening(false);
      playEndBeep();
      const blob = await recorder.stop();
      if (!blob) { setMicStage('idle'); return; }
      setMicStage('transcribing');
      const result = await transcribeAudioGroq(blob, groqApiKey, { retries: 1 });
      setMicStage('idle');
      if (result.ok && result.text) {
        handleCommand(result.text);
        return;
      }
      const reasonMsg = {
        auth: 'Groq API anahtarı geçersiz görünüyor. Ayarlar\'dan kontrol edin.',
        'rate-limit': 'Groq isteği çok sık yapıldı, birkaç saniye sonra tekrar deneyin.',
        timeout: 'Ses tanıma zaman aşımına uğradı, tekrar deneyin.',
        network: 'İnternet bağlantısı sorunu nedeniyle ses gönderilemedi.',
        empty: 'Bir şey duyamadım, tekrar dener misiniz?',
      }[result.reason] || 'Sesi anlayamadım, tekrar deneyin ya da yazın.';
      addAssistantMessage(reasonMsg);
      return;
    }
    recognitionRef.current?.stop();
    setListening(false);
  };

  const clampBubblePos = (x, y) => {
    const size = 56;
    const margin = 8;
    const maxX = window.innerWidth - size - margin;
    const maxY = window.innerHeight - size - margin;
    return { x: Math.min(Math.max(margin, x), Math.max(margin, maxX)), y: Math.min(Math.max(margin, y), Math.max(margin, maxY)) };
  };

  const onBubblePointerDown = (e) => {
    dragStateRef.current = {
      dragging: true, moved: false,
      startX: e.clientX, startY: e.clientY,
      origX: bubblePos.x, origY: bubblePos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onBubblePointerMove = (e) => {
    const ds = dragStateRef.current;
    if (!ds.dragging) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) ds.moved = true;
    if (ds.moved) setBubblePos(clampBubblePos(ds.origX + dx, ds.origY + dy));
  };

  const onBubblePointerUp = () => {
    const wasMoved = dragStateRef.current.moved;
    dragStateRef.current.dragging = false;
    dragStateRef.current.moved = false;
    if (wasMoved) return;
    if (open) {
      if (listening) stopListening();
      setOpen(false);
    } else {
      setOpen(true);
      startListening();
    }
  };

  // Tek bir kaydı (alım, satış, ödeme, ...) ilgili tabloya yazar ve sesli
  // geri alma için son kaydedilen kaydı hatırlar.
  const saveOne = async (item) => {
    if (item.type === 'purchase') {
      const amount = item.kg * item.price;
      const record = {
        id: uid(), makbuzNo: nextReceiptNo(purchases, settings.purchaseReceiptNext), farmerId: item.farmer.id,
        date: todayStr(), time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        personnelId: null, personnelName: '', vehicleId: null, vehiclePlaka: '',
        items: [{ id: uid(), grade: item.varietyLabel, kg: item.kg, pricePerKg: item.price, amount }],
        netKg: item.kg, noDeduction: true,
        commissionRate: 0, commissionAmount: 0, borsaTescilli: false, stopajOrani: 0, stopajTutari: 0,
        applyBagkur: false, bagkurRate: 0, bagkurTutari: 0,
        amount, netPayment: amount, note: 'Sesli komutla eklendi', vadeTarihi: item.vadeTarihi || null, createdAt: Date.now(),
      };
      const next = [...purchases, record];
      setPurchases(next);
      await storageSet('zk:purchases', next);
      lastSavedRef.current = { type: 'purchase', id: record.id };
      lastEntityRef.current = { farmer: item.farmer, varietyLabel: item.varietyLabel, price: item.price };
      addAssistantMessage(`Kaydedildi ✓ (Makbuz #${record.makbuzNo})`);
      return;
    }

    if (item.type === 'add_farmer') {
      const record = { id: uid(), name: item.name, phone: item.phone || '', tcNo: '', address: '', bagkurStatus: false, createdAt: Date.now() };
      const next = [...farmers, record];
      setFarmers(next);
      await storageSet('zk:farmers', next);
      lastSavedRef.current = { type: 'add_farmer', id: record.id };
      addAssistantMessage(`${item.name} çiftçi olarak eklendi ✓`);
      return;
    }

    if (item.type === 'payment') {
      const record = { id: uid(), farmerId: item.farmer.id, date: todayStr(), amount: item.amount, note: 'Sesli komutla eklendi', payType: item.payType, createdAt: Date.now() };
      const next = [...payments, record];
      setPayments(next);
      await storageSet('zk:payments', next);
      lastSavedRef.current = { type: 'payment', id: record.id };
      lastEntityRef.current = { ...(lastEntityRef.current || {}), farmer: item.farmer };
      addAssistantMessage(`${item.payType === 'avans' ? 'Avans' : 'Ödeme'} kaydedildi ✓`);
      return;
    }

    if (item.type === 'sale') {
      const amount = item.kg * item.price;
      const record = {
        id: uid(), makbuzNo: nextReceiptNo(sales || [], settings?.salesReceiptNext), buyerId: item.buyer.id,
        date: todayStr(), grade: item.varietyLabel || '', kg: item.kg, pricePerKg: item.price, amount,
        note: 'Sesli komutla eklendi', vehicleId: null, vehiclePlaka: '', paymentMethod: 'nakit', bankAccountId: null,
        vadeTarihi: item.vadeTarihi || null, createdAt: Date.now(),
      };
      const next = [...(sales || []), record];
      setSales(next);
      await storageSet('zk:sales', next);
      lastSavedRef.current = { type: 'sale', id: record.id };
      lastEntityRef.current = { buyer: item.buyer, varietyLabel: item.varietyLabel, price: item.price };
      addAssistantMessage(`Satış kaydedildi ✓ (Makbuz #${record.makbuzNo})`);
      return;
    }

    if (item.type === 'collection') {
      const record = { id: uid(), buyerId: item.buyer.id, date: todayStr(), amount: item.amount, note: 'Sesli komutla eklendi', createdAt: Date.now() };
      const next = [...(buyerPayments || []), record];
      setBuyerPayments(next);
      await storageSet('zk:buyerPayments', next);
      lastSavedRef.current = { type: 'collection', id: record.id };
      lastEntityRef.current = { ...(lastEntityRef.current || {}), buyer: item.buyer };
      addAssistantMessage('Tahsilat kaydedildi ✓');
      return;
    }

    if (item.type === 'expense') {
      const record = { id: uid(), date: todayStr(), category: item.category, amount: item.amount, note: item.note, createdAt: Date.now() };
      const next = [...expenses, record];
      setExpenses(next);
      await storageSet('zk:expenses', next);
      lastSavedRef.current = { type: 'expense', id: record.id };
      addAssistantMessage('Gider kaydedildi ✓');
      return;
    }

    if (item.type === 'reminder') {
      const record = { id: uid(), title: item.title, date: item.date, note: '', done: false, createdAt: Date.now() };
      const next = [...reminders, record];
      setReminders(next);
      await storageSet('zk:reminders', next);
      lastSavedRef.current = { type: 'reminder', id: record.id };
      addAssistantMessage('Hatırlatma eklendi ✓');
    }
  };

  const confirmSave = async () => {
    scalePromptActiveRef.current = false;
    if (pendingBatch) {
      const items = pendingBatch;
      setPendingBatch(null);
      for (const item of items) {
        await saveOne(item);
      }
      return;
    }
    if (!pending) return;
    const item = pending;
    setPending(null);
    await saveOne(item);
  };

  const cancelPending = () => {
    scalePromptActiveRef.current = false;
    setPending(null);
    setPendingBatch(null);
    addAssistantMessage('İptal edildi.');
  };

  // ---------- Sesli geri alma ----------
  // En son sesli komutla kaydedilmiş işlemi ilgili tablodan siler.
  const undoLast = async () => {
    const last = lastSavedRef.current;
    if (!last) {
      addAssistantMessage('Geri alınacak bir sesli işlem bulamadım.');
      return;
    }
    const removeFrom = async (arr, setArr, storageKey) => {
      const next = (arr || []).filter((x) => x.id !== last.id);
      setArr(next);
      await storageSet(storageKey, next);
    };
    switch (last.type) {
      case 'purchase': await removeFrom(purchases, setPurchases, 'zk:purchases'); break;
      case 'add_farmer': await removeFrom(farmers, setFarmers, 'zk:farmers'); break;
      case 'payment': await removeFrom(payments, setPayments, 'zk:payments'); break;
      case 'sale': await removeFrom(sales, setSales, 'zk:sales'); break;
      case 'collection': await removeFrom(buyerPayments, setBuyerPayments, 'zk:buyerPayments'); break;
      case 'expense': await removeFrom(expenses, setExpenses, 'zk:expenses'); break;
      case 'reminder': await removeFrom(reminders, setReminders, 'zk:reminders'); break;
      default: break;
    }
    lastSavedRef.current = null;
    addAssistantMessage('Son sesli işlem geri alındı ✓');
  };

  const submitTyped = () => {
    handleCommand(typedText);
    setTypedText('');
  };

  return (
    <>
      <button
        onPointerDown={onBubblePointerDown}
        onPointerMove={onBubblePointerMove}
        onPointerUp={onBubblePointerUp}
        style={{
          position: 'fixed', left: bubblePos.x, top: bubblePos.y, zIndex: 150,
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: listening ? COLORS.red : COLORS.olive, color: '#fff', cursor: 'grab',
          boxShadow: listening
            ? `0 0 0 ${6 + Math.round(recLevel * 16)}px rgba(196,74,58,${Math.max(0.1, 0.22 - recLevel * 0.08)}), 0 4px 16px rgba(43,42,37,0.35)`
            : '0 4px 16px rgba(43,42,37,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          touchAction: 'none', userSelect: 'none', transition: 'background 0.15s, box-shadow 0.08s',
        }}
        aria-label="Sesli asistan"
        title={micStage === 'transcribing' ? 'Ses işleniyor...' : (listening ? 'Dinliyorum...' : 'Sesli asistan')}
      >
        {open ? <X size={22} /> : <Mic size={24} />}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          left: Math.min(bubblePos.x, window.innerWidth - 340 - 8),
          top: bubblePos.y > window.innerHeight / 2 ? bubblePos.y - 490 : bubblePos.y + 66,
          zIndex: 150,
          width: 340, maxWidth: 'calc(100vw - 40px)', maxHeight: '65vh',
          background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ background: COLORS.olive, color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mic size={16} />
            <div style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>Sesli Asistan</div>
            {aiEnabled && <span style={{ fontSize: 9.5, background: 'rgba(255,255,255,0.18)', padding: '2px 7px', borderRadius: 10 }}>AI</span>}
            {micEngine === 'groq' && <span title="Sesli komutlar Groq Whisper ile tanınıyor" style={{ fontSize: 9.5, background: 'rgba(255,255,255,0.18)', padding: '2px 7px', borderRadius: 10 }}>🎙️ Groq</span>}
            {scale.serialSupported && (
              <button
                onClick={() => (scale.connected ? scale.disconnect() : scale.connect())}
                title={scale.connected ? `Kantar bağlı: ${scale.lastValue != null ? scale.lastValue.toFixed(1) + ' kg' : '—'}` : 'Kantara bağlan'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, background: scale.connected ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
                  border: 'none', borderRadius: 10, color: '#fff', fontSize: 10.5, padding: '3px 7px', cursor: 'pointer',
                }}
              >
                <ScaleIcon size={12} />
                {scale.connected ? `${scale.lastValue != null ? scale.lastValue.toFixed(1) : '—'} kg` : 'Kantar'}
              </button>
            )}
            {ttsSupported && (
              <button
                onClick={toggleTts}
                title={ttsEnabled ? 'Sesli okumayı kapat' : 'Sesli okumayı aç'}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}
              >
                {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, background: COLORS.paper }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? COLORS.oliveSoft : '#fff',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10, padding: '8px 11px', fontSize: 12.5, maxWidth: '88%', lineHeight: 1.4,
              }}>
                {m.text}
              </div>
            ))}
            {micStage === 'transcribing' && (
              <div style={{ alignSelf: 'flex-start', fontSize: 11.5, color: COLORS.inkSoft, fontStyle: 'italic' }}>Ses yazıya dökülüyor...</div>
            )}
            {thinking && (
              <div style={{ alignSelf: 'flex-start', fontSize: 11.5, color: COLORS.inkSoft, fontStyle: 'italic' }}>Düşünüyor...</div>
            )}
            {ambiguity && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
                {ambiguity.candidates.map((c) => (
                  <button key={c.id} className="zk-btn zk-btn-secondary" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={() => resolveAmbiguity(c)}>{c.name}</button>
                ))}
                <button className="zk-btn zk-btn-secondary" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={() => setAmbiguity(null)}>Hiçbiri / İptal</button>
              </div>
            )}
            {newEntityPrompt && (
              <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
                <button className="zk-btn zk-btn-primary" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={confirmNewEntity}>
                  Evet, {newEntityPrompt.entityKind === 'farmer' ? 'çiftçi' : 'cari'} olarak ekle
                </button>
                <button className="zk-btn zk-btn-secondary" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={cancelNewEntity}>Hayır</button>
              </div>
            )}
            {(pending || pendingBatch) && (
              <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
                <button className="zk-btn zk-btn-primary" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={confirmSave}>Evet, kaydet</button>
                <button className="zk-btn zk-btn-secondary" style={{ fontSize: 11.5, padding: '6px 10px' }} onClick={cancelPending}>İptal</button>
              </div>
            )}
            <div ref={logEndRef} />
          </div>

          <div style={{ padding: 10, borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={listening ? stopListening : startListening}
              disabled={micStage === 'transcribing'}
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: listening ? COLORS.red : COLORS.gold, color: '#fff',
                cursor: micStage === 'transcribing' ? 'wait' : 'pointer',
                opacity: micStage === 'transcribing' ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: listening ? `0 0 0 ${3 + Math.round(recLevel * 8)}px rgba(196,74,58,${Math.max(0.12, 0.28 - recLevel * 0.1)})` : 'none',
                transition: 'box-shadow 0.08s',
              }}
              aria-label={listening ? 'Dinlemeyi durdur' : 'Konuşmaya başla'}
              title={micEngine === 'groq' ? 'Groq Whisper ile sesli komut' : (micEngine === 'browser' ? 'Tarayıcı sesli tanıma' : 'Sesli komut desteklenmiyor')}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <input
              className="zk-input"
              style={{ minHeight: 38, fontSize: 12.5, padding: '8px 10px' }}
              placeholder={micStage === 'transcribing' ? 'Ses işleniyor...' : (listening ? 'Dinliyorum... (susunca otomatik gönderilir)' : 'Ya da buraya yazın...')}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitTyped(); }}
            />
            <button
              onClick={submitTyped}
              style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0, background: COLORS.olive, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="Gönder"
            >
              <Send size={15} />
            </button>
          </div>
          {micEngine === 'none' && (
            <div style={{ fontSize: 10.5, color: COLORS.inkSoft, padding: '0 12px 10px', textAlign: 'center' }}>
              Sesli komut için mikrofon erişimine izin veren bir tarayıcı gerekir — burada yazarak da komut verebilirsiniz.
            </div>
          )}
          {micEngine === 'browser' && (
            <div style={{ fontSize: 10.5, color: COLORS.inkSoft, padding: '0 12px 10px', textAlign: 'center' }}>
              Daha doğru ve mobilde de çalışan sesli tanıma için Ayarlar'dan ücretsiz bir Groq API anahtarı ekleyebilirsiniz.
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------- Bildirim ve Hatırlatma Merkezi ----------
