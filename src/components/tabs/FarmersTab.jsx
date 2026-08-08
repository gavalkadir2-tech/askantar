import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  ChevronRight,
  Trash2,
  Pencil,
} from 'lucide-react';
import { AddFarmerModal } from '../modals/index';
import { fmtTL, storageSet, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function FarmersTab({ farmers, setFarmers, purchases, payments, setTab, setSelectedFarmerId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState(null);
  const [query, setQuery] = useState('');

  const balances = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.id] = 0; });
    purchases.forEach((p) => { map[p.farmerId] = (map[p.farmerId] || 0) + p.netPayment; });
    payments.forEach((pay) => { map[pay.farmerId] = (map[pay.farmerId] || 0) - pay.amount; });
    return map;
  }, [farmers, purchases, payments]);

  const filtered = farmers.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));

  const addFarmer = async (data) => {
    const newFarmer = { id: uid(), ...data, createdAt: Date.now() };
    const next = [...farmers, newFarmer];
    setFarmers(next);
    await storageSet('zk:farmers', next);
    setShowAdd(false);
  };

  const saveEdit = async (data) => {
    const next = farmers.map((f) => (f.id === editingFarmer.id ? { ...f, ...data } : f));
    setFarmers(next);
    await storageSet('zk:farmers', next);
    setEditingFarmer(null);
  };

  const removeFarmer = async (f) => {
    const hasHistory = purchases.some((p) => p.farmerId === f.id) || payments.some((p) => p.farmerId === f.id);
    const warning = hasHistory
      ? `${f.name} adına kayıtlı alım/ödeme geçmişi var. Çiftçiyi silerseniz bu kayıtlar listede "—" olarak görünmeye devam eder ama çiftçi kaydı kalıcı olarak silinir. Emin misiniz?`
      : `${f.name} adlı çiftçiyi silmek istediğinize emin misiniz?`;
    if (!window.confirm(warning)) return;
    const next = farmers.filter((x) => x.id !== f.id);
    setFarmers(next);
    await storageSet('zk:farmers', next);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8,}}>
        <div>
          <div className="zk-h1">Çiftçiler</div>
          <div className="zk-h1-sub">{farmers.length} kayıtlı çiftçi</div>
        </div>
        <button className="zk-btn zk-btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Çiftçi ekle</button>
      </div>

      <div style={{ position: 'relative', marginBottom: 14, maxWidth: 320 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: COLORS.inkSoft }} />
        <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="Çiftçi ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="zk-card">
        {filtered.length === 0 ? (
          <div className="zk-empty"><Users size={26} className="zk-empty-icon" /><br/>{farmers.length === 0 ? 'Henüz çiftçi eklenmedi.' : 'Sonuç bulunamadı.'}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filtered.map((f) => {
              const bal = balances[f.id] || 0;
              return (
                <div key={f.id} className="zk-farmer-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }} onClick={() => { setSelectedFarmerId(f.id); setTab('ledger'); }}>
                    <div className="zk-avatar">{f.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7 }}>
                        {f.name}
                        {f.bagkurStatus && <span className="zk-tag">BAĞ-KUR</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkSoft, display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                        {f.phone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{f.phone}</span>}
                        {f.tcNo && <span>TC: {f.tcNo}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`zk-badge ${bal > 0 ? 'zk-badge-red' : 'zk-badge-olive'}`}>
                      {bal > 0 ? `${fmtTL(bal)} ödenecek` : 'Bakiye kapalı'}
                    </span>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setEditingFarmer(f)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removeFarmer(f)}><Trash2 size={12} /></button>
                    <ChevronRight size={16} color={COLORS.inkSoft} onClick={() => { setSelectedFarmerId(f.id); setTab('ledger'); }} style={{ cursor: 'pointer' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && <AddFarmerModal onClose={() => setShowAdd(false)} onSave={addFarmer} />}
      {editingFarmer && <AddFarmerModal onClose={() => setEditingFarmer(null)} onSave={saveEdit} initialData={editingFarmer} />}
    </div>
  );
}
