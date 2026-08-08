import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { getQrDataUrl } from '../../qrHelper.js';
import { fmtDate, fmtKg, fmtTL } from '../../lib/format';

export function PrintRow({ label, value, bold, borderTop, borderStyle }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
      fontWeight: bold ? 700 : 400,
      borderTop: borderTop ? `1px ${borderStyle || 'dashed'} #000` : 'none',
      paddingTop: borderTop ? 4 : 0, marginTop: borderTop ? 3 : 0,
    }}>
      <span style={{ flexShrink: 1, minWidth: 0, overflowWrap: 'break-word' }}>{label}</span>
      <span style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

export function PrintArea({ purchase, farmer, settings }) {
  const [qrUrl, setQrUrl] = useState(null);
  useEffect(() => {
    if (!purchase) return;
    const verifyText = `ZeytinDefteri|Makbuz:${purchase.makbuzNo}|Tarih:${purchase.date}|Tutar:${purchase.netPayment}`;
    getQrDataUrl(verifyText).then(setQrUrl);
  }, [purchase && purchase.id]);
  if (!purchase || !farmer) return <div id="zk-print-area" />;
  return (
    <div id="zk-print-area">
      <div style={{
        fontFamily: "ui-monospace, 'Roboto Mono', 'DejaVu Sans Mono', 'Courier New', monospace",
        width: '74mm', maxWidth: '74mm', boxSizing: 'border-box', fontSize: 11, lineHeight: 1.5,
        overflowWrap: 'break-word', wordBreak: 'break-word',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxWidth: 60, maxHeight: 60, marginBottom: 4 }} />}
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, fontWeight: 600 }}>{settings.businessName || 'Zeytin Komisyonculuğu'}</div>
          {settings.address && <div style={{ fontSize: 10 }}>{settings.address}</div>}
          {settings.phone && <div style={{ fontSize: 10 }}>Tel: {settings.phone}</div>}
          {settings.taxNo && <div style={{ fontSize: 10 }}>VKN: {settings.taxNo}{settings.taxOffice ? ` · ${settings.taxOffice}` : ''}</div>}
        </div>
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: 6, textAlign: 'center', fontWeight: 700 }}>
          MÜSTAHSİL MAKBUZU<br />No: {purchase.makbuzNo}
        </div>
        <div>Tarih: {fmtDate(purchase.date)}{purchase.time ? ` · ${purchase.time}` : ''}</div>
        {purchase.personnelName && <div>Personel: {purchase.personnelName}</div>}
        <div>Satıcı: {farmer.name}</div>
        {farmer.tcNo && <div>TC No: {farmer.tcNo}</div>}
        {farmer.address && <div>Adres: {farmer.address}</div>}
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Ürün: Zeytin</div>
        {purchase.items && purchase.items.map((it) => (
          <div key={it.id} style={{ marginBottom: 4 }}>
            <div>{it.grade}</div>
            <PrintRow label={`${fmtKg(it.kg)} × ${fmtTL(it.pricePerKg)}`} value={fmtTL(it.amount)} />
          </div>
        ))}
        {(() => {
          const groups = {};
          (purchase.items || []).forEach((it) => {
            if (!groups[it.grade]) groups[it.grade] = { kg: 0, amount: 0 };
            groups[it.grade].kg += it.kg;
            groups[it.grade].amount += it.amount;
          });
          const gradeNames = Object.keys(groups);
          if ((purchase.items || []).length <= 1) return null;
          return (
            <>
              <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Sınıf bazında toplam</div>
              {gradeNames.map((g) => (
                <PrintRow key={g} label={g} value={`${fmtKg(groups[g].kg)} · ${fmtTL(groups[g].amount)}`} />
              ))}
            </>
          );
        })()}
        <PrintRow label="Toplam" value={`${fmtKg(purchase.netKg)} · ${fmtTL(purchase.amount)}`} bold borderTop />
        {(purchase.randiman || purchase.asit || purchase.nem) && (
          <>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            {purchase.randiman != null && <PrintRow label="Randıman" value={`%${purchase.randiman}`} />}
            {purchase.asit != null && <PrintRow label="Asit oranı" value={`%${purchase.asit}`} />}
            {purchase.nem != null && <PrintRow label="Nem oranı" value={`%${purchase.nem}`} />}
          </>
        )}
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        {purchase.fireTutari > 0 && <PrintRow label={`Fire/İskonto (%${purchase.firePercent})`} value={`− ${fmtTL(purchase.fireTutari)}`} />}
        {purchase.noDeduction ? (
          <PrintRow label="Kesintisiz" value="—" />
        ) : (
          <>
            <PrintRow label={`Komisyon (${purchase.commissionRate} ₺/kg)`} value={`− ${fmtTL(purchase.commissionAmount)}`} />
            <PrintRow label={`Stopaj (%${purchase.stopajOrani})`} value={`− ${fmtTL(purchase.stopajTutari)}`} />
            {purchase.applyBagkur && <PrintRow label={`BAĞ-KUR (%${purchase.bagkurRate})`} value={`− ${fmtTL(purchase.bagkurTutari)}`} />}
          </>
        )}
        {purchase.hammaliyeTutari > 0 && <PrintRow label="Hammaliye" value={`− ${fmtTL(purchase.hammaliyeTutari)}`} />}
        {purchase.nakliyeTutari > 0 && <PrintRow label="Nakliye" value={`− ${fmtTL(purchase.nakliyeTutari)}`} />}
        {purchase.cuvalKesintisi > 0 && <PrintRow label="Çuval/kasa" value={`− ${fmtTL(purchase.cuvalKesintisi)}`} />}
        <PrintRow label="ÖDENEN NET" value={fmtTL(purchase.netPayment)} bold borderTop borderStyle="solid" />
        {purchase.note && <div style={{ marginTop: 6 }}>Not: {purchase.note}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 10, gap: 10, flexWrap: 'wrap',}}>
          <div>Satıcı İmza<br/>........................</div>
          <div>Alıcı İmza<br/>........................</div>
        </div>
        {qrUrl && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <img src={qrUrl} alt="Dogrulama QR kodu" style={{ width: 70, height: 70 }} />
            <div style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Fiş doğrulama kodu</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SalePrintArea({ sale, buyer, settings }) {
  if (!sale) return <div id="zk-print-area" />;
  return (
    <div id="zk-print-area">
      <div style={{
        fontFamily: "ui-monospace, 'Roboto Mono', 'DejaVu Sans Mono', 'Courier New', monospace",
        width: '74mm', maxWidth: '74mm', boxSizing: 'border-box', fontSize: 11, lineHeight: 1.5,
        overflowWrap: 'break-word', wordBreak: 'break-word',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxWidth: 60, maxHeight: 60, marginBottom: 4 }} />}
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, fontWeight: 600 }}>{settings.businessName || 'Zeytin Komisyonculuğu'}</div>
          {settings.address && <div style={{ fontSize: 10 }}>{settings.address}</div>}
          {settings.phone && <div style={{ fontSize: 10 }}>Tel: {settings.phone}</div>}
          {settings.taxNo && <div style={{ fontSize: 10 }}>VKN: {settings.taxNo}{settings.taxOffice ? ` · ${settings.taxOffice}` : ''}</div>}
        </div>
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: 6, textAlign: 'center', fontWeight: 700 }}>
          SATIŞ MAKBUZU<br />No: {sale.makbuzNo}
        </div>
        <div>Tarih: {fmtDate(sale.date)}</div>
        <div>Alıcı: {buyer ? buyer.name : '—'}</div>
        {sale.vehiclePlaka && <div>Araç: {sale.vehiclePlaka}</div>}
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <div style={{ marginBottom: 4 }}>
          <div>{sale.grade}</div>
          <PrintRow label={`${fmtKg(sale.kg)} × ${fmtTL(sale.pricePerKg)}`} value={fmtTL(sale.amount)} />
        </div>
        <PrintRow label="TOPLAM" value={fmtTL(sale.amount)} bold borderTop borderStyle="solid" />
        {sale.note && <div style={{ marginTop: 6 }}>Not: {sale.note}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 10, gap: 10, flexWrap: 'wrap',}}>
          <div>Satan İmza<br/>........................</div>
          <div>Alan İmza<br/>........................</div>
        </div>
      </div>
    </div>
  );
}

