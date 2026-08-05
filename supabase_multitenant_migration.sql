-- Zeytin Defteri - Çoklu işletme (multi-tenant) göçü
-- Bunu SQL Editor'e yapıştırıp "Run" deyin.
-- Bu betik: her Google hesabının kendi izole verisine sahip olmasını,
-- ve iki admin hesabın yeni kullanıcı ekleyip çıkarabilmesini sağlar.

-- 1) Kullanıcı / işletme kayıt tablosu
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'user' check (role in ('admin','user')),
  business_name text,
  created_at timestamptz default now()
);

-- 2) RLS'de sonsuz döngüye girmeden admin/kayıt kontrolü yapan yardımcı fonksiyonlar
create or replace function is_admin(check_email text)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (select 1 from app_users where email = check_email and role = 'admin');
$$;

create or replace function is_registered(check_email text)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (select 1 from app_users where email = check_email);
$$;

-- 3) app_users için RLS
alter table app_users enable row level security;

drop policy if exists "kendi kaydini veya adminse hepsini gorur" on app_users;
create policy "kendi kaydini veya adminse hepsini gorur"
  on app_users for select
  using (email = auth.jwt()->>'email' or is_admin(auth.jwt()->>'email'));

drop policy if exists "sadece adminler kullanici ekler" on app_users;
create policy "sadece adminler kullanici ekler"
  on app_users for insert
  with check (is_admin(auth.jwt()->>'email'));

drop policy if exists "sadece adminler kullanici siler" on app_users;
create policy "sadece adminler kullanici siler"
  on app_users for delete
  using (is_admin(auth.jwt()->>'email'));

drop policy if exists "sadece adminler kullanici gunceller" on app_users;
create policy "sadece adminler kullanici gunceller"
  on app_users for update
  using (is_admin(auth.jwt()->>'email'));

-- 4) İlk iki admini kaydet
insert into app_users (email, role, business_name) values
  ('gavalkadir2@gmail.com', 'admin', 'Yönetici'),
  ('sadeeraytac@gmail.com', 'admin', 'Yönetici')
on conflict (email) do update set role = 'admin';

-- 5) app_data tablosuna "hangi hesaba ait" sütunu ekle
alter table app_data add column if not exists owner_email text;

-- Mevcut (varsa) test verilerini ilk admine ata, böylece kaybolmaz
update app_data set owner_email = 'gavalkadir2@gmail.com' where owner_email is null;

-- Anahtar artık her kullanıcı için ayrı ayrı tekil olmalı (global değil)
alter table app_data drop constraint if exists app_data_pkey;
alter table app_data add primary key (key, owner_email);
alter table app_data alter column owner_email set not null;

-- 6) app_data için eski (tek kiracılı) politikaları kaldırıp yenileriyle değiştir
drop policy if exists "izinli kullanicilar okuyabilir" on app_data;
drop policy if exists "izinli kullanicilar ekleyebilir" on app_data;
drop policy if exists "izinli kullanicilar guncelleyebilir" on app_data;
drop policy if exists "izinli kullanicilar silebilir" on app_data;
drop policy if exists "kayitli kullanicilar kendi verisini okur" on app_data;
drop policy if exists "kayitli kullanicilar kendi verisini yazar" on app_data;
drop policy if exists "kayitli kullanicilar kendi verisini gunceller" on app_data;
drop policy if exists "kayitli kullanicilar kendi verisini siler" on app_data;

create policy "kayitli kullanicilar kendi verisini okur"
  on app_data for select
  using (owner_email = auth.jwt()->>'email' and is_registered(auth.jwt()->>'email'));

create policy "kayitli kullanicilar kendi verisini yazar"
  on app_data for insert
  with check (owner_email = auth.jwt()->>'email' and is_registered(auth.jwt()->>'email'));

create policy "kayitli kullanicilar kendi verisini gunceller"
  on app_data for update
  using (owner_email = auth.jwt()->>'email' and is_registered(auth.jwt()->>'email'));

create policy "kayitli kullanicilar kendi verisini siler"
  on app_data for delete
  using (owner_email = auth.jwt()->>'email' and is_registered(auth.jwt()->>'email'));
