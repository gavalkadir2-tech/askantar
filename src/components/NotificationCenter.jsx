import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock as ClockIcon,
  Wrench,
  FileText,
  ShieldAlert,
  AlertTriangle,
  Bell,
  Repeat,
  BellRing,
} from 'lucide-react';
import { Modal } from './common/index';
import { daysUntil, fmtDate, fmtTL, localDateStr, mean, storageGet, storageSet, todayStr, uid } from '../lib/format';
import { COLORS } from '../lib/theme';

export function NotificationCenter({ farmers, purchases, payments, documents, insurance, fines, maintenance, fuel, vehicles, reminders, setReminders, settings }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [linkedFarmerId, setLinkedFarmerId] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [dismissed, setDismissed] = useState({});
  const [notifPermission, setNotifPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  const docWarningDays = settings.docWarningDays ?? 30;
  const cariRiskDays = settings.cariRiskDays ?? 45;
  const maintenanceWarningKm = settings.maintenanceWarningKm ?? 500;

  useEffect(() => {
    (async () => {
      const d = await storageGet('zk:dismissedAlerts');
      setDismissed(d || {});
    })();
  }, []);

  const allAlerts = useMemo(() => {
    const list = [];

    documents.forEach((d) => {
      const days = daysUntil(d.expiryDate);
      if (days !== null && days <= docWarningDays) {
        const v = vehicles.find((x) => x.id === d.vehicleId);
        list.push({
          key: `doc-${d.id}`, severity: days < 0 ? 'kritik' : 'uyari', icon: FileText,
          title: `${d.docType} süresi ${days < 0 ? 'doldu' : 'yaklaşıyor'}`,
          detail: `${v ? v.plaka : 'Araç'} · ${days < 0 ? Math.abs(days) + ' gün önce doldu' : days + ' gün kaldı'}`,
        });
      }
    });

    insurance.forEach((i) => {
      const days = daysUntil(i.endDate);
      if (days !== null && days <= docWarningDays) {
        const v = vehicles.find((x) => x.id === i.vehicleId);
        list.push({
          key: `ins-${i.id}`, severity: days < 0 ? 'kritik' : 'uyari', icon: ShieldAlert,
          title: `${i.policyType} poliçesi ${days < 0 ? 'doldu' : 'yaklaşıyor'}`,
          detail: `${v ? v.plaka : 'Araç'} · ${i.company}`,
        });
      }
    });

    fines.filter((f) => !f.paid).forEach((f) => {
      const v = vehicles.find((x) => x.id === f.vehicleId);
      list.push({ key: `fine-${f.id}`, severity: 'uyari', icon: AlertTriangle, title: 'Ödenmemiş ceza', detail: `${v ? v.plaka : 'Araç'} · ${fmtTL(f.amount)}` });
    });

    farmers.forEach((f) => {
      const fp = purchases.filter((p) => p.farmerId === f.id);
      const fpay = payments.filter((p) => p.farmerId === f.id);
      const balance = fp.reduce((s, p) => s + p.netPayment, 0) - fpay.reduce((s, p) => s + p.amount, 0);
      const last = [...fp, ...fpay].sort((a, b) => b.createdAt - a.createdAt)[0];
      const daysSince = last ? Math.round((Date.now() - last.createdAt) / (1000 * 60 * 60 * 24)) : null;
      if (balance > 0 && daysSince !== null && daysSince > cariRiskDays) {
        list.push({ key: `risk-${f.id}`, severity: 'kritik', icon: ShieldAlert, title: 'Yüksek cari risk', detail: `${f.name} · ${fmtTL(balance)} · ${daysSince} gündür hareket yok` });
      }
    });

    vehicles.forEach((v) => {
      const records = maintenance.filter((m) => m.vehicleId === v.id && m.km > 0).sort((a, b) => a.km - b.km);
      const fuelRecords = fuel.filter((r) => r.vehicleId === v.id && r.km > 0).sort((a, b) => b.km - a.km);
      const currentKm = fuelRecords[0]?.km || records[records.length - 1]?.km || 0;
      if (records.length >= 2) {
        const intervals = [];
        for (let i = 1; i < records.length; i++) intervals.push(records[i].km - records[i - 1].km);
        const avg = mean(intervals);
        const lastKm = records[records.length - 1].km;
        const remaining = avg - (currentKm - lastKm);
        if (remaining < maintenanceWarningKm) {
          list.push({ key: `maint-${v.id}`, severity: remaining < 0 ? 'kritik' : 'uyari', icon: Wrench, title: 'Bakım zamanı yaklaştı', detail: `${v.plaka} · tahmini ${Math.round(remaining)} km kaldı` });
        }
      }
    });

    return list.sort((a, b) => (a.severity === 'kritik' ? 0 : 1) - (b.severity === 'kritik' ? 0 : 1));
  }, [farmers, purchases, payments, documents, insurance, fines, maintenance, fuel, vehicles, docWarningDays, cariRiskDays, maintenanceWarningKm]);

  const now = Date.now();
  const alerts = allAlerts.filter((a) => !dismissed[a.key] || dismissed[a.key] < now);
  const activeReminders = reminders.filter((r) => !r.done).sort((a, b) => a.date.localeCompare(b.date));
  const totalCount = alerts.length + activeReminders.length;

  // Kritik uyarılar için masaüstü bildirimi (izin verilmişse) — her uyarı için sadece bir kez
  useEffect(() => {
    if (notifPermission !== 'granted') return;
    const critical = alerts.filter((a) => a.severity === 'kritik');
    let seen = [];
    try { seen = JSON.parse(window.localStorage.getItem('zk_notified_keys') || '[]'); } catch (e) {}
    const fresh = critical.filter((a) => !seen.includes(a.key));
    if (fresh.length > 0) {
      fresh.forEach((a) => {
        try { new Notification(a.title, { body: a.detail, tag: a.key }); } catch (e) {}
      });
      try { window.localStorage.setItem('zk_notified_keys', JSON.stringify([...seen, ...fresh.map((a) => a.key)].slice(-300))); } catch (e) {}
    }
  }, [alerts, notifPermission]);

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  };

  const dismissAlert = async (key, days) => {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    const next = { ...dismissed, [key]: until };
    setDismissed(next);
    await storageSet('zk:dismissedAlerts', next);
  };

  const filteredAlerts = filter === 'all' ? alerts : filter === 'reminders' ? [] : alerts.filter((a) => a.severity === filter);
  const showReminders = filter === 'all' || filter === 'reminders';

  const resetForm = () => { setTitle(''); setNote(''); setLinkedFarmerId(''); setRecurrence('none'); setDate(todayStr()); };

  const addReminder = async () => {
    if (!title.trim()) return;
    const r = { id: uid(), title: title.trim(), date, note: note.trim(), done: false, farmerId: linkedFarmerId || null, recurrence, createdAt: Date.now() };
    const next = [...reminders, r];
    setReminders(next);
    await storageSet('zk:reminders', next);
    resetForm();
  };

  const advanceDate = (dateStr, recur) => {
    const d = new Date(dateStr);
    if (recur === 'weekly') d.setDate(d.getDate() + 7);
    else if (recur === 'monthly') d.setMonth(d.getMonth() + 1);
    return localDateStr(d);
  };

  const toggleDone = async (id) => {
    const target = reminders.find((r) => r.id === id);
    let next = reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r));
    if (target && !target.done && target.recurrence && target.recurrence !== 'none') {
      next = [...next, { ...target, id: uid(), date: advanceDate(target.date, target.recurrence), done: false, createdAt: Date.now() }];
    }
    setReminders(next);
    await storageSet('zk:reminders', next);
  };

  const removeReminder = async (id) => {
    if (!window.confirm('Bu hatırlatmayı silmek istediğinize emin misiniz?')) return;
    const next = reminders.filter((r) => r.id !== id);
    setReminders(next);
    await storageSet('zk:reminders', next);
  };

  const dueLabel = (dateStr) => {
    const d = daysUntil(dateStr);
    if (d === null) return '';
    if (d < 0) return `${Math.abs(d)} gün gecikti`;
    if (d === 0) return 'Bugün';
    if (d === 1) return 'Yarın';
    return `${d} gün kaldı`;
  };

  return (
    <>
      <button className="zk-navbtn" onClick={() => setOpen(true)} style={{ position: 'relative' }}>
        <Bell size={16} /> Bildirimler
        {totalCount > 0 && (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: COLORS.red, color: '#fff', fontSize: 10, fontWeight: 700,
            borderRadius: 20, padding: '1px 6px', minWidth: 16, textAlign: 'center',
          }}>
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <Modal title="Bildirim ve Hatırlatma Merkezi" onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {[
              { key: 'all', label: 'Tümü' },
              { key: 'kritik', label: 'Kritik' },
              { key: 'uyari', label: 'Uyarı' },
              { key: 'reminders', label: 'Hatırlatmalar' },
            ].map((f) => (
              <button key={f.key} className={`zk-btn ${filter === f.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`} style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>

          {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
            <button className="zk-btn zk-btn-secondary" style={{ width: '100%', justifyContent: 'center', marginBottom: 12, fontSize: 11.5 }} onClick={requestNotifPermission}>
              <BellRing size={13} /> Masaüstü bildirimlerini aç (kritik uyarılar için)
            </button>
          )}

          <div style={{ maxHeight: '50vh', overflowY: 'auto', marginBottom: 16 }}>
            {filteredAlerts.length === 0 && (!showReminders || activeReminders.length === 0) ? (
              <div className="zk-empty">Bu filtrede bildirim yok.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredAlerts.map((a) => (
                  <div key={a.key} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px',
                    borderRadius: 8, background: a.severity === 'kritik' ? COLORS.redSoft : COLORS.goldSoft,
                  }}>
                    <a.icon size={15} color={a.severity === 'kritik' ? COLORS.red : COLORS.gold} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink }}>{a.title}</div>
                      <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{a.detail}</div>
                    </div>
                    <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 7px', fontSize: 10.5 }} onClick={() => dismissAlert(a.key, 3)} title="3 gün ertele">
                      <BellOff size={11} />
                    </button>
                  </div>
                ))}
                {showReminders && activeReminders.map((r) => {
                  const f = r.farmerId ? farmers.find((x) => x.id === r.farmerId) : null;
                  const overdue = daysUntil(r.date) < 0;
                  return (
                    <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 8, background: overdue ? COLORS.redSoft : COLORS.oliveSoft }}>
                      {r.recurrence && r.recurrence !== 'none' ? <Repeat size={15} color={COLORS.olive} style={{ marginTop: 1, flexShrink: 0 }} /> : <ClockIcon size={15} color={overdue ? COLORS.red : COLORS.olive} style={{ marginTop: 1, flexShrink: 0 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink }}>{r.title}</div>
                        <div style={{ fontSize: 11.5, color: COLORS.inkSoft }}>
                          {fmtDate(r.date)} · {dueLabel(r.date)}{f ? ` · ${f.name}` : ''}{r.note ? ` · ${r.note}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 7px' }} onClick={() => toggleDone(r.id)} title="Tamamlandı işaretle">✓</button>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '3px 7px' }} onClick={() => removeReminder(r.id)}><X size={11} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
            <div className="zk-label" style={{ marginBottom: 8 }}>Yeni hatırlatma ekle</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <input className="zk-input" placeholder="Başlık (örn. Ahmet'i ara)" style={{ flex: '2 1 160px' }} value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              <select className="zk-select" style={{ flex: '1 1 150px' }} value={linkedFarmerId} onChange={(e) => setLinkedFarmerId(e.target.value)}>
                <option value="">Çiftçiyle ilişkilendir (opsiyonel)</option>
                {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select className="zk-select" style={{ flex: '1 1 120px' }} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                <option value="none">Tekrar yok</option>
                <option value="weekly">Haftalık tekrar</option>
                <option value="monthly">Aylık tekrar</option>
              </select>
            </div>
            <input className="zk-input" placeholder="Not (opsiyonel)" style={{ marginBottom: 10 }} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="zk-btn zk-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={addReminder}>Ekle</button>
          </div>
        </Modal>
      )}
    </>
  );
}
