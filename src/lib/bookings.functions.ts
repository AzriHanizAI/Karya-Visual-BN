import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import { calculateEstimate, STUDIO_CONFIG, BOOKING_STATUSES } from './studio';

function publicClient() {
 const url = process.env['SUPABASE_URL'];
 const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
 if (!url || !key) throw new Error('Booking service is unavailable.');
 return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input,init) => {
  const headers = new Headers(init?.headers);
  if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
  headers.set('apikey',key);
  return fetch(input,{...init,headers});
 } } });
}
export const getBookedSlots = createServerFn({method:'GET'}).handler(async () => {
 const { data,error } = await publicClient().rpc('get_booked_slots');
 if (error) throw new Error('Could not load appointment availability. Please try again.');
 return data.map(row => ({date:row.booking_date,time:row.booking_time}));
});
const submissionSchema = z.object({
 referenceId: z.string().regex(/^BRN-[A-F0-9]{8}$/), serviceId:z.string(), serviceName:z.string(), durationLabel:z.string(),
 locationCount:z.number().int().min(1).max(10), outsideBruneiMuara:z.boolean(), selectedAddons:z.array(z.string()).max(4),
 estimatedMinBnd:z.number().nonnegative(), estimatedMaxBnd:z.number().nonnegative(), bookingDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 bookingTime:z.string(), clientName:z.string().trim().min(2).max(200), companyName:z.string().max(200),
 whatsappNumber:z.string().regex(/^\+673\d{7}$/), email:z.string().email().max(254), projectBrief:z.string().max(10000),
});
export const submitBooking = createServerFn({method:'POST'}).inputValidator(submissionSchema).handler(async ({data}) => {
 const service = STUDIO_CONFIG.services.find(s => s.id === data.serviceId);
 const slot = STUDIO_CONFIG.timeSlots.find(s => s.label === data.bookingTime);
 if (!service || !slot) throw new Error('Invalid service or appointment.');
 const estimate = calculateEstimate(data.serviceId,data.durationLabel,data.locationCount,data.outsideBruneiMuara,data.selectedAddons);
 if (estimate.min !== data.estimatedMinBnd || estimate.max !== data.estimatedMaxBnd) throw new Error('Your estimate changed. Please start a new estimate.');
 const appointment = new Date(`${data.bookingDate}T${slot.value}:00+08:00`);
 if (!Number.isFinite(appointment.getTime()) || appointment <= new Date() || new Date(`${data.bookingDate}T12:00:00+08:00`).getUTCDay() === 0) throw new Error('Choose a future appointment from Monday to Saturday.');
 const {error} = await publicClient().from('bookings').insert({
 reference_id:data.referenceId,service_id:service.id,service_name:service.name,duration_label:data.durationLabel,location_count:data.locationCount,
 outside_brunei_muara:data.outsideBruneiMuara,selected_addons:data.selectedAddons,estimated_min_bnd:estimate.min,estimated_max_bnd:estimate.max,
 booking_date:data.bookingDate,booking_time:data.bookingTime,client_name:data.clientName,company_name:data.companyName,
 whatsapp_number:data.whatsappNumber,email:data.email,project_brief:data.projectBrief,status:'pending',
 });
 if (error) throw new Error(error.code === '23505' ? 'This slot was just taken. Please choose another time.' : 'Your booking could not be saved. Please try again.');
 return {referenceId:data.referenceId};
});
export const listBookings = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 const {data:admin,error:roleError} = await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if (roleError || !admin) throw new Error('Your account does not have Admin Desk access.');
 const rows: Database['public']['Tables']['bookings']['Row'][] = [];
 for (let from=0;;from+=1000) {
  const {data,error} = await context.supabase.from('bookings').select('*').order('created_at',{ascending:false}).range(from,from+999);
  if (error) throw new Error('Could not load bookings.');
  rows.push(...data);
  if (data.length < 1000) break;
 }
 return rows;
});
export const updateBookingStatus = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),status:z.enum(BOOKING_STATUSES)})).handler(async ({data,context}) => {
 const {data:admin} = await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
 if (!admin) throw new Error('Admin access required.');
 const {data:row,error} = await context.supabase.from('bookings').update({status:data.status}).eq('id',data.id).select('id,status').single();
 if (error) throw new Error(error.code === '23505' ? 'Another booking already holds this slot.' : 'Could not update this booking.');
 return row;
});
