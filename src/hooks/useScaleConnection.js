import { useCallback, useEffect, useRef, useState } from 'react';

// Web Serial uzerinden kantara baglanip surekli kilo okuyan paylasilabilir hook.
// ScaleWidget (Kantarli Alis / Kantarli Satis sekmeleri) ve Sesli Asistan
// birbirinden BAGIMSIZ birer baglanti acar (Web Serial ayni anda tek portu
// tek "reader" ile okutur, bu yuzden iki ayri navigator.serial.requestPort()
// cagrisi -> kullanici her ikisine de kendi tarayici izin dialogundan
// baglanmasi gerekir). Ortak mantigi burada tutmak, ayni davranisi/format
// cozumlemesini tekrar yazmamizi onler.
const DATA_TIMEOUT_MS = 6000; // Bu süre boyunca yeni satır gelmezse "veri gelmiyor" uyarısı gösterilir.
const RECONNECT_ATTEMPTS = 5;

export function useScaleConnection() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Bağlı değil');
  const [lastValue, setLastValue] = useState(null);
  const [rawLine, setRawLine] = useState('');
  const [baud, setBaud] = useState(9600);
  const [dataStale, setDataStale] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [serialSupported] = useState(() => typeof navigator !== 'undefined' && 'serial' in navigator);
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const bufferRef = useRef('');
  const lastReadingAtRef = useRef(0);

  const extractNumber = (line) => {
    const m = line.match(/-?\d+[.,]?\d*/);
    if (!m) return null;
    return parseFloat(m[0].replace(',', '.'));
  };

  const handleIncoming = useCallback((chunk) => {
    bufferRef.current += chunk;
    let idx;
    while ((idx = bufferRef.current.search(/[\r\n]/)) >= 0) {
      const line = bufferRef.current.slice(0, idx).trim();
      bufferRef.current = bufferRef.current.slice(idx + 1);
      if (!line) continue;
      setRawLine(line);
      const num = extractNumber(line);
      if (num !== null) {
        lastReadingAtRef.current = Date.now();
        setDataStale(false);
        setLastValue(num);
      }
    }
  }, []);

  const readLoop = useCallback(async (port) => {
    const decoder = new TextDecoderStream();
    const closed = port.readable.pipeTo(decoder.writable);
    const reader = decoder.readable.getReader();
    readerRef.current = reader;
    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) handleIncoming(value);
      }
    } catch (e) {
      console.error(e);
    } finally {
      reader.releaseLock();
      await closed.catch(() => {});
      // Beklenmedik kopma (kullanicinin "Kes" butonuyla degil): once otomatik
      // yeniden baglanmayi dene, olmazsa kullaniciyi acikca uyar.
      if (keepReadingRef.current) {
        setConnected(false);
        setLastValue(null);
        await attemptAutoReconnect();
      }
    }
  }, [handleIncoming]);

  const attemptAutoReconnect = useCallback(async () => {
    if (!portRef.current) {
      keepReadingRef.current = false;
      setStatus('Bağlantı koptu — kabloyu/cihazı kontrol edin');
      return;
    }
    setReconnecting(true);
    for (let attempt = 1; attempt <= RECONNECT_ATTEMPTS; attempt++) {
      setStatus(`Bağlantı koptu, yeniden bağlanılıyor... (${attempt}/${RECONNECT_ATTEMPTS})`);
      await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 4000)));
      if (!keepReadingRef.current) break;
      try {
        await portRef.current.open({ baudRate: baud });
        setConnected(true);
        setStatus('Bağlı (yeniden bağlanıldı)');
        setReconnecting(false);
        readLoop(portRef.current);
        return;
      } catch (e) {
        // tekrar dene
      }
    }
    keepReadingRef.current = false;
    setReconnecting(false);
    setStatus('Bağlantı koptu — kabloyu/cihazı kontrol edin');
  }, [baud, readLoop]);

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setStatus('Desteklenmiyor');
      return false;
    }
    try {
      setStatus('Bağlanıyor...');
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: baud });
      portRef.current = port;
      setConnected(true);
      setStatus('Bağlı');
      setDataStale(false);
      lastReadingAtRef.current = Date.now();
      keepReadingRef.current = true;
      readLoop(port);
      return true;
    } catch (e) {
      setStatus('Bağlanamadı');
      return false;
    }
  }, [baud, readLoop]);

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;
    try {
      if (readerRef.current) await readerRef.current.cancel();
      if (portRef.current) await portRef.current.close();
    } catch (e) {}
    portRef.current = null;
    setConnected(false);
    setReconnecting(false);
    setStatus('Bağlı değil');
    setLastValue(null);
    setDataStale(false);
  }, []);

  // Baglanti acikken belirli bir sure yeni satir gelmezse uyar.
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => {
      if (Date.now() - lastReadingAtRef.current > DATA_TIMEOUT_MS) setDataStale(true);
    }, 1000);
    return () => clearInterval(t);
  }, [connected]);

  return { connected, status, lastValue, rawLine, baud, setBaud, serialSupported, dataStale, reconnecting, connect, disconnect };
}
