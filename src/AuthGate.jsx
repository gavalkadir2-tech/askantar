import React, { useState, useEffect } from 'react';
import { supabase, ALLOWED_EMAILS } from './supabaseClient.js';

const COLORS = { olive: '#3F4A2E', oliveDark: '#2B331F', gold: '#B3892B', ink: '#2B2A25' };

function CenterScreen({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: COLORS.oliveDark, fontFamily: "'Inter', -apple-system, sans-serif", padding: 20,
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', maxWidth: 380, width: '100%', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = yükleniyor, null = oturum yok

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  const signOut = () => supabase.auth.signOut();

  if (session === undefined) {
    return (
      <CenterScreen>
        <div style={{ color: '#8a8a80', fontSize: 14 }}>Yükleniyor...</div>
      </CenterScreen>
    );
  }

  if (!session) {
    return (
      <CenterScreen>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>
          Zeytin Defteri
        </div>
        <div style={{ fontSize: 13, color: '#8a8a80', marginBottom: 28 }}>Devam etmek için Google hesabınızla giriş yapın</div>
        <button
          onClick={signIn}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 22px',
            borderRadius: 10, border: '1px solid #DCD6C4', background: '#fff', fontSize: 14,
            fontWeight: 600, cursor: 'pointer', color: COLORS.ink,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 6 29.6 4 24 4c-7.4 0-13.8 4.1-17.1 10.1z"/>
            <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4c-2 1.4-4.6 2.3-7.6 2.3-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C10.1 39.8 16.5 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.4C41.4 35.8 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
          </svg>
          Google ile giriş yap
        </button>
      </CenterScreen>
    );
  }

  const email = session.user?.email || '';
  if (!ALLOWED_EMAILS.includes(email)) {
    return (
      <CenterScreen>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}>Yetkiniz yok</div>
        <div style={{ fontSize: 13, color: '#8a8a80', marginBottom: 20 }}>
          <strong>{email}</strong> adresinin bu uygulamaya erişim yetkisi bulunmuyor.
        </div>
        <button
          onClick={signOut}
          style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #DCD6C4', background: '#fff', fontSize: 13, cursor: 'pointer' }}
        >
          Çıkış yap
        </button>
      </CenterScreen>
    );
  }

  return children;
}
