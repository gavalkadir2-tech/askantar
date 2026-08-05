// Bu modül, uygulamanın internetsizken de çalışabilmesini sağlar:
// - Her okuma/yazma önce tarayıcının kendi localStorage'ına (anında, çevrimdışı çalışır) uygulanır
// - Supabase'e yazma başarısız olursa (bağlantı yok), değişiklik bir "bekleyen kuyruğa" eklenir
// - Bağlantı geri geldiğinde kuyruk otomatik olarak Supabase'e gönderilir

const CACHE_PREFIX = 'zk_cache_';
const QUEUE_KEY = 'zk_sync_queue';

function cacheKey(email, key) {
  return `${CACHE_PREFIX}${email}__${key}`;
}

export function offlineGet(email, key) {
  try {
    const raw = window.localStorage.getItem(cacheKey(email, key));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function offlineSet(email, key, value) {
  try {
    window.localStorage.setItem(cacheKey(email, key), JSON.stringify(value));
  } catch (e) {
    console.error('Yerel depolama hatasi:', e);
  }
}

function getQueue() {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function setQueue(q) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch (e) {
    console.error('Kuyruk yazma hatasi:', e);
  }
}

export function queuePendingWrite(email, key, value) {
  const q = getQueue();
  const idx = q.findIndex((item) => item.email === email && item.key === key);
  const entry = { email, key, value, queuedAt: Date.now() };
  if (idx >= 0) q[idx] = entry; else q.push(entry);
  setQueue(q);
}

export function getPendingCount(email) {
  return getQueue().filter((item) => item.email === email).length;
}

export async function flushQueue(supabase, email) {
  const q = getQueue();
  const mine = q.filter((item) => item.email === email);
  const others = q.filter((item) => item.email !== email);
  if (mine.length === 0) return { synced: 0, failed: 0 };

  const stillPending = [];
  let synced = 0;
  for (const item of mine) {
    try {
      const { error } = await supabase.from('app_data').upsert({
        key: item.key,
        value: item.value,
        owner_email: item.email,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      synced++;
    } catch (e) {
      stillPending.push(item);
    }
  }
  setQueue([...others, ...stillPending]);
  return { synced, failed: stillPending.length };
}
