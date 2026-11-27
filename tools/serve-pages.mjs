// Local verification server for the standalone GitHub Pages preview only.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname).replace(/^\/cloud_menu\//,'/');if(name!=='/'&&!/^\/pages\/[a-zA-Z0-9/_.-]+$/.test(name)){res.writeHead(404).end();return;}const target=path.resolve(root,name==='/'?'index.html':'.'+name);if(!target.startsWith(root+path.sep)){res.writeHead(404).end();return;}const data=await readFile(target);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.txt':'text/plain'}[path.extname(target)]??'application/octet-stream'));res.end(data);}catch{res.writeHead(404).end();}});
server.listen(4180,'127.0.0.1');
