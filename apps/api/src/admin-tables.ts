import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {randomUUID,randomBytes} from 'node:crypto';
import {parse} from 'csv-parse/sync';
import {idParams,type Context} from './context.ts';
import type {Row} from './store.ts';
import {Problem,signQR,qrScope} from './security.ts';
import {registerStickerExports} from './sticker-exports.ts';
const label=z.string().trim().min(1).max(30).refine(v=>[...v].every(c=>c.charCodeAt(0)>=32&&c.charCodeAt(0)!==127));
const tableInput=z.object({label,seats:z.number().int().min(1).max(100).optional(),zone:z.string().trim().min(1).max(60).optional()}).strict();
export function registerTables(app:FastifyInstance,ctx:Context,qrSecret:string,guestOrigin:string,limit:(key:string,max:number)=>Promise<void>){
 const url=(table:Row,slug:string)=>{const u=new URL('/',guestOrigin);u.searchParams.set('qr',signQR(table.qr_code,table.qr_key_version,qrSecret,qrScope(table)));u.searchParams.set('venue',slug);u.searchParams.set('table',table.label);return u.toString();};
 const view=(t:Row,slug:string)=>({id:t.id,label:t.label,is_sample:!!t.is_sample,seats:t.seats??null,zone:t.zone??null,qr_status:t.is_active?'ACTIVE':'INACTIVE',qr_key_version:t.qr_key_version,qr_rotated_at:t.qr_rotated_at??null,url:url(t,slug)});
 async function ensureHall(tx:import('./store.ts').Store,venue:string,name:string){
  const [existing]=await tx.rows('venue_halls',{venue_id:venue,name});
  return existing??await tx.add('venue_halls',{id:randomUUID(),venue_id:venue,name});
 }
 app.post('/v1/admin/halls',async req=>{
  const staff=await ctx.staff(req,['OWNER','MANAGER']);
  const {name}=z.object({name:z.string().trim().min(1).max(60)}).strict().parse(req.body);
  return ctx.store.tx('venue:'+staff.venue_id,async tx=>({hall:await ensureHall(tx,staff.venue_id,name)}));
 });
 app.patch('/v1/admin/halls/:id',async req=>{
  const staff=await ctx.staff(req,['OWNER','MANAGER']),id=idParams(req.params);
  const {name}=z.object({name:z.string().trim().min(1).max(60)}).strict().parse(req.body);
  return ctx.store.tx('venue:'+staff.venue_id,async tx=>{
   const where={id,venue_id:staff.venue_id},[hall]=await tx.rows('venue_halls',where);
   if(!hall)throw new Problem(404,'HALL_NOT_FOUND');
   if(hall.name!==name&&(await tx.rows('venue_halls',{venue_id:staff.venue_id,name})).length)throw new Problem(409,'HALL_EXISTS');
   await tx.patch('dining_tables',{venue_id:staff.venue_id,zone:hall.name},{zone:name});
   await tx.patch('venue_halls',where,{name});return {hall:{...hall,name}};
  });
 });
 async function create(staff:Row,input:z.infer<typeof tableInput>[]){return ctx.store.tx(`venue:${staff.venue_id}`,async tx=>{
  const [venue]=await tx.rows('venues',{id:staff.venue_id});const existing=await tx.rows('dining_tables',{venue_id:staff.venue_id});const unique=[...new Map(input.map(t=>[t.label,t])).values()];if(existing.length+unique.filter(t=>!existing.some(x=>x.label===t.label)).length>1000)throw new Problem(422,'TABLE_LIMIT_REACHED');
  for(const zone of new Set(unique.map(t=>t.zone).filter((z):z is string=>!!z)))await ensureHall(tx,staff.venue_id,zone);
  let created=0;const tables=[];for(const data of unique){let t=existing.find(x=>x.label===data.label);if(t&&!t.is_active)throw new Problem(409,'TABLE_INACTIVE');if(t?.is_sample){const change={...data,is_sample:false};await tx.patch('dining_tables',{id:t.id,venue_id:staff.venue_id},change);t={...t,...change};}if(!t){t=await tx.add('dining_tables',{id:randomUUID(),venue_id:staff.venue_id,...data,seats:data.seats??null,zone:data.zone??null,qr_code:randomBytes(16).toString('base64url'),qr_key_version:1,qr_format:2,is_active:true});created++;}tables.push(view(t,venue.slug));}
  await tx.add('audit_log',{venue_id:staff.venue_id,actor_type:'STAFF',actor_id:staff.id,action:'TABLES_CREATED',entity_type:'table',data:{created,reused:tables.length-created}});return {tables,created,reused:tables.length-created};
 });}
 app.get('/v1/admin/tables',async req=>{const s=await ctx.staff(req,['MANAGER','OWNER']);const [venue]=await ctx.store.rows('venues',{id:s.venue_id});return {halls:await ctx.store.rows('venue_halls',{venue_id:s.venue_id}),tables:(await ctx.store.rows('dining_tables',{venue_id:s.venue_id,is_active:true})).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true})).map(t=>view(t,venue.slug))};});
 app.post('/v1/admin/tables',async(req,reply)=>{const s=await ctx.staff(req,['MANAGER','OWNER']);const input=z.union([z.object({labels:z.array(label).min(1).max(100)}).strict(),z.object({tables:z.array(tableInput).min(1).max(100)}).strict()]).parse(req.body);const result=await create(s,'labels'in input?input.labels.map(label=>({label})):input.tables);reply.code(201);return result;});
 app.post('/v1/admin/tables/range',async(req,reply)=>{const s=await ctx.staff(req,['MANAGER','OWNER']);const p=z.object({from:z.number().int().min(1).max(99999),to:z.number().int().min(1).max(99999),prefix:z.string().trim().max(20).default(''),seats:z.number().int().min(1).max(100).default(4),zone:z.string().trim().min(1).max(60).default('Main hall')}).strict().refine(v=>v.to>=v.from&&v.to-v.from<100).parse(req.body);const result=await create(s,Array.from({length:p.to-p.from+1},(_,i)=>({label:label.parse([p.prefix,String(p.from+i)].filter(Boolean).join(' ')),seats:p.seats,zone:p.zone})));reply.code(201);return result;});
 app.post('/v1/admin/tables/import',async(req,reply)=>{const s=await ctx.staff(req,['MANAGER','OWNER']);const {csv}=z.object({csv:z.string().max(50000)}).strict().parse(req.body);let rows:Row[];try{rows=parse(csv,{columns:true,skip_empty_lines:true,bom:true,max_record_size:1000});}catch{throw new Problem(422,'CSV_INVALID');}if(!rows.length||rows.length>100)throw new Problem(422,'CSV_ROW_LIMIT');const input=[],errors=[];for(const [i,row]of rows.entries()){const parsed=tableInput.safeParse({...row,seats:row.seats?Number(row.seats):undefined,zone:row.zone||undefined});if(!parsed.success)errors.push({row:i+2,code:'VALIDATION_ERROR'});else input.push(parsed.data);}if(errors.length)throw new Problem(422,'CSV_INVALID','No rows were imported.',{errors});const result=await create(s,input);reply.code(201);return result;});
 app.post('/v1/admin/tables/:id/rotate',async req=>{const s=await ctx.staff(req,['MANAGER','OWNER']),id=idParams(req.params);return ctx.store.tx(`venue:${s.venue_id}`,async tx=>{const [t]=await tx.rows('dining_tables',{id,venue_id:s.venue_id,is_active:true});if(!t)throw new Problem(404,'TABLE_NOT_FOUND');const [v]=await tx.rows('venues',{id:s.venue_id});const next={...t,qr_key_version:t.qr_key_version+1,qr_format:2,qr_rotated_at:new Date().toISOString()};await tx.patch('dining_tables',{id,venue_id:s.venue_id},{qr_key_version:next.qr_key_version,qr_format:2,qr_rotated_at:next.qr_rotated_at});await tx.add('audit_log',{venue_id:s.venue_id,actor_type:'STAFF',actor_id:s.id,action:'QR_ROTATED',entity_type:'table',entity_id:id});return {table_id:id,url:url(next,v.slug),table:view(next,v.slug)};});});
 app.patch('/v1/admin/tables/:id/zone',async req=>{
  const staff=await ctx.staff(req,['OWNER','MANAGER']),id=idParams(req.params);
  const {zone}=z.object({zone:z.string().trim().min(1).max(60)}).strict().parse(req.body);
  return ctx.store.tx('venue:'+staff.venue_id,async tx=>{
   const where={id,venue_id:staff.venue_id,is_active:true};
   if(!(await tx.rows('dining_tables',where)).length)throw new Problem(404,'TABLE_NOT_FOUND');
   await ensureHall(tx,staff.venue_id,zone);await tx.patch('dining_tables',where,{zone});return {zone};
  });
 });
 registerStickerExports(app,ctx,url,limit);
}
