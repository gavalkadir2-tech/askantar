import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';
import { currentUser } from './currentUser.js';

const COLORS = { olive: '#3F4A2E', gold: '#B3892B', ink: '#2B2A25', inkSoft: '#6B6A60', border: '#DCD6C4', paper: '#F4F2EC', red: '#A13D2E', blue: '#3B5E73', green: '#3E7A4A' };

export const ROLE_LABELS = {
  owner: 'İşletme Sahibi',
  superadmin: 'Sistem Sahibi',
  user: 'Tam Yetkili Kullanıcı',
  muhasebe: 'Muhasebe',
  kantar: 'Kantar Operatörü',
  depo: 'Depo Sorumlusu',
  sevkiyat: 'Sevkiyat Sorumlusu',
};

const EMPLOYEE_ROLE_OPTIONS = ['user', 'muhasebe', 'kantar', 'depo', 'sevkiyat'];

const styles = {
  wrap: { maxWidth: 860, margin: '0 auto', padding: '8px 4px 40px' },
  title: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 600, color: COLORS.ink, marginBottom: 18 },
  sectionTitle: { fontSize: 13.5, fontWeight: 700, color: COLORS.ink, marginBottom: 12 },
  card: { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 18 },
  input: { padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: 'inherit', flex: 1, minWidth: 140 },
  select: { padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: 'inherit', background: '#fff' },
  btn: { padding: '10px 16px', borderRadius: 8, border: 'none', background: COLORS.olive, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnSecondary: { padding: '8px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnDanger: { padding: '8px 14px', borderRadius: 8, border: `1px solid ${COLORS.red}`, background: '#fff', color: COLORS.red, fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid #EFEBDD`, flexWrap: 'wrap', gap: 8 },
  badge: (color, bg) => ({ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: bg, color }),
  label: { fontSize: 11.5, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 4, display: 'block' },
  field: { display: 'flex', flexDirection: 'column', minWidth: 140 },
  toggleRow: { display: 'flex', gap: 8 },
  toggleBtn: (active) => ({
    padding: '8px 14px', borderRadius: 8, border: `1px solid ${active ? COLORS.olive : COLORS.border}`,
    background: active ? COLORS.olive : '#fff', color: active ? '#fff' : COLORS.ink, fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
  }),
};

function daysLeft(expiresAt) {
  if (!expiresAt) return null;
  const diff = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function SubscriptionBadge({ biz }) {
  if (!biz) return null;
  if (!biz.active) return <span style={styles.badge(COLORS.red, '#F7E3DE')}>Askıya Alınmış</span>;
  if (biz.subscription_type === 'omurluk') return <span style={styles.badge(COLORS.gold, '#F4E9D2')}>Ömürlük Üyelik</span>;
  const d = daysLeft(biz.expires_at);
  if (d === null) return <span style={styles.badge(COLORS.blue, '#E1EAEE')}>Yıllık Üyelik</span>;
  if (d < 0) return <span style={styles.badge(COLORS.red, '#F7E3DE')}>Süresi Doldu</span>;
  if (d <= 30) return <span style={styles.badge('#8A6A1E', '#F4E9D2')}>{d} gün kaldı</span>;
  return <span style={styles.badge(COLORS.green, '#DFEEE2')}>Yıllık · {d} gün kaldı</span>;
}

// ---------- İşletme sahibi görünümü: kendi çalışanlarını yönetir ----------
function OwnerView() {
  const [business, setBusiness] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('user');
  const [authType, setAuthType] = useState('username'); // 'username' | 'email'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: biz } = await supabase.from('businesses').select('*').eq('id', currentUser.businessId).maybeSingle();
    setBusiness(biz || null);
    const { data: us, error: err } = await supabase.from('app_users').select('*').eq('business_id', currentUser.businessId).order('created_at', { ascending: false });
    if (err) setError(err.message);
    setUsers(us || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activeCount = users.filter((u) => u.active).length;
  const atLimit = business ? activeCount >= business.max_users : false;

  const addUser = async () => {
    setError(''); setNotice('');
    if (atLimit) { setError(`Kullanıcı limitinize ulaştınız (en fazla ${business.max_users} kişi). Limit artışı için sistem sahibiyle iletişime geçin.`); return; }
    const payload = { action: 'create_user', role, full_name: fullName.trim() || undefined };
    if (authType === 'email') {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed || !trimmed.includes('@')) { setError('Geçerli bir e-posta girin.'); return; }
      payload.email = trimmed;
    } else {
      if (!username.trim()) { setError('Kullanıcı adı girin.'); return; }
      if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return; }
      payload.username = username.trim();
      payload.password = password;
    }
    setSaving(true);
    const { data, error: fnErr } = await supabase.functions.invoke('manage-users', { body: payload });
    setSaving(false);
    if (fnErr || data?.error) { setError(data?.error || fnErr.message); return; }
    setNotice(authType === 'email' ? `${payload.email} eklendi. Bu adresle Google girişi yapabilir.` : `${payload.username} kullanıcı adıyla eklendi. Bu kullanıcı adı/şifre ile giriş yapabilir.`);
    setFullName(''); setUsername(''); setPassword(''); setEmail(''); setRole('user');
    load();
  };

  const changeRole = async (id, newRole) => {
    const { error: err } = await supabase.from('app_users').update({ role: newRole }).eq('id', id);
    if (err) setError(err.message);
    load();
  };

  const removeUser = async (u) => {
    if (!window.confirm(`${u.full_name || u.username || u.email} kullanıcısının erişimini kaldırmak istediğinize emin misiniz?`)) return;
    const { data, error: fnErr } = await supabase.functions.invoke('manage-users', { body: { action: 'delete_user', user_id: u.id } });
    if (fnErr || data?.error) setError(data?.error || fnErr.message);
    load();
  };

  return (
    <div>
      <div style={styles.title}>Kullanıcı Yönetimi</div>

      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{business?.name || 'İşletmeniz'}</div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 4 }}>
              {activeCount} / {business?.max_users ?? '—'} kullanıcı kullanılıyor
            </div>
          </div>
          <SubscriptionBadge biz={business} />
        </div>
        {atLimit && (
          <div style={{ marginTop: 12, fontSize: 12, color: COLORS.red }}>
            Kullanıcı limitinize ulaştınız. Daha fazla çalışan eklemek için limitinizin artırılması gerekiyor — sistem sahibiyle iletişime geçin.
          </div>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Yeni çalışan ekle</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <div style={styles.field}>
            <span style={styles.label}>Ad Soyad</span>
            <input style={styles.input} placeholder="Ad Soyad" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Rol</span>
            <select style={styles.select} value={role} onChange={(e) => setRole(e.target.value)}>
              {EMPLOYEE_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.toggleRow}>
          <button style={styles.toggleBtn(authType === 'username')} onClick={() => setAuthType('username')}>Kullanıcı adı + şifre</button>
          <button style={styles.toggleBtn(authType === 'email')} onClick={() => setAuthType('email')}>Google e-postası</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {authType === 'username' ? (
            <>
              <div style={styles.field}>
                <span style={styles.label}>Kullanıcı adı</span>
                <input style={styles.input} placeholder="orn: mehmet" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div style={styles.field}>
                <span style={styles.label}>Şifre</span>
                <input style={styles.input} type="text" placeholder="en az 6 karakter" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </>
          ) : (
            <div style={{ ...styles.field, flex: 1 }}>
              <span style={styles.label}>Gmail adresi</span>
              <input style={styles.input} placeholder="ornek@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}
        </div>
        <div style={{ marginTop: 14 }}>
          <button style={styles.btn} onClick={addUser} disabled={saving}>{saving ? 'Ekleniyor...' : 'Ekle'}</button>
        </div>
        {error && <div style={{ color: COLORS.red, fontSize: 12, marginTop: 10 }}>{error}</div>}
        {notice && <div style={{ color: COLORS.green, fontSize: 12, marginTop: 10 }}>{notice}</div>}
      </div>

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Çalışanlar</div>
        {loading ? (
          <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: 12 }}>Yükleniyor...</div>
        ) : users.filter((u) => u.role !== 'owner' && u.role !== 'superadmin').length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: 12 }}>Henüz çalışan eklenmedi.</div>
        ) : (
          users.filter((u) => u.role !== 'owner' && u.role !== 'superadmin').map((u) => (
            <div key={u.id} style={styles.row}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.full_name || u.username || u.email}</div>
                <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 2 }}>
                  {u.username ? `Kullanıcı adı: ${u.username}` : u.email}
                  {!u.active && ' · Pasif'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select style={{ ...styles.select, padding: '6px 8px', fontSize: 12 }} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                  {EMPLOYEE_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <button style={styles.btnDanger} onClick={() => removeUser(u)}>Kaldır</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---------- Süperadmin görünümü: tüm işletmeleri ve üyelikleri yönetir ----------
function SuperadminView() {
  const [businesses, setBusinesses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const [newBizName, setNewBizName] = useState('');
  const [newBizType, setNewBizType] = useState('yillik');
  const [newBizMax, setNewBizMax] = useState(5);
  const [creatingBiz, setCreatingBiz] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: biz, error: bizErr }, { data: us, error: usErr }] = await Promise.all([
      supabase.from('businesses').select('*').order('created_at', { ascending: false }),
      supabase.from('app_users').select('*').order('created_at', { ascending: false }),
    ]);
    if (bizErr) setError(bizErr.message);
    else if (usErr) setError(usErr.message);
    setBusinesses(biz || []);
    setUsers(us || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const draftFor = (biz) => drafts[biz.id] || {
    subscription_type: biz.subscription_type,
    expires_at: biz.expires_at ? biz.expires_at.slice(0, 10) : '',
    max_users: biz.max_users,
    active: biz.active,
  };
  const setDraft = (bizId, patch) => setDrafts((d) => ({ ...d, [bizId]: { ...draftFor(businesses.find((b) => b.id === bizId)), ...d[bizId], ...patch } }));

  const saveBusiness = async (biz) => {
    setError(''); setNotice('');
    const d = draftFor(biz);
    const { data, error: fnErr } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'update_business', business_id: biz.id,
        subscription_type: d.subscription_type,
        expires_at: d.subscription_type === 'yillik' ? (d.expires_at || null) : null,
        max_users: Number(d.max_users) || biz.max_users,
        active: d.active,
      },
    });
    if (fnErr || data?.error) { setError(data?.error || fnErr.message); return; }
    setNotice(`${biz.name} güncellendi.`);
    load();
  };

  const removeUser = async (u) => {
    if (!window.confirm(`${u.full_name || u.username || u.email} kullanıcısını silmek istediğinize emin misiniz?`)) return;
    const { data, error: fnErr } = await supabase.functions.invoke('manage-users', { body: { action: 'delete_user', user_id: u.id } });
    if (fnErr || data?.error) setError(data?.error || fnErr.message);
    load();
  };

  const changeRole = async (id, newRole) => {
    const { error: err } = await supabase.from('app_users').update({ role: newRole }).eq('id', id);
    if (err) setError(err.message);
    load();
  };

  const createBusiness = async () => {
    setError('');
    if (!newBizName.trim()) { setError('İşletme adı girin.'); return; }
    setCreatingBiz(true);
    const { data, error: fnErr } = await supabase.functions.invoke('manage-users', {
      body: { action: 'create_business', name: newBizName.trim(), subscription_type: newBizType, max_users: Number(newBizMax) || 5 },
    });
    setCreatingBiz(false);
    if (fnErr || data?.error) { setError(data?.error || fnErr.message); return; }
    setNotice(`${newBizName} işletmesi oluşturuldu. Şimdi bu işletmeye bir sahip (owner) kullanıcı ekleyin.`);
    setNewBizName(''); setNewBizMax(5);
    load();
  };

  if (loading) return <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: 12 }}>Yükleniyor...</div>;

  return (
    <div>
      <div style={styles.title}>Kullanıcı ve Üyelik Yönetimi</div>
      {error && <div style={{ color: COLORS.red, fontSize: 12, marginBottom: 12 }}>{error}</div>}
      {notice && <div style={{ color: COLORS.green, fontSize: 12, marginBottom: 12 }}>{notice}</div>}

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Yeni işletme oluştur</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={styles.field}>
            <span style={styles.label}>İşletme adı</span>
            <input style={styles.input} value={newBizName} onChange={(e) => setNewBizName(e.target.value)} placeholder="orn: Akhisar Zeytincilik" />
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Üyelik türü</span>
            <select style={styles.select} value={newBizType} onChange={(e) => setNewBizType(e.target.value)}>
              <option value="yillik">Yıllık</option>
              <option value="omurluk">Ömürlük</option>
            </select>
          </div>
          <div style={styles.field}>
            <span style={styles.label}>Kullanıcı limiti</span>
            <input style={{ ...styles.input, minWidth: 80 }} type="number" min={1} value={newBizMax} onChange={(e) => setNewBizMax(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button style={styles.btn} onClick={createBusiness} disabled={creatingBiz}>{creatingBiz ? 'Oluşturuluyor...' : 'İşletme Oluştur'}</button>
        </div>
      </div>

      <div style={styles.sectionTitle}>İşletmeler ({businesses.length})</div>
      {businesses.map((biz) => {
        const d = draftFor(biz);
        const bizUsers = users.filter((u) => u.business_id === biz.id);
        const owner = bizUsers.find((u) => u.role === 'owner');
        const expanded = expandedId === biz.id;
        return (
          <div key={biz.id} style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, cursor: 'pointer' }}
                 onClick={() => setExpandedId(expanded ? null : biz.id)}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{biz.name}</div>
                <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 3 }}>
                  {owner ? (owner.full_name || owner.username || owner.email) : 'Sahip atanmadı'} · {bizUsers.filter((u) => u.active).length}/{biz.max_users} kullanıcı
                </div>
              </div>
              <SubscriptionBadge biz={biz} />
            </div>

            {expanded && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={styles.field}>
                    <span style={styles.label}>Üyelik türü</span>
                    <select style={styles.select} value={d.subscription_type} onChange={(e) => setDraft(biz.id, { subscription_type: e.target.value })}>
                      <option value="yillik">Yıllık</option>
                      <option value="omurluk">Ömürlük</option>
                    </select>
                  </div>
                  {d.subscription_type === 'yillik' && (
                    <div style={styles.field}>
                      <span style={styles.label}>Bitiş tarihi</span>
                      <input style={styles.input} type="date" value={d.expires_at} onChange={(e) => setDraft(biz.id, { expires_at: e.target.value })} />
                    </div>
                  )}
                  <div style={styles.field}>
                    <span style={styles.label}>Kullanıcı limiti</span>
                    <input style={{ ...styles.input, minWidth: 80 }} type="number" min={1} value={d.max_users} onChange={(e) => setDraft(biz.id, { max_users: e.target.value })} />
                  </div>
                  <div style={styles.field}>
                    <span style={styles.label}>Durum</span>
                    <div style={styles.toggleRow}>
                      <button style={styles.toggleBtn(d.active)} onClick={() => setDraft(biz.id, { active: true })}>Aktif</button>
                      <button style={styles.toggleBtn(!d.active)} onClick={() => setDraft(biz.id, { active: false })}>Askıya Al</button>
                    </div>
                  </div>
                </div>
                <button style={styles.btn} onClick={() => saveBusiness(biz)}>Kaydet</button>

                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 8 }}>Kullanıcılar</div>
                  {bizUsers.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: COLORS.inkSoft }}>Henüz kullanıcı yok.</div>
                  ) : (
                    bizUsers.map((u) => (
                      <div key={u.id} style={styles.row}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name || u.username || u.email}</div>
                          <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>
                            {u.username ? `Kullanıcı adı: ${u.username}` : u.email}{!u.active && ' · Pasif'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {u.role === 'superadmin' ? (
                            <span style={styles.badge(COLORS.gold, '#F4E9D2')}>Sistem Sahibi</span>
                          ) : (
                            <>
                              <select style={{ ...styles.select, padding: '6px 8px', fontSize: 12 }} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                                <option value="owner">{ROLE_LABELS.owner}</option>
                                {EMPLOYEE_ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                              </select>
                              <button style={styles.btnDanger} onClick={() => removeUser(u)}>Kaldır</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminPanel() {
  if (currentUser.role === 'superadmin') return <div style={styles.wrap}><SuperadminView /></div>;
  return <div style={styles.wrap}><OwnerView /></div>;
}
