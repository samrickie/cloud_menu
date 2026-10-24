import pg from 'pg';
import {randomBytes,randomUUID} from 'node:crypto';
import {hash} from 'bcryptjs';
import {signQR} from '../apps/api/src/security.ts';
if(!process.env.DATABASE_URL||!process.env.DEMO_STAFF_PIN||!process.env.QR_SECRET)throw Error('Set DATABASE_URL, DEMO_STAFF_PIN and QR_SECRET explicitly. This command creates DEMO data.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
try{await client.query('BEGIN');let {rows:[venue]}=await client.query("SELECT * FROM venues WHERE slug='cloud-menu-demo'");if(venue)throw Error('Demo venue already exists; no data overwritten.');
 ({rows:[venue]}=await client.query("INSERT INTO venues(slug,name,status) VALUES('cloud-menu-demo','Cloud-Menu DEMO Venue','ACTIVE') RETURNING *"));
 const {rows:[staff]}=await client.query("INSERT INTO staff_users(venue_id,full_name,role,pin_hash) VALUES($1,'DEMO Manager','MANAGER',$2) RETURNING id",[venue.id,await hash(process.env.DEMO_STAFF_PIN,12)]);
 const {rows:[menu]}=await client.query("INSERT INTO menus(venue_id,name) VALUES($1,'DEMO menu') RETURNING id",[venue.id]);
 for(const [i,name]of ['Drinks','Grill','Snacks'].entries()){const {rows:[c]}=await client.query('INSERT INTO categories(menu_id,name_en,name_sw,sort_order) VALUES($1,$2,$3,$4) RETURNING id',[menu.id,name,['Vinywaji','Vyakula vya kuchoma','Vitafunio'][i],i]);await client.query('INSERT INTO items(venue_id,category_id,name_en,name_sw,price_tzs,station,is_available) VALUES($1,$2,$3,$4,$5,$6,$7)',[venue.id,c.id,['Soda [DEMO]','Grilled Tilapia [DEMO]','Chips Mayai [DEMO]'][i],['Soda [MFANO]','Sato wa kuchoma [MFANO]','Chipsi mayai [MFANO]'][i],[2000,25000,6000][i],i===0?'BAR':'KITCHEN',i!==1]);}
 const {rows:[table]}=await client.query("INSERT INTO dining_tables(id,venue_id,label,qr_code) VALUES($1,$2,'T12',$3) RETURNING *",[randomUUID(),venue.id,randomBytes(12).toString('base64url')]);await client.query('COMMIT');
 console.log('DEMO venue code: cloud-menu-demo');console.log('DEMO manager staff identifier: '+staff.id);const url=new URL('/',process.env.GUEST_ORIGIN??'http://localhost:5173');url.searchParams.set('qr',signQR(table.qr_code,1,process.env.QR_SECRET));console.log('DEMO guest URL: '+url);
}catch(e){await client.query('ROLLBACK');throw e;}finally{await client.end();}
