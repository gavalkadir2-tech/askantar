import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' -> GitHub Pages'te hangi repo adı altında yayınlanırsa yayınlansın
// dosya yolları göreli kalır, ekstra ayar gerekmez.
export default defineConfig({
  plugins: [react()],
  base: './',
});
