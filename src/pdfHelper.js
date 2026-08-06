import jsPDF from 'jspdf';

function tl(n, decimals) {
  const num = Number(n) || 0;
  const d = decimals ?? 2;
  const abs = Math.abs(num).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${num < 0 ? '-' : ''}${abs} ₺`;
}
function fmtDateTr(d) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtKgTr(n) {
  return (Number(n) || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' kg';
}

export function downloadReceiptPdf(purchase, farmer, settings) {
  const decimals = (settings && settings.decimalPlaces) ?? 2;
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const cx = 40;
  let y = 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text((settings && settings.businessName) || 'Zeytin Komisyonculuğu', cx, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  if (settings && settings.address) { doc.text(settings.address, cx, y, { align: 'center' }); y += 3.5; }
  if (settings && settings.phone) { doc.text(`Tel: ${settings.phone}`, cx, y, { align: 'center' }); y += 3.5; }
  if (settings && settings.taxNo) { doc.text(`VKN: ${settings.taxNo}${settings.taxOffice ? ' · ' + settings.taxOffice : ''}`, cx, y, { align: 'center' }); y += 3.5; }

  y += 2;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`MÜSTAHSİL MAKBUZU No: ${purchase.makbuzNo}`, cx, y, { align: 'center' });
  y += 5;
  doc.line(4, y, 76, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const line = (text) => { doc.text(text, 5, y); y += 4; };
  line(`Tarih: ${fmtDateTr(purchase.date)}${purchase.time ? ' · ' + purchase.time : ''}`);
  if (purchase.personnelName) line(`Personel: ${purchase.personnelName}`);
  line(`Satıcı: ${farmer ? farmer.name : ''}`);
  if (farmer && farmer.tcNo) line(`TC No: ${farmer.tcNo}`);
  if (farmer && farmer.address) line(`Adres: ${farmer.address}`);

  y += 1;
  doc.line(4, y, 76, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  line('Ürün: Zeytin');
  doc.setFont('helvetica', 'normal');
  (purchase.items || []).forEach((it) => {
    doc.setFontSize(7.5);
    line(`${it.grade}`);
    doc.text(`${fmtKgTr(it.kg)} x ${tl(it.pricePerKg, decimals)}`, 5, y);
    doc.text(tl(it.amount, decimals), 75, y, { align: 'right' });
    y += 4;
    doc.setFontSize(8);
  });
  doc.setFont('helvetica', 'bold');
  doc.text('Toplam', 5, y);
  doc.text(`${fmtKgTr(purchase.netKg)}  ${tl(purchase.amount, decimals)}`, 75, y, { align: 'right' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.line(4, y, 76, y);
  y += 4;

  const row = (label, value) => { doc.text(label, 5, y); doc.text(value, 75, y, { align: 'right' }); y += 4; };
  if (purchase.noDeduction) {
    row('Kesintisiz', '—');
  } else {
    row(`Komisyon (%${purchase.commissionRate})`, `- ${tl(purchase.commissionAmount, decimals)}`);
    row(`Stopaj (%${purchase.stopajOrani})`, `- ${tl(purchase.stopajTutari, decimals)}`);
    if (purchase.applyBagkur) row(`BAĞ-KUR (%${purchase.bagkurRate})`, `- ${tl(purchase.bagkurTutari, decimals)}`);
  }
  if (purchase.hammaliyeTutari) row('Hammaliye', `- ${tl(purchase.hammaliyeTutari, decimals)}`);
  if (purchase.nakliyeTutari) row('Nakliye', `- ${tl(purchase.nakliyeTutari, decimals)}`);
  if (purchase.cuvalKesintisi) row('Çuval/kasa', `- ${tl(purchase.cuvalKesintisi, decimals)}`);

  y += 1;
  doc.line(4, y, 76, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('ÖDENEN NET', 5, y);
  doc.text(tl(purchase.netPayment, decimals), 75, y, { align: 'right' });
  y += 8;

  if (purchase.note) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Not: ${purchase.note}`, 5, y, { maxWidth: 70 });
    y += 6;
  }

  y += 10;
  doc.setFontSize(7.5);
  doc.text('Satıcı İmza', 5, y);
  doc.text('Alıcı İmza', 75, y, { align: 'right' });
  doc.line(5, y + 4, 30, y + 4);
  doc.line(50, y + 4, 75, y + 4);

  doc.save(`makbuz-${purchase.makbuzNo}.pdf`);
}
