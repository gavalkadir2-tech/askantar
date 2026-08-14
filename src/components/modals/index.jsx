import React, { useState } from 'react';
import {
  Plus,
  Trash2,
} from 'lucide-react';
import { Modal, PaymentMethodPicker, SearchableSelect } from '../common/index';
import { fmtKg, fmtTL, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function AddPersonnelModal({ onClose, onSave, initialData, personnel = [] }) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [role, setRole] = useState(initialData?.role || '');
  const [payType, setPayType] = useState(initialData?.payType || 'yevmiye');
  const [dailyWage, setDailyWage] = useState(initialData?.dailyWage != null ? String(initialData.dailyWage) : '');
  const [monthlySalary, setMonthlySalary] = useState(initialData?.monthlySalary != null ? String(initialData.monthlySalary) : '');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    const dup = personnel.some((p) => p.id !== initialData?.id && normalizeName(p.name) === normalizeName(name));
    if (dup) { setError('Bu isimde kayıtlı bir personel zaten var.'); return; }
    if (!isValidTRPhone(phone)) { setError('Telefon numarası geçersiz görünüyor (örn. 0532 xxx xx xx).'); return; }
    setError('');
    onSave({ name: name.trim(), phone, role, payType, dailyWage: parseFloat(dailyWage) || 0, monthlySalary: parseFloat(monthlySalary) || 0 });
  };

  return (
    <Modal title={initialData ? 'Personeli düzenle' : 'Yeni personel ekle'} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Ad soyad</label>
        <input className="zk-input" value={name} onChange={(e) => { setName(e.target.value); if (error) setError(''); }} placeholder="örn. Ali Demir" autoFocus />
        {error && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 5 }}>{error}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label className="zk-label">Telefon</label>
          <input className="zk-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 xxx xx xx" />
        </div>
        <div>
          <label className="zk-label">Görev (opsiyonel)</label>
          <input className="zk-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="örn. Şoför, Tartı memuru" />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Ödeme türü</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`zk-btn ${payType === 'yevmiye' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPayType('yevmiye')}>Yövmiyeli</button>
          <button type="button" className={`zk-btn ${payType === 'maas' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPayType('maas')}>Maaşlı</button>
        </div>
      </div>
      {payType === 'yevmiye' ? (
        <div style={{ marginBottom: 18 }}>
          <label className="zk-label">Günlük yövmiye (TL)</label>
          <input className="zk-input" type="text" inputMode="decimal" value={dailyWage} onChange={(e) => setDailyWage(e.target.value.replace(',', '.'))} placeholder="örn. 800" />
        </div>
      ) : (
        <div style={{ marginBottom: 18 }}>
          <label className="zk-label">Aylık maaş (TL)</label>
          <input className="zk-input" type="text" inputMode="decimal" value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value.replace(',', '.'))} placeholder="örn. 25000" />
        </div>
      )}
      <button
        className="zk-btn zk-btn-primary"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={submit}
      >
        Kaydet
      </button>
    </Modal>
  );
}

export function AddVehicleModal({ onClose, onSave, personnel, initialData, vehicles = [] }) {
  const [plaka, setPlaka] = useState(initialData?.plaka || '');
  const [marka, setMarka] = useState(initialData?.marka || '');
  const [kapasite, setKapasite] = useState(initialData?.kapasite || '');
  const [defaultPersonnelId, setDefaultPersonnelId] = useState(initialData?.defaultPersonnelId || '');
  const [error, setError] = useState('');

  const normalizePlaka = (s) => (s || '').replace(/\s+/g, '').toLocaleUpperCase('tr');

  const submit = () => {
    if (!plaka.trim()) return;
    const dup = vehicles.some((v) => v.id !== initialData?.id && normalizePlaka(v.plaka) === normalizePlaka(plaka));
    if (dup) { setError('Bu plaka zaten kayıtlı.'); return; }
    setError('');
    onSave({ plaka: plaka.trim(), marka, kapasite: parseFloat(kapasite) || 0, defaultPersonnelId });
  };

  return (
    <Modal title={initialData ? 'Aracı düzenle' : 'Yeni araç ekle'} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Plaka</label>
        <input className="zk-input" value={plaka} onChange={(e) => { setPlaka(e.target.value.toUpperCase()); if (error) setError(''); }} placeholder="örn. 35 ABC 123" autoFocus />
        {error && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 5 }}>{error}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label className="zk-label">Marka / model</label>
          <input className="zk-input" value={marka} onChange={(e) => setMarka(e.target.value)} placeholder="örn. Ford Kamyonet" />
        </div>
        <div>
          <label className="zk-label">Kapasite (kg)</label>
          <input className="zk-input" type="text" inputMode="decimal" value={kapasite} onChange={(e) => setKapasite(e.target.value.replace(',', '.'))} placeholder="örn. 3000" />
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label className="zk-label">Varsayılan sürücü (opsiyonel)</label>
        <select className="zk-select" value={defaultPersonnelId} onChange={(e) => setDefaultPersonnelId(e.target.value)}>
          <option value="">Seçin...</option>
          {personnel.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Kaydet</button>
    </Modal>
  );
}

const normalizeName = (s) => (s || '').trim().toLocaleLowerCase('tr');

// Telefon opsiyonel; doluysa gevşek bir TR cep telefonu biçimi bekleniyor:
// 5xxxxxxxxx (10), 05xxxxxxxxx (11) ya da 905xxxxxxxxx (12 hane, +90 ile).
function isValidTRPhone(raw) {
  if (!raw || !raw.trim()) return true;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 10 && digits[0] === '5') return true;
  if (digits.length === 11 && digits.startsWith('05')) return true;
  if (digits.length === 12 && digits.startsWith('905')) return true;
  return false;
}

// IBAN opsiyonel; doluysa TR + 24 hane (boşluklar temizlenerek) bekleniyor.
function isValidIBAN(raw) {
  if (!raw || !raw.trim()) return true;
  const clean = raw.replace(/\s+/g, '').toUpperCase();
  return /^TR\d{24}$/.test(clean);
}

export function AddFarmerModal({ onClose, onSave, initialData, farmers = [] }) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [tcNo, setTcNo] = useState(initialData?.tcNo || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [bagkurStatus, setBagkurStatus] = useState(initialData?.bagkurStatus || false);
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [iban, setIban] = useState(initialData?.iban || '');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    const dup = farmers.some((f) => f.id !== initialData?.id && normalizeName(f.name) === normalizeName(name));
    if (dup) { setError('Bu isimde kayıtlı bir çiftçi zaten var.'); return; }
    if (!isValidTRPhone(phone)) { setError('Telefon numarası geçersiz görünüyor (örn. 0532 xxx xx xx).'); return; }
    if (!isValidIBAN(iban)) { setError('IBAN geçersiz görünüyor (TR ile başlayıp 24 hane olmalı).'); return; }
    setError('');
    onSave({ name: name.trim(), phone: phone.trim(), tcNo: tcNo.trim(), address: address.trim(), bagkurStatus, bankName: bankName.trim(), iban: iban.trim() });
  };

  return (
    <Modal title={initialData ? 'Çiftçiyi düzenle' : 'Yeni çiftçi ekle'} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Ad soyad</label>
        <input className="zk-input" value={name} onChange={(e) => { setName(e.target.value); if (error) setError(''); }} placeholder="örn. Mehmet Yılmaz" autoFocus />
        {error && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 5 }}>{error}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label className="zk-label">Telefon</label>
          <input className="zk-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 xxx xx xx" />
        </div>
        <div>
          <label className="zk-label">TC Kimlik No</label>
          <input className="zk-input" value={tcNo} onChange={(e) => setTcNo(e.target.value)} placeholder="11 haneli" maxLength={11} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Adres (müstahsil makbuzu için)</label>
        <input className="zk-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Köy / ilçe / il" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label className="zk-label">Banka (opsiyonel)</label>
          <input className="zk-input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="örn. Ziraat Bankası" />
        </div>
        <div>
          <label className="zk-label">IBAN (opsiyonel)</label>
          <input className="zk-input" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TR.." />
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label className="zk-checkbox-row">
          <input type="checkbox" checked={bagkurStatus} onChange={(e) => setBagkurStatus(e.target.checked)} />
          Tarım BAĞ-KUR'lu (SGK kesintisi uygulanır)
        </label>
      </div>
      <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Kaydet</button>
    </Modal>
  );
}

export function AddCariModal({ onClose, onSave, initialData, lockType, farmers = [], buyers = [] }) {
  const [type, setType] = useState(initialData?.type || lockType || 'tedarikci');
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [tcNo, setTcNo] = useState(initialData?.tcNo || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [bagkurStatus, setBagkurStatus] = useState(initialData?.bagkurStatus || false);
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [iban, setIban] = useState(initialData?.iban || '');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    const list = type === 'tedarikci' ? farmers : buyers;
    const dup = list.some((x) => x.id !== initialData?.id && normalizeName(x.name) === normalizeName(name));
    if (dup) {
      setError(type === 'tedarikci' ? 'Bu isimde kayıtlı bir tedarikçi zaten var.' : 'Bu isimde kayıtlı bir cari zaten var.');
      return;
    }
    if (!isValidTRPhone(phone)) { setError('Telefon numarası geçersiz görünüyor (örn. 0532 xxx xx xx).'); return; }
    if (!isValidIBAN(iban)) { setError('IBAN geçersiz görünüyor (TR ile başlayıp 24 hane olmalı).'); return; }
    setError('');
    onSave({ type, name: name.trim(), phone: phone.trim(), tcNo: tcNo.trim(), address: address.trim(), bagkurStatus, bankName: bankName.trim(), iban: iban.trim() });
  };

  return (
    <Modal title={initialData ? 'Cariyi düzenle' : 'Cari ekle'} onClose={onClose}>
      {!lockType && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={`zk-btn ${type === 'tedarikci' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setType('tedarikci'); setError(''); }}>
            Tedarikçi (çiftçi)
          </button>
          <button className={`zk-btn ${type === 'cari' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setType('cari'); setError(''); }}>
            Cari (alıcı/müşteri)
          </button>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">{type === 'tedarikci' ? 'Ad soyad' : 'Ad / firma adı'}</label>
        <input className="zk-input" value={name} onChange={(e) => { setName(e.target.value); if (error) setError(''); }} autoFocus placeholder={type === 'tedarikci' ? 'örn. Mehmet Yılmaz' : 'örn. Ege Zeytinyağı A.Ş.'} />
        {error && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 5 }}>{error}</div>}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Telefon</label>
        <input className="zk-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 xxx xx xx" />
      </div>
      {type === 'tedarikci' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">TC Kimlik No</label>
            <input className="zk-input" value={tcNo} onChange={(e) => setTcNo(e.target.value)} placeholder="11 haneli" maxLength={11} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Adres (müstahsil makbuzu için)</label>
            <input className="zk-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Köy / ilçe / il" />
          </div>
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label className="zk-label">Banka (opsiyonel)</label>
          <input className="zk-input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="örn. Ziraat Bankası" />
        </div>
        <div>
          <label className="zk-label">IBAN (opsiyonel)</label>
          <input className="zk-input" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TR.." />
        </div>
      </div>
      {type === 'tedarikci' && (
        <div style={{ marginBottom: 18 }}>
          <label className="zk-checkbox-row">
            <input type="checkbox" checked={bagkurStatus} onChange={(e) => setBagkurStatus(e.target.checked)} />
            Tarım BAĞ-KUR'lu (SGK kesintisi uygulanır)
          </label>
        </div>
      )}
      <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: type === 'cari' ? 6 : 0 }} onClick={submit}>Kaydet</button>
    </Modal>
  );
}

export function EditSaleModal({ sale, buyers, vehicles, bankAccounts, onClose, onSave }) {
  const [buyerId, setBuyerId] = useState(sale.buyerId);
  const [date, setDate] = useState(sale.date);
  const [grade, setGrade] = useState(sale.grade || '');
  const [kg, setKg] = useState(String(sale.kg));
  const [pricePerKg, setPricePerKg] = useState(String(sale.pricePerKg));
  const [vehicleId, setVehicleId] = useState(sale.vehicleId || '');
  const [note, setNote] = useState(sale.note || '');
  const [method, setMethod] = useState(sale.paymentMethod || 'nakit');
  const [bankAccountId, setBankAccountId] = useState(sale.bankAccountId || '');

  const amount = (parseFloat(kg) || 0) * (parseFloat(pricePerKg) || 0);

  const submit = () => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    onSave({
      ...sale, buyerId, date, grade, kg: parseFloat(kg) || 0, pricePerKg: parseFloat(pricePerKg) || 0,
      amount, vehicleId: vehicleId || null, vehiclePlaka: vehicle ? vehicle.plaka : '', note,
      paymentMethod: method, bankAccountId: method === 'banka' ? bankAccountId : null,
    });
  };

  return (
    <Modal title={`Satış #${sale.makbuzNo || ''} — Düzenle`} onClose={onClose}>
      <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
        <div>
          <label className="zk-label">Alıcı</label>
          <SearchableSelect
            value={buyerId}
            onChange={setBuyerId}
            options={buyers.map((b) => ({ id: b.id, label: b.name }))}
            placeholder="Alıcı ara veya seçin..."
            recentKey="buyers"
          />
        </div>
        <div>
          <label className="zk-label">Tarih</label>
          <input className="zk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="zk-label">Sınıf / numara</label>
        <input className="zk-input" value={grade} onChange={(e) => setGrade(e.target.value)} />
      </div>
      <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
        <div>
          <label className="zk-label">Kg</label>
          <input className="zk-input" type="text" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value.replace(',', '.'))} />
        </div>
        <div>
          <label className="zk-label">Kg fiyatı</label>
          <input className="zk-input" type="text" inputMode="decimal" value={pricePerKg} onChange={(e) => setPricePerKg(e.target.value.replace(',', '.'))} />
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="zk-label">Araç</label>
        <SearchableSelect
          value={vehicleId}
          onChange={setVehicleId}
          options={vehicles.map((v) => ({ id: v.id, label: v.plaka }))}
          placeholder="Araç ara veya seçin..."
          recentKey="vehicles"
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label className="zk-label">Ödeme yöntemi</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PaymentMethodPicker method={method} setMethod={setMethod} bankAccountId={bankAccountId} setBankAccountId={setBankAccountId} bankAccounts={bankAccounts} />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label className="zk-label">Not</label>
        <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13, marginBottom: 14, background: COLORS.paper, borderRadius: 8, padding: 10, flexWrap: 'wrap', gap: 8,}}>
        <span>Toplam tutar</span><span>{fmtTL(amount)}</span>
      </div>
      <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Kaydet</button>
    </Modal>
  );
}

