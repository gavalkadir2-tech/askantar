import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  ChevronRight,
  MessageCircle,
  Trash2,
  Pencil,
} from 'lucide-react';
import { ListFooterControls } from '../common/index';
import { AddCariModal } from '../modals/index';
import { LedgerTab } from './LedgerTab';
import { usePagedList } from '../../hooks/index';
import { fmtTL, storageSet, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppBalanceReminderText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function CariTab({ farmers, setFarmers, buyers, setBuyers, purchases, payments, setPayments, sales, selectedFarmerId, setSelectedFarmerId, onPrintReceipt, settings }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState(null);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [viewingLedger, setViewingLedger] = useState(false);
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('name_asc');
  const [typeFilter, setTypeFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('');

  const farmerBalances = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.id] = 0; });
    purchases.forEach((p) => { map[p.farmerId] = (map[p.farmerId] || 0) + p.netPayment; });
    payments.forEach((pay) => { map[pay.farmerId] = (map[pay.farmerId] || 0) - pay.amount; });
    return map;
  }, [farmers, purchases, payments]);

  const combined = useMemo(() => {
    const f = farmers.map((x) => ({ id: x.id, name: x.name, phone: x.phone, type: 'tedarikci', raw: x }));
    const b = buyers.map((x) => ({ id: x.id, name: x.name, phone: x.phone, type: 'cari', raw: x }));
    let arr = [...f, ...b].filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone || '').includes(query));
    if (typeFilter) arr = arr.filter((c) => c.type === typeFilter);
    if (balanceFilter === 'has') arr = arr.filter((c) => c.type === 'tedarikci' && (farmerBalances[c.id] || 0) > 0);
    else if (balanceFilter === 'closed') arr = arr.filter((c) => c.type !== 'tedarikci' || (farmerBalances[c.id] || 0) <= 0);
    if (sortOrder === 'name_desc') arr.sort((a, b2) => b2.name.localeCompare(a.name, 'tr'));
    else if (sortOrder === 'balance_desc') arr.sort((a, b2) => (farmerBalances[b2.id] || 0) - (farmerBalances[a.id] || 0));
    else arr.sort((a, b2) => a.name.localeCompare(b2.name, 'tr'));
    return arr;
  }, [farmers, buyers, query, sortOrder, typeFilter, balanceFilter, farmerBalances]);

  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(combined);

  const openLedger = (farmerId) => { setSelectedFarmerId(farmerId); setViewingLedger(true); };
  const closeLedger = () => { setViewingLedger(false); setSelectedFarmerId(''); };

  const addCari = async (data) => {
    if (data.type === 'tedarikci') {
      const rec = { id: uid(), name: data.name, phone: data.phone || '', tcNo: data.tcNo || '', address: data.address || '', bagkurStatus: !!data.bagkurStatus, createdAt: Date.now() };
      const next = [...farmers, rec];
      setFarmers(next);
      await storageSet('zk:farmers', next);
    } else {
      const rec = { id: uid(), name: data.name, phone: data.phone || '', createdAt: Date.now() };
      const next = [...buyers, rec];
      setBuyers(next);
      await storageSet('zk:buyers', next);
    }
    setShowAdd(false);
  };

  const saveFarmerEdit = async (data) => {
    const next = farmers.map((x) => (x.id === editingFarmer.id ? { ...x, ...data } : x));
    setFarmers(next);
    await storageSet('zk:farmers', next);
    setEditingFarmer(null);
  };

  const saveBuyerEdit = async (data) => {
    const next = buyers.map((x) => (x.id === editingBuyer.id ? { ...x, name: data.name, phone: data.phone } : x));
    setBuyers(next);
    await storageSet('zk:buyers', next);
    setEditingBuyer(null);
  };

  const removeCari = async (c) => {
    if (c.type === 'tedarikci') {
      const hasHistory = purchases.some((p) => p.farmerId === c.id) || payments.some((p) => p.farmerId === c.id);
      const msg = hasHistory
        ? `${c.name} adına kayıtlı alım/ödeme geçmişi var. Yine de silmek istediğinize emin misiniz?`
        : `${c.name} adlı tedarikçiyi silmek istediğinize emin misiniz?`;
      if (!window.confirm(msg)) return;
      const next = farmers.filter((x) => x.id !== c.id);
      setFarmers(next);
      await storageSet('zk:farmers', next);
    } else {
      const hasHistory = sales.some((s) => s.buyerId === c.id);
      const msg = hasHistory
        ? `${c.name} adına kayıtlı satış geçmişi var. Yine de silmek istediğinize emin misiniz?`
        : `${c.name} adlı cariyi silmek istediğinize emin misiniz?`;
      if (!window.confirm(msg)) return;
      const next = buyers.filter((x) => x.id !== c.id);
      setBuyers(next);
      await storageSet('zk:buyers', next);
    }
  };

  if (viewingLedger && selectedFarmerId) {
    return (
      <div>
        <button className="zk-btn zk-btn-secondary" style={{ marginBottom: 14 }} onClick={closeLedger}>← Cariler listesine dön</button>
        <LedgerTab
          farmers={farmers} purchases={purchases} payments={payments} setPayments={setPayments}
          selectedFarmerId={selectedFarmerId} setSelectedFarmerId={setSelectedFarmerId}
          onPrintReceipt={onPrintReceipt} settings={settings}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="zk-h1">Cariler</div>
          <div className="zk-h1-sub">{combined.length} kayıtlı cari — tedarikçi (çiftçi) ve müşteri (alıcı) bir arada</div>
        </div>
        <button className="zk-btn zk-btn-primary" onClick={() => setShowAdd(true)}><Plus size={14} /> Cari ekle</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: '2 1 220px', maxWidth: 320 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: COLORS.inkSoft }} />
          <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="İsim veya telefon ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="zk-select" style={{ flex: '1 1 140px', maxWidth: 170 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tümü (tedarikçi + cari)</option>
          <option value="tedarikci">Sadece tedarikçi</option>
          <option value="cari">Sadece cari</option>
        </select>
        <select className="zk-select" style={{ flex: '1 1 160px', maxWidth: 190 }} value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}>
          <option value="">Tüm bakiyeler</option>
          <option value="has">Alacağı olanlar</option>
          <option value="closed">Bakiyesi kapalı olanlar</option>
        </select>
      </div>

      <div className="zk-card">
        {combined.length === 0 ? (
          <div className="zk-empty"><Users size={26} className="zk-empty-icon" /><br/>Henüz cari eklenmedi.</div>
        ) : (
          <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {paged.map((c) => {
              const bal = c.type === 'tedarikci' ? (farmerBalances[c.id] || 0) : null;
              return (
                <div key={`${c.type}-${c.id}`} className="zk-farmer-row">
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }}
                    onClick={() => (c.type === 'tedarikci' ? openLedger(c.id) : setEditingBuyer(c.raw))}
                  >
                    <div className="zk-avatar">{c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 7 }}>
                        {c.name}
                        <span className={`zk-badge ${c.type === 'tedarikci' ? 'zk-badge-olive' : 'zk-badge-blue'}`} style={{ fontSize: 10 }}>
                          {c.type === 'tedarikci' ? 'Tedarikçi' : 'Cari'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 2 }}>{c.phone || 'Telefon kayıtlı değil'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c.type === 'tedarikci' && (
                      <span className={`zk-badge ${bal > 0 ? 'zk-badge-red' : 'zk-badge-olive'}`}>
                        {bal > 0 ? `${fmtTL(bal)} ödenecek` : 'Bakiye kapalı'}
                      </span>
                    )}
                    {c.type === 'tedarikci' && bal > 0 && formatPhoneForWhatsApp(c.phone) && (
                      <a
                        className="zk-btn" style={{ padding: '5px 8px', background: '#25D366', color: '#fff' }}
                        href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}?text=${encodeURIComponent(buildWhatsAppBalanceReminderText(c.raw, bal, purchases.filter((p) => p.farmerId === c.id).sort((a, b) => b.createdAt - a.createdAt), settings))}`}
                        target="_blank" rel="noopener noreferrer" title="WhatsApp ile bakiye hatırlat" onClick={(e) => e.stopPropagation()}
                      >
                        <MessageCircle size={12} />
                      </a>
                    )}
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => (c.type === 'tedarikci' ? setEditingFarmer(c.raw) : setEditingBuyer(c.raw))}>
                      <Pencil size={12} />
                    </button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removeCari(c)}>
                      <Trash2 size={12} />
                    </button>
                    {c.type === 'tedarikci' && <ChevronRight size={16} color={COLORS.inkSoft} style={{ cursor: 'pointer' }} onClick={() => openLedger(c.id)} />}
                  </div>
                </div>
              );
            })}
          </div>
          <ListFooterControls
            sortOrder={sortOrder} setSortOrder={setSortOrder}
            sortOptions={[
              { value: 'name_asc', label: 'İsim: A → Z' },
              { value: 'name_desc', label: 'İsim: Z → A' },
              { value: 'balance_desc', label: 'Bakiye: Büyük → Küçük' },
            ]}
            page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} totalCount={totalCount}
          />
          </>
        )}
      </div>

      {showAdd && <AddCariModal onClose={() => setShowAdd(false)} onSave={addCari} />}
      {editingFarmer && <AddCariModal lockType="tedarikci" initialData={{ ...editingFarmer, type: 'tedarikci' }} onClose={() => setEditingFarmer(null)} onSave={saveFarmerEdit} />}
      {editingBuyer && <AddCariModal lockType="cari" initialData={{ ...editingBuyer, type: 'cari' }} onClose={() => setEditingBuyer(null)} onSave={saveBuyerEdit} />}
    </div>
  );
}
