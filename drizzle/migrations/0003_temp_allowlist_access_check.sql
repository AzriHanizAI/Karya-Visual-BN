create or replace function public.is_admin_email(_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from (values ('deadly8803494@gmail.com'), ('owner-access-check@example.com')) as allowed(email)
    where lower(btrim(allowed.email)) = lower(btrim(coalesce(_email, '')))
  );
$$;