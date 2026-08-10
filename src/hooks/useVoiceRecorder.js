import { useCallback, useRef, useState } from 'react';

// ---------- Gelişmiş ses kaydı hook'u ----------
// Web Speech API yerine ham mikrofon sesini yakalar (MediaRecorder) ve bunu
// Groq Whisper'a gönderilmek üzere bir Blob olarak döner. Bunun getirdikleri:
//  - Masaüstü Chrome/Edge sınırlaması ortadan kalkar; mobil Safari/Chrome
//    dahil MediaRecorder + getUserMedia destekleyen her tarayıcıda çalışır.
//  - Konuşma bitince otomatik durur (basit enerji tabanlı VAD): kullanıcı
//    tekrar butona basmadan, bir sessizlik süresinden sonra kayıt kendiliğinden
//    kapanıp gönderilir ("hands-free").
//  - Anlık ses seviyesi (0..1) dışarı bildirilir, böylece arayüzde canlı bir
//    "konuşuyor" göstergesi (nabız/dalga) çizilebilir.
export function useVoiceRecorder({
  onLevel,           // (level: number 0..1) => void — throttled canlı seviye
  onAutoStop,        // (reason: 'silence' | 'max') => void — otomatik durduğunda
  silenceMs = 1400,   // bu kadar süre sessizlik olursa otomatik durdur
  minRecordMs = 600,  // VAD'ın devreye girmesi için gereken minimum kayıt süresi
  maxRecordMs = 25000, // güvenlik için üst sınır
  silenceThreshold = 0.055,
  levelEmitMs = 60,
} = {}) {
  const [recording, setRecording] = useState(false);
  const [supported] = useState(() => (
    typeof navigator !== 'undefined' && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia
    && typeof window !== 'undefined' && !!window.MediaRecorder
  ));

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const silenceStartRef = useRef(null);
  const recordStartRef = useRef(null);
  const lastLevelEmitRef = useRef(0);
  const autoStopFiredRef = useRef(false);
  const onAutoStopRef = useRef(onAutoStop);
  onAutoStopRef.current = onAutoStop;
  const onLevelRef = useRef(onLevel);
  onLevelRef.current = onLevel;

  const stopLevelLoop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const runLevelLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length / 255; // 0..1 normalize
      const now = performance.now();

      if (now - lastLevelEmitRef.current > levelEmitMs) {
        lastLevelEmitRef.current = now;
        onLevelRef.current && onLevelRef.current(Math.min(1, avg * 3.2));
      }

      const elapsed = now - (recordStartRef.current || now);
      if (!autoStopFiredRef.current) {
        if (elapsed > maxRecordMs) {
          autoStopFiredRef.current = true;
          onAutoStopRef.current && onAutoStopRef.current('max');
        } else if (elapsed > minRecordMs) {
          if (avg < silenceThreshold) {
            if (silenceStartRef.current == null) silenceStartRef.current = now;
            else if (now - silenceStartRef.current > silenceMs) {
              autoStopFiredRef.current = true;
              onAutoStopRef.current && onAutoStopRef.current('silence');
            }
          } else {
            silenceStartRef.current = null;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [levelEmitMs, maxRecordMs, minRecordMs, silenceMs, silenceThreshold]);

  const pickMimeType = () => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return candidates.find((t) => window.MediaRecorder && window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t)) || '';
  };

  const cleanupStream = () => {
    stopLevelLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  const start = useCallback(async () => {
    if (!supported) throw new Error('unsupported');
    chunksRef.current = [];
    silenceStartRef.current = null;
    autoStopFiredRef.current = false;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    streamRef.current = stream;

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      recordStartRef.current = performance.now();
      runLevelLoop();
    } catch (e) { /* seviye göstergesi olmadan da kayıt çalışır */ }

    const mimeType = pickMimeType();
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    mediaRecorderRef.current = mr;
    mr.start();
    setRecording(true);
  }, [runLevelLoop, supported]);

  const stop = useCallback(() => new Promise((resolve) => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') {
      cleanupStream();
      setRecording(false);
      resolve(null);
      return;
    }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
      chunksRef.current = [];
      cleanupStream();
      setRecording(false);
      resolve(blob.size > 0 ? blob : null);
    };
    mr.stop();
  }), []);

  const cancel = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = null;
      try { mr.stop(); } catch (e) {}
    }
    chunksRef.current = [];
    cleanupStream();
    setRecording(false);
  }, []);

  return { recording, supported, start, stop, cancel };
}
