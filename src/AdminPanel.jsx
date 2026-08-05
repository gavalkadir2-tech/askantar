import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient.js';

const COLORS = { olive: '#3F4A2E', gold: '#B3892B', ink: '#2B2A25', inkSoft: '#6B6A60', border: '#DCD6C4', paper: '#F4F2EC', red: '#A13D2E' };

export default function AdminPanel({ onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
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
    const { error: err } = await supabase.from('app_users').insert({ email: trimmed, role: 'user', business_name: businessName.trim() || null });
    if (err) { setError(err.message); return; }
    setEmail(''); setBusinessName('');
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
    wrap: { maxWidth: 720, margin: '0 auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 600, color: COLORS.ink },
    card: { background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 20, marginBottom: 16 },
    input: { padding: '10px 12px', borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: 'inherit', flex: 1, minWidth: 160 },
    btn: { padding: '10px 16px', borderRadius: 8, border: 'none', background: COLORS.olive, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
    btnSecondary: { padding: '8px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: '#fff', color: COLORS.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid #EFEBDD` },
    badge: (role) => ({
      fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: role === 'admin' ? '#F4E9D2' : '#E7EBDC', color: role === 'admin' ? COLORS.gold : COLORS.olive,
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
            Eklediğiniz Google hesabı kendi verileriyle (kendi çiftçileri, alımları, araçları vb.) bağımsız bir işletme olarak sisteme girer — sizin verilerinizi görmez.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input style={styles.input} placeholder="ornek@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input style={styles.input} placeholder="İşletme adı (opsiyonel)" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
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
                  <span style={styles.badge(u.role)}>{u.role === 'admin' ? 'Yönetici' : 'Kullanıcı'}</span>
                  {u.role !== 'admin' && (
                    <button style={{ ...styles.btnSecondary, padding: '6px 10px', fontSize: 12 }} onClick={() => removeUser(u.id, u.email)}>
                      Kaldır
                    </button>
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
