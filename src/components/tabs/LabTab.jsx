import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  FlaskConical,
} from 'lucide-react';
import { ListFooterControls, SortableTh, StatCard } from '../common/index';
import { usePagedList, useSortableColumns } from '../../hooks/index';
import { fmtDate, fmtKg, mean, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function LabTab({ farmers, purchases, results, setResults }) {
  const [editingId, setEditingId] = useState(null);
  const [farmerId, setFarmerId] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [randiman, setRandiman] = useState('');
  const [asit, setAsit] = useState('');
  const [nem, setNem] = useState('');
  const [kalite, setKalite] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');

  const farmerPurchases = farmerId ? purchases.filter((p) => p.farmerId === farmerId).sort((a, b) => b.createdAt - a.createdAt) : [];

  const avgRandiman = results.length ? mean(results.map((r) => r.randiman).filter((v) => v > 0)) : 0;
  const avgAsit = results.length ? mean(results.map((r) => r.asit).filter((v) => v > 0)) : 0;

  const resetForm = () => { setEditingId(null); setFarmerId(''); setPurchaseId(''); setDate(todayStr()); setRandiman(''); setAsit(''); setNem(''); setKalite(''); setNote(''); };
  const startEdit = (r) => { setEditingId(r.id); setFarmerId(r.farmerId || ''); setPurchaseId(r.purchaseId || ''); setDate(r.date); setRandiman(String(r.randiman || '')); setAsit(String(r.asit || '')); setNem(String(r.nem || '')); setKalite(r.kalite || ''); setNote(r.note || ''); };

  const save = async () => {
    if (!farmerId) return;
    let next;
    const data = {
      farmerId, purchaseId: purchaseId || null, date,
      randiman: parseFloat(randiman) || 0, asit: parseFloat(asit) || 0, nem: parseFloat(nem) || 0,
      kalite, note,
    };
    if (editingId) {
      next = results.map((r) => (r.id === editingId ? { ...r, ...data } : r));
    } else {
      next = [...results, { id: uid(), ...data, createdAt: Date.now() }];
    }
    setResults(next);
    await storageSet('zk:labResults', next);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu laboratuvar sonucunu silmek istediğinize emin misiniz?')) return;
    const next = results.filter((r) => r.id !== id);
    setResults(next);
    await storageSet('zk:labResults', next);
    if (editingId === id) resetForm();
  };

  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns('date', 'desc');
  const withFarmer = useMemo(() => results.map((r) => ({ ...r, farmerName: farmers.find((f) => f.id === r.farmerId)?.name || '' })), [results, farmers]);
  const filtered = useMemo(() => {
    if (!query) return withFarmer;
    const q = query.toLowerCase();
    return withFarmer.filter((r) => r.farmerName.toLowerCase().includes(q) || (r.kalite || '').toLowerCase().includes(q) || (r.note || '').toLowerCase().includes(q));
  }, [withFarmer, query]);
  const sorted = sortRows(filtered, (r, key) => r[key]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(sorted);

  return (
    <div>
      <div className="zk-h1">Laboratuvar</div>
      <div className="zk-h1-sub">Randıman, asit ve nem sonuçlarının kaydı — istenirse bir alım kaydına bağlanabilir</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Ortalama randıman" value={avgRandiman ? `%${avgRandiman.toFixed(1)}` : '—'} tone={COLORS.olive} icon={FlaskConical} />
        <StatCard label="Ortalama asit" value={avgAsit ? `%${avgAsit.toFixed(2)}` : '—'} tone={COLORS.blue} />
        <StatCard label="Toplam sonuç" value={results.length} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Sonucu düzenle' : 'Yeni laboratuvar sonucu'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 160px' }} value={farmerId} onChange={(e) => { setFarmerId(e.target.value); setPurchaseId(''); }}>
            <option value="">Çiftçi seçin...</option>
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select className="zk-select" style={{ flex: '1 1 160px' }} value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)} disabled={!farmerId}>
            <option value="">İlişkili alım (opsiyonel)</option>
            {farmerPurchases.map((p) => <option key={p.id} value={p.id}>#{p.makbuzNo} · {fmtDate(p.date)} · {fmtKg(p.netKg)}</option>)}
          </select>
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="zk-input" type="text" inputMode="decimal" placeholder="Randıman (%)" style={{ flex: '1 1 120px' }} value={randiman} onChange={(e) => setRandiman(e.target.value.replace(',', '.'))} />
          <input className="zk-input" type="text" inputMode="decimal" placeholder="Asit (%)" style={{ flex: '1 1 100px' }} value={asit} onChange={(e) => setAsit(e.target.value.replace(',', '.'))} />
          <input className="zk-input" type="text" inputMode="decimal" placeholder="Nem (%)" style={{ flex: '1 1 100px' }} value={nem} onChange={(e) => setNem(e.target.value.replace(',', '.'))} />
          <input className="zk-input" placeholder="Kalite notu" style={{ flex: '1 1 130px' }} value={kalite} onChange={(e) => setKalite(e.target.value)} />
          <input className="zk-input" placeholder="Not" style={{ flex: '1 1 130px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" onClick={resetForm}>İptal</button>}
        </div>
      </div>

      <div className="zk-card">
        <input className="zk-input" style={{ marginBottom: 14, maxWidth: 320 }} placeholder="Çiftçi, kalite notu veya nota göre ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {sorted.length === 0 ? (
          <div className="zk-empty">{results.length === 0 ? 'Henüz laboratuvar sonucu yok.' : 'Aramanızla eşleşen sonuç bulunamadı.'}</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="Tarih" sortKeyName="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Çiftçi" sortKeyName="farmerName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Alım</th>
                <SortableTh label="Randıman" sortKeyName="randiman" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Asit" sortKeyName="asit" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Nem" sortKeyName="nem" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Kalite</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => {
                const p = purchases.find((x) => x.id === r.purchaseId);
                return (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.farmerName || '—'}</td>
                    <td style={{ color: COLORS.inkSoft }}>{p ? `#${p.makbuzNo}` : '—'}</td>
                    <td>{r.randiman ? `%${r.randiman}` : '—'}</td>
                    <td>{r.asit ? `%${r.asit}` : '—'}</td>
                    <td>{r.nem ? `%${r.nem}` : '—'}</td>
                    <td>{r.kalite ? <span className="zk-badge zk-badge-blue">{r.kalite}</span> : '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(r)}><Pencil size={12} /></button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><Trash2 size={12} /></button>
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
    </div>
  );
}

// ---------- Muhasebe (banka hesapları + çek/senet takibi) ----------
