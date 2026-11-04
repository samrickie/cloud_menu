
import type {FastifyInstance} from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stat} from 'node:fs/promises';
export async function registerFrontends(app:FastifyInstance,appsRoot=fileURLToPath(new URL('../../',import.meta.url))){
 const builds=[{name:'admin',prefix:'/admin/'},{name:'owner',prefix:'/owner/'},{name:'staff',prefix:'/staff/'},{name:'guest-pwa',prefix:'/'}];
 for(const build of builds){if(!(await stat(path.join(appsRoot,build.name,'dist','index.html'))).isFile())throw Error('Missing frontend build: '+build.name);}
 app.addHook('onSend',async(_request,reply)=>{reply.header('Referrer-Policy','no-referrer');});
 for(const [i,build]of builds.entries())await app.register(fastifyStatic,{
  root:path.join(appsRoot,build.name,'dist'),prefix:build.prefix,decorateReply:i===0,index:['index.html'],dotfiles:'ignore',list:false,cacheControl:false,
  setHeaders(res:{header(name:string,value:string):unknown}|{setHeader(name:string,value:string):unknown},file:string){const immutable=path.basename(file).match(/-[a-zA-Z0-9_-]{8,}\.(?:js|css|woff2|webp)$/);const value=immutable?'public, max-age=31536000, immutable':'no-store';if('header' in res)res.header('Cache-Control',value);else res.setHeader('Cache-Control',value);}
 });
}
