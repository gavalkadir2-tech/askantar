import QRCode from 'qrcode';

export async function getQrDataUrl(text) {
  try {
    return await QRCode.toDataURL(text, { width: 130, margin: 1, color: { dark: '#2B2A25', light: '#FFFFFF' } });
  } catch (e) {
    console.error('QR kod olusturulamadi:', e);
    return null;
  }
}
