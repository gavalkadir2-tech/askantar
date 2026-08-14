// Bu fonksiyon Supabase'in sunucusunda çalışır — servis anahtarı asla
// tarayıcıya inmez. Kullanıcı ekleme (kullanıcı adı/şifre dahil), kullanıcı
// silme ve işletme üyelik ayarlarını (yıllık/ömürlük, limit) buradan yönetir.
// Deploy: supabase functions deploy manage-users

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const EMPLOYEE_ROLES = ['user', 'muhasebe', 'kantar', 'depo', 'sevkiyat'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';

    // Çağıranın kimliğini doğrula (anon key + kullanıcının kendi jwt'si)
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user?.email) return json({ error: 'Yetkisiz — giriş yapmalısınız.' }, 401);

    // Servis anahtarıyla ayrıcalıklı işlemler için
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: callerRow } = await admin.from('app_users').select('*').eq('email', user.email).maybeSingle();
    if (!callerRow || !callerRow.active || !['owner', 'superadmin'].includes(callerRow.role)) {
      return json({ error: 'Bu işlem için yetkiniz yok.' }, 403);
    }
    const isSuperadmin = callerRow.role === 'superadmin';

    const body = await req.json();
    const action = body?.action;

    // ---------- Yeni çalışan ekle (işletme sahibi kendi işletmesine, ya da superadmin herhangi birine) ----------
    if (action === 'create_user') {
      const targetBusinessId = isSuperadmin && body.business_id ? body.business_id : callerRow.business_id;
      const role = body.role;
      if (!EMPLOYEE_ROLES.includes(role)) return json({ error: 'Geçersiz rol.' }, 400);

      const { data: biz } = await admin.from('businesses').select('*').eq('id', targetBusinessId).maybeSingle();
      if (!biz) return json({ error: 'İşletme bulunamadı.' }, 404);
      if (!biz.active) return json({ error: 'İşletme askıya alınmış, kullanıcı eklenemez.' }, 403);
      if (biz.subscription_type === 'yillik' && biz.expires_at && new Date(biz.expires_at) < new Date()) {
        return json({ error: 'Üyelik süresi dolmuş, kullanıcı eklenemez.' }, 403);
      }
      const { count } = await admin
        .from('app_users')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', targetBusinessId)
        .eq('active', true);
      if ((count || 0) >= biz.max_users) {
        return json({ error: `Kullanıcı limiti doldu (en fazla ${biz.max_users} kişi).` }, 403);
      }

      let authEmail: string;
      let usernameToSave: string | null = null;
      const usePassword = !body.email;

      if (usePassword) {
        const username = (body.username || '').trim().toLowerCase();
        const password = body.password || '';
        if (!username || username.length < 3) return json({ error: 'Kullanıcı adı en az 3 karakter olmalı.' }, 400);
        if (!password || password.length < 6) return json({ error: 'Şifre en az 6 karakter olmalı.' }, 400);
        const { data: existingUsername } = await admin.from('app_users').select('id').ilike('username', username).maybeSingle();
        if (existingUsername) return json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' }, 400);
        authEmail = `${username}@askantar.local`;
        usernameToSave = username;

        const { error: createErr } = await admin.auth.admin.createUser({
          email: authEmail,
          password,
          email_confirm: true,
        });
        if (createErr) return json({ error: createErr.message }, 400);
      } else {
        authEmail = (body.email || '').trim().toLowerCase();
        if (!authEmail.includes('@')) return json({ error: 'Geçerli bir e-posta girin.' }, 400);
      }

      const { error: insertErr } = await admin.from('app_users').insert({
        email: authEmail,
        username: usernameToSave,
        full_name: body.full_name?.trim() || null,
        role,
        business_id: targetBusinessId,
        created_by: user.email,
        active: true,
      });
      if (insertErr) {
        if (usePassword) {
          const { data: list } = await admin.auth.admin.listUsers();
          const match = list?.users?.find((u) => u.email === authEmail);
          if (match) await admin.auth.admin.deleteUser(match.id);
        }
        return json({ error: insertErr.message }, 400);
      }

      return json({ ok: true, email: authEmail, username: usernameToSave });
    }

    // ---------- Kullanıcı sil ----------
    if (action === 'delete_user') {
      const { data: target } = await admin.from('app_users').select('*').eq('id', body.user_id).maybeSingle();
      if (!target) return json({ error: 'Kullanıcı bulunamadı.' }, 404);
      if (!isSuperadmin && target.business_id !== callerRow.business_id) {
        return json({ error: 'Bu kullanıcıyı yönetme yetkiniz yok.' }, 403);
      }
      await admin.from('app_users').delete().eq('id', body.user_id);
      try {
        const { data: list } = await admin.auth.admin.listUsers();
        const match = list?.users?.find((u) => u.email === target.email);
        if (match) await admin.auth.admin.deleteUser(match.id);
      } catch (_e) { /* auth tarafında yoksa sorun değil */ }
      return json({ ok: true });
    }

    // ---------- İşletme üyelik ayarlarını güncelle (sadece superadmin) ----------
    if (action === 'update_business') {
      if (!isSuperadmin) return json({ error: 'Üyelik ayarlarını sadece sistem sahibi değiştirebilir.' }, 403);
      const patch: Record<string, unknown> = {};
      if (body.subscription_type) patch.subscription_type = body.subscription_type;
      if (body.subscription_type === 'omurluk') patch.expires_at = null;
      else if (body.expires_at !== undefined) patch.expires_at = body.expires_at || null;
      if (body.max_users) patch.max_users = body.max_users;
      if (typeof body.active === 'boolean') patch.active = body.active;
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
      const { error } = await admin.from('businesses').update(patch).eq('id', body.business_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // ---------- Yeni işletme oluştur (sadece superadmin) ----------
    if (action === 'create_business') {
      if (!isSuperadmin) return json({ error: 'Yetkisiz.' }, 403);
      const { data: biz, error } = await admin.from('businesses').insert({
        name: body.name?.trim() || 'Yeni İşletme',
        subscription_type: body.subscription_type || 'yillik',
        expires_at: body.subscription_type === 'omurluk' ? null : (body.expires_at || null),
        max_users: body.max_users || 5,
      }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, business: biz });
    }

    return json({ error: 'Bilinmeyen işlem: ' + action }, 400);
  } catch (e) {
    return json({ error: e?.message || 'Sunucu hatası' }, 500);
  }
});
