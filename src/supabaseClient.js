import { createClient } from '@supabase/supabase-js';

// Aşağıdaki iki değeri kendi Supabase projenizden alıp buraya yapıştırın.
// Project Settings -> API sayfasında bulunurlar.
// "anon public" anahtarı tarayıcı tarafında kullanılmak üzere tasarlanmıştır,
// gizli tutmanıza gerek yok (gerçek güvenlik veritabanındaki RLS kurallarından gelir).
const SUPABASE_URL = 'https://fqeevhufclpueruljfin.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pbJwgjZnjsOubgWLGuGhaA_N1ZjXmTD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Not: Yetkili kullanıcı listesi artık burada değil, Supabase'deki
// "app_users" tablosunda tutuluyor. Yeni kullanıcı eklemek/çıkarmak için
// uygulama içindeki "Kullanıcı Yönetimi" panelini (sadece adminler görür) kullanın.
