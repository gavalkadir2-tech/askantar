import React, { useState, useCallback, useRef } from 'react';
import {
  Bluetooth,
  BluetoothConnected,
  X,
  ChevronRight,
  Repeat,
  CheckCircle2,
  ChevronLeft,
  ArrowUpDown,
  Tv,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { daysUntil } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function SortableTh({ label, sortKeyName, sortKey, sortDir, onSort, style }) {
  const active = sortKey === sortKeyName;
  return (
    <th
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      onClick={() => onSort(sortKeyName)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />}
      </span>
    </th>
  );
}

export function ListFooterControls({ sortOrder, setSortOrder, sortOptions, page, setPage, pageSize, setPageSize, totalPages, totalCount }) {
  if (totalCount === 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
      {sortOptions ? (
        <select className="zk-select" style={{ width: 'auto', minWidth: 150, minHeight: 34, padding: '5px 8px', fontSize: 12 }} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
          {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : <span />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {setPageSize && (
          <select className="zk-select" style={{ width: 'auto', minWidth: 90, minHeight: 34, padding: '5px 8px', fontSize: 12 }} value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value, 10))}>
            <option value={10}>10 / sayfa</option>
            <option value={20}>20 / sayfa</option>
            <option value={50}>50 / sayfa</option>
            <option value={100}>100 / sayfa</option>
          </select>
        )}
        <span style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{totalCount} kayıt · Sayfa {page}/{totalPages}</span>
        <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={14} /> Önceki</button>
        <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sonraki <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}
// UYARI: new Date().toISOString() HER ZAMAN UTC saatini döndürür. Türkiye gibi
// UTC'nin ilerisindeki saat dilimlerinde gece yarısından sonraki saatlerde
// (örn. UTC+3'te 00:00-03:00 arası) bu, tarihi bir gün GERİDEN gösteren ciddi
// bir hataya yol açar. Bunun yerine her zaman YEREL tarih bileşenlerini kullanıyoruz.

export function StatCard({ label, value, tone, icon: Icon }) {
  return (
    <div className="zk-stat">
      <div className="zk-stat-label">
        {Icon && <span className="zk-stat-icon" style={tone ? { background: tone + '1A', color: tone } : undefined}><Icon size={12} /></span>}
        {label}
      </div>
      <div className="zk-stat-value" style={{ color: tone || COLORS.ink }}>{value}</div>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="zk-modal-overlay" onClick={onClose}>
      <div className="zk-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8,}}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <button className="zk-close" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ScaleWidget({ onWeightCapture, compact }) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Bağlı değil');
  const [rawLines, setRawLines] = useState([]);
  const [lastValue, setLastValue] = useState(null);
  const [baud, setBaud] = useState(9600);
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const bufferRef = useRef('');

  const extractNumber = (line) => {
    const m = line.match(/-?\d+[.,]?\d*/);
    if (!m) return null;
    return parseFloat(m[0].replace(',', '.'));
  };

  const handleIncoming = useCallback((chunk) => {
    bufferRef.current += chunk;
    let idx;
    while ((idx = bufferRef.current.search(/[\r\n]/)) >= 0) {
      const line = bufferRef.current.slice(0, idx).trim();
      bufferRef.current = bufferRef.current.slice(idx + 1);
      if (!line) continue;
      setRawLines((prev) => [...prev.slice(-4), line]);
      const num = extractNumber(line);
      if (num !== null) setLastValue(num);
    }
  }, []);

  const readLoop = useCallback(async (port) => {
    const decoder = new TextDecoderStream();
    const closed = port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    readerRef.current = reader;
    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) handleIncoming(value);
      }
    } catch (e) {
      console.error(e);
    } finally {
      reader.releaseLock();
      await closed.catch(() => {});
    }
  }, [handleIncoming]);

  const connect = async () => {
    if (!('serial' in navigator)) {
      alert('Bu tarayıcı Web Serial API desteklemiyor. Masaüstü Chrome veya Edge kullanın.');
      return;
    }
    try {
      setStatus('Bağlanıyor...');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: baud });
      portRef.current = port;
      setConnected(true);
      setStatus('Bağlı');
      keepReadingRef.current = true;
      readLoop(port);
    } catch (e) {
      setStatus('Bağlanamadı');
    }
  };

  const disconnect = async () => {
    keepReadingRef.current = false;
    try {
      if (readerRef.current) await readerRef.current.cancel();
      if (portRef.current) await portRef.current.close();
    } catch (e) {}
    setConnected(false);
    setStatus('Bağlı değil');
    setLastValue(null);
  };

  if (compact) {
    return (
      <div className="zk-scalebox zk-scalebox-compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#B7C4B3', minWidth: 90 }}>
            {connected ? <BluetoothConnected size={15} /> : <Bluetooth size={15} />}
            {status}
          </div>

          <div className="zk-scale-readout" style={{ fontSize: 26 }}>{lastValue !== null ? lastValue.toFixed(1) : '—'}</div>

          {rawLines.length > 0 && (
            <div style={{ fontSize: 10, color: '#6A7A6A', fontFamily: 'Courier New, monospace', flex: 1, minWidth: 100 }}>
              {rawLines[rawLines.length - 1]}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!connected && (
              <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} style={{ background: '#2A3128', color: '#DCE2CC', border: '1px solid #3A4235', borderRadius: 6, fontSize: 11, padding: '6px 6px' }}>
                <option value={9600}>9600</option>
                <option value={4800}>4800</option>
                <option value={2400}>2400</option>
                <option value={1200}>1200</option>
                <option value={19200}>19200</option>
              </select>
            )}
            {!connected ? (
              <button className="zk-btn zk-btn-gold" onClick={connect}>Kantara bağlan</button>
            ) : (
              <>
                <button className="zk-btn zk-btn-secondary" onClick={disconnect} style={{ background: '#2A3128', color: '#DCE2CC', border: 'none' }}>Kes</button>
                <button className="zk-btn zk-btn-gold" disabled={lastValue === null} onClick={() => onWeightCapture(lastValue)}>
                  Bu değeri kullan
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zk-scalebox">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8,}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#B7C4B3' }}>
          {connected ? <BluetoothConnected size={15} /> : <Bluetooth size={15} />}
          {status}
        </div>
        {!connected && (
          <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} style={{ background: '#2A3128', color: '#DCE2CC', border: '1px solid #3A4235', borderRadius: 6, fontSize: 11, padding: '4px 6px' }}>
            <option value={9600}>9600</option>
            <option value={4800}>4800</option>
            <option value={2400}>2400</option>
            <option value={1200}>1200</option>
            <option value={19200}>19200</option>
          </select>
        )}
      </div>
      <div className="zk-scale-readout">{lastValue !== null ? lastValue.toFixed(1) : '—'}</div>
      {rawLines.length > 0 && (
        <div style={{ fontSize: 10, color: '#6A7A6A', marginTop: 6, fontFamily: 'Courier New, monospace' }}>
          {rawLines[rawLines.length - 1]}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {!connected ? (
          <button className="zk-btn zk-btn-gold" onClick={connect} style={{ flex: 1, justifyContent: 'center' }}>Kantara bağlan</button>
        ) : (
          <>
            <button className="zk-btn zk-btn-secondary" onClick={disconnect} style={{ flex: 1, justifyContent: 'center', background: '#2A3128', color: '#DCE2CC', border: 'none' }}>Kes</button>
            <button
              className="zk-btn zk-btn-gold"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={lastValue === null}
              onClick={() => onWeightCapture(lastValue)}
            >
              Bu değeri kullan
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function ExpiryBadge({ dateStr }) {
  const d = daysUntil(dateStr);
  if (d === null) return <span className="zk-badge" style={{ background: '#EEE', color: COLORS.inkSoft }}>Tarih yok</span>;
  if (d < 0) return <span className="zk-badge zk-badge-red">{Math.abs(d)} gün önce doldu</span>;
  if (d <= 30) return <span className="zk-badge zk-badge-gold">{d} gün kaldı</span>;
  return <span className="zk-badge zk-badge-olive">{d} gün kaldı</span>;
}

export function AiSectionShell({ title, subtitle, icon: Icon, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        {Icon && <Icon size={18} color={COLORS.gold} />}
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{title}</div>
      </div>
      {subtitle && <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 16 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

export function CustomerDisplayButtons({ openCustomerDisplay, customerDisplayUrl }) {
  const [copied, setCopied] = useState(false);
  if (!openCustomerDisplay) return null;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(customerDisplayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { /* pano erisimi yoksa sessizce gec */ }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <button className="zk-btn zk-btn-secondary" onClick={openCustomerDisplay}><Tv size={14} /> Müşteri ekranını aç</button>
      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={copyLink} title="Başka bir cihazda (akıllı TV, tablet) açmak için bağlantıyı kopyala">
        {copied ? <CheckCircle2 size={12} /> : <Repeat size={12} />} {copied ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
      </button>
    </div>
  );
}

export function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
      :root { --font-display: 'Fraunces', Georgia, serif; --font-body: 'Inter', -apple-system, 'Segoe UI', sans-serif; }
      .zk-app { font-family: var(--font-body); color: ${COLORS.ink}; background: ${COLORS.paper}; min-height: 100vh; }
      .zk-shell { display: flex; min-height: 100vh; }
      .zk-sidebar { width: 216px; background: ${COLORS.olive}; flex-shrink: 0; padding: 22px 12px; display: flex; flex-direction: column; gap: 3px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
      .zk-brand-row { display: flex; align-items: center; gap: 9px; padding: 0 10px; margin-bottom: 2px; }
      .zk-brand { color: #F5F2E8; font-family: var(--font-display); font-size: 19px; font-weight: 600; letter-spacing: 0.2px; }
      .zk-brand-sub { color: #A9B896; font-size: 10.5px; padding: 0 10px; margin-bottom: 24px; letter-spacing: 0.6px; text-transform: uppercase; }
      .zk-navbtn { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 8px; background: transparent; border: none; border-left: 2px solid transparent; color: #C9D2B9; font-size: 13px; font-weight: 500; cursor: pointer; text-align: left; width: 100%; transition: background 0.12s ease, color 0.12s ease; white-space: nowrap; overflow: hidden; }
      .zk-navbtn span, .zk-navbtn { text-overflow: ellipsis; }
      .zk-navbtn svg { flex-shrink: 0; }
      .zk-navgroup-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: #7C8A6C; padding: 14px 11px 4px; }
      .zk-sidebar-compact .zk-navbtn { padding: 6px 11px; font-size: 12px; gap: 8px; }
      .zk-sidebar-compact .zk-brand-sub { margin-bottom: 14px; }
      .zk-navbtn:hover { background: rgba(255,255,255,0.07); color: #F5F2E8; }
      .zk-navbtn.active { background: rgba(255,255,255,0.13); color: #fff; border-left: 2px solid ${COLORS.gold}; }
      .zk-main { flex: 1; padding: 28px 32px; max-width: 1180px; min-width: 0; }
      .zk-topbar { display: none; }
      .zk-sidebar-overlay { display: none; }
      .zk-h1 { font-family: var(--font-display); font-size: 23px; font-weight: 600; margin-bottom: 3px; letter-spacing: 0.1px; }
      .zk-h1-sub { font-size: 12.5px; color: ${COLORS.inkSoft}; margin-bottom: 20px; }
      .zk-card { background: ${COLORS.paperCard}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 16px 18px; transition: box-shadow 0.15s ease, border-color 0.15s ease; overflow-x: auto; }
      .zk-grid { display: grid; gap: 12px; }
      .zk-grid > * { min-width: 0; }
      .zk-stat { background: ${COLORS.paperCard}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 14px 16px; transition: box-shadow 0.15s ease, transform 0.15s ease; }
      .zk-stat:hover { box-shadow: 0 4px 14px rgba(43,42,37,0.07); transform: translateY(-1px); }
      .zk-stat-label { font-size: 11px; color: ${COLORS.inkSoft}; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
      .zk-stat-icon { width: 22px; height: 22px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; background: ${COLORS.oliveSoft}; color: ${COLORS.olive}; }
      .zk-stat-value { font-family: var(--font-display); font-size: 22px; font-weight: 600; }
      .zk-input, .zk-select { width: 100%; min-width: 0; padding: 11px 12px; border-radius: 8px; border: 1px solid ${COLORS.border}; background: #FCFBF7; font-size: 16px; font-family: inherit; color: ${COLORS.ink}; min-height: 44px; }
      .zk-input:focus, .zk-select:focus { outline: none; border-color: ${COLORS.oliveLight}; box-shadow: 0 0 0 3px ${COLORS.oliveSoft}; }
      .zk-label { font-size: 12.5px; font-weight: 600; color: ${COLORS.inkSoft}; margin-bottom: 5px; display: block; }
      .zk-btn { display: inline-flex; align-items: center; gap: 6px; padding: 11px 16px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.12s ease, transform 0.08s ease, box-shadow 0.12s ease; min-height: 44px; }
      .zk-btn:active:not(:disabled) { transform: scale(0.97); }
      .zk-btn-primary { background: ${COLORS.olive}; color: #fff; }
      .zk-btn-primary:hover { background: #333c25; box-shadow: 0 2px 8px rgba(63,74,46,0.25); }
      .zk-btn-gold { background: ${COLORS.gold}; color: #fff; }
      .zk-btn-gold:hover { box-shadow: 0 2px 8px rgba(179,137,43,0.3); }
      .zk-btn-blue { background: ${COLORS.blue}; color: #fff; }
      .zk-btn-blue:hover { box-shadow: 0 2px 8px rgba(59,94,115,0.3); }
      .zk-btn-secondary { background: #fff; color: ${COLORS.ink}; border: 1px solid ${COLORS.border}; }
      .zk-btn-secondary:hover { background: #F7F5EE; }
      .zk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .zk-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .zk-table th { text-align: left; font-size: 11px; letter-spacing: 0.4px; color: ${COLORS.inkSoft}; padding: 9px 10px; border-bottom: 1px solid ${COLORS.border}; font-weight: 600; }
      .zk-table td { padding: 12px 10px; border-bottom: 1px solid #EFEBDD; }
      .zk-table tr { transition: background 0.1s ease; }
      .zk-table tr:hover td { background: #FAF8F1; }
      .zk-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
      .zk-badge-olive { background: ${COLORS.oliveSoft}; color: ${COLORS.olive}; }
      .zk-badge-gold { background: ${COLORS.goldSoft}; color: ${COLORS.gold}; }
      .zk-badge-red { background: ${COLORS.redSoft}; color: ${COLORS.red}; }
      .zk-badge-blue { background: ${COLORS.blueSoft}; color: ${COLORS.blue}; }
      .zk-scalebox { background: #1C2226; border-radius: 12px; padding: 15px 16px; color: #fff; }
      .zk-scale-readout { font-family: 'Courier New', monospace; font-size: 30px; font-weight: 700; color: #7FDB8F; }
      .zk-modal-overlay { position: fixed; inset: 0; background: rgba(20,20,15,0.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
      .zk-modal { background: #fff; border-radius: 14px; padding: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
      .zk-close { background: none; border: none; cursor: pointer; color: ${COLORS.inkSoft}; padding: 8px; min-height: 40px; min-width: 40px; }
      .zk-empty { text-align: center; padding: 36px 20px; color: ${COLORS.inkSoft}; font-size: 13px; }
      .zk-farmer-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; row-gap: 8px; padding: 14px 13px; border-radius: 10px; cursor: pointer; border: 1px solid transparent; transition: background 0.12s ease, border-color 0.12s ease; min-height: 44px; }
      .zk-farmer-row > * { min-width: 0; }
      .zk-farmer-row:hover { background: #FAF8F1; border-color: ${COLORS.border}; }
      .zk-avatar { width: 34px; height: 34px; border-radius: 50%; background: ${COLORS.oliveSoft}; color: ${COLORS.olive}; display: inline-flex; align-items: center; justify-content: center; font-size: 12.5px; font-weight: 700; font-family: var(--font-display); flex-shrink: 0; }
      .zk-tag { font-size: 10.5px; padding: 2px 8px; border-radius: 5px; background: ${COLORS.oliveSoft}; color: ${COLORS.olive}; font-weight: 600; }
      .zk-checkbox-row { display: flex; align-items: center; gap: 9px; font-size: 13.5px; min-height: 30px; }
      .zk-checkbox-row input[type="checkbox"] { width: 19px; height: 19px; accent-color: ${COLORS.olive}; flex-shrink: 0; }
      .zk-empty-icon { color: ${COLORS.border}; margin-bottom: 8px; }
      #zk-print-area { display: none; }
      @media print {
        @page { size: 80mm auto; margin: 3mm; }
        body * { visibility: hidden; }
        #zk-print-area, #zk-print-area * { visibility: visible; }
        #zk-print-area { display: block; position: absolute; top: 0; left: 0; width: 100%; }
      }

      /* Tablet: sidebar sabit kalır, sadece içerik alanı biraz daralır.
         Sidebar (190px) içerik alanını yediği için iki sütunlu formlar
         burada da tek sütuna insin — yoksa 768-1024px aralığında sıkışıyor. */
      @media (max-width: 1024px) {
        .zk-sidebar { width: 190px; }
        .zk-main { padding: 22px 20px; }
        .zk-grid[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
      }

      /* Telefon: sidebar gizli çekmeceye döner, üstte hamburger bar açar */
      @media (max-width: 768px) {
        .zk-topbar {
          display: flex; align-items: center; gap: 12px; padding: 12px 16px;
          background: ${COLORS.olive}; position: sticky; top: 0; z-index: 60;
        }
        .zk-topbar-btn { background: rgba(255,255,255,0.1); border: none; border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; flex-shrink: 0; }
        .zk-topbar-brand { color: #F5F2E8; font-family: var(--font-display); font-size: 16px; font-weight: 600; }
        .zk-shell { display: block; }
        .zk-sidebar {
          position: fixed; top: 0; left: -260px; height: 100vh; width: 232px; z-index: 90;
          transition: left 0.22s ease; box-shadow: 2px 0 18px rgba(0,0,0,0.25); overflow-y: auto;
        }
        .zk-sidebar.zk-sidebar-open { left: 0; }
        .zk-sidebar-overlay {
          display: none; position: fixed; inset: 0; background: rgba(20,20,15,0.45); z-index: 80;
        }
        .zk-sidebar-overlay.zk-sidebar-open { display: block; }
        .zk-main { padding: 16px 14px; max-width: 100%; }
      }
      /* Ana içeriğin kendisi (sidebar hesaba katılmadan) 720px altına inerse de aynı kural geçerli olsun */
      @media (max-width: 720px) {
        .zk-grid[style*="1fr 1fr"] { grid-template-columns: 1fr !important; }
      }

      /* Telefon düzeni: tüm çok sütunlu ızgaralar tek sütuna iner, tablolar yatay kayar */
      @media (max-width: 600px) {
        [style*="gridTemplateColumns"] { grid-template-columns: 1fr !important; }
        .zk-main { padding: 14px 12px; }
        .zk-h1 { font-size: 18px; }
        .zk-h1-sub { font-size: 11.5px; margin-bottom: 14px; }
        .zk-card { padding: 12px 13px; }
        .zk-stat-value { font-size: 18px; }
        .zk-table { min-width: 560px; }
        .zk-modal { max-width: 94vw; padding: 16px; }
        .zk-brand { font-size: 15px; }
        .zk-navbtn { padding: 9px 10px; font-size: 12px; }
        .zk-scale-readout { font-size: 24px; }
        .zk-btn { padding: 10px 12px; font-size: 12.5px; }
        .zk-app { overflow-x: hidden; }
      }
    `}</style>
  );
}
