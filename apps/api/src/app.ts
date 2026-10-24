import Fastify from 'fastify';
import { z, ZodError } from 'zod';
import { randomUUID,randomBytes } from 'node:crypto';
import { auth,checkQR,hash,Problem } from './security.ts';
import type { Store } from './store.ts';
export interface AppOptions {store:Store;tokenSecret:string;qrSecret:string;logger?:boolean;rateLimit?:(key:string,max:number,seconds:number)=>Promise<boolean>}
export async function buildApp(options:AppOptions){
 const {store}=options;const tokens=auth(options.tokenSecret);
 const app=Fastify({logger:options.logger??true,bodyLimit:1048576,disableRequestLogging:true});
 const counters=new Map<string,{count:number;until:number}>();
 const limit=async(key:string,max:number,seconds=60)=>{
  if(options.rateLimit){if(!await options.rateLimit(key,max,seconds))throw new Problem(429,'RATE_LIMITED');return;}
  const now=Date.now();const bucket=counters.get(key);if(!bucket||bucket.until<now)counters.set(key,{count:1,until:now+seconds*1000});else if(++bucket.count>max)throw new Problem(429,'RATE_LIMITED');
 };
 app.setErrorHandler((error,request,reply)=>{
  const p=error instanceof Problem?error:error instanceof ZodError?new Problem(422,'VALIDATION_ERROR','Please check the request.'):new Problem(500,'INTERNAL_ERROR','Please try again.');
  if(p.status===500)request.log.error({err:error instanceof Error?{name:error.name,message:error.message}:{name:'UnknownError'},request_id:request.id},'request failed');
  if(p.status===429)reply.header('Retry-After','60');
  reply.code(p.status).type('application/problem+json').send({type:`urn:cloud-menu:error:${p.code}`,title:p.code.replaceAll('_',' '),status:p.status,code:p.code,detail:p.message,request_id:request.id,...p.extra});
 });
 app.setNotFoundHandler((request,reply)=>reply.code(404).type('application/problem+json').send({type:'urn:cloud-menu:error:NOT_FOUND',title:'Not found',status:404,code:'NOT_FOUND',request_id:request.id}));
 app.addHook('onSend',async(_req,reply)=>{reply.header('X-Content-Type-Options','nosniff');reply.header('Cache-Control','no-store');});
 app.get('/health',async()=>({status:'ok'}));
 app.post('/v1/sessions/init',async(request,reply)=>{
  await limit(`init:${request.ip}`,30);
  const input=z.object({qr:z.string().max(200),device_id:z.uuid(),locale:z.enum(['en','sw']).default('en')}).parse(request.body);
  const [table]=await store.rows('dining_tables',{qr_code:input.qr.split('.')[0],is_active:true});
  if(!table)throw new Problem(404,'QR_NOT_FOUND');
  if(!checkQR(input.qr,table.qr_code,table.qr_key_version,options.qrSecret))throw new Problem(422,'QR_SIGNATURE_INVALID');
  return store.tx(`venue:${table.venue_id}`,async tx=>{
   const [venue]=await tx.rows('venues',{id:table.venue_id});
   if(!['ACTIVE','TRIAL'].includes(venue.status))throw new Problem(403,'VENUE_SUSPENDED');
   const active=await tx.rows('table_sessions',{table_id:table.id,status:'ACTIVE'});
   if(active.length)throw new Problem(409,'SESSION_EXISTS');
   const now=new Date().toISOString();
   const session=await tx.add('table_sessions',{id:randomUUID(),venue_id:venue.id,table_id:table.id,status:'ACTIVE',opened_at:now,last_activity_at:now});
   const proof=randomBytes(32).toString('base64url');const issued=Math.floor(Date.now()/1000);
   const participant=await tx.add('session_participants',{id:randomUUID(),session_id:session.id,display_name:'Guest 1',device_hash:hash(input.device_id),joined_at:now,device_proof_hash:hash(proof),token_issued_at:issued});
   const token=await tokens.sign({kind:'guest',session_id:session.id,participant_id:participant.id,venue_id:venue.id},21600,issued);
   reply.code(201);return {session,venue:{id:venue.id,name:venue.name,currency:'TZS',menu_version:1},table:{id:table.id,label:table.label},participant:{id:participant.id,display_name:participant.display_name},session_token:token,token_expires_at:new Date((issued+21600)*1000).toISOString(),device_proof:proof};
  });
 });
 return app;
}
