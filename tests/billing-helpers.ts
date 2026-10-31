import {randomUUID} from 'node:crypto';
import {fixture} from './helpers.ts';
export async function billingFixture(){
 const f=await fixture();await f.store.patch('venues',{id:f.venue.id},{service_charge_bp:1000,vat_rate_bp:0,prices_include_vat:true});const a=(await f.init()).json(),b=(await f.init()).json();const ah={authorization:`Bearer ${a.session_token}`},bh={authorization:`Bearer ${b.session_token}`};
 const menu=await f.store.add('menus',{id:randomUUID(),venue_id:f.venue.id,is_active:true,version:1});const cat=await f.store.add('categories',{id:randomUUID(),menu_id:menu.id,name_en:'Sample data',is_active:true,sort_order:0});
 const orders=[];for(const [i,price]of [10000,20000].entries()){const item=await f.store.add('items',{id:randomUUID(),venue_id:f.venue.id,category_id:cat.id,name_en:`Sample data meal ${i+1}`,price_tzs:price,station:'KITCHEN',is_active:true,is_available:true,sort_order:i});const key=randomUUID();const response=await f.app.inject({method:'POST',url:`/v1/sessions/${a.session.id}/orders`,headers:{...(i?bh:ah),'idempotency-key':key},payload:{client_order_id:key,items:[{item_id:item.id,quantity:1}]}});if(response.statusCode!==201)throw Error(response.body);orders.push(response.json().order);}
 return {...f,a,b,ah,bh,orders};
}
