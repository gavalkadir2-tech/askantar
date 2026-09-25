import React, { useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import { COLORS } from '../../lib/theme';
import { ShipmentsTab } from './ShipmentsTab';
import { FleetTab } from './FleetTab';

// "Sevkiyat" (ShipmentsTab) ve "Araçlar" (FleetTab) modüllerini
// tek bir "Sevkiyat" sekmesi altında birleştirir.
export function SevkiyatTab({ vehicles, personnel, buyers, shipments, setShipments, fleetProps }) {
  const [mode, setMode] = useState('sevkiyat'); // 'sevkiyat' | 'araclar'

  const modeButton = (key, Icon, label) => (
    <button
      className="zk-btn"
      onClick={() => setMode(key)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: mode === key ? COLORS.olive : 'transparent',
        color: mode === key ? '#fff' : COLORS.ink,
        border: `1px solid ${mode === key ? COLORS.olive : COLORS.border}`,
      }}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {modeButton('sevkiyat', PackageCheck, 'Sevkiyat')}
        {modeButton('araclar', Truck, 'Araçlar')}
      </div>

      {mode === 'sevkiyat' && (
        <ShipmentsTab vehicles={vehicles} personnel={personnel} buyers={buyers} shipments={shipments} setShipments={setShipments} />
      )}
      {mode === 'araclar' && <FleetTab lockedView="vehicles" {...fleetProps} />}
    </div>
  );
}
