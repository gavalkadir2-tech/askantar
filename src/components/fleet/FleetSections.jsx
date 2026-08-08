import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Warehouse,
  Plus,
  Package,
  ShoppingCart,
  TrendingUp,
  Gauge,
  Trash2,
  Pencil,
} from 'lucide-react';
import { ExpiryBadge, ListFooterControls, SortableTh, StatCard } from '../common/index';
import { usePagedList, useSortableColumns } from '../../hooks/index';
import { DOC_TYPES, MAINTENANCE_TYPES, TIRE_POSITIONS, TIRE_STATUSES } from '../../lib/constants';
import { daysUntil, fmtDate, fmtKg, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function MaintenanceSection({ vehicleId, records, setRecords }) {
  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [km, setKm] = useState('');
  const [type, setType] = useState(MAINTENANCE_TYPES[0]);
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt);
  const total = vehicleRecords.reduce((s, r) => s + r.cost, 0);
  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns();
  const sortedRecords = sortRows(vehicleRecords, (r, key) => r[key]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(sortedRecords);

  const resetForm = () => { setEditingId(null); setDate(todayStr()); setKm(''); setType(MAINTENANCE_TYPES[0]); setCost(''); setNote(''); };

  const startEdit = (r) => { setEditingId(r.id); setDate(r.date); setKm(String(r.km || '')); setType(r.type); setCost(String(r.cost)); setNote(r.note || ''); };

  const save = async () => {
    const c = parseFloat(cost);
    if (!c || c <= 0) return;
    let next;
    if (editingId) {
      next = records.map((r) => (r.id === editingId ? { ...r, date, km: parseFloat(km) || 0, type, cost: c, note } : r));
    } else {
      next = [...records, { id: uid(), vehicleId, date, km: parseFloat(km) || 0, type, cost: c, note, createdAt: Date.now() }];
    }
    setRecords(next);
    await storageSet('zk:vehicleMaintenance', next);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu bakım kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleMaintenance', next);
    if (editingId === id) resetForm();
  };

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam bakım maliyeti" value={fmtTL(total)} tone={COLORS.red} />
        <StatCard label="Bakım sayısı" value={vehicleRecords.length} />
      </div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Bakım kaydını düzenle' : 'Yeni bakım kaydı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 160px' }} value={type} onChange={(e) => setType(e.target.value)}>
            {MAINTENANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="zk-input" type="date" style={{ flex: '1 1 140px' }} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Km" style={{ flex: '1 1 110px' }} value={km} onChange={(e) => setKm(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Maliyet (TL)" style={{ flex: '1 1 130px' }} value={cost} onChange={(e) => setCost(e.target.value)} />
          <input className="zk-input" placeholder="Not" style={{ flex: '2 1 180px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" onClick={resetForm}>İptal</button>}
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Bakım kaydı yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="Tarih" sortKeyName="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Km" sortKeyName="km" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Tür</th>
                <SortableTh label="Maliyet" sortKeyName="cost" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Not</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.km ? fmtKg(r.km).replace('kg', 'km') : '—'}</td>
                  <td><span className="zk-badge zk-badge-blue">{r.type}</span></td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.cost)}</td>
                  <td style={{ color: COLORS.inkSoft }}>{r.note || '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(r)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><Trash2 size={12} /></button>
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

export function FuelSection({ vehicleId, records, setRecords, settings }) {
  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [km, setKm] = useState('');
  const [liters, setLiters] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState(settings?.defaultFuelPrice ? String(settings.defaultFuelPrice) : '');
  const [note, setNote] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => (a.km || 0) - (b.km || 0));
  const totalCost = vehicleRecords.reduce((s, r) => s + r.totalCost, 0);
  const totalLiters = vehicleRecords.reduce((s, r) => s + r.liters, 0);

  const efficiency = useMemo(() => {
    const withKm = vehicleRecords.filter((r) => r.km > 0);
    if (withKm.length < 2) return null;
    const first = withKm[0], last = withKm[withKm.length - 1];
    const kmDiff = last.km - first.km;
    const litersUsed = withKm.slice(1).reduce((s, r) => s + r.liters, 0);
    if (kmDiff <= 0 || litersUsed <= 0) return null;
    return { kmDiff, litersUsed, per100km: (litersUsed / kmDiff) * 100 };
  }, [vehicleRecords]);

  const resetForm = () => { setEditingId(null); setDate(todayStr()); setKm(''); setLiters(''); setPricePerLiter(settings?.defaultFuelPrice ? String(settings.defaultFuelPrice) : ''); setNote(''); };

  const startEdit = (r) => { setEditingId(r.id); setDate(r.date); setKm(String(r.km || '')); setLiters(String(r.liters)); setPricePerLiter(String(r.pricePerLiter)); setNote(r.note || ''); };

  const save = async () => {
    const l = parseFloat(liters), p = parseFloat(pricePerLiter);
    if (!l || l <= 0 || !p || p <= 0) return;
    let next;
    if (editingId) {
      next = records.map((r) => (r.id === editingId ? { ...r, date, km: parseFloat(km) || 0, liters: l, pricePerLiter: p, totalCost: l * p, note } : r));
    } else {
      next = [...records, { id: uid(), vehicleId, date, km: parseFloat(km) || 0, liters: l, pricePerLiter: p, totalCost: l * p, note, createdAt: Date.now() }];
    }
    setRecords(next);
    await storageSet('zk:vehicleFuel', next);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu yakıt kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleFuel', next);
    if (editingId === id) resetForm();
  };

  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns('date', 'desc');
  const sortedRecords = sortRows(vehicleRecords, (r, key) => r[key]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(sortedRecords);

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam yakıt maliyeti" value={fmtTL(totalCost)} tone={COLORS.red} />
        <StatCard label="Toplam litre" value={totalLiters.toFixed(1) + ' L'} />
        <StatCard label="Ortalama tüketim" value={efficiency ? `${efficiency.per100km.toFixed(1)} L/100km` : '—'} tone={COLORS.blue} icon={TrendingUp} />
      </div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Yakıt kaydını düzenle' : 'Yeni yakıt kaydı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="zk-input" type="date" style={{ flex: '1 1 140px' }} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Kilometre (gösterge)" style={{ flex: '1 1 160px' }} value={km} onChange={(e) => setKm(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Litre" style={{ flex: '1 1 100px' }} value={liters} onChange={(e) => setLiters(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Litre fiyatı" style={{ flex: '1 1 110px' }} value={pricePerLiter} onChange={(e) => setPricePerLiter(e.target.value)} />
          <input className="zk-input" placeholder="Not" style={{ flex: '2 1 160px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" onClick={resetForm}>İptal</button>}
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Yakıt kaydı yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="Tarih" sortKeyName="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Km" sortKeyName="km" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Litre" sortKeyName="liters" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Litre fiyatı</th>
                <SortableTh label="Tutar" sortKeyName="totalCost" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.km || '—'}</td>
                  <td>{r.liters.toFixed(1)} L</td>
                  <td>{fmtTL(r.pricePerLiter)}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.totalCost)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(r)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><Trash2 size={12} /></button>
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

export function DocumentsSection({ vehicleId, records, setRecords }) {
  const [editingId, setEditingId] = useState(null);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => (daysUntil(a.expiryDate) ?? 9999) - (daysUntil(b.expiryDate) ?? 9999));

  const resetForm = () => { setEditingId(null); setDocType(DOC_TYPES[0]); setIssueDate(''); setExpiryDate(''); setNote(''); };

  const startEdit = (r) => { setEditingId(r.id); setDocType(r.docType); setIssueDate(r.issueDate || ''); setExpiryDate(r.expiryDate); setNote(r.note || ''); };

  const save = async () => {
    if (!expiryDate) return;
    let next;
    if (editingId) {
      next = records.map((r) => (r.id === editingId ? { ...r, docType, issueDate, expiryDate, note } : r));
    } else {
      next = [...records, { id: uid(), vehicleId, docType, issueDate, expiryDate, note, createdAt: Date.now() }];
    }
    setRecords(next);
    await storageSet('zk:vehicleDocuments', next);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu evrak kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleDocuments', next);
    if (editingId === id) resetForm();
  };

  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns();
  const sortedRecords = sortRows(vehicleRecords, (r, key) => r[key]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(sortedRecords);

  return (
    <div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Evrak kaydını düzenle' : 'Yeni evrak kaydı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 150px' }} value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ flex: '1 1 140px' }}>
            <label className="zk-label">Düzenleme tarihi</label>
            <input className="zk-input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label className="zk-label">Geçerlilik bitiş</label>
            <input className="zk-input" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div style={{ flex: '2 1 160px' }}>
            <label className="zk-label">Not</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="zk-btn zk-btn-gold" style={{ alignSelf: 'flex-end' }} onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" style={{ alignSelf: 'flex-end' }} onClick={resetForm}>İptal</button>}
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Evrak kaydı yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <th>Belge</th>
                <SortableTh label="Düzenleme" sortKeyName="issueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Bitiş" sortKeyName="expiryDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Durum</th>
                <th>Not</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id}>
                  <td><span className="zk-badge zk-badge-blue">{r.docType}</span></td>
                  <td>{r.issueDate ? fmtDate(r.issueDate) : '—'}</td>
                  <td>{fmtDate(r.expiryDate)}</td>
                  <td><ExpiryBadge dateStr={r.expiryDate} /></td>
                  <td style={{ color: COLORS.inkSoft }}>{r.note || '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(r)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><Trash2 size={12} /></button>
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

export function InsuranceDamageSection({ vehicleId, insurance, setInsurance, damages, setDamages }) {
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [policyType, setPolicyType] = useState('Trafik');
  const [company, setCompany] = useState('');
  const [policyNo, setPolicyNo] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [premium, setPremium] = useState('');

  const [editingDamageId, setEditingDamageId] = useState(null);
  const [damageDate, setDamageDate] = useState(todayStr());
  const [damageDesc, setDamageDesc] = useState('');
  const [damageCost, setDamageCost] = useState('');
  const [damageStatus, setDamageStatus] = useState('Bekliyor');

  const vehiclePolicies = insurance.filter((r) => r.vehicleId === vehicleId).sort((a, b) => (daysUntil(a.endDate) ?? 9999) - (daysUntil(b.endDate) ?? 9999));
  const vehicleDamages = damages.filter((r) => r.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt);
  const totalDamageCost = vehicleDamages.reduce((s, r) => s + r.cost, 0);

  const resetPolicyForm = () => { setEditingPolicyId(null); setPolicyType('Trafik'); setCompany(''); setPolicyNo(''); setStartDate(''); setEndDate(''); setPremium(''); };
  const startEditPolicy = (r) => { setEditingPolicyId(r.id); setPolicyType(r.policyType); setCompany(r.company); setPolicyNo(r.policyNo || ''); setStartDate(r.startDate || ''); setEndDate(r.endDate); setPremium(String(r.premium)); };

  const savePolicy = async () => {
    if (!company.trim() || !endDate) return;
    let next;
    if (editingPolicyId) {
      next = insurance.map((r) => (r.id === editingPolicyId ? { ...r, policyType, company: company.trim(), policyNo, startDate, endDate, premium: parseFloat(premium) || 0 } : r));
    } else {
      next = [...insurance, { id: uid(), vehicleId, policyType, company: company.trim(), policyNo, startDate, endDate, premium: parseFloat(premium) || 0, createdAt: Date.now() }];
    }
    setInsurance(next);
    await storageSet('zk:vehicleInsurance', next);
    resetPolicyForm();
  };

  const removePolicy = async (id) => {
    if (!window.confirm('Bu poliçe kaydını silmek istediğinize emin misiniz?')) return;
    const next = insurance.filter((r) => r.id !== id);
    setInsurance(next);
    await storageSet('zk:vehicleInsurance', next);
    if (editingPolicyId === id) resetPolicyForm();
  };

  const resetDamageForm = () => { setEditingDamageId(null); setDamageDate(todayStr()); setDamageDesc(''); setDamageCost(''); setDamageStatus('Bekliyor'); };
  const startEditDamage = (r) => { setEditingDamageId(r.id); setDamageDate(r.date); setDamageDesc(r.description); setDamageCost(String(r.cost)); setDamageStatus(r.status); };

  const saveDamage = async () => {
    const c = parseFloat(damageCost);
    if (!damageDesc.trim()) return;
    let next;
    if (editingDamageId) {
      next = damages.map((r) => (r.id === editingDamageId ? { ...r, date: damageDate, description: damageDesc.trim(), cost: c || 0, status: damageStatus } : r));
    } else {
      next = [...damages, { id: uid(), vehicleId, date: damageDate, description: damageDesc.trim(), cost: c || 0, status: damageStatus, createdAt: Date.now() }];
    }
    setDamages(next);
    await storageSet('zk:vehicleDamage', next);
    resetDamageForm();
  };

  const removeDamage = async (id) => {
    if (!window.confirm('Bu hasar kaydını silmek istediğinize emin misiniz?')) return;
    const next = damages.filter((r) => r.id !== id);
    setDamages(next);
    await storageSet('zk:vehicleDamage', next);
    if (editingDamageId === id) resetDamageForm();
  };

  const { sortKey: polSortKey, sortDir: polSortDir, toggleSort: polToggleSort, sortRows: polSortRows } = useSortableColumns();
  const sortedPolicies = polSortRows(vehiclePolicies, (r, key) => r[key]);
  const policiesPaged = usePagedList(sortedPolicies);

  const { sortKey: dmgSortKey, sortDir: dmgSortDir, toggleSort: dmgToggleSort, sortRows: dmgSortRows } = useSortableColumns('date', 'desc');
  const sortedDamages = dmgSortRows(vehicleDamages, (r, key) => r[key]);
  const damagesPaged = usePagedList(sortedDamages);

  return (
    <div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingPolicyId ? 'Poliçeyi düzenle' : 'Yeni poliçe ekle'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <select className="zk-select" style={{ flex: '1 1 110px' }} value={policyType} onChange={(e) => setPolicyType(e.target.value)}>
            <option value="Trafik">Trafik</option>
            <option value="Kasko">Kasko</option>
          </select>
          <input className="zk-input" placeholder="Sigorta şirketi" style={{ flex: '1 1 150px' }} value={company} onChange={(e) => setCompany(e.target.value)} />
          <input className="zk-input" placeholder="Poliçe no" style={{ flex: '1 1 120px' }} value={policyNo} onChange={(e) => setPolicyNo(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Prim (TL)" style={{ flex: '1 1 110px' }} value={premium} onChange={(e) => setPremium(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={savePolicy}>{editingPolicyId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingPolicyId && <button className="zk-btn zk-btn-secondary" onClick={resetPolicyForm}>İptal</button>}
        </div>
        {vehiclePolicies.length === 0 ? (
          <div className="zk-empty">Poliçe kaydı yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <th>Tür</th>
                <SortableTh label="Şirket" sortKeyName="company" sortKey={polSortKey} sortDir={polSortDir} onSort={polToggleSort} />
                <SortableTh label="Bitiş" sortKeyName="endDate" sortKey={polSortKey} sortDir={polSortDir} onSort={polToggleSort} />
                <th>Durum</th>
                <SortableTh label="Prim" sortKeyName="premium" sortKey={polSortKey} sortDir={polSortDir} onSort={polToggleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {policiesPaged.paged.map((r) => (
                <tr key={r.id}>
                  <td><span className="zk-badge zk-badge-blue">{r.policyType}</span></td>
                  <td>{r.company}</td>
                  <td>{fmtDate(r.endDate)}</td>
                  <td><ExpiryBadge dateStr={r.endDate} /></td>
                  <td>{fmtTL(r.premium)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEditPolicy(r)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removePolicy(r.id)}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListFooterControls page={policiesPaged.page} setPage={policiesPaged.setPage} pageSize={policiesPaged.pageSize} setPageSize={policiesPaged.setPageSize} totalPages={policiesPaged.totalPages} totalCount={policiesPaged.totalCount} />
          </>
        )}
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam hasar maliyeti" value={fmtTL(totalDamageCost)} tone={COLORS.red} />
        <StatCard label="Hasar sayısı" value={vehicleDamages.length} />
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingDamageId ? 'Hasar kaydını düzenle' : 'Yeni hasar kaydı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={damageDate} onChange={(e) => setDamageDate(e.target.value)} />
          <input className="zk-input" placeholder="Açıklama" style={{ flex: '2 1 200px' }} value={damageDesc} onChange={(e) => setDamageDesc(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Onarım maliyeti" style={{ flex: '1 1 130px' }} value={damageCost} onChange={(e) => setDamageCost(e.target.value)} />
          <select className="zk-select" style={{ flex: '1 1 120px' }} value={damageStatus} onChange={(e) => setDamageStatus(e.target.value)}>
            <option value="Bekliyor">Bekliyor</option>
            <option value="Onarımda">Onarımda</option>
            <option value="Onarıldı">Onarıldı</option>
          </select>
          <button className="zk-btn zk-btn-gold" onClick={saveDamage}>{editingDamageId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingDamageId && <button className="zk-btn zk-btn-secondary" onClick={resetDamageForm}>İptal</button>}
        </div>
        {vehicleDamages.length === 0 ? (
          <div className="zk-empty">Hasar kaydı yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="Tarih" sortKeyName="date" sortKey={dmgSortKey} sortDir={dmgSortDir} onSort={dmgToggleSort} />
                <th>Açıklama</th>
                <SortableTh label="Maliyet" sortKeyName="cost" sortKey={dmgSortKey} sortDir={dmgSortDir} onSort={dmgToggleSort} />
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {damagesPaged.paged.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.description}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.cost)}</td>
                  <td>
                    <span className={`zk-badge ${r.status === 'Onarıldı' ? 'zk-badge-olive' : r.status === 'Onarımda' ? 'zk-badge-gold' : 'zk-badge-red'}`}>{r.status}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEditDamage(r)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removeDamage(r.id)}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListFooterControls page={damagesPaged.page} setPage={damagesPaged.setPage} pageSize={damagesPaged.pageSize} setPageSize={damagesPaged.setPageSize} totalPages={damagesPaged.totalPages} totalCount={damagesPaged.totalCount} />
          </>
        )}
      </div>
    </div>
  );
}

export function FinesSection({ vehicleId, records, setRecords }) {
  const [editingId, setEditingId] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt);
  const totalAmount = vehicleRecords.reduce((s, r) => s + r.amount, 0);
  const unpaidAmount = vehicleRecords.filter((r) => !r.paid).reduce((s, r) => s + r.amount, 0);

  const resetForm = () => { setEditingId(null); setDate(todayStr()); setDescription(''); setAmount(''); setDueDate(''); };
  const startEdit = (r) => { setEditingId(r.id); setDate(r.date); setDescription(r.description); setAmount(String(r.amount)); setDueDate(r.dueDate || ''); };

  const save = async () => {
    const a = parseFloat(amount);
    if (!description.trim() || !a || a <= 0) return;
    let next;
    if (editingId) {
      next = records.map((r) => (r.id === editingId ? { ...r, date, description: description.trim(), amount: a, dueDate } : r));
    } else {
      next = [...records, { id: uid(), vehicleId, date, description: description.trim(), amount: a, dueDate, paid: false, createdAt: Date.now() }];
    }
    setRecords(next);
    await storageSet('zk:vehicleFines', next);
    resetForm();
  };

  const togglePaid = async (id) => {
    const next = records.map((r) => (r.id === id ? { ...r, paid: !r.paid } : r));
    setRecords(next);
    await storageSet('zk:vehicleFines', next);
  };

  const remove = async (id) => {
    if (!window.confirm('Bu ceza kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleFines', next);
    if (editingId === id) resetForm();
  };

  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns('date', 'desc');
  const sortedRecords = sortRows(vehicleRecords, (r, key) => r[key]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(sortedRecords);

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam ceza" value={fmtTL(totalAmount)} tone={COLORS.red} />
        <StatCard label="Ödenmemiş" value={fmtTL(unpaidAmount)} tone={unpaidAmount > 0 ? COLORS.red : COLORS.olive} />
      </div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Ceza kaydını düzenle' : 'Yeni ceza kaydı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={date} onChange={(e) => setDate(e.target.value)} />
          <input className="zk-input" placeholder="Açıklama (örn. hız ihlali)" style={{ flex: '2 1 200px' }} value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Tutar (TL)" style={{ flex: '1 1 110px' }} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="zk-input" type="date" placeholder="Son ödeme" style={{ flex: '1 1 130px' }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" onClick={resetForm}>İptal</button>}
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Ceza kaydı yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="Tarih" sortKeyName="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Açıklama</th>
                <SortableTh label="Tutar" sortKeyName="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Son ödeme" sortKeyName="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{r.description}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.amount)}</td>
                  <td>{r.dueDate ? fmtDate(r.dueDate) : '—'}</td>
                  <td>
                    <button className={`zk-badge ${r.paid ? 'zk-badge-olive' : 'zk-badge-red'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => togglePaid(r.id)}>
                      {r.paid ? 'Ödendi' : 'Ödenmedi'}
                    </button>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(r)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><Trash2 size={12} /></button>
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

export function TiresSection({ vehicleId, records, setRecords }) {
  const [editingId, setEditingId] = useState(null);
  const [position, setPosition] = useState(TIRE_POSITIONS[0]);
  const [brand, setBrand] = useState('');
  const [installDate, setInstallDate] = useState(todayStr());
  const [installKm, setInstallKm] = useState('');
  const [status, setStatus] = useState('Yeni');
  const [note, setNote] = useState('');

  const vehicleRecords = records.filter((r) => r.vehicleId === vehicleId).sort((a, b) => b.createdAt - a.createdAt);

  const resetForm = () => { setEditingId(null); setPosition(TIRE_POSITIONS[0]); setBrand(''); setInstallDate(todayStr()); setInstallKm(''); setStatus('Yeni'); setNote(''); };
  const startEdit = (r) => { setEditingId(r.id); setPosition(r.position); setBrand(r.brand); setInstallDate(r.installDate); setInstallKm(String(r.installKm || '')); setStatus(r.status); setNote(r.note || ''); };

  const save = async () => {
    if (!brand.trim()) return;
    let next;
    if (editingId) {
      next = records.map((r) => (r.id === editingId ? { ...r, position, brand: brand.trim(), installDate, installKm: parseFloat(installKm) || 0, status, note } : r));
    } else {
      next = [...records, { id: uid(), vehicleId, position, brand: brand.trim(), installDate, installKm: parseFloat(installKm) || 0, status, note, createdAt: Date.now() }];
    }
    setRecords(next);
    await storageSet('zk:vehicleTires', next);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu lastik kaydını silmek istediğinize emin misiniz?')) return;
    const next = records.filter((r) => r.id !== id);
    setRecords(next);
    await storageSet('zk:vehicleTires', next);
    if (editingId === id) resetForm();
  };

  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns('installDate', 'desc');
  const sortedRecords = sortRows(vehicleRecords, (r, key) => r[key]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(sortedRecords);

  return (
    <div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Lastik kaydını düzenle' : 'Yeni lastik kaydı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 110px' }} value={position} onChange={(e) => setPosition(e.target.value)}>
            {TIRE_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="zk-input" placeholder="Marka" style={{ flex: '1 1 130px' }} value={brand} onChange={(e) => setBrand(e.target.value)} />
          <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={installDate} onChange={(e) => setInstallDate(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Takılan km" style={{ flex: '1 1 110px' }} value={installKm} onChange={(e) => setInstallKm(e.target.value)} />
          <select className="zk-select" style={{ flex: '1 1 100px' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            {TIRE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="zk-input" placeholder="Not" style={{ flex: '1 1 120px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" onClick={resetForm}>İptal</button>}
        </div>
      </div>
      <div className="zk-card">
        {vehicleRecords.length === 0 ? (
          <div className="zk-empty">Lastik kaydı yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <th>Konum</th>
                <SortableTh label="Marka" sortKeyName="brand" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Takılma" sortKeyName="installDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Km" sortKeyName="installKm" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Durum</th>
                <th>Not</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id}>
                  <td><span className="zk-badge zk-badge-blue">{r.position}</span></td>
                  <td>{r.brand}</td>
                  <td>{fmtDate(r.installDate)}</td>
                  <td>{r.installKm || '—'}</td>
                  <td>
                    <span className={`zk-badge ${r.status === 'Değişmeli' ? 'zk-badge-red' : r.status === 'Orta' ? 'zk-badge-gold' : 'zk-badge-olive'}`}>{r.status}</span>
                  </td>
                  <td style={{ color: COLORS.inkSoft }}>{r.note || '—'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(r)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><Trash2 size={12} /></button>
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

export function CostAnalysisSection({ vehicleId, maintenance, fuel, fines, insurance, damages, vehiclePickups, vehicleDeliveries }) {
  const maintCost = maintenance.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.cost, 0);
  const fuelCost = fuel.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.totalCost, 0);
  const fineCost = fines.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.amount, 0);
  const insuranceCost = insurance.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.premium, 0);
  const damageCost = damages.filter((r) => r.vehicleId === vehicleId).reduce((s, r) => s + r.cost, 0);
  const totalCost = maintCost + fuelCost + fineCost + insuranceCost + damageCost;

  const fuelRecords = fuel.filter((r) => r.vehicleId === vehicleId && r.km > 0).sort((a, b) => a.km - b.km);
  const totalKm = fuelRecords.length >= 2 ? fuelRecords[fuelRecords.length - 1].km - fuelRecords[0].km : 0;
  const costPerKm = totalKm > 0 ? totalCost / totalKm : null;

  const totalPickupKg = vehiclePickups.reduce((s, p) => s + p.netKg, 0);

  const chartData = [
    { name: 'Yakıt', tutar: fuelCost },
    { name: 'Bakım', tutar: maintCost },
    { name: 'Ceza', tutar: fineCost },
    { name: 'Sigorta', tutar: insuranceCost },
    { name: 'Hasar', tutar: damageCost },
  ].filter((d) => d.tutar > 0);

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam maliyet" value={fmtTL(totalCost)} tone={COLORS.red} />
        <StatCard label="Km başına maliyet" value={costPerKm ? fmtTL(costPerKm) : '—'} tone={COLORS.blue} icon={Gauge} />
        <StatCard label="Taşınan zeytin" value={fmtKg(totalPickupKg)} tone={COLORS.olive} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Maliyet dağılımı</div>
        {chartData.length === 0 ? (
          <div className="zk-empty">Henüz maliyet kaydı yok.</div>
        ) : (
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.inkSoft }} width={60} />
                <Tooltip formatter={(v) => [fmtTL(v), 'Tutar']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="tutar" fill={COLORS.red} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Kalem bazında özet</div>
        <table className="zk-table">
          <thead><tr><th>Kalem</th><th>Tutar</th></tr></thead>
          <tbody>
            <tr><td>Yakıt</td><td style={{ fontWeight: 600 }}>{fmtTL(fuelCost)}</td></tr>
            <tr><td>Bakım</td><td style={{ fontWeight: 600 }}>{fmtTL(maintCost)}</td></tr>
            <tr><td>Trafik cezaları</td><td style={{ fontWeight: 600 }}>{fmtTL(fineCost)}</td></tr>
            <tr><td>Sigorta primleri</td><td style={{ fontWeight: 600 }}>{fmtTL(insuranceCost)}</td></tr>
            <tr><td>Hasar onarımı</td><td style={{ fontWeight: 600 }}>{fmtTL(damageCost)}</td></tr>
            <tr style={{ borderTop: `2px solid ${COLORS.border}` }}><td style={{ fontWeight: 700 }}>Toplam</td><td style={{ fontWeight: 700, color: COLORS.red }}>{fmtTL(totalCost)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- AI Asistan: kural/istatistik tabanlı analiz motoru (ücretsiz, API gerektirmez) ----------

export function StockOverview({ purchases, sales }) {
  const totalPurchasedKg = purchases.reduce((s, p) => s + p.netKg, 0);
  const totalSoldKg = sales.reduce((s, s2) => s + s2.kg, 0);

  const purchasedByGrade = useMemo(() => {
    const map = {};
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => { map[it.grade] = (map[it.grade] || 0) + it.kg; });
    });
    return map;
  }, [purchases]);

  const soldByGrade = useMemo(() => {
    const map = {};
    sales.forEach((s) => { map[s.grade || 'Etiketsiz'] = (map[s.grade || 'Etiketsiz'] || 0) + s.kg; });
    return map;
  }, [sales]);

  const stockByGrade = useMemo(() => {
    const grades = new Set([...Object.keys(purchasedByGrade), ...Object.keys(soldByGrade)]);
    return Array.from(grades).map((g) => ({ grade: g, stock: (purchasedByGrade[g] || 0) - (soldByGrade[g] || 0) })).sort((a, b) => b.stock - a.stock);
  }, [purchasedByGrade, soldByGrade]);

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Toplam alınan" value={fmtKg(totalPurchasedKg)} icon={Package} />
        <StatCard label="Toplam satılan" value={fmtKg(totalSoldKg)} icon={ShoppingCart} />
        <StatCard label="Mevcut stok" value={fmtKg(totalPurchasedKg - totalSoldKg)} tone={COLORS.blue} icon={Warehouse} />
      </div>
      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Sınıf bazında stok</div>
        {stockByGrade.length === 0 ? (
          <div className="zk-empty">Kayıt yok.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stockByGrade.map(({ grade: g, stock }) => (
              <div key={g} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, flexWrap: 'wrap', gap: 8,}}>
                <span className="zk-badge zk-badge-blue">{g}</span>
                <span style={{ fontWeight: 600, color: stock < 0 ? COLORS.red : COLORS.ink }}>{fmtKg(stock)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Alışlar (Çiftçiler + Kantarlı Alış + Alış Geçmişi + Cari Hesap birleşik) ----------
