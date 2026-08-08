import React, { useState } from 'react';
import { ShoppingCart, ListChecks } from 'lucide-react';
import { COLORS } from '../../lib/theme';
import { WarehouseTab } from './WarehouseTab';
import { SalesHistoryTab } from './SalesHistoryTab';

// "Satış" (WarehouseTab) ve "Satış Geçmişi" (SalesHistoryTab) modüllerini
// tek bir "Satış" sekmesi altında birleştirir.
export function SatisTab({
  purchases, buyers, setBuyers, sales, setSales, vehicles, setVehicles, personnel, settings,
  onPrintSaleReceipt, buyerPayments, setBuyerPayments, bankAccounts,
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
          <ShoppingCart size={14} /> Satış
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
          <ListChecks size={14} /> Satış Geçmişi
        </button>
      </div>

      {mode === 'yeni' && (
        <WarehouseTab
          purchases={purchases} buyers={buyers} setBuyers={setBuyers} sales={sales} setSales={setSales}
          vehicles={vehicles} setVehicles={setVehicles} personnel={personnel} settings={settings}
          onPrintSaleReceipt={onPrintSaleReceipt} buyerPayments={buyerPayments} setBuyerPayments={setBuyerPayments}
          bankAccounts={bankAccounts}
        />
      )}
      {mode === 'gecmis' && (
        <SalesHistoryTab
          buyers={buyers} sales={sales} setSales={setSales} settings={settings}
          onPrintSaleReceipt={onPrintSaleReceipt} vehicles={vehicles} bankAccounts={bankAccounts}
        />
      )}
    </div>
  );
}
