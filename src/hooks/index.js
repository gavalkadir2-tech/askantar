import { useState, useEffect } from 'react';

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
