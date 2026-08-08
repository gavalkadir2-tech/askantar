import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Package,
  ShoppingCart,
  Truck,
  Contact as IdCard,
  Wrench,
  Fuel,
  FileText,
  ShieldAlert,
  AlertTriangle,
  Disc,
  TrendingUp,
  UserCheck,
  Trash2,
  Pencil,
  Package2,
  CheckCircle2,
} from 'lucide-react';
import { ListFooterControls, SortableTh, StatCard } from '../common/index';
import { CostAnalysisSection, DocumentsSection, FinesSection, FuelSection, InsuranceDamageSection, MaintenanceSection, TiresSection } from '../fleet/FleetSections';
import { AddPersonnelModal, AddVehicleModal } from '../modals/index';
import { CrateInventoryTab } from './CrateInventoryTab';
import { usePagedList, useSortableColumns } from '../../hooks/index';
import { fmtDate, fmtKg, fmtTL, storageSet, todayStr, uid } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export function FleetTab({ vehicles, setVehicles, personnel, setPersonnel, purchases, sales, farmers, buyers, maintenance, setMaintenance, fuel, setFuel, documents, setDocuments, insurance, setInsurance, damages, setDamages, fines, setFines, tires, setTires, settings, crateMovements, setCrateMovements, personnelAttendance, setPersonnelAttendance, personnelPayments, setPersonnelPayments, lockedView }) {
  const [view, setView] = useState(lockedView || 'vehicles');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [vehicleSubTab, setVehicleSubTab] = useState('overview');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState('');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddPersonnel, setShowAddPersonnel] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editingPersonnel, setEditingPersonnel] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [earnDate, setEarnDate] = useState(todayStr());
  const [earnAmount, setEarnAmount] = useState('');
  const [earnNote, setEarnNote] = useState('');
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [personnelQuery, setPersonnelQuery] = useState('');
  const [personnelPayTypeFilter, setPersonnelPayTypeFilter] = useState('');
  const { sortKey: vehSortKey, sortDir: vehSortDir, toggleSort: vehToggleSort, sortRows: vehSortRows } = useSortableColumns('plaka', 'asc');
  const { sortKey: persSortKey, sortDir: persSortDir, toggleSort: persToggleSort, sortRows: persSortRows } = useSortableColumns('name', 'asc');

  const addVehicle = async (data) => {
    if (!data.plaka || !data.plaka.trim()) return;
    const newVehicle = { id: uid(), plaka: data.plaka.trim(), marka: data.marka || '', kapasite: data.kapasite || 0, defaultPersonnelId: data.defaultPersonnelId || '', createdAt: Date.now() };
    const next = [...vehicles, newVehicle];
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    setShowAddVehicle(false);
  };

  const saveVehicleEdit = async (data) => {
    const next = vehicles.map((v) => (v.id === editingVehicle.id ? { ...v, ...data, plaka: data.plaka.trim() } : v));
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    setEditingVehicle(null);
  };

  const removeVehicle = async (v) => {
    const hasHistory = purchases.some((p) => p.vehicleId === v.id) || sales.some((s) => s.vehicleId === v.id);
    const msg = hasHistory
      ? `${v.plaka} plakalı aracın alım/satış geçmişi var. Aracı silerseniz bu geçmiş kayıtlarda araç bilgisi görünmeye devam eder ama araç kaydı ve bakım/yakıt/evrak/sigorta/ceza/lastik verileri kalıcı olarak silinir. Emin misiniz?`
      : `${v.plaka} plakalı aracı silmek istediğinize emin misiniz?`;
    if (!window.confirm(msg)) return;
    const next = vehicles.filter((x) => x.id !== v.id);
    setVehicles(next);
    await storageSet('zk:vehicles', next);
    const cleanMaint = maintenance.filter((r) => r.vehicleId !== v.id);
    setMaintenance(cleanMaint); await storageSet('zk:vehicleMaintenance', cleanMaint);
    const cleanFuel = fuel.filter((r) => r.vehicleId !== v.id);
    setFuel(cleanFuel); await storageSet('zk:vehicleFuel', cleanFuel);
    const cleanDocs = documents.filter((r) => r.vehicleId !== v.id);
    setDocuments(cleanDocs); await storageSet('zk:vehicleDocuments', cleanDocs);
    const cleanIns = insurance.filter((r) => r.vehicleId !== v.id);
    setInsurance(cleanIns); await storageSet('zk:vehicleInsurance', cleanIns);
    const cleanDmg = damages.filter((r) => r.vehicleId !== v.id);
    setDamages(cleanDmg); await storageSet('zk:vehicleDamage', cleanDmg);
    const cleanFines = fines.filter((r) => r.vehicleId !== v.id);
    setFines(cleanFines); await storageSet('zk:vehicleFines', cleanFines);
    const cleanTires = tires.filter((r) => r.vehicleId !== v.id);
    setTires(cleanTires); await storageSet('zk:vehicleTires', cleanTires);
  };

  const addPersonnel = async (data) => {
    if (!data.name || !data.name.trim()) return;
    const newPerson = { id: uid(), name: data.name.trim(), phone: data.phone || '', role: data.role || '', payType: data.payType || 'yevmiye', dailyWage: data.dailyWage || 0, monthlySalary: data.monthlySalary || 0, createdAt: Date.now() };
    const next = [...personnel, newPerson];
    setPersonnel(next);
    await storageSet('zk:personnel', next);
    setShowAddPersonnel(false);
  };

  const savePersonnelEdit = async (data) => {
    const next = personnel.map((p) => (p.id === editingPersonnel.id ? { ...p, ...data, name: data.name.trim() } : p));
    setPersonnel(next);
    await storageSet('zk:personnel', next);
    setEditingPersonnel(null);
  };

  const removePersonnel = async (p) => {
    const hasHistory = purchases.some((x) => x.personnelId === p.id);
    const msg = hasHistory
      ? `${p.name} adına kayıtlı alım geçmişi var. Yine de silmek istediğinize emin misiniz?`
      : `${p.name} adlı personeli silmek istediğinize emin misiniz?`;
    if (!window.confirm(msg)) return;
    const next = personnel.filter((x) => x.id !== p.id);
    setPersonnel(next);
    await storageSet('zk:personnel', next);
  };

  const addManualEarning = async (personnelId) => {
    const amt = parseFloat(earnAmount);
    if (!amt || amt <= 0) return;
    const rec = { id: uid(), personnelId, date: earnDate, amount: amt, note: earnNote, createdAt: Date.now() };
    const next = [...personnelAttendance, rec];
    setPersonnelAttendance(next);
    await storageSet('zk:personnelAttendance', next);
    setEarnAmount(''); setEarnNote(''); setEarnDate(todayStr());
  };

  const removeAttendance = async (id) => {
    if (!window.confirm('Bu hakediş kaydını silmek istediğinize emin misiniz?')) return;
    const next = personnelAttendance.filter((a) => a.id !== id);
    setPersonnelAttendance(next);
    await storageSet('zk:personnelAttendance', next);
  };

  const addWagePayment = async (personnelId) => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    const rec = { id: uid(), personnelId, date: todayStr(), amount: amt, note: payNote, createdAt: Date.now() };
    const next = [...personnelPayments, rec];
    setPersonnelPayments(next);
    await storageSet('zk:personnelPayments', next);
    setPayAmount(''); setPayNote('');
  };

  const removeWagePayment = async (id) => {
    if (!window.confirm('Bu ödeme kaydını silmek istediğinize emin misiniz?')) return;
    const next = personnelPayments.filter((pay) => pay.id !== id);
    setPersonnelPayments(next);
    await storageSet('zk:personnelPayments', next);
  };

  const vehicleStats = useMemo(() => {
    const map = {};
    vehicles.forEach((v) => { map[v.id] = { pickups: 0, pickupKg: 0, deliveries: 0, deliveryKg: 0 }; });
    purchases.forEach((p) => {
      if (p.vehicleId && map[p.vehicleId]) { map[p.vehicleId].pickups += 1; map[p.vehicleId].pickupKg += p.netKg; }
    });
    sales.forEach((s) => {
      if (s.vehicleId && map[s.vehicleId]) { map[s.vehicleId].deliveries += 1; map[s.vehicleId].deliveryKg += s.kg; }
    });
    return map;
  }, [vehicles, purchases, sales]);

  const sortedVehicles = useMemo(() => {
    const arr = vehicles.filter((v) => {
      if (!vehicleQuery) return true;
      const q = vehicleQuery.toLowerCase();
      return v.plaka.toLowerCase().includes(q) || (v.marka || '').toLowerCase().includes(q);
    });
    return vehSortRows(arr, (v, key) => {
      if (key === 'pickupKg') return vehicleStats[v.id]?.pickupKg || 0;
      if (key === 'deliveryKg') return vehicleStats[v.id]?.deliveryKg || 0;
      return v[key];
    });
  }, [vehicles, vehSortRows, vehicleStats, vehicleQuery]);
  const vehiclesPaged = usePagedList(sortedVehicles);

  const personnelStats = useMemo(() => {
    const map = {};
    personnel.forEach((p) => { map[p.id] = { count: 0, kg: 0, amount: 0 }; });
    purchases.forEach((p) => {
      if (p.personnelId && map[p.personnelId]) { map[p.personnelId].count += 1; map[p.personnelId].kg += p.netKg; map[p.personnelId].amount += p.netPayment; }
    });
    return map;
  }, [personnel, purchases]);

  const wageBalances = useMemo(() => {
    const map = {};
    personnel.forEach((p) => { map[p.id] = { earned: 0, paid: 0 }; });
    personnelAttendance.forEach((a) => { if (map[a.personnelId]) map[a.personnelId].earned += a.amount; });
    personnelPayments.forEach((pay) => { if (map[pay.personnelId]) map[pay.personnelId].paid += pay.amount; });
    return map;
  }, [personnel, personnelAttendance, personnelPayments]);

  const sortedPersonnel = useMemo(() => {
    const arr = personnel.filter((p) => {
      if (personnelPayTypeFilter && (p.payType || 'yevmiye') !== personnelPayTypeFilter) return false;
      if (!personnelQuery) return true;
      const q = personnelQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.role || '').toLowerCase().includes(q) || (p.phone || '').includes(personnelQuery);
    });
    return persSortRows(arr, (p, key) => {
      if (key === 'balance') return (wageBalances[p.id]?.earned || 0) - (wageBalances[p.id]?.paid || 0);
      return p[key];
    });
  }, [personnel, persSortRows, wageBalances, personnelQuery, personnelPayTypeFilter]);
  const personnelPaged = usePagedList(sortedPersonnel);

  const todayAttendanceIds = new Set(personnelAttendance.filter((a) => a.date === todayStr()).map((a) => a.personnelId));

  const toggleTodayAttendance = async (p) => {
    const already = personnelAttendance.find((a) => a.personnelId === p.id && a.date === todayStr());
    if (already) {
      const next = personnelAttendance.filter((a) => a.id !== already.id);
      setPersonnelAttendance(next);
      await storageSet('zk:personnelAttendance', next);
    } else {
      const rec = { id: uid(), personnelId: p.id, date: todayStr(), amount: p.payType === 'maas' ? 0 : (p.dailyWage || 0), note: '', createdAt: Date.now() };
      const next = [...personnelAttendance, rec];
      setPersonnelAttendance(next);
      await storageSet('zk:personnelAttendance', next);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
  const selectedPersonnel = personnel.find((p) => p.id === selectedPersonnelId);

  const vehiclePickups = selectedVehicle ? purchases.filter((p) => p.vehicleId === selectedVehicle.id).sort((a, b) => b.createdAt - a.createdAt) : [];
  const vehicleDeliveries = selectedVehicle ? sales.filter((s) => s.vehicleId === selectedVehicle.id).sort((a, b) => b.createdAt - a.createdAt) : [];
  const personnelPickups = selectedPersonnel ? purchases.filter((p) => p.personnelId === selectedPersonnel.id).sort((a, b) => b.createdAt - a.createdAt) : [];
  const personnelAttendanceLog = selectedPersonnel ? personnelAttendance.filter((a) => a.personnelId === selectedPersonnel.id).sort((a, b) => b.createdAt - a.createdAt) : [];
  const personnelPaymentLog = selectedPersonnel ? personnelPayments.filter((pay) => pay.personnelId === selectedPersonnel.id).sort((a, b) => b.createdAt - a.createdAt) : [];

  const titles = {
    vehicles: ['Araçlar', 'Hangi araç nereden ne kadar topladı, kime teslim etti'],
    personnel: ['Personel', 'Personelin yaptığı alımlar ve performansı'],
    crates: ['Kasa & Çuval', 'Çiftçilere verilen/iade alınan kasa ve çuval takibi'],
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="zk-h1">{titles[view][0]}</div>
          <div className="zk-h1-sub">{titles[view][1]}</div>
        </div>
        {!lockedView && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`zk-btn ${view === 'vehicles' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => { setView('vehicles'); setSelectedPersonnelId(''); }}>
            <Truck size={14} /> Araçlar
          </button>
          <button className={`zk-btn ${view === 'personnel' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => { setView('personnel'); setSelectedVehicleId(''); }}>
            <IdCard size={14} /> Personel
          </button>
          <button className={`zk-btn ${view === 'crates' ? 'zk-btn-primary' : 'zk-btn-secondary'}`} onClick={() => { setView('crates'); setSelectedVehicleId(''); setSelectedPersonnelId(''); }}>
            <Package2 size={14} /> Kasa & Çuval
          </button>
        </div>
        )}
      </div>

      {view === 'crates' && (
        <div style={{ marginTop: 16 }}>
          <CrateInventoryTab farmers={farmers} movements={crateMovements} setMovements={setCrateMovements} />
        </div>
      )}

      {view === 'vehicles' && !selectedVehicle && (
        <div className="zk-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Araç listesi</div>
            <button className="zk-btn zk-btn-gold" onClick={() => setShowAddVehicle(true)}><Plus size={14} /> Araç ekle</button>
          </div>
          {vehicles.length > 0 && (
            <div style={{ position: 'relative', marginBottom: 12, maxWidth: 280 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: COLORS.inkSoft }} />
              <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="Plaka veya marka ara..." value={vehicleQuery} onChange={(e) => setVehicleQuery(e.target.value)} />
            </div>
          )}
          {sortedVehicles.length === 0 ? (
            <div className="zk-empty"><Truck size={26} className="zk-empty-icon" /><br/>{vehicles.length === 0 ? 'Henüz araç eklenmedi.' : 'Aramanızla eşleşen araç bulunamadı.'}</div>
          ) : (
            <>
            <table className="zk-table">
              <thead>
                <tr>
                  <SortableTh label="Plaka" sortKeyName="plaka" sortKey={vehSortKey} sortDir={vehSortDir} onSort={vehToggleSort} />
                  <SortableTh label="Marka" sortKeyName="marka" sortKey={vehSortKey} sortDir={vehSortDir} onSort={vehToggleSort} />
                  <SortableTh label="Kapasite" sortKeyName="kapasite" sortKey={vehSortKey} sortDir={vehSortDir} onSort={vehToggleSort} />
                  <th>Sürücü</th>
                  <SortableTh label="Topladığı" sortKeyName="pickupKg" sortKey={vehSortKey} sortDir={vehSortDir} onSort={vehToggleSort} />
                  <SortableTh label="Teslim ettiği" sortKeyName="deliveryKg" sortKey={vehSortKey} sortDir={vehSortDir} onSort={vehToggleSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vehiclesPaged.paged.map((v) => {
                  const stat = vehicleStats[v.id] || { pickups: 0, pickupKg: 0, deliveries: 0, deliveryKg: 0 };
                  const driver = personnel.find((p) => p.id === v.defaultPersonnelId);
                  return (
                    <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedVehicleId(v.id); setVehicleSubTab('overview'); }}>
                      <td style={{ fontWeight: 700 }}>{v.plaka}</td>
                      <td style={{ color: COLORS.inkSoft }}>{v.marka || '—'}</td>
                      <td style={{ color: COLORS.inkSoft }}>{v.kapasite ? fmtKg(v.kapasite) : '—'}</td>
                      <td style={{ color: COLORS.inkSoft }}>{driver ? driver.name : 'Atanmadı'}</td>
                      <td><span className="zk-badge zk-badge-olive">{fmtKg(stat.pickupKg)}</span></td>
                      <td><span className="zk-badge zk-badge-blue">{fmtKg(stat.deliveryKg)}</span></td>
                      <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setEditingVehicle(v)}><Pencil size={12} /></button>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removeVehicle(v)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ListFooterControls
              page={vehiclesPaged.page} setPage={vehiclesPaged.setPage} pageSize={vehiclesPaged.pageSize} setPageSize={vehiclesPaged.setPageSize} totalPages={vehiclesPaged.totalPages} totalCount={vehiclesPaged.totalCount}
            />
            </>
          )}
        </div>
      )}

      {view === 'vehicles' && selectedVehicle && (
        <div style={{ marginTop: 16 }}>
          <button className="zk-btn zk-btn-secondary" style={{ marginBottom: 14 }} onClick={() => setSelectedVehicleId('')}>← Araç listesine dön</button>
          <div className="zk-h1" style={{ fontSize: 20 }}>{selectedVehicle.plaka}</div>
          <div className="zk-h1-sub">
            {selectedVehicle.marka && `${selectedVehicle.marka} · `}
            {personnel.find((p) => p.id === selectedVehicle.defaultPersonnelId)?.name ? `Varsayılan sürücü: ${personnel.find((p) => p.id === selectedVehicle.defaultPersonnelId).name}` : 'Sürücü atanmadı'}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
            {[
              { key: 'overview', label: 'Genel Bakış', icon: Truck },
              { key: 'maintenance', label: 'Bakım Takibi', icon: Wrench },
              { key: 'fuel', label: 'Yakıt Yönetimi', icon: Fuel },
              { key: 'documents', label: 'Evrak Takibi', icon: FileText },
              { key: 'insurance', label: 'Hasar & Sigorta', icon: ShieldAlert },
              { key: 'fines', label: 'Trafik Cezaları', icon: AlertTriangle },
              { key: 'tires', label: 'Lastik Takibi', icon: Disc },
              { key: 'cost', label: 'Maliyet Analizi', icon: TrendingUp },
            ].map((t) => (
              <button
                key={t.key}
                className={`zk-btn ${vehicleSubTab === t.key ? 'zk-btn-primary' : 'zk-btn-secondary'}`}
                style={{ fontSize: 12 }}
                onClick={() => setVehicleSubTab(t.key)}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>

          {vehicleSubTab === 'overview' && (
            <div>
              <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
                <StatCard label="Toplama sayısı" value={vehiclePickups.length} icon={Package} />
                <StatCard label="Toplam toplanan" value={fmtKg(vehicleStats[selectedVehicle.id]?.pickupKg || 0)} tone={COLORS.olive} />
                <StatCard label="Teslimat sayısı" value={vehicleDeliveries.length} icon={ShoppingCart} />
                <StatCard label="Toplam teslim edilen" value={fmtKg(vehicleStats[selectedVehicle.id]?.deliveryKg || 0)} tone={COLORS.blue} />
              </div>

              <div className="zk-card" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Toplama geçmişi — nereden ne kadar aldı</div>
                {vehiclePickups.length === 0 ? (
                  <div className="zk-empty">Bu araca bağlı toplama kaydı yok.</div>
                ) : (
                  <table className="zk-table">
                    <thead><tr><th>Tarih</th><th>Çiftçi</th><th>Personel</th><th>Sınıflar</th><th>Net kg</th></tr></thead>
                    <tbody>
                      {vehiclePickups.map((p) => {
                        const f = farmers.find((x) => x.id === p.farmerId);
                        return (
                          <tr key={p.id}>
                            <td>{fmtDate(p.date)}{p.time ? ` · ${p.time}` : ''}</td>
                            <td>{f ? f.name : '—'}</td>
                            <td style={{ color: COLORS.inkSoft }}>{p.personnelName || '—'}</td>
                            <td style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{(p.items || []).map((it) => it.grade).join(', ')}</td>
                            <td style={{ fontWeight: 600 }}>{fmtKg(p.netKg)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="zk-card">
                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Teslimat geçmişi — kime götürdü</div>
                {vehicleDeliveries.length === 0 ? (
                  <div className="zk-empty">Bu araca bağlı teslimat kaydı yok.</div>
                ) : (
                  <table className="zk-table">
                    <thead><tr><th>Tarih</th><th>Alıcı</th><th>Sınıf</th><th>Kg</th><th>Tutar</th></tr></thead>
                    <tbody>
                      {vehicleDeliveries.map((s) => {
                        const b = buyers.find((x) => x.id === s.buyerId);
                        return (
                          <tr key={s.id}>
                            <td>{fmtDate(s.date)}</td>
                            <td>{b ? b.name : '—'}</td>
                            <td><span className="zk-badge zk-badge-blue">{s.grade || '—'}</span></td>
                            <td>{fmtKg(s.kg)}</td>
                            <td style={{ fontWeight: 600 }}>{fmtTL(s.amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {vehicleSubTab === 'maintenance' && <MaintenanceSection vehicleId={selectedVehicle.id} records={maintenance} setRecords={setMaintenance} />}
          {vehicleSubTab === 'fuel' && <FuelSection vehicleId={selectedVehicle.id} records={fuel} setRecords={setFuel} settings={settings} />}
          {vehicleSubTab === 'documents' && <DocumentsSection vehicleId={selectedVehicle.id} records={documents} setRecords={setDocuments} />}
          {vehicleSubTab === 'insurance' && <InsuranceDamageSection vehicleId={selectedVehicle.id} insurance={insurance} setInsurance={setInsurance} damages={damages} setDamages={setDamages} />}
          {vehicleSubTab === 'fines' && <FinesSection vehicleId={selectedVehicle.id} records={fines} setRecords={setFines} />}
          {vehicleSubTab === 'tires' && <TiresSection vehicleId={selectedVehicle.id} records={tires} setRecords={setTires} />}
          {vehicleSubTab === 'cost' && (
            <CostAnalysisSection
              vehicleId={selectedVehicle.id}
              maintenance={maintenance} fuel={fuel} fines={fines} insurance={insurance} damages={damages}
              vehiclePickups={vehiclePickups} vehicleDeliveries={vehicleDeliveries}
            />
          )}
        </div>
      )}

      {view === 'personnel' && !selectedPersonnel && (
        <>
          {personnel.some((p) => p.payType !== 'maas') && (
            <div className="zk-card" style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Bugün kimler geldi? — {fmtDate(todayStr())}</div>
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 12 }}>Yövmiyeli personel için işaretleyin, günlük yövmiye tutarı otomatik hakediş olarak eklenir.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {personnel.filter((p) => p.payType !== 'maas').map((p) => {
                  const came = todayAttendanceIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      className={`zk-btn ${came ? 'zk-btn-primary' : 'zk-btn-secondary'}`}
                      style={{ fontSize: 12 }}
                      onClick={() => toggleTodayAttendance(p)}
                    >
                      {came ? <CheckCircle2 size={13} /> : <UserCheck size={13} />} {p.name}{p.dailyWage ? ` · ${fmtTL(p.dailyWage)}` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="zk-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Personel listesi</div>
            <button className="zk-btn zk-btn-gold" onClick={() => setShowAddPersonnel(true)}><Plus size={14} /> Personel ekle</button>
          </div>
          {personnel.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: '2 1 200px', maxWidth: 280 }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 9, color: COLORS.inkSoft }} />
                <input className="zk-input" style={{ paddingLeft: 32 }} placeholder="İsim, görev veya telefon ara..." value={personnelQuery} onChange={(e) => setPersonnelQuery(e.target.value)} />
              </div>
              <select className="zk-select" style={{ flex: '1 1 140px', maxWidth: 170 }} value={personnelPayTypeFilter} onChange={(e) => setPersonnelPayTypeFilter(e.target.value)}>
                <option value="">Tüm ödeme türleri</option>
                <option value="yevmiye">Yövmiyeli</option>
                <option value="maas">Maaşlı</option>
              </select>
            </div>
          )}
          {sortedPersonnel.length === 0 ? (
            <div className="zk-empty"><IdCard size={26} className="zk-empty-icon" /><br/>{personnel.length === 0 ? 'Henüz personel eklenmedi.' : 'Aramanızla eşleşen personel bulunamadı.'}</div>
          ) : (
            <>
            <table className="zk-table">
              <thead>
                <tr>
                  <SortableTh label="Ad Soyad" sortKeyName="name" sortKey={persSortKey} sortDir={persSortDir} onSort={persToggleSort} />
                  <th>Görev</th>
                  <th>Telefon</th>
                  <th>Tür</th>
                  <SortableTh label="Alacağı" sortKeyName="balance" sortKey={persSortKey} sortDir={persSortDir} onSort={persToggleSort} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {personnelPaged.paged.map((p) => {
                  const wage = wageBalances[p.id] || { earned: 0, paid: 0 };
                  const remaining = wage.earned - wage.paid;
                  return (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedPersonnelId(p.id)}>
                      <td style={{ fontWeight: 700 }}>{p.name}</td>
                      <td style={{ color: COLORS.inkSoft }}>{p.role || '—'}</td>
                      <td style={{ color: COLORS.inkSoft }}>{p.phone || '—'}</td>
                      <td><span className="zk-badge zk-badge-blue">{p.payType === 'maas' ? 'Maaşlı' : 'Yövmiyeli'}</span></td>
                      <td>
                        {p.payType !== 'maas' ? (
                          <span className={`zk-badge ${remaining > 0 ? 'zk-badge-red' : 'zk-badge-olive'}`}>
                            {remaining > 0 ? fmtTL(remaining) : 'Tamam'}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => setEditingPersonnel(p)}><Pencil size={12} /></button>
                        <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 8px' }} onClick={() => removePersonnel(p)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <ListFooterControls
              page={personnelPaged.page} setPage={personnelPaged.setPage} pageSize={personnelPaged.pageSize} setPageSize={personnelPaged.setPageSize} totalPages={personnelPaged.totalPages} totalCount={personnelPaged.totalCount}
            />
            </>
          )}
          </div>
        </>
      )}

      {view === 'personnel' && selectedPersonnel && (
        <div style={{ marginTop: 16 }}>
          <button className="zk-btn zk-btn-secondary" style={{ marginBottom: 14 }} onClick={() => setSelectedPersonnelId('')}>← Personel listesine dön</button>
          <div className="zk-h1" style={{ fontSize: 20 }}>{selectedPersonnel.name}</div>
          <div className="zk-h1-sub">
            {selectedPersonnel.role || 'Görev belirtilmedi'}{selectedPersonnel.phone ? ` · ${selectedPersonnel.phone}` : ''} ·{' '}
            {selectedPersonnel.payType === 'maas' ? `Maaşlı · ${fmtTL(selectedPersonnel.monthlySalary || 0)}/ay` : `Yövmiyeli · ${fmtTL(selectedPersonnel.dailyWage || 0)}/gün`}
          </div>

          <div className="zk-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
            <StatCard label="Toplam hakediş" value={fmtTL(wageBalances[selectedPersonnel.id]?.earned || 0)} icon={Wallet} />
            <StatCard label="Toplam ödenen" value={fmtTL(wageBalances[selectedPersonnel.id]?.paid || 0)} tone={COLORS.blue} />
            <StatCard
              label="Kalan alacağı"
              value={fmtTL((wageBalances[selectedPersonnel.id]?.earned || 0) - (wageBalances[selectedPersonnel.id]?.paid || 0))}
              tone={(wageBalances[selectedPersonnel.id]?.earned || 0) - (wageBalances[selectedPersonnel.id]?.paid || 0) > 0 ? COLORS.red : COLORS.olive}
            />
          </div>

          <div className="zk-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>
              {selectedPersonnel.payType === 'maas' ? 'Hakediş ekle (örn. aylık maaş tahakkuku)' : 'Hakediş ekle (manuel gün/tutar)'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <input className="zk-input" type="date" style={{ flex: '1 1 130px' }} value={earnDate} onChange={(e) => setEarnDate(e.target.value)} />
              <input className="zk-input" type="number" placeholder="Tutar (TL)" style={{ flex: '1 1 120px' }} value={earnAmount} onChange={(e) => setEarnAmount(e.target.value)} />
              <input className="zk-input" placeholder="Not (opsiyonel)" style={{ flex: '2 1 160px' }} value={earnNote} onChange={(e) => setEarnNote(e.target.value)} />
              <button className="zk-btn zk-btn-gold" onClick={() => addManualEarning(selectedPersonnel.id)}><Plus size={14} /> Ekle</button>
            </div>
            {personnelAttendanceLog.length === 0 ? (
              <div className="zk-empty">Henüz hakediş kaydı yok.</div>
            ) : (
              <table className="zk-table">
                <thead><tr><th>Tarih</th><th>Tutar</th><th>Not</th><th></th></tr></thead>
                <tbody>
                  {personnelAttendanceLog.map((a) => (
                    <tr key={a.id}>
                      <td>{fmtDate(a.date)}</td>
                      <td style={{ fontWeight: 600 }}>{fmtTL(a.amount)}</td>
                      <td style={{ color: COLORS.inkSoft }}>{a.note || '—'}</td>
                      <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removeAttendance(a.id)}><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="zk-card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Ödeme yap</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <input className="zk-input" type="number" placeholder="Tutar (TL)" style={{ flex: '1 1 120px' }} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              <input className="zk-input" placeholder="Not (opsiyonel)" style={{ flex: '2 1 160px' }} value={payNote} onChange={(e) => setPayNote(e.target.value)} />
              <button className="zk-btn zk-btn-primary" onClick={() => addWagePayment(selectedPersonnel.id)}><Plus size={14} /> Ödeme kaydet</button>
            </div>
            {personnelPaymentLog.length === 0 ? (
              <div className="zk-empty">Henüz ödeme kaydı yok.</div>
            ) : (
              <table className="zk-table">
                <thead><tr><th>Tarih</th><th>Tutar</th><th>Not</th><th></th></tr></thead>
                <tbody>
                  {personnelPaymentLog.map((pay) => (
                    <tr key={pay.id}>
                      <td>{fmtDate(pay.date)}</td>
                      <td style={{ fontWeight: 600 }}>{fmtTL(pay.amount)}</td>
                      <td style={{ color: COLORS.inkSoft }}>{pay.note || '—'}</td>
                      <td><button className="zk-btn zk-btn-secondary" style={{ padding: '4px 8px' }} onClick={() => removeWagePayment(pay.id)}><Trash2 size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="zk-card">
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Yaptığı alımlar</div>
            {personnelPickups.length === 0 ? (
              <div className="zk-empty">Bu personele bağlı alım kaydı yok.</div>
            ) : (
              <table className="zk-table">
                <thead><tr><th>Tarih</th><th>Çiftçi</th><th>Araç</th><th>Sınıflar</th><th>Net kg</th><th>Net ödeme</th></tr></thead>
                <tbody>
                  {personnelPickups.map((p) => {
                    const f = farmers.find((x) => x.id === p.farmerId);
                    return (
                      <tr key={p.id}>
                        <td>{fmtDate(p.date)}{p.time ? ` · ${p.time}` : ''}</td>
                        <td>{f ? f.name : '—'}</td>
                        <td style={{ color: COLORS.inkSoft }}>{p.vehiclePlaka || '—'}</td>
                        <td style={{ fontSize: 11.5, color: COLORS.inkSoft }}>{(p.items || []).map((it) => it.grade).join(', ')}</td>
                        <td style={{ fontWeight: 600 }}>{fmtKg(p.netKg)}</td>
                        <td>{fmtTL(p.netPayment)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} onSave={addVehicle} personnel={personnel} />}
      {showAddPersonnel && <AddPersonnelModal onClose={() => setShowAddPersonnel(false)} onSave={addPersonnel} />}
      {editingVehicle && <AddVehicleModal onClose={() => setEditingVehicle(null)} onSave={saveVehicleEdit} personnel={personnel} initialData={editingVehicle} />}
      {editingPersonnel && <AddPersonnelModal onClose={() => setEditingPersonnel(null)} onSave={savePersonnelEdit} initialData={editingPersonnel} />}
    </div>
  );
}
