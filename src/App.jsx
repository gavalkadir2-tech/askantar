import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { supabase } from './supabaseClient.js';
import { currentUser } from './currentUser.js';
import { getPendingCount, flushQueue } from './offlineStorage.js';
import {
  LayoutDashboard,
  Scale as ScaleIcon,
  Wallet,
  FileBarChart,
  Settings as SettingsIcon,
  Package,
  ShoppingCart,
  ListChecks,
  Contact as IdCard,
  Menu,
  Sparkles,
  Package2,
  FlaskConical,
  Landmark,
  History,
  PackageCheck,
  Users,
} from 'lucide-react';
import { CustomerDisplayView } from './components/CustomerDisplayView';
import { NotificationCenter } from './components/NotificationCenter';
import { VoiceAssistant } from './components/VoiceAssistant';
import { GlobalStyle } from './components/common/index';
import { PaymentPrintArea, PrintArea, SalePrintArea } from './components/print/PrintComponents';
import { applyAppearance, storageGet, storageSet, todayStr, uid } from './lib/format';
import { COLORS } from './lib/theme';

// Sekmeler ayrı parçalar (chunk) halinde, ilk açıldıklarında yüklenir;
// böylece ilk açılışta indirilen ana JS dosyası küçük kalır.
const lazyTab = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));
const AccountingTab = lazyTab(() => import('./components/tabs/AccountingTab'), 'AccountingTab');
const AiAssistantTab = lazyTab(() => import('./components/tabs/AiAssistantTab'), 'AiAssistantTab');
const AlisTab = lazyTab(() => import('./components/tabs/AlisTab'), 'AlisTab');
const CariTab = lazyTab(() => import('./components/tabs/CariTab'), 'CariTab');
const CrateInventoryTab = lazyTab(() => import('./components/tabs/CrateInventoryTab'), 'CrateInventoryTab');
const DashboardTab = lazyTab(() => import('./components/tabs/DashboardTab'), 'DashboardTab');
const FleetTab = lazyTab(() => import('./components/tabs/FleetTab'), 'FleetTab');
const LabTab = lazyTab(() => import('./components/tabs/LabTab'), 'LabTab');
const KantarTab = lazyTab(() => import('./components/tabs/KantarTab'), 'KantarTab');
const ReportsTab = lazyTab(() => import('./components/tabs/ReportsTab'), 'ReportsTab');
const SatisTab = lazyTab(() => import('./components/tabs/SatisTab'), 'SatisTab');
const SettingsTab = lazyTab(() => import('./components/tabs/SettingsTab'), 'SettingsTab');
const SevkiyatTab = lazyTab(() => import('./components/tabs/SevkiyatTab'), 'SevkiyatTab');
const ActivityLogTab = lazyTab(() => import('./components/tabs/ActivityLogTab'), 'ActivityLogTab');
const AdminPanel = lazy(() => import('./AdminPanel.jsx'));

// jsPDF ve fontlar yalnızca makbuz yazdırılırken yüklenir.
const loadPdfHelper = () => import('./pdfHelper.js');

