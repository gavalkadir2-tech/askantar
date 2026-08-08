import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { ListFooterControls, PaymentMethodBadge, PaymentMethodPicker, StatCard } from '../common/index';
import { usePagedList } from '../../hooks/index';
import { EXPENSE_CATEGORIES } from '../../lib/constants';
import { fmtDate, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function ExpensesTab({ expenses, setExpenses, settings, bankAccounts }) {
  const categories = (settings?.expenseCategories && settings.expenseCategories.length > 0) ? settings.expenseCategories : EXPENSE_CATEGORIES;
  const [date, setDate] = useState(todayStr());
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('nakit');
  const [bankAccountId, setBankAccountId] = useState('');
  const [range, setRange] = useState('month');
  const [sortOrder, setSortOrder] = useState('date_desc');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const now = new Date();
    return expenses.filter((e) => {
      const d = new Date(e.date);
      if (range === 'today' && e.date !== todayStr()) return false;
      if (range === 'month' && !(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (query && !(e.note || '').toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [expenses, range, categoryFilter, query]);

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    if (sortOrder === 'date_asc') arr.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortOrder === 'amount_desc') arr.sort((a, b) => b.amount - a.amount);
    else arr.sort((a, b) => b.createdAt - a.createdAt);
    return arr;
  }, [filtered, sortOrder]);

  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(sortedFiltered);

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (method === 'banka' && !bankAccountId) return;
    const record = { id: uid(), date, category, amount: amt, note, method, bankAccountId: method === 'banka' ? bankAccountId : null, createdAt: Date.now() };
    const next = [...expenses, record];
    setExpenses(next);
    await storageSet('zk:expenses', next);
    setAmount(''); setNote(''); setMethod('nakit'); setBankAccountId('');
  };

  const removeExpense = async (id) => {
    if (!window.confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return;
    const next = expenses.filter((e) => e.id !== id);
    setExpenses(next);
    await storageSet('zk:expenses', next);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8,}}>
        <div>
          <div className="zk-h1">Giderler</div>
          <div className="zk-h1-sub">Nakliye, işçilik, depo gibi işletme giderleri</div>
        </div>
        <select className="zk-select" style={{ width: 130 }} value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="today">Bugün</option>
          <option value="month">Bu ay</option>
          <option value="all">Tümü</option>
        </select>
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Toplam gider" value={fmtTL(total)} tone={COLORS.red} />
        <StatCard label="Kayıt sayısı" value={filtered.length} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni gider ekle</div>
          <div className="zk-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 10 }}>
            <div>
              <label className="zk-label">Kategori</label>
              <select className="zk-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="zk-label">Tarih</label>
              <input className="zk-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Tutar (TL)</label>
            <input className="zk-input" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} placeholder="0.00" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="zk-label">Ödeme yöntemi</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <PaymentMethodPicker method={method} setMethod={setMethod} bankAccountId={bankAccountId} setBankAccountId={setBankAccountId} bankAccounts={bankAccounts} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Not</label>
            <input className="zk-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsiyonel" />
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={save}>Kaydet</button>
        </div>

        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Kategori bazında dağılım</div>
          {byCategory.length === 0 ? (
            <div className="zk-empty">Kayıt yok.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byCategory.map(([cat, amt]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, flexWrap: 'wrap', gap: 8,}}>
                  <span className="zk-badge zk-badge-red">{cat}</span>
                  <span style={{ fontWeight: 600 }}>{fmtTL(amt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="zk-card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Gider kayıtları</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <input className="zk-input" style={{ flex: '2 1 180px' }} placeholder="Nota göre ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select className="zk-select" style={{ flex: '1 1 150px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="zk-empty">Kayıt yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setSortOrder(sortOrder === 'date_asc' ? 'date_desc' : 'date_asc')}>Tarih {sortOrder === 'date_asc' ? <ChevronUp size={12} /> : sortOrder === 'date_desc' ? <ChevronDown size={12} /> : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />}</th>
                <th>Kategori</th>
                <th>Not</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setSortOrder('amount_desc')}>Tutar {sortOrder === 'amount_desc' ? <ChevronDown size={12} /> : <ArrowUpDown size={11} style={{ opacity: 0.35 }} />}</th>
                <th>Yöntem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td><span className="zk-badge zk-badge-red">{e.category}</span></td>
                  <td style={{ color: COLORS.inkSoft }}>{e.note || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(e.amount)}</td>
                  <td><PaymentMethodBadge method={e.method} bankAccounts={bankAccounts} bankAccountId={e.bankAccountId} /></td>
                  <td><button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => removeExpense(e.id)}><X size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListFooterControls
            sortOrder={sortOrder} setSortOrder={setSortOrder}
            sortOptions={[
              { value: 'date_desc', label: 'Tarih: Yeni → Eski' },
              { value: 'date_asc', label: 'Tarih: Eski → Yeni' },
              { value: 'amount_desc', label: 'Tutar: Büyük → Küçük' },
            ]}
            page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} totalCount={totalCount}
          />
          </>
        )}
      </div>
    </div>
  );
}
