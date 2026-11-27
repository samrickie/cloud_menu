import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {assertJsBudget} from './performance-budget.mjs';
const root=path.resolve('apps/guest-pwa/dist');
const html=await readFile(path.join(root,'index.html'),'utf8');
const entries=[...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map(m=>m[1]);
const visited=new Set();let bytes=0;
async function measure(file){if(visited.has(file))return;visited.add(file);const source=await readFile(path.join(root,file.replace(/^\//,'')));bytes+=gzipSync(source).length;for(const match of source.toString().matchAll(/(?:from\s*|import\s*)["'](\.\.?\/[^"']+\.js)["']/g))await measure(path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1])));}
for(const entry of entries)await measure(entry);
if(!entries.length)throw Error('No production JS entry found');
assertJsBudget(bytes);
const result={initial_js_gzip_bytes:bytes,files:[...visited],budget_bytes:150000};
await mkdir('.artifacts',{recursive:true});await writeFile('.artifacts/bundle.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
