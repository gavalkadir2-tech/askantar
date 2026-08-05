import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';

const COLORS = { olive: '#3F4A2E', gold: '#B3892B', ink: '#2B2A25', inkSoft: '#6B6A60', border: '#DCD6C4', paper: '#F4F2EC', red: '#A13D2E', blue: '#3B5E73' };

export const ROLE_LABELS = {
  admin: 'Yönetici',
  user: 'Tam Yetkili Kullanıcı',
  muhasebe: 'Muhasebe',
  kantar: 'Kantar Operatörü',
  depo: 'Depo Sorumlusu',
  sevkiyat: 'Sevkiyat Sorumlusu',
};

const ROLE_OPTIONS = ['user', 'muhasebe', 'kantar', 'depo', 'sevkiyat'];

export default function AdminPanel({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error: err } = await supabase.from('app_users').select('*').order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addUser = async () => {
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) { setError('Geçerli bir e-posta girin.'); return; }
    const { error: err } = await supabase.from('app_users').insert({ email: trimmed, role, business_name: businessName.trim() || null });
    if (err) { setError(err.message); return; }
    setEmail(''); setBusinessName(''); setRole('user');
    load();
  };

  const changeRole = async (id, newRole) => {
    const { error: err } = await supabase.from('app_users').update({ role: newRole }).eq('id', id);
    if (err) setError(err.message);
    load();
  };

  const removeUser = async (id, userEmail) => {
    if (!window.confirm(`${userEmail} adresinin erişimini kaldırmak istediğinize emin misiniz? Bu hesabın verileri veritabanında kalır ama artık giriş yapamaz.`)) return;
    const { error: err } = await supabase.from('app_users').delete().eq('id', id);
    if (err) setError(err.message);
    load();
  };

  const styles = {
    page: { minHeight: '100vh', background: COLORS.paper, fontFamily: "'Inter', -apple-system, sans-serif", padding: '32px 20px' },
    wrap: { maxWidth: 760, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 600, color: COLORS.ink },
    card: { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 16 },
    input: { padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: 'inherit', flex: 1, minWidth: 160 },
    select: { padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: 'inherit', background: '#fff' },
    btn: { padding: '10px 16px', borderRadius: 8, border: 'none', background: COLORS.olive, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
    btnSecondary: { padding: '8px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid #EFEBDD`, flexWrap: 'wrap', gap: 8 },
    badge: (isAdmin) => ({
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: isAdmin ? '#F4E9D2' : '#E1EAEE', color: isAdmin ? COLORS.gold : COLORS.blue,
    }),
  };

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div style={styles.title}>Kullanıcı Yönetimi</div>
          <button style={styles.btnSecondary} onClick={onBack}>← Uygulamaya dön</button>
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Yeni kullanıcı ekle</div>
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 12 }}>
            Eklediğiniz Google hesabı kendi verileriyle (kendi çiftçileri, alımları, araçları vb.) bağımsız bir işletme olarak sisteme girer — sizin verilerinizi görmez. Rol, o kişinin hangi sekmeleri göreceğini belirler.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input style={styles.input} placeholder="ornek@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input style={styles.input} placeholder="İşletme adı (opsiyonel)" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <select style={styles.select} value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button style={styles.btn} onClick={addUser}>Ekle</button>
          </div>
          {error && <div style={{ color: COLORS.red, fontSize: 12, marginTop: 8 }}>{error}</div>}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Kayıtlı kullanıcılar</div>
          {loading ? (
            <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: 12 }}>Yükleniyor...</div>
          ) : users.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: 12 }}>Henüz kullanıcı yok.</div>
          ) : (
            users.map((u) => (
              <div key={u.id} style={styles.row}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.email}</div>
                  <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 2 }}>
                    {u.business_name || 'İşletme adı belirtilmedi'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {u.role === 'admin' ? (
                    <span style={styles.badge(true)}>Yönetici</span>
                  ) : (
                    <>
                      <select style={{ ...styles.select, padding: '6px 8px', fontSize: 12 }} value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                        {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <button style={{ ...styles.btnSecondary, padding: '6px 10px', fontSize: 12 }} onClick={() => removeUser(u.id, u.email)}>
                        Kaldır
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
