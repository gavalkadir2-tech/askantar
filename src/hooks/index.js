import { useState, useEffect, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import { storageSet, todayStr, uid } from '../lib/format';

export function usePagedList(items, defaultPageSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => { if (page !== clampedPage) setPage(clampedPage); }, [clampedPage]);
  const setPageSize = (n) => { setPageSizeRaw(n); setPage(1); };
  const paged = items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
  return { page: clampedPage, setPage, pageSize, setPageSize, totalPages, paged, totalCount: items.length };
}

// Sutun basligina tiklayarak siralama. sortKey: hangi alana gore siralandigini,
// sortDir: 'asc' | 'desc' tutar. Ayni basliga tekrar tiklamak yonu tersine cevirir.

export function useSortableColumns(defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sortRows = (rows, getValue) => {
    if (!sortKey) return rows;
    const sorted = [...rows].sort((a, b) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'tr');
      }
      return va - vb;
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  };
  return { sortKey, sortDir, toggleSort, sortRows };
}

// Alici (cari/musteri) tarafinin bakiye + tahsilat mantigini tek yerde toplar.
// WarehouseTab, CariTab ve BuyerLedgerTab ayni kaynagi kullanir; boylece
// bakiye hesabi (satis - tahsilat) iki farkli yerde birbirinden bagimsiz
// yasayip zamanla tutarsizlasmaz.
export function useBuyerLedger(buyers, sales, buyerPayments, setBuyerPayments) {
  const buyerBalances = useMemo(() => {
    const map = {};
    buyers.forEach((b) => { map[b.id] = 0; });
    sales.forEach((s) => { map[s.buyerId] = (map[s.buyerId] || 0) + s.amount; });
    (buyerPayments || []).forEach((p) => { map[p.buyerId] = (map[p.buyerId] || 0) - p.amount; });
    return map;
  }, [buyers, sales, buyerPayments]);

  const getBuyerEntries = (buyerId) => {
    const s = sales.filter((x) => x.buyerId === buyerId).map((x) => ({ type: 'sale', date: x.date, createdAt: x.createdAt, amount: x.amount, data: x }));
    const c = (buyerPayments || []).filter((x) => x.buyerId === buyerId).map((x) => ({ type: 'collection', date: x.date, createdAt: x.createdAt, amount: -x.amount, data: x }));
    return [...s, ...c].sort((a, b) => a.createdAt - b.createdAt);
  };

  const addCollection = async (buyerId, amount, note) => {
    const amt = parseFloat(amount);
    if (!buyerId || !amt || amt <= 0) return null;
    const record = { id: uid(), buyerId, date: todayStr(), amount: amt, note: note || '', createdAt: Date.now() };
    const next = [...(buyerPayments || []), record];
    try {
      setBuyerPayments(next);
      await storageSet('zk:buyerPayments', next);
      return record;
    } catch (err) {
      Sentry.captureException(err, { tags: { operation: 'addCollection' } });
      window.alert('Tahsilat kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
      return null;
    }
  };

  const removeCollection = async (collectionId) => {
    const next = (buyerPayments || []).filter((p) => p.id !== collectionId);
    try {
      setBuyerPayments(next);
      await storageSet('zk:buyerPayments', next);
    } catch (err) {
      Sentry.captureException(err, { tags: { operation: 'removeCollection' } });
      window.alert('Silme işlemi kaydedilemedi. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    }
  };

  const getBuyerAging = (buyerId) => {
    const debits = sales.filter((x) => x.buyerId === buyerId).map((x) => ({ amount: x.amount, date: x.date, vadeTarihi: x.vadeTarihi, createdAt: x.createdAt }));
    const credits = (buyerPayments || []).filter((x) => x.buyerId === buyerId).map((x) => ({ amount: x.amount, createdAt: x.createdAt }));
    return computeAging(debits, credits);
  };

  return { buyerBalances, getBuyerEntries, addCollection, removeCollection, getBuyerAging };
}

// Bir tarafin (tedarikci ya da alici) acik islemlerini FIFO mantigiyla
// tahsilat/odemelerle eslestirir: en eski borc once kapanir. Hala kismen ya
// da tamamen odenmemis en eski islemin vade tarihi baz alinarak kac gun
// gecikildigi hesaplanir. debits: [{amount, date, vadeTarihi, createdAt}],
// credits: [{amount, createdAt}].
export function computeAging(debits, credits) {
  const sortedDebits = [...debits]
    .filter((d) => d.amount > 0.001)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((d) => ({ ...d, remaining: d.amount }));
  const sortedCredits = [...(credits || [])].sort((a, b) => a.createdAt - b.createdAt);

  let ci = 0;
  let creditRemaining = sortedCredits[0]?.amount || 0;
  for (const debit of sortedDebits) {
    while (debit.remaining > 0.001 && ci < sortedCredits.length) {
      if (creditRemaining <= 0.001) { ci += 1; creditRemaining = sortedCredits[ci]?.amount || 0; continue; }
      const applied = Math.min(debit.remaining, creditRemaining);
      debit.remaining -= applied;
      creditRemaining -= applied;
    }
  }

  const oldestUnpaid = sortedDebits.find((d) => d.remaining > 0.001);
  if (!oldestUnpaid) return { daysOverdue: null, oldestUnpaidDate: null, isOverdue: false };

  const vadeStr = oldestUnpaid.vadeTarihi || oldestUnpaid.date;
  const vadeDate = new Date(vadeStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  vadeDate.setHours(0, 0, 0, 0);
  const daysOverdue = Math.round((today - vadeDate) / 86400000);
  return { daysOverdue, oldestUnpaidDate: vadeStr, isOverdue: daysOverdue > 0 };
}
    
