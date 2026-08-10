import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import AuthGate from './AuthGate.jsx';

// Sentry DSN'ini kendi Sentry projenden al: https://sentry.io -> Settings -> Projects -> Client Keys (DSN)
// Ortam degiskeni olarak .env dosyana VITE_SENTRY_DSN=... seklinde eklemen tavsiye edilir.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Performans izleme orani dusuk tutuldu; sadece hata izleme oncelikli.
    tracesSampleRate: 0.1,
    // Cok kiracili yapida hesap/musteri hassas verilerinin (IBAN, TC no, telefon)
    // yanlislikla gonderilmemesi icin varsayilan istek/yanit govdesi gonderimi kapali.
    sendDefaultPii: false,
  });
}

function ErrorFallback() {
  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>Beklenmeyen bir hata oluştu</h2>
      <p style={{ color: '#666' }}>Hata otomatik olarak bildirildi. Sayfayı yenileyerek devam edebilirsiniz.</p>
      <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '8px 16px' }}>
        Sayfayı yenile
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <AuthGate>
        <App />
      </AuthGate>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
