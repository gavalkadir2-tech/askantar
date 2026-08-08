import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Package2,
} from 'lucide-react';
import { ListFooterControls, SortableTh, StatCard } from '../common/index';
import { usePagedList, useSortableColumns } from '../../hooks/index';
import { CRATE_MOVEMENT_TYPES } from '../../lib/constants';
import { fmtDate, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function CrateInventoryTab({ farmers, movements, setMovements, settings, setSettings }) {
  const [viewFarmerId, setViewFarmerId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [formFarmerId, setFormFarmerId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState('kasaVerildi');
  const [quantity, setQuantity] = useState('');
  const [deposit, setDeposit] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  const [editingTotals, setEditingTotals] = useState(false);
  const [totalKasaInput, setTotalKasaInput] = useState(String(settings.totalKasaOwned ?? 0));
  const [totalCuvalInput, setTotalCuvalInput] = useState(String(settings.totalCuvalOwned ?? 0));

  const totalKasaOwned = settings.totalKasaOwned ?? 0;
  const totalCuvalOwned = settings.totalCuvalOwned ?? 0;

  const saveTotals = async () => {
    const next = { ...settings, totalKasaOwned: parseFloat(totalKasaInput) || 0, totalCuvalOwned: parseFloat(totalCuvalInput) || 0 };
    setSettings(next);
    await storageSet('zk:settings', next);
    setEditingTotals(false);
  };

  const balances = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.id] = { kasa: 0, cuval: 0 }; });
    movements.forEach((m) => {
      if (!map[m.farmerId]) return;
      const def = CRATE_MOVEMENT_TYPES.find((t) => t.key === m.type);
      if (!def) return;
      const field = def.unit === 'kasa' ? 'kasa' : 'cuval';
      map[m.farmerId][field] += def.sign * m.quantity;
    });
    return map;
  }, [farmers, movements]);

  const totalOutstandingKasa = Object.values(balances).reduce((s, b) => s + Math.max(b.kasa, 0), 0);
  const totalOutstandingCuval = Object.values(balances).reduce((s, b) => s + Math.max(b.cuval, 0), 0);
  const depotKasa = totalKasaOwned - totalOutstandingKasa;
  const depotCuval = totalCuvalOwned - totalOutstandingCuval;

  const resetForm = () => { setEditingId(null); setFormFarmerId(''); setDate(todayStr()); setType('kasaVerildi'); setQuantity(''); setDeposit(''); setNote(''); setFormError(''); };
  const startEdit = (m) => { setEditingId(m.id); setFormFarmerId(m.farmerId); setDate(m.date); setType(m.type); setQuantity(String(m.quantity)); setDeposit(m.deposit ? String(m.deposit) : ''); setNote(m.note || ''); setFormError(''); };

  const save = async () => {
    const q = parseFloat(quantity);
    if (!formFarmerId) { setFormError('Lütfen bir çiftçi seçin.'); return; }
    if (!q || q <= 0) { setFormError('Lütfen geçerli bir adet girin.'); return; }
    setFormError('');
    let next;
    if (editingId) {
      next = movements.map((m) => (m.id === editingId ? { ...m, farmerId: formFarmerId, date, type, quantity: q, deposit: parseFloat(deposit) || 0, note } : m));
    } else {
      next = [...movements, { id: uid(), farmerId: formFarmerId, date, type, quantity: q, deposit: parseFloat(deposit) || 0, note, createdAt: Date.now() }];
    }
    setMovements(next);
    await storageSet('zk:crateMovements', next);
    setViewFarmerId(formFarmerId);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu kasa/çuval hareketini silmek istediğinize emin misiniz?')) return;
    const next = movements.filter((m) => m.id !== id);
    setMovements(next);
    await storageSet('zk:crateMovements', next);
    if (editingId === id) resetForm();
  };

  const farmerList = useMemo(() => {
    return farmers.map((f) => ({ farmer: f, balance: balances[f.id] || { kasa: 0, cuval: 0 } })).filter((r) => r.balance.kasa !== 0 || r.balance.cuval !== 0 || movements.some((m) => m.farmerId === r.farmer.id));
  }, [farmers, balances, movements]);

  const [balanceQuery, setBalanceQuery] = useState('');
  const { sortKey: balSortKey, sortDir: balSortDir, toggleSort: balToggleSort, sortRows: balSortRows } = useSortableColumns();
  const filteredFarmerList = useMemo(() => {
    if (!balanceQuery) return farmerList;
    const q = balanceQuery.toLowerCase();
    return farmerList.filter((r) => r.farmer.name.toLowerCase().includes(q) || (r.farmer.phone || '').toLowerCase().includes(q) || (r.farmer.address || '').toLowerCase().includes(q));
  }, [farmerList, balanceQuery]);
  const sortedFarmerList = balSortRows(filteredFarmerList, (r, key) => {
    if (key === 'name') return r.farmer.name;
    if (key === 'kasa') return r.balance.kasa;
    if (key === 'cuval') return r.balance.cuval;
    return null;
  });
  const balPaged = usePagedList(sortedFarmerList);

  const [moveQuery, setMoveQuery] = useState('');
  const { sortKey: movSortKey, sortDir: movSortDir, toggleSort: movToggleSort, sortRows: movSortRows } = useSortableColumns('date', 'desc');
  const farmerMovementsAll = viewFarmerId
    ? movements.filter((m) => m.farmerId === viewFarmerId)
    : [];
  const filteredFarmerMovements = useMemo(() => {
    if (!moveQuery) return farmerMovementsAll;
    const q = moveQuery.toLowerCase();
    return farmerMovementsAll.filter((m) => (m.note || '').toLowerCase().includes(q) || (CRATE_MOVEMENT_TYPES.find((t) => t.key === m.type)?.label || '').toLowerCase().includes(q));
  }, [farmerMovementsAll, moveQuery]);
  const sortedFarmerMovements = movSortRows(filteredFarmerMovements, (m, key) => m[key]);
  const movPaged = usePagedList(sortedFarmerMovements);

  return (
    <div>
      <div className="zk-h1">Kasa & Çuval Envanteri</div>
      <div className="zk-h1-sub">Çiftçilere verilen/iade alınan kasa ve çuvalların takibi (nakit kasadan farklı, fiziksel ambalaj sayımı)</div>


      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam sahip olunan kasa" value={`${totalKasaOwned} adet`} icon={Package2} />
        <StatCard label="Çiftçilerde olan kasa" value={`${totalOutstandingKasa} adet`} tone={COLORS.blue} icon={Package2} />
        <StatCard label="Depoda kalan kasa" value={`${depotKasa} adet`} tone={depotKasa < 0 ? COLORS.red : COLORS.olive} icon={Package2} />
      </div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Toplam sahip olunan çuval" value={`${totalCuvalOwned} adet`} icon={Package2} />
        <StatCard label="Çiftçilerde olan çuval" value={`${totalOutstandingCuval} adet`} tone={COLORS.gold} icon={Package2} />
        <StatCard label="Depoda kalan çuval" value={`${depotCuval} adet`} tone={depotCuval < 0 ? COLORS.red : COLORS.olive} icon={Package2} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Başlangıç / toplam envanter</div>
          {!editingTotals && <button className="zk-btn zk-btn-secondary" onClick={() => setEditingTotals(true)}><Pencil size={13} /> Düzenle</button>}
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 4, marginBottom: editingTotals ? 12 : 0 }}>
          Elinizde toplam kaç kasa/çuval olduğunu (satın alınan/sahip olunan) burada belirtin — "depoda kalan" bu sayıdan hesaplanır.
        </div>
        {editingTotals && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <div style={{ flex: '1 1 160px' }}>
              <label className="zk-label">Toplam kasa (adet)</label>
              <input className="zk-input" type="text" inputMode="decimal" value={totalKasaInput} onChange={(e) => setTotalKasaInput(e.target.value.replace(',', '.'))} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label className="zk-label">Toplam çuval (adet)</label>
              <input className="zk-input" type="text" inputMode="decimal" value={totalCuvalInput} onChange={(e) => setTotalCuvalInput(e.target.value.replace(',', '.'))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button className="zk-btn zk-btn-primary" onClick={saveTotals}>Kaydet</button>
              <button className="zk-btn zk-btn-secondary" onClick={() => { setEditingTotals(false); setTotalKasaInput(String(totalKasaOwned)); setTotalCuvalInput(String(totalCuvalOwned)); }}>İptal</button>
            </div>
          </div>
        )}
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Hareketi düzenle' : 'Yeni kasa/çuval hareketi'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '2 1 180px' }} value={formFarmerId} onChange={(e) => { setFormFarmerId(e.target.value); setFormError(''); }}>
            <option value="">Çiftçi seçin...</option>
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select className="zk-select" style={{ flex: '1 1 160px' }} value={type} onChange={(e) => setType(e.target.value)}>
            {CRATE_MOVEMENT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="zk-input" type="text" inputMode="decimal" placeholder="Adet" style={{ flex: '1 1 90px' }} value={quantity} onChange={(e) => { setQuantity(e.target.value.replace(',', '.')); setFormError(''); }} />
          <input className="zk-input" type="text" inputMode="decimal" placeholder="Depozito (TL, opsiyonel)" style={{ flex: '1 1 140px' }} value={deposit} onChange={(e) => setDeposit(e.target.value.replace(',', '.'))} />
          <input className="zk-input" placeholder="Not" style={{ flex: '1 1 140px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" onClick={resetForm}>İptal</button>}
        </div>
        {formError && <div style={{ fontSize: 12, color: COLORS.red, marginTop: 8 }}>{formError}</div>}
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Çiftçi bazında bakiye — kimde kaç kasa/çuval var</div>
        <input className="zk-input" style={{ marginBottom: 12, maxWidth: 320 }} placeholder="İsim, telefon veya adrese göre ara..." value={balanceQuery} onChange={(e) => setBalanceQuery(e.target.value)} />
        {sortedFarmerList.length === 0 ? (
          <div className="zk-empty">{farmerList.length === 0 ? 'Henüz kasa/çuval hareketi yok.' : 'Aramanızla eşleşen çiftçi bulunamadı.'}</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="Çiftçi" sortKeyName="name" sortKey={balSortKey} sortDir={balSortDir} onSort={balToggleSort} />
                <th>Telefon</th>
                <th>Adres</th>
                <SortableTh label="Elindeki kasa" sortKeyName="kasa" sortKey={balSortKey} sortDir={balSortDir} onSort={balToggleSort} />
                <SortableTh label="Elindeki çuval" sortKeyName="cuval" sortKey={balSortKey} sortDir={balSortDir} onSort={balToggleSort} />
              </tr>
            </thead>
            <tbody>
              {balPaged.paged.map(({ farmer, balance }) => (
                <tr key={farmer.id} style={{ cursor: 'pointer' }} onClick={() => setViewFarmerId(farmer.id)}>
                  <td>{farmer.name}</td>
                  <td style={{ color: COLORS.inkSoft }}>{farmer.phone || '—'}</td>
                  <td style={{ color: COLORS.inkSoft }}>{farmer.address || '—'}</td>
                  <td><span className={`zk-badge ${balance.kasa > 0 ? 'zk-badge-blue' : 'zk-badge-olive'}`}>{balance.kasa} adet</span></td>
                  <td><span className={`zk-badge ${balance.cuval > 0 ? 'zk-badge-gold' : 'zk-badge-olive'}`}>{balance.cuval} adet</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListFooterControls page={balPaged.page} setPage={balPaged.setPage} pageSize={balPaged.pageSize} setPageSize={balPaged.setPageSize} totalPages={balPaged.totalPages} totalCount={balPaged.totalCount} />
          </>
        )}
      </div>

      {viewFarmerId && (
        <div className="zk-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8,}}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>
              {farmers.find((f) => f.id === viewFarmerId)?.name} — hareket geçmişi
            </div>
            <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 10px', fontSize: 11.5 }} onClick={() => setViewFarmerId('')}>Kapat</button>
          </div>
          <input className="zk-input" style={{ marginBottom: 12, maxWidth: 320 }} placeholder="Hareket türü veya nota göre ara..." value={moveQuery} onChange={(e) => setMoveQuery(e.target.value)} />
          {sortedFarmerMovements.length === 0 ? (
            <div className="zk-empty">{farmerMovementsAll.length === 0 ? 'Hareket yok.' : 'Aramanızla eşleşen hareket bulunamadı.'}</div>
          ) : (
            <>
            <table className="zk-table">
              <thead>
                <tr>
                  <SortableTh label="Tarih" sortKeyName="date" sortKey={movSortKey} sortDir={movSortDir} onSort={movToggleSort} />
                  <th>Hareket</th>
                  <SortableTh label="Adet" sortKeyName="quantity" sortKey={movSortKey} sortDir={movSortDir} onSort={movToggleSort} />
                  <SortableTh label="Depozito" sortKeyName="deposit" sortKey={movSortKey} sortDir={movSortDir} onSort={movToggleSort} />
                  <th>Not</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {movPaged.paged.map((m) => {
                  const def = CRATE_MOVEMENT_TYPES.find((t) => t.key === m.type);
                  return (
                    <tr key={m.id}>
                      <td>{fmtDate(m.date)}</td>
                      <td><span className={`zk-badge ${def?.sign > 0 ? 'zk-badge-blue' : 'zk-badge-olive'}`}>{def?.label}</span></td>
                      <td>{m.quantity}</td>
                      <td>{m.deposit ? fmtTL(m.deposit) : '—'}</td>
                      <td style={{ color: COLORS.inkSoft }}>{m.note || '—'}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(m)}><Pencil size={12} /></button>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(m.id)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ListFooterControls page={movPaged.page} setPage={movPaged.setPage} pageSize={movPaged.pageSize} setPageSize={movPaged.setPageSize} totalPages={movPaged.totalPages} totalCount={movPaged.totalCount} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Laboratuvar (randıman / asit / nem sonuçları) ----------
