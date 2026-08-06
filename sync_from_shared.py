"""
Bu betik, Claude sohbetindeki paylaşılan zeytin_defteri.jsx dosyasını
GitHub projesindeki src/App.jsx'e dönüştürür:
  1. window.storage çağrılarını, her hesabın kendi verisini gördüğü
     (owner_email ile filtrelenen) Supabase tabanlı depolamaya çevirir
  2. Supabase client + currentUser import'larını ekler
  3. Sidebar'a kullanıcı e-postası + çıkış butonu ekler
Kullanım: python3 sync_from_shared.py /path/to/zeytin_defteri.jsx
"""
import sys

src_path = sys.argv[1] if len(sys.argv) > 1 else '../zeytin_defteri.jsx'
content = open(src_path, encoding='utf-8').read()

old_storage = """async function storageGet(key) {
  try {
    const res = await window.storage.get(key, false);
    return res ? JSON.parse(res.value) : null;
  } catch (e) {
    return null;
  }
}
async function storageSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) {
    console.error('Depolama hatasi:', e);
  }
}"""
new_storage = """// Bu proje bagimsiz calistigi icin Claude artifact ortamindaki window.storage
// yerine Supabase (gercek Postgres veritabani) kullanir. Her satir giris yapan
// kullanicinin e-postasina (owner_email) baglidir, boylece her hesap sadece
// kendi verisini gorur/degistirir. Ayrica CEVRIMDISI-ONCELIKLI calisir: her
// okuma/yazma once yerel tarayici onbellegine uygulanir (internetsiz de
// calisir), Supabase'e yazma basarisiz olursa bekleyen kuyruga eklenir ve
// baglanti gelince otomatik gonderilir (bkz. offlineStorage.js).
async function storageGet(key) {
  const cached = offlineGet(currentUser.email, key);
  try {
    const { data, error } = await supabase.from('app_data').select('value').eq('key', key).eq('owner_email', currentUser.email).maybeSingle();
    if (error) throw error;
    if (data) { offlineSet(currentUser.email, key, data.value); return data.value; }
    return cached;
  } catch (e) {
    return cached;
  }
}
async function storageSet(key, value) {
  offlineSet(currentUser.email, key, value);
  try {
    const { error } = await supabase.from('app_data').upsert({ key, value, owner_email: currentUser.email, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (e) {
    queuePendingWrite(currentUser.email, key, value);
  }
}"""
assert old_storage in content, "storage bloğu bulunamadı - şablon değişmiş olabilir"
content = content.replace(old_storage, new_storage)

anchor = "import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';"
assert anchor in content
content = content.replace(
    anchor,
    "import { supabase } from './supabaseClient.js';\nimport { currentUser } from './currentUser.js';\nimport { offlineGet, offlineSet, queuePendingWrite, getPendingCount, flushQueue } from './offlineStorage.js';\n" + anchor
)

old_sidebar_end = """          {navItems.map((item) => (
            <button key={item.key} className={`zk-navbtn ${tab === item.key ? 'active' : ''}`} onClick={() => { setTab(item.key); setSidebarOpen(false); }}>
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </div>"""
new_sidebar_end = """          {navItems.map((item) => (
            <button key={item.key} className={`zk-navbtn ${tab === item.key ? 'active' : ''}`} onClick={() => { setTab(item.key); setSidebarOpen(false); }}>
              <item.icon size={16} /> {item.label}
            </button>
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
        </div>"""
assert old_sidebar_end in content, "sidebar bloğu bulunamadı"
content = content.replace(old_sidebar_end, new_sidebar_end)

old_app_start = "export default function ZeytinDefteri() {\n  const [tab, setTab] = useState('dashboard');"
new_app_start = """export default function ZeytinDefteri() {
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
  }, []);"""
assert old_app_start in content, "App başlangıcı bulunamadı"
content = content.replace(old_app_start, new_app_start)

old_sidebar_css = ".zk-sidebar { width: 216px; background: ${COLORS.olive}; flex-shrink: 0; padding: 22px 12px; display: flex; flex-direction: column; gap: 3px; position: relative; overflow-y: auto; }"
new_sidebar_css = ".zk-sidebar { width: 216px; background: ${COLORS.olive}; flex-shrink: 0; padding: 22px 12px; display: flex; flex-direction: column; gap: 3px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }"
if old_sidebar_css in content:
    content = content.replace(old_sidebar_css, new_sidebar_css)

# 6) Rol bazli sekme erisimi: currentUser.role'e gore navItems filtrelenir
old_navitems_use = """  if (!loaded) {
    return <div className="zk-app"><GlobalStyle /><div style={{ padding: 40, fontSize: 13, color: COLORS.inkSoft }}>Yükleniyor...</div></div>;
  }"""
