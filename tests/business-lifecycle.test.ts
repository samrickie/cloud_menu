import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {fixture,secrets} from './helpers.ts';
import {auth} from '../apps/api/src/security.ts';
it('business controls are platform-only, preserve branch records, and require name confirmation',async()=>{
 const email='sample-admin@example.test',f=await fixture({platformAdminEmails:[email]});try{
 const a=await f.store.add('owner_accounts',{id:randomUUID(),email,full_name:'Sample administrator',is_active:true,auth_version:1,email_verified_at:new Date().toISOString()});
 const account={authorization:'Bearer '+await auth(secrets.token).sign({kind:'account',account_id:a.id,auth_version:1},3600)};
 const platform=(await f.app.inject({method:'POST',url:'/v1/platform/auth/exchange',headers:account,payload:{}})).json(),headers={authorization:'Bearer '+platform.platform_token};
 const b=await f.store.add('businesses',{id:randomUUID(),name:'Sample business',owner_account_id:a.id,state:'ACTIVE',revision:0});await f.store.patch('venues',{id:f.venue.id},{business_id:b.id});
 const change=(action:string,revision:number,confirm_name=b.name,h=headers)=>f.app.inject({method:'PATCH',url:'/v1/platform/businesses/'+b.id,headers:h,payload:{action,expected_revision:revision,confirm_name,reason:'Sample test action'}});
 expect((await change('DEACTIVATE',0,b.name,account)).statusCode).toBe(403);
 expect((await change('DELETE',0,'wrong name')).statusCode).toBe(422);
 expect((await change('DEACTIVATE',0)).statusCode).toBe(200);expect(await f.store.venueAccess(f.venue.id)).toBe(false);expect((await f.init()).statusCode).toBeGreaterThanOrEqual(400);
 expect((await change('ACTIVATE',1)).statusCode).toBe(200);expect(await f.store.venueAccess(f.venue.id)).toBe(true);
 expect((await change('DELETE',2)).statusCode).toBe(200);expect(await f.store.venueAccess(f.venue.id)).toBe(false);expect((await f.store.rows('dining_tables',{venue_id:f.venue.id}))).toHaveLength(1);
 expect((await change('RESTORE',3)).statusCode).toBe(200);expect(await f.store.venueAccess(f.venue.id)).toBe(true);
 expect((await f.app.inject({method:'DELETE',url:'/v1/platform/admins/'+a.id,headers,payload:{reason:'Sample self removal'}})).statusCode).toBe(409);
 }finally{await f.app.close();}
});