export function EditPurchaseModal({ purchase, farmers, personnel, vehicles, bankAccounts, onClose, onSave }) {
  const [farmerId, setFarmerId] = useState(purchase.farmerId);
  const [date, setDate] = useState(purchase.date);
  const [time, setTime] = useState(purchase.time || '');
  const [personnelId, setPersonnelId] = useState(purchase.personnelId || '');
  const [vehicleId, setVehicleId] = useState(purchase.vehicleId || '');
  const [items, setItems] = useState((purchase.items || []).map((it) => ({ ...it })));
  const [commissionRate, setCommissionRate] = useState(String(purchase.commissionRate ?? 0));
  const [stopajOrani, setStopajOrani] = useState(String(purchase.stopajOrani ?? 0));
  const [hammaliyeTutari, setHammaliyeTutari] = useState(String(purchase.hammaliyeTutari ?? 0));
  const [nakliyeTutari, setNakliyeTutari] = useState(String(purchase.nakliyeTutari ?? 0));
  const [cuvalKesintisi, setCuvalKesintisi] = useState(String(purchase.cuvalKesintisi ?? 0));
  const [note, setNote] = useState(purchase.note || '');
  const [method, setMethod] = useState(purchase.paymentMethod || 'nakit');
  const [bankAccountId, setBankAccountId] = useState(purchase.bankAccountId || '');

  const updateItem = (id, field, value) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value, amount: field === 'kg' || field === 'pricePerKg' ? (parseFloat(field === 'kg' ? value : it.kg) || 0) * (parseFloat(field === 'pricePerKg' ? value : it.pricePerKg) || 0) : it.amount } : it)));
  };
  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));
  const addItem = () => setItems((prev) => [...prev, { id: uid(), grade: '', kg: 0, pricePerKg: 0, amount: 0 }]);

  const netKg = items.reduce((s, it) => s + (parseFloat(it.kg) || 0), 0);
  const amount = items.reduce((s, it) => s + (parseFloat(it.kg) || 0) * (parseFloat(it.pricePerKg) || 0), 0);
  const firePercent = purchase.firePercent || 0;
  const fireTutari = amount * (firePercent / 100);
  const amountAfterFire = amount - fireTutari;
  const commissionAmount = purchase.noDeduction ? 0 : netKg * (parseFloat(commissionRate) || 0);
  const stopajTutari = purchase.noDeduction ? 0 : amountAfterFire * (parseFloat(stopajOrani) || 0) / 100;
  const bagkurTutari = (purchase.applyBagkur && !purchase.noDeduction) ? amountAfterFire * ((purchase.bagkurRate || 0) / 100) : 0;
  const netPayment = amountAfterFire - commissionAmount - stopajTutari - bagkurTutari - (parseFloat(hammaliyeTutari) || 0) - (parseFloat(nakliyeTutari) || 0) - (parseFloat(cuvalKesintisi) || 0);

  const submit = () => {
    const person = personnel.find((p) => p.id === personnelId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    onSave({
      ...purchase,
      farmerId, date, time, personnelId: personnelId || null, personnelName: person ? person.name : '',
      vehicleId: vehicleId || null, vehiclePlaka: vehicle ? vehicle.plaka : '',
      items: items.map((it) => ({ ...it, kg: parseFloat(it.kg) || 0, pricePerKg: parseFloat(it.pricePerKg) || 0, amount: (parseFloat(it.kg) || 0) * (parseFloat(it.pricePerKg) || 0) })),
      netKg, amount,
      commissionRate: parseFloat(commissionRate) || 0, commissionAmount,
      stopajOrani: parseFloat(stopajOrani) || 0, stopajTutari,
      firePercent, fireTutari,
      bagkurTutari,
      hammaliyeTutari: parseFloat(hammaliyeTutari) || 0,
      nakliyeTutari: parseFloat(nakliyeTutari) || 0,
      cuvalKesintisi: parseFloat(cuvalKesintisi) || 0,
      netPayment, note,
      paymentMethod: method, bankAccountId: method === 'banka' ? bankAccountId : null,
    });
  };

  return (
    <Modal title={`Alım #${purchase.makbuzNo} — Düzenle`} onClose={onClose}>
      <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
        <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
          <div>
            <label className="zk-label">Çiftçi</label>
            <SearchableSelect
              value={farmerId}
              onChange={setFarmerId}
              options={farmers.map((f) => ({ id: f.id, label: f.name }))}
              placeholder="Çiftçi ara veya seçin..."
              recentKey="farmers"
            />
          </div>
          <div>
            <label className="zk-label">Tarih / Saat</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="zk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <input className="zk-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ maxWidth: 100 }} />
            </div>
          </div>
        </div>
        <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 14 }}>
          <div>
            <label className="zk-label">Personel</label>
            <SearchableSelect
              value={personnelId}
              onChange={setPersonnelId}
              options={personnel.map((p) => ({ id: p.id, label: p.name }))}
              placeholder="Personel ara veya seçin..."
              recentKey="personnel"
            />
          </div>
          <div>
            <label className="zk-label">Araç</label>
            <SearchableSelect
              value={vehicleId}
              onChange={setVehicleId}
              options={vehicles.map((v) => ({ id: v.id, label: v.plaka }))}
              placeholder="Araç ara veya seçin..."
              recentKey="vehicles"
            />
          </div>
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Tartım satırları</div>
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <input className="zk-input" style={{ flex: '2 1 100px' }} placeholder="Sınıf" value={it.grade} onChange={(e) => updateItem(it.id, 'grade', e.target.value)} />
            <input className="zk-input" type="text" inputMode="decimal" style={{ flex: '1 1 70px' }} placeholder="Kg" value={it.kg} onChange={(e) => updateItem(it.id, 'kg', e.target.value.replace(',', '.'))} />
            <input className="zk-input" type="text" inputMode="decimal" style={{ flex: '1 1 70px' }} placeholder="Fiyat" value={it.pricePerKg} onChange={(e) => updateItem(it.id, 'pricePerKg', e.target.value.replace(',', '.'))} />
            <button className="zk-btn zk-btn-secondary" style={{ padding: '6px 8px' }} onClick={() => removeItem(it.id)}><Trash2 size={12} /></button>
          </div>
        ))}
        <button className="zk-btn zk-btn-secondary" style={{ marginBottom: 14 }} onClick={addItem}><Plus size={12} /> Satır ekle</button>

        {!purchase.noDeduction && (
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Komisyon (₺/kg)</label>
              <input className="zk-input" type="text" inputMode="decimal" step="0.01" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value.replace(',', '.'))} />
            </div>
            <div>
              <label className="zk-label">Stopaj oranı (%)</label>
              <input className="zk-input" type="text" inputMode="decimal" value={stopajOrani} onChange={(e) => setStopajOrani(e.target.value.replace(',', '.'))} />
            </div>
          </div>
        )}
        <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 14 }}>
          <div>
            <label className="zk-label">Hammaliye (₺)</label>
            <input className="zk-input" type="text" inputMode="decimal" value={hammaliyeTutari} onChange={(e) => setHammaliyeTutari(e.target.value.replace(',', '.'))} />
          </div>
          <div>
            <label className="zk-label">Nakliye (₺)</label>
            <input className="zk-input" type="text" inputMode="decimal" value={nakliyeTutari} onChange={(e) => setNakliyeTutari(e.target.value.replace(',', '.'))} />
          </div>
          <div>
            <label className="zk-label">Çuval/kasa (₺)</label>
            <input className="zk-input" type="text" inputMode="decimal" value={cuvalKesintisi} onChange={(e) => setCuvalKesintisi(e.target.value.replace(',', '.'))} />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="zk-label">Ödeme yöntemi</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <PaymentMethodPicker method={method} setMethod={setMethod} bankAccountId={bankAccountId} setBankAccountId={setBankAccountId} bankAccounts={bankAccounts} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="zk-label">Not</label>
          <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div style={{ background: COLORS.paper, borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 12.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,}}><span>Toplam kg</span><span>{fmtKg(netKg)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,}}><span>Brüt tutar</span><span>{fmtTL(amount)}</span></div>
          {firePercent > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,}}><span>Fire (%{firePercent})</span><span>-{fmtTL(fireTutari)}</span></div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 4, flexWrap: 'wrap', gap: 8,}}><span>Net ödeme</span><span>{fmtTL(netPayment)}</span></div>
        </div>

        <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Kaydet</button>
      </div>
    </Modal>
  );
}

