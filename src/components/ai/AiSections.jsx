import React, { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  X,
  Banknote,
  Wrench,
  ShieldAlert,
  Sparkles,
  AlertOctagon,
  UserCheck,
  Archive,
  Target,
  Radar,
  Trash2,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Wallet,
  Truck,
  Receipt,
  CalendarClock,
} from 'lucide-react';
import { AiSectionShell, StatCard } from '../common/index';
import { daysUntil, fmtDate, fmtKg, fmtTL, lastNMonthKeys, linearTrend, mean, monthKey, stdDev, storageGet, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function ExecutiveSummarySection({ farmers, purchases, sales, expenses, payments, vehicles, documents, insurance }) {
  const now = new Date();
  const thisMonthPurchases = purchases.filter((p) => monthKey(p.date) === monthKey(todayStr()));
  const thisMonthSales = sales.filter((s) => monthKey(s.date) === monthKey(todayStr()));
  const thisMonthExpenses = expenses.filter((e) => monthKey(e.date) === monthKey(todayStr()));

  const totalKg = thisMonthPurchases.reduce((s, p) => s + p.netKg, 0);
  const totalPaid = thisMonthPurchases.reduce((s, p) => s + p.netPayment, 0);
  const totalCommission = thisMonthPurchases.reduce((s, p) => s + p.commissionAmount, 0);
  const totalSalesAmount = thisMonthSales.reduce((s, s2) => s + s2.amount, 0);
  const totalExpenseAmount = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const estProfit = totalCommission + totalSalesAmount - totalExpenseAmount;

  const farmerVolume = {};
  thisMonthPurchases.forEach((p) => { farmerVolume[p.farmerId] = (farmerVolume[p.farmerId] || 0) + p.netKg; });
  const topFarmerId = Object.entries(farmerVolume).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topFarmer = farmers.find((f) => f.id === topFarmerId);

  const balances = {};
  farmers.forEach((f) => { balances[f.id] = 0; });
  purchases.forEach((p) => { balances[p.farmerId] = (balances[p.farmerId] || 0) + p.netPayment; });
  payments.forEach((pay) => { balances[pay.farmerId] = (balances[pay.farmerId] || 0) - pay.amount; });
  const totalOutstanding = Object.values(balances).reduce((s, v) => s + Math.max(v, 0), 0);

  const expiringDocs = documents.filter((d) => { const days = daysUntil(d.expiryDate); return days !== null && days <= 30; }).length
    + insurance.filter((i) => { const days = daysUntil(i.endDate); return days !== null && days <= 30; }).length;

  const [savedNote, setSavedNote] = useState('');

  const saveToArchive = async () => {
    const existing = (await storageGet('zk:aiReports')) || [];
    const report = {
      id: uid(),
      type: 'Yönetici Özeti',
      createdAt: Date.now(),
      date: todayStr(),
      summary: {
        totalKg, totalPaid, totalCommission, totalSalesAmount, totalExpenseAmount, estProfit,
        topFarmer: topFarmer?.name || null, totalOutstanding, expiringDocs, vehicleCount: vehicles.length,
      },
    };
    const next = [report, ...existing].slice(0, 200);
    await storageSet('zk:aiReports', next);
    setSavedNote('Özet arşive kaydedildi.');
    setTimeout(() => setSavedNote(''), 2500);
  };

  return (
    <AiSectionShell title="Yönetici Özeti" subtitle="Bu ayın verilerinden otomatik oluşturulan özet" icon={Sparkles}>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Bu ay alınan" value={fmtKg(totalKg)} icon={Package} />
        <StatCard label="Çiftçilere ödenen" value={fmtTL(totalPaid)} tone={COLORS.olive} icon={Banknote} />
        <StatCard label="Tahmini kâr" value={fmtTL(estProfit)} tone={estProfit >= 0 ? COLORS.olive : COLORS.red} icon={TrendingUp} />
        <StatCard label="Açık bakiye toplamı" value={fmtTL(totalOutstanding)} tone={totalOutstanding > 0 ? COLORS.red : COLORS.olive} icon={Wallet} />
      </div>
      <div className="zk-card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: COLORS.ink }}>
          Bu ay <strong>{fmtKg(totalKg)}</strong> zeytin alındı, çiftçilere toplam <strong>{fmtTL(totalPaid)}</strong> ödendi
          {topFarmer && <> — en çok çalışılan çiftçi <strong>{topFarmer.name}</strong> oldu</>}.
          Satışlardan <strong>{fmtTL(totalSalesAmount)}</strong> gelir elde edildi, giderler <strong>{fmtTL(totalExpenseAmount)}</strong> olarak gerçekleşti.
          Tahmini net kâr <strong style={{ color: estProfit >= 0 ? COLORS.olive : COLORS.red }}>{fmtTL(estProfit)}</strong>.{' '}
          {totalOutstanding > 0 && <>Çiftçilere ödenmemiş <strong style={{ color: COLORS.red }}>{fmtTL(totalOutstanding)}</strong> bakiye bulunuyor.{' '}</>}
          {expiringDocs > 0 && <>Filoda <strong style={{ color: COLORS.gold }}>{expiringDocs}</strong> belge/poliçe 30 gün içinde sona eriyor, kontrol edin.</>}
          {expiringDocs === 0 && vehicles.length > 0 && <>Filodaki tüm evrak ve poliçeler güncel görünüyor.</>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="zk-btn zk-btn-gold" onClick={saveToArchive}><Archive size={13} /> Arşive kaydet</button>
        {savedNote && <span style={{ fontSize: 12, color: COLORS.olive }}>{savedNote}</span>}
      </div>
    </AiSectionShell>
  );
}

export function AnomalySection({ purchases, farmers }) {
  const anomalies = useMemo(() => {
    const byGrade = {};
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => {
        if (!byGrade[it.grade]) byGrade[it.grade] = [];
        byGrade[it.grade].push({ price: it.pricePerKg, purchaseId: p.id, date: p.date, farmerId: p.farmerId, kg: it.kg, grade: it.grade });
      });
    });
    const results = [];
    Object.values(byGrade).forEach((items) => {
      if (items.length < 3) return;
      const prices = items.map((i) => i.price);
      const m = mean(prices), sd = stdDev(prices);
      if (sd === 0) return;
      items.forEach((it) => {
        const z = (it.price - m) / sd;
        if (Math.abs(z) >= 2) results.push({ ...it, avg: m, z });
      });
    });
    return results.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  }, [purchases]);

  return (
    <AiSectionShell title="Anomali Tespiti" subtitle="Sınıf ortalamasından belirgin sapan fiyatlar (istatistiksel aykırı değer analizi)" icon={AlertOctagon}>
      <div className="zk-card">
        {anomalies.length === 0 ? (
          <div className="zk-empty"><AlertOctagon size={26} className="zk-empty-icon" /><br/>Belirgin bir anomali tespit edilmedi.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Tarih</th><th>Çiftçi</th><th>Sınıf</th><th>Fiyat</th><th>Sınıf ortalaması</th><th>Sapma</th></tr></thead>
            <tbody>
              {anomalies.slice(0, 30).map((a, i) => {
                const f = farmers.find((x) => x.id === a.farmerId);
                return (
                  <tr key={i}>
                    <td>{fmtDate(a.date)}</td>
                    <td>{f ? f.name : '—'}</td>
                    <td><span className="zk-badge zk-badge-blue">{a.grade}</span></td>
                    <td style={{ fontWeight: 600 }}>{fmtTL(a.price)}/kg</td>
                    <td style={{ color: COLORS.inkSoft }}>{fmtTL(a.avg)}/kg</td>
                    <td><span className={`zk-badge ${a.z > 0 ? 'zk-badge-gold' : 'zk-badge-red'}`}>{a.z > 0 ? '+' : ''}{a.z.toFixed(1)}σ</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AiSectionShell>
  );
}

export function CariRiskSection({ farmers, purchases, payments }) {
  const riskList = useMemo(() => {
    return farmers.map((f) => {
      const farmerPurchases = purchases.filter((p) => p.farmerId === f.id);
      const farmerPayments = payments.filter((p) => p.farmerId === f.id);
      const balance = farmerPurchases.reduce((s, p) => s + p.netPayment, 0) - farmerPayments.reduce((s, p) => s + p.amount, 0);
      const lastActivity = [...farmerPurchases, ...farmerPayments].sort((a, b) => b.createdAt - a.createdAt)[0];
      const daysSince = lastActivity ? Math.round((Date.now() - lastActivity.createdAt) / (1000 * 60 * 60 * 24)) : null;
      let risk = 'Düşük';
      if (balance > 0 && daysSince !== null && daysSince > 45) risk = 'Yüksek';
      else if (balance > 0 && daysSince !== null && daysSince > 20) risk = 'Orta';
      else if (balance <= 0) risk = 'Yok';
      return { farmer: f, balance, daysSince, risk };
    }).filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  }, [farmers, purchases, payments]);

  const badgeClass = { 'Yüksek': 'zk-badge-red', 'Orta': 'zk-badge-gold', 'Düşük': 'zk-badge-olive', 'Yok': 'zk-badge-olive' };

  return (
    <AiSectionShell title="Cari Risk Analizi" subtitle="Ödenmemiş bakiyesi olan çiftçiler, son hareketten geçen süreye göre risk seviyesi" icon={ShieldAlert}>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Açık bakiyesi olan çiftçi" value={riskList.length} icon={Users} />
        <StatCard label="Yüksek risk" value={riskList.filter((r) => r.risk === 'Yüksek').length} tone={COLORS.red} icon={AlertTriangle} />
        <StatCard label="Toplam açık bakiye" value={fmtTL(riskList.reduce((s, r) => s + r.balance, 0))} tone={COLORS.red} icon={Wallet} />
      </div>
      <div className="zk-card">
        {riskList.length === 0 ? (
          <div className="zk-empty">Açık bakiyesi olan çiftçi yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Çiftçi</th><th>Bakiye</th><th>Son hareket</th><th>Risk</th></tr></thead>
            <tbody>
              {riskList.map((r) => (
                <tr key={r.farmer.id}>
                  <td>{r.farmer.name}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.balance)}</td>
                  <td style={{ color: COLORS.inkSoft }}>{r.daysSince !== null ? `${r.daysSince} gün önce` : '—'}</td>
                  <td><span className={`zk-badge ${badgeClass[r.risk]}`}>{r.risk}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AiSectionShell>
  );
}

export function MaintenancePredictionSection({ vehicles, maintenance, fuel }) {
  const predictions = useMemo(() => {
    return vehicles.map((v) => {
      const records = maintenance.filter((m) => m.vehicleId === v.id && m.km > 0).sort((a, b) => a.km - b.km);
      const fuelRecords = fuel.filter((f) => f.vehicleId === v.id && f.km > 0).sort((a, b) => b.km - a.km);
      const currentKm = fuelRecords[0]?.km || records[records.length - 1]?.km || 0;
      if (records.length < 2) return { vehicle: v, status: 'insufficient', currentKm };
      const intervals = [];
      for (let i = 1; i < records.length; i++) intervals.push(records[i].km - records[i - 1].km);
      const avgInterval = mean(intervals);
      const lastKm = records[records.length - 1].km;
      const remaining = avgInterval - (currentKm - lastKm);
      return { vehicle: v, status: 'ok', currentKm, avgInterval, lastKm, remaining };
    });
  }, [vehicles, maintenance, fuel]);

  return (
    <AiSectionShell title="Arıza / Bakım Tahmini" subtitle="Geçmiş bakım aralıklarına göre bir sonraki bakımın ne zaman gerekeceği tahmini" icon={Wrench}>
      {vehicles.length === 0 ? (
        <div className="zk-empty">Henüz araç eklenmedi.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {predictions.map((p) => (
            <div key={p.vehicle.id} className="zk-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.vehicle.plaka}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{p.vehicle.marka || ''}</div>
                </div>
                {p.status === 'insufficient' ? (
                  <span className="zk-badge" style={{ background: '#EEE', color: COLORS.inkSoft }}>Tahmin için yetersiz veri (en az 2 bakım kaydı gerekli)</span>
                ) : p.remaining < 0 ? (
                  <span className="zk-badge zk-badge-red">Bakım süresi geçmiş olabilir (~{Math.abs(Math.round(p.remaining))} km aşıldı)</span>
                ) : p.remaining < 500 ? (
                  <span className="zk-badge zk-badge-gold">Yaklaşıyor — tahmini {Math.round(p.remaining)} km kaldı</span>
                ) : (
                  <span className="zk-badge zk-badge-olive">Normal — tahmini {Math.round(p.remaining)} km kaldı</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AiSectionShell>
  );
}

export function BusinessCostSection({ expenses, vehicles, maintenance, fuel, fines, insurance, damages }) {
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalMaint = maintenance.reduce((s, r) => s + r.cost, 0);
  const totalFuel = fuel.reduce((s, r) => s + r.totalCost, 0);
  const totalFines = fines.reduce((s, r) => s + r.amount, 0);
  const totalInsurance = insurance.reduce((s, r) => s + r.premium, 0);
  const totalDamage = damages.reduce((s, r) => s + r.cost, 0);
  const grandTotal = totalExpenses + totalMaint + totalFuel + totalFines + totalInsurance + totalDamage;

  const chartData = [
    { name: 'İşletme gideri', tutar: totalExpenses },
    { name: 'Yakıt', tutar: totalFuel },
    { name: 'Bakım', tutar: totalMaint },
    { name: 'Sigorta', tutar: totalInsurance },
    { name: 'Ceza', tutar: totalFines },
    { name: 'Hasar', tutar: totalDamage },
  ].filter((d) => d.tutar > 0);

  return (
    <AiSectionShell title="Maliyet Analizi" subtitle="İşletme giderleri ve tüm filo maliyetlerinin birleşik görünümü" icon={Banknote}>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Toplam işletme maliyeti" value={fmtTL(grandTotal)} tone={COLORS.red} icon={TrendingDown} />
        <StatCard label="Araç maliyetleri" value={fmtTL(totalMaint + totalFuel + totalFines + totalInsurance + totalDamage)} icon={Truck} />
        <StatCard label="Genel giderler" value={fmtTL(totalExpenses)} icon={Receipt} />
      </div>
      <div className="zk-card">
        {chartData.length === 0 ? (
          <div className="zk-empty">Henüz maliyet kaydı yok.</div>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={50} />
                <Tooltip formatter={(v) => [fmtTL(v), 'Tutar']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="tutar" fill={COLORS.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AiSectionShell>
  );
}

export function PriceOptimizationSection({ purchases, sales }) {
  const gradeMargins = useMemo(() => {
    const purchasePrices = {};
    purchases.forEach((p) => {
      (p.items || []).forEach((it) => {
        if (!purchasePrices[it.grade]) purchasePrices[it.grade] = [];
        purchasePrices[it.grade].push(it.pricePerKg);
      });
    });
    const salePrices = {};
    sales.forEach((s) => {
      if (!salePrices[s.grade]) salePrices[s.grade] = [];
      salePrices[s.grade].push(s.pricePerKg);
    });
    const grades = new Set([...Object.keys(purchasePrices), ...Object.keys(salePrices)]);
    return Array.from(grades).map((g) => {
      const avgBuy = purchasePrices[g] ? mean(purchasePrices[g]) : null;
      const avgSell = salePrices[g] ? mean(salePrices[g]) : null;
      const margin = (avgBuy !== null && avgSell !== null) ? avgSell - avgBuy : null;
      const marginPct = (margin !== null && avgBuy > 0) ? (margin / avgBuy) * 100 : null;
      return { grade: g, avgBuy, avgSell, margin, marginPct };
    }).sort((a, b) => (b.marginPct ?? -999) - (a.marginPct ?? -999));
  }, [purchases, sales]);

  return (
    <AiSectionShell title="Fiyat Optimizasyonu" subtitle="Sınıf bazında alım ve satış fiyatlarının karşılaştırması — hangi sınıf daha kârlı" icon={Target}>
      <div className="zk-card">
        {gradeMargins.length === 0 ? (
          <div className="zk-empty">Henüz karşılaştırılacak veri yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Sınıf</th><th>Ort. alım fiyatı</th><th>Ort. satış fiyatı</th><th>Marj</th><th>Marj %</th></tr></thead>
            <tbody>
              {gradeMargins.map((g) => (
                <tr key={g.grade}>
                  <td><span className="zk-badge zk-badge-blue">{g.grade}</span></td>
                  <td>{g.avgBuy !== null ? fmtTL(g.avgBuy) : '—'}</td>
                  <td>{g.avgSell !== null ? fmtTL(g.avgSell) : '—'}</td>
                  <td style={{ fontWeight: 600, color: g.margin > 0 ? COLORS.olive : g.margin < 0 ? COLORS.red : COLORS.inkSoft }}>
                    {g.margin !== null ? fmtTL(g.margin) : 'Satış verisi yok'}
                  </td>
                  <td>
                    {g.marginPct !== null && (
                      <span className={`zk-badge ${g.marginPct > 10 ? 'zk-badge-olive' : g.marginPct > 0 ? 'zk-badge-gold' : 'zk-badge-red'}`}>
                        {g.marginPct > 0 ? '+' : ''}{g.marginPct.toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AiSectionShell>
  );
}

export function DemandForecastSection({ purchases, sales }) {
  const months = lastNMonthKeys(6);

  const buildSeries = (records, dateField, valueField) => {
    return months.map((mk, i) => {
      const monthRecords = records.filter((r) => monthKey(r[dateField]) === mk);
      const total = monthRecords.reduce((s, r) => s + r[valueField], 0);
      return { x: i, month: mk, y: total };
    });
  };

  const purchaseSeries = buildSeries(purchases, 'date', 'netKg');
  const salesSeries = buildSeries(sales, 'date', 'kg');

  const purchaseTrend = linearTrend(purchaseSeries.map((p) => ({ x: p.x, y: p.y })));
  const salesTrend = linearTrend(salesSeries.map((p) => ({ x: p.x, y: p.y })));

  const nextPurchaseForecast = purchaseTrend ? Math.max(0, purchaseTrend.slope * months.length + purchaseTrend.intercept) : null;
  const nextSalesForecast = salesTrend ? Math.max(0, salesTrend.slope * months.length + salesTrend.intercept) : null;

  const chartData = months.map((mk, i) => ({
    ay: mk.slice(5) + '.' + mk.slice(2, 4),
    alım: Math.round(purchaseSeries[i].y),
    satış: Math.round(salesSeries[i].y),
  }));

  return (
    <AiSectionShell title="Talep Tahmini" subtitle="Son 6 ayın alım/satış trendine göre basit doğrusal projeksiyon" icon={Radar}>
      <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 16 }}>
        <StatCard label="Gelecek ay tahmini alım" value={nextPurchaseForecast !== null ? fmtKg(nextPurchaseForecast) : 'Yetersiz veri'} tone={COLORS.olive} icon={CalendarClock} />
        <StatCard label="Gelecek ay tahmini satış" value={nextSalesForecast !== null ? fmtKg(nextSalesForecast) : 'Yetersiz veri'} tone={COLORS.blue} icon={CalendarClock} />
      </div>
      <div className="zk-card">
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Son 6 ay trendi</div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDD" />
              <XAxis dataKey="ay" tick={{ fontSize: 10, fill: COLORS.inkSoft }} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.inkSoft }} width={50} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="alım" stroke={COLORS.olive} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="satış" stroke={COLORS.blue} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 8 }}>
          Bu basit bir eğilim projeksiyonudur, mevsimsellik (hasat dönemi vb.) hesaba katmaz.
        </div>
      </div>
    </AiSectionShell>
  );
}

export function CustomerBehaviorSection({ buyers, sales }) {
  const buyerStats = useMemo(() => {
    return buyers.map((b) => {
      const buyerSales = sales.filter((s) => s.buyerId === b.id).sort((a, b2) => a.createdAt - b2.createdAt);
      const totalKg = buyerSales.reduce((s, r) => s + r.kg, 0);
      const totalAmount = buyerSales.reduce((s, r) => s + r.amount, 0);
      const avgPrice = buyerSales.length ? mean(buyerSales.map((r) => r.pricePerKg)) : 0;
      const gradeCounts = {};
      buyerSales.forEach((r) => { gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + r.kg; });
      const favoriteGrade = Object.entries(gradeCounts).sort((a, b2) => b2[1] - a[1])[0]?.[0];
      let avgGapDays = null;
      if (buyerSales.length >= 2) {
        const gaps = [];
        for (let i = 1; i < buyerSales.length; i++) gaps.push((buyerSales[i].createdAt - buyerSales[i - 1].createdAt) / (1000 * 60 * 60 * 24));
        avgGapDays = mean(gaps);
      }
      return { buyer: b, count: buyerSales.length, totalKg, totalAmount, avgPrice, favoriteGrade, avgGapDays };
    }).filter((r) => r.count > 0).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [buyers, sales]);

  return (
    <AiSectionShell title="Müşteri (Alıcı) Davranışı" subtitle="Alıcıların satın alma sıklığı, tercih ettiği sınıf ve toplam hacmi" icon={UserCheck}>
      <div className="zk-card">
        {buyerStats.length === 0 ? (
          <div className="zk-empty">Henüz satış kaydı yok.</div>
        ) : (
          <table className="zk-table">
            <thead><tr><th>Alıcı</th><th>Alım sayısı</th><th>Toplam kg</th><th>Toplam tutar</th><th>Ort. fiyat</th><th>Sık tercih</th><th>Ort. sıklık</th></tr></thead>
            <tbody>
              {buyerStats.map((r) => (
                <tr key={r.buyer.id}>
                  <td>{r.buyer.name}</td>
                  <td>{r.count}</td>
                  <td>{fmtKg(r.totalKg)}</td>
                  <td style={{ fontWeight: 600 }}>{fmtTL(r.totalAmount)}</td>
                  <td>{fmtTL(r.avgPrice)}/kg</td>
                  <td>{r.favoriteGrade ? <span className="zk-badge zk-badge-blue">{r.favoriteGrade}</span> : '—'}</td>
                  <td style={{ color: COLORS.inkSoft }}>{r.avgGapDays !== null ? `~${Math.round(r.avgGapDays)} günde bir` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AiSectionShell>
  );
}

export function ReportArchiveSection({ reports, setReports }) {
  const remove = async (id) => {
    if (!window.confirm('Bu arşiv kaydını silmek istediğinize emin misiniz?')) return;
    const next = reports.filter((r) => r.id !== id);
    setReports(next);
    await storageSet('zk:aiReports', next);
  };
  const clearAll = async () => {
    setReports([]);
    await storageSet('zk:aiReports', []);
  };

  return (
    <AiSectionShell title="Rapor Arşivi" subtitle="Yönetici özeti gibi kaydedilen anlık görüntülerin geçmişi" icon={Archive}>
      {reports.length === 0 ? (
        <div className="zk-card"><div className="zk-empty"><Archive size={26} className="zk-empty-icon" /><br/>Henüz arşivlenmiş rapor yok. Yönetici Özeti sekmesinden "Arşive kaydet" ile ekleyebilirsiniz.</div></div>
      ) : (
        <>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="zk-btn zk-btn-secondary" onClick={clearAll}><Trash2 size={13} /> Tümünü temizle</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reports.map((r) => (
              <div key={r.id} className="zk-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8,}}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.type}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{fmtDate(r.date)} · {new Date(r.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => remove(r.id)}><X size={12} /></button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: COLORS.inkSoft }}>Alınan: </span><strong>{fmtKg(r.summary.totalKg)}</strong></div>
                  <div><span style={{ color: COLORS.inkSoft }}>Ödenen: </span><strong>{fmtTL(r.summary.totalPaid)}</strong></div>
                  <div><span style={{ color: COLORS.inkSoft }}>Tahmini kâr: </span><strong>{fmtTL(r.summary.estProfit)}</strong></div>
                  <div><span style={{ color: COLORS.inkSoft }}>Açık bakiye: </span><strong>{fmtTL(r.summary.totalOutstanding)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AiSectionShell>
  );
}
