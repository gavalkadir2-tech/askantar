import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  MessageCircle,
  Trash2,
  Pencil,
} from 'lucide-react';
import { ListFooterControls, SortableTh } from '../common/index';
import { AddCariModal } from '../modals/index';
import { LedgerTab } from './LedgerTab';
import { BuyerLedgerTab } from './BuyerLedgerTab';
import { usePagedList, useSortableColumns, useBuyerLedger, computeAging } from '../../hooks/index';
import { fmtTL, storageSet, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppBalanceReminderText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function CariTab({ farmers, setFarmers, buyers, setBuyers, purchases, payments, setPayments, sales, selectedFarmerId, setSelectedFarmerId, onPrintReceipt, settings, buyerPayments, setBuyerPayments, onPrintSaleReceipt, activityLog, setActivityLog }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState(null);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [viewingLedger, setViewingLedger] = useState(false);
  const [viewingBuyerId, setViewingBuyerId] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('');
  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns('name', 'asc');

  const farmerBalances = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.id] = 0; });
    purchases.forEach((p) => { map[p.farmerId] = (map[p.farmerId] || 0) + p.netPayment; });
    payments.forEach((pay) => { map[pay.farmerId] = (map[pay.farmerId] || 0) - pay.amount; });
    return map;
  }, [farmers, purchases, payments]);

  const buyerBalances = useBuyerLedger(buyers, sales, buyerPayments, setBuyerPayments).buyerBalances;

  const getAging = (c) => {
    if (c.type === 'tedarikci') {
      const debits = purchases.filter((x) => x.farmerId === c.id).map((x) => ({ amount: x.netPayment, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
      const credits = payments.filter((x) => x.farmerId === c.id).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
      return computeAging(debits, credits);
    }
    const debits = sales.filter((x) => x.buyerId === c.id).map((x) => ({ amount: x.amount, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
    const credits = (buyerPayments || []).filter((x) => x.buyerId === c.id).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
    return computeAging(debits, credits);
  };

  const combined = useMemo(() => {
    const f = farmers.map((x) => ({ id: x.id, name: x.name, phone: x.phone, address: x.address || '', type: 'tedarikci', raw: x }));
    const b = buyers.map((x) => ({ id: x.id, name: x.name, phone: x.phone, address: x.address || '', type: 'cari', raw: x }));
    let arr = [...f, ...b].filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone || '').includes(query) || (c.address || '').toLowerCase().includes(query.toLowerCase()) || (c.raw.bankName || '').toLowerCase().includes(query.toLowerCase()) || (c.raw.iban || '').toLowerCase().includes(query.toLowerCase()));
    if (typeFilter) arr = arr.filter((c) => c.type === typeFilter);
    if (balanceFilter === 'has') arr = arr.filter((c) => (c.type === 'tedarikci' ? (farmerBalances[c.id] || 0) : (buyerBalances[c.id] || 0)) > 0);
    else if (balanceFilter === 'closed') arr = arr.filter((c) => (c.type === 'tedarikci' ? (farmerBalances[c.id] || 0) : (buyerBalances[c.id] || 0)) <= 0);
    return sortRows(arr, (c, key) => (key === 'balance' ? (c.type === 'tedarikci' ? (farmerBalances[c.id] || 0) : (buyerBalances[c.id] || 0)) : c[key]));
  }, [farmers, buyers, query, sortRows, typeFilter, balanceFilter, farmerBalances, buyerBalances]);

  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(combined);

  const openLedger = (farmerId) => { setSelectedFarmerId(farmerId); setViewingLedger(true); };
  const closeLedger = () => { setViewingLedger(false); setSelectedFarmerId(''); };
  const openBuyerLedger = (buyerId) => { setViewingBuyerId(buyerId); };
  const closeBuyerLedger = () => { setViewingBuyerId(''); };

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
          activityLog={activityLog} setActivityLog={setActivityLog}
        />
      </div>
    );
  }

  if (viewingBuyerId) {
    return (
      <div>
        <button className="zk-btn zk-btn-secondary" style={{ marginBottom: 14 }} onClick={closeBuyerLedger}>← Cariler listesine dön</button>
        <BuyerLedgerTab
          buyers={buyers} sales={sales} buyerPayments={buyerPayments} setBuyerPayments={setBuyerPayments}
          selectedBuyerId={viewingBuyerId} setSelectedBuyerId={setViewingBuyerId}
          onPrintSaleReceipt={onPrintSaleReceipt} settings={settings}
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
          <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="İsim, telefon, adres veya bankaya göre ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
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
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="İsim" sortKeyName="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Tür</th>
                <th>Telefon</th>
                <th>Adres</th>
                <th>Banka</th>
                <SortableTh label="Bakiye" sortKeyName="balance" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => {
                const bal = c.type === 'tedarikci' ? (farmerBalances[c.id] || 0) : (buyerBalances[c.id] || 0);
                const aging = bal > 0 ? getAging(c) : null;
                return (
                  <tr
                    key={`${c.type}-${c.id}`} style={{ cursor: 'pointer' }}
                    onClick={() => (c.type === 'tedarikci' ? openLedger(c.id) : openBuyerLedger(c.id))}
                  >
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td><span className={`zk-badge ${c.type === 'tedarikci' ? 'zk-badge-olive' : 'zk-badge-blue'}`}>{c.type === 'tedarikci' ? 'Tedarikçi' : 'Cari'}</span></td>
                    <td style={{ color: COLORS.inkSoft }}>{c.phone || '—'}</td>
                    <td style={{ color: COLORS.inkSoft }}>{c.address || '—'}</td>
                    <td style={{ color: COLORS.inkSoft, fontSize: 11 }} title={c.raw?.iban || ''}>{c.raw?.bankName || '—'}</td>
                    <td>
                      <span className={`zk-badge ${bal > 0 ? 'zk-badge-red' : 'zk-badge-olive'}`}>
                        {bal > 0 ? fmtTL(bal) : 'Kapalı'}
                      </span>
                      {aging?.isOverdue && (
                        <span className="zk-badge" style={{ marginLeft: 4, background: '#3d0f0f', color: '#fff', fontSize: 10 }} title={`Vade: ${aging.oldestUnpaidDate}`}>
                          {aging.daysOverdue} gün gecikti
                        </span>
                      )}
                    </td>
                    <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      {c.type === 'tedarikci' && bal > 0 && formatPhoneForWhatsApp(c.phone) && (
                        <a
                          className="zk-btn" style={{ padding: '5px 8px', background: '#25D366', color: '#fff' }}
                          href={`https://wa.me/${formatPhoneForWhatsApp(c.phone)}?text=${encodeURIComponent(buildWhatsAppBalanceReminderText(c.raw, bal, purchases.filter((p) => p.farmerId === c.id).sort((a, b) => b.createdAt - a.createdAt), settings))}`}
                          target="_blank" rel="noopener noreferrer" title="WhatsApp ile bakiye hatırlat"
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ListFooterControls
            page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} totalCount={totalCount}
          />
          </>
        )}
      </div>

      {showAdd && <AddCariModal farmers={farmers} buyers={buyers} onClose={() => setShowAdd(false)} onSave={addCari} />}
      {editingFarmer && <AddCariModal lockType="tedarikci" farmers={farmers} initialData={{ ...editingFarmer, type: 'tedarikci' }} onClose={() => setEditingFarmer(null)} onSave={saveFarmerEdit} />}
      {editingBuyer && <AddCariModal lockType="cari" buyers={buyers} initialData={{ ...editingBuyer, type: 'cari' }} onClose={() => setEditingBuyer(null)} onSave={saveBuyerEdit} />}
    </div>
  );
}
