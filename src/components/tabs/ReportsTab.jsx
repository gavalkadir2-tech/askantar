import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Download,
  Package,
  Banknote,
  Percent,
  ShieldAlert,
  Wallet,
  ShoppingCart,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { ListFooterControls, StatCard } from '../common/index';
import { usePagedList } from '../../hooks/index';
import { fmtDate, fmtKg, fmtTL, todayStr } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function ReportsTab({ farmers, purchases, sales, buyers, expenses, personnel, vehicles, personnelAttendance, personnelPayments }) {
  const [range, setRange] = useState('month');
  const currentYear = new Date().getFullYear();
  const [fromA, setFromA] = useState(`${currentYear}-01-01`);
  const [toA, setToA] = useState(todayStr());
  const [fromB, setFromB] = useState(`${currentYear - 1}-01-01`);
  const [toB, setToB] = useState(`${currentYear - 1}-12-31`);

  const filtered = useMemo(() => {
    const now = new Date();
    return purchases.filter((p) => {
      const d = new Date(p.date);
      if (range === 'today') return p.date === todayStr();
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [purchases, range]);

  const filteredSales = useMemo(() => {
    const now = new Date();
    return sales.filter((s) => {
      const d = new Date(s.date);
      if (range === 'today') return s.date === todayStr();
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [sales, range]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    return expenses.filter((e) => {
      const d = new Date(e.date);
      if (range === 'today') return e.date === todayStr();
      if (range === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return true;
    });
  }, [expenses, range]);

  const totalKg = filtered.reduce((s, p) => s + p.netKg, 0);
  const totalAmount = filtered.reduce((s, p) => s + p.amount, 0);
  const totalCommission = filtered.reduce((s, p) => s + p.commissionAmount, 0);
  const totalStopaj = filtered.reduce((s, p) => s + (p.stopajTutari || 0), 0);
  const totalPayable = filtered.reduce((s, p) => s + p.netPayment, 0);
  const totalSalesAmount = filteredSales.reduce((s, s2) => s + s2.amount, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const estimatedProfit = totalCommission + totalSalesAmount - totalExpenses;

  const rangeStats = (from, to) => {
    const yp = purchases.filter((p) => p.date >= from && p.date <= to);
    const ys = sales.filter((s) => s.date >= from && s.date <= to);
    const ye = expenses.filter((e) => e.date >= from && e.date <= to);
    return {
      kg: yp.reduce((s, p) => s + p.netKg, 0),
      purchaseAmount: yp.reduce((s, p) => s + p.netPayment, 0),
      commission: yp.reduce((s, p) => s + p.commissionAmount, 0),
      salesAmount: ys.reduce((s, s2) => s + s2.amount, 0),
      expenseAmount: ye.reduce((s, e) => s + e.amount, 0),
      count: yp.length,
    };
  };
  const statsA = rangeStats(fromA, toA);
  const statsB = rangeStats(fromB, toB);

  const byFarmer = useMemo(() => {
    const map = {};
    filtered.forEach((p) => {
      if (!map[p.farmerId]) map[p.farmerId] = { kg: 0, amount: 0, count: 0 };
      map[p.farmerId].kg += p.netKg;
      map[p.farmerId].amount += p.netPayment;
      map[p.farmerId].count += 1;
    });
    return Object.entries(map).map(([farmerId, v]) => ({ farmerId, ...v })).sort((a, b) => b.kg - a.kg);
  }, [filtered]);

  const [perfSortOrder, setPerfSortOrder] = useState('kg_desc');
  const supplierPerformance = useMemo(() => {
    const map = {};
    purchases.forEach((p) => {
      if (!map[p.farmerId]) map[p.farmerId] = { kg: 0, amount: 0, count: 0, dates: [] };
      map[p.farmerId].kg += p.netKg;
      map[p.farmerId].amount += p.netPayment;
      map[p.farmerId].count += 1;
      map[p.farmerId].dates.push(p.date);
    });
    const arr = Object.entries(map).map(([farmerId, v]) => {
      const f = farmers.find((x) => x.id === farmerId);
      const avgPrice = v.kg > 0 ? v.amount / v.kg : 0;
      const avgDelivery = v.count > 0 ? v.kg / v.count : 0;
      const lastDate = v.dates.sort().slice(-1)[0];
      return { farmerId, name: f ? f.name : '—', kg: v.kg, amount: v.amount, count: v.count, avgPrice, avgDelivery, lastDate };
    });
    if (perfSortOrder === 'amount_desc') arr.sort((a, b) => b.amount - a.amount);
    else if (perfSortOrder === 'count_desc') arr.sort((a, b) => b.count - a.count);
    else if (perfSortOrder === 'avgDelivery_desc') arr.sort((a, b) => b.avgDelivery - a.avgDelivery);
    else arr.sort((a, b) => b.kg - a.kg);
    return arr;
  }, [purchases, farmers, perfSortOrder]);
  const supplierPerfPaged = usePagedList(supplierPerformance);

  const [personnelPerfSortOrder, setPersonnelPerfSortOrder] = useState('kg_desc');
  const personnelPerformance = useMemo(() => {
    const map = {};
    purchases.forEach((p) => {
      if (!p.personnelId) return;
      if (!map[p.personnelId]) map[p.personnelId] = { kg: 0, amount: 0, count: 0, dates: [] };
      map[p.personnelId].kg += p.netKg;
      map[p.personnelId].amount += p.netPayment;
      map[p.personnelId].count += 1;
      map[p.personnelId].dates.push(p.date);
    });
    const wageMap = {};
    (personnelAttendance || []).forEach((a) => { wageMap[a.personnelId] = (wageMap[a.personnelId] || 0) + a.amount; });
    const paidMap = {};
    (personnelPayments || []).forEach((pay) => { paidMap[pay.personnelId] = (paidMap[pay.personnelId] || 0) + pay.amount; });
    const arr = (personnel || []).map((per) => {
      const v = map[per.id] || { kg: 0, amount: 0, count: 0, dates: [] };
      const lastDate = v.dates.length ? v.dates.sort().slice(-1)[0] : null;
      const earned = wageMap[per.id] || 0;
      const paid = paidMap[per.id] || 0;
      return { personnelId: per.id, name: per.name, kg: v.kg, amount: v.amount, count: v.count, lastDate, earned, paid, remaining: earned - paid };
    });
    if (personnelPerfSortOrder === 'count_desc') arr.sort((a, b) => b.count - a.count);
    else if (personnelPerfSortOrder === 'amount_desc') arr.sort((a, b) => b.amount - a.amount);
    else arr.sort((a, b) => b.kg - a.kg);
    return arr;
  }, [purchases, personnel, personnelAttendance, personnelPayments, personnelPerfSortOrder]);
  const personnelPerfPaged = usePagedList(personnelPerformance);

  const [vehiclePerfSortOrder, setVehiclePerfSortOrder] = useState('kg_desc');
  const vehiclePerformance = useMemo(() => {
    const pickupMap = {};
    purchases.forEach((p) => {
      if (!p.vehicleId) return;
      if (!pickupMap[p.vehicleId]) pickupMap[p.vehicleId] = { kg: 0, count: 0, dates: [] };
      pickupMap[p.vehicleId].kg += p.netKg;
      pickupMap[p.vehicleId].count += 1;
      pickupMap[p.vehicleId].dates.push(p.date);
    });
    const deliveryMap = {};
    sales.forEach((s) => {
      if (!s.vehicleId) return;
      if (!deliveryMap[s.vehicleId]) deliveryMap[s.vehicleId] = { kg: 0, count: 0 };
      deliveryMap[s.vehicleId].kg += s.kg;
      deliveryMap[s.vehicleId].count += 1;
    });
    const arr = (vehicles || []).map((v) => {
      const pu = pickupMap[v.id] || { kg: 0, count: 0, dates: [] };
      const de = deliveryMap[v.id] || { kg: 0, count: 0 };
      const lastDate = pu.dates.length ? pu.dates.sort().slice(-1)[0] : null;
      return { vehicleId: v.id, plaka: v.plaka, pickupKg: pu.kg, pickupCount: pu.count, deliveryKg: de.kg, deliveryCount: de.count, kg: pu.kg + de.kg, lastDate };
    });
    if (vehiclePerfSortOrder === 'delivery_desc') arr.sort((a, b) => b.deliveryKg - a.deliveryKg);
    else if (vehiclePerfSortOrder === 'trips_desc') arr.sort((a, b) => (b.pickupCount + b.deliveryCount) - (a.pickupCount + a.deliveryCount));
    else arr.sort((a, b) => b.kg - a.kg);
    return arr;
  }, [purchases, sales, vehicles, vehiclePerfSortOrder]);
  const vehiclePerfPaged = usePagedList(vehiclePerformance);

  const chartData = byFarmer.slice(0, 8).map((row) => {
    const f = farmers.find((x) => x.id === row.farmerId);
    return { name: f ? f.name.split(' ')[0] : '—', kg: Math.round(row.kg * 10) / 10 };
  });

  const byGrade = useMemo(() => {
    const map = {};
    filtered.forEach((p) => {
      (p.items || []).forEach((it) => {
        if (!map[it.grade]) map[it.grade] = { kg: 0, amount: 0 };
        map[it.grade].kg += it.kg;
        map[it.grade].amount += it.amount;
      });
    });
    return Object.entries(map).map(([grade, v]) => ({ grade, ...v })).sort((a, b) => b.kg - a.kg);
  }, [filtered]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const purchaseRows = filtered.map((p) => {
      const f = farmers.find((x) => x.id === p.farmerId);
      return {
        'Makbuz No': p.makbuzNo,
        'Tarih': p.date,
        'Çiftçi': f ? f.name : '',
        'TC No': f ? f.tcNo : '',
        'Net kg': p.netKg,
        'Tutar': p.amount,
        'Komisyon (₺/kg)': p.commissionRate,
        'Komisyon tutarı': p.commissionAmount,
        'Stopaj %': p.stopajOrani,
        'Stopaj tutarı': p.stopajTutari,
        'BAĞ-KUR tutarı': p.bagkurTutari || 0,
        'Net ödenen': p.netPayment,
      };
    });
    const wsPurchases = XLSX.utils.json_to_sheet(purchaseRows);
    XLSX.utils.book_append_sheet(wb, wsPurchases, 'Alimlar');

    const detailRows = [];
    filtered.forEach((p) => {
      const f = farmers.find((x) => x.id === p.farmerId);
      (p.items || []).forEach((it) => {
        detailRows.push({
          'Makbuz No': p.makbuzNo,
          'Tarih': p.date,
          'Çiftçi': f ? f.name : '',
          'Sınıf': it.grade,
          'Kg': it.kg,
          'Kg fiyatı': it.pricePerKg,
          'Tutar': it.amount,
        });
      });
    });
    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Alim Detay (Sinif)');

    const salesRows = filteredSales.map((s) => {
      const b = buyers.find((x) => x.id === s.buyerId);
      return { 'Tarih': s.date, 'Alıcı': b ? b.name : '', 'Sınıf': s.grade || '', 'Kg': s.kg, 'Kg fiyatı': s.pricePerKg, 'Tutar': s.amount, 'Not': s.note || '' };
    });
    const wsSales = XLSX.utils.json_to_sheet(salesRows);
    XLSX.utils.book_append_sheet(wb, wsSales, 'Satislar');

    const summaryRows = byFarmer.map((row) => {
      const f = farmers.find((x) => x.id === row.farmerId);
      return { 'Çiftçi': f ? f.name : '', 'İşlem sayısı': row.count, 'Toplam kg': row.kg, 'Tutar': row.amount };
    });
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ciftci Ozeti');

    const expenseRows = filteredExpenses.map((e) => ({ 'Tarih': e.date, 'Kategori': e.category, 'Tutar': e.amount, 'Not': e.note || '' }));
    const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Giderler');

    XLSX.writeFile(wb, `zeytin-rapor-${todayStr()}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8,}}>
        <div>
          <div className="zk-h1">Raporlar</div>
          <div className="zk-h1-sub">Toplam alım, satış ve kesinti özeti</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="zk-select" style={{ width: 130 }} value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="today">Bugün</option>
            <option value="month">Bu ay</option>
            <option value="all">Tümü</option>
          </select>
          <button className="zk-btn zk-btn-blue" onClick={exportExcel}><Download size={13} /> Excel</button>
        </div>
      </div>

      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam kg" value={fmtKg(totalKg)} icon={Package} />
        <StatCard label="Ürün tutarı" value={fmtTL(totalAmount)} icon={Banknote} />
        <StatCard label="Komisyon" value={fmtTL(totalCommission)} tone={COLORS.gold} icon={Percent} />
        <StatCard label="Stopaj" value={fmtTL(totalStopaj)} tone={COLORS.blue} icon={ShieldAlert} />
        <StatCard label="Çiftçilere ödenen" value={fmtTL(totalPayable)} tone={COLORS.olive} icon={Wallet} />
        <StatCard label="Satış tutarı" value={fmtTL(totalSalesAmount)} icon={ShoppingCart} />
        <StatCard label="Giderler" value={fmtTL(totalExpenses)} tone={COLORS.red} icon={Receipt} />
        <StatCard label="Tahmini kâr" value={fmtTL(estimatedProfit)} tone={estimatedProfit >= 0 ? COLORS.olive : COLORS.red} icon={TrendingUp} />
      </div>
      <div style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 16, marginTop: -8 }}>
        Tahmini kâr = komisyon geliri + satış tutarı − giderler (kaba bir tahmindir, muhasebe kaydı yerine geçmez).
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Dönem karşılaştırma</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 4 }}>Dönem A</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="zk-input" type="date" style={{ width: 140 }} value={fromA} onChange={(e) => setFromA(e.target.value)} />
              <span style={{ color: COLORS.inkSoft, fontSize: 12 }}>—</span>
              <input className="zk-input" type="date" style={{ width: 140 }} value={toA} onChange={(e) => setToA(e.target.value)} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 4 }}>Dönem B</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input className="zk-input" type="date" style={{ width: 140 }} value={fromB} onChange={(e) => setFromB(e.target.value)} />
              <span style={{ color: COLORS.inkSoft, fontSize: 12 }}>—</span>
              <input className="zk-input" type="date" style={{ width: 140 }} value={toB} onChange={(e) => setToB(e.target.value)} />
            </div>
          </div>
        </div>
        <table className="zk-table">
          <thead><tr><th></th><th>{fmtDate(fromA)} – {fmtDate(toA)}</th><th>{fmtDate(fromB)} – {fmtDate(toB)}</th></tr></thead>
          <tbody>
            <tr><td>Alım sayısı</td><td>{statsA.count}</td><td>{statsB.count}</td></tr>
            <tr><td>Toplam kg</td><td>{fmtKg(statsA.kg)}</td><td>{fmtKg(statsB.kg)}</td></tr>
            <tr><td>Çiftçilere ödenen</td><td>{fmtTL(statsA.purchaseAmount)}</td><td>{fmtTL(statsB.purchaseAmount)}</td></tr>
            <tr><td>Komisyon geliri</td><td>{fmtTL(statsA.commission)}</td><td>{fmtTL(statsB.commission)}</td></tr>
            <tr><td>Satış tutarı</td><td>{fmtTL(statsA.salesAmount)}</td><td>{fmtTL(statsB.salesAmount)}</td></tr>
            <tr><td>Giderler</td><td>{fmtTL(statsA.expenseAmount)}</td><td>{fmtTL(statsB.expenseAmount)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Çiftçi bazında kg dağılımı</div>
        {chartData.length === 0 ? (
          <div className="zk-empty">Bu aralıkta kayıt yok.</div>
        ) : (
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={40} />
                <Tooltip formatter={(v) => [v + ' kg', 'Alım']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="kg" fill={COLORS.olive} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Sınıf / numara bazında toplam</div>
        {byGrade.length === 0 ? (
          <div className="zk-empty">Bu aralıkta kayıt yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Sınıf</th><th>Toplam kg</th><th>Tutar</th></tr></thead>
            <tbody>
              {byGrade.map((row) => (
                <tr key={row.grade}>
                  <td><span className="zk-badge zk-badge-blue">{row.grade}</span></td>
                  <td>{fmtKg(row.kg)}</td>
                  <td>{fmtTL(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>🏆 Tedarikçi performans skorlaması</div>
            <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>Tüm zamanlar — kayıtlı tüm alımlar üzerinden</div>
          </div>
        </div>
        {supplierPerformance.length === 0 ? (
          <div className="zk-empty">Henüz alım kaydı yok.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead><tr><th>#</th><th>Çiftçi</th><th>Teslimat</th><th>Toplam kg</th><th>Ort. teslimat</th><th>Ort. fiyat</th><th>Toplam ödeme</th><th>Son teslimat</th></tr></thead>
            <tbody>
              {supplierPerfPaged.paged.map((row, i) => {
                const rank = (supplierPerfPaged.page - 1) * 10 + i + 1;
                return (
                  <tr key={row.farmerId}>
                    <td style={{ fontWeight: 700, color: rank <= 3 ? COLORS.gold : COLORS.inkSoft }}>
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>{row.count}</td>
                    <td>{fmtKg(row.kg)}</td>
                    <td style={{ color: COLORS.inkSoft }}>{fmtKg(row.avgDelivery)}</td>
                    <td style={{ color: COLORS.inkSoft }}>{fmtTL(row.avgPrice)}/kg</td>
                    <td>{fmtTL(row.amount)}</td>
                    <td style={{ color: COLORS.inkSoft }}>{row.lastDate ? fmtDate(row.lastDate) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ListFooterControls
            sortOrder={perfSortOrder} setSortOrder={setPerfSortOrder}
            sortOptions={[
              { value: 'kg_desc', label: 'Toplam kg: Büyük → Küçük' },
              { value: 'amount_desc', label: 'Toplam ödeme: Büyük → Küçük' },
              { value: 'count_desc', label: 'Teslimat sayısı: Büyük → Küçük' },
              { value: 'avgDelivery_desc', label: 'Ort. teslimat: Büyük → Küçük' },
            ]}
            page={supplierPerfPaged.page} setPage={supplierPerfPaged.setPage} pageSize={supplierPerfPaged.pageSize} setPageSize={supplierPerfPaged.setPageSize} totalPages={supplierPerfPaged.totalPages} totalCount={supplierPerfPaged.totalCount}
          />
          </>
        )}
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>👷 Personel performans skorlaması</div>
            <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>Tüm zamanlar — kantarda yaptıkları alımlar ve hakediş durumu</div>
          </div>
        </div>
        {personnelPerformance.length === 0 ? (
          <div className="zk-empty">Henüz personel eklenmedi.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead><tr><th>#</th><th>Personel</th><th>Alım sayısı</th><th>Toplandığı kg</th><th>Çiftçilere ödenen</th><th>Kalan alacağı</th><th>Son alım</th></tr></thead>
            <tbody>
              {personnelPerfPaged.paged.map((row, i) => {
                const rank = (personnelPerfPaged.page - 1) * 10 + i + 1;
                return (
                  <tr key={row.personnelId}>
                    <td style={{ fontWeight: 700, color: rank <= 3 ? COLORS.gold : COLORS.inkSoft }}>
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>{row.count}</td>
                    <td>{fmtKg(row.kg)}</td>
                    <td style={{ color: COLORS.inkSoft }}>{fmtTL(row.amount)}</td>
                    <td>
                      {row.remaining > 0
                        ? <span className="zk-badge zk-badge-red">{fmtTL(row.remaining)}</span>
                        : <span className="zk-badge zk-badge-olive">Kapalı</span>}
                    </td>
                    <td style={{ color: COLORS.inkSoft }}>{row.lastDate ? fmtDate(row.lastDate) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ListFooterControls
            sortOrder={personnelPerfSortOrder} setSortOrder={setPersonnelPerfSortOrder}
            sortOptions={[
              { value: 'kg_desc', label: 'Toplandığı kg: Büyük → Küçük' },
              { value: 'count_desc', label: 'Alım sayısı: Büyük → Küçük' },
              { value: 'amount_desc', label: 'Çiftçilere ödenen: Büyük → Küçük' },
            ]}
            page={personnelPerfPaged.page} setPage={personnelPerfPaged.setPage} pageSize={personnelPerfPaged.pageSize} setPageSize={personnelPerfPaged.setPageSize} totalPages={personnelPerfPaged.totalPages} totalCount={personnelPerfPaged.totalCount}
          />
          </>
        )}
      </div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>🚚 Araç performans skorlaması</div>
            <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>Tüm zamanlar — topladığı ve teslim ettiği hacim</div>
          </div>
        </div>
        {vehiclePerformance.length === 0 ? (
          <div className="zk-empty">Henüz araç eklenmedi.</div>
        ) : (
          <>
          <table className="zk-table">
            <thead><tr><th>#</th><th>Plaka</th><th>Alım sefer</th><th>Topladığı kg</th><th>Satış sefer</th><th>Teslim ettiği kg</th><th>Son alım</th></tr></thead>
            <tbody>
              {vehiclePerfPaged.paged.map((row, i) => {
                const rank = (vehiclePerfPaged.page - 1) * 10 + i + 1;
                return (
                  <tr key={row.vehicleId}>
                    <td style={{ fontWeight: 700, color: rank <= 3 ? COLORS.gold : COLORS.inkSoft }}>
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.plaka}</td>
                    <td>{row.pickupCount}</td>
                    <td>{fmtKg(row.pickupKg)}</td>
                    <td>{row.deliveryCount}</td>
                    <td style={{ color: COLORS.inkSoft }}>{fmtKg(row.deliveryKg)}</td>
                    <td style={{ color: COLORS.inkSoft }}>{row.lastDate ? fmtDate(row.lastDate) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ListFooterControls
            sortOrder={vehiclePerfSortOrder} setSortOrder={setVehiclePerfSortOrder}
            sortOptions={[
              { value: 'kg_desc', label: 'Toplam kg: Büyük → Küçük' },
              { value: 'delivery_desc', label: 'Teslim ettiği kg: Büyük → Küçük' },
              { value: 'trips_desc', label: 'Sefer sayısı: Büyük → Küçük' },
            ]}
            page={vehiclePerfPaged.page} setPage={vehiclePerfPaged.setPage} pageSize={vehiclePerfPaged.pageSize} setPageSize={vehiclePerfPaged.setPageSize} totalPages={vehiclePerfPaged.totalPages} totalCount={vehiclePerfPaged.totalCount}
          />
          </>
        )}
      </div>

      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Çiftçi bazında dağılım (tablo)</div>
        {byFarmer.length === 0 ? (
          <div className="zk-empty">Bu aralıkta kayıt yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Çiftçi</th><th>İşlem sayısı</th><th>Toplam kg</th><th>Tutar</th></tr></thead>
            <tbody>
              {byFarmer.map((row) => {
                const f = farmers.find((x) => x.id === row.farmerId);
                return (
                  <tr key={row.farmerId}>
                    <td>{f ? f.name : '—'}</td>
                    <td>{row.count}</td>
                    <td>{fmtKg(row.kg)}</td>
                    <td>{fmtTL(row.amount)}</td>
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
