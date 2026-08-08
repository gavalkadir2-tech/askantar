import React, { useState, useMemo } from 'react';
import { downloadReceiptPdf } from '../../pdfHelper.js';
import {
  Printer,
  Search,
  Download,
  Package,
  MessageCircle,
  Trash2,
  Pencil,
} from 'lucide-react';
import { ListFooterControls, SortableTh } from '../common/index';
import { EditPurchaseModal } from '../modals/index';
import { usePagedList, useSortableColumns } from '../../hooks/index';
import { fmtDate, fmtKg, fmtTL, storageSet } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppReceiptText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function AllPurchasesTab({ farmers, purchases, setPurchases, personnel, vehicles, onPrintReceipt, settings }) {
  const [query, setQuery] = useState('');
  const [farmerFilter, setFarmerFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns('date', 'desc');

  const withNames = useMemo(() => purchases.map((p) => ({
    ...p,
    farmerName: farmers.find((x) => x.id === p.farmerId)?.name || '',
    gradesLabel: (p.items || []).map((it) => it.grade).join(', '),
  })), [purchases, farmers]);

  const filtered = useMemo(() => {
    const arr = withNames.filter((p) => {
      if (farmerFilter && p.farmerId !== farmerFilter) return false;
      if (fromDate && p.date < fromDate) return false;
      if (toDate && p.date > toDate) return false;
      if (query) {
        const haystack = [p.farmerName, p.note || '', String(p.makbuzNo), p.gradesLabel].join(' ').toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
    return sortRows(arr, (p, key) => {
      if (key === 'date') return p.createdAt;
      if (key === 'makbuzNo') return p.makbuzNo;
      if (key === 'farmerName') return p.farmerName;
      if (key === 'personnelName') return p.personnelName;
      if (key === 'vehiclePlaka') return p.vehiclePlaka;
      return p[key];
    });
  }, [withNames, farmerFilter, fromDate, toDate, query, sortRows]);

  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(filtered);

  const totalKg = filtered.reduce((s, p) => s + p.netKg, 0);
  const totalAmount = filtered.reduce((s, p) => s + p.netPayment, 0);

  const [editingPurchase, setEditingPurchase] = useState(null);

  const removePurchase = async (p) => {
    if (!window.confirm(`#${p.makbuzNo} numaralı alım kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve çiftçinin cari hesabını etkiler.`)) return;
    const next = purchases.filter((x) => x.id !== p.id);
    setPurchases(next);
    await storageSet('zk:purchases', next);
  };

  const saveEditedPurchase = async (updated) => {
    const next = purchases.map((x) => (x.id === updated.id ? updated : x));
    setPurchases(next);
    await storageSet('zk:purchases', next);
    setEditingPurchase(null);
  };

  return (
    <div>
      <div className="zk-h1">Tüm alımlar</div>
      <div className="zk-h1-sub">{filtered.length} kayıt · {fmtKg(totalKg)} · {fmtTL(totalAmount)}</div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ position: 'relative', flex: '2 1 200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 14, color: COLORS.inkSoft }} />
            <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="Çiftçi, sınıf, not, makbuz no ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="zk-select" style={{ flex: '1 1 140px' }} value={farmerFilter} onChange={(e) => setFarmerFilter(e.target.value)}>
            <option value="">Tüm çiftçiler</option>
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input className="zk-input" type="date" style={{ flex: '1 1 140px' }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 140px' }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      <div className="zk-card">
        {filtered.length === 0 ? (
          <div className="zk-empty"><Package size={26} className="zk-empty-icon" /><br/>Kayıt bulunamadı.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="No" sortKeyName="makbuzNo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Tarih" sortKeyName="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Çiftçi" sortKeyName="farmerName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Personel" sortKeyName="personnelName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Araç" sortKeyName="vehiclePlaka" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Sınıflar</th>
                <SortableTh label="Net kg" sortKeyName="netKg" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Net ödeme" sortKeyName="netPayment" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p) => {
                const f = farmers.find((x) => x.id === p.farmerId);
                const waPhone = f ? formatPhoneForWhatsApp(f.phone) : null;
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setEditingPurchase(p)}>
                    <td>#{p.makbuzNo}</td>
                    <td>{fmtDate(p.date)}{p.time ? ` · ${p.time}` : ''}</td>
                    <td>{f ? f.name : '—'}</td>
                    <td style={{ color: COLORS.inkSoft }}>{p.personnelName || '—'}</td>
                    <td style={{ color: COLORS.inkSoft }}>{p.vehiclePlaka || '—'}</td>
                    <td style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{p.gradesLabel}</td>
                    <td>{fmtKg(p.netKg)}</td>
                    <td style={{ fontWeight: 600 }}>{fmtTL(p.netPayment)}</td>
                    <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => setEditingPurchase(p)}><Pencil size={12} /></button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintReceipt(p)}><Printer size={12} /></button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => downloadReceiptPdf(p, f, settings)}><Download size={12} /></button>
                      {waPhone && (
                        <a className="zk-btn" style={{ padding: '5px 9px', background: '#25D366', color: '#fff' }} href={`https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsAppReceiptText(p, f, settings))}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle size={12} />
                        </a>
                      )}
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => removePurchase(p)}><Trash2 size={12} /></button>
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

      {editingPurchase && (
        <EditPurchaseModal
          purchase={editingPurchase} farmers={farmers} personnel={personnel} vehicles={vehicles}
          onClose={() => setEditingPurchase(null)} onSave={saveEditedPurchase}
        />
      )}
    </div>
  );
}
