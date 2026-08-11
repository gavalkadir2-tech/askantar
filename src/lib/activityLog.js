import { currentUser } from '../currentUser.js';
import { storageSet, uid } from './format.js';

// İşlem geçmişi / audit log: kim, ne zaman, neyi yaptığını kaydeder.
// Kayıt sayısı sınırsız büyümesin diye son 1000 kayıt tutulur.
const MAX_LOG_ENTRIES = 1000;

export const LOG_ACTIONS = {
  PRICE_CHANGED: 'Fiyat listesi değiştirdi',
  PURCHASE_DELETED: 'Alım fişini sildi',
  PURCHASE_EDITED: 'Alım fişini düzenledi',
  PAYMENT_ADDED: 'Ödeme/avans ekledi',
  PAYMENT_DELETED: 'Ödeme/avans sildi',
  SALE_ADDED: 'Depodan satış yaptı (stok çıkışı)',
  BUYER_COLLECTION_ADDED: 'Alıcıdan tahsilat aldı',
  CRATE_MOVEMENT_ADDED: 'Kasa/çuval hareketi ekledi',
};

// entries: mevcut log dizisi, setEntries: state setter, action: LOG_ACTIONS değeri,
// details: kısa, insan-okur açıklama metni (örn. "#124 numaralı fiş — Ahmet Yılmaz")
export async function logActivity(entries, setEntries, action, details) {
  const record = {
    id: uid(),
    ts: Date.now(),
    user: currentUser.email || 'bilinmiyor',
    role: currentUser.role || 'user',
    action,
    details: details || '',
  };
  const next = [record, ...(entries || [])].slice(0, MAX_LOG_ENTRIES);
  setEntries(next);
  await storageSet('zk:activityLog', next);
  return next;
}
