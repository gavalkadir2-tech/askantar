import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Wrench,
  ShieldAlert,
  Sparkles,
  AlertOctagon,
  UserCheck,
  Archive,
  Target,
  Radar,
} from 'lucide-react';
import { AnomalySection, BusinessCostSection, CariRiskSection, CustomerBehaviorSection, DemandForecastSection, ExecutiveSummarySection, MaintenancePredictionSection, PriceOptimizationSection, ReportArchiveSection } from '../ai/AiSections';
import { storageGet } from '../../lib/format';

export function AiAssistantTab({ farmers, purchases, sales, expenses, payments, buyers, vehicles, maintenance, fuel, documents, insurance, damages, fines }) {
  const [section, setSection] = useState('summary');
  const [reports, setReports] = useState([]);
  const [loadedReports, setLoadedReports] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await storageGet('zk:aiReports');
      setReports(r || []);
      setLoadedReports(true);
    })();
  }, []);

  const sections = [
    { key: 'summary', label: 'Yönetici Özeti', icon: Sparkles },
    { key: 'maintenance', label: 'Arıza Tahmini', icon: Wrench },
    { key: 'cost', label: 'Maliyet Analizi', icon: Banknote },
    { key: 'price', label: 'Fiyat Optimizasyonu', icon: Target },
    { key: 'demand', label: 'Talep Tahmini', icon: Radar },
    { key: 'customer', label: 'Müşteri Davranışı', icon: UserCheck },
    { key: 'anomaly', label: 'Anomali Tespiti', icon: AlertOctagon },
    { key: 'risk', label: 'Cari Risk Analizi', icon: ShieldAlert },
    { key: 'archive', label: 'Rapor Arşivi', icon: Archive },
  ];

  return (
    <div>
      <div className="zk-h1">💬 AI Asistan</div>
      <div className="zk-h1-sub">Verilerinizden otomatik üretilen kural tabanlı analiz ve içgörüler — dış API kullanılmaz, tüm hesaplama tarayıcınızda yapılır</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {sections.map((s) => (
          <button
            key={s.key}
            className={`zk-btn ${section === s.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`}
            style={{ fontSize: 12 }}
            onClick={() => setSection(s.key)}
          >
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      {section === 'summary' && <ExecutiveSummarySection farmers={farmers} purchases={purchases} sales={sales} expenses={expenses} payments={payments} vehicles={vehicles} documents={documents} insurance={insurance} />}
      {section === 'maintenance' && <MaintenancePredictionSection vehicles={vehicles} maintenance={maintenance} fuel={fuel} />}
      {section === 'cost' && <BusinessCostSection expenses={expenses} vehicles={vehicles} maintenance={maintenance} fuel={fuel} fines={fines} insurance={insurance} damages={damages} />}
      {section === 'price' && <PriceOptimizationSection purchases={purchases} sales={sales} />}
      {section === 'demand' && <DemandForecastSection purchases={purchases} sales={sales} />}
      {section === 'customer' && <CustomerBehaviorSection buyers={buyers} sales={sales} />}
      {section === 'anomaly' && <AnomalySection purchases={purchases} farmers={farmers} />}
      {section === 'risk' && <CariRiskSection farmers={farmers} purchases={purchases} payments={payments} />}
      {section === 'archive' && loadedReports && <ReportArchiveSection reports={reports} setReports={setReports} />}
    </div>
  );
}

// ---------- Kasa & Çuval Envanteri (fiziksel ambalaj takibi — nakit kasadan farklı) ----------