export function PaymentPrintArea({ row, settings }) {
  if (!row) return <div id="zk-print-area" />;
  return (
    <div id="zk-print-area">
      <div style={{
        fontFamily: "ui-monospace, 'Roboto Mono', 'DejaVu Sans Mono', 'Courier New', monospace",
        width: '74mm', maxWidth: '74mm', boxSizing: 'border-box', fontSize: 11, lineHeight: 1.5,
        overflowWrap: 'break-word', wordBreak: 'break-word',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          {settings.logo && <img src={settings.logo} alt="Logo" style={{ maxWidth: 60, maxHeight: 60, marginBottom: 4 }} />}
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 14, fontWeight: 600 }}>{settings.businessName || 'Zeytin Komisyonculuğu'}</div>
          {settings.address && <div style={{ fontSize: 10 }}>{settings.address}</div>}
          {settings.phone && <div style={{ fontSize: 10 }}>Tel: {settings.phone}</div>}
        </div>
        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: 6, textAlign: 'center', fontWeight: 700 }}>
          {row.kind === 'odeme' ? (row.payType === 'avans' ? 'AVANS MAKBUZU' : 'ÖDEME MAKBUZU') : 'TAHSİLAT MAKBUZU'}
        </div>
        <div>Tarih: {fmtDate(row.date)}</div>
        <div>{row.kind === 'odeme' ? 'Çiftçi' : 'Alıcı'}: {row.partyName}</div>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <PrintRow label="TUTAR" value={fmtTL(row.amount)} bold />
        {row.note && <div style={{ marginTop: 6 }}>Not: {row.note}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 10, gap: 10, flexWrap: 'wrap',}}>
          <div>Veren İmza<br/>........................</div>
          <div>Alan İmza<br/>........................</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Sesli komut asistanı ----------

// ---------- Sesli komut ayrıştırma: yerel (ücretsiz) kural tabanlı motor ----------
// "supabase" tanımlıysa (GitHub sürümü) ve ayarlarda etkinse önce AI destekli
// ayrıştırma denenir; tanımlı değilse (Claude ortamı) veya başarısız olursa
// bu yerel motor devreye girer. İki ortamda da aynı dosya çalışır.
