import React, { useState } from 'react';
import {
  Plus,
  Printer,
} from 'lucide-react';
import { AddCariModal } from '../modals/index';
import { fmtTL, nextReceiptNo, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function ManualPurchaseTab({ farmers, setFarmers, purchases, setPurchases, priceList, personnel, vehicles, settings, onPrintReceipt }) {
  const [showAddFarmer, setShowAddFarmer] = useState(false);
  const [farmerId, setFarmerId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [grade, setGrade] = useState('');
  const [kg, setKg] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [commissionRate, setCommissionRate] = useState((settings.defaultCommissionRate ?? 3).toString());
  const [personnelId, setPersonnelId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [note, setNote] = useState('');
  const [lastSaved, setLastSaved] = useState(null);

  const amount = (parseFloat(kg) || 0) * (parseFloat(pricePerKg) || 0);
  const commissionAmount = amount * (parseFloat(commissionRate) || 0) / 100;
  const netPayment = amount - commissionAmount;
  const canSave = farmerId && grade.trim() && parseFloat(kg) > 0 && parseFloat(pricePerKg) > 0;

  const saveNewFarmer = async (data) => {
    if (!data.name || !data.name.trim()) return;
    const f = { id: uid(), name: data.name.trim(), phone: data.phone || '', tcNo: data.tcNo || '', address: data.address || '', bagkurStatus: !!data.bagkurStatus, createdAt: Date.now() };
    const next = [...farmers, f];
    setFarmers(next);
    await storageSet('zk:farmers', next);
    setShowAddFarmer(false);
    setFarmerId(f.id);
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
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      personnelId: personnelId || null,
      personnelName: person ? person.name : '',
      vehicleId: vehicleId || null,
      vehiclePlaka: vehicle ? vehicle.plaka : '',
      items: [{ id: uid(), grade: grade.trim(), kg: parseFloat(kg), pricePerKg: parseFloat(pricePerKg), amount }],
      netKg: parseFloat(kg),
      noDeduction: false,
      commissionRate: parseFloat(commissionRate) || 0,
      commissionAmount,
      borsaTescilli: false,
      stopajOrani: 0,
      stopajTutari: 0,
      applyBagkur: false,
      bagkurRate: 0,
      bagkurTutari: 0,
      randiman: null,
      asit: null,
      nem: null,
      firePercent: 0,
      fireTutari: 0,
      hammaliyeTutari: 0,
      nakliyeTutari: 0,
      cuvalKesintisi: 0,
      photo: '',
      amount,
      netPayment,
      note,
      createdAt: Date.now(),
    };
    const next = [...purchases, record];
    setPurchases(next);
    await storageSet('zk:purchases', next);
    setLastSaved(record);
    setGrade(''); setKg(''); setPricePerKg(''); setNote('');
  };

  return (
    <div>
      <div className="zk-h1">Alış</div>
      <div className="zk-h1-sub">Tartım/kesinti detayı olmadan hızlı manuel alış kaydı — detaylı tartım için Kantarlı Alış'ı kullanın</div>

      <div style={{ maxWidth: 900 }}>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni alış</div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Çiftçi</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="zk-select" value={farmerId} onChange={(e) => setFarmerId(e.target.value)}>
                  <option value="">Seçin...</option>
                  {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <button className="zk-btn zk-btn-secondary" onClick={() => setShowAddFarmer(true)}><Plus size={13} /></button>
              </div>
            </div>
            <div>
              <label className="zk-label">Tarih</label>
              <input className="zk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Sınıf / tür</label>
            <input className="zk-input" list="zk-grade-list" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="örn. Gemlik 1. Sınıf" />
            <datalist id="zk-grade-list">
              {priceList.map((v) => <option key={v.id} value={v.name} />)}
            </datalist>
          </div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Miktar (kg)</label>
              <input className="zk-input" type="number" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="zk-label">Kg fiyatı (TL)</label>
              <input className="zk-input" type="number" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Komisyon oranı (%)</label>
              <input className="zk-input" type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
            </div>
            <div>
              <label className="zk-label">Personel (opsiyonel)</label>
              <select className="zk-select" value={personnelId} onChange={(e) => setPersonnelId(e.target.value)}>
                <option value="">Seçin...</option>
                {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Araç (opsiyonel)</label>
            <select className="zk-select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              <option value="">Seçin...</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plaka}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Not</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsiyonel" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,}}>
              <span style={{ color: COLORS.inkSoft }}>Toplam tutar</span>
              <span>{fmtTL(amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,}}>
              <span style={{ color: COLORS.inkSoft }}>Komisyon</span>
              <span>- {fmtTL(commissionAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, flexWrap: 'wrap', gap: 8,}}>
              <span>Çiftçiye net ödeme</span>
              <span>{fmtTL(netPayment)}</span>
            </div>
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!canSave} onClick={save}>
            Alışı kaydet
          </button>

          {lastSaved && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COLORS.oliveSoft, padding: '10px 12px', borderRadius: 8, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: COLORS.olive }}>Alım #{lastSaved.makbuzNo} kaydedildi.</span>
              <button className="zk-btn zk-btn-secondary" onClick={() => onPrintReceipt(lastSaved)}><Printer size={13} /> Yazdır</button>
            </div>
          )}
        </div>
      </div>

      {showAddFarmer && <AddCariModal lockType="tedarikci" onClose={() => setShowAddFarmer(false)} onSave={saveNewFarmer} />}
    </div>
  );
}
