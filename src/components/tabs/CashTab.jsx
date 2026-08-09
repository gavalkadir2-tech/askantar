import React, { useState, useMemo } from 'react';
import { ListFooterControls, SortableTh, StatCard } from '../common/index';
import { usePagedList, useSortableColumns } from '../../hooks/index';
import { INCOME_CATEGORIES } from '../../lib/constants';
import { computeBankAccountBalances, fmtDate, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { Banknote, Hash, Landmark, Pencil, Plus, Trash2, Wallet } from 'lucide-react';

export function CashTab({ settings, setSettings, payments, expenses, cashEntries, setCashEntries, farmers, bankAccounts, setBankAccounts, purchases = [], sales = [], buyerPayments = [] }) {
  const [entryType, setEntryType] = useState('giris');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryCategory, setEntryCategory] = useState('');

  const incomeCategories = (settings?.incomeCategories && settings.incomeCategories.length > 0) ? settings.incomeCategories : INCOME_CATEGORIES;

  const addEntry = async () => {
    const amt = parseFloat(entryAmount);
    if (!amt || amt <= 0) return;
    const record = { id: uid(), date: todayStr(), type: entryType, amount: amt, note: entryNote, category: entryType === 'giris' ? entryCategory : '', createdAt: Date.now() };
    const next = [...cashEntries, record];
    setCashEntries(next);
    await storageSet('zk:cashEntries', next);
    setEntryAmount(''); setEntryNote('');
  };

  // Nakit kasa hareketleri: sadece "nakit" yontemli islemler burada gorunur.
  // "banka" yontemli olanlar Nakit Kasa'yi degil, ilgili banka hesabini etkiler
  // (asagidaki computeBankAccountBalances). Eski kayitlarda (yontem alani
  // bulunmayan) odeme/gider varsayilan olarak nakit sayilir - geriye donuk
  // uyumluluk icin; ama eski alim/satim kayitlari (paymentMethod hic yoksa)
  // kasa hesabina dahil edilmez, cunku onlar zaten kasaya hic dahil degildi.
  const movements = useMemo(() => {
    const manual = cashEntries.map((e) => ({
      date: e.date, createdAt: e.createdAt,
      amount: e.type === 'giris' ? e.amount : -e.amount,
      label: e.type === 'giris' ? (e.category || 'Manuel giriş') : 'Manuel çıkış',
      note: e.note,
    }));
    const pay = payments.filter((p) => (p.method || 'nakit') === 'nakit').map((p) => {
      const f = farmers.find((x) => x.id === p.farmerId);
      return {
        date: p.date, createdAt: p.createdAt,
        amount: -p.amount,
        label: p.payType === 'avans' ? 'Avans' : 'Çiftçi ödemesi',
        note: f ? f.name : '',
      };
    });
    const coll = buyerPayments.filter((p) => (p.method || 'nakit') === 'nakit').map((p) => ({
      date: p.date, createdAt: p.createdAt, amount: p.amount, label: 'Alıcı tahsilatı', note: p.note,
    }));
    const exp = expenses.filter((e) => (e.method || 'nakit') === 'nakit').map((e) => ({
      date: e.date, createdAt: e.createdAt, amount: -e.amount, label: 'Gider', note: e.category,
    }));
    const buy = purchases.filter((p) => p.paymentMethod === 'nakit').map((p) => {
      const f = farmers.find((x) => x.id === p.farmerId);
      return { date: p.date, createdAt: p.createdAt, amount: -p.netPayment, label: `Alım #${p.makbuzNo} (nakit ödendi)`, note: f ? f.name : '' };
    });
    const sell = sales.filter((s) => s.paymentMethod === 'nakit').map((s) => ({
      date: s.date, createdAt: s.createdAt, amount: s.amount, label: 'Satış tahsilatı (nakit)', note: s.grade,
    }));
    return [...manual, ...pay, ...coll, ...exp, ...buy, ...sell].sort((a, b) => a.createdAt - b.createdAt);
  }, [cashEntries, payments, buyerPayments, expenses, purchases, sales, farmers]);

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

  // ---- Banka hesapları (Kasa sayfasinda, Muhasebe'nin altinda) ----
  const [editingBankId, setEditingBankId] = useState(null);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [iban, setIban] = useState('');
  const [bankBalance, setBankBalance] = useState('');
  const { sortKey: bankSortKey, sortDir: bankSortDir, toggleSort: bankToggleSort, sortRows: bankSortRows } = useSortableColumns();

  // Her hesabin GUNCEL bakiyesi: kayitli "balance" alani baslangic bakiyesi
  // olarak kullanilir, uzerine o hesaba "banka" yontemiyle baglanmis tum
  // odeme/tahsilat/gider/alim/satim hareketlerinin etkisi eklenir.
  const computedBalances = useMemo(
    () => computeBankAccountBalances(bankAccounts, { payments, buyerPayments, expenses, purchases, sales }),
    [bankAccounts, payments, buyerPayments, expenses, purchases, sales]
  );
  const totalBankBalance = Object.values(computedBalances).reduce((s, v) => s + v, 0);
  const sortedBankAccounts = bankSortRows(bankAccounts || [], (a, key) => (key === 'balance' ? computedBalances[a.id] : a[key]));

  const resetBankForm = () => { setEditingBankId(null); setBankName(''); setAccountName(''); setIban(''); setBankBalance(''); };
  const startEditBank = (a) => { setEditingBankId(a.id); setBankName(a.bankName); setAccountName(a.accountName || ''); setIban(a.iban || ''); setBankBalance(String(a.balance)); };

  const saveBank = async () => {
    if (!bankName.trim()) return;
    let next;
    const data = { bankName: bankName.trim(), accountName: accountName.trim(), iban: iban.trim(), balance: parseFloat(bankBalance) || 0 };
    if (editingBankId) {
      next = (bankAccounts || []).map((a) => (a.id === editingBankId ? { ...a, ...data } : a));
    } else {
      next = [...(bankAccounts || []), { id: uid(), ...data, createdAt: Date.now() }];
    }
    setBankAccounts(next);
    await storageSet('zk:bankAccounts', next);
    resetBankForm();
  };

  const removeBank = async (id) => {
    if (!window.confirm('Bu banka hesabını silmek istediğinize emin misiniz?')) return;
    const next = (bankAccounts || []).filter((a) => a.id !== id);
    setBankAccounts(next);
    await storageSet('zk:bankAccounts', next);
    if (editingBankId === id) resetBankForm();
  };

  return (
    <div>
      <div className="zk-h1">Kasa</div>
      <div className="zk-h1-sub">Nakit takibi — çiftçi ödemeleri/avanslar ve giderler otomatik düşülür</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 8 }}>
        <StatCard label="Güncel kasa bakiyesi" value={fmtTL(currentBalance)} tone={currentBalance < 0 ? COLORS.red : COLORS.olive} icon={Wallet} />
        <StatCard label="Açılış bakiyesi" value={fmtTL(opening)} icon={Banknote} />
      </div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
        <StatCard label="Toplam banka bakiyesi" value={fmtTL(totalBankBalance)} tone={COLORS.olive} icon={Landmark} />
        <StatCard label="Hesap sayısı" value={(bankAccounts || []).length} icon={Hash} />
      </div>

      <div style={{ marginBottom: 16 }}>
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
            <input className="zk-input" type="text" inputMode="decimal" placeholder="Tutar" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value.replace(',', '.'))} style={{ maxWidth: 130 }} />
            <input className="zk-input" placeholder="Not (örn. satış tahsilatı)" value={entryNote} onChange={(e) => setEntryNote(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
            <button className="zk-btn zk-btn-gold" onClick={addEntry}>Ekle</button>
          </div>
          <div style={{ fontSize: 11, color: COLORS.inkSoft }}>
            Açılış bakiyesini değiştirmek için Ayarlar → Genel sayfasına gidin.
          </div>
        </div>
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
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

      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, marginTop: 22 }}>🏦 Banka Hesapları</div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingBankId ? 'Hesabı düzenle' : 'Yeni banka hesabı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="zk-input" placeholder="Banka adı" style={{ flex: '1 1 140px' }} value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <input className="zk-input" placeholder="Hesap adı (opsiyonel)" style={{ flex: '1 1 140px' }} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          <input className="zk-input" placeholder="IBAN (opsiyonel)" style={{ flex: '2 1 200px' }} value={iban} onChange={(e) => setIban(e.target.value)} />
          <input className="zk-input" type="text" inputMode="decimal" placeholder="Başlangıç bakiyesi (TL)" style={{ flex: '1 1 140px' }} value={bankBalance} onChange={(e) => setBankBalance(e.target.value.replace(',', '.'))} />
          <button className="zk-btn zk-btn-gold" onClick={saveBank}>{editingBankId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingBankId && <button className="zk-btn zk-btn-secondary" onClick={resetBankForm}>İptal</button>}
        </div>
      </div>
      <div className="zk-card">
        {(bankAccounts || []).length === 0 ? (
          <div className="zk-empty">Henüz banka hesabı yok.</div>
        ) : (
          <table className="zk-table">
            <thead>
              <tr>
                <SortableTh label="Banka" sortKeyName="bankName" sortKey={bankSortKey} sortDir={bankSortDir} onSort={bankToggleSort} />
                <th>Hesap adı</th>
                <th>IBAN</th>
                <SortableTh label="Güncel bakiye" sortKeyName="balance" sortKey={bankSortKey} sortDir={bankSortDir} onSort={bankToggleSort} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedBankAccounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.bankName}</td>
                  <td style={{ color: COLORS.inkSoft }}>{a.accountName || '—'}</td>
                  <td style={{ fontSize: 11, color: COLORS.inkSoft }}>{a.iban || '—'}</td>
                  <td style={{ fontWeight: 600, color: computedBalances[a.id] < 0 ? COLORS.red : undefined }}>{fmtTL(computedBalances[a.id])}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEditBank(a)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removeBank(a.id)}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
