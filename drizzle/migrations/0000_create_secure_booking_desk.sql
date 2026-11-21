CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_role_read ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
CREATE TABLE public.bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reference_id text UNIQUE NOT NULL,
 service_id text NOT NULL, service_name text NOT NULL, duration_label text NOT NULL,
 location_count integer NOT NULL CHECK (location_count BETWEEN 1 AND 10),
 outside_brunei_muara boolean NOT NULL DEFAULT false, selected_addons text[] NOT NULL DEFAULT '{}',
 estimated_min_bnd numeric NOT NULL CHECK (estimated_min_bnd >= 0), estimated_max_bnd numeric NOT NULL CHECK (estimated_max_bnd >= estimated_min_bnd),
 booking_date text NOT NULL CHECK (booking_date ~ '^\d{4}-\d{2}-\d{2}$'), booking_time text NOT NULL CHECK (booking_time IN ('10:00 AM','11:30 AM','02:00 PM','03:30 PM','05:00 PM','08:00 PM')),
 client_name text NOT NULL, company_name text, whatsapp_number text NOT NULL, email text NOT NULL, project_brief text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY submit_pending_booking ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending');
CREATE POLICY admin_booking_read ON public.bookings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY admin_booking_update ON public.bookings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY admin_booking_delete ON public.bookings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX booking_active_slot ON public.bookings(booking_date, booking_time) WHERE status != 'cancelled';
CREATE FUNCTION public.get_booked_slots() RETURNS TABLE(booking_date text, booking_time text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT DISTINCT b.booking_date, b.booking_time FROM public.bookings b WHERE b.status != 'cancelled' AND b.booking_date >= to_char(now() AT TIME ZONE 'Asia/Brunei', 'YYYY-MM-DD') $$;
REVOKE ALL ON FUNCTION public.get_booked_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_slots() TO anon, authenticated;