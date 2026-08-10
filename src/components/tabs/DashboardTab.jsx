import React, { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Warehouse,
  Plus,
  Package,
  Banknote,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { StatCard } from '../common/index';
import { computeAging } from '../../hooks/index';
import { fmtDate, fmtDateShort, fmtKg, fmtTL, localDateStr, todayStr } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function DashboardTab({ farmers, purchases, payments, sales, buyers, buyerPayments, setTab }) {
  const today = todayStr();
  const todaysPurchases = purchases.filter((p) => p.date === today);
  const totalKgToday = todaysPurchases.reduce((s, p) => s + p.netKg, 0);
  const totalAmountToday = todaysPurchases.reduce((s, p) => s + p.netPayment, 0);

  const totalPurchasedKg = purchases.reduce((s, p) => s + p.netKg, 0);
  const totalSoldKg = sales.reduce((s, s2) => s + s2.kg, 0);
  const currentStock = totalPurchasedKg - totalSoldKg;

  const balances = useMemo(() => {
    const map = {};
    farmers.forEach((f) => { map[f.id] = 0; });
    purchases.forEach((p) => { map[p.farmerId] = (map[p.farmerId] || 0) + p.netPayment; });
    payments.forEach((pay) => { map[pay.farmerId] = (map[pay.farmerId] || 0) - pay.amount; });
    return map;
  }, [farmers, purchases, payments]);
  const totalDebt = Object.values(balances).reduce((s, v) => s + Math.max(v, 0), 0);

  const buyerBalances = useMemo(() => {
    const map = {};
    (buyers || []).forEach((b) => { map[b.id] = 0; });
    sales.forEach((s) => { map[s.buyerId] = (map[s.buyerId] || 0) + s.amount; });
    (buyerPayments || []).forEach((p) => { map[p.buyerId] = (map[p.buyerId] || 0) - p.amount; });
    return map;
  }, [buyers, sales, buyerPayments]);
  const totalReceivable = Object.values(buyerBalances).reduce((s, v) => s + Math.max(v, 0), 0);

  const overdueList = useMemo(() => {
    const list = [];
    farmers.forEach((f) => {
      const bal = balances[f.id] || 0;
      if (bal <= 0) return;
      const debits = purchases.filter((x) => x.farmerId === f.id).map((x) => ({ amount: x.netPayment, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
      const credits = payments.filter((x) => x.farmerId === f.id).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
      const aging = computeAging(debits, credits);
      if (aging.isOverdue) list.push({ id: f.id, name: f.name, type: 'tedarikci', balance: bal, daysOverdue: aging.daysOverdue });
    });
    (buyers || []).forEach((b) => {
      const bal = buyerBalances[b.id] || 0;
      if (bal <= 0) return;
      const debits = sales.filter((x) => x.buyerId === b.id).map((x) => ({ amount: x.amount, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
      const credits = (buyerPayments || []).filter((x) => x.buyerId === b.id).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
      const aging = computeAging(debits, credits);
      if (aging.isOverdue) list.push({ id: b.id, name: b.name, type: 'cari', balance: bal, daysOverdue: aging.daysOverdue });
    });
    return list.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [farmers, buyers, purchases, payments, sales, buyerPayments, balances, buyerBalances]);
  const totalOverdueAmount = overdueList.reduce((s, o) => s + o.balance, 0);

  const chartData = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = localDateStr(d);
      const kg = purchases.filter((p) => p.date === key).reduce((s, p) => s + p.netKg, 0);
      days.push({ date: fmtDateShort(key), kg: Math.round(kg * 10) / 10 });
    }
    return days;
  }, [purchases]);

  const purchasedByGrade = useMemo(() => {
    const map = {};
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => { map[it.grade] = (map[it.grade] || 0) + it.kg; });
    });
    return map;
  }, [purchases]);

  const soldByGrade = useMemo(() => {
    const map = {};
    sales.forEach((s) => { map[s.grade || 'Etiketsiz'] = (map[s.grade || 'Etiketsiz'] || 0) + s.kg; });
    return map;
  }, [sales]);

  const stockByGrade = useMemo(() => {
    const grades = new Set([...Object.keys(purchasedByGrade), ...Object.keys(soldByGrade)]);
    return Array.from(grades).map((g) => ({ grade: g, stock: (purchasedByGrade[g] || 0) - (soldByGrade[g] || 0) })).sort((a, b) => b.stock - a.stock);
  }, [purchasedByGrade, soldByGrade]);

  const recent = [...purchases].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  const monthlyTrend = useMemo(() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }) });
    }
    return months.map(({ key, label }) => {
      const monthPurchases = purchases.filter((p) => p.date.startsWith(key));
      const kg = monthPurchases.reduce((s, p) => s + p.netKg, 0);
      const amount = monthPurchases.reduce((s, p) => s + p.amount, 0);
      const avgPrice = kg > 0 ? amount / kg : 0;
      return { label, kg: Math.round(kg * 10) / 10, avgPrice: Math.round(avgPrice * 100) / 100 };
    });
  }, [purchases]);

  return (
    <div>
      <div className="zk-h1">Pano</div>
      <div className="zk-h1-sub">{fmtDate(today)} · genel durum</div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
        <StatCard label="Bugün alınan" value={fmtKg(totalKgToday)} icon={Package} />
        <StatCard label="Bugünkü net ödeme" value={fmtTL(totalAmountToday)} icon={Banknote} />
        <StatCard label="Mevcut stok" value={fmtKg(currentStock)} tone={COLORS.blue} icon={Warehouse} />
        <StatCard label="Ödenecek bakiye" value={fmtTL(totalDebt)} tone={totalDebt > 0 ? COLORS.red : COLORS.olive} icon={Wallet} />
        <StatCard label="Tahsil edilecek" value={fmtTL(totalReceivable)} tone={totalReceivable > 0 ? COLORS.red : COLORS.olive} icon={Wallet} />
        <StatCard label="Gecikmiş bakiye" value={fmtTL(totalOverdueAmount)} tone={overdueList.length > 0 ? COLORS.red : COLORS.olive} icon={AlertTriangle} />
      </div>

      {overdueList.length > 0 && (
        <div className="zk-card" style={{ marginBottom: 16, borderColor: COLORS.red }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.red, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} /> Vadesi geçmiş {overdueList.length} hesap
            </div>
            <button className="zk-btn zk-btn-secondary" onClick={() => setTab('cari')}>Cariler'e git</button>
          </div>
          <table className="zk-table">
            <thead><tr><th>İsim</th><th>Tür</th><th>Bakiye</th><th>Gecikme</th></tr></thead>
            <tbody>
              {overdueList.slice(0, 5).map((o) => (
                <tr key={`${o.type}-${o.id}`}>
                  <td style={{ fontWeight: 600 }}>{o.name}</td>
                  <td><span className={`zk-badge ${o.type === 'tedarikci' ? 'zk-badge-olive' : 'zk-badge-blue'}`}>{o.type === 'tedarikci' ? 'Tedarikçi' : 'Cari'}</span></td>
                  <td>{fmtTL(o.balance)}</td>
                  <td style={{ color: COLORS.red, fontWeight: 600 }}>{o.daysOverdue} gün</td>
                </tr>
              ))}
            </tbody>
          </table>
          {overdueList.length > 5 && (
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 8 }}>+ {overdueList.length - 5} hesap daha — tümü için Cariler listesine bakın.</div>
          )}
        </div>
      )}

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Son 14 gün alım (kg)</div>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={40} />
              <Tooltip formatter={(v) => [v + ' kg', 'Alım']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="kg" stroke={COLORS.olive} strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>12 aylık hacim (kg)</div>
          <div style={{ width: '100%', height: 170 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={40} />
                <Tooltip formatter={(v) => [v + ' kg', 'Alım']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="kg" fill={COLORS.olive} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="zk-card">
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>12 aylık ortalama fiyat (₺/kg)</div>
          <div style={{ width: '100%', height: 170 }}>
            <ResponsiveContainer>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={40} />
                <Tooltip formatter={(v) => [fmtTL(v) + '/kg', 'Ort. fiyat']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="avgPrice" stroke={COLORS.gold} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Sınıf bazında stok</div>
        {stockByGrade.length === 0 ? (
          <div className="zk-empty">Kayıt yok.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {stockByGrade.map(({ grade: g, stock }) => (
              <div key={g} style={{ flex: '1 1 130px', background: COLORS.paper, borderRadius: 10, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap',}}>
                <span className="zk-badge zk-badge-blue" style={{ fontSize: 11 }}>{g}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: stock < 0 ? COLORS.red : COLORS.ink }}>{fmtKg(stock)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="zk-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8,}}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Son alımlar</div>
          <button className="zk-btn zk-btn-primary" onClick={() => setTab('kantar')}><Plus size={14} /> Yeni alım</button>
        </div>
        {recent.length === 0 ? (
          <div className="zk-empty"><Package size={26} className="zk-empty-icon" /><br/>Henüz alım kaydı yok. "Yeni alım" ile başlayın.</div>
        ) : (
          <table className="zk-table">
            <thead>
              <tr><th>Tarih</th><th>Çiftçi</th><th>Net kg</th><th>Fiyat</th><th>Net ödeme</th></tr>
            </thead>
            <tbody>
              {recent.map((p) => {
                const f = farmers.find((x) => x.id === p.farmerId);
                return (
                  <tr key={p.id}>
                    <td>{fmtDate(p.date)}</td>
                    <td>{f ? f.name : '—'}</td>
                    <td>{fmtKg(p.netKg)}</td>
                    <td>{fmtTL(p.pricePerKg)}/kg</td>
                    <td>{fmtTL(p.netPayment)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
