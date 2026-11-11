import {groupServiceItems} from './service-settings.ts';
import type {VenueFilters} from './venue-filters.ts';
import pg from 'pg';
import type {ReportWindow} from './dashboard.ts';
export const tables = ['venues','dining_tables','table_sessions','session_participants','menus','categories','items','modifier_groups','modifiers','item_modifier_groups','orders','order_items','order_item_modifiers','idempotency_keys','realtime_events','staff_users','audit_log','owner_accounts','venue_profiles','waiter_calls','bills','bill_splits','bill_shares','bill_share_items','payment_transactions','owner_identities','oauth_flows','inventory_movements','menu_images','subscriptions','platform_admins','platform_settings','venue_access','platform_subscription_payments','subscription_actions','service_feedback','venue_halls','venue_billing_overrides','venue_billing_periods','staff_notification_reads','staff_attention_ack','staff_alert_preferences','venue_online_menu','venue_service_settings','businesses','account_invitations','platform_subscription_payments'] as const;
export type Table = typeof tables[number];
export type Row = Record<string,any>;
export interface Store {
 purgeBusiness(id:string):Promise<void>;
 exportRecords(kind:string,business?:string,branch?:string,from?:string,until?:string,page?:number,subscriptionStatus?:string):Promise<Row[]>;
 serviceWork(venue:string,role:string):Promise<Row[]>;
 platformGrowth(range:string,start:string|null):Promise<Row[]>;
 staffNotifications(venue:string,role:string,after:number,through:number):Promise<{events:Row[];unread:number}>;
 subscriptionSales(venue:string,basis:string,start:string,end:string):Promise<number>;
 venueAccess(venue:string):Promise<boolean>;
 expiredVenueAccess(limit:number):Promise<Row[]>;
 platformOverview(start:string|null):Promise<Row>;
 platformVenues(search:string,page:number,size:number,filters?:VenueFilters):Promise<Row>;
 venueAudit(venue:string,limit:number):Promise<Row[]>;
 recentOrders(venue:string,station?:string,status?:string,from?:string,until?:string,page?:number,itemStatus?:string,businessStart?:string):Promise<Row[]>;
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
 tx<T>(lock:string|string[],work:(tx:Store)=>Promise<T>):Promise<T>;
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
 async platformGrowth(range:string,start:string|null){
  return (await this.query(`WITH bounds AS (
   SELECT CASE WHEN $1='all' THEN date_trunc('month',now() AT TIME ZONE 'Africa/Dar_es_Salaam')-interval '11 months' ELSE $2::timestamptz AT TIME ZONE 'Africa/Dar_es_Salaam' END AS begins,
    now() AT TIME ZONE 'Africa/Dar_es_Salaam' AS ends,
    CASE WHEN $1='all' THEN 'month' WHEN $1='today' THEN 'hour' ELSE 'day' END AS unit
  ), buckets AS (SELECT b.*,g AS bucket FROM bounds b CROSS JOIN LATERAL generate_series(date_trunc(unit,begins),CASE WHEN $1='today' THEN date_trunc('day',ends)+interval '23 hours' ELSE date_trunc(unit,ends) END,CASE WHEN $1='all' THEN interval '1 month' WHEN $1='today' THEN interval '1 hour' ELSE interval '1 day' END) g),
  registrations AS (SELECT date_trunc(b.unit,v.created_at AT TIME ZONE 'Africa/Dar_es_Salaam') AS bucket,count(*) AS total FROM venues v CROSS JOIN bounds b WHERE v.created_at>=b.begins AT TIME ZONE 'Africa/Dar_es_Salaam' AND v.created_at<=now() GROUP BY 1),
  placed AS (SELECT date_trunc(b.unit,o.created_at AT TIME ZONE 'Africa/Dar_es_Salaam') AS bucket,count(*) AS total FROM orders o CROSS JOIN bounds b WHERE o.created_at>=b.begins AT TIME ZONE 'Africa/Dar_es_Salaam' AND o.created_at<=now() GROUP BY 1)
  SELECT to_char(g.bucket,'YYYY-MM-DD HH24:MI') AS bucket,COALESCE(v.total,0)::integer AS venues,COALESCE(o.total,0)::integer AS orders FROM buckets g LEFT JOIN registrations v USING(bucket) LEFT JOIN placed o USING(bucket) ORDER BY g.bucket`,[range,start])).rows;
 }
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
 if(filters.access==='LIVE_ACTIVE'||filters.access==='LIVE_TRIAL'){add('status=?',filters.access==='LIVE_ACTIVE'?'ACTIVE':'TRIAL');conditions.push("subscription_state NOT IN ('EXPIRED','REVOKED','SUSPENDED','CLOSED')");}else if(filters.access==='RESTRICTED')conditions.push("subscription_state IN ('EXPIRED','REVOKED','SUSPENDED')");else if(filters.access)add('subscription_state=?',filters.access);
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
 async recentOrders(venue:string,station?:string,status?:string,from?:string,until?:string,page=1,itemStatus?:string,businessStart?:string){return (await this.query("SELECT o.* FROM orders o WHERE o.venue_id=$1 AND ($2::station_type IS NULL OR EXISTS(SELECT 1 FROM order_items i WHERE i.order_id=o.id AND i.station=$2::station_type)) AND ($3::order_status IS NULL OR o.status=$3::order_status) AND ($4::timestamptz IS NULL OR o.created_at>=$4) AND ($5::timestamptz IS NULL OR o.created_at<$5) AND ($7::order_item_status IS NULL OR EXISTS(SELECT 1 FROM order_items l WHERE l.order_id=o.id AND l.status=$7 AND ($2::station_type IS NULL OR l.station=$2))) AND ($8::timestamptz IS NULL OR o.created_at>=$8 OR EXISTS(SELECT 1 FROM order_items active WHERE active.order_id=o.id AND active.status NOT IN ('SERVED','REJECTED','CANCELLED')) AND o.status<>'CANCELLED') ORDER BY o.created_at DESC,o.id LIMIT 200 OFFSET $6",[venue,station??null,status??null,from??null,until??null,(page-1)*200,itemStatus??null,businessStart??null])).rows.map(normalizeRow);}
 async dashboard(venue:string,w:ReportWindow){return (await this.query('SELECT cloud_menu_dashboard($1,$2,$3,$4,$5,$6,$7) AS report',[venue,w.start,w.end,w.previousStart,w.previousEnd,w.comparisonStart,w.comparisonEnd])).rows[0].report;}
 async imageStorageBytes(venue:string){const value=Number((await this.query('SELECT COALESCE(sum(octet_length(content)),0) AS bytes FROM menu_images WHERE venue_id=$1',[venue])).rows[0].bytes);if(!Number.isSafeInteger(value))throw Error('Invalid image storage total');return value;}
 private table(table:Table){if(!tables.includes(table))throw new Error('Unknown table');return ident(table);}
 async lockSplit(venue:string,session:string,id:string){if(!this.client)throw Error('Split row lock requires a transaction');return (await this.query('SELECT * FROM bill_splits WHERE venue_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE',[venue,session,id])).rows.map(normalizeRow)[0];}
 async expiredSplits(limit:number){if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid expiry batch');return (await this.query("SELECT b.* FROM bill_splits b WHERE b.status='LOCKED' AND b.lock_expires_at<=now() AND NOT EXISTS (SELECT 1 FROM bill_shares s WHERE s.split_id=b.id AND s.venue_id=b.venue_id AND s.session_id=b.session_id AND (s.status='PENDING' OR EXISTS (SELECT 1 FROM payment_transactions p WHERE p.share_id=s.id AND p.venue_id=s.venue_id AND p.status IN ('INITIATED','PENDING')))) ORDER BY b.lock_expires_at,b.id LIMIT $1",[limit])).rows.map(normalizeRow);}
 async allocations(venue:string,session:string,split:string){return (await this.query('SELECT i.* FROM bill_share_items i JOIN bill_shares s ON s.id=i.share_id AND s.venue_id=i.venue_id AND s.session_id=i.session_id WHERE i.venue_id=$1 AND i.session_id=$2 AND s.split_id=$3',[venue,session,split])).rows.map(normalizeRow);}
 async paidAllocations(venue:string,session:string){return (await this.query("SELECT i.order_item_id,SUM(i.amount_tzs) AS amount_tzs FROM bill_share_items i JOIN bill_shares s ON s.id=i.share_id AND s.venue_id=i.venue_id AND s.session_id=i.session_id WHERE i.venue_id=$1 AND i.session_id=$2 AND s.status='PAID' GROUP BY i.order_item_id",[venue,session])).rows.map(normalizeRow);}
 async purgeBusiness(id:string){
  if(!this.client)throw Error('Purge requires transaction');
  const [business]=(await this.query("SELECT * FROM businesses WHERE id=$1 AND state='DELETED' AND retain_until<=clock_timestamp() FOR UPDATE",[id])).rows;if(!business)throw Error('Business retention period has not ended');
  for(const {id:venue}of (await this.query('SELECT id FROM venues WHERE business_id=$1 ORDER BY id',[id])).rows){
   await this.query('DELETE FROM payment_webhook_events WHERE transaction_id IN (SELECT id FROM payment_transactions WHERE venue_id=$1)',[venue]);
   await this.query("DELETE FROM idempotency_keys WHERE scope IN (SELECT 'orders:create:'||id::text FROM table_sessions WHERE venue_id=$1)",[venue]);
   for(const table of ['staff_attention_ack','staff_alert_preferences','staff_notification_reads','service_feedback','waiter_calls','inventory_movements','payment_transactions','bill_share_items','bill_shares','bill_splits','bills','orders','table_sessions','items','menu_images','venue_halls','venue_online_menu','venue_service_settings','venue_billing_periods','venue_billing_overrides','venue_access','platform_subscription_payments','subscription_actions','realtime_events'])await this.query(`DELETE FROM ${ident(table)} WHERE venue_id=$1`,[venue]);
   await this.query('DELETE FROM venues WHERE id=$1 AND business_id=$2',[venue,id]);
  }
  await this.query('DELETE FROM businesses WHERE id=$1',[id]);
 }
 async exportRecords(kind:string,business?:string,branch?:string,from?:string,until?:string,page=1,subscriptionStatus?:string){
  const base=" FROM venues v JOIN businesses b ON b.id=v.business_id LEFT JOIN owner_accounts a ON a.id=b.owner_account_id ";
  const scope=" WHERE ($1::uuid IS NULL OR b.id=$1) AND ($2::uuid IS NULL OR v.id=$2) ";
  const queries:Record<string,string>={
   details:"SELECT b.id AS business_id,b.name AS business_name,b.state,v.id AS branch_id,v.name AS branch_name,v.street,v.area,v.city,v.phone,a.full_name AS owner_name,a.email AS owner_email,v.created_at"+base+scope+"AND ($3::timestamptz IS NULL OR v.created_at>=$3) AND ($4::timestamptz IS NULL OR v.created_at<$4) ORDER BY b.id,v.id",
   staff:"SELECT b.name AS business_name,v.id AS branch_id,v.name AS branch_name,s.id,s.full_name,s.role,s.is_active,s.created_at"+base+"JOIN staff_users s ON s.venue_id=v.id"+scope+"AND ($3::timestamptz IS NULL OR s.created_at>=$3) AND ($4::timestamptz IS NULL OR s.created_at<$4) ORDER BY s.id",
   orders:"SELECT b.name AS business_name,v.id AS branch_id,v.name AS branch_name,o.id,o.order_no,o.status,o.created_at,o.updated_at,o.subtotal_tzs AS order_subtotal_tzs,o.note AS order_note,i.id AS item_id,i.name_snapshot AS item_name,i.quantity,i.station,i.status AS item_status,i.stage_started_at,i.served_at,i.line_total_tzs,i.note AS item_note"+base+"JOIN orders o ON o.venue_id=v.id JOIN order_items i ON i.order_id=o.id"+scope+"AND ($3::timestamptz IS NULL OR o.created_at>=$3) AND ($4::timestamptz IS NULL OR o.created_at<$4) ORDER BY o.created_at,o.id,i.id",
   transactions:"SELECT b.name AS business_name,v.id AS branch_id,v.name AS branch_name,p.id,p.provider AS payment_method,p.amount_tzs,p.status,p.our_reference,p.provider_reference,p.created_at,p.completed_at"+base+"JOIN payment_transactions p ON p.venue_id=v.id"+scope+"AND ($3::timestamptz IS NULL OR p.created_at>=$3) AND ($4::timestamptz IS NULL OR p.created_at<$4) ORDER BY p.created_at,p.id",
   subscriptions:"SELECT b.name AS business_name,v.id AS branch_id,v.name AS branch_name,x.model AS plan,x.state,x.monthly_fee_tzs,x.sales_fee_bp,COALESCE(receipt.next_due_at,x.paid_until) AS next_due_date,x.trial_ends_at,x.grace_days,x.updated_at,receipt.paid_at AS last_payment_date,receipt.amount_tzs AS last_payment_tzs,receipt.reference AS payment_reference,CASE WHEN x.state='TRIAL' AND x.trial_ends_at>now() THEN 'TRIAL' WHEN x.state IN ('EXPIRED','REVOKED') OR x.paid_until+x.grace_days*interval '1 day'<now() THEN 'EXPIRED' WHEN x.paid_until<now() THEN 'OVERDUE' WHEN receipt.next_due_at<now() THEN 'OVERDUE' WHEN receipt.next_due_at>=now() THEN 'PAID' ELSE 'UNPAID' END AS subscription_status"+base+"LEFT JOIN venue_access x ON x.venue_id=v.id LEFT JOIN LATERAL (SELECT paid_at,next_due_at,amount_tzs,reference FROM platform_subscription_payments WHERE venue_id=v.id ORDER BY paid_at DESC,id DESC LIMIT 1) receipt ON true"+scope+"AND ($3::timestamptz IS NULL OR x.updated_at>=$3) AND ($4::timestamptz IS NULL OR x.updated_at<$4) ORDER BY b.id,v.id"
  };
  if(!queries[kind]||!Number.isInteger(page)||page<1||page>100000)throw Error('Invalid export');return (await this.query('SELECT * FROM ('+queries[kind]+') result WHERE ($6::text IS NULL OR '+(kind==='subscriptions'?'subscription_status':'NULL::text')+'=$6) LIMIT 201 OFFSET $5',[business??null,branch??null,from??null,until??null,(page-1)*200,subscriptionStatus??null])).rows.map(normalizeRow);
 }
 async serviceWork(venue:string,role:string){
  const orders=groupServiceItems((await this.query(`SELECT i.*,o.id AS order_id,o.order_no,o.note AS order_note,o.created_at AS received_at,t.label AS table_label FROM orders o JOIN order_items i ON i.order_id=o.id JOIN table_sessions se ON se.id=o.session_id AND se.venue_id=o.venue_id JOIN dining_tables t ON t.id=se.table_id AND t.venue_id=o.venue_id WHERE o.venue_id=$1 AND o.status<>'CANCELLED' AND i.status NOT IN ('SERVED','REJECTED','CANCELLED') AND ($2::text IN ('OWNER','MANAGER') OR ($2='WAITER' AND i.status='READY') OR (i.station::text=$2 AND i.status<>'READY')) ORDER BY o.created_at,o.id,i.id`,[venue,role])).rows,role);
  const calls=['OWNER','MANAGER','WAITER'].includes(role)?(await this.query(`SELECT c.id,'REQUEST' AS kind,'WAITER' AS station,c.created_at AS received_at,t.label AS table_label,c.reason,c.message,c.status,'[]'::jsonb AS items FROM waiter_calls c JOIN dining_tables t ON t.id=c.table_id AND t.venue_id=c.venue_id WHERE c.venue_id=$1 AND c.status<>'RESOLVED' ORDER BY c.created_at,c.id`,[venue])).rows.map(normalizeRow):[];
  return [...orders,...calls];
 }
 async staffNotifications(venue:string,role:string,after:number,through:number){
  const predicate=`venue_id=$1 AND seq<=$3 AND created_at>=now()-interval '7 days' AND ((event_type='order.created' AND $2<>'WAITER' AND ($2::text NOT IN ('KITCHEN','BAR') OR EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'items') i WHERE i->>'station'=$2))) OR ($2 NOT IN ('KITCHEN','BAR') AND (event_type='waiter.called' OR (event_type='order.status_changed' AND payload->>'item_status'='READY'))))`;
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
 async tx<T>(lock:string|string[],work:(tx:Store)=>Promise<T>):Promise<T>{
  if(this.client)throw new Error('Nested transaction');const client=await this.pool.connect();
  try{await client.query('BEGIN');for(const key of [...new Set(Array.isArray(lock)?lock:[lock])].sort())await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);const result=await work(new PostgresStore(this.pool,client));await client.query('COMMIT');return result;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
}
