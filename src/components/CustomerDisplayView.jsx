import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { supabase } from '../supabaseClient.js';
import { fmtKg } from '../lib/format';

export function CustomerDisplayView({ businessName, logo, channelId }) {
  const [live, setLive] = useState(null);
  const [doneFlash, setDoneFlash] = useState(null);
  const [clock, setClock] = useState(new Date());
  const doneTimeoutRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleMsg = (msg) => {
    if (!msg) return;
    if (doneTimeoutRef.current) { clearTimeout(doneTimeoutRef.current); doneTimeoutRef.current = null; }
    if (msg.type === 'purchase_done' || msg.type === 'sale_done') {
      setDoneFlash(msg);
      setLive(null);
      doneTimeoutRef.current = setTimeout(() => { setDoneFlash(null); doneTimeoutRef.current = null; }, 30000);
    } else {
      // Yeni bir çiftçi/alıcı için canlı tartım başladıysa, 30 saniyeyi beklemeden
      // "işlem tamamlandı" ekranını hemen kapatıp yeni işleme geç.
      setDoneFlash(null);
      setLive(msg);
    }
  };

  // Ayni cihaz / ayni tarayici oturumu (kablo ile TV'ye baglanti, ekran yansitma).
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('zk-customer-display' + (channelId ? '-' + channelId : ''));
    ch.onmessage = (e) => handleMsg(e.data);
    return () => ch.close();
  }, [channelId]);

  // Aginda bagimsiz/uzak cihaz (akilli TV, farkli tarayici) - Supabase Realtime uzerinden.
  useEffect(() => {
    if (typeof supabase === 'undefined' || !channelId) return;
    const ch = supabase.channel(`zk-display-${channelId}`);
    ch.on('broadcast', { event: 'update' }, (payload) => handleMsg(payload.payload)).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [channelId]);

  // Sag taraftaki "tartilan kasalar" listesi buyudukce, sayfa kaymasi/tasmasi
  // olmadan ekrana sigmasi icin yazi boyutunu kademeli olarak kucultuyoruz.
  const RIGHT_MAX_VW = 2.6;
  const RIGHT_MIN_VW = 0.9;
  const rightContainerRef = useRef(null);
  const rightContentRef = useRef(null);
  const [rightFontVw, setRightFontVw] = useState(RIGHT_MAX_VW);
  const itemsKey = live ? live.items.map((it) => `${it.grade}-${it.kg}-${it.crateCount || 0}`).join('|') : '';

  useLayoutEffect(() => {
    setRightFontVw(RIGHT_MAX_VW);
  }, [itemsKey]);

  useLayoutEffect(() => {
    const container = rightContainerRef.current;
    const content = rightContentRef.current;
    if (!container || !content) return;
    if (content.scrollHeight > container.clientHeight && rightFontVw > RIGHT_MIN_VW) {
      setRightFontVw((v) => Math.max(RIGHT_MIN_VW, +(v - 0.1).toFixed(2)));
    }
  }, [rightFontVw, itemsKey]);

  const rootStyle = {
    height: '100vh', width: '100%', background: '#1C1B17', color: '#F7F3E8',
    fontFamily: "'Fraunces', Georgia, serif", boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  };
  const headerStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '2vh 4vw', borderBottom: '1px solid #3A3831', flexShrink: 0,
  };

  const groupByGrade = (items) => {
    const groups = {};
    const order = [];
    (items || []).forEach((it) => {
      if (!groups[it.grade]) { groups[it.grade] = { kg: 0, count: 0, crates: 0 }; order.push(it.grade); }
      groups[it.grade].kg += it.kg;
      groups[it.grade].count += 1;
      groups[it.grade].crates += it.crateCount || 0;
    });
    return order.map((g) => ({ grade: g, ...groups[g] }));
  };

  const Header = () => (
    <div style={headerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2vw' }}>
        {logo && <img src={logo} alt="Logo" style={{ maxHeight: '5vh' }} />}
        <div style={{ fontSize: '2.4vw', fontWeight: 600 }}>{businessName || 'Zeytin Komisyonculuğu'}</div>
      </div>
      <div style={{ fontSize: '2.2vw', color: '#D8D2C0', fontVariantNumeric: 'tabular-nums' }}>
        {clock.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} · {clock.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );

  if (doneFlash) {
    const doneGroups = groupByGrade(doneFlash.items);
    return (
      <div style={rootStyle}>
        <Header />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2vh 6vw', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ fontSize: '7vw', color: '#7FB27A', marginBottom: '1vh', flexShrink: 0 }}>✓</div>
          <div style={{ fontSize: '4.4vw', fontWeight: 700, marginBottom: '2vh', flexShrink: 0 }}>{doneFlash.partyName || ' '}</div>
          {doneGroups.length > 0 && (
            <div style={{ marginBottom: '2vh', width: '100%', maxWidth: '60vw', overflowY: 'auto', flex: '0 1 auto' }}>
              {doneGroups.map((g) => (
                <div key={g.grade} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2vw', fontSize: '2.6vw', padding: '0.8vh 0', borderBottom: '1px solid #3A3831' }}>
                  <span style={{ fontWeight: 700, minWidth: '10vw', textAlign: 'right' }}>{fmtKg(g.kg)}</span>
                  <span style={{ color: '#D8D2C0', textAlign: 'left', flex: 1 }}>{g.grade}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5vw', flexShrink: 0 }}>
            <div style={{ fontSize: '2.2vw', color: '#B8B2A0' }}>Toplam</div>
            <div style={{ fontSize: '6vw', color: '#C9A24B', fontWeight: 700 }}>{fmtKg(doneFlash.netKg)}</div>
          </div>
          <div style={{ fontSize: '2vw', marginTop: '2vh', color: '#B8B2A0', flexShrink: 0 }}>İşlem tamamlandı, teşekkür ederiz</div>
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div style={rootStyle}>
        <Header />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {logo && <img src={logo} alt="Logo" style={{ maxWidth: '12vw', marginBottom: '3vh', opacity: 0.85 }} />}
          <div style={{ fontSize: '2.4vw', color: '#B8B2A0' }}>Tartım bekleniyor...</div>
        </div>
      </div>
    );
  }

  const cl = live.currentLine;
  const hasCurrentLine = cl && (cl.grade || cl.kg > 0);
  const gradeTotals = groupByGrade(live.items);

  return (
    <div style={rootStyle}>
      <Header />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sol: canli tartim + taraf bilgisi + en altta genel toplam */}
        <div style={{ flex: '1.1 1 0', display: 'flex', flexDirection: 'column', padding: '2vh 2.5vw', borderRight: '1px solid #3A3831', minWidth: 0, minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 0 }}>
            <div style={{ fontSize: '3.6vw', fontWeight: 700, marginBottom: '2vh' }}>{live.partyName || '—'}</div>

            {hasCurrentLine ? (
              <>
                <div style={{ fontSize: '13vw', fontWeight: 700, lineHeight: 1 }}>{fmtKg(cl.kg)}</div>
                <div style={{ fontSize: '3vw', fontWeight: 700, color: '#C9A24B', marginTop: '1.5vh' }}>{cl.grade || 'Tartılıyor'}</div>
                {(live.randiman != null || live.asit != null || live.nem != null) && (
                  <div style={{ display: 'flex', gap: '2.5vw', marginTop: '2.5vh', fontSize: '1.6vw', color: '#B8B2A0' }}>
                    {live.randiman != null && <span>Randıman %{live.randiman}</span>}
                    {live.asit != null && <span>Asit %{live.asit}</span>}
                    {live.nem != null && <span>Nem %{live.nem}</span>}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '2.4vw', color: '#B8B2A0' }}>Sonraki tartım bekleniyor...</div>
            )}
          </div>

          {live.items.length > 0 && (
            <div style={{ textAlign: 'center', borderTop: '2px solid #3A3831', paddingTop: '2vh', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '1.5vw' }}>
                <div style={{ fontSize: '2.2vw', color: '#B8B2A0' }}>Toplam</div>
                <div style={{ fontSize: '5.5vw', fontWeight: 700, color: '#C9A24B' }}>{fmtKg(live.netKg)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Sag: sinif/numara bazinda ozet - her satirda tartim sayisi, kasa toplami, kg toplami.
            6-7 satira gore tasarlandi, daha fazlasi olursa yazi otomatik kuculur. */}
        <div style={{ flex: '0.9 1 0', display: 'flex', flexDirection: 'column', padding: '2vh 2.5vw', minHeight: 0, minWidth: 0 }}>
          <div style={{ fontSize: '1.8vw', color: '#B8B2A0', marginBottom: '1.5vh', flexShrink: 0 }}>Sınıf / numara özeti</div>
          <div ref={rightContainerRef} style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <div ref={rightContentRef}>
              {gradeTotals.length === 0 ? (
                <div style={{ fontSize: '1.8vw', color: '#6E6A5E' }}>Henüz kasa eklenmedi.</div>
              ) : (
                gradeTotals.map((g) => (
                  <div key={g.grade} style={{ padding: `${rightFontVw * 0.45}vh 0`, borderBottom: '1px solid #2C2A24' }}>
                    <div style={{ fontSize: `${rightFontVw}vw`, color: '#D8D2C0', marginBottom: '0.2vh' }}>
                      {g.grade} · {g.count} tartım · {g.crates} kasa
                    </div>
                    <div style={{ fontSize: `${rightFontVw * 1.6}vw`, fontWeight: 700, color: '#C9A24B' }}>{fmtKg(g.kg)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
