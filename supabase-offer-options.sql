alter table public.offers
  add column if not exists sizes text[] not null default '{}',
  add column if not exists colors text[] not null default '{}';

notify pgrst, 'reload schema';
