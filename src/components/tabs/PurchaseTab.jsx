import React, { useState, useEffect } from 'react';
import { downloadReceiptPdf } from '../../pdfHelper.js';
import {
  Plus,
  Printer,
  X,
  Download,
  Clock as ClockIcon,
  Upload,
  MessageCircle,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { CustomerDisplayButtons, ScaleWidget } from '../common/index';
import { AddFarmerModal, AddPersonnelModal, AddVehicleModal } from '../modals/index';
import { fmtDate, fmtKg, fmtTL, localDateStr, nextReceiptNo, stopajOraniHesapla, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppReceiptText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function PurchaseTab({ farmers, setFarmers, purchases, setPurchases, onPrintReceipt, settings, priceList, personnel, setPersonnel, vehicles, setVehicles, broadcastLive, openCustomerDisplay, customerDisplayUrl }) {
  const [farmerId, setFarmerId] = useState('');
  const [showAddFarmer, setShowAddFarmer] = useState(false);
  const [personnelId, setPersonnelId] = useState('');
  const [showAddPersonnel, setShowAddPersonnel] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [now, setNow] = useState(new Date());
  const [manualDateTime, setManualDateTime] = useState(false);
  const [manualDate, setManualDate] = useState(todayStr());
  const [manualTime, setManualTime] = useState('');
  const [commissionRate, setCommissionRate] = useState((settings.defaultCommissionRate ?? 0.5).toString());
  const [borsaTescilli, setBorsaTescilli] = useState(false);
  const [noDeduction, setNoDeduction] = useState(settings.defaultNoDeduction ?? true);
  const [note, setNote] = useState('');
  const [applyBagkur, setApplyBagkur] = useState(false);
  const [bagkurRate, setBagkurRate] = useState((settings.defaultBagkurRate ?? 1).toString());
  const [lastSaved, setLastSaved] = useState(null);

  const [randiman, setRandiman] = useState('');
  const [asit, setAsit] = useState('');
  const [nem, setNem] = useState('');
  const [firePercent, setFirePercent] = useState('');
  const [hammaliyeTutari, setHammaliyeTutari] = useState('');
  const [nakliyeTutari, setNakliyeTutari] = useState('');
  const [cuvalKesintisi, setCuvalKesintisi] = useState('');
  const [photo, setPhoto] = useState('');
  const [showLabFields, setShowLabFields] = useState(false);

  const [items, setItems] = useState([]);
  const [lineVariety, setLineVariety] = useState(priceList[0]?.name || '');
  const [lineGradeName, setLineGradeName] = useState('');
  const [lineKg, setLineKg] = useState('');
  const [crateWeight] = useState(settings.crateWeight ?? 2);
  const [crateCount, setCrateCount] = useState(Math.max(0, Math.min(7, settings.defaultCrateCount ?? 5)));
  const [linePrice, setLinePrice] = useState('');

  const lineDara = crateCount * crateWeight;
  const adjustCrateCount = (delta) => setCrateCount((c) => Math.max(0, Math.min(7, c + delta)));

  const farmer = farmers.find((f) => f.id === farmerId);
  const selectedVariety = priceList.find((v) => v.name === lineVariety);
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

  useEffect(() => {
    setApplyBagkur(farmer ? !!farmer.bagkurStatus : false);
  }, [farmerId]);

  useEffect(() => {
    if (!selectedVariety) return;
    if (selectedVariety.hasGrades) {
      const firstGrade = selectedVariety.grades[0];
      setLineGradeName(firstGrade ? firstGrade.name : '');
      setLinePrice(firstGrade ? firstGrade.price.toString() : '');
    } else {
      setLineGradeName('');
      setLinePrice((selectedVariety.singlePrice || 0).toString());
    }
  }, [lineVariety, priceList]);

  useEffect(() => {
    if (!selectedVariety || !selectedVariety.hasGrades) return;
    const g = selectedVariety.grades.find((x) => x.name === lineGradeName);
    if (g) setLinePrice(g.price.toString());
  }, [lineGradeName]);

  const handleFarmerSelect = (value) => {
    if (value === '__add_new__') { setShowAddFarmer(true); return; }
    setFarmerId(value);
  };

  const saveNewFarmer = async (data) => {
    const newFarmer = { id: uid(), ...data, createdAt: Date.now() };
    const next = [...farmers, newFarmer];
    setFarmers(next);
    await storageSet('zk:farmers', next);
    setShowAddFarmer(false);
    setFarmerId(newFarmer.id);
  };

  const handlePersonnelSelect = (value) => {
    if (value === '__add_new__') { setShowAddPersonnel(true); return; }
    setPersonnelId(value);
  };

  const saveNewPersonnel = async (data) => {
    if (!data.name || !data.name.trim()) return;
    const newPerson = { id: uid(), name: data.name.trim(), phone: data.phone || '', role: data.role || '', createdAt: Date.now() };
    const next = [...personnel, newPerson];
    setPersonnel(next);
    await storageSet('zk:personnel', next);
    setShowAddPersonnel(false);
    setPersonnelId(newPerson.id);
  };

  const handleVehicleSelect = (value) => {
    if (value === '__add_new__') { setShowAddVehicle(true); return; }
    setVehicleId(value);
    const v = vehicles.find((x) => x.id === value);
    if (v && v.defaultPersonnelId && !personnelId) setPersonnelId(v.defaultPersonnelId);
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

  const addLine = () => {
    const grossVal = parseFloat(lineKg);
    const daraVal = lineDara;
    const priceVal = parseFloat(linePrice);
    const netVal = grossVal - daraVal;
    if (!lineVariety || !grossVal || grossVal <= 0 || netVal <= 0 || !priceVal || priceVal <= 0) return;
    const label = lineGradeName ? `${lineVariety} · ${lineGradeName}` : lineVariety;
    setItems((prev) => [...prev, { id: uid(), grade: label, grossKg: grossVal, dara: daraVal, crateCount, kg: netVal, pricePerKg: priceVal, amount: netVal * priceVal }]);
    setLineKg('');
  };

  const removeLine = (id) => setItems((prev) => prev.filter((x) => x.id !== id));

  const netKg = items.reduce((s, i) => s + i.kg, 0);
  const amount = items.reduce((s, i) => s + i.amount, 0);
  const fireTutari = amount * ((parseFloat(firePercent) || 0) / 100);
  const amountAfterFire = amount - fireTutari;
  const commissionAmount = noDeduction ? 0 : netKg * (parseFloat(commissionRate) || 0);
  const stopajOrani = stopajOraniHesapla(borsaTescilli);
  const stopajTutari = noDeduction ? 0 : amountAfterFire * (stopajOrani / 100);
  const bagkurTutari = (!noDeduction && applyBagkur) ? amountAfterFire * ((parseFloat(bagkurRate) || 0) / 100) : 0;
  const hammaliyeVal = parseFloat(hammaliyeTutari) || 0;
  const nakliyeVal = parseFloat(nakliyeTutari) || 0;
  const cuvalVal = parseFloat(cuvalKesintisi) || 0;
  const netPayment = amountAfterFire - commissionAmount - stopajTutari - bagkurTutari - hammaliyeVal - nakliyeVal - cuvalVal;

  const canSave = farmerId && items.length > 0;

  useEffect(() => {
    if (!broadcastLive) return;
    const lineLabel = lineVariety ? (lineGradeName ? `${lineVariety} · ${lineGradeName}` : lineVariety) : '';
    const lineNetKg = Math.max(0, (parseFloat(lineKg) || 0) - lineDara);
    const linePriceVal = parseFloat(linePrice) || 0;
    const person = personnel.find((p) => p.id === personnelId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    broadcastLive({
      type: 'purchase',
      partyName: farmer ? farmer.name : '',
      personnelName: person ? person.name : '',
      vehiclePlaka: vehicle ? vehicle.plaka : '',
      dateTimeLabel,
      items: items.map((it) => ({ grade: it.grade, kg: it.kg, pricePerKg: it.pricePerKg, amount: it.amount, crateCount: it.crateCount })),
      currentLine: { grade: lineLabel, kg: lineNetKg, pricePerKg: linePriceVal, crateCount },
      netKg: netKg + lineNetKg,
      grossAmount: amount + lineNetKg * linePriceVal,
      deductions: noDeduction ? null : {
        komisyon: commissionAmount, stopaj: stopajTutari, bagkur: bagkurTutari,
        hammaliye: hammaliyeVal, nakliye: nakliyeVal, cuval: cuvalVal, fire: fireTutari,
      },
      netAmount: netPayment,
      randiman: parseFloat(randiman) || null, asit: parseFloat(asit) || null, nem: parseFloat(nem) || null,
    });
  }, [farmer, items, lineVariety, lineGradeName, lineKg, linePrice, lineDara, dateTimeLabel, broadcastLive, personnelId, vehicleId, noDeduction, commissionAmount, stopajTutari, bagkurTutari, hammaliyeVal, nakliyeVal, cuvalVal, fireTutari, randiman, asit, nem, personnel, vehicles, amount, netKg, netPayment]);

  const handlePhotoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 700;
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        setPhoto(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const addPresetNote = (preset) => {
    setNote((prev) => (prev ? `${prev}, ${preset}` : preset));
  };

  const save = async () => {
    if (!canSave) return;
    const person = personnel.find((p) => p.id === personnelId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const record = {
      id: uid(),
      makbuzNo: nextReceiptNo(purchases, settings.purchaseReceiptNext),
      farmerId,
      date,
      time: timeLabel,
      personnelId: personnelId || null,
      personnelName: person ? person.name : '',
      vehicleId: vehicleId || null,
      vehiclePlaka: vehicle ? vehicle.plaka : '',
      items,
      netKg,
      noDeduction,
      commissionRate: noDeduction ? 0 : (parseFloat(commissionRate) || 0),
      commissionAmount,
      borsaTescilli,
      stopajOrani: noDeduction ? 0 : stopajOrani,
      stopajTutari,
      applyBagkur: noDeduction ? false : applyBagkur,
      bagkurRate: parseFloat(bagkurRate) || 0,
      bagkurTutari,
      randiman: parseFloat(randiman) || null,
      asit: parseFloat(asit) || null,
      nem: parseFloat(nem) || null,
      firePercent: parseFloat(firePercent) || 0,
      fireTutari,
      hammaliyeTutari: hammaliyeVal,
      nakliyeTutari: nakliyeVal,
      cuvalKesintisi: cuvalVal,
      photo: photo || '',
      amount,
      netPayment,
      note,
      createdAt: Date.now(),
    };
    const next = [...purchases, record];
    setPurchases(next);
    await storageSet('zk:purchases', next);
    setLastSaved(record);
    setItems([]); setNote(''); setLineKg('');
    setRandiman(''); setAsit(''); setNem(''); setFirePercent('');
    setHammaliyeTutari(''); setNakliyeTutari(''); setCuvalKesintisi(''); setPhoto('');
    setManualDateTime(false);
    if (broadcastLive) broadcastLive({ type: 'purchase_done', partyName: farmer ? farmer.name : '', netKg, total: netPayment, items: record.items.map((it) => ({ grade: it.grade, kg: it.kg })) });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="zk-h1">Alım</div>
          <div className="zk-h1-sub">Elekten çıkan her sınıfı ayrı tartıp ekleyin, sonunda toplam üzerinden hesaplansın</div>
        </div>
        {openCustomerDisplay && <CustomerDisplayButtons openCustomerDisplay={openCustomerDisplay} customerDisplayUrl={customerDisplayUrl} />}
      </div>

      <ScaleWidget onWeightCapture={(v) => setLineKg(v.toFixed(1))} compact />

      <div style={{ maxWidth: 900, marginTop: 16 }}>
        <div className="zk-card">
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Çiftçi</label>
            <select className="zk-select" value={farmerId} onChange={(e) => handleFarmerSelect(e.target.value)}>
              <option value="">Seçin...</option>
              {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              <option value="__add_new__">+ Yeni çiftçi ekle</option>
            </select>
          </div>

          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Alımı yapan personel</label>
              <select className="zk-select" value={personnelId} onChange={(e) => handlePersonnelSelect(e.target.value)}>
                <option value="">Seçin...</option>
                {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="__add_new__">+ Yeni personel ekle</option>
              </select>
            </div>
            <div>
              <label className="zk-label">Araç</label>
              <select className="zk-select" value={vehicleId} onChange={(e) => handleVehicleSelect(e.target.value)}>
                <option value="">Seçin...</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plaka}</option>)}
                <option value="__add_new__">+ Yeni araç ekle</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {!manualDateTime ? (
              <>
                <div style={{ fontSize: 12, color: COLORS.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ClockIcon size={13} /> {dateTimeLabel} (otomatik)
                </div>
                <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 9px', fontSize: 11 }} onClick={startManualEdit}>
                  <Pencil size={11} /> Değiştir
                </button>
              </>
            ) : (
              <>
                <input className="zk-input" type="date" style={{ maxWidth: 150, minHeight: 34, padding: '5px 8px', fontSize: 12 }} value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                <input className="zk-input" type="time" style={{ maxWidth: 110, minHeight: 34, padding: '5px 8px', fontSize: 12 }} value={manualTime} onChange={(e) => setManualTime(e.target.value)} />
                <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 9px', fontSize: 11 }} onClick={() => setManualDateTime(false)}>
                  <RefreshCw size={11} /> Otomatiğe dön
                </button>
              </>
            )}
          </div>

          <div style={{ background: COLORS.paper, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div className="zk-label" style={{ marginBottom: 8 }}>Tartım satırı ekle</div>
            <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', alignItems: 'end' }}>
              <div>
                <label className="zk-label">Tür</label>
                <select className="zk-select" value={lineVariety} onChange={(e) => setLineVariety(e.target.value)}>
                  {priceList.length === 0 && <option value="">Fiyat listesi boş</option>}
                  {priceList.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              {selectedVariety?.hasGrades && (
                <div>
                  <label className="zk-label">Numara</label>
                  <select className="zk-select" value={lineGradeName} onChange={(e) => setLineGradeName(e.target.value)}>
                    {selectedVariety.grades.length === 0 && <option value="">Numara yok</option>}
                    {selectedVariety.grades.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
              )}
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
              </div>
              <div>
                <label className="zk-label" style={{ visibility: 'hidden' }}>Ekle</label>
                <button className="zk-btn zk-btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={addLine}><Plus size={14} /> Ekle</button>
              </div>
            </div>
            {lineKg && (
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 8 }}>
                Net: {fmtKg(Math.max((parseFloat(lineKg) || 0) - lineDara, 0))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <table className="zk-table" style={{ marginBottom: 14 }}>
              <thead><tr><th>Sınıf</th><th>Ölçülen</th><th>Dara</th><th>Net</th><th>Fiyat</th><th>Tutar</th><th></th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td><span className="zk-badge zk-badge-blue">{it.grade}</span></td>
                    <td>{fmtKg(it.grossKg ?? it.kg)}</td>
                    <td>{fmtKg(it.dara || 0)}{it.crateCount != null ? ` (${it.crateCount} kasa)` : ''}</td>
                    <td style={{ fontWeight: 600 }}>{fmtKg(it.kg)}</td>
                    <td>{fmtTL(it.pricePerKg)}/kg</td>
                    <td>{fmtTL(it.amount)}</td>
                    <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removeLine(it.id)}><X size={12} /></button></td>
                  </tr>
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
                  return gradeNames.map((g) => (
                    <tr key={g} style={{ background: COLORS.paper }}>
                      <td colSpan={3} style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{g} toplam</td>
                      <td style={{ fontWeight: 600, fontSize: 11.5 }}>{fmtKg(groups[g].kg)}</td>
                      <td></td>
                      <td style={{ fontWeight: 600, fontSize: 11.5 }}>{fmtTL(groups[g].amount)}</td>
                      <td></td>
                    </tr>
                  ));
                })()}
                <tr>
                  <td style={{ fontWeight: 700 }}>Toplam</td>
                  <td></td>
                  <td></td>
                  <td style={{ fontWeight: 700 }}>{fmtKg(netKg)}</td>
                  <td></td>
                  <td style={{ fontWeight: 700 }}>{fmtTL(amount)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}

          <label className="zk-checkbox-row" style={{ background: COLORS.oliveSoft, padding: '9px 12px', borderRadius: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={noDeduction} onChange={(e) => setNoDeduction(e.target.checked)} />
            Kesintisiz hesapla (komisyon / stopaj / BAĞ-KUR uygulanmasın, tutarın tamamı ödensin)
          </label>

          {!noDeduction && (
            <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 12 }}>
              <div>
                <label className="zk-label">Komisyon (₺/kg)</label>
                <input className="zk-input" type="text" inputMode="decimal" step="0.01" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value.replace(',', '.'))} placeholder="0.50" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
                <label className="zk-checkbox-row">
                  <input type="checkbox" checked={borsaTescilli} onChange={(e) => setBorsaTescilli(e.target.checked)} />
                  Ticaret borsasına tescilli
                </label>
                <label className="zk-checkbox-row">
                  <input type="checkbox" checked={applyBagkur} onChange={(e) => setApplyBagkur(e.target.checked)} />
                  BAĞ-KUR kesintisi uygula (%)
                  <input
                    className="zk-input"
                    type="text" inputMode="decimal"
                    value={bagkurRate}
                    onChange={(e) => setBagkurRate(e.target.value.replace(',', '.'))}
                    style={{ width: 55, padding: '4px 6px' }}
                    disabled={!applyBagkur}
                  />
                </label>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Hazır notlar</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Dip toplama', 'Yağlık', 'Asit yüksek', 'Çamurlu', 'Islak'].map((p) => (
                <button key={p} className="zk-btn zk-btn-secondary" style={{ fontSize: 11.5, padding: '5px 10px' }} onClick={() => addPresetNote(p)}>{p}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="zk-label">Not (opsiyonel)</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="serbest not..." />
          </div>

          <button
            className="zk-btn zk-btn-secondary"
            style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}
            onClick={() => setShowLabFields((v) => !v)}
          >
            <span>Laboratuvar sonuçları & ek kesintiler</span>
            <span>{showLabFields ? '▲' : '▼'}</span>
          </button>

          {showLabFields && (
            <div style={{ background: COLORS.paper, borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: '1 1 100px' }}>
                  <label className="zk-label">Randıman (%)</label>
                  <input className="zk-input" type="text" inputMode="decimal" value={randiman} onChange={(e) => setRandiman(e.target.value.replace(',', '.'))} placeholder="—" />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label className="zk-label">Asit oranı (%)</label>
                  <input className="zk-input" type="text" inputMode="decimal" value={asit} onChange={(e) => setAsit(e.target.value.replace(',', '.'))} placeholder="—" />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label className="zk-label">Nem oranı (%)</label>
                  <input className="zk-input" type="text" inputMode="decimal" value={nem} onChange={(e) => setNem(e.target.value.replace(',', '.'))} placeholder="—" />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label className="zk-label">Fire/İskonto (%)</label>
                  <input className="zk-input" type="text" inputMode="decimal" value={firePercent} onChange={(e) => setFirePercent(e.target.value.replace(',', '.'))} placeholder="0" />
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <div style={{ flex: '1 1 120px' }}>
                  <label className="zk-label">Hammaliye kesintisi (₺)</label>
                  <input className="zk-input" type="text" inputMode="decimal" value={hammaliyeTutari} onChange={(e) => setHammaliyeTutari(e.target.value.replace(',', '.'))} placeholder="0" />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label className="zk-label">Nakliye kesintisi (₺)</label>
                  <input className="zk-input" type="text" inputMode="decimal" value={nakliyeTutari} onChange={(e) => setNakliyeTutari(e.target.value.replace(',', '.'))} placeholder="0" />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label className="zk-label">Çuval/kasa kesintisi (₺)</label>
                  <input className="zk-input" type="text" inputMode="decimal" value={cuvalKesintisi} onChange={(e) => setCuvalKesintisi(e.target.value.replace(',', '.'))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="zk-btn zk-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                  <Upload size={13} /> {photo ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) handlePhotoUpload(e.target.files[0]); e.target.value = ''; }} />
                </label>
                {photo && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img src={photo} alt="Alım fotoğrafı" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: `1px solid ${COLORS.border}` }} />
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => setPhoto('')}><X size={12} /></button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ background: COLORS.paper, borderRadius: 10, padding: 14, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12.5 }}>
            <div>Ürün tutarı ({fmtKg(netKg)})</div><div style={{ textAlign: 'right', fontWeight: 600 }}>{fmtTL(amount)}</div>
            {fireTutari > 0 && (<><div style={{ color: COLORS.red }}>Fire/İskonto (%{firePercent})</div><div style={{ textAlign: 'right', fontWeight: 600, color: COLORS.red }}>− {fmtTL(fireTutari)}</div></>)}
            {!noDeduction && (
              <>
                <div style={{ color: COLORS.gold }}>Komisyon ({commissionRate || 0} ₺/kg)</div><div style={{ textAlign: 'right', fontWeight: 600, color: COLORS.gold }}>− {fmtTL(commissionAmount)}</div>
                <div style={{ color: COLORS.blue }}>Stopaj (%{stopajOrani})</div><div style={{ textAlign: 'right', fontWeight: 600, color: COLORS.blue }}>− {fmtTL(stopajTutari)}</div>
                {applyBagkur && (<><div style={{ color: COLORS.red }}>BAĞ-KUR (%{bagkurRate || 0})</div><div style={{ textAlign: 'right', fontWeight: 600, color: COLORS.red }}>− {fmtTL(bagkurTutari)}</div></>)}
              </>
            )}
            {hammaliyeVal > 0 && (<><div>Hammaliye</div><div style={{ textAlign: 'right', fontWeight: 600 }}>− {fmtTL(hammaliyeVal)}</div></>)}
            {nakliyeVal > 0 && (<><div>Nakliye</div><div style={{ textAlign: 'right', fontWeight: 600 }}>− {fmtTL(nakliyeVal)}</div></>)}
            {cuvalVal > 0 && (<><div>Çuval/kasa</div><div style={{ textAlign: 'right', fontWeight: 600 }}>− {fmtTL(cuvalVal)}</div></>)}
            <div style={{ fontWeight: 700, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8 }}>Çiftçiye ödenecek</div>
            <div style={{ textAlign: 'right', fontWeight: 700, borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, color: COLORS.olive }}>{fmtTL(netPayment)}</div>
          </div>

          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!canSave} onClick={save}>
            Alımı kaydet
          </button>


          {lastSaved && (() => {
            const lastSavedFarmer = farmers.find((f) => f.id === lastSaved.farmerId);
            const waPhone = lastSavedFarmer ? formatPhoneForWhatsApp(lastSavedFarmer.phone) : null;
            const waHref = waPhone
              ? `https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsAppReceiptText(lastSaved, lastSavedFarmer, settings))}`
              : null;
            return (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COLORS.oliveSoft, padding: '10px 12px', borderRadius: 8, flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: COLORS.olive }}>Alım #{lastSaved.makbuzNo} kaydedildi.</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="zk-btn zk-btn-secondary" onClick={() => onPrintReceipt(lastSaved)}><Printer size={13} /> Yazdır</button>
                  <button className="zk-btn zk-btn-secondary" onClick={() => downloadReceiptPdf(lastSaved, lastSavedFarmer, settings)}><Download size={13} /> PDF indir</button>
                  {waHref ? (
                    <a className="zk-btn" style={{ background: '#25D366', color: '#fff' }} href={waHref} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={13} /> WhatsApp'tan gönder
                    </a>
                  ) : (
                    <span style={{ fontSize: 11, color: COLORS.inkSoft, alignSelf: 'center' }}>Çiftçinin telefonu kayıtlı değil</span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {showAddFarmer && <AddFarmerModal onClose={() => setShowAddFarmer(false)} onSave={saveNewFarmer} />}
      {showAddPersonnel && <AddPersonnelModal onClose={() => setShowAddPersonnel(false)} onSave={saveNewPersonnel} />}
      {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSave={saveNewVehicle} personnel={personnel} />}
    </div>
  );
}
