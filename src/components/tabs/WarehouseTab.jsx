import React, { useState, useMemo } from 'react';
import {
  Warehouse,
  Plus,
  Printer,
  ChevronRight,
  Package,
  ShoppingCart,
  MessageCircle,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Modal, PaymentMethodPicker, StatCard } from '../common/index';
import { AddVehicleModal } from '../modals/index';
import { fmtDate, fmtKg, fmtTL, nextReceiptNo, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppSaleReceiptText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function WarehouseTab({ purchases, buyers, setBuyers, sales, setSales, vehicles, setVehicles, personnel, settings, onPrintSaleReceipt, buyerPayments, setBuyerPayments, bankAccounts }) {
  const [showAddBuyer, setShowAddBuyer] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');

  const [buyerId, setBuyerId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [grade, setGrade] = useState('');
  const [kg, setKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [vade, setVade] = useState('');
  const [note, setNote] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('nakit');
  const [paymentBankAccountId, setPaymentBankAccountId] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [collectionAmount, setCollectionAmount] = useState('');
  const [collectionNote, setCollectionNote] = useState('');
  const [viewingBuyerId, setViewingBuyerId] = useState('');
  const [detailCollectionAmount, setDetailCollectionAmount] = useState('');
  const [detailCollectionNote, setDetailCollectionNote] = useState('');

  const totalPurchasedKg = purchases.reduce((s, p) => s + p.netKg, 0);
  const totalSoldKg = sales.reduce((s, s2) => s + s2.kg, 0);
  const currentStock = totalPurchasedKg - totalSoldKg;

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

  const costByGrade = useMemo(() => {
    const sums = {};
    purchases.forEach((p) => {
      const commissionPerKg = parseFloat(p.commissionRate) || 0;
      (p.items || []).forEach((it) => {
        if (!it.grade) return;
        const kgVal = parseFloat(it.kg) || 0;
        if (kgVal <= 0) return;
        const costPerKg = (parseFloat(it.pricePerKg) || 0) + commissionPerKg;
        if (!sums[it.grade]) sums[it.grade] = { kg: 0, cost: 0 };
        sums[it.grade].kg += kgVal;
        sums[it.grade].cost += kgVal * costPerKg;
      });
    });
    const map = {};
    Object.keys(sums).forEach((g) => { map[g] = sums[g].kg > 0 ? sums[g].cost / sums[g].kg : 0; });
    return map;
  }, [purchases]);

  const handleGradeChange = (value) => {
    setGrade(value);
    const suggested = costByGrade[value];
    if (suggested) setPricePerKg((Math.round(suggested * 100) / 100).toString());
  };

  const availableForGrade = grade ? (purchasedByGrade[grade] || 0) - (soldByGrade[grade] || 0) : 0;
  const amount = (parseFloat(kg) || 0) * (parseFloat(pricePerKg) || 0);
  const canSave = buyerId && grade && parseFloat(kg) > 0 && parseFloat(pricePerKg) > 0 && parseFloat(kg) <= availableForGrade + 0.001 && (paymentMethod !== 'banka' || paymentBankAccountId);

  const addBuyer = async () => {
    if (!buyerName.trim()) return;
    const b = { id: uid(), name: buyerName.trim(), phone: buyerPhone.trim(), createdAt: Date.now() };
    const next = [...buyers, b];
    setBuyers(next);
    await storageSet('zk:buyers', next);
    setBuyerName(''); setBuyerPhone(''); setShowAddBuyer(false);
    setBuyerId(b.id);
  };

  const removeBuyer = async (b) => {
    const hasHistory = sales.some((s) => s.buyerId === b.id);
    const msg = hasHistory
      ? `${b.name} adına kayıtlı satış geçmişi var. Yine de silmek istediğinize emin misiniz?`
      : `${b.name} adlı alıcıyı silmek istediğinize emin misiniz?`;
    if (!window.confirm(msg)) return;
    const next = buyers.filter((x) => x.id !== b.id);
    setBuyers(next);
    await storageSet('zk:buyers', next);
  };

  const handleVehicleSelect = (value) => {
    if (value === '__add_new__') { setShowAddVehicle(true); return; }
    setVehicleId(value);
  };

  const saveNewVehicle = async (data) => {
    if (!data.plaka || !data.plaka.trim()) return;
    const newVehicle = { id: uid(), plaka: data.plaka.trim(), marka: data.marka || '', kapasite: data.kapasite || 0, defaultPersonnelId: data.defaultPersonnelId || '', createdAt: Date.now() };
    const next = [...vehicles, newVehicle];
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    setShowAddVehicle(false);
    setVehicleId(newVehicle.id);
  };

  const saveSale = async () => {
    if (!canSave) return;
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const record = {
      id: uid(), makbuzNo: nextReceiptNo(sales, settings?.salesReceiptNext), buyerId, date, grade,
      kg: parseFloat(kg), pricePerKg: parseFloat(pricePerKg), amount, note,
      vehicleId: vehicleId || null, vehiclePlaka: vehicle ? vehicle.plaka : '',
      paymentMethod, bankAccountId: paymentMethod === 'banka' ? paymentBankAccountId : null,
      createdAt: Date.now(),
    };
    const next = [...sales, record];
    setSales(next);
    await storageSet('zk:sales', next);
    setLastSaved(record);
    setKg(''); setPricePerKg(''); setNote('');
    setPaymentMethod('nakit'); setPaymentBankAccountId('');
  };

  const buyerBalances = useMemo(() => {
    const map = {};
    buyers.forEach((b) => { map[b.id] = 0; });
    sales.forEach((s) => { map[s.buyerId] = (map[s.buyerId] || 0) + s.amount; });
    (buyerPayments || []).forEach((p) => { map[p.buyerId] = (map[p.buyerId] || 0) - p.amount; });
    return map;
  }, [buyers, sales, buyerPayments]);

  const addCollection = async (buyerId2) => {
    const amt = parseFloat(collectionAmount);
    if (!amt || amt <= 0) return;
    const record = { id: uid(), buyerId: buyerId2, date: todayStr(), amount: amt, note: collectionNote, createdAt: Date.now() };
    const next = [...(buyerPayments || []), record];
    setBuyerPayments(next);
    await storageSet('zk:buyerPayments', next);
    setCollectionAmount(''); setCollectionNote('');
  };

  return (
    <div>
      <div className="zk-h1">Satış</div>
      <div className="zk-h1-sub">Yeni satış kaydı ve alıcı yönetimi</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Toplam alınan" value={fmtKg(totalPurchasedKg)} icon={Package} />
        <StatCard label="Toplam satılan" value={fmtKg(totalSoldKg)} icon={ShoppingCart} />
        <StatCard label="Mevcut stok" value={fmtKg(currentStock)} tone={COLORS.blue} icon={Warehouse} />
      </div>

      <div style={{ maxWidth: 900 }}>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni satış</div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Alıcı</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="zk-select" value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                  <option value="">Seçin...</option>
                  {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button className="zk-btn zk-btn-secondary" onClick={() => setShowAddBuyer(true)}><Plus size={13} /></button>
              </div>
            </div>
            <div>
              <label className="zk-label">Tarih</label>
              <input className="zk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Sınıf / numara</label>
            <select className="zk-select" value={grade} onChange={(e) => handleGradeChange(e.target.value)}>
              <option value="">Seçin...</option>
              {stockByGrade.filter((g) => g.stock > 0.01).map((g) => <option key={g.grade} value={g.grade}>{g.grade} · stokta {fmtKg(g.stock)}</option>)}
            </select>
          </div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Miktar (kg){grade ? ` · stokta ${fmtKg(availableForGrade)}` : ''}</label>
              <input className="zk-input" type="text" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value.replace(',', '.'))} placeholder="0" />
            </div>
            <div>
              <label className="zk-label">Kg fiyatı (TL)</label>
              <input className="zk-input" type="text" inputMode="decimal" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value.replace(',', '.'))} placeholder="0.00" />
              {grade && costByGrade[grade] > 0 && (
                <div style={{ fontSize: 10.5, color: COLORS.inkSoft, marginTop: 3 }}>
                  Alış + komisyona göre önerilen: {costByGrade[grade].toFixed(2)} ₺ — isterseniz değiştirebilirsiniz.
                </div>
              )}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Teslimatı yapan araç (opsiyonel)</label>
            <select className="zk-select" value={vehicleId} onChange={(e) => handleVehicleSelect(e.target.value)}>
              <option value="">Seçin...</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plaka}</option>)}
              <option value="__add_new__">+ Yeni araç ekle</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Not</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsiyonel" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13, flexWrap: 'wrap', gap: 8,}}>
            <span style={{ color: COLORS.inkSoft }}>Toplam tutar</span>
            <span style={{ fontWeight: 700 }}>{fmtTL(amount)}</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Ödeme yöntemi</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PaymentMethodPicker method={paymentMethod} setMethod={setPaymentMethod} bankAccountId={paymentBankAccountId} setBankAccountId={setPaymentBankAccountId} bankAccounts={bankAccounts} />
            </div>
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!canSave} onClick={saveSale}>
            Satışı kaydet
          </button>
          {grade && parseFloat(kg) > availableForGrade && kg && (
            <div style={{ fontSize: 11.5, color: COLORS.red, marginTop: 8 }}>Bu sınıfta stoktan fazla miktar girdiniz.</div>
          )}

          {lastSaved && (() => {
            const lastSavedBuyer = buyers.find((b) => b.id === lastSaved.buyerId);
            const waPhone = lastSavedBuyer ? formatPhoneForWhatsApp(lastSavedBuyer.phone) : null;
            const waHref = waPhone
              ? `https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsAppSaleReceiptText(lastSaved, lastSavedBuyer, settings))}`
              : null;
            return (
              <div style={{ marginTop: 12, background: COLORS.oliveSoft, padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: COLORS.olive }}>Satış #{lastSaved.makbuzNo} kaydedildi.</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="zk-btn zk-btn-secondary" onClick={() => onPrintSaleReceipt(lastSaved)}><Printer size={13} /> Yazdır</button>
                    {waHref ? (
                      <a className="zk-btn" style={{ background: '#25D366', color: '#fff' }} href={waHref} target="_blank" rel="noopener noreferrer">
                        <MessageCircle size={13} /> WhatsApp'tan gönder
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: COLORS.inkSoft, alignSelf: 'center' }}>Alıcının telefonu kayıtlı değil</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8 }}>
                  <span style={{ fontSize: 11.5, color: COLORS.inkSoft }}>Hemen tahsilat al:</span>
                  <input className="zk-input" type="text" inputMode="decimal" placeholder="Tutar (TL)" style={{ maxWidth: 130 }} value={collectionAmount} onChange={(e) => setCollectionAmount(e.target.value.replace(',', '.'))} />
                  <input className="zk-input" placeholder="Not (opsiyonel)" style={{ maxWidth: 150 }} value={collectionNote} onChange={(e) => setCollectionNote(e.target.value)} />
                  <button className="zk-btn zk-btn-primary" style={{ padding: '6px 12px' }} onClick={() => addCollection(lastSaved.buyerId)}>Tahsilatı kaydet</button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {viewingBuyerId ? (() => {
        const buyer = buyers.find((b) => b.id === viewingBuyerId);
        if (!buyer) return null;
        const buyerSales = sales.filter((s) => s.buyerId === viewingBuyerId).sort((a, b) => b.createdAt - a.createdAt);
        const buyerColls = (buyerPayments || []).filter((p) => p.buyerId === viewingBuyerId).sort((a, b) => b.createdAt - a.createdAt);
        const bal = buyerBalances[viewingBuyerId] || 0;
        const addDetailCollection = async () => {
          const amt = parseFloat(detailCollectionAmount);
          if (!amt || amt <= 0) return;
          const record = { id: uid(), buyerId: viewingBuyerId, date: todayStr(), amount: amt, note: detailCollectionNote, createdAt: Date.now() };
          const next = [...(buyerPayments || []), record];
          setBuyerPayments(next);
          await storageSet('zk:buyerPayments', next);
          setDetailCollectionAmount(''); setDetailCollectionNote('');
        };
        return (
          <div className="zk-card" style={{ marginTop: 16 }}>
            <button className="zk-btn zk-btn-secondary" style={{ marginBottom: 14 }} onClick={() => setViewingBuyerId('')}>← Alıcılar listesine dön</button>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{buyer.name}</div>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 14 }}>{buyer.phone || 'Telefon kayıtlı değil'}</div>
            <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', marginBottom: 16 }}>
              <StatCard label="Toplam satış" value={fmtTL(buyerSales.reduce((s, x) => s + x.amount, 0))} />
              <StatCard label="Toplam tahsilat" value={fmtTL(buyerColls.reduce((s, x) => s + x.amount, 0))} tone={COLORS.blue} />
              <StatCard label="Kalan bakiye" value={fmtTL(bal)} tone={bal > 0 ? COLORS.red : COLORS.olive} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16, background: COLORS.paper, borderRadius: 8, padding: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Tahsilat ekle:</span>
              <input className="zk-input" type="text" inputMode="decimal" placeholder="Tutar (TL)" style={{ maxWidth: 140 }} value={detailCollectionAmount} onChange={(e) => setDetailCollectionAmount(e.target.value.replace(',', '.'))} />
              <input className="zk-input" placeholder="Not (opsiyonel)" style={{ maxWidth: 160 }} value={detailCollectionNote} onChange={(e) => setDetailCollectionNote(e.target.value)} />
              <button className="zk-btn zk-btn-primary" onClick={addDetailCollection}>Ekle</button>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Hareketler</div>
            {[...buyerSales.map((s) => ({ ...s, kind: 'satış' })), ...buyerColls.map((c) => ({ ...c, kind: 'tahsilat' }))]
              .sort((a, b) => b.createdAt - a.createdAt).length === 0 ? (
              <div className="zk-empty">Henüz hareket yok.</div>
            ) : (
              <table className="zk-table">
                <thead><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Not</th></tr></thead>
                <tbody>
                  {[...buyerSales.map((s) => ({ ...s, kind: 'satış' })), ...buyerColls.map((c) => ({ ...c, kind: 'tahsilat' }))]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((row) => (
                      <tr key={`${row.kind}-${row.id}`}>
                        <td>{fmtDate(row.date)}</td>
                        <td><span className={`zk-badge ${row.kind === 'satış' ? 'zk-badge-blue' : 'zk-badge-olive'}`}>{row.kind === 'satış' ? 'Satış' : 'Tahsilat'}</span></td>
                        <td style={{ fontWeight: 600 }}>{row.kind === 'satış' ? fmtTL(row.amount) : `− ${fmtTL(row.amount)}`}</td>
                        <td style={{ color: COLORS.inkSoft }}>{row.note || (row.kind === 'satış' ? row.grade : '') || '—'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })() : (
      <div className="zk-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Alıcılar</div>
        <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: -4, marginBottom: 10 }}>Bir alıcıya tıklayarak bakiyesini ve tahsilat geçmişini görebilirsiniz.</div>
        {buyers.length === 0 ? (
          <div className="zk-empty">Henüz alıcı eklenmedi.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {buyers.map((b) => {
              const bal = buyerBalances[b.id] || 0;
              return (
                <div key={b.id} className="zk-farmer-row">
                  <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setViewingBuyerId(b.id)}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.name}</div>
                    {b.phone && <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{b.phone}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {bal > 0 && <span className="zk-badge zk-badge-red">{fmtTL(bal)} bekliyor</span>}
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setEditingBuyer(b)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removeBuyer(b)}><Trash2 size={12} /></button>
                    <ChevronRight size={16} color={COLORS.inkSoft} style={{ cursor: 'pointer' }} onClick={() => setViewingBuyerId(b.id)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {showAddBuyer && (
        <Modal title="Yeni alıcı ekle" onClose={() => setShowAddBuyer(false)}>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Alıcı / firma adı</label>
            <input className="zk-input" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="örn. Ege Zeytinyağı A.Ş." autoFocus />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="zk-label">Telefon (opsiyonel)</label>
            <input className="zk-input" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} />
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addBuyer}>Kaydet</button>
        </Modal>
      )}
      {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSave={saveNewVehicle} personnel={personnel} />}
      {editingBuyer && (
        <Modal title="Alıcıyı düzenle" onClose={() => setEditingBuyer(null)}>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Alıcı / firma adı</label>
            <input className="zk-input" value={editingBuyer.name} onChange={(e) => setEditingBuyer({ ...editingBuyer, name: e.target.value })} autoFocus />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="zk-label">Telefon (opsiyonel)</label>
            <input className="zk-input" value={editingBuyer.phone || ''} onChange={(e) => setEditingBuyer({ ...editingBuyer, phone: e.target.value })} />
          </div>
          <button
            className="zk-btn zk-btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={async () => {
              const next = buyers.map((x) => (x.id === editingBuyer.id ? editingBuyer : x));
              setBuyers(next);
              await storageSet('zk:buyers', next);
              setEditingBuyer(null);
            }}
          >
            Kaydet
          </button>
        </Modal>
      )}
    </div>
  );
}
