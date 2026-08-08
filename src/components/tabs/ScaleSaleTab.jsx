import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Printer,
  X,
  Clock as ClockIcon,
  MessageCircle,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { CustomerDisplayButtons, Modal, PaymentMethodPicker, ScaleWidget } from '../common/index';
import { BuyerQuickForm } from '../modals/index';
import { fmtDate, fmtKg, fmtTL, localDateStr, nextReceiptNo, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppSaleReceiptText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function ScaleSaleTab({ buyers, setBuyers, sales, setSales, purchases, priceList, personnel, vehicles, settings, onPrintSaleReceipt, broadcastLive, openCustomerDisplay, customerDisplayUrl, bankAccounts }) {
  const [buyerId, setBuyerId] = useState('');
  const [showAddBuyer, setShowAddBuyer] = useState(false);
  const [personnelId, setPersonnelId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [now, setNow] = useState(new Date());
  const [manualDateTime, setManualDateTime] = useState(false);
  const [manualDate, setManualDate] = useState(todayStr());
  const [manualTime, setManualTime] = useState('');
  const [items, setItems] = useState([]);
  const [lineGrade, setLineGrade] = useState('');
  const [lineKg, setLineKg] = useState('');
  const [linePrice, setLinePrice] = useState('');
  const [crateWeight] = useState(settings.crateWeight ?? 2);
  const [crateCount, setCrateCount] = useState(Math.max(0, Math.min(7, settings.defaultCrateCount ?? 5)));
  const [lastSavedBatch, setLastSavedBatch] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('nakit');
  const [paymentBankAccountId, setPaymentBankAccountId] = useState('');

  const lineDara = crateCount * crateWeight;
  const adjustCrateCount = (delta) => setCrateCount((c) => Math.max(0, Math.min(7, c + delta)));

  const buyer = buyers.find((b) => b.id === buyerId);
  const date = manualDateTime ? manualDate : localDateStr(now);
  const timeLabel = manualDateTime ? (manualTime || '00:00') : now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const dateTimeLabel = fmtDate(date) + ' · ' + timeLabel;

  const startManualEdit = () => {
    setManualDate(localDateStr(now));
    setManualTime(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
    setManualDateTime(true);
  };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const purchasedByGrade = useMemo(() => {
    const map = {};
    purchases.forEach((p) => { (p.items || []).forEach((it) => { map[it.grade] = (map[it.grade] || 0) + it.kg; }); });
    return map;
  }, [purchases]);
  const soldByGrade = useMemo(() => {
    const map = {};
    sales.forEach((s) => { map[s.grade || 'Etiketsiz'] = (map[s.grade || 'Etiketsiz'] || 0) + s.kg; });
    return map;
  }, [sales]);
  const addedByGrade = useMemo(() => {
    const map = {};
    items.forEach((it) => { map[it.grade] = (map[it.grade] || 0) + it.kg; });
    return map;
  }, [items]);
  const stockByGrade = useMemo(() => {
    const grades = new Set([...Object.keys(purchasedByGrade), ...Object.keys(soldByGrade)]);
    return Array.from(grades)
      .map((g) => ({ grade: g, stock: (purchasedByGrade[g] || 0) - (soldByGrade[g] || 0) - (addedByGrade[g] || 0) }))
      .sort((a, b) => b.stock - a.stock);
  }, [purchasedByGrade, soldByGrade, addedByGrade]);

  // Her sinif icin agirlikli ortalama alis fiyati + sabit TL komisyon (satis
  // onerisi). Komisyon oran degil, Ayarlar'da girilen SABIT TL/kg tutarıdır.
  // Ornek: alis 100 TL, komisyon 6 TL ise oneri 106 TL; alis 70 TL ise 76 TL.
  const saleCommissionPerKg = parseFloat(settings?.saleCommissionPerKg) || 0;
  const avgCostByGrade = useMemo(() => {
    const sums = {};
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => {
        if (!it.grade) return;
        const kgVal = parseFloat(it.kg) || 0;
        if (kgVal <= 0) return;
        const basePrice = parseFloat(it.pricePerKg) || 0;
        if (!sums[it.grade]) sums[it.grade] = { kg: 0, cost: 0 };
        sums[it.grade].kg += kgVal;
        sums[it.grade].cost += kgVal * basePrice;
      });
    });
    const map = {};
    Object.keys(sums).forEach((g) => { map[g] = sums[g].kg > 0 ? sums[g].cost / sums[g].kg : 0; });
    return map;
  }, [purchases]);
  const costByGrade = useMemo(() => {
    const map = {};
    Object.keys(avgCostByGrade).forEach((g) => { map[g] = avgCostByGrade[g] + saleCommissionPerKg; });
    return map;
  }, [avgCostByGrade, saleCommissionPerKg]);

  useEffect(() => {
    const suggested = costByGrade[lineGrade];
    if (suggested) {
      setLinePrice((Math.round(suggested * 100) / 100).toString());
      return;
    }
    const v = priceList.find((p) => p.name === lineGrade);
    if (v && !v.hasGrades) setLinePrice(String(v.singlePrice || 0));
  }, [lineGrade, priceList, costByGrade]);

  // Kantar/kamera üzerinden canli tartim, "musteri ekrani" ikinci pencereye yayinlanir.
  useEffect(() => {
    if (!broadcastLive) return;
    const person = personnel.find((p) => p.id === personnelId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const lineNetKg = Math.max(0, (parseFloat(lineKg) || 0) - lineDara);
    const total = items.reduce((s, it) => s + it.amount, 0) + lineNetKg * (parseFloat(linePrice) || 0);
    broadcastLive({
      type: 'sale',
      partyName: buyer ? buyer.name : '',
      personnelName: person ? person.name : '',
      vehiclePlaka: vehicle ? vehicle.plaka : '',
      dateTimeLabel,
      items: items.map((it) => ({ grade: it.grade, kg: it.kg, pricePerKg: it.pricePerKg, amount: it.amount, crateCount: it.crateCount })),
      currentLine: { grade: lineGrade, kg: lineNetKg, pricePerKg: parseFloat(linePrice) || 0, crateCount },
      netKg: items.reduce((s, it) => s + it.kg, 0) + lineNetKg,
      grossAmount: total,
      deductions: null,
      netAmount: total,
    });
  }, [buyer, items, lineGrade, lineKg, linePrice, lineDara, crateCount, dateTimeLabel, broadcastLive, personnelId, vehicleId, personnel, vehicles]);

  const availableForLine = lineGrade ? (stockByGrade.find((g) => g.grade === lineGrade)?.stock ?? 0) : 0;

  const addLine = () => {
    const grossVal = parseFloat(lineKg);
    const daraVal = lineDara;
    const price = parseFloat(linePrice);
    const netVal = grossVal - daraVal;
    if (!lineGrade || !grossVal || grossVal <= 0 || netVal <= 0 || !price || price <= 0 || netVal > availableForLine + 0.001) return;
    setItems((prev) => [...prev, { id: uid(), grade: lineGrade, grossKg: grossVal, dara: daraVal, crateCount, kg: netVal, pricePerKg: price, amount: netVal * price }]);
    setLineKg('');
  };
  const removeLine = (id) => setItems((prev) => prev.filter((x) => x.id !== id));

  const netKg = items.reduce((s, it) => s + it.kg, 0);
  const totalAmount = items.reduce((s, it) => s + it.amount, 0);
  const canSave = buyerId && items.length > 0 && (paymentMethod !== 'banka' || paymentBankAccountId);

  const saveNewBuyer = async (data) => {
    if (!data.name || !data.name.trim()) return;
    const b = { id: uid(), name: data.name.trim(), phone: data.phone || '', createdAt: Date.now() };
    const next = [...buyers, b];
    setBuyers(next);
    await storageSet('zk:buyers', next);
    setShowAddBuyer(false);
    setBuyerId(b.id);
  };

  const save = async () => {
    if (!canSave) return;
    const person = personnel.find((p) => p.id === personnelId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    let counter = nextReceiptNo(sales, settings?.salesReceiptNext);
    const newRecords = items.map((it) => {
      const rec = {
        id: uid(), makbuzNo: counter, buyerId, date, grade: it.grade, kg: it.kg, pricePerKg: it.pricePerKg, amount: it.amount,
        note: '', vehicleId: vehicleId || null, vehiclePlaka: vehicle ? vehicle.plaka : '',
        personnelId: personnelId || null, personnelName: person ? person.name : '',
        paymentMethod, bankAccountId: paymentMethod === 'banka' ? paymentBankAccountId : null,
        createdAt: Date.now(),
      };
      counter += 1;
      return rec;
    });
    const next = [...sales, ...newRecords];
    setSales(next);
    await storageSet('zk:sales', next);
    setLastSavedBatch(newRecords);
    setItems([]);
    setPaymentMethod('nakit'); setPaymentBankAccountId('');
    if (broadcastLive) broadcastLive({ type: 'sale_done', partyName: buyer ? buyer.name : '', netKg, total: totalAmount, items: newRecords.map((r) => ({ grade: r.grade, kg: r.kg })) });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="zk-h1">Kantarlı Satış</div>
          <div className="zk-h1-sub">Kantar/tartı bağlantısıyla canlı tartım yaparak satış kaydı oluşturun</div>
        </div>
        {openCustomerDisplay && <CustomerDisplayButtons openCustomerDisplay={openCustomerDisplay} customerDisplayUrl={customerDisplayUrl} />}
      </div>

      <div style={{ maxWidth: 900 }}>
        <ScaleWidget onWeightCapture={(v) => setLineKg(v.toFixed(1))} compact />

        <div className="zk-card" style={{ marginTop: 14 }}>
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
              <label className="zk-label">Personel (opsiyonel)</label>
              <select className="zk-select" value={personnelId} onChange={(e) => setPersonnelId(e.target.value)}>
                <option value="">Seçin...</option>
                {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 14 }}>
            <div>
              <label className="zk-label">Araç (opsiyonel)</label>
              <select className="zk-select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">Seçin...</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plaka}</option>)}
              </select>
            </div>
            <div>
              <label className="zk-label">Tarih / Saat</label>
              {!manualDateTime ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minHeight: 44 }}>
                  <span style={{ fontSize: 12.5, color: COLORS.inkSoft, display: 'flex', alignItems: 'center', gap: 5 }}><ClockIcon size={12} /> {dateTimeLabel}</span>
                  <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 9px', fontSize: 11 }} onClick={startManualEdit}><Pencil size={11} /> Değiştir</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input className="zk-input" type="date" style={{ maxWidth: 140 }} value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                  <input className="zk-input" type="time" style={{ maxWidth: 100 }} value={manualTime} onChange={(e) => setManualTime(e.target.value)} />
                  <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => setManualDateTime(false)}><RefreshCw size={11} /> Otomatik</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Tartım satırı ekle</div>
          <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', alignItems: 'end', marginBottom: 4 }}>
            <div>
              <label className="zk-label">Sınıf</label>
              <select className="zk-select" value={lineGrade} onChange={(e) => setLineGrade(e.target.value)}>
                <option value="">Seçin...</option>
                {stockByGrade.filter((g) => g.stock > 0.01).map((g) => <option key={g.grade} value={g.grade}>{g.grade} · stokta {fmtKg(g.stock)}</option>)}
              </select>
            </div>
            <div>
              <label className="zk-label">Ölçülen (kg)</label>
              <input className="zk-input" type="text" inputMode="decimal" value={lineKg} onChange={(e) => setLineKg(e.target.value.replace(',', '.'))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLine(); } }} placeholder="0" />
            </div>
            <div>
              <label className="zk-label" style={{ textAlign: 'center' }}>Kasa</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <button className="zk-btn zk-btn-secondary" style={{ padding: '0 10px', minWidth: 34, minHeight: 44, flexShrink: 0 }} onClick={() => adjustCrateCount(-1)} disabled={crateCount <= 0}>−</button>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>
                  {crateCount}
                </div>
                <button className="zk-btn zk-btn-secondary" style={{ padding: '0 10px', minWidth: 34, minHeight: 44, flexShrink: 0 }} onClick={() => adjustCrateCount(1)} disabled={crateCount >= 7}>+</button>
              </div>
            </div>
            <div>
              <label className="zk-label">Fiyat/kg</label>
              <input className="zk-input" type="text" inputMode="decimal" value={linePrice} onChange={(e) => setLinePrice(e.target.value.replace(',', '.'))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLine(); } }} placeholder="0.00" />
              {lineGrade && costByGrade[lineGrade] > 0 && (
                <div style={{ fontSize: 10.5, color: COLORS.inkSoft, marginTop: 3 }}>
                  Alış ort. {avgCostByGrade[lineGrade]?.toFixed(2)} ₺ + komisyon {saleCommissionPerKg.toFixed(2)} ₺
                </div>
              )}
            </div>
            <div>
              <label className="zk-label" style={{ visibility: 'hidden' }}>Ekle</label>
              <button className="zk-btn zk-btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={addLine}><Plus size={14} /> Ekle</button>
            </div>
          </div>
          {lineKg && (
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 8 }}>
              Net: {fmtKg(Math.max((parseFloat(lineKg) || 0) - lineDara, 0))}
            </div>
          )}
          {lineGrade && Math.max((parseFloat(lineKg) || 0) - lineDara, 0) > availableForLine && lineKg && (
            <div style={{ fontSize: 11.5, color: COLORS.red, marginBottom: 8 }}>Bu sınıfta stoktan fazla miktar girdiniz (stokta {fmtKg(availableForLine)}).</div>
          )}

          {items.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {items.map((it) => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px dashed ${COLORS.border}`, fontSize: 12.5 }}>
                  <span>{it.grade} · {fmtKg(it.kg)} × {fmtTL(it.pricePerKg)}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{fmtTL(it.amount)}</span>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 7px' }} onClick={() => removeLine(it.id)}><X size={11} /></button>
                  </div>
                </div>
              ))}
              {(() => {
                const groups = {};
                items.forEach((it) => {
                  if (!groups[it.grade]) groups[it.grade] = { kg: 0, amount: 0 };
                  groups[it.grade].kg += it.kg;
                  groups[it.grade].amount += it.amount;
                });
                const gradeNames = Object.keys(groups);
                if (items.length <= 1) return null;
                return (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 4 }}>Sınıf bazında toplam</div>
                    {gradeNames.map((g) => (
                      <div key={g} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                        <span>{g}</span>
                        <span style={{ fontWeight: 600 }}>{fmtKg(groups[g].kg)} · {fmtTL(groups[g].amount)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
            <span style={{ color: COLORS.inkSoft }}>Toplam {fmtKg(netKg)}</span>
            <span style={{ fontWeight: 700 }}>{fmtTL(totalAmount)}</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Ödeme yöntemi</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <PaymentMethodPicker method={paymentMethod} setMethod={setPaymentMethod} bankAccountId={paymentBankAccountId} setBankAccountId={setPaymentBankAccountId} bankAccounts={bankAccounts} />
            </div>
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!canSave} onClick={save}>
            Satışı kaydet
          </button>

          {lastSavedBatch && lastSavedBatch.length > 0 && (() => {
            const waPhone = buyer ? formatPhoneForWhatsApp(buyer.phone) : null;
            return (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lastSavedBatch.map((rec) => (
                  <div key={rec.id} style={{ background: COLORS.oliveSoft, padding: '10px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 12, color: COLORS.olive }}>Satış #{rec.makbuzNo} — {rec.grade} · {fmtTL(rec.amount)}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="zk-btn zk-btn-secondary" onClick={() => onPrintSaleReceipt(rec)}><Printer size={13} /> Yazdır</button>
                      {waPhone && (
                        <a className="zk-btn" style={{ background: '#25D366', color: '#fff' }} href={`https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsAppSaleReceiptText(rec, buyer, settings))}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {showAddBuyer && (
        <Modal title="Yeni alıcı ekle" onClose={() => setShowAddBuyer(false)}>
          <BuyerQuickForm onSave={saveNewBuyer} />
        </Modal>
      )}
    </div>
  );
}