export default function KantarDefteri() {
  const [tab, setTab] = useState('dashboard');
  const [userEmail, setUserEmail] = useState(currentUser.email || '');
  const [userBusinessName, setUserBusinessName] = useState(currentUser.businessName || '');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const trySync = async () => {
      if (!navigator.onLine || !currentUser.email) return;
      const count = getPendingCount(currentUser.email);
      setPendingCount(count);
      if (count === 0) return;
      const result = await flushQueue(supabase, currentUser.email);
      setPendingCount(getPendingCount(currentUser.email));
      if (result.synced > 0) window.location.reload();
    };
    const onOnline = () => { setIsOnline(true); trySync(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    trySync();
    const interval = setInterval(trySync, 30000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, []);
  const [farmers, setFarmers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState({});
  const [priceList, setPriceList] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [fuel, setFuel] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [damages, setDamages] = useState([]);
  const [fines, setFines] = useState([]);
  const [tires, setTires] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cashEntries, setCashEntries] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [crateMovements, setCrateMovements] = useState([]);
  const [personnelAttendance, setPersonnelAttendance] = useState([]);
  const [buyerPayments, setBuyerPayments] = useState([]);
  const displayChannelRef = useRef(null);
  const [personnelPayments, setPersonnelPayments] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [checksNotes, setChecksNotes] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [printTarget, setPrintTarget] = useState(null);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [autoBackups, setAutoBackups] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const [f, p, pay, b, s, set, pl, per, exp, cash, veh, maint, fl, docs, ins, dmg, fns, trs, rem, crt, lab, bnk, chk, shp, pAtt, pPay, bPay, log] = await Promise.all([
        storageGet('zk:farmers'),
        storageGet('zk:purchases'),
        storageGet('zk:payments'),
        storageGet('zk:buyers'),
        storageGet('zk:sales'),
        storageGet('zk:settings'),
        storageGet('zk:priceList'),
        storageGet('zk:personnel'),
        storageGet('zk:expenses'),
        storageGet('zk:cashEntries'),
        storageGet('zk:vehicles'),
        storageGet('zk:vehicleMaintenance'),
        storageGet('zk:vehicleFuel'),
        storageGet('zk:vehicleDocuments'),
        storageGet('zk:vehicleInsurance'),
        storageGet('zk:vehicleDamage'),
        storageGet('zk:vehicleFines'),
        storageGet('zk:vehicleTires'),
        storageGet('zk:reminders'),
        storageGet('zk:crateMovements'),
        storageGet('zk:labResults'),
        storageGet('zk:bankAccounts'),
        storageGet('zk:checksNotes'),
        storageGet('zk:shipments'),
        storageGet('zk:personnelAttendance'),
        storageGet('zk:personnelPayments'),
        storageGet('zk:buyerPayments'),
        storageGet('zk:activityLog'),
      ]);
      setFarmers(f || []); setPurchases(p || []); setPayments(pay || []);
      setBuyers(b || []); setSales(s || []); setSettings(set || {});
      applyAppearance(set || {});
      setPersonnel(per || []); setExpenses(exp || []); setCashEntries(cash || []);
      setVehicles(veh || []);
      setMaintenance(maint || []); setFuel(fl || []); setDocuments(docs || []);
      setInsurance(ins || []); setDamages(dmg || []); setFines(fns || []); setTires(trs || []);
      setReminders(rem || []);
      setCrateMovements(crt || []); setLabResults(lab || []); setBankAccounts(bnk || []); setChecksNotes(chk || []);
      setShipments(shp || []);
      setPersonnelAttendance(pAtt || []); setPersonnelPayments(pPay || []);
      setBuyerPayments(bPay || []);
      setActivityLog(log || []);
      // Fiyat listesi boş başlar; ürün türleri Ayarlar'dan eklenir.
      const normalized = (pl || []).map((v) => ('grades' in v ? v : { id: v.id, name: v.name, hasGrades: false, singlePrice: v.price || 0, grades: [] }));
      setPriceList(normalized);
      setLoaded(true);
    })();
  }, []);

  const handlePrintReceipt = (purchase) => {
    const farmer = farmers.find((f) => f.id === purchase.farmerId);
    loadPdfHelper().then((m) => m.printReceiptPdf(purchase, farmer, settings));
  };

  const handlePrintSaleReceipt = (sale) => {
    const buyer = buyers.find((b) => b.id === sale.buyerId);
    loadPdfHelper().then((m) => m.printSaleReceiptPdf(sale, buyer, settings));
  };

  const handlePrintPayment = (row) => {
    loadPdfHelper().then((m) => m.printPaymentReceiptPdf(row, settings));
  };

  const buildBackupPayload = () => ({
    farmers, purchases, payments, buyers, sales, settings, priceList, personnel, expenses, cashEntries, vehicles,
    vehicleMaintenance: maintenance, vehicleFuel: fuel, vehicleDocuments: documents, vehicleInsurance: insurance,
    vehicleDamage: damages, vehicleFines: fines, vehicleTires: tires, reminders,
    crateMovements, labResults, bankAccounts, checksNotes, shipments,
    personnelAttendance, personnelPayments, buyerPayments,
    exportedAt: new Date().toISOString(),
  });

  const runAutoBackupIfNeeded = async () => {
    try {
      const idx = (await storageGet('zk:autobackupIndex')) || [];
      const today = todayStr();
      if (idx.length > 0 && idx[idx.length - 1].date === today) { setAutoBackups(idx); return; }
      const payload = buildBackupPayload();
      const key = `zk:autobackup:${today}`;
      await storageSet(key, payload);
      let nextIdx = [...idx, { date: today, key }];
      if (nextIdx.length > 7) {
        const removed = nextIdx.slice(0, nextIdx.length - 7);
        nextIdx = nextIdx.slice(nextIdx.length - 7);
        for (const r of removed) {
          try { await window.storage.delete(r.key, false); } catch (e) { /* önemli değil */ }
        }
      }
      await storageSet('zk:autobackupIndex', nextIdx);
      setAutoBackups(nextIdx);
    } catch (e) {
      // Otomatik yedekleme sessizce başarısız olabilir, uygulamayı etkilememeli
    }
  };

  const restoreFromAutoBackup = async (key) => {
    if (!window.confirm('Bu otomatik yedeği geri yüklemek istediğinize emin misiniz? Mevcut veriler bu yedekle değiştirilecek.')) return;
    try {
      const data = await storageGet(key);
      if (!data) { setRestoreStatus('Yedek bulunamadı.'); return; }
      const keys = ['farmers', 'purchases', 'payments', 'buyers', 'sales', 'settings', 'priceList', 'personnel', 'expenses', 'cashEntries', 'vehicles', 'vehicleMaintenance', 'vehicleFuel', 'vehicleDocuments', 'vehicleInsurance', 'vehicleDamage', 'vehicleFines', 'vehicleTires', 'reminders', 'crateMovements', 'labResults', 'bankAccounts', 'checksNotes', 'shipments', 'personnelAttendance', 'personnelPayments', 'buyerPayments'];
      for (const k of keys) {
        if (data[k] !== undefined) await storageSet(`zk:${k}`, data[k]);
      }
      setFarmers(data.farmers || []); setPurchases(data.purchases || []); setPayments(data.payments || []);
      setBuyers(data.buyers || []); setSales(data.sales || []); setSettings(data.settings || {});
      applyAppearance(data.settings || {});
      setPriceList(data.priceList || []); setPersonnel(data.personnel || []);
      setExpenses(data.expenses || []); setCashEntries(data.cashEntries || []);
      setVehicles(data.vehicles || []);
      setMaintenance(data.vehicleMaintenance || []); setFuel(data.vehicleFuel || []); setDocuments(data.vehicleDocuments || []);
      setInsurance(data.vehicleInsurance || []); setDamages(data.vehicleDamage || []); setFines(data.vehicleFines || []); setTires(data.vehicleTires || []);
      setReminders(data.reminders || []);
      setCrateMovements(data.crateMovements || []); setLabResults(data.labResults || []);
      setBankAccounts(data.bankAccounts || []); setChecksNotes(data.checksNotes || []);
      setShipments(data.shipments || []);
      setPersonnelAttendance(data.personnelAttendance || []); setPersonnelPayments(data.personnelPayments || []);
      setBuyerPayments(data.buyerPayments || []);
      setRestoreStatus(`${key.split(':').pop()} tarihli otomatik yedek geri yüklendi.`);
    } catch (e) {
      setRestoreStatus('Otomatik yedek geri yüklenemedi.');
    }
  };

  useEffect(() => {
    if (loaded) runAutoBackupIfNeeded();
  }, [loaded]);

  useEffect(() => {
    if (!loaded || settings.displayChannelId) return;
    const id = uid() + uid();
    const next = { ...settings, displayChannelId: id };
    setSettings(next);
    storageSet('zk:settings', next);
  }, [loaded, settings.displayChannelId]);

  useEffect(() => {
    if (typeof supabase === 'undefined' || !settings.displayChannelId) return;
    const ch = supabase.channel(`zk-display-${settings.displayChannelId}`);
    ch.subscribe();
    displayChannelRef.current = ch;
    return () => { supabase.removeChannel(ch); displayChannelRef.current = null; };
  }, [settings.displayChannelId]);

  const backupData = () => {
    const payload = buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kantar-defteri-yedek-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const restoreData = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const keys = ['farmers', 'purchases', 'payments', 'buyers', 'sales', 'settings', 'priceList', 'personnel', 'expenses', 'cashEntries', 'vehicles', 'vehicleMaintenance', 'vehicleFuel', 'vehicleDocuments', 'vehicleInsurance', 'vehicleDamage', 'vehicleFines', 'vehicleTires', 'reminders', 'crateMovements', 'labResults', 'bankAccounts', 'checksNotes', 'shipments', 'personnelAttendance', 'personnelPayments', 'buyerPayments'];
      for (const k of keys) {
        if (data[k] !== undefined) await storageSet(`zk:${k}`, data[k]);
      }
      setFarmers(data.farmers || []); setPurchases(data.purchases || []); setPayments(data.payments || []);
      setBuyers(data.buyers || []); setSales(data.sales || []); setSettings(data.settings || {});
      applyAppearance(data.settings || {});
      setPriceList(data.priceList || []); setPersonnel(data.personnel || []);
      setExpenses(data.expenses || []); setCashEntries(data.cashEntries || []);
      setVehicles(data.vehicles || []);
      setMaintenance(data.vehicleMaintenance || []); setFuel(data.vehicleFuel || []); setDocuments(data.vehicleDocuments || []);
      setInsurance(data.vehicleInsurance || []); setDamages(data.vehicleDamage || []); setFines(data.vehicleFines || []); setTires(data.vehicleTires || []);
      setReminders(data.reminders || []);
      setCrateMovements(data.crateMovements || []); setLabResults(data.labResults || []);
      setBankAccounts(data.bankAccounts || []); setChecksNotes(data.checksNotes || []);
      setShipments(data.shipments || []);
      setPersonnelAttendance(data.personnelAttendance || []); setPersonnelPayments(data.personnelPayments || []);
      setBuyerPayments(data.buyerPayments || []);
      setRestoreStatus('Yedek başarıyla geri yüklendi.');
    } catch (e) {
      setRestoreStatus('Dosya okunamadı, geçerli bir yedek dosyası seçin.');
    }
  };

  const navItems = [
    { key: 'dashboard', label: 'Pano', icon: LayoutDashboard, group: null },

    { key: 'kantar', label: 'Kantar', icon: ScaleIcon, group: 'İşlemler' },
    { key: 'alis', label: 'Alış', icon: Package, group: 'İşlemler' },
    { key: 'satis', label: 'Satış', icon: ShoppingCart, group: 'İşlemler' },
    { key: 'shipments', label: 'Sevkiyat', icon: PackageCheck, group: 'İşlemler' },

    { key: 'accounting', label: 'Muhasebe', icon: Landmark, group: 'Finans' },
    { key: 'cari', label: 'Cariler', icon: Wallet, group: 'Finans' },
    { key: 'personnel', label: 'Personel', icon: IdCard, group: 'Finans' },

    { key: 'crates', label: 'Kasa & Çuval', icon: Package2, group: 'Diğer' },
    { key: 'lab', label: 'Laboratuvar', icon: FlaskConical, group: 'Diğer' },
    { key: 'ai', label: 'AI Asistan', icon: Sparkles, group: 'Diğer' },
    { key: 'reports', label: 'Raporlar', icon: FileBarChart, group: 'Diğer' },
    { key: 'log', label: 'İşlem Geçmişi', icon: History, group: 'Diğer' },
    { key: 'settings', label: 'Ayarlar', icon: SettingsIcon, group: 'Diğer' },
  ];

  if (currentUser.role === 'owner' || currentUser.role === 'superadmin') {
    navItems.push({ key: 'users', label: 'Kullanıcı Yönetimi', icon: Users, group: 'Yönetim' });
  }

  const ROLE_TAB_ACCESS = {
    admin: null, owner: null, superadmin: null, user: null, // null = tum sekmelere erisim
    muhasebe: ['dashboard', 'accounting', 'cari', 'reports', 'alis', 'settings'],
    kantar: ['dashboard', 'kantar', 'alis', 'cari'],
    depo: ['dashboard', 'kantar', 'satis', 'crates', 'lab'],
    sevkiyat: ['dashboard', 'shipments'], // Araçlar, Sevkiyat sekmesinin içinde
  };
  const allowedTabs = ROLE_TAB_ACCESS[currentUser.role];
  const visibleNavItems = allowedTabs ? navItems.filter((item) => allowedTabs.includes(item.key)) : navItems;
  useEffect(() => {
    if (allowedTabs && !allowedTabs.includes(tab)) setTab(allowedTabs[0] || 'dashboard');
  }, [currentUser.role]);

  if (!loaded) {
    return <div className="zk-app"><GlobalStyle /><div style={{ padding: 40, fontSize: 13, color: COLORS.inkSoft }}>Yükleniyor...</div></div>;
  }

  if (typeof window !== 'undefined' && window.location.search.includes('display=customer')) {
    const params = new URLSearchParams(window.location.search);
    return <CustomerDisplayView businessName={settings.businessName} logo={settings.logo} channelId={params.get('ch') || settings.displayChannelId} />;
  }

  const displayChannelId = settings.displayChannelId || null;

  const broadcastLive = (msg) => {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const ch = new BroadcastChannel('zk-customer-display' + (displayChannelId ? '-' + displayChannelId : ''));
        ch.postMessage(msg);
        ch.close();
      } catch (e) { /* musteri ekrani acik degilse sorun degil */ }
    }
    if (typeof supabase !== 'undefined' && displayChannelRef.current) {
      try { displayChannelRef.current.send({ type: 'broadcast', event: 'update', payload: msg }); } catch (e) { /* aginda sorun olabilir, sessizce gec */ }
    }
  };

  const customerDisplayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?display=customer${displayChannelId ? `&ch=${displayChannelId}` : ''}`
    : '';

  const openCustomerDisplay = () => {
    window.open(customerDisplayUrl, 'zk-customer-display-window', 'noopener');
  };

  // Araçlar (Sevkiyat içinde) ve Personel sekmelerinin ortak FleetTab verileri
  const fleetProps = {
    vehicles, setVehicles, personnel, setPersonnel, purchases, sales, farmers, buyers,
    maintenance, setMaintenance, fuel, setFuel, documents, setDocuments, insurance, setInsurance,
    damages, setDamages, fines, setFines, tires, setTires, settings, setSettings,
    crateMovements, setCrateMovements, personnelAttendance, setPersonnelAttendance, personnelPayments, setPersonnelPayments,
  };

  const fontZoom = { small: 0.92, normal: 1, large: 1.08 }[settings.fontSize] || 1;

  return (
    <div className="zk-app" style={{ zoom: fontZoom }}>
      <GlobalStyle />
      <div className="zk-topbar">
        <button className="zk-topbar-btn" onClick={() => setSidebarOpen(true)} aria-label="Menüyü aç"><Menu size={20} /></button>
        <div className="zk-topbar-brand">Kantar Defteri</div>
      </div>
      <div className={`zk-sidebar-overlay ${sidebarOpen ? 'zk-sidebar-open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <div className="zk-shell">
        <div className={`zk-sidebar ${sidebarOpen ? 'zk-sidebar-open' : ''} ${settings.sidebarDensity === 'compact' ? 'zk-sidebar-compact' : ''}`}>
          <div className="zk-brand-row">
            {settings.logo ? (
              <img src={settings.logo} alt="Logo" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }} />
            ) : (
            <ScaleIcon size={20} color="#D9C77E" strokeWidth={1.6} />
            )}
            <div className="zk-brand">Kantar Defteri</div>
          </div>
          <div className="zk-brand-sub">Komisyon Yönetimi</div>
          <NotificationCenter
            farmers={farmers} purchases={purchases} payments={payments}
            documents={documents} insurance={insurance} fines={fines}
            maintenance={maintenance} fuel={fuel} vehicles={vehicles}
            reminders={reminders} setReminders={setReminders} settings={settings}
          />
          {visibleNavItems.map((item, i) => (
            <React.Fragment key={item.key}>
              {item.group && item.group !== visibleNavItems[i - 1]?.group && (
                <div className="zk-navgroup-label">{item.group}</div>
              )}
              <button className={`zk-navbtn ${tab === item.key ? 'active' : ''}`} onClick={() => { setTab(item.key); setSidebarOpen(false); }}>
                <item.icon size={16} /> {item.label}
              </button>
            </React.Fragment>
          ))}
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 11px', marginBottom: 8, fontSize: 10.5,
              color: isOnline ? (pendingCount > 0 ? '#E8C468' : '#8FBF8A') : '#E08A6E',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
              {!isOnline
                ? `Çevrimdışı${pendingCount > 0 ? ` · ${pendingCount} değişiklik bekliyor` : ''}`
                : pendingCount > 0 ? `Senkronize ediliyor (${pendingCount})` : 'Çevrimiçi'}
            </div>
            <div style={{ fontSize: 10.5, color: '#A9B896', padding: '0 11px', marginBottom: 2, wordBreak: 'break-all' }}>
              {userEmail}
            </div>
            {userBusinessName && (
              <div style={{ fontSize: 10, color: '#7C8A6C', padding: '0 11px', marginBottom: 8 }}>
                {userBusinessName}
              </div>
            )}
            <button className="zk-navbtn" onClick={() => supabase.auth.signOut()}>
              Çıkış yap
            </button>
          </div>
        </div>
        <div className="zk-main">
          <Suspense fallback={<div style={{ padding: 40, fontSize: 13, color: COLORS.inkSoft }}>Yükleniyor...</div>}>
          {tab === 'dashboard' && <DashboardTab farmers={farmers} purchases={purchases} payments={payments} sales={sales} buyers={buyers} buyerPayments={buyerPayments} setTab={setTab} />}

          {tab === 'kantar' && <KantarTab farmers={farmers} setFarmers={setFarmers} purchases={purchases} setPurchases={setPurchases} onPrintReceipt={handlePrintReceipt} settings={settings} priceList={priceList} personnel={personnel} setPersonnel={setPersonnel} vehicles={vehicles} setVehicles={setVehicles} broadcastLive={broadcastLive} openCustomerDisplay={openCustomerDisplay} customerDisplayUrl={customerDisplayUrl} buyers={buyers} setBuyers={setBuyers} sales={sales} setSales={setSales} onPrintSaleReceipt={handlePrintSaleReceipt} />}
          {tab === 'alis' && <AlisTab farmers={farmers} setFarmers={setFarmers} purchases={purchases} setPurchases={setPurchases} priceList={priceList} personnel={personnel} vehicles={vehicles} settings={settings} onPrintReceipt={handlePrintReceipt} activityLog={activityLog} setActivityLog={setActivityLog} />}
          {tab === 'shipments' && <SevkiyatTab vehicles={vehicles} personnel={personnel} buyers={buyers} shipments={shipments} setShipments={setShipments} fleetProps={fleetProps} />}

          {tab === 'accounting' && <AccountingTab bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} checksNotes={checksNotes} setChecksNotes={setChecksNotes} settings={settings} setSettings={setSettings} payments={payments} setPayments={setPayments} expenses={expenses} setExpenses={setExpenses} cashEntries={cashEntries} setCashEntries={setCashEntries} farmers={farmers} purchases={purchases} buyers={buyers} buyerPayments={buyerPayments} setBuyerPayments={setBuyerPayments} sales={sales} onPrintPayment={handlePrintPayment} />}
          {tab === 'cari' && <CariTab farmers={farmers} setFarmers={setFarmers} buyers={buyers} setBuyers={setBuyers} purchases={purchases} payments={payments} setPayments={setPayments} sales={sales} selectedFarmerId={selectedFarmerId} setSelectedFarmerId={setSelectedFarmerId} onPrintReceipt={handlePrintReceipt} settings={settings} buyerPayments={buyerPayments} setBuyerPayments={setBuyerPayments} onPrintSaleReceipt={handlePrintSaleReceipt} activityLog={activityLog} setActivityLog={setActivityLog} />}
          {tab === 'satis' && <SatisTab purchases={purchases} buyers={buyers} setBuyers={setBuyers} sales={sales} setSales={setSales} vehicles={vehicles} setVehicles={setVehicles} personnel={personnel} settings={settings} onPrintSaleReceipt={handlePrintSaleReceipt} buyerPayments={buyerPayments} setBuyerPayments={setBuyerPayments} activityLog={activityLog} setActivityLog={setActivityLog} />}

          {tab === 'personnel' && <FleetTab lockedView="personnel" {...fleetProps} />}
          {tab === 'crates' && <CrateInventoryTab farmers={farmers} movements={crateMovements} setMovements={setCrateMovements} settings={settings} setSettings={setSettings} activityLog={activityLog} setActivityLog={setActivityLog} />}
          {tab === 'lab' && <LabTab farmers={farmers} purchases={purchases} results={labResults} setResults={setLabResults} />}

          {tab === 'ai' && <AiAssistantTab farmers={farmers} purchases={purchases} sales={sales} expenses={expenses} payments={payments} buyers={buyers} vehicles={vehicles} maintenance={maintenance} fuel={fuel} documents={documents} insurance={insurance} damages={damages} fines={fines} />}
          {tab === 'reports' && <ReportsTab farmers={farmers} purchases={purchases} sales={sales} buyers={buyers} expenses={expenses} personnel={personnel} vehicles={vehicles} personnelAttendance={personnelAttendance} personnelPayments={personnelPayments} payments={payments} buyerPayments={buyerPayments} settings={settings} />}
          {tab === 'log' && <ActivityLogTab activityLog={activityLog} />}
          {tab === 'users' && <AdminPanel />}
          {tab === 'settings' && <SettingsTab settings={settings} setSettings={setSettings} priceList={priceList} setPriceList={setPriceList} onBackup={backupData} onRestore={restoreData} restoreStatus={restoreStatus} farmers={farmers} setFarmers={setFarmers} autoBackups={autoBackups} onRestoreAutoBackup={restoreFromAutoBackup} allData={{ farmers, purchases, sales, buyers, expenses, payments, vehicles, personnel, maintenance, fuel, documents, insurance, fines, cashEntries, crateMovements, labResults, bankAccounts, checksNotes, shipments }} activityLog={activityLog} setActivityLog={setActivityLog} />}
          </Suspense>
        </div>
      </div>
      {printTarget?.type === 'sale' && <SalePrintArea sale={printTarget.sale} buyer={printTarget.buyer} settings={settings} />}
      {printTarget?.type === 'payment' && <PaymentPrintArea row={printTarget.row} settings={settings} />}
      {(!printTarget || (printTarget.type !== 'sale' && printTarget.type !== 'payment')) && <PrintArea purchase={printTarget?.purchase} farmer={printTarget?.farmer} settings={settings} />}
      <VoiceAssistant farmers={farmers} setFarmers={setFarmers} priceList={priceList} purchases={purchases} setPurchases={setPurchases} payments={payments} setPayments={setPayments} expenses={expenses} setExpenses={setExpenses} reminders={reminders} setReminders={setReminders} settings={settings} buyers={buyers} sales={sales} setSales={setSales} buyerPayments={buyerPayments} setBuyerPayments={setBuyerPayments} />
    </div>
  );
}
