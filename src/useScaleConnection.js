import { useCallback, useRef, useState } from 'react';

// Web Serial uzerinden kantara baglanip surekli kilo okuyan paylasilabilir hook.
// ScaleWidget (Kantarli Alis / Kantarli Satis sekmeleri) ve Sesli Asistan
// birbirinden BAGIMSIZ birer baglanti acar (Web Serial ayni anda tek portu
// tek "reader" ile okutur, bu yuzden iki ayri navigator.serial.requestPort()
// cagrisi -> kullanici her ikisine de kendi tarayici izin dialogundan
// baglanmasi gerekir). Ortak mantigi burada tutmak, ayni davranisi/format
// cozumlemesini tekrar yazmamizi onler.
export function useScaleConnection() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Bağlı değil');
  const [lastValue, setLastValue] = useState(null);
  const [rawLine, setRawLine] = useState('');
  const [baud, setBaud] = useState(9600);
  const [serialSupported] = useState(() => typeof navigator !== 'undefined' && 'serial' in navigator);
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const keepReadingRef = useRef(false);
  const bufferRef = useRef('');

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
      if (num !== null) setLastValue(num);
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
      if (keepReadingRef.current) {
        keepReadingRef.current = false;
        setConnected(false);
        setStatus('Bağlantı koptu — kabloyu/cihazı kontrol edin');
        setLastValue(null);
      }
    }
  }, [handleIncoming]);

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
    setConnected(false);
    setStatus('Bağlı değil');
    setLastValue(null);
  }, []);

  return { connected, status, lastValue, rawLine, baud, setBaud, serialSupported, connect, disconnect };
}
