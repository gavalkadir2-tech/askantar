import React, { useState, useMemo } from 'react';
import { downloadPaymentReceiptPdf } from '../../pdfHelper.js';
import {
  Plus,
  Printer,
  Download,
  MessageCircle,
  Trash2,
  Pencil,
  Landmark,
  CreditCard,
} from 'lucide-react';
import { ExpiryBadge, ListFooterControls, Modal, StatCard } from '../common/index';
import { usePagedList } from '../../hooks/index';
import { fmtDate, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';
import { buildWhatsAppPaymentText, formatPhoneForWhatsApp } from '../../lib/whatsapp';

export function BankAccountsSection({ accounts, setAccounts }) {
  const [editingId, setEditingId] = useState(null);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [iban, setIban] = useState('');
  const [balance, setBalance] = useState('');

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const resetForm = () => { setEditingId(null); setBankName(''); setAccountName(''); setIban(''); setBalance(''); };
  const startEdit = (a) => { setEditingId(a.id); setBankName(a.bankName); setAccountName(a.accountName || ''); setIban(a.iban || ''); setBalance(String(a.balance)); };

  const save = async () => {
    if (!bankName.trim()) return;
    let next;
    const data = { bankName: bankName.trim(), accountName: accountName.trim(), iban: iban.trim(), balance: parseFloat(balance) || 0 };
    if (editingId) {
      next = accounts.map((a) => (a.id === editingId ? { ...a, ...data } : a));
    } else {
      next = [...accounts, { id: uid(), ...data, createdAt: Date.now() }];
    }
    setAccounts(next);
    await storageSet('zk:bankAccounts', next);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu banka hesabını silmek istediğinize emin misiniz?')) return;
    const next = accounts.filter((a) => a.id !== id);
    setAccounts(next);
    await storageSet('zk:bankAccounts', next);
    if (editingId === id) resetForm();
  };

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam banka bakiyesi" value={fmtTL(totalBalance)} tone={COLORS.olive} icon={Landmark} />
        <StatCard label="Hesap sayısı" value={accounts.length} />
      </div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Hesabı düzenle' : 'Yeni banka hesabı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="zk-input" placeholder="Banka adı" style={{ flex: '1 1 140px' }} value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <input className="zk-input" placeholder="Hesap adı (opsiyonel)" style={{ flex: '1 1 140px' }} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          <input className="zk-input" placeholder="IBAN (opsiyonel)" style={{ flex: '2 1 200px' }} value={iban} onChange={(e) => setIban(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Bakiye (TL)" style={{ flex: '1 1 120px' }} value={balance} onChange={(e) => setBalance(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" onClick={resetForm}>İptal</button>}
        </div>
      </div>
      <div className="zk-card">
        {accounts.length === 0 ? (
          <div className="zk-empty">Henüz banka hesabı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Banka</th><th>Hesap adı</th><th>IBAN</th><th>Bakiye</th><th></th></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>{a.bankName}</td>
                  <td style={{ color: COLORS.inkSoft }}>{a.accountName || '—'}</td>
                  <td style={{ fontSize: 11, color: COLORS.inkSoft }}>{a.iban || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(a.balance)}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(a)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(a.id)}><Trash2 size={12} /></button>
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

export function ChecksNotesSection({ items, setItems }) {
  const [editingId, setEditingId] = useState(null);
  const [type, setType] = useState('çek');
  const [direction, setDirection] = useState('alınan');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('Bekliyor');
  const [note, setNote] = useState('');

  const totalPending = items.filter((i) => i.status === 'Bekliyor').reduce((s, i) => s + (i.direction === 'alınan' ? i.amount : -i.amount), 0);

  const resetForm = () => { setEditingId(null); setType('çek'); setDirection('alınan'); setParty(''); setAmount(''); setDueDate(''); setStatus('Bekliyor'); setNote(''); };
  const startEdit = (i) => { setEditingId(i.id); setType(i.type); setDirection(i.direction); setParty(i.party); setAmount(String(i.amount)); setDueDate(i.dueDate); setStatus(i.status); setNote(i.note || ''); };

  const save = async () => {
    const a = parseFloat(amount);
    if (!party.trim() || !a || a <= 0 || !dueDate) return;
    let next;
    const data = { type, direction, party: party.trim(), amount: a, dueDate, status, note };
    if (editingId) {
      next = items.map((i) => (i.id === editingId ? { ...i, ...data } : i));
    } else {
      next = [...items, { id: uid(), ...data, createdAt: Date.now() }];
    }
    setItems(next);
    await storageSet('zk:checksNotes', next);
    resetForm();
  };

  const remove = async (id) => {
    if (!window.confirm('Bu çek/senet kaydını silmek istediğinize emin misiniz?')) return;
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    await storageSet('zk:checksNotes', next);
    if (editingId === id) resetForm();
  };

  const sorted = [...items].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));

  return (
    <div>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Bekleyen net tutar" value={fmtTL(totalPending)} tone={totalPending >= 0 ? COLORS.olive : COLORS.red} icon={CreditCard} />
        <StatCard label="Toplam kayıt" value={items.length} />
      </div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{editingId ? 'Kaydı düzenle' : 'Yeni çek/senet kaydı'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '1 1 90px' }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="çek">Çek</option>
            <option value="senet">Senet</option>
          </select>
          <select className="zk-select" style={{ flex: '1 1 110px' }} value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="alınan">Alınan</option>
            <option value="verilen">Verilen</option>
          </select>
          <input className="zk-input" placeholder="Kimden/kime" style={{ flex: '2 1 160px' }} value={party} onChange={(e) => setParty(e.target.value)} />
          <input className="zk-input" type="number" placeholder="Tutar (TL)" style={{ flex: '1 1 110px' }} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="zk-input" type="date" placeholder="Vade" style={{ flex: '1 1 130px' }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <select className="zk-select" style={{ flex: '1 1 130px' }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Bekliyor">Bekliyor</option>
            <option value="Tahsil Edildi">Tahsil edildi</option>
            <option value="Karşılıksız">Karşılıksız</option>
          </select>
          <input className="zk-input" placeholder="Not" style={{ flex: '1 1 120px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-gold" onClick={save}>{editingId ? 'Güncelle' : <><Plus size={14} /> Ekle</>}</button>
          {editingId && <button className="zk-btn zk-btn-secondary" onClick={resetForm}>İptal</button>}
        </div>
      </div>
      <div className="zk-card">
        {sorted.length === 0 ? (
          <div className="zk-empty">Henüz çek/senet kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tür</th><th>Yön</th><th>Kimden/kime</th><th>Tutar</th><th>Vade</th><th>Durum</th><th></th></tr></thead>
            <tbody>
              {sorted.map((i) => (
                <tr key={i.id}>
                  <td><span className="zk-badge zk-badge-blue">{i.type === 'çek' ? 'Çek' : 'Senet'}</span></td>
                  <td>{i.direction === 'alınan' ? 'Alınan' : 'Verilen'}</td>
                  <td>{i.party}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(i.amount)}</td>
                  <td><ExpiryBadge dateStr={i.dueDate} /></td>
                  <td>
                    <span className={`zk-badge ${i.status === 'Tahsil Edildi' ? 'zk-badge-olive' : i.status === 'Karşılıksız' ? 'zk-badge-red' : 'zk-badge-gold'}`}>{i.status}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => startEdit(i)}><Pencil size={12} /></button>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(i.id)}><Trash2 size={12} /></button>
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

export function PaymentsCollectionsSection({ farmers, payments, setPayments, purchases, buyers, buyerPayments, setBuyerPayments, sales, settings, onPrintPayment }) {
  const [type, setType] = useState('odeme');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [payType, setPayType] = useState('odeme');
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc');

  const farmerBalances = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.id] = 0; });
    purchases.forEach((p) => { map[p.farmerId] = (map[p.farmerId] || 0) + p.netPayment; });
    payments.forEach((pay) => { map[pay.farmerId] = (map[pay.farmerId] || 0) - pay.amount; });
    return map;
  }, [farmers, purchases, payments]);

  const buyerBalances = useMemo(() => {
    const map = {};
    buyers.forEach((b) => { map[b.id] = 0; });
    sales.forEach((s) => { map[s.buyerId] = (map[s.buyerId] || 0) + s.amount; });
    buyerPayments.forEach((p) => { map[p.buyerId] = (map[p.buyerId] || 0) - p.amount; });
    return map;
  }, [buyers, sales, buyerPayments]);

  const canSave = partyId && parseFloat(amount) > 0;

  const save = async () => {
    if (!canSave) return;
    const amt = parseFloat(amount);
    if (type === 'odeme') {
      const record = { id: uid(), farmerId: partyId, date: todayStr(), amount: amt, note, payType, createdAt: Date.now() };
      const next = [...payments, record];
      setPayments(next);
      await storageSet('zk:payments', next);
    } else {
      const record = { id: uid(), buyerId: partyId, date: todayStr(), amount: amt, note, createdAt: Date.now() };
      const next = [...buyerPayments, record];
      setBuyerPayments(next);
      await storageSet('zk:buyerPayments', next);
    }
    setAmount(''); setNote(''); setPartyId('');
  };

  const combined = useMemo(() => {
    const p = payments.map((x) => {
      const f = farmers.find((y) => y.id === x.farmerId);
      return { ...x, kind: 'odeme', partyName: f ? f.name : '—', partyPhone: f ? f.phone : '' };
    });
    const b = buyerPayments.map((x) => {
      const buyer = buyers.find((y) => y.id === x.buyerId);
      return { ...x, kind: 'tahsilat', partyName: buyer ? buyer.name : '—', partyPhone: buyer ? buyer.phone : '' };
    });
    let arr = [...p, ...b];
    if (query) arr = arr.filter((r) => r.partyName.toLowerCase().includes(query.toLowerCase()) || (r.note || '').toLowerCase().includes(query.toLowerCase()));
    if (sortOrder === 'date_asc') arr.sort((a, b2) => a.createdAt - b2.createdAt);
    else if (sortOrder === 'amount_desc') arr.sort((a, b2) => b2.amount - a.amount);
    else arr.sort((a, b2) => b2.createdAt - a.createdAt);
    return arr;
  }, [payments, buyerPayments, farmers, buyers, query, sortOrder]);

  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(combined);

  const remove = async (row) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    if (row.kind === 'odeme') {
      const next = payments.filter((x) => x.id !== row.id);
      setPayments(next);
      await storageSet('zk:payments', next);
    } else {
      const next = buyerPayments.filter((x) => x.id !== row.id);
      setBuyerPayments(next);
      await storageSet('zk:buyerPayments', next);
    }
  };

  const [editingRow, setEditingRow] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPayType, setEditPayType] = useState('odeme');

  const startEdit = (row) => {
    setEditingRow(row);
    setEditDate(row.date);
    setEditAmount(String(row.amount));
    setEditNote(row.note || '');
    setEditPayType(row.payType || 'odeme');
  };

  const saveEdit = async () => {
    const amt = parseFloat(editAmount);
    if (!amt || amt <= 0) return;
    if (editingRow.kind === 'odeme') {
      const next = payments.map((x) => (x.id === editingRow.id ? { ...x, date: editDate, amount: amt, note: editNote, payType: editPayType } : x));
      setPayments(next);
      await storageSet('zk:payments', next);
    } else {
      const next = buyerPayments.map((x) => (x.id === editingRow.id ? { ...x, date: editDate, amount: amt, note: editNote } : x));
      setBuyerPayments(next);
      await storageSet('zk:buyerPayments', next);
    }
    setEditingRow(null);
  };


  return (
    <div>
      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Yeni ödeme / tahsilat</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className={`zk-btn ${type === 'odeme' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setType('odeme'); setPartyId(''); }}>
            Çiftçiye ödeme
          </button>
          <button className={`zk-btn ${type === 'tahsilat' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setType('tahsilat'); setPartyId(''); }}>
            Alıcıdan tahsilat
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <select className="zk-select" style={{ flex: '2 1 200px' }} value={partyId} onChange={(e) => setPartyId(e.target.value)}>
            <option value="">{type === 'odeme' ? 'Çiftçi seçin...' : 'Alıcı seçin...'}</option>
            {(type === 'odeme' ? farmers : buyers).map((p) => {
              const bal = type === 'odeme' ? (farmerBalances[p.id] || 0) : (buyerBalances[p.id] || 0);
              return <option key={p.id} value={p.id}>{p.name}{bal > 0 ? ` (${fmtTL(bal)} bekliyor)` : ''}</option>;
            })}
          </select>
          {type === 'odeme' && (
            <select className="zk-select" style={{ flex: '1 1 130px' }} value={payType} onChange={(e) => setPayType(e.target.value)}>
              <option value="odeme">Ödeme</option>
              <option value="avans">Avans</option>
            </select>
          )}
          <input className="zk-input" type="number" placeholder="Tutar (TL)" style={{ flex: '1 1 130px' }} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="zk-input" placeholder="Not (opsiyonel)" style={{ flex: '1 1 150px' }} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="zk-btn zk-btn-primary" disabled={!canSave} onClick={save}>Kaydet</button>
        </div>
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Ödeme & tahsilat geçmişi</div>
        <input className="zk-input" placeholder="İsim veya nota göre ara..." style={{ marginBottom: 12, maxWidth: 320 }} value={query} onChange={(e) => setQuery(e.target.value)} />
        {combined.length === 0 ? (
          <div className="zk-empty">Henüz kayıt yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Tür</th><th>Kişi/firma</th><th>Tutar</th><th>Not</th><th></th></tr></thead>
            <tbody>
              {paged.map((row) => {
                const waPhone = formatPhoneForWhatsApp(row.partyPhone);
                return (
                  <tr key={`${row.kind}-${row.id}`} style={{ cursor: 'pointer' }} onClick={() => startEdit(row)}>
                    <td>{fmtDate(row.date)}</td>
                    <td>
                      <span className={`zk-badge ${row.kind === 'odeme' ? 'zk-badge-red' : 'zk-badge-olive'}`}>
                        {row.kind === 'odeme' ? (row.payType === 'avans' ? 'Avans' : 'Ödeme') : 'Tahsilat'}
                      </span>
                    </td>
                    <td>{row.partyName}</td>
                    <td style={{ fontWeight: 600 }}>{fmtTL(row.amount)}</td>
                    <td style={{ color: COLORS.inkSoft }}>{row.note || '—'}</td>
                    <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => startEdit(row)}><Pencil size={12} /></button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintPayment(row)}><Printer size={12} /></button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => downloadPaymentReceiptPdf(row, settings)}><Download size={12} /></button>
                      {waPhone && (
                        <a className="zk-btn" style={{ padding: '5px 9px', background: '#25D366', color: '#fff' }} href={`https://wa.me/${waPhone}?text=${encodeURIComponent(buildWhatsAppPaymentText(row, settings))}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle size={12} />
                        </a>
                      )}
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => remove(row)}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
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

      {editingRow && (
        <Modal title={`${editingRow.partyName} — Düzenle`} onClose={() => setEditingRow(null)}>
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Tarih</label>
            <input className="zk-input" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
          {editingRow.kind === 'odeme' && (
            <div style={{ marginBottom: 12 }}>
              <label className="zk-label">Tür</label>
              <select className="zk-select" value={editPayType} onChange={(e) => setEditPayType(e.target.value)}>
                <option value="odeme">Ödeme</option>
                <option value="avans">Avans</option>
              </select>
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label className="zk-label">Tutar (TL)</label>
            <input className="zk-input" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="zk-label">Not</label>
            <input className="zk-input" value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </div>
          <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={saveEdit}>Kaydet</button>
        </Modal>
      )}
    </div>
  );
}