new_navitems_use = """  const ROLE_TAB_ACCESS = {
    admin: null, user: null, // null = tum sekmelere erisim
    muhasebe: ['dashboard', 'finance', 'reports', 'logistics', 'settings'],
    kantar: ['dashboard', 'purchase', 'logistics', 'farmers'],
    depo: ['dashboard', 'logistics', 'crates', 'lab'],
    sevkiyat: ['dashboard', 'logistics', 'fleet'],
  };
  const allowedTabs = ROLE_TAB_ACCESS[currentUser.role];
  const visibleNavItems = allowedTabs ? navItems.filter((item) => allowedTabs.includes(item.key)) : navItems;
  useEffect(() => {
    if (allowedTabs && !allowedTabs.includes(tab)) setTab(allowedTabs[0] || 'dashboard');
  }, [currentUser.role]);

  if (!loaded) {
    return <div className="zk-app"><GlobalStyle /><div style={{ padding: 40, fontSize: 13, color: COLORS.inkSoft }}>Yükleniyor...</div></div>;
  }"""
assert old_navitems_use in content, "navItems kullanım bloğu bulunamadı"
content = content.replace(old_navitems_use, new_navitems_use)

old_navmap = "{navItems.map((item) => ("
new_navmap = "{visibleNavItems.map((item) => ("
assert old_navmap in content
content = content.replace(old_navmap, new_navmap)

# 7) PDF/QR yardimcilarini import et
anchor2 = "import { currentUser } from './currentUser.js';"
assert anchor2 in content
content = content.replace(
    anchor2,
    anchor2 + "\nimport { getQrDataUrl } from './qrHelper.js';\nimport { downloadReceiptPdf } from './pdfHelper.js';"
)

# 8) PrintArea'ya gercek QR kod ekle (fisin en altina)
old_printarea_signature = "function PrintArea({ purchase, farmer, settings }) {\n  if (!purchase || !farmer) return <div id=\"zk-print-area\" />;"
new_printarea_signature = """function PrintArea({ purchase, farmer, settings }) {
  const [qrUrl, setQrUrl] = useState(null);
  useEffect(() => {
    if (!purchase) return;
    const verifyText = `ZeytinDefteri|Makbuz:${purchase.makbuzNo}|Tarih:${purchase.date}|Tutar:${purchase.netPayment}`;
    getQrDataUrl(verifyText).then(setQrUrl);
  }, [purchase && purchase.id]);
  if (!purchase || !farmer) return <div id="zk-print-area" />;"""
assert old_printarea_signature in content, "PrintArea imzasi bulunamadi"
content = content.replace(old_printarea_signature, new_printarea_signature)

old_signature_block = """        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 10 }}>
          <div>Satıcı İmza<br/>........................</div>
          <div>Alıcı İmza<br/>........................</div>
        </div>"""
new_signature_block = """        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 26, fontSize: 10 }}>
          <div>Satıcı İmza<br/>........................</div>
          <div>Alıcı İmza<br/>........................</div>
        </div>
        {qrUrl && (
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <img src={qrUrl} alt="Dogrulama QR kodu" style={{ width: 70, height: 70 }} />
            <div style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Fiş doğrulama kodu</div>
          </div>
        )}"""
assert old_signature_block in content, "imza blogu bulunamadi"
content = content.replace(old_signature_block, new_signature_block)

# 9) "PDF indir" butonunu alim sonrasi onay kutusuna ekle
old_confirm_box = """                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="zk-btn zk-btn-secondary" onClick={() => onPrintReceipt(lastSaved)}><Printer size={13} /> Yazdır</button>"""
new_confirm_box = """                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="zk-btn zk-btn-secondary" onClick={() => onPrintReceipt(lastSaved)}><Printer size={13} /> Yazdır</button>
                  <button className="zk-btn zk-btn-secondary" onClick={() => downloadReceiptPdf(lastSaved, lastSavedFarmer, settings)}><Download size={13} /> PDF indir</button>"""
assert old_confirm_box in content, "onay kutusu bulunamadi"
content = content.replace(old_confirm_box, new_confirm_box)

# 10) "PDF indir" butonunu Tum Alimlar tablosuna ekle
old_allpurchases_actions = """                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintReceipt(p)}><Printer size={12} /></button>
                      {waPhone && ("""
new_allpurchases_actions = """                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => onPrintReceipt(p)}><Printer size={12} /></button>
                      <button className="zk-btn zk-btn-secondary" style={{ padding: '5px 9px' }} onClick={() => downloadReceiptPdf(p, f, settings)}><Download size={12} /></button>
                      {waPhone && ("""
assert old_allpurchases_actions in content, "Tum Alimlar aksiyon hucresi bulunamadi"
content = content.replace(old_allpurchases_actions, new_allpurchases_actions)

open('src/App.jsx', 'w', encoding='utf-8').write(content)
print("src/App.jsx güncellendi (çok kiracılı Supabase depolama ile).")
