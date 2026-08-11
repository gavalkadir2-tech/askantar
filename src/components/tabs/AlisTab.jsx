import React, { useState } from 'react';
import { Package, ListChecks } from 'lucide-react';
import { COLORS } from '../../lib/theme';
import { ManualPurchaseTab } from './ManualPurchaseTab';
import { AllPurchasesTab } from './AllPurchasesTab';

// "Alış" (ManualPurchaseTab) ve "Alış Geçmişi" (AllPurchasesTab) modüllerini
// tek bir "Alış" sekmesi altında birleştirir.
export function AlisTab({
  farmers, setFarmers, purchases, setPurchases, priceList, personnel, vehicles, settings, onPrintReceipt, bankAccounts, activityLog, setActivityLog,
}) {
  const [mode, setMode] = useState('yeni'); // 'yeni' | 'gecmis'

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className="zk-btn"
          onClick={() => setMode('yeni')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: mode === 'yeni' ? COLORS.olive : 'transparent',
            color: mode === 'yeni' ? '#fff' : COLORS.ink,
            border: `1px solid ${mode === 'yeni' ? COLORS.olive : COLORS.border}`,
          }}
        >
          <Package size={14} /> Alış
        </button>
        <button
          className="zk-btn"
          onClick={() => setMode('gecmis')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: mode === 'gecmis' ? COLORS.olive : 'transparent',
            color: mode === 'gecmis' ? '#fff' : COLORS.ink,
            border: `1px solid ${mode === 'gecmis' ? COLORS.olive : COLORS.border}`,
          }}
        >
          <ListChecks size={14} /> Alış Geçmişi
        </button>
      </div>

      {mode === 'yeni' && (
        <ManualPurchaseTab
          farmers={farmers} setFarmers={setFarmers} purchases={purchases} setPurchases={setPurchases}
          priceList={priceList} personnel={personnel} vehicles={vehicles} settings={settings}
          onPrintReceipt={onPrintReceipt}
        />
      )}
      {mode === 'gecmis' && (
        <AllPurchasesTab
          farmers={farmers} purchases={purchases} setPurchases={setPurchases} personnel={personnel}
          vehicles={vehicles} onPrintReceipt={onPrintReceipt} settings={settings} bankAccounts={bankAccounts}
          activityLog={activityLog} setActivityLog={setActivityLog}
        />
      )}
    </div>
  );
}
