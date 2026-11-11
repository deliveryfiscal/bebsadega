create table public.manager_pin_settings (
  id smallint primary key default 1 check (id = 1),
  pin_hash text not null check (length(pin_hash) = 128),
  salt text not null check (length(salt) = 64),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id)
);
alter table public.manager_pin_settings enable row level security;
revoke all on public.manager_pin_settings from anon, authenticated;
grant select, insert, update on public.manager_pin_settings to service_role;
comment on table public.manager_pin_settings is 'PIN gerencial protegido por scrypt; acesso exclusivo pelo servidor. MANAGER_PIN é usado somente antes da primeira troca.';
