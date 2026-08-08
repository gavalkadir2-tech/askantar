import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus,
  X,
  Upload,
  Trash2,
} from 'lucide-react';
import { storageSet, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function VarietyEditor({ variety, onChange, onRemove }) {
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradePrice, setNewGradePrice] = useState('');

  const toggleHasGrades = () => onChange({ ...variety, hasGrades: !variety.hasGrades });
  const setSinglePrice = (price) => onChange({ ...variety, singlePrice: parseFloat(price) || 0 });
  const updateGradePrice = (gradeId, price) => onChange({ ...variety, grades: variety.grades.map((g) => (g.id === gradeId ? { ...g, price: parseFloat(price) || 0 } : g)) });
  const removeGradeRow = (gradeId) => onChange({ ...variety, grades: variety.grades.filter((g) => g.id !== gradeId) });
  const addGradeRow = () => {
    if (!newGradeName.trim()) return;
    onChange({ ...variety, grades: [...variety.grades, { id: uid(), name: newGradeName.trim(), price: parseFloat(newGradePrice) || 0 }] });
    setNewGradeName(''); setNewGradePrice('');
  };

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8,}}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{variety.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label className="zk-checkbox-row" style={{ fontSize: 11.5 }}>
            <input type="checkbox" checked={variety.hasGrades} onChange={toggleHasGrades} />
            Numaraya ayrılıyor
          </label>
          <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={onRemove}><X size={12} /></button>
        </div>
      </div>

      {!variety.hasGrades ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: COLORS.inkSoft }}>Kg fiyatı</span>
          <input className="zk-input" type="number" value={variety.singlePrice || 0} onChange={(e) => setSinglePrice(e.target.value)} style={{ width: 100 }} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {variety.grades.map((g) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 12.5 }}>{g.name}</span>
                <input className="zk-input" type="number" value={g.price} onChange={(e) => updateGradePrice(g.id, e.target.value)} style={{ width: 85 }} />
                <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 7px' }} onClick={() => removeGradeRow(g.id)}><X size={11} /></button>
              </div>
            ))}
            {variety.grades.length === 0 && <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>Henüz numara eklenmedi.</div>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="zk-input" value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} placeholder="örn. 1 Numara" style={{ fontSize: 12.5 }} />
            <input className="zk-input" type="number" value={newGradePrice} onChange={(e) => setNewGradePrice(e.target.value)} placeholder="Fiyat" style={{ width: 80 }} />
            <button className="zk-btn zk-btn-secondary" style={{ padding: '6px 10px' }} onClick={addGradeRow}><Plus size={12} /></button>
          </div>
        </>
      )}
    </div>
  );
}

export function TagChipList({ items, onChange, placeholder }) {
  const [newItem, setNewItem] = useState('');
  const add = () => {
    if (!newItem.trim()) return;
    onChange([...items, newItem.trim()]);
    setNewItem('');
  };
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {items.map((item, i) => (
          <span key={i} className="zk-badge zk-badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {item}
            <X size={10} style={{ cursor: 'pointer' }} onClick={() => remove(i)} />
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12, color: COLORS.inkSoft }}>Henüz kategori yok.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="zk-input" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={placeholder} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="zk-btn zk-btn-gold" onClick={add}><Plus size={13} /></button>
      </div>
    </div>
  );
}

export function TaxRateList({ rates, onChange }) {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const add = () => {
    if (!name.trim() || rate === '') return;
    onChange([...rates, { id: uid(), name: name.trim(), rate: parseFloat(rate) || 0 }]);
    setName(''); setRate('');
  };
  const remove = (id) => onChange(rates.filter((r) => r.id !== id));
  return (
    <div>
      <table className="zk-table" style={{ marginBottom: 12 }}>
        <thead><tr><th>Ad</th><th>Oran (%)</th><th></th></tr></thead>
        <tbody>
          {rates.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>%{r.rate}</td>
              <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><Trash2 size={12} /></button></td>
            </tr>
          ))}
          {rates.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: COLORS.inkSoft, padding: 16 }}>Henüz vergi oranı yok.</td></tr>}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="zk-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad (örn. KDV %8)" style={{ flex: 2 }} />
        <input className="zk-input" type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Oran" style={{ flex: 1 }} />
        <button className="zk-btn zk-btn-gold" onClick={add}><Plus size={13} /></button>
      </div>
    </div>
  );
}

export function ExcelFarmerImport({ farmers, setFarmers }) {
  const [status, setStatus] = useState('');
  const [previewCount, setPreviewCount] = useState(null);

  const handleFile = async (file) => {
    setStatus('Okunuyor...');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const findCol = (row, candidates) => {
        const keys = Object.keys(row);
        for (const c of candidates) {
          const found = keys.find((k) => k.toLowerCase().trim() === c);
          if (found) return row[found];
        }
        return '';
      };

      const newFarmers = rows
        .map((row) => {
          const name = String(findCol(row, ['ad soyad', 'isim', 'ad', 'name'])).trim();
          if (!name) return null;
          return {
            id: uid(),
            name,
            phone: String(findCol(row, ['telefon', 'phone'])).trim(),
            tcNo: String(findCol(row, ['tc no', 'tc kimlik no', 'tckimlikno', 'tc'])).trim(),
            address: String(findCol(row, ['adres', 'address'])).trim(),
            bagkurStatus: false,
            createdAt: Date.now(),
          };
        })
        .filter(Boolean);

      if (newFarmers.length === 0) {
        setStatus('Uygun satır bulunamadı. "Ad Soyad" sütunu olduğundan emin olun.');
        setPreviewCount(null);
        return;
      }

      const next = [...farmers, ...newFarmers];
      setFarmers(next);
      await storageSet('zk:farmers', next);
      setPreviewCount(newFarmers.length);
      setStatus(`${newFarmers.length} çiftçi başarıyla eklendi.`);
    } catch (e) {
      setStatus('Dosya okunamadı, geçerli bir Excel (.xlsx) dosyası olduğundan emin olun.');
      setPreviewCount(null);
    }
  };

  return (
    <div>
      <label className="zk-btn zk-btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
        <Upload size={14} /> Excel dosyası seç (.xlsx)
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
        />
      </label>
      {status && (
        <div style={{ fontSize: 12, color: previewCount ? COLORS.olive : COLORS.red, marginTop: 10 }}>{status}</div>
      )}
    </div>
  );
}

