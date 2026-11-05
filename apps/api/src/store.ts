import type {VenueFilters} from './venue-filters.ts';
import pg from 'pg';
import type {ReportWindow} from './dashboard.ts';
export const tables = ['venues','dining_tables','table_sessions','session_participants','menus','categories','items','modifier_groups','modifiers','item_modifier_groups','orders','order_items','order_item_modifiers','idempotency_keys','realtime_events','staff_users','audit_log','owner_accounts','venue_profiles','waiter_calls','bills','bill_splits','bill_shares','bill_share_items','payment_transactions','owner_identities','oauth_flows','inventory_movements','menu_images','subscriptions','platform_admins','platform_settings','venue_access','subscription_actions','service_feedback','venue_halls','venue_billing_overrides','venue_billing_periods','staff_notification_reads'] as const;
export type Table = typeof tables[number];
export type Row = Record<string,any>;
export interface Store {
 staffNotifications(venue:string,role:string,after:number,through:number):Promise<{events:Row[];unread:number}>;
 subscriptionSales(venue:string,basis:string,start:string,end:string):Promise<number>;
 venueAccess(venue:string):Promise<boolean>;
 expiredVenueAccess(limit:number):Promise<Row[]>;
 platformOverview(start:string|null):Promise<Row>;
 platformVenues(search:string,page:number,size:number,filters?:VenueFilters):Promise<Row>;
 venueAudit(venue:string,limit:number):Promise<Row[]>;
 recentOrders(venue:string,station?:string,status?:string,from?:string,until?:string,page?:number,itemStatus?:string):Promise<Row[]>;
 dashboard(venue:string,window:ReportWindow):Promise<Row>;
 imageStorageBytes(venue:string):Promise<number>;
 expiredSplits(limit:number):Promise<Row[]>;
 lockSplit(venue:string,session:string,id:string):Promise<Row|undefined>;
 allocations(venue:string,session:string,split:string):Promise<Row[]>;
 paidAllocations(venue:string,session:string):Promise<Row[]>;
 events(venue:string,after:number,limit:number,session?:string):Promise<Row[]>;
 eventHead(venue:string):Promise<number>;
 rows(table:Table,where:Row):Promise<Row[]>;
 add(table:Table,row:Row):Promise<Row>;
 patch(table:Table,where:Row,change:Row):Promise<void>;
 remove(table:'item_modifier_groups'|'bill_share_items',where:Row):Promise<void>;
 tx<T>(lock:string,work:(tx:Store)=>Promise<T>):Promise<T>;
}
const ident=(s:string)=>{if(!/^[a-z_]+$/.test(s))throw new Error('Invalid SQL identifier');return `"${s}"`;};
export function normalizeRow(row:Row):Row{return Object.fromEntries(Object.entries(row).map(([k,v])=>{
 if((k.endsWith('_tzs')||k==='seq'||k==='token_issued_at')&&v!==null&&v!==undefined){const n=Number(v);if(!Number.isSafeInteger(n))throw new Error('Unsafe database integer: '+k);return [k,n];}
 if(k==='business_date'&&v instanceof Date)return [k,v.toISOString().slice(0,10)];return [k,v];
}));}
export class PostgresStore implements Store {
 constructor(private pool:pg.Pool,private client?:pg.PoolClient){}
 private query(sql:string,values:any[]=[]){return (this.client??this.pool).query(sql,values);}
 async subscriptionSales(venue:string,basis:string,start:string,end:string){if(!['COLLECTED','ORDERED'].includes(basis))throw Error('Invalid sales basis');const sql=basis==='COLLECTED'?"SELECT COALESCE(sum(amount_tzs),0) AS amount_tzs FROM payment_transactions WHERE venue_id=$1 AND status='SUCCESS' AND completed_at>=$2 AND completed_at<$3":"SELECT COALESCE(sum(i.line_total_tzs),0) AS amount_tzs FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.venue_id=$1 AND o.status<>'CANCELLED' AND i.status NOT IN ('REJECTED','CANCELLED') AND o.created_at>=$2 AND o.created_at<$3";return normalizeRow((await this.query(sql,[venue,start,end])).rows[0]).amount_tzs as number;}
 async venueAccess(venue:string){return (await this.query('SELECT cloud_menu_venue_access($1) AS allowed',[venue])).rows[0].allowed as boolean;}
 async expiredVenueAccess(limit:number){if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid access expiry batch');return (await this.query("SELECT a.venue_id FROM venue_access a JOIN venues v ON v.id=a.venue_id WHERE v.status IN ('ACTIVE','TRIAL') AND ((a.state='TRIAL' AND a.trial_ends_at<=now()) OR (a.state='ACTIVE' AND a.model='MONTHLY' AND a.paid_until+a.grace_days*interval '1 day'<=now())) ORDER BY a.updated_at,a.venue_id LIMIT $1",[limit])).rows;}
 async venueAudit(venue:string,limit:number){if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid audit batch');return (await this.query('SELECT action,actor_type,data,created_at FROM audit_log WHERE venue_id=$1 ORDER BY created_at DESC,id LIMIT $2',[venue,limit])).rows;}
 async platformOverview(start:string|null){return (await this.query(`WITH current_venues AS (
 SELECT v.*, (v.status IN ('ACTIVE','TRIAL') AND (a.venue_id IS NULL OR a.state='UNMANAGED' OR (a.state='TRIAL' AND a.trial_ends_at>now()) OR (a.state='ACTIVE' AND (a.model='SALES_BASED' OR (a.model='MONTHLY' AND a.paid_until+a.grace_days*interval '1 day'>now()))))) AS allowed
 FROM venues v LEFT JOIN venue_access a ON a.venue_id=v.id
 ) SELECT jsonb_build_object(
 'venues',(SELECT count(*) FROM venues),'active_venues',(SELECT count(*) FROM current_venues WHERE status='ACTIVE' AND allowed),'trial_venues',(SELECT count(*) FROM current_venues WHERE status='TRIAL' AND allowed),'suspended_venues',(SELECT count(*) FROM current_venues WHERE status='SUSPENDED' OR (status IN ('ACTIVE','TRIAL') AND NOT allowed)),
 'registrations',(SELECT count(*) FROM venues WHERE $1::timestamptz IS NULL OR created_at>=$1),
 'orders',(SELECT count(*) FROM orders WHERE $1::timestamptz IS NULL OR created_at>=$1),
 'ordered_sales_tzs',(SELECT COALESCE(sum(i.line_total_tzs),0)::text FROM order_items i JOIN orders o ON o.id=i.order_id WHERE ($1::timestamptz IS NULL OR o.created_at>=$1) AND i.status NOT IN ('REJECTED','CANCELLED')),
 'collected_sales_tzs',(SELECT COALESCE(sum(amount_tzs),0)::text FROM payment_transactions WHERE status='SUCCESS' AND ($1::timestamptz IS NULL OR completed_at>=$1)),
 'monthly_venues',(SELECT count(*) FROM venue_access WHERE model='MONTHLY'),'sales_based_venues',(SELECT count(*) FROM venue_access WHERE model='SALES_BASED'),
 'orders_by_hour',(SELECT jsonb_agg(jsonb_build_object('hour',h,'orders',(SELECT count(*) FROM orders WHERE ($1::timestamptz IS NULL OR created_at>=$1) AND extract(hour FROM created_at AT TIME ZONE 'Africa/Dar_es_Salaam')=h)) ORDER BY h) FROM generate_series(0,23) h)
 ) AS report`,[start])).rows[0].report;}
 async platformVenues(search:string,page:number,size:number,filters:VenueFilters={}){
 const values:unknown[]=[search];
 const conditions=["strpos(lower(name||' '||slug::text||' '||COALESCE(owner_email,'')),lower($1))>0"];
 const add=(sql:string,value:unknown)=>{values.push(value);conditions.push(sql.replace('?',`$${values.length}`));};
 if(filters.access)add('subscription_state=?',filters.access);
 if(filters.model)add("COALESCE(model::text,'NONE')=?",filters.model);
 if(filters.sample)add('is_sample=?',filters.sample==='yes');
 if(filters.registered_from)add("created_at>=(?::date::timestamp AT TIME ZONE 'UTC')",filters.registered_from);
 if(filters.registered_to)add("created_at<((?::date+interval '1 day') AT TIME ZONE 'UTC')",filters.registered_to);
 if(filters.expiry_days)add("subscription_state IN ('TRIAL','ACTIVE') AND CASE WHEN subscription_state='TRIAL' THEN trial_ends_at WHEN model='MONTHLY' THEN paid_until END BETWEEN now() AND now()+(?::integer*interval '1 day')",filters.expiry_days);
 if(filters.activity)conditions.push(filters.activity==='orders'?'orders>0':'orders=0');
 const cte=`WITH listing AS (SELECT v.id,v.name,v.slug,v.status,v.created_at,COALESCE(v.is_sample,false) AS is_sample,o.email AS owner_email,CASE WHEN v.status='CLOSED' THEN 'CLOSED' WHEN a.state IN ('REVOKED','EXPIRED') THEN a.state WHEN v.status='SUSPENDED' THEN 'SUSPENDED' WHEN (a.state='TRIAL' AND a.trial_ends_at<=now()) OR (a.state='ACTIVE' AND a.model='MONTHLY' AND a.paid_until+a.grace_days*interval '1 day'<=now()) THEN 'EXPIRED' ELSE COALESCE(a.state,'UNMANAGED') END AS subscription_state,a.model,a.monthly_fee_tzs,a.sales_fee_bp,a.sales_basis,a.trial_ends_at,a.paid_until,COALESCE(a.revision,0) AS revision,
 (SELECT count(*)::integer FROM orders r WHERE r.venue_id=v.id) AS orders,
 (SELECT COALESCE(sum(p.amount_tzs),0) FROM payment_transactions p WHERE p.venue_id=v.id AND p.status='SUCCESS') AS collected_sales_tzs,
 (SELECT COALESCE(sum(i.line_total_tzs),0) FROM order_items i JOIN orders r ON r.id=i.order_id WHERE r.venue_id=v.id AND i.status NOT IN ('REJECTED','CANCELLED')) AS ordered_sales_tzs
 FROM venues v LEFT JOIN owner_accounts o ON o.id=v.owner_account_id LEFT JOIN venue_access a ON a.venue_id=v.id)`;
 const where=conditions.join(' AND ');
 const total=Number((await this.query(`${cte} SELECT count(*) AS total FROM listing WHERE ${where}`,values)).rows[0].total);
 const order=filters.sort==='oldest'?'created_at ASC,id':filters.sort==='name'?'lower(name),id':filters.sort==='orders'?'orders DESC,id':'created_at DESC,id';
 const rows=(await this.query(`${cte} SELECT * FROM listing WHERE ${where} ORDER BY ${order} LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,size,(page-1)*size])).rows.map(normalizeRow);
 return {venues:rows,total,page,size};
 }
 async recentOrders(venue:string,station?:string,status?:string,from?:string,until?:string,page=1,itemStatus?:string){return (await this.query("SELECT o.* FROM orders o WHERE o.venue_id=$1 AND ($2::station_type IS NULL OR EXISTS(SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.station=$2::station_type)) AND ($3::order_status IS NULL OR o.status=$3::order_status) AND ($4::timestamptz IS NULL OR o.created_at>=$4) AND ($5::timestamptz IS NULL OR o.created_at<$5) AND ($7::order_item_status IS NULL OR EXISTS(SELECT 1 FROM order_items l WHERE l.order_id=o.id AND l.status=$7 AND ($2::station_type IS NULL OR l.station=$2))) ORDER BY o.created_at DESC,o.id LIMIT 200 OFFSET $6",[venue,station??null,status??null,from??null,until??null,(page-1)*200,itemStatus??null])).rows.map(normalizeRow);}
 async dashboard(venue:string,w:ReportWindow){return (await this.query('SELECT cloud_menu_dashboard($1,$2,$3,$4,$5,$6,$7) AS report',[venue,w.start,w.end,w.previousStart,w.previousEnd,w.comparisonStart,w.comparisonEnd])).rows[0].report;}
 async imageStorageBytes(venue:string){const value=Number((await this.query('SELECT COALESCE(sum(octet_length(content)),0) AS bytes FROM menu_images WHERE venue_id=$1',[venue])).rows[0].bytes);if(!Number.isSafeInteger(value))throw Error('Invalid image storage total');return value;}
 private table(table:Table){if(!tables.includes(table))throw new Error('Unknown table');return ident(table);}
 async lockSplit(venue:string,session:string,id:string){if(!this.client)throw Error('Split row lock requires a transaction');return (await this.query('SELECT * FROM bill_splits WHERE venue_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE',[venue,session,id])).rows.map(normalizeRow)[0];}
 async expiredSplits(limit:number){if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid expiry batch');return (await this.query("SELECT b.* FROM bill_splits b WHERE b.status='LOCKED' AND b.lock_expires_at<=now() AND NOT EXISTS (SELECT 1 FROM bill_shares s WHERE s.split_id=b.id AND s.venue_id=b.venue_id AND s.session_id=b.session_id AND (s.status='PENDING' OR EXISTS (SELECT 1 FROM payment_transactions p WHERE p.share_id=s.id AND p.venue_id=s.venue_id AND p.status IN ('INITIATED','PENDING')))) ORDER BY b.lock_expires_at,b.id LIMIT $1",[limit])).rows.map(normalizeRow);}
 async allocations(venue:string,session:string,split:string){return (await this.query('SELECT i.* FROM bill_share_items i JOIN bill_shares s ON s.id=i.share_id AND s.venue_id=i.venue_id AND s.session_id=i.session_id WHERE i.venue_id=$1 AND i.session_id=$2 AND s.split_id=$3',[venue,session,split])).rows.map(normalizeRow);}
 async paidAllocations(venue:string,session:string){return (await this.query("SELECT i.order_item_id,SUM(i.amount_tzs) AS amount_tzs FROM bill_share_items i JOIN bill_shares s ON s.id=i.share_id AND s.venue_id=i.venue_id AND s.session_id=i.session_id WHERE i.venue_id=$1 AND i.session_id=$2 AND s.status='PAID' GROUP BY i.order_item_id",[venue,session])).rows.map(normalizeRow);}
 async staffNotifications(venue:string,role:string,after:number,through:number){
  const predicate=`venue_id=$1 AND seq<=$3 AND created_at>=now()-interval '7 days' AND ((event_type='order.created' AND ($2::text NOT IN ('KITCHEN','BAR') OR EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'items') i WHERE i->>'station'=$2))) OR ($2 NOT IN ('KITCHEN','BAR') AND (event_type='waiter.called' OR (event_type='order.status_changed' AND payload->>'item_status'='READY'))))`;
  const values=[venue,role,through];
  const unread=Number((await this.query(`SELECT count(*) AS count FROM realtime_events WHERE ${predicate} AND seq>$4`,[...values,after])).rows[0].count);
  const events=(await this.query(`SELECT * FROM realtime_events WHERE ${predicate} ORDER BY seq DESC LIMIT 50`,values)).rows.map(normalizeRow);
  return {events,unread};
 }
 async events(venue:string,after:number,limit:number,session?:string){if(!Number.isSafeInteger(limit)||limit<1||limit>2000)throw Error('Invalid event batch');return (await this.query(`SELECT * FROM realtime_events WHERE venue_id=$1 AND seq>$2${session?" AND (session_id=$4 OR (session_id IS NULL AND event_type IN ('menu.item_availability','venue.access_suspended')))":''} ORDER BY seq LIMIT $3`,[venue,after,limit,...(session?[session]:[])])).rows.map(normalizeRow);}
 async eventHead(venue:string){return normalizeRow((await this.query('SELECT COALESCE(MAX(seq),0) AS seq FROM realtime_events WHERE venue_id=$1',[venue])).rows[0]).seq as number;}
 async rows(table:Table,where:Row){const keys=Object.keys(where);return (await this.query(`SELECT * FROM ${this.table(table)}${keys.length?' WHERE '+keys.map((k,i)=>`${ident(k)} IS NOT DISTINCT FROM $${i+1}`).join(' AND '):''}`,Object.values(where))).rows.map(normalizeRow);}
 async add(table:Table,row:Row){const keys=Object.keys(row);return normalizeRow((await this.query(`INSERT INTO ${this.table(table)} (${keys.map(ident)}) VALUES (${keys.map((_,i)=>'$'+(i+1))}) RETURNING *`,Object.values(row))).rows[0]);}
 async patch(table:Table,where:Row,change:Row){const keys=Object.keys(change),wk=Object.keys(where);if(!wk.length)throw new Error('Unscoped update');await this.query(`UPDATE ${this.table(table)} SET ${keys.map((k,i)=>`${ident(k)}=$${i+1}`).join(',')} WHERE ${wk.map((k,i)=>`${ident(k)} IS NOT DISTINCT FROM $${keys.length+i+1}`).join(' AND ')}`,[...Object.values(change),...Object.values(where)]);}
 async remove(table:'item_modifier_groups'|'bill_share_items',where:Row){const keys=Object.keys(where);if(!['item_modifier_groups','bill_share_items'].includes(table)||!keys.length||(table==='bill_share_items'&&(!where.venue_id||!where.session_id)))throw new Error('Invalid link deletion');await this.query(`DELETE FROM ${this.table(table)} WHERE ${keys.map((k,i)=>`${ident(k)}=$${i+1}`).join(' AND ')}`,Object.values(where));}
 async tx<T>(lock:string,work:(tx:Store)=>Promise<T>):Promise<T>{
  if(this.client)throw new Error('Nested transaction');const client=await this.pool.connect();
  try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[lock]);const result=await work(new PostgresStore(this.pool,client));await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}
