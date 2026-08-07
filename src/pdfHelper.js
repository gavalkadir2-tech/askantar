import jsPDF from 'jspdf';

// jsPDF'in yerleşik "helvetica" fontu Türkçe karakterleri (İ, ı, ğ, ş, ç, ö, ü)
// doğru göstermiyor (örn. "MÜSTAHSİL" -> "MÜSTAHS0L" gibi bozuluyor). Bunun yerine
// Türkçe karakterleri tam destekleyen Roboto fontunu PDF içine gömüyoruz.
// Font dosyaları büyük olduğu için (~1.3MB), uygulamanın ilk açılışını yavaşlatmamak
// adına sadece bir makbuz oluşturulurken (bu fonksiyon çağrıldığında) yükleniyor.
async function registerTurkishFont(doc) {
  const [{ RobotoRegularBase64 }, { RobotoBoldBase64 }] = await Promise.all([
    import('./fonts/RobotoRegular.js'),
    import('./fonts/RobotoBold.js'),
  ]);
  doc.addFileToVFS('Roboto-Regular.ttf', RobotoRegularBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', RobotoBoldBase64);
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
}

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

// "Yazdır" butonu: tarayıcının kendi print/HTML motoruna güvenmek yerine (font
// ikamesi ve sayfa genişliği sorunlarına yol açıyordu), aynı Roboto gömülü PDF'i
// yeni bir sekmede açıp otomatik yazdırma diyaloğunu tetikliyoruz. Böylece
// "Yazdır" ve "PDF indir" her zaman birebir aynı, doğru görünen çıktıyı üretir.
function printDoc(doc) {
  try {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } catch (e) {
    doc.save('makbuz.pdf');
  }
}

async function buildPurchaseReceiptDoc(purchase, farmer, settings) {
  const decimals = (settings && settings.decimalPlaces) ?? 2;
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  await registerTurkishFont(doc);
  const cx = 40;
  let y = 8;

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(11);
  doc.text((settings && settings.businessName) || 'Zeytin Komisyonculuğu', cx, y, { align: 'center' });
  y += 5;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(7.5);
  if (settings && settings.address) { doc.text(settings.address, cx, y, { align: 'center' }); y += 3.5; }
  if (settings && settings.phone) { doc.text(`Tel: ${settings.phone}`, cx, y, { align: 'center' }); y += 3.5; }
  if (settings && settings.taxNo) { doc.text(`VKN: ${settings.taxNo}${settings.taxOffice ? ' · ' + settings.taxOffice : ''}`, cx, y, { align: 'center' }); y += 3.5; }

  y += 2;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 4;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9.5);
  doc.text(`MÜSTAHSİL MAKBUZU No: ${purchase.makbuzNo}`, cx, y, { align: 'center' });
  y += 5;
  doc.line(4, y, 76, y);
  y += 5;

  doc.setFont('Roboto', 'normal');
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
  doc.setFont('Roboto', 'bold');
  line('Ürün: Zeytin');
  doc.setFont('Roboto', 'normal');
  (purchase.items || []).forEach((it) => {
    doc.setFontSize(7.5);
    line(`${it.grade}`);
    doc.text(`${fmtKgTr(it.kg)} x ${tl(it.pricePerKg, decimals)}`, 5, y);
    doc.text(tl(it.amount, decimals), 75, y, { align: 'right' });
    y += 4;
    doc.setFontSize(8);
  });

  const gradeGroups = {};
  (purchase.items || []).forEach((it) => {
    if (!gradeGroups[it.grade]) gradeGroups[it.grade] = { kg: 0, amount: 0 };
    gradeGroups[it.grade].kg += it.kg;
    gradeGroups[it.grade].amount += it.amount;
  });
  const gradeNames = Object.keys(gradeGroups);
  if ((purchase.items || []).length > 1) {
    y += 1;
    doc.line(4, y, 76, y);
    y += 4;
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(8);
    line('Sınıf bazında toplam');
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(7.5);
    gradeNames.forEach((g) => {
      doc.text(g, 5, y);
      doc.text(`${fmtKgTr(gradeGroups[g].kg)}  ${tl(gradeGroups[g].amount, decimals)}`, 75, y, { align: 'right' });
      y += 4;
    });
    doc.setFontSize(8);
  }

  doc.setFont('Roboto', 'bold');
  doc.text('Toplam', 5, y);
  doc.text(`${fmtKgTr(purchase.netKg)}  ${tl(purchase.amount, decimals)}`, 75, y, { align: 'right' });
  y += 5;
  doc.setFont('Roboto', 'normal');
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
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9.5);
  doc.text('ÖDENEN NET', 5, y);
  doc.text(tl(purchase.netPayment, decimals), 75, y, { align: 'right' });
  y += 8;

  if (purchase.note) {
    doc.setFont('Roboto', 'normal');
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

  return doc;
}

export async function downloadReceiptPdf(purchase, farmer, settings) {
  const doc = await buildPurchaseReceiptDoc(purchase, farmer, settings);
  doc.save(`makbuz-${purchase.makbuzNo}.pdf`);
}

