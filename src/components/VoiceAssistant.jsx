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
  isUndoCommand,
  parseQueryCommand,
  parseVoiceCommandAI,
  parseVoiceCommandLocal,
  pendingSummaryText,
  shouldTryCorrection,
  splitChainedCommands,
  turkishWordsToNumber,
} from '../lib/voiceCommands';
import { useScaleConnection } from '../hooks/useScaleConnection';

export function VoiceAssistant({ farmers, setFarmers, priceList, purchases, setPurchases, payments, setPayments, expenses, setExpenses, reminders, setReminders, settings, buyers, sales, setSales, buyerPayments, setBuyerPayments }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Merhaba! Alım, satış, çiftçi ekleme, ödeme/avans, tahsilat, gider ve hatırlatma gibi işlemleri sesli veya yazarak yapabilirsiniz. Bakiye de sorabilirsiniz. Örnek: "Mehmet\'ten 50 kilo Tirilye 100 liradan al", "Ayşe\'ye 200 kilo 120 liradan sat", "Ahmet\'in bakiyesi ne kadar?". Tek cümlede iki işlem de yapabilirsiniz: "Ahmet\'ten 50 kilo al, 200 lira da avans ver". Bir kayıt onay beklerken "hayır 60 kilo" derseniz düzeltirim; "son işlemi iptal et" derseniz geri alırım.' },
  ]);
  const [pending, setPending] = useState(null);
  const [pendingBatch, setPendingBatch] = useState(null);
  const [ambiguity, setAmbiguity] = useState(null);
  const [typedText, setTypedText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('zk:voiceTts') !== '0'; } catch (e) { return true; }
  });
  const recognitionRef = useRef(null);
  const logEndRef = useRef(null);
  const hintShownRef = useRef(false);
  const lastSavedRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [bubblePos, setBubblePos] = useState(() => {
    if (typeof window !== 'undefined') return { x: window.innerWidth - 76, y: window.innerHeight - 86 };
    return { x: 300, y: 300 };
  });

  const scale = useScaleConnection();
  const speechSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsSupported = typeof window !== 'undefined' && !!window.speechSynthesis;
  const aiEnabled = !!(settings && (settings.aiVoiceEnabled || settings.groqApiKey));

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // ---------- Sesli geri okuma (TTS) ----------
  // Asistan cevabini sesli de okur, boylece eller kirliyken/tartida iken
  // ekrana bakmaya gerek kalmaz. Her yeni cevaptan once oncekini keser.
  const speak = (text) => {
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
      window.speechSynthesis.speak(utter);
    } catch (e) { /* sessizce yut, ekran metni zaten gosteriliyor */ }
  };

  const toggleTts = () => {
    setTtsEnabled((v) => {
      const next = !v;
      try { localStorage.setItem('zk:voiceTts', next ? '1' : '0'); } catch (e) {}
      if (!next && ttsSupported) window.speechSynthesis.cancel();
      return next;
    });
  };

  const addAssistantMessage = (text) => {
    setMessages((m) => [...m, { role: 'assistant', text }]);
    speak(text);
  };

  // ---------- Kantar entegrasyonu ----------
  const scaleWeight = scale.connected && scale.lastValue != null ? scale.lastValue : null;

  const buildCtx = () => ({
    farmers, priceList, settings, buyers: buyers || [], purchases, payments,
    sales: sales || [], buyerPayments: buyerPayments || [], scaleKg: scaleWeight,
  });

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

  const reportResult = (result) => {
    if (result.ok && result.type === 'query') {
      setPending(null);
      setPendingBatch(null);
      setAmbiguity(null);
      addAssistantMessage(`${result.viaAi ? '✨ ' : ''}${result.answer}`);
      return;
    }
    if (!result.ok && result.ambiguous) {
      setPending(null);
      setPendingBatch(null);
      setAmbiguity(result);
      addAssistantMessage(result.message);
      return;
    }
    if (result.ok) {
      setAmbiguity(null);
      setPendingBatch(null);
      setPending(result);
      addAssistantMessage(`${result.viaAi ? '✨ ' : ''}Anladığım: ${pendingSummaryText(result)} Kaydedeyim mi?`);
    } else {
      setPending(null);
      setPendingBatch(null);
      setAmbiguity(null);
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
        setAmbiguity(r);
        addAssistantMessage(`"${seg}" için: ${r.message}`);
        return;
      }
      if (!r.ok) {
        addAssistantMessage(`"${seg}" kısmını anlayamadım: ${r.message || 'tekrar deneyin.'}`);
        continue;
      }
      actionable.push(r);
    }
    if (actionable.length === 0) return;
    if (actionable.length === 1) {
      reportResult(actionable[0]);
      return;
    }
    setAmbiguity(null);
    setPending(null);
    setPendingBatch(actionable);
    const summary = actionable.map((r, i) => `${i + 1}) ${pendingSummaryText(r)}`).join('  ');
    addAssistantMessage(`Anladığım: ${summary}  Hepsini kaydedeyim mi?`);
  };

  const handleCommand = async (text) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: 'user', text }]);

    // ---------- Sesli geri alma ----------
    if (isUndoCommand(text)) {
      await undoLast();
      return;
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

    const ctx = buildCtx();
    const segments = splitChainedCommands(text);
    if (segments.length > 1) {
      await handleChainedCommand(segments, ctx);
      return;
    }

    const result = await parseOne(text, ctx);
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
    addAssistantMessage(`Anladığım: ${pendingSummaryText(result)} Kaydedeyim mi?`);
  };

  const startListening = () => {
    if (!speechSupported) {
      addAssistantMessage('Tarayıcınız sesli komutu desteklemiyor. Masaüstü Chrome veya Edge kullanın, ya da aşağıya yazabilirsiniz.');
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
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
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
      addAssistantMessage(`Satış kaydedildi ✓ (Makbuz #${record.makbuzNo})`);
      return;
    }

    if (item.type === 'collection') {
      const record = { id: uid(), buyerId: item.buyer.id, date: todayStr(), amount: item.amount, note: 'Sesli komutla eklendi', createdAt: Date.now() };
      const next = [...(buyerPayments || []), record];
      setBuyerPayments(next);
      await storageSet('zk:buyerPayments', next);
      lastSavedRef.current = { type: 'collection', id: record.id };
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
          boxShadow: listening ? '0 0 0 6px rgba(196,74,58,0.18), 0 4px 16px rgba(43,42,37,0.35)' : '0 4px 16px rgba(43,42,37,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          touchAction: 'none', userSelect: 'none', transition: 'background 0.15s, box-shadow 0.15s',
        }}
        aria-label="Sesli asistan"
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
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: listening ? COLORS.red : COLORS.gold, color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              aria-label={listening ? 'Dinlemeyi durdur' : 'Konuşmaya başla'}
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <input
              className="zk-input"
              style={{ minHeight: 38, fontSize: 12.5, padding: '8px 10px' }}
              placeholder={listening ? 'Dinliyorum...' : 'Ya da buraya yazın...'}
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
          {!speechSupported && (
            <div style={{ fontSize: 10.5, color: COLORS.inkSoft, padding: '0 12px 10px', textAlign: 'center' }}>
              Sesli komut için masaüstü Chrome/Edge gerekir — burada yazarak da komut verebilirsiniz.
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ---------- Bildirim ve Hatırlatma Merkezi ----------
