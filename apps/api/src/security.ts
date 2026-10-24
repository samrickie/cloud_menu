import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
export class Problem extends Error {
 constructor(public status:number,public code:string,message=code,public extra:Record<string,unknown>={}){super(message);}
}
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function signQR(code:string,version:number,secret:string){return `${code}.${createHmac('sha256',secret).update(`${code}:${version}`).digest('base64url')}`;}
export function checkQR(token:string,code:string,version:number,secret:string){const a=Buffer.from(token),b=Buffer.from(signQR(code,version,secret));return a.length===b.length&&timingSafeEqual(a,b);}
export function auth(secret:string){
 const key=new TextEncoder().encode(secret);
 return {
  sign:(payload:Record<string,unknown>,seconds:number,issued=Math.floor(Date.now()/1000))=>new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setIssuedAt(issued).setIssuer('cloud-menu').setAudience('cloud-menu').setExpirationTime(issued+seconds).sign(key),
  async verify(token?:string){try{return(await jwtVerify(token??'',key,{algorithms:['HS256'],issuer:'cloud-menu',audience:'cloud-menu'})).payload;}catch{throw new Problem(401,'TOKEN_INVALID','Please scan the table QR again.');}}
 };
}
