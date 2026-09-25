import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Büyük kütüphaneler ayrı dosyalara ayrılır: uygulama kodu değiştiğinde
// tarayıcı bunları önbellekten kullanmaya devam eder.
const VENDOR_CHUNKS = {
  'vendor-react': ['react', 'react-dom', 'scheduler'],
  'vendor-supabase': ['@supabase'],
  'vendor-sentry': ['@sentry'],
  'vendor-charts': ['recharts', 'd3-', 'victory-vendor'],
  'vendor-xlsx': ['xlsx'],
  'vendor-icons': ['lucide-react'],
};

// '@supabase' tüm kapsamı, 'd3-' ile başlayan tüm paketleri, diğerleri tam adı eşler.
const matchesPackage = (pkg, name) =>
  name.endsWith('-') ? pkg.startsWith(name)
    : name.startsWith('@') && !name.includes('/') ? pkg.startsWith(`${name}/`)
      : pkg === name;

// base: './' -> GitHub Pages'te hangi repo adı altında yayınlanırsa yayınlansın
// dosya yolları göreli kalır, ekstra ayar gerekmez.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          const path = id.split('node_modules/').pop();
          const parts = path.split('/');
          const pkg = path.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
          for (const [chunk, names] of Object.entries(VENDOR_CHUNKS)) {
            if (names.some((n) => matchesPackage(pkg, n))) return chunk;
          }
        },
      },
    },
  },
});
