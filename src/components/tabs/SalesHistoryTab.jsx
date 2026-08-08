import React, { useState, useMemo } from 'react';
import { downloadSaleReceiptPdf } from '../../pdfHelper.js';
import {
  Printer,
  Download,
  MessageCircle,
  Trash2,
  Pencil,
} from 'lucide-react';
import { ListFooterControls, SortableTh } from '../common/index';
import { EditSaleModal } from '../modals/index';
import { usePagedList, useSortableColumns } from '../../hooks/index';
import { fmtDate, fmtKg, fmtTL, storageSet } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppSaleReceiptText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function SalesHistoryTab({ buyers, sales, setSales, settings, onPrintSaleReceipt, vehicles }) {
  const [query, setQuery] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns('date', 'desc');

  const withNames = useMemo(() => sales.map((s) => ({ ...s, buyerName: buyers.find((x) => x.id === s.buyerId)?.name || '' })), [sales, buyers]);

  const filtered = useMemo(() => {
    const arr = withNames.filter((s) => {
      if (buyerFilter && s.buyerId !== buyerFilter) return false;
      if (fromDate && s.date < fromDate) return false;
      if (toDate && s.date > toDate) return false;
      if (query) {
        const haystack = [s.buyerName, s.note || '', s.grade || '', s.vehiclePlaka || ''].join(' ').toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    return sortRows(arr, (s, key) => {
      if (key === 'date') return s.createdAt;
      if (key === 'makbuzNo') return s.makbuzNo;
      if (key === 'buyerName') return s.buyerName;
      if (key === 'grade') return s.grade;
      if (key === 'vehiclePlaka') return s.vehiclePlaka;
      return s[key];
    });
  }, [withNames, buyerFilter, fromDate, toDate, query, sortRows]);

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
                <SortableTh label="No" sortKeyName="makbuzNo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Tarih" sortKeyName="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Alıcı" sortKeyName="buyerName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Sınıf" sortKeyName="grade" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Kg" sortKeyName="kg" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Fiyat" sortKeyName="pricePerKg" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Tutar" sortKeyName="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Araç" sortKeyName="vehiclePlaka" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
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
          <ListFooterControls page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} totalCount={totalCount} />
          </>
        )}
      </div>

      {editingSale && (
        <EditSaleModal sale={editingSale} buyers={buyers} vehicles={vehicles} onClose={() => setEditingSale(null)} onSave={saveEditedSale} />
      )}
    </div>
  );
}