export function BuyerQuickForm({ onSave, buyers = [] }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    const dup = buyers.some((b) => normalizeName(b.name) === normalizeName(name));
    if (dup) { setError('Bu isimde kayıtlı bir cari zaten var.'); return; }
    if (!isValidTRPhone(phone)) { setError('Telefon numarası geçersiz görünüyor (örn. 0532 xxx xx xx).'); return; }
    if (!isValidIBAN(iban)) { setError('IBAN geçersiz görünüyor (TR ile başlayıp 24 hane olmalı).'); return; }
    setError('');
    onSave({ name: name.trim(), phone: phone.trim(), address: address.trim(), bankName: bankName.trim(), iban: iban.trim() });
  };

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Alıcı / firma adı</label>
        <input className="zk-input" value={name} onChange={(e) => { setName(e.target.value); if (error) setError(''); }} placeholder="örn. Ege Zeytinyağı A.Ş." autoFocus />
        {error && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 5 }}>{error}</div>}
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Telefon (opsiyonel)</label>
        <input className="zk-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label className="zk-label">Adres (opsiyonel)</label>
        <input className="zk-input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <div>
          <label className="zk-label">Banka (opsiyonel)</label>
          <input className="zk-input" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="örn. Ziraat Bankası" />
        </div>
        <div>
          <label className="zk-label">IBAN (opsiyonel)</label>
          <input className="zk-input" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TR.." />
        </div>
      </div>
      <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={submit}>Kaydet</button>
    </>
  );
}
