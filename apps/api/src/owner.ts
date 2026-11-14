import {businessAvailable,requireAccountAccess} from './business-access.ts';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import {z} from 'zod';
import {hash as passwordHash,compare} from 'bcryptjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {resolveTheme,validateTheme} from '../../../packages/ui/src/theme.ts';
import type {Context} from './context.ts';
import type {Row} from './store.ts';
import {initialTrial} from './subscription-access.ts';
import {Problem} from './security.ts';

const email=z.email().max(254).transform(v=>v.toLowerCase());
const password=z.string().min(12).max(72).refine(v=>Buffer.byteLength(v,'utf8')<=72);
const reserved=new Set(['www','api','admin','owner','staff','app','guest','support','mail','static','assets','localhost']);
const slug=z.string().trim().toLowerCase().min(3).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).refine(v=>!reserved.has(v));
const presets:Record<string,[string,string,string][]>= {
 RESTAURANT:[['Meals','Milo','KITCHEN'],['Drinks','Vinywaji','BAR']],
 BAR:[['Drinks','Vinywaji','BAR'],['Snacks','Vitafunio','KITCHEN']],
 LOUNGE:[['Cocktails','Koktel','BAR'],['Drinks','Vinywaji','BAR'],['Food','Chakula','KITCHEN']],
 CAFE:[['Coffee & tea','Kahawa na chai','BAR'],['Food','Chakula','KITCHEN']],
 FAST_FOOD:[['Meals','Milo','KITCHEN'],['Drinks','Vinywaji','BAR']],
 HOTEL:[['Dining','Chakula','KITCHEN'],['Drinks','Vinywaji','BAR']],CUSTOM:[]
};
const day=z.object({opens:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),closes:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),closed:z.boolean().default(false)}).strict();
const siteInput=z.object({theme:z.enum(['noir','ivory','bordeaux','sapphire','custom']).optional(),template:z.enum(['lounge','cafe','grill','minimal']).optional(),brand_colour:z.string().regex(/^#[a-f0-9]{6}$/i).nullable().optional(),primary_text:z.string().regex(/^#[a-f0-9]{6}$/i).nullable().optional(),languages:z.array(z.enum(['en','sw'])).min(1).max(2).refine(v=>new Set(v).size===v.length).optional(),sections:z.array(z.enum(['Menu','Offers','Gallery','Reviews','Contact'])).min(1).max(5).refine(v=>new Set(v).size===v.length&&v.includes('Menu')).optional(),welcome_en:z.string().trim().max(500).optional(),welcome_sw:z.string().trim().max(500).optional(),hours:z.record(z.enum(['mon','tue','wed','thu','fri','sat','sun']),day).optional(),logo_key:z.null().optional(),cover_key:z.null().optional()}).strict();
const publicVenue=(v:Row)=>({id:v.id,name:v.name,slug:v.slug,status:v.status,currency:v.currency});
const publicSite=(p:Row)=>({tips_enabled:p.tips_enabled??false,venue_type:p.venue_type,theme:p.theme,template:p.template,brand_colour:p.brand_colour,primary_text:p.primary_text,languages:p.languages,sections:p.sections,welcome_en:p.welcome_en,welcome_sw:p.welcome_sw,hours:p.hours,logo_key:p.logo_key,cover_key:p.cover_key,is_sample:p.is_sample});

export function registerOwner(app:FastifyInstance,ctx:Context,limit:(key:string,max:number)=>Promise<void>,registrationEnabled=true){
 const accountToken=(a:Row)=>ctx.tokens.sign({kind:'account',account_id:a.id,auth_version:a.auth_version},3600);
 const staffToken=(s:Row)=>ctx.tokens.sign({kind:'staff',staff_id:s.id,venue_id:s.venue_id,role:s.role},3600);
 async function account(req:FastifyRequest){const p=await ctx.tokens.verify(req.headers.authorization?.replace(/^Bearer /,''));if(p.kind!=='account')throw new Problem(403,'ROLE_FORBIDDEN');const [a]=await ctx.store.rows('owner_accounts',{id:p.account_id,is_active:true});if(!a||a.auth_version!==p.auth_version)throw new Problem(401,'TOKEN_INVALID');await requireAccountAccess(ctx.store,a.id);return a;}
 async function owner(req:FastifyRequest){const staff=await ctx.staff(req,['OWNER']);if(!staff.owner_account_id)throw new Problem(403,'OWNER_ACCOUNT_REQUIRED');const [a]=await ctx.store.rows('owner_accounts',{id:staff.owner_account_id,is_active:true});const [v]=await ctx.store.rows('venues',{id:staff.venue_id,owner_account_id:staff.owner_account_id});if(!a||!v)throw new Problem(403,'ROLE_FORBIDDEN');return {staff,a,v};}
 app.post('/v1/owner/accounts',async(req,reply)=>{
  await limit(`owner-register:${req.ip}`,5);if(!registrationEnabled)throw new Problem(503,'REGISTRATION_UNAVAILABLE');
  const input=z.object({name:z.string().trim().min(2).max(120).regex(/^[^\p{Cc}]+$/u),email,password}).strict().parse(req.body);
  const digest=await passwordHash(input.password,12);
  const a=await ctx.store.tx('owner-email:'+input.email,async tx=>{if((await tx.rows('owner_accounts',{email:input.email})).length)throw new Problem(409,'ACCOUNT_UNAVAILABLE');return tx.add('owner_accounts',{id:randomUUID(),email:input.email,full_name:input.name,password_hash:digest,email_verified_at:null,is_active:true,auth_version:1,failed_attempts:0,first_failure_at:null,locked_until:null});});
  reply.code(201);return {account:{id:a.id,name:a.full_name,email:a.email,email_verified:false},account_token:await accountToken(a)};
 });
 app.post('/v1/owner/auth/login',async req=>{
  await limit(`owner-login:${req.ip}`,10);const input=z.object({email,password:z.string().max(256)}).strict().parse(req.body);
  const result=await ctx.store.tx('owner-email:'+input.email,async tx=>{
   const [a]=await tx.rows('owner_accounts',{email:input.email,is_active:true});
   if(!a){await passwordHash('invalid-account-comparison',12);return undefined;}
   if(a.locked_until&&new Date(a.locked_until).getTime()>Date.now())return undefined;
   if(Buffer.byteLength(input.password)>72||!await compare(input.password,a.password_hash)){
    const recent=a.first_failure_at&&Date.now()-new Date(a.first_failure_at).getTime()<600000;const count=recent?a.failed_attempts+1:1;
    await tx.patch('owner_accounts',{id:a.id},{failed_attempts:count,first_failure_at:recent?a.first_failure_at:new Date().toISOString(),locked_until:count>=5?new Date(Date.now()+900000).toISOString():null});return undefined;
   }
   await tx.patch('owner_accounts',{id:a.id},{failed_attempts:0,first_failure_at:null,locked_until:null});return a;
  });
  if(!result)throw new Problem(401,'LOGIN_INVALID');await requireAccountAccess(ctx.store,result.id);return {account_token:await accountToken(result),venues:(await ctx.store.rows('venues',{owner_account_id:result.id})).map(publicVenue)};
 });
 app.post('/v1/owner/venues',async(req,reply)=>{
  await limit(`owner-venue:${req.ip}`,10);const a=await account(req);const input=z.object({name:z.string().trim().min(2).max(120).regex(/^[^\p{Cc}]+$/u),slug,business_id:z.uuid().optional(),street:z.string().trim().max(200).default(''),area:z.string().trim().max(120).default(''),city:z.string().trim().max(120).default(''),phone:z.string().trim().max(40).default(''),tips_enabled:z.boolean().default(false),venue_type:z.enum(['RESTAURANT','BAR','LOUNGE','CAFE','FAST_FOOD','HOTEL','CUSTOM'])}).strict().parse(req.body);
  const pin=await passwordHash(randomBytes(32).toString('hex'),12);
  const result=await ctx.store.tx('venue-slug:'+input.slug,async tx=>{
   if((await tx.rows('venues',{slug:input.slug})).length)throw new Problem(409,'SLUG_UNAVAILABLE');
   if(input.business_id){const [business]=await tx.rows('businesses',{id:input.business_id,owner_account_id:a.id,state:'ACTIVE'});if(!business)throw new Problem(404,'BUSINESS_NOT_FOUND');}else{input.business_id=randomUUID();await tx.add('businesses',{id:input.business_id,name:input.name,owner_account_id:a.id,state:'ACTIVE',revision:0});}
   const v=await tx.add('venues',{id:randomUUID(),name:input.name,slug:input.slug,owner_account_id:a.id,business_id:input.business_id??randomUUID(),street:input.street,area:input.area,city:input.city,phone:input.phone,status:'TRIAL',currency:'TZS',max_participants:20});
   await initialTrial(tx,v.id);
   const s=await tx.add('staff_users',{id:randomUUID(),venue_id:v.id,owner_account_id:a.id,full_name:a.full_name,role:'OWNER',pin_hash:pin,is_active:true,failed_attempts:0});
   await tx.add('venue_profiles',{venue_id:v.id,venue_type:input.venue_type,tips_enabled:input.tips_enabled,theme:'noir',template:'lounge',brand_colour:null,primary_text:null,languages:['en','sw'],sections:['Menu','Offers','Gallery','Reviews','Contact'],welcome_en:'',welcome_sw:'',hours:{},logo_key:null,cover_key:null,is_published:false,is_sample:false});
   const menu=await tx.add('menus',{id:randomUUID(),venue_id:v.id,name:'Menu',is_active:true,version:1});
   for(const [i,[name_en,name_sw,default_station]] of presets[input.venue_type].entries())await tx.add('categories',{id:randomUUID(),menu_id:menu.id,name_en,name_sw,default_station,sort_order:i,is_active:true});
   let [sampleCategory]=await tx.rows('categories',{menu_id:menu.id});if(!sampleCategory)sampleCategory=await tx.add('categories',{id:randomUUID(),menu_id:menu.id,name_en:'Sample data',name_sw:'Data ya mfano',is_active:true,sort_order:0});
   await tx.add('items',{id:randomUUID(),venue_id:v.id,category_id:sampleCategory.id,name_en:'Sample data — replace before publishing',name_sw:'Data ya mfano — badilisha kabla ya kuchapisha',price_tzs:0,station:'KITCHEN',is_active:true,is_available:false,is_sample:true,sort_order:0});
   await tx.add('venue_halls',{id:randomUUID(),venue_id:v.id,name:'Main hall'});
   await tx.add('dining_tables',{id:randomUUID(),venue_id:v.id,label:'Table 1',zone:'Main hall',seats:4,qr_code:randomBytes(16).toString('base64url'),qr_key_version:1,qr_format:2,is_active:true,is_sample:true});
   return {v,s};
  });reply.code(201);return {venue:publicVenue(result.v),staff_token:await staffToken(result.s),category_defaults:presets[input.venue_type].map(([name_en,name_sw,station])=>({name_en,name_sw,station}))};
 });
 app.post('/v1/owner/venues/:id/select',async req=>{const a=await account(req);const {id}=z.object({id:z.uuid()}).parse(req.params);const [v]=await ctx.store.rows('venues',{id,owner_account_id:a.id});const [s]=await ctx.store.rows('staff_users',{venue_id:id,owner_account_id:a.id,is_active:true,role:'OWNER'});if(!v||!s)throw new Problem(404,'VENUE_NOT_FOUND');if(!await businessAvailable(ctx.store,id))throw new Problem(403,'BUSINESS_UNAVAILABLE');return {venue:publicVenue(v),staff_token:await staffToken(s)};});
 app.get('/v1/owner/site',async req=>{const {v,a}=await owner(req);const [p]=await ctx.store.rows('venue_profiles',{venue_id:v.id});return {venue:publicVenue(v),site:p?publicSite(p):null,email_verified:!!a.email_verified_at,is_published:!!p?.is_published};});
 app.put('/v1/owner/site',async req=>{
  const {v}=await owner(req);const change=siteInput.parse(req.body);if(!Object.keys(change).length)throw new Problem(422,'VALIDATION_ERROR');
  return ctx.store.tx(`venue:${v.id}`,async tx=>{const [p]=await tx.rows('venue_profiles',{venue_id:v.id});if(!p)throw new Problem(404,'SITE_NOT_FOUND');const next={...p,...change};try{if(validateTheme(resolveTheme(next.theme??'noir',next.brand_colour??undefined,next.primary_text??undefined)).length)throw Error();}catch{throw new Problem(422,'THEME_CONTRAST_FAILED');}await tx.patch('venue_profiles',{venue_id:v.id},change);return {site:publicSite(next)};});
 });
 app.post('/v1/owner/site/publish',async req=>{
  const {v,a}=await owner(req);return ctx.store.tx(`venue:${v.id}`,async tx=>{const [p]=await tx.rows('venue_profiles',{venue_id:v.id});const items=await tx.rows('items',{venue_id:v.id,is_active:true});const tables=await tx.rows('dining_tables',{venue_id:v.id,is_active:true});const missing=[!a.email_verified_at&&'verified_account',!items.some(i=>!i.is_sample)&&'menu',!tables.some(t=>!t.is_sample)&&'tables',!p&&'template',!['ACTIVE','TRIAL'].includes(v.status)&&'venue_active'].filter(Boolean);if(missing.length)throw new Problem(422,'ONBOARDING_INCOMPLETE','Complete the required setup steps.',{missing});await tx.patch('venue_profiles',{venue_id:v.id},{is_published:true});await tx.add('audit_log',{venue_id:v.id,actor_type:'STAFF',actor_id:(await ctx.staff(req)).id,action:'SITE_PUBLISHED',entity_type:'venue',entity_id:v.id,data:{}});return {published:true};});
 });
 app.get('/v1/sites/:slug',async req=>{
  await limit(`site:${req.ip}`,60);const {slug:value}=z.object({slug}).parse(req.params);const [v]=await ctx.store.rows('venues',{slug:value});if(!v||!await ctx.store.venueAccess(v.id))throw new Problem(404,'SITE_NOT_FOUND');const [p]=await ctx.store.rows('venue_profiles',{venue_id:v.id,is_published:true});if(!p)throw new Problem(404,'SITE_NOT_FOUND');const items=await ctx.store.rows('items',{venue_id:v.id,is_active:true});return {venue:publicVenue(v),site:publicSite(p),items:items.map(i=>({id:i.id,name_en:i.name_en,name_sw:i.name_sw,description_en:i.description_en,description_sw:i.description_sw,price_tzs:i.price_tzs,image_key:i.image_key,is_available:i.is_available,is_sample:i.is_sample}))};
 });
}