export async function printReceiptPdf(purchase, farmer, settings) {
  const doc = await buildPurchaseReceiptDoc(purchase, farmer, settings);
  printDoc(doc);
}

async function buildSaleReceiptDoc(sale, buyer, settings) {
  const decimals = (settings && settings.decimalPlaces) ?? 2;
  const doc = new jsPDF({ unit: 'mm', format: [80, 150] });
  await registerTurkishFont(doc);
  const cx = 40;
  let y = 8;

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(11);
  doc.text((settings && settings.businessName) || 'Zeytin Komisyonculuğu', cx, y, { align: 'center' });
  y += 5;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(7.5);
  if (settings && settings.address) { doc.text(settings.address, cx, y, { align: 'center' }); y += 3.5; }
  if (settings && settings.phone) { doc.text(`Tel: ${settings.phone}`, cx, y, { align: 'center' }); y += 3.5; }
  if (settings && settings.taxNo) { doc.text(`VKN: ${settings.taxNo}${settings.taxOffice ? ' · ' + settings.taxOffice : ''}`, cx, y, { align: 'center' }); y += 3.5; }

  y += 2;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 4;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9.5);
  doc.text(`SATIŞ MAKBUZU No: ${sale.makbuzNo}`, cx, y, { align: 'center' });
  y += 5;
  doc.line(4, y, 76, y);
  y += 5;

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8);
  const line = (text) => { doc.text(text, 5, y); y += 4; };
  line(`Tarih: ${fmtDateTr(sale.date)}`);
  line(`Alıcı: ${buyer ? buyer.name : '—'}`);
  if (sale.vehiclePlaka) line(`Araç: ${sale.vehiclePlaka}`);

  y += 1;
  doc.line(4, y, 76, y);
  y += 4;
  doc.setFontSize(7.5);
  line(`${sale.grade}`);
  doc.text(`${fmtKgTr(sale.kg)} x ${tl(sale.pricePerKg, decimals)}`, 5, y);
  doc.text(tl(sale.amount, decimals), 75, y, { align: 'right' });
  y += 5;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9.5);
  doc.line(4, y, 76, y);
  y += 5;
  doc.text('TOPLAM', 5, y);
  doc.text(tl(sale.amount, decimals), 75, y, { align: 'right' });
  y += 8;

  if (sale.note) {
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Not: ${sale.note}`, 5, y, { maxWidth: 70 });
    y += 6;
  }

  y += 10;
  doc.setFontSize(7.5);
  doc.text('Satan İmza', 5, y);
  doc.text('Alan İmza', 75, y, { align: 'right' });
  doc.line(5, y + 4, 30, y + 4);
  doc.line(50, y + 4, 75, y + 4);

  return doc;
}

export async function downloadSaleReceiptPdf(sale, buyer, settings) {
  const doc = await buildSaleReceiptDoc(sale, buyer, settings);
  doc.save(`satis-${sale.makbuzNo}.pdf`);
}

export async function printSaleReceiptPdf(sale, buyer, settings) {
  const doc = await buildSaleReceiptDoc(sale, buyer, settings);
  printDoc(doc);
}

async function buildPaymentReceiptDoc(row, settings) {
  const decimals = (settings && settings.decimalPlaces) ?? 2;
  const doc = new jsPDF({ unit: 'mm', format: [80, 100] });
  await registerTurkishFont(doc);
  const cx = 40;
  let y = 8;

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(11);
  doc.text((settings && settings.businessName) || 'Zeytin Komisyonculuğu', cx, y, { align: 'center' });
  y += 6;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 4;
  doc.setFontSize(9.5);
  const title = row.kind === 'odeme' ? (row.payType === 'avans' ? 'AVANS MAKBUZU' : 'ÖDEME MAKBUZU') : 'TAHSİLAT MAKBUZU';
  doc.text(title, cx, y, { align: 'center' });
  y += 5;
  doc.line(4, y, 76, y);
  y += 5;

  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8);
  const line = (text) => { doc.text(text, 5, y); y += 4; };
  line(`Tarih: ${fmtDateTr(row.date)}`);
  line(`${row.kind === 'odeme' ? 'Çiftçi' : 'Alıcı'}: ${row.partyName}`);

  y += 1;
  doc.line(4, y, 76, y);
  y += 5;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(9.5);
  doc.text('TUTAR', 5, y);
  doc.text(tl(row.amount, decimals), 75, y, { align: 'right' });
  y += 8;

  if (row.note) {
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Not: ${row.note}`, 5, y, { maxWidth: 70 });
    y += 6;
  }

  y += 10;
  doc.setFontSize(7.5);
  doc.text('Veren İmza', 5, y);
  doc.text('Alan İmza', 75, y, { align: 'right' });
  doc.line(5, y + 4, 30, y + 4);
  doc.line(50, y + 4, 75, y + 4);

  return doc;
}

export async function downloadPaymentReceiptPdf(row, settings) {
  const doc = await buildPaymentReceiptDoc(row, settings);
  doc.save(`odeme-${row.date}.pdf`);
}

export async function printPaymentReceiptPdf(row, settings) {
  const doc = await buildPaymentReceiptDoc(row, settings);
  printDoc(doc);
}
