import React, { useState } from 'react';
import { Scale as ScaleIcon, ShoppingCart } from 'lucide-react';
import { COLORS } from '../../lib/theme';
import { PurchaseTab } from './PurchaseTab';
import { ScaleSaleTab } from './ScaleSaleTab';

// "Kantarlı Alış" (PurchaseTab) ve "Kantarlı Satış" (ScaleSaleTab) modüllerini
// İşlemler grubunda tek bir "Kantar" sekmesi altında birleştirir. Aradaki
// segmented control ile alış/satış görünümü arasında geçiş yapılır.
export function KantarTab({
  // ortak
  settings, priceList, personnel, vehicles, broadcastLive, openCustomerDisplay, customerDisplayUrl,
  // alış tarafı
  farmers, setFarmers, purchases, setPurchases, onPrintReceipt, setPersonnel, setVehicles,
  // satış tarafı
  buyers, setBuyers, sales, setSales, onPrintSaleReceipt,
}) {
  const [mode, setMode] = useState('alis'); // 'alis' | 'satis'

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className="zk-btn"
          onClick={() => setMode('alis')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: mode === 'alis' ? COLORS.olive : 'transparent',
            color: mode === 'alis' ? '#fff' : COLORS.ink,
            border: `1px solid ${mode === 'alis' ? COLORS.olive : COLORS.border}`,
          }}
        >
          <ScaleIcon size={14} /> Kantarlı Alış
        </button>
        <button
          className="zk-btn"
          onClick={() => setMode('satis')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: mode === 'satis' ? COLORS.olive : 'transparent',
            color: mode === 'satis' ? '#fff' : COLORS.ink,
            border: `1px solid ${mode === 'satis' ? COLORS.olive : COLORS.border}`,
          }}
        >
          <ShoppingCart size={14} /> Kantarlı Satış
        </button>
      </div>

      {mode === 'alis' && (
        <PurchaseTab
          farmers={farmers} setFarmers={setFarmers} purchases={purchases} setPurchases={setPurchases}
          onPrintReceipt={onPrintReceipt} settings={settings} priceList={priceList} personnel={personnel}
          setPersonnel={setPersonnel} vehicles={vehicles} setVehicles={setVehicles} broadcastLive={broadcastLive}
          openCustomerDisplay={openCustomerDisplay} customerDisplayUrl={customerDisplayUrl}
        />
      )}
      {mode === 'satis' && (
        <ScaleSaleTab
          buyers={buyers} setBuyers={setBuyers} sales={sales} setSales={setSales} purchases={purchases}
          priceList={priceList} personnel={personnel} vehicles={vehicles} settings={settings}
          onPrintSaleReceipt={onPrintSaleReceipt} broadcastLive={broadcastLive}
          openCustomerDisplay={openCustomerDisplay} customerDisplayUrl={customerDisplayUrl}
        />
      )}
    </div>
  );
}
