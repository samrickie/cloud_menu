import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {hash as passwordHash} from 'bcryptjs';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('admin invites are single-use, removed admins lose access, and last/self removal is blocked',async()=>{
 const email='sample-admin@example.test',f=await fixture({platformAdminEmails:[email]});try{
 const a=await f.store.add('owner_accounts',{id:randomUUID(),email,full_name:'Sample admin',is_active:true,auth_version:1,email_verified_at:new Date().toISOString()});
 const exchange=async(a:any)=>f.app.inject({method:'POST',url:'/v1/platform/auth/exchange',headers:{authorization:'Bearer '+await auth(secrets.token).sign({kind:'account',account_id:a.id,auth_version:a.auth_version},3600)},payload:{}});
 const headers={authorization:'Bearer '+(await exchange(a)).json().platform_token};
 expect((await f.app.inject({method:'DELETE',url:'/v1/platform/admins/'+randomUUID(),headers,payload:{reason:'Sample test'}})).json().code).toBe('LAST_ADMIN');
 const invited=await f.app.inject({method:'POST',url:'/v1/platform/admins',headers,payload:{name:'Sample second admin',email:'sample-second@example.test',reason:'Sample delegation'}});expect(invited.statusCode).toBe(200);const pending=(await f.app.inject({url:'/v1/platform/invitations',headers})).json().invitations;expect(pending).toHaveLength(1);expect(JSON.stringify(pending)).not.toContain('token_hash');
 const replaced=await f.app.inject({method:'POST',url:'/v1/platform/invitations/'+pending[0].id,headers,payload:{action:'REISSUE',reason:'Sample replacement'}});
 expect(replaced.statusCode).toBe(200);
 const oldToken=new URLSearchParams(new URL(invited.json().invitation.url).hash.slice(1)).get('invite');
 expect((await f.app.inject({method:'POST',url:'/v1/invitations/accept',payload:{token:oldToken,password:'sample-long-password-123'}})).statusCode).toBe(410);
 const token=new URLSearchParams(new URL(replaced.json().invitation.url).hash.slice(1)).get('invite');const payload={token,password:'sample-long-password-123'};
 expect((await f.app.inject({method:'POST',url:'/v1/invitations/accept',payload})).statusCode).toBe(200);expect((await f.app.inject({method:'POST',url:'/v1/invitations/accept',payload})).statusCode).toBe(410);
 const [second]=await f.store.rows('owner_accounts',{email:'sample-second@example.test'}),secondToken=(await exchange(second)).json().platform_token;expect(secondToken).toBeTruthy();
 expect((await f.app.inject({method:'DELETE',url:'/v1/platform/admins/'+a.id,headers,payload:{reason:'Sample self removal'}})).json().code).toBe('CANNOT_REMOVE_SELF');
 expect((await f.app.inject({method:'DELETE',url:'/v1/platform/admins/'+second.id,headers,payload:{reason:'Sample removal'}})).statusCode).toBe(200);
 expect((await f.app.inject({url:'/v1/platform/me',headers:{authorization:'Bearer '+secondToken}})).statusCode).toBe(403);
 }finally{await f.app.close();}
});
it('a deactivated business blocks owner password login and issued staff sessions without deleting data',async()=>{
 const f=await fixture();try{const password='sample-long-password-123',a=await f.store.add('owner_accounts',{id:randomUUID(),email:'sample-owner@example.test',full_name:'Sample owner',password_hash:await passwordHash(password,4),is_active:true,auth_version:1});
 const b=await f.store.add('businesses',{id:randomUUID(),owner_account_id:a.id,name:'Sample business',state:'INACTIVE',revision:0});await f.store.patch('venues',{id:f.venue.id},{business_id:b.id,owner_account_id:a.id});const s=await f.store.add('staff_users',{id:randomUUID(),venue_id:f.venue.id,owner_account_id:a.id,role:'OWNER',is_active:true});const headers={authorization:'Bearer '+await auth(secrets.token).sign({kind:'staff',staff_id:s.id,venue_id:f.venue.id,role:'OWNER'},3600)};
 expect((await f.app.inject({method:'POST',url:'/v1/owner/auth/login',payload:{email:a.email,password}})).statusCode).toBe(403);expect((await f.app.inject({url:'/v1/staff/orders',headers})).statusCode).toBe(403);expect((await f.app.inject({method:'POST',url:'/v1/staff/shares/'+randomUUID()+'/cash',headers})).statusCode).toBe(403);
 await f.store.patch('businesses',{id:b.id},{state:'ACTIVE'});expect((await f.app.inject({method:'POST',url:'/v1/owner/auth/login',payload:{email:a.email,password}})).statusCode).toBe(200);expect((await f.store.rows('dining_tables',{venue_id:f.venue.id}))).toHaveLength(1);
 }finally{await f.app.close();}
});
