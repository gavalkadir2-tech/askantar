import React, { useState, useMemo } from 'react';
import {
  Plus,
  Upload,
  Trash2,
  Pencil,
  Navigation,
  MapPin,
  PackageCheck,
} from 'lucide-react';
import { ListFooterControls, SortableTh, StatCard } from '../common/index';
import { usePagedList, useSortableColumns } from '../../hooks/index';
import { SHIPMENT_STATUSES } from '../../lib/constants';
import { fmtDate, fmtKg, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function ShipmentsTab({ vehicles, personnel, buyers, shipments, setShipments }) {
  const [editingId, setEditingId] = useState(null);
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [loadingDate, setLoadingDate] = useState(todayStr());
  const [unloadingDate, setUnloadingDate] = useState('');
  const [waybillNo, setWaybillNo] = useState('');
  const [kg, setKg] = useState('');
  const [status, setStatus] = useState('Yükleniyor');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState('');
  const [gps, setGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('');

  const handleVehicleSelect = (id) => {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v && v.defaultPersonnelId) {
      const p = personnel.find((x) => x.id === v.defaultPersonnelId);
      if (p) setDriverName(p.name);
    }
  };

  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Tarayıcınız konum almayı desteklemiyor.');
      return;
    }
    setGpsStatus('Konum alınıyor...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('Konum alındı ✓');
      },
      () => setGpsStatus('Konum alınamadı, tarayıcı izni gerekebilir.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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

  const resetForm = () => {
    setEditingId(null); setVehicleId(''); setDriverName(''); setBuyerId(''); setDate(todayStr());
    setLoadingDate(todayStr()); setUnloadingDate(''); setWaybillNo(''); setKg(''); setStatus('Yükleniyor');
    setNote(''); setPhoto(''); setGps(null); setGpsStatus('');
  };

  const startEdit = (s) => {
    setEditingId(s.id); setVehicleId(s.vehicleId || ''); setDriverName(s.driverName || ''); setBuyerId(s.buyerId || '');
    setDate(s.date); setLoadingDate(s.loadingDate || ''); setUnloadingDate(s.unloadingDate || ''); setWaybillNo(s.waybillNo || '');
    setKg(String(s.kg || '')); setStatus(s.status); setNote(s.note || ''); setPhoto(s.photo || ''); setGps(s.gps || null);
  };

  const save = async () => {
    if (!vehicleId || !buyerId) return;
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const buyer = buyers.find((b) => b.id === buyerId);
    const data = {
      vehicleId, vehiclePlaka: vehicle ? vehicle.plaka : '', driverName,
      buyerId, buyerName: buyer ? buyer.name : '',
      date, loadingDate, unloadingDate, waybillNo, kg: parseFloat(kg) || 0, status, note, photo, gps,
    };
    let next;
    if (editingId) {
      next = shipments.map((s) => (s.id === editingId ? { ...s, ...data } : s));
    } else {
      next = [...shipments, { id: uid(), ...data, createdAt: Date.now() }];
    }
    setShipments(next);
    await storageSet('zk:shipments', next);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu sevkiyat kaydını silmek istediğinize emin misiniz?')) return;
    const next = shipments.filter((s) => s.id !== id);
    setShipments(next);
    await storageSet('zk:shipments', next);
    if (editingId === id) resetForm();
  };

  const [query, setQuery] = useState('');
  const { sortKey, sortDir, toggleSort, sortRows } = useSortableColumns('createdAt', 'desc');
  const totalKg = shipments.reduce((s, x) => s + x.kg, 0);
  const activeCount = shipments.filter((s) => s.status !== 'Teslim Edildi').length;
  const filtered = useMemo(() => {
    if (!query) return shipments;
    const q = query.toLowerCase();
    return shipments.filter((s) => (s.waybillNo || '').toLowerCase().includes(q) || (s.vehiclePlaka || '').toLowerCase().includes(q) || (s.driverName || '').toLowerCase().includes(q) || (s.buyerName || '').toLowerCase().includes(q) || (s.note || '').toLowerCase().includes(q));
  }, [shipments, query]);
  const sorted = sortRows(filtered, (s, key) => s[key]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(sorted);

  return (
    <div>
      <div className="zk-h1">Sevkiyat & İrsaliye</div>
      <div className="zk-h1-sub">Araç ile alıcıya yapılan teslimatların takibi — yükleme, boşaltma, konum ve teslim durumu</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Toplam sevkiyat" value={shipments.length} icon={PackageCheck} />
        <StatCard label="Devam eden" value={activeCount} tone={COLORS.gold} />
        <StatCard label="Toplam taşınan" value={fmtKg(totalKg)} tone={COLORS.olive} />
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Sevkiyatı düzenle' : 'Yeni sevkiyat'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 130px' }} value={vehicleId} onChange={(e) => handleVehicleSelect(e.target.value)}>
            <option value="">Araç seçin...</option>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plaka}</option>)}
          </select>
          <input className="zk-input" placeholder="Şoför adı" style={{ flex: '1 1 140px' }} value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          <select className="zk-select" style={{ flex: '1 1 160px' }} value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
            <option value="">Alıcı / fabrika seçin...</option>
            {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className="zk-input" placeholder="İrsaliye no" style={{ flex: '1 1 120px' }} value={waybillNo} onChange={(e) => setWaybillNo(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ flex: '1 1 130px' }}>
            <label className="zk-label">Yükleme tarihi</label>
            <input className="zk-input" type="date" value={loadingDate} onChange={(e) => setLoadingDate(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label className="zk-label">Boşaltma tarihi</label>
            <input className="zk-input" type="date" value={unloadingDate} onChange={(e) => setUnloadingDate(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 100px' }}>
            <label className="zk-label">Kg</label>
            <input className="zk-input" type="number" value={kg} onChange={(e) => setKg(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label className="zk-label">Durum</label>
            <select className="zk-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {SHIPMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <input className="zk-input" placeholder="Not" style={{ flex: '2 1 180px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-secondary" onClick={captureGps}><MapPin size={13} /> Konum al</button>
          {gps && (
            <a href={`https://maps.google.com/?q=${gps.lat},${gps.lng}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: COLORS.blue }}>
              <Navigation size={11} style={{ verticalAlign: 'middle' }} /> Haritada gör
            </a>
          )}
          {gpsStatus && <span style={{ fontSize: 11, color: COLORS.inkSoft }}>{gpsStatus}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <label className="zk-btn zk-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
            <Upload size={13} /> {photo ? 'Fotoğrafı değiştir' : 'Sevkiyat fotoğrafı ekle'}
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0]) handlePhotoUpload(e.target.files[0]); e.target.value = ''; }} />
          </label>
          {photo && <img src={photo} alt="Sevkiyat fotoğrafı" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: `1px solid ${COLORS.border}` }} />}
        </div>
        <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Kaydet</>}</button>
        {editingId && <button className="zk-btn zk-btn-secondary" style={{ marginLeft: 8 }} onClick={resetForm}>İptal</button>}
      </div>

      <div className="zk-card">
        <input className="zk-input" style={{ marginBottom: 14, maxWidth: 320 }} placeholder="İrsaliye no, araç, şoför veya alıcıya göre ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {sorted.length === 0 ? (
          <div className="zk-empty"><PackageCheck size={26} className="zk-empty-icon" /><br/>{shipments.length === 0 ? 'Henüz sevkiyat kaydı yok.' : 'Aramanızla eşleşen sevkiyat bulunamadı.'}</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="İrsaliye" sortKeyName="waybillNo" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Araç" sortKeyName="vehiclePlaka" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Alıcı" sortKeyName="buyerName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Kg" sortKeyName="kg" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Durum" sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th>Konum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((s) => (
                <tr key={s.id}>
                  <td>{s.waybillNo || '—'}<div style={{ fontSize: 10.5, color: COLORS.inkSoft }}>{fmtDate(s.date)}</div></td>
                  <td>{s.vehiclePlaka}<div style={{ fontSize: 10.5, color: COLORS.inkSoft }}>{s.driverName}</div></td>
                  <td>{s.buyerName}</td>
                  <td>{fmtKg(s.kg)}</td>
                  <td>
                    <span className={`zk-badge ${s.status === 'Teslim Edildi' ? 'zk-badge-olive' : s.status === 'Yolda' ? 'zk-badge-gold' : 'zk-badge-blue'}`}>{s.status}</span>
                  </td>
                  <td>
                    {s.gps ? (
                      <a href={`https://maps.google.com/?q=${s.gps.lat},${s.gps.lng}`} target="_blank" rel="noopener noreferrer">
                        <MapPin size={14} color={COLORS.blue} />
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(s)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(s.id)}><Trash2 size={12} /></button>
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

// ---------- Finans (Cari Hesap + Kasa + Giderler + Muhasebe birleşik) ----------

// ---------- Stok özeti (Depo & Envanter içinde kullanılır) ----------
