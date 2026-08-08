import React, { useState, useMemo } from 'react';
import { ListFooterControls, StatCard } from '../common/index';
import { usePagedList } from '../../hooks/index';
import { INCOME_CATEGORIES } from '../../lib/constants';
import { fmtDate, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function CashTab({ settings, setSettings, payments, expenses, cashEntries, setCashEntries, farmers }) {
  const [openingBalance, setOpeningBalance] = useState(settings.openingCashBalance ?? 0);
  const [entryType, setEntryType] = useState('giris');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryCategory, setEntryCategory] = useState('');

  const incomeCategories = (settings?.incomeCategories && settings.incomeCategories.length > 0) ? settings.incomeCategories : INCOME_CATEGORIES;

  const saveOpening = async () => {
    const next = { ...settings, openingCashBalance: parseFloat(openingBalance) || 0 };
    setSettings(next);
    await storageSet('zk:settings', next);
  };

  const addEntry = async () => {
    const amt = parseFloat(entryAmount);
    if (!amt || amt <= 0) return;
    const record = { id: uid(), date: todayStr(), type: entryType, amount: amt, note: entryNote, category: entryType === 'giris' ? entryCategory : '', createdAt: Date.now() };
    const next = [...cashEntries, record];
    setCashEntries(next);
    await storageSet('zk:cashEntries', next);
    setEntryAmount(''); setEntryNote('');
  };

  const movements = useMemo(() => {
    const manual = cashEntries.map((e) => ({
      date: e.date, createdAt: e.createdAt,
      amount: e.type === 'giris' ? e.amount : -e.amount,
      label: e.type === 'giris' ? (e.category || 'Manuel giriş') : 'Manuel çıkış',
      note: e.note,
    }));
    const pay = payments.map((p) => {
      const f = farmers.find((x) => x.id === p.farmerId);
      return {
        date: p.date, createdAt: p.createdAt,
        amount: -p.amount,
        label: p.payType === 'avans' ? 'Avans' : 'Çiftçi ödemesi',
        note: f ? f.name : '',
      };
    });
    const exp = expenses.map((e) => ({
      date: e.date, createdAt: e.createdAt, amount: -e.amount, label: 'Gider', note: e.category,
    }));
    return [...manual, ...pay, ...exp].sort((a, b) => a.createdAt - b.createdAt);
  }, [cashEntries, payments, expenses, farmers]);

  const opening = settings.openingCashBalance ?? 0;
  let running = opening;
  const withRunning = movements.map((m) => { running += m.amount; return { ...m, running }; });
  const currentBalance = running;

  const removeEntry = async (id) => {
    if (!window.confirm('Bu kasa hareketini silmek istediğinize emin misiniz?')) return;
    const next = cashEntries.filter((e) => e.id !== id);
    setCashEntries(next);
    await storageSet('zk:cashEntries', next);
  };

  const [query, setQuery] = useState('');
  const reversedWithRunning = [...withRunning].reverse();
  const filteredMovements = useMemo(() => {
    if (!query) return reversedWithRunning;
    const q = query.toLowerCase();
    return reversedWithRunning.filter((m) => m.label.toLowerCase().includes(q) || (m.note || '').toLowerCase().includes(q));
  }, [withRunning, query]);
  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(filteredMovements);

  return (
    <div>
      <div className="zk-h1">Kasa</div>
      <div className="zk-h1-sub">Nakit takibi — çiftçi ödemeleri/avanslar ve giderler otomatik düşülür</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Güncel kasa bakiyesi" value={fmtTL(currentBalance)} tone={currentBalance < 0 ? COLORS.red : COLORS.olive} />
        <StatCard label="Açılış bakiyesi" value={fmtTL(opening)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start', marginBottom: 16 }}>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Açılış bakiyesi</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="zk-input" type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            <button className="zk-btn zk-btn-primary" onClick={saveOpening}>Kaydet</button>
          </div>
        </div>

        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Manuel kasa hareketi ekle</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <select className="zk-select" value={entryType} onChange={(e) => setEntryType(e.target.value)} style={{ maxWidth: 120 }}>
              <option value="giris">Giriş</option>
              <option value="cikis">Çıkış</option>
            </select>
            {entryType === 'giris' && (
              <select className="zk-select" value={entryCategory} onChange={(e) => setEntryCategory(e.target.value)} style={{ maxWidth: 150 }}>
                <option value="">Kategori (opsiyonel)</option>
                {incomeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <input className="zk-input" type="number" placeholder="Tutar" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} style={{ maxWidth: 130 }} />
            <input className="zk-input" placeholder="Not (örn. satış tahsilatı)" value={entryNote} onChange={(e) => setEntryNote(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
          </div>
          <button className="zk-btn zk-btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={addEntry}>Ekle</button>
        </div>
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Kasa hareketleri</div>
        <input className="zk-input" style={{ marginBottom: 14, maxWidth: 320 }} placeholder="İşlem veya nota göre ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {filteredMovements.length === 0 ? (
          <div className="zk-empty">{withRunning.length === 0 ? 'Hareket yok.' : 'Aramanızla eşleşen hareket bulunamadı.'}</div>
        ) : (
          <>
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>İşlem</th><th>Tutar</th><th>Bakiye</th></tr></thead>
            <tbody>
              {paged.map((m, i) => (
                <tr key={i}>
                  <td>{fmtDate(m.date)}</td>
                  <td><span className={`zk-badge ${m.amount >= 0 ? 'zk-badge-olive' : 'zk-badge-red'}`}>{m.label}{m.note ? ` · ${m.note}` : ''}</span></td>
                  <td style={{ fontWeight: 600, color: m.amount >= 0 ? COLORS.olive : COLORS.red }}>{m.amount >= 0 ? '+' : ''}{fmtTL(m.amount)}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(m.running)}</td>
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
