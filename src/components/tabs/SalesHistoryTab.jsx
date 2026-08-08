import React, { useState, useMemo } from 'react';
import { downloadSaleReceiptPdf } from '../../pdfHelper.js';
import {
  Printer,
  Download,
  MessageCircle,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import { ListFooterControls } from '../common/index';
import { EditSaleModal } from '../modals/index';
import { usePagedList } from '../../hooks/index';
import { fmtDate, fmtKg, fmtTL, storageSet } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppSaleReceiptText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function SalesHistoryTab({ buyers, sales, setSales, settings, onPrintSaleReceipt, vehicles }) {
  const [query, setQuery] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc');

  const filtered = useMemo(() => {
    const arr = sales.filter((s) => {
      if (buyerFilter && s.buyerId !== buyerFilter) return false;
      if (fromDate && s.date < fromDate) return false;
      if (toDate && s.date > toDate) return false;
      if (query) {
        const b = buyers.find((x) => x.id === s.buyerId);
        const haystack = [b?.name || '', s.note || '', s.grade || '', s.vehiclePlaka || ''].join(' ').toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    if (sortOrder === 'date_asc') arr.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortOrder === 'kg_desc') arr.sort((a, b) => b.kg - a.kg);
    else if (sortOrder === 'amount_desc') arr.sort((a, b) => b.amount - a.amount);
    else arr.sort((a, b) => b.createdAt - a.createdAt);
    return arr;
  }, [sales, buyerFilter, fromDate, toDate, query, buyers, sortOrder]);

  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(filtered);

  const totalKg = filtered.reduce((s, s2) => s + s2.kg, 0);
  const totalAmount = filtered.reduce((s, s2) => s + s2.amount, 0);

  const removeSale = async (s) => {
    if (!window.confirm('Bu satış kaydını silmek istediğinize emin misiniz? Stok hesabına geri eklenecektir.')) return;
    const next = sales.filter((x) => x.id !== s.id);
    setSales(next);
    await storageSet('zk:sales', next);
  };

  const [editingSale, setEditingSale] = useState(null);
  const saveEditedSale = async (updated) => {
    const next = sales.map((x) => (x.id === updated.id ? updated : x));
    setSales(next);
    await storageSet('zk:sales', next);
    setEditingSale(null);
  };

  return (
    <div>
      <div className="zk-h1">Satış Geçmişi</div>
      <div className="zk-h1-sub">{filtered.length} kayıt · {fmtKg(totalKg)} · {fmtTL(totalAmount)}</div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="zk-input" style={{ flex: '2 1 180px' }} placeholder="Ara (alıcı, sınıf, not, plaka)..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="zk-select" style={{ flex: '1 1 160px' }} value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)}>
            <option value="">Tüm alıcılar</option>
            {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <div className="zk-card">
        {filtered.length === 0 ? (
          <div className="zk-empty">Kayıt bulunamadı.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <th>No</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setSortOrder(sortOrder === 'date_asc' ? 'date_desc' : 'date_asc')}>Tarih {sortOrder === 'date_asc' ? <ChevronUp size={12} /> : sortOrder === 'date_desc' ? <ChevronDown size={12} /> : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />}</th>
                <th>Alıcı</th>
                <th>Sınıf</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setSortOrder('kg_desc')}>Kg {sortOrder === 'kg_desc' ? <ChevronDown size={12} /> : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />}</th>
                <th>Fiyat</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setSortOrder('amount_desc')}>Tutar {sortOrder === 'amount_desc' ? <ChevronDown size={12} /> : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />}</th>
                <th>Araç</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => {
                const b = buyers.find((x) => x.id === s.buyerId);
                const waPhone = b ? formatPhoneForWhatsApp(b.phone) : null;
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => setEditingSale(s)}>
                    <td>{s.makbuzNo ? `#${s.makbuzNo}` : '—'}</td>
                    <td>{fmtDate(s.date)}</td>
                    <td>{b ? b.name : '—'}</td>
                    <td><span className="zk-badge zk-badge-blue">{s.grade || '—'}</span></td>
                    <td>{fmtKg(s.kg)}</td>
                    <td>{fmtTL(s.pricePerKg)}/kg</td>
                    <td>{fmtTL(s.amount)}</td>
                    <td style={{ color: COLORS.inkSoft }}>{s.vehiclePlaka || '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => setEditingSale(s)}><Pencil size={12} /></button>
                      {s.makbuzNo && <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintSaleReceipt(s)}><Printer size={12} /></button>}
                      {s.makbuzNo && <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => downloadSaleReceiptPdf(s, b, settings)}><Download size={12} /></button>}
                      {waPhone && s.makbuzNo && (
                        <a className="zk-btn" style={{ padding: '5px 9px', background: '#25D366', color: '#fff' }} href={`https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsAppSaleReceiptText(s, b, settings))}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle size={12} />
                        </a>
                      )}
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => removeSale(s)}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ListFooterControls
            sortOrder={sortOrder} setSortOrder={setSortOrder}
            sortOptions={[
              { value: 'date_desc', label: 'Tarih: Yeni → Eski' },
              { value: 'date_asc', label: 'Tarih: Eski → Yeni' },
              { value: 'kg_desc', label: 'Kg: Büyük → Küçük' },
              { value: 'amount_desc', label: 'Tutar: Büyük → Küçük' },
            ]}
            page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} totalCount={totalCount}
          />
          </>
        )}
      </div>

      {editingSale && (
        <EditSaleModal sale={editingSale} buyers={buyers} vehicles={vehicles} onClose={() => setEditingSale(null)} onSave={saveEditedSale} />
      )}
    </div>
  );
}
