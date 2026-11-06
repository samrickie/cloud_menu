import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
import {z} from 'zod';
export interface SocialIdentity {issuer:string;subject:string;email:string;name:string}
export interface AuthorizationInput {state:string;challenge:string;nonce:string;redirectURI:string}
export interface SocialProvider {id:'google'|'github';authorizationURL:(input:AuthorizationInput)=>string;identity:(input:{code:string;verifier:string;nonce:string;redirectURI:string})=>Promise<SocialIdentity>}
export interface SocialOptions {origin:string;providers:SocialProvider[]}
const profile=z.object({email:z.email().max(254),name:z.string().trim().min(1).max(120)});
export async function verifyGoogleIdentity(idToken:string,keys:JWTVerifyGetKey,client:string,nonce:string):Promise<SocialIdentity>{
 const {payload}=await jwtVerify(idToken,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:client,algorithms:['RS256'],requiredClaims:['exp','iat','sub','nonce'],maxTokenAge:'10m'});
 if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.sub!=='string'||payload.azp!==undefined&&payload.azp!==client)throw Error('Invalid provider identity');
 const p=profile.parse(payload);return {issuer:'https://accounts.google.com',subject:payload.sub,email:p.email.toLowerCase(),name:p.name};
}
async function json(url:string,options:RequestInit={}){const r=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Provider request failed');return r.json();}
export function socialFromEnv(env:NodeJS.ProcessEnv):SocialOptions|undefined{
 const providers:SocialProvider[]=[];
 if(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET){
  const client=env.GOOGLE_CLIENT_ID,secret=env.GOOGLE_CLIENT_SECRET,keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  providers.push({id:'google',authorizationURL:input=>{const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.search=new URLSearchParams({client_id:client,response_type:'code',scope:'openid email profile',redirect_uri:input.redirectURI,state:input.state,nonce:input.nonce,code_challenge:input.challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();return u.toString();},async identity(input){
   const result=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:client,client_secret:secret,code:input.code,code_verifier:input.verifier,redirect_uri:input.redirectURI})});
   return verifyGoogleIdentity(z.string().max(20000).parse(result.id_token),keys,client,input.nonce);
  }});
 }
 if(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET){const client=env.GITHUB_CLIENT_ID,secret=env.GITHUB_CLIENT_SECRET;
  providers.push({id:'github',authorizationURL:input=>{const u=new URL('https://github.com/login/oauth/authorize');u.search=new URLSearchParams({client_id:client,redirect_uri:input.redirectURI,scope:'read:user user:email',state:input.state,code_challenge:input.challenge,code_challenge_method:'S256'}).toString();return u.toString();},async identity(input){
   const token=await json('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:client,client_secret:secret,code:input.code,code_verifier:input.verifier,redirect_uri:input.redirectURI})});
   const access=z.string().min(1).max(4096).parse(token.access_token),headers={Authorization:'Bearer '+access,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
   const user=await json('https://api.github.com/user',{headers}),emails=await json('https://api.github.com/user/emails',{headers});
   const verified=z.array(z.object({email:z.email(),primary:z.boolean(),verified:z.boolean()})).parse(emails).find(e=>e.primary&&e.verified);if(!verified)throw Error('Verified primary email required');
   const p=profile.parse({email:verified.email,name:user.name||user.login}),id=z.number().int().positive().safe().parse(user.id);return {issuer:'https://github.com',subject:String(id),email:p.email.toLowerCase(),name:p.name};
  }});
 }
 if(!providers.length)return undefined;
 const origin=new URL(z.url().parse(env.PUBLIC_ORIGIN??env.RENDER_EXTERNAL_URL)).origin;if(!origin.startsWith('https://')&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))throw Error('OAuth requires HTTPS');return {origin,providers};
}
