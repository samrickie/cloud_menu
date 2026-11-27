import {requireAccountAccess} from './business-access.ts';
import type {FastifyInstance,FastifyRequest,FastifyReply} from 'fastify';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {EncryptJWT,jwtDecrypt} from 'jose';
import {hash as passwordHash} from 'bcryptjs';
import {z} from 'zod';
import type {Context} from './context.ts';
import type {SocialOptions} from './social-providers.ts';
import {hash,Problem} from './security.ts';
export function registerSocialAuth(app:FastifyInstance,ctx:Context,secret:string,options:SocialOptions|undefined,registration:boolean,limit:(key:string,max:number)=>Promise<void>){
 const key=createHash('sha256').update('cloud-menu-social:'+secret).digest(),origin=options?.origin??'',secure=origin.startsWith('https://');
 const cookie=(reply:FastifyReply,name:string,value:string,age:number)=>{const valueCookie=`${name}=${value}; HttpOnly; SameSite=Lax; Path=/v1/owner/oauth; Max-Age=${age}${secure?'; Secure':''}`,previous=reply.getHeader('Set-Cookie');return reply.header('Set-Cookie',previous?[...(Array.isArray(previous)?previous:[String(previous)]),valueCookie]:valueCookie);};
 const seal=(data:Record<string,unknown>,seconds:number)=>new EncryptJWT(data).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuer('cloud-menu-social').setAudience(origin).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+seconds).encrypt(key);
 async function unseal(req:FastifyRequest,name:string,purpose:string){try{const raw=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);if(!raw||raw.length>8000)throw Error();const {payload}=await jwtDecrypt(raw,key,{issuer:'cloud-menu-social',audience:origin,keyManagementAlgorithms:['dir'],contentEncryptionAlgorithms:['A256GCM'],requiredClaims:['exp','iat']});if(payload.purpose!==purpose)throw Error();return payload;}catch{throw new Problem(401,'OAUTH_STATE_INVALID');}}
 async function consume(stateHash:string,purpose:string){return ctx.store.tx('owner-social',async tx=>{const [flow]=await tx.rows('oauth_flows',{state_hash:stateHash,purpose});if(!flow||flow.used_at||new Date(flow.expires_at).getTime()<=Date.now())throw new Problem(401,'OAUTH_STATE_INVALID');await tx.patch('oauth_flows',{id:flow.id},{used_at:new Date().toISOString()});return flow;});}
 const checkOrigin=(req:FastifyRequest)=>{if(!origin||req.headers.origin!==origin)throw new Problem(403,'ORIGIN_FORBIDDEN');};
 app.get('/v1/owner/oauth/providers',async()=>({providers:(options?.providers??[]).map(p=>p.id)}));
 app.post('/v1/owner/oauth/:provider/start',async(req,reply)=>{
  await limit(`social-start:${req.ip}`,10);checkOrigin(req);const {provider}=z.object({provider:z.enum(['google','github'])}).parse(req.params),adapter=options?.providers.find(p=>p.id===provider);if(!adapter)throw new Problem(503,'OAUTH_UNAVAILABLE');
  const {target}=z.object({target:z.enum(['owner','platform']).default('owner')}).strict().parse(req.query);
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url');
  await ctx.store.add('oauth_flows',{id:randomUUID(),state_hash:hash(state),purpose:'authorization',provider,account_id:null,expires_at:new Date(Date.now()+300000).toISOString(),used_at:null});
  cookie(reply,'cm_social_flow',await seal({purpose:'authorization',state,provider,verifier,nonce,target},300),300);
  return {url:adapter.authorizationURL({state,challenge:createHash('sha256').update(verifier).digest('base64url'),nonce,redirectURI:origin+`/v1/owner/oauth/${provider}/callback`})};
 });
 app.get('/v1/owner/oauth/:provider/callback',async(req,reply)=>{
  await limit(`social-callback:${req.ip}`,20);const {provider}=z.object({provider:z.enum(['google','github'])}).parse(req.params),q=z.object({state:z.string().max(200),code:z.string().min(1).max(4096).optional(),error:z.string().max(200).optional()}).parse(req.query),flow=await unseal(req,'cm_social_flow','authorization');
  if(flow.state!==q.state||flow.provider!==provider)throw new Problem(401,'OAUTH_STATE_INVALID');await consume(hash(q.state),'authorization');
  cookie(reply,'cm_social_flow','',0);const adapter=options?.providers.find(p=>p.id===provider);if(!adapter)throw new Problem(503,'OAUTH_UNAVAILABLE');
  try{
   if(q.error||!q.code)throw Error('Provider declined');const identity=await adapter.identity({code:q.code,verifier:String(flow.verifier),nonce:String(flow.nonce),redirectURI:origin+`/v1/owner/oauth/${provider}/callback`});
   const account=await ctx.store.tx('owner-social',async tx=>{
    const [known]=await tx.rows('owner_identities',{provider,issuer:identity.issuer,subject:identity.subject});if(known){const [a]=await tx.rows('owner_accounts',{id:known.account_id,is_active:true});if(!a)throw Error('Account unavailable');return a;}
    if(!registration)throw Error('Registration unavailable');if((await tx.rows('owner_accounts',{email:identity.email})).length)throw Error('Explicit account linking required');
    const a=await tx.add('owner_accounts',{id:randomUUID(),email:identity.email,full_name:identity.name,password_hash:await passwordHash(randomBytes(32).toString('hex'),12),email_verified_at:new Date().toISOString(),is_active:true,auth_version:1,failed_attempts:0,first_failure_at:null,locked_until:null});
    await tx.add('owner_identities',{id:randomUUID(),account_id:a.id,provider,issuer:identity.issuer,subject:identity.subject});return a;
   });
   const ticket=randomBytes(32).toString('base64url');await ctx.store.add('oauth_flows',{id:randomUUID(),state_hash:hash(ticket),purpose:'finish',provider,account_id:account.id,expires_at:new Date(Date.now()+60000).toISOString(),used_at:null});
   // No OAuth access token or application bearer token is placed in a URL.
   cookie(reply,'cm_social_finish',await seal({purpose:'finish',ticket},60),60);return reply.code(303).redirect(origin+(flow.target==='platform'?'/admin/':'/owner/')+'?oauth=complete');
  }catch{return reply.code(303).redirect(origin+(flow.target==='platform'?'/admin/':'/owner/')+'?oauth=failed');}
 });
 app.post('/v1/owner/oauth/finish',async(req,reply)=>{
  await limit(`social-finish:${req.ip}`,20);checkOrigin(req);const payload=await unseal(req,'cm_social_finish','finish'),flow=await consume(hash(String(payload.ticket)),'finish');cookie(reply,'cm_social_finish','',0);
  const [a]=await ctx.store.rows('owner_accounts',{id:flow.account_id,is_active:true});if(!a)throw new Problem(401,'TOKEN_INVALID');
  await requireAccountAccess(ctx.store,a.id);
  return {account_token:await ctx.tokens.sign({kind:'account',account_id:a.id,auth_version:a.auth_version},3600),venues:(await ctx.store.rows('venues',{owner_account_id:a.id})).map(v=>({id:v.id,name:v.name,slug:v.slug,status:v.status,currency:v.currency}))};
 });
}
