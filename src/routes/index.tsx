import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ServiceEstimatorPortal } from '@/components/ServiceEstimatorPortal';
import { StudioNav } from '@/components/StudioNav';
import { getBookedSlots, submitBooking } from '@/lib/bookings.functions';
const slotsOptions = queryOptions({queryKey:['booked-slots'],queryFn:() => getBookedSlots(),staleTime:15000,refetchInterval:30000});
export const Route = createFileRoute('/')({
 head:() => ({meta:[{title:'Studio | Production Estimator & Consultation'},{name:'description',content:'Configure your production, get a live BND estimate, and request a consultation in Brunei.'},{property:'og:title',content:'Studio | Production Estimator & Consultation'},{property:'og:description',content:'Photography, brand films, events and social content. Plan your next production.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 loader:({context}) => context.queryClient.ensureQueryData(slotsOptions),
 component:Index,
});
function Index() {
 const {data:slots} = useSuspenseQuery(slotsOptions);
 const submit = useServerFn(submitBooking);
 const cache = useQueryClient();
 return <><StudioNav/><ServiceEstimatorPortal bookedSlots={slots} onSubmitBooking={async data => {try { await submit({data}); } finally { await cache.invalidateQueries({queryKey:['booked-slots']}); } }}/></>;
}
