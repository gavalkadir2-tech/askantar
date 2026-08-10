import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Printer,
  MessageCircle,
  Trash2,
  Wallet,
  CheckCircle2,
  ClipboardList,
  Download,
} from 'lucide-react';
import { ListFooterControls, StatCard } from '../common/index';
import { usePagedList, useBuyerLedger } from '../../hooks/index';
import { fmtDate, fmtTL, todayStr } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppSaleReceiptText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function BuyerLedgerTab({ buyers, sales, buyerPayments, setBuyerPayments, selectedBuyerId, setSelectedBuyerId, onPrintSaleReceipt, settings }) {
  const [collAmount, setCollAmount] = useState('');
  const [collNote, setCollNote] = useState('');

  const buyer = buyers.find((b) => b.id === selectedBuyerId);
  const { getBuyerEntries, addCollection: addCollectionShared, removeCollection, getBuyerAging } = useBuyerLedger(buyers, sales, buyerPayments, setBuyerPayments);

  const entries = useMemo(() => {
    if (!buyer) return [];
    return getBuyerEntries(buyer.id);
  }, [buyer, sales, buyerPayments]);

  let running = 0;
  const withRunning = entries.map((e) => { running += e.amount; return { ...e, running }; });
  const balance = running;

  const aging = useMemo(() => {
    if (!buyer || balance <= 0) return { daysOverdue: null, isOverdue: false };
    return getBuyerAging(buyer.id);
  }, [buyer, sales, buyerPayments, balance]);

  const addCollection = async () => {
    if (!buyer) return;
    const result = await addCollectionShared(buyer.id, collAmount, collNote);
    if (result) { setCollAmount(''); setCollNote(''); }
  };

  const removeCollectionRow = async (id) => {
    if (!window.confirm('Bu tahsilat kaydını silmek istediğinize emin misiniz?')) return;
    await removeCollection(id);
  };

  const [query, setQuery] = useState('');
  const reversedWithRunning = [...withRunning].reverse();
  const filteredEntries = useMemo(() => {
    if (!query) return reversedWithRunning;
    const q = query.toLowerCase();
    return reversedWithRunning.filter((e) => (e.data.note || '').toLowerCase().includes(q) || (e.type === 'sale' ? 'satış' : 'tahsilat').includes(q) || (e.data.grade || '').toLowerCase().includes(q));
  }, [reversedWithRunning, query]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(filteredEntries);

  const exportLedgerExcel = () => {
    if (!buyer) return;
    const rows = reversedWithRunning.map((e) => ({
      'Tarih': e.date,
      'İşlem': e.type === 'sale' ? 'Satış' : 'Tahsilat',
      'Sınıf': e.type === 'sale' ? (e.data.grade || '') : '',
      'Vade tarihi': e.type === 'sale' ? (e.data.vadeTarihi || '') : '',
      'Not': e.data.note || '',
      'Tutar': e.amount,
      'Bakiye': e.running,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cari Hesap');
    XLSX.writeFile(wb, `cari-hesap-${buyer.name.replace(/\s+/g, '-')}-${todayStr()}.xlsx`);
  };

  if (!buyer) {
    return (
      <div>
        <div className="zk-h1">Cari hesap</div>
        <div className="zk-h1-sub">Görüntülemek için bir cari seçin</div>
        <div className="zk-card">
          <select className="zk-select" value="" onChange={(e) => setSelectedBuyerId(e.target.value)}>
            <option value="">Cari seçin...</option>
            {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="zk-h1">{buyer.name}</div>
          <div className="zk-h1-sub">Cari hesap özeti</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="zk-btn zk-btn-blue" onClick={exportLedgerExcel}><Download size={13} /> Excel'e aktar</button>
          {balance > 0 && formatPhoneForWhatsApp(buyer.phone) && (
            <a
              className="zk-btn" style={{ background: '#25D366', color: '#fff' }}
              href={`https://wa.me/${formatPhoneForWhatsApp(buyer.phone)}?text=${encodeURIComponent(`Sayın ${buyer.name}, güncel hesap bakiyeniz ${fmtTL(balance)}. Bilginize sunarız.`)}`}
              target="_blank" rel="noopener noreferrer"
            >
              <MessageCircle size={14} /> WhatsApp ile bakiye bildir
            </a>
          )}
          <select className="zk-select" style={{ width: 200 }} value={selectedBuyerId} onChange={(e) => setSelectedBuyerId(e.target.value)}>
            {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Güncel bakiye" value={fmtTL(Math.abs(balance))} tone={balance > 0 ? COLORS.red : COLORS.olive} icon={Wallet} />
        <StatCard label="Durum" value={balance > 0 ? (aging.isOverdue ? `${aging.daysOverdue} gün gecikti` : 'Vadesinde') : 'Kapalı'} tone={aging.isOverdue ? COLORS.red : undefined} icon={CheckCircle2} />
        <StatCard label="Toplam işlem" value={entries.length} icon={ClipboardList} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Tahsilat ekle</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="zk-input" type="text" inputMode="decimal" placeholder="Tutar (TL)" value={collAmount} onChange={(e) => setCollAmount(e.target.value.replace(',', '.'))} style={{ maxWidth: 160 }} />
          <input className="zk-input" placeholder="Not (opsiyonel)" value={collNote} onChange={(e) => setCollNote(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
          <button className="zk-btn zk-btn-primary" onClick={addCollection}>Ekle</button>
        </div>
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Hareketler</div>
        <input className="zk-input" style={{ marginBottom: 14, maxWidth: 320 }} placeholder="Not veya işlem türüne göre ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {filteredEntries.length === 0 ? (
          <div className="zk-empty">{withRunning.length === 0 ? 'Henüz hareket yok.' : 'Aramanızla eşleşen hareket bulunamadı.'}</div>
        ) : (
          <>
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>İşlem</th><th>Tutar</th><th>Bakiye</th><th></th></tr></thead>
            <tbody>
              {paged.map((e, i) => (
                <tr key={i}>
                  <td>{fmtDate(e.date)}</td>
                  <td>
                    {e.type === 'sale'
                      ? <span className="zk-badge zk-badge-blue">Satış{e.data.grade ? ` · ${e.data.grade}` : ''}{e.data.vadeTarihi ? ` · vade ${fmtDate(e.data.vadeTarihi)}` : ''}</span>
                      : <span className="zk-badge zk-badge-olive">Tahsilat{e.data.note ? ` · ${e.data.note}` : ''}</span>}
                  </td>
                  <td style={{ color: e.amount >= 0 ? COLORS.red : COLORS.olive, fontWeight: 600 }}>
                    {e.amount >= 0 ? '+' : ''}{fmtTL(e.amount)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(e.running)}</td>
                  <td>
                    {e.type === 'sale' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        {e.data.makbuzNo && <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintSaleReceipt(e.data)}><Printer size={12} /></button>}
                        {e.data.makbuzNo && formatPhoneForWhatsApp(buyer.phone) && (
                          <a className="zk-btn" style={{ padding: '5px 9px', background: '#25D366', color: '#fff' }} href={`https://wa.me/${formatPhoneForWhatsApp(buyer.phone)}?text=${encodeURIComponent(buildWhatsAppSaleReceiptText(e.data, buyer, settings))}`} target="_blank" rel="noopener noreferrer">
                            <MessageCircle size={12} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => removeCollectionRow(e.data.id)}><Trash2 size={12} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListFooterControls page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} totalCount={totalCount} />
          </>
        )}
      </div>
    </div>
  );
}
