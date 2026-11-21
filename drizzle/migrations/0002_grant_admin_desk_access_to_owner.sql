create or replace function public.is_admin_email(_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from (values ('deadly8803494@gmail.com')) as allowed(email)
    where lower(btrim(allowed.email)) = lower(btrim(coalesce(_email, '')))
  );
$$;

create or replace function public.grant_admin_for_allowed_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin_email(new.email) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

grant execute on function public.is_admin_email(text) to authenticated, anon, service_role;
grant execute on function public.grant_admin_for_allowed_emails() to service_role;

drop trigger if exists grant_admin_for_allowed_emails on auth.users;

create trigger grant_admin_for_allowed_emails
  after insert on auth.users
  for each row execute function public.grant_admin_for_allowed_emails();