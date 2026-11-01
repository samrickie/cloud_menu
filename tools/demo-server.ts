// Isolated demo/test server. Not used by the production start command.
import {fixture,secrets} from '../tests/helpers.ts';
import {signQR} from '../apps/api/src/security.ts';
import {randomUUID} from 'node:crypto';
import {registerFrontends} from '../apps/api/src/frontends.ts';
const f=await fixture({guestOrigin:'http://127.0.0.1:4173'});
const menu=await f.store.add('menus',{id:randomUUID(),venue_id:f.venue.id,is_active:true,name:'DEMO menu',version:1});
for(const [index,name]of ['Drinks','Grill','Snacks'].entries()){
 const cat=await f.store.add('categories',{id:randomUUID(),menu_id:menu.id,name_en:name,name_sw:['Vinywaji','Vyakula vya kuchoma','Vitafunio'][index],is_active:true,sort_order:index});
 const item=await f.store.add('items',{id:randomUUID(),venue_id:f.venue.id,category_id:cat.id,name_en:['Vodka [DEMO]','Grilled Tilapia [DEMO]','Chips Mayai [DEMO]'][index],name_sw:['Vodka [MFANO]','Sato wa kuchoma [MFANO]','Chipsi mayai [MFANO]'][index],price_tzs:[8000,25000,6000][index],station:index===0?'BAR':'KITCHEN',is_available:index!==1,is_active:true,sort_order:index});
 if(index===0){const group=await f.store.add('modifier_groups',{id:randomUUID(),venue_id:f.venue.id,name_en:'Mixer',name_sw:'Kinywaji cha kuchanganya',selection:'SINGLE',min_select:1,max_select:1});await f.store.add('modifiers',{id:randomUUID(),group_id:group.id,name_en:'Soda',name_sw:'Soda',price_delta_tzs:0,is_available:true});await f.store.add('item_modifier_groups',{item_id:item.id,group_id:group.id});}
}
f.app.get('/__demo/qr',async()=>{const table=await f.store.add('dining_tables',{...f.table,id:randomUUID(),qr_code:randomUUID()});return {url:`/?qr=${encodeURIComponent(signQR(table.qr_code,1,secrets.qr))}`};});
await registerFrontends(f.app);
await f.app.listen({host:'127.0.0.1',port:4173});
console.log('DEMO ONLY: http://127.0.0.1:4173/?qr='+encodeURIComponent(f.qr));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void f.app.close().then(()=>process.exit(0)));
