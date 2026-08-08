import { fmtDate, fmtKg, fmtTL } from './format';

export function formatPhoneForWhatsApp(phone) {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.startsWith('0')) digits = '90' + digits.slice(1);
  else if (digits.startsWith('90')) { /* zaten doğru */ }
  else if (digits.length === 10) digits = '90' + digits;
  return digits;
}

export function buildWhatsAppReceiptText(purchase, farmer, settings) {
  const lines = [];
  lines.push(`*${settings.businessName || 'Zeytin Komisyonculuğu'}*`);
  lines.push(`Müstahsil Makbuzu No: ${purchase.makbuzNo}`);
  lines.push(`Tarih: ${fmtDate(purchase.date)}${purchase.time ? ' · ' + purchase.time : ''}`);
  lines.push(`Sayın ${farmer.name},`);
  lines.push('');
  lines.push('Zeytin teslimatınızın dökümü:');
  (purchase.items || []).forEach((it) => {
    lines.push(`• ${it.grade}: ${fmtKg(it.kg)} × ${fmtTL(it.pricePerKg)}/kg = ${fmtTL(it.amount)}`);
  });
  lines.push('');
  lines.push(`Toplam net: ${fmtKg(purchase.netKg)}`);
  lines.push(`Ürün tutarı: ${fmtTL(purchase.amount)}`);
  if (!purchase.noDeduction) {
    lines.push(`Komisyon (%${purchase.commissionRate}): -${fmtTL(purchase.commissionAmount)}`);
    lines.push(`Stopaj (%${purchase.stopajOrani}): -${fmtTL(purchase.stopajTutari)}`);
    if (purchase.applyBagkur) lines.push(`BAĞ-KUR (%${purchase.bagkurRate}): -${fmtTL(purchase.bagkurTutari)}`);
  }
  lines.push(`*Ödenecek net: ${fmtTL(purchase.netPayment)}*`);
  if (purchase.note) lines.push(`Not: ${purchase.note}`);
  lines.push('');
  lines.push('Teşekkür ederiz.');
  return lines.join('\n');
}

export function buildWhatsAppPaymentText(row, settings) {
  const lines = [];
  lines.push(`*${settings?.businessName || 'Zeytin Komisyonculuğu'}*`);
  lines.push(row.kind === 'odeme' ? (row.payType === 'avans' ? 'Avans Makbuzu' : 'Ödeme Makbuzu') : 'Tahsilat Makbuzu');
  lines.push('');
  lines.push(`Sayın ${row.partyName},`);
  lines.push(`Tarih: ${fmtDate(row.date)}`);
  lines.push(`*Tutar: ${fmtTL(row.amount)}*`);
  if (row.note) lines.push(`Not: ${row.note}`);
  lines.push('');
  lines.push('Teşekkür ederiz.');
  return lines.join('\n');
}

export function buildWhatsAppSaleReceiptText(sale, buyer, settings) {
  const lines = [];
  lines.push(`*${settings?.businessName || 'Zeytin Komisyonculuğu'}*`);
  lines.push(`Satış Makbuzu No: ${sale.makbuzNo}`);
  lines.push(`Tarih: ${fmtDate(sale.date)}`);
  lines.push(`Sayın ${buyer ? buyer.name : ''},`);
  lines.push('');
  lines.push(`${sale.grade}: ${fmtKg(sale.kg)} × ${fmtTL(sale.pricePerKg)}/kg`);
  lines.push(`*Toplam tutar: ${fmtTL(sale.amount)}*`);
  if (sale.note) lines.push(`Not: ${sale.note}`);
  lines.push('');
  lines.push('Teşekkür ederiz.');
  return lines.join('\n');
}

export function buildWhatsAppBalanceReminderText(farmer, balance, unpaidPurchases, settings) {
  const lines = [];
  lines.push(`*${settings.businessName || 'Zeytin Komisyonculuğu'}*`);
  lines.push(`Sayın ${farmer.name},`);
  lines.push('');
  if (balance > 0) {
    lines.push(`Hesabınızda güncel olarak *${fmtTL(balance)}* alacağınız bulunmaktadır.`);
    if (unpaidPurchases && unpaidPurchases.length > 0) {
      lines.push('');
      lines.push('Son teslimatlarınız:');
      unpaidPurchases.slice(0, 5).forEach((p) => {
        lines.push(`• ${fmtDate(p.date)} — #${p.makbuzNo} — ${fmtKg(p.netKg)} — ${fmtTL(p.netPayment)}`);
      });
    }
    lines.push('');
    lines.push('En kısa sürede ödemenizi gerçekleştireceğiz. Bilginize sunarız.');
  } else {
    lines.push('Hesabınızda bekleyen bir alacak bulunmamaktadır, güncel hesabınız kapalıdır.');
  }
  lines.push('');
  lines.push('Teşekkür ederiz.');
  return lines.join('\n');
}
