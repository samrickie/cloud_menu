import {z} from 'zod';
import type {Row} from './store.ts';
export const venueFiltersSchema=z.object({
 search:z.string().trim().max(120).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),size:z.coerce.number().int().min(1).max(50).default(25),
 access:z.enum(['UNMANAGED','TRIAL','ACTIVE','EXPIRED','REVOKED','SUSPENDED','CLOSED']).optional(),
 model:z.enum(['MONTHLY','SALES_BASED','NONE']).optional(),sample:z.enum(['yes','no']).optional(),
 registered_from:z.iso.date().optional(),registered_to:z.iso.date().optional(),
 expiry_days:z.coerce.number().int().min(1).max(366).optional(),activity:z.enum(['orders','none']).optional(),
 sort:z.enum(['newest','oldest','name','orders']).optional()
}).strict().refine(q=>!q.registered_from||!q.registered_to||q.registered_from<=q.registered_to);
export type VenueFilters=Partial<z.infer<typeof venueFiltersSchema>>;
export function matchesVenueFilters(v:Row,f:VenueFilters){
 const end=v.subscription_state==='TRIAL'?v.trial_ends_at:v.model==='MONTHLY'?v.paid_until:null;
 return (!f.access||v.subscription_state===f.access)&&(!f.model||(v.model??'NONE')===f.model)
 &&(!f.sample||v.is_sample===(f.sample==='yes'))
 &&(!f.registered_from||Date.parse(v.created_at)>=Date.parse(f.registered_from))
 &&(!f.registered_to||Date.parse(v.created_at)<Date.parse(f.registered_to)+86400000)
 &&(!f.expiry_days||['TRIAL','ACTIVE'].includes(v.subscription_state)&&end&&Date.parse(end)>=Date.now()&&Date.parse(end)<=Date.now()+f.expiry_days*86400000)
 &&(!f.activity||(f.activity==='orders'?v.orders>0:v.orders===0));
}
