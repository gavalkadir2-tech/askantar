import React, { useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { ListFooterControls } from '../common/index';
import { usePagedList } from '../../hooks/index';
import { COLORS } from '../../lib/theme';

function fmtLogDate(ts) {
  return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ActivityLogTab({ activityLog }) {
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const actions = useMemo(() => Array.from(new Set((activityLog || []).map((e) => e.action))).sort(), [activityLog]);

  const filtered = useMemo(() => {
    return (activityLog || []).filter((e) => {
      if (actionFilter && e.action !== actionFilter) return false;
      if (query) {
        const haystack = `${e.user} ${e.action} ${e.details}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [activityLog, query, actionFilter]);

  const { page, setPage, pageSize, setPageSize, totalPages, paged, totalCount } = usePagedList(filtered);

  return (
    <div>
      <div className="zk-h1">İşlem Geçmişi</div>
      <div className="zk-h1-sub">Kim, ne zaman, neyi değiştirdi — son {activityLog?.length || 0} kayıt</div>

      <div className="zk-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ position: 'relative', flex: '2 1 200px' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 14, color: COLORS.inkSoft }} />
            <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="Kullanıcı, işlem, açıklama ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="zk-select" style={{ flex: '1 1 180px' }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">Tüm işlem türleri</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="zk-card">
        {filtered.length === 0 ? (
          <div className="zk-empty"><History size={26} className="zk-empty-icon" /><br/>{(activityLog?.length || 0) === 0 ? 'Henüz kayıtlı işlem yok.' : 'Sonuç bulunamadı.'}</div>
        ) : (
          <>
            <table className="zk-table">
              <thead><tr><th>Tarih/Saat</th><th>Kullanıcı</th><th>İşlem</th><th>Açıklama</th></tr></thead>
              <tbody>
                {paged.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap', color: COLORS.inkSoft, fontSize: 11.5 }}>{fmtLogDate(e.ts)}</td>
                    <td style={{ fontSize: 12 }}>{e.user}</td>
                    <td><span className="zk-badge zk-badge-blue">{e.action}</span></td>
                    <td style={{ fontSize: 12 }}>{e.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListFooterControls page={page} setPage={setPage} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} totalCount={totalCount} />
          </>
        )}
      </div>
    </div>
  );
}
