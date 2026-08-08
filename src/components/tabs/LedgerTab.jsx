import React, { useState, useMemo } from 'react';
import {
  Printer,
  MessageCircle,
  Trash2,
} from 'lucide-react';
import { StatCard } from '../common/index';
import { fmtDate, fmtKg, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppBalanceReminderText, buildWhatsAppReceiptText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function LedgerTab({ farmers, purchases, payments, setPayments, selectedFarmerId, setSelectedFarmerId, onPrintReceipt, settings }) {
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payType, setPayType] = useState('odeme');

  const farmer = farmers.find((f) => f.id === selectedFarmerId);

  const entries = useMemo(() => {
    if (!farmer) return [];
    const p = purchases.filter((x) => x.farmerId === farmer.id).map((x) => ({ type: 'purchase', date: x.date, createdAt: x.createdAt, amount: x.netPayment, data: x }));
    const pay = payments.filter((x) => x.farmerId === farmer.id).map((x) => ({ type: 'payment', date: x.date, createdAt: x.createdAt, amount: -x.amount, data: x }));
    return [...p, ...pay].sort((a, b) => a.createdAt - b.createdAt);
  }, [farmer, purchases, payments]);

  let running = 0;
  const withRunning = entries.map((e) => { running += e.amount; return { ...e, running }; });
  const balance = running;

  const addPayment = async () => {
    const amt = parseFloat(payAmount);
    if (!farmer || !amt || amt <= 0) return;
    const record = { id: uid(), farmerId: farmer.id, date: todayStr(), amount: amt, note: payNote, payType, createdAt: Date.now() };
    const next = [...payments, record];
    setPayments(next);
    await storageSet('zk:payments', next);
    setPayAmount(''); setPayNote('');
  };

  const removePayment = async (id) => {
    if (!window.confirm('Bu ödeme/avans kaydını silmek istediğinize emin misiniz?')) return;
    const next = payments.filter((p) => p.id !== id);
    setPayments(next);
    await storageSet('zk:payments', next);
  };

  if (!farmer) {
    return (
      <div>
        <div className="zk-h1">Cari hesap</div>
        <div className="zk-h1-sub">Görüntülemek için bir çiftçi seçin</div>
        <div className="zk-card">
          <select className="zk-select" value="" onChange={(e) => setSelectedFarmerId(e.target.value)}>
            <option value="">Çiftçi seçin...</option>
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="zk-h1">{farmer.name}</div>
          <div className="zk-h1-sub">Cari hesap özeti</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {balance > 0 && formatPhoneForWhatsApp(farmer.phone) && (
            <a
              className="zk-btn" style={{ background: '#25D366', color: '#fff' }}
              href={`https://wa.me/${formatPhoneForWhatsApp(farmer.phone)}?text=${encodeURIComponent(buildWhatsAppBalanceReminderText(farmer, balance, purchases.filter((p) => p.farmerId === farmer.id).sort((a, b) => b.createdAt - a.createdAt), settings))}`}
              target="_blank" rel="noopener noreferrer"
            >
              <MessageCircle size={14} /> WhatsApp ile bakiye bildir
            </a>
          )}
          <select className="zk-select" style={{ width: 200 }} value={selectedFarmerId} onChange={(e) => setSelectedFarmerId(e.target.value)}>
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Güncel bakiye" value={fmtTL(Math.abs(balance))} tone={balance > 0 ? COLORS.red : COLORS.olive} />
        <StatCard label="Durum" value={balance > 0 ? 'Ödenecek' : 'Kapalı'} />
        <StatCard label="Toplam işlem" value={entries.length} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Ödeme / avans ekle</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select className="zk-select" value={payType} onChange={(e) => setPayType(e.target.value)} style={{ maxWidth: 140 }}>
            <option value="odeme">Ödeme</option>
            <option value="avans">Avans</option>
          </select>
          <input className="zk-input" type="text" inputMode="decimal" placeholder="Tutar (TL)" value={payAmount} onChange={(e) => setPayAmount(e.target.value.replace(',', '.'))} style={{ maxWidth: 160 }} />
          <input className="zk-input" placeholder="Not (opsiyonel)" value={payNote} onChange={(e) => setPayNote(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <button className="zk-btn zk-btn-primary" onClick={addPayment}>Ekle</button>
        </div>
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Hareketler</div>
        {withRunning.length === 0 ? (
          <div className="zk-empty">Henüz hareket yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>İşlem</th><th>Tutar</th><th>Bakiye</th><th></th></tr></thead>
            <tbody>
              {withRunning.slice().reverse().map((e, i) => (
                <tr key={i}>
                  <td>{fmtDate(e.date)}</td>
                  <td>
                    {e.type === 'purchase'
                      ? <span className="zk-badge zk-badge-olive">Alım · {fmtKg(e.data.netKg)}</span>
                      : <span className={`zk-badge ${e.data.payType === 'avans' ? 'zk-badge-blue' : 'zk-badge-gold'}`}>{e.data.payType === 'avans' ? 'Avans' : 'Ödeme'}{e.data.note ? ` · ${e.data.note}` : ''}</span>}
                  </td>
                  <td style={{ color: e.amount >= 0 ? COLORS.olive : COLORS.gold, fontWeight: 600 }}>
                    {e.amount >= 0 ? '+' : ''}{fmtTL(e.amount)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(e.running)}</td>
                  <td>
                    {e.type === 'purchase' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintReceipt(e.data)}><Printer size={12} /></button>
                        {formatPhoneForWhatsApp(farmer.phone) && (
                          <a className="zk-btn" style={{ padding: '5px 9px', background: '#25D366', color: '#fff' }} href={`https://wa.me/${formatPhoneForWhatsApp(farmer.phone)}?text=${encodeURIComponent(buildWhatsAppReceiptText(e.data, farmer, settings))}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle size={12} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => removePayment(e.data.id)}><Trash2 size={12} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
