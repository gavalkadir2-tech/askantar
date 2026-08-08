import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Send,
} from 'lucide-react';
import { nextReceiptNo, storageSet, todayStr, uid } from '../lib/format';
import { COLORS } from '../lib/theme';
import { parseVoiceCommandAI, parseVoiceCommandLocal, pendingSummaryText } from '../lib/voiceCommands';

export function VoiceAssistant({ farmers, setFarmers, priceList, purchases, setPurchases, payments, setPayments, expenses, setExpenses, reminders, setReminders, settings }) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Merhaba! Alım, çiftçi ekleme, ödeme/avans, gider ve hatırlatma gibi işlemleri sesli veya yazarak yapabilirsiniz. Örnek: "Mehmet\'ten 50 kilo Tirilye 1 numara 100 liradan al" ya da "Ahmet\'e 500 lira avans ver".' },
  ]);
  const [pending, setPending] = useState(null);
  const [typedText, setTypedText] = useState('');
  const recognitionRef = useRef(null);
  const logEndRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, moved: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const [bubblePos, setBubblePos] = useState(() => {
    if (typeof window !== 'undefined') return { x: window.innerWidth - 76, y: window.innerHeight - 86 };
    return { x: 300, y: 300 };
  });

  const speechSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const aiEnabled = !!(settings && (settings.aiVoiceEnabled || settings.groqApiKey));

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleCommand = async (text) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    const ctx = { farmers, priceList, settings };

    let result = null;
    if (aiEnabled) {
      setThinking(true);
      result = await parseVoiceCommandAI(text, ctx);
      setThinking(false);
    }
    if (!result) result = parseVoiceCommandLocal(text, ctx);

    if (result.ok) {
      setPending(result);
      setMessages((m) => [...m, { role: 'assistant', text: `${result.viaAi ? '✨ ' : ''}Anladığım: ${pendingSummaryText(result)} Kaydedeyim mi?` }]);
    } else {
      setPending(null);
      setMessages((m) => [...m, { role: 'assistant', text: result.message || 'Anlayamadım, tekrar deneyin.' }]);
    }
  };

  const startListening = () => {
    if (!speechSupported) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Tarayıcınız sesli komutu desteklemiyor. Masaüstü Chrome veya Edge kullanın, ya da aşağıya yazabilirsiniz.' }]);
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

  const confirmSave = async () => {
    if (!pending) return;

    if (pending.type === 'purchase') {
      const amount = pending.kg * pending.price;
      const record = {
        id: uid(), makbuzNo: nextReceiptNo(purchases, settings.purchaseReceiptNext), farmerId: pending.farmer.id,
        date: todayStr(), time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        personnelId: null, personnelName: '', vehicleId: null, vehiclePlaka: '',
        items: [{ id: uid(), grade: pending.varietyLabel, kg: pending.kg, pricePerKg: pending.price, amount }],
        netKg: pending.kg, noDeduction: true,
        commissionRate: 0, commissionAmount: 0, borsaTescilli: false, stopajOrani: 0, stopajTutari: 0,
        applyBagkur: false, bagkurRate: 0, bagkurTutari: 0,
        amount, netPayment: amount, note: 'Sesli komutla eklendi', createdAt: Date.now(),
      };
      const next = [...purchases, record];
      setPurchases(next);
      await storageSet('zk:purchases', next);
      setMessages((m) => [...m, { role: 'assistant', text: `Kaydedildi ✓ (Makbuz #${record.makbuzNo})` }]);
    }

    if (pending.type === 'add_farmer') {
      const record = { id: uid(), name: pending.name, phone: pending.phone || '', tcNo: '', address: '', bagkurStatus: false, createdAt: Date.now() };
      const next = [...farmers, record];
      setFarmers(next);
      await storageSet('zk:farmers', next);
      setMessages((m) => [...m, { role: 'assistant', text: `${pending.name} çiftçi olarak eklendi ✓` }]);
    }

    if (pending.type === 'payment') {
      const record = { id: uid(), farmerId: pending.farmer.id, date: todayStr(), amount: pending.amount, note: 'Sesli komutla eklendi', payType: pending.payType, createdAt: Date.now() };
      const next = [...payments, record];
      setPayments(next);
      await storageSet('zk:payments', next);
      setMessages((m) => [...m, { role: 'assistant', text: `${pending.payType === 'avans' ? 'Avans' : 'Ödeme'} kaydedildi ✓` }]);
    }

    if (pending.type === 'expense') {
      const record = { id: uid(), date: todayStr(), category: pending.category, amount: pending.amount, note: pending.note, createdAt: Date.now() };
      const next = [...expenses, record];
      setExpenses(next);
      await storageSet('zk:expenses', next);
      setMessages((m) => [...m, { role: 'assistant', text: 'Gider kaydedildi ✓' }]);
    }

    if (pending.type === 'reminder') {
      const record = { id: uid(), title: pending.title, date: pending.date, note: '', done: false, createdAt: Date.now() };
      const next = [...reminders, record];
      setReminders(next);
      await storageSet('zk:reminders', next);
      setMessages((m) => [...m, { role: 'assistant', text: 'Hatırlatma eklendi ✓' }]);
    }

    setPending(null);
  };

  const cancelPending = () => {
    setPending(null);
    setMessages((m) => [...m, { role: 'assistant', text: 'İptal edildi.' }]);
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
            {pending && (
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
