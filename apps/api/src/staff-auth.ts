import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {compare} from 'bcryptjs';
import type {Context} from './context.ts';
import {Problem} from './security.ts';
export function registerStaffAuth(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>){
 app.post('/v1/staff/auth/login',async request=>{
  await limit(`login:${request.ip}`,30);
  const input=z.object({venue_code:z.string().min(1).max(80),staff_id:z.uuid().optional(),pin:z.string().regex(/^\d{4,12}$/)}).parse(request.body);
  const [venue]=await ctx.store.rows('venues',{slug:input.venue_code.toLowerCase()});if(!venue)throw new Problem(401,'LOGIN_INVALID');
  const users=await ctx.store.rows('staff_users',{venue_id:venue.id,is_active:true});
  const user=input.staff_id?users.find(u=>u.id===input.staff_id):users.length===1?users[0]:undefined;
  if(!user)throw new Problem(401,'LOGIN_INVALID','Check venue, staff identifier and PIN.');
  const result=await ctx.store.tx(`staff-login:${user.id}`,async tx=>{
   const [u]=await tx.rows('staff_users',{id:user.id,is_active:true});const now=Date.now();if(u.locked_until&&new Date(u.locked_until).getTime()>now)return {locked:true};
   if(!await compare(input.pin,u.pin_hash)){
    const recent=u.first_failure_at&&now-new Date(u.first_failure_at).getTime()<600000;const count=recent?u.failed_attempts+1:1;
    await tx.patch('staff_users',{id:u.id},{failed_attempts:count,first_failure_at:recent?u.first_failure_at:new Date(now).toISOString(),locked_until:count>=5?new Date(now+900000).toISOString():null});return {invalid:true};
   }
   await tx.patch('staff_users',{id:u.id},{failed_attempts:0,first_failure_at:null,locked_until:null,last_login_at:new Date(now).toISOString()});return {user:u};
  });
  if(result.locked)throw new Problem(423,'ACCOUNT_LOCKED','Please try again after fifteen minutes.');if(!result.user)throw new Problem(401,'LOGIN_INVALID');
  const u=result.user;return {staff_token:await ctx.tokens.sign({kind:'staff',staff_id:u.id,venue_id:u.venue_id,role:u.role},3600),role:u.role,token_expires_at:new Date(Date.now()+3600000).toISOString()};
 });
 app.get('/v1/admin/reports',async request=>{await ctx.staff(request,['MANAGER','OWNER']);throw new Problem(501,'OUT_OF_SPRINT_SCOPE','Reporting is scheduled after Sprint 1.');});
}
