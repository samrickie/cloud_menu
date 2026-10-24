import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { auth,Problem } from './security.ts';
import type { Store } from './store.ts';
export function context(store:Store,secret:string){
 const tokens=auth(secret);
 return {store,tokens,async staff(request:FastifyRequest,roles?:string[]){
  const p=await tokens.verify(request.headers.authorization?.replace(/^Bearer /,''));
  if(p.kind!=='staff')throw new Problem(403,'ROLE_FORBIDDEN');const [staff]=await store.rows('staff_users',{id:p.staff_id,venue_id:p.venue_id,is_active:true});
  if(!staff||staff.role!==p.role)throw new Problem(403,'ROLE_FORBIDDEN');if(roles&&!roles.includes(staff.role))throw new Problem(403,'ROLE_FORBIDDEN');return staff;
 },async guest(request:FastifyRequest,sessionId?:string){
  const p=await tokens.verify(request.headers.authorization?.replace(/^Bearer /,''));
  if(p.kind!=='guest'||(sessionId&&p.session_id!==sessionId))throw new Problem(403,'SESSION_FORBIDDEN');
  const [s]=await store.rows('table_sessions',{id:p.session_id,venue_id:p.venue_id,status:'ACTIVE'});
  const [who]=await store.rows('session_participants',{id:p.participant_id,session_id:p.session_id});
  if(!s||!who)throw new Problem(409,'SESSION_CLOSED');return p as typeof p&{venue_id:string;session_id:string;participant_id:string};
 }};
}
export const idParams=(value:unknown)=>z.object({id:z.uuid()}).parse(value).id;
export type Context=ReturnType<typeof context>;
