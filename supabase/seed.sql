-- Beb's Gestão - empresa base.
-- Execute 001_initial_schema.sql e depois 002_client_catalog.sql.
-- O catálogo real da Beb's é inserido pela migration 002_client_catalog.sql.
insert into public.companies(name, phone)
select 'Beb''s Adega e Tabacaria', '(11) 97527-0632'
where not exists (select 1 from public.companies where name = 'Beb''s Adega e Tabacaria');

-- Depois, cadastre o usuário no Supabase Auth e vincule-o em public.profiles.
