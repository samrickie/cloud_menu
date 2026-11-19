import type {Store} from './store.ts';
import {Problem} from './security.ts';
export async function businessAvailable(store:Store,venue:string){const [v]=await store.rows('venues',{id:venue});if(!v)return false;if(!v.business_id)return true;const [b]=await store.rows('businesses',{id:v.business_id});return b?.state==='ACTIVE';}
export async function requireAccountAccess(store:Store,id:string){
 if((await store.rows('platform_admins',{account_id:id,is_active:true})).length)return;
 const businesses=await store.rows('businesses',{owner_account_id:id});
 if(businesses.length&&!businesses.some(b=>b.state==='ACTIVE'))throw new Problem(403,businesses.every(b=>b.state==='DELETED')?'BUSINESS_DELETED':'BUSINESS_UNAVAILABLE',businesses.every(b=>b.state==='DELETED')?`No account under "${businesses.map(b=>b.name).join(', ')}" exists. Contact Admin.`:'Account Deactivated. Contact Admin.');
}
