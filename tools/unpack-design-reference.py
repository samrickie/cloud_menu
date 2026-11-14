"""Read-only extraction of the user-supplied saved canvas; executes no embedded JS."""
import re,json,base64,gzip,hashlib,sys
from pathlib import Path
source=Path(sys.argv[1]);out=Path('.artifacts/design-reference');out.mkdir(parents=True,exist_ok=True)
assets=out/'assets';assets.mkdir(exist_ok=True)
pages=[];font_entries={}
def islands(text):return {re.search(r'type=[\"\']([^\"\']+)',a).group(1):json.loads(t) for a,t in re.findall(r'<script([^>]*)>(.*?)</script>',text,re.S) if '__bundler/' in a}
def unpack(text,name):
 data=islands(text)
 if not data:
  (out/(name+'.html')).write_text(text,encoding='utf8');pages.append((name,len(text)));return
 manifest=data.get('__bundler/manifest',{});template=data.get('__bundler/template','');order=data.get('__bundler/page_order',[]);mapping={};children={}
 for uid,e in manifest.items():
  raw=base64.b64decode(e['data']);raw=gzip.decompress(raw) if e.get('compressed') else raw
  if uid in order:children[uid]=raw.decode('utf8');continue
  suffix={'text/css':'.css','application/javascript':'.js','text/javascript':'.js','font/woff2':'.woff2','font/woff':'.woff','image/png':'.png','image/jpeg':'.jpg','image/svg+xml':'.svg'}.get(e['mime'],'.asset')
  filename=hashlib.sha256(raw).hexdigest()[:24]+suffix;(assets/filename).write_bytes(raw);mapping[uid]='assets/'+filename
  if e['mime'].startswith('font/'):font_entries[filename]={'mime':e['mime'],'bytes':len(raw)}
 for uid,path in mapping.items():template=template.replace(uid,path)
 for filename in assets.glob('*.css'):
  css=filename.read_text(encoding='utf8')
  for uid,path in mapping.items():css=css.replace(uid,path.removeprefix('assets/'))
  filename.write_text(css,encoding='utf8')
 titles=re.findall(r'<h2>(.*?)</h2>\s*<iframe[^>]*src="about:blank#([^"]+)"',template,re.S)
 for i,(uid,child)in enumerate(children.items()):
  title=next((t for t,u in titles if u==uid),name+'-'+str(i+1));slug=re.sub(r'[^a-z0-9]+','-',title.lower().replace('&amp;','and')).strip('-');unpack(child,slug)
  template=template.replace('about:blank#'+uid,slug+'.html')
 (out/(name+'.html')).write_text(template,encoding='utf8');pages.append((name,len(template)))
unpack(source.read_text(encoding='utf8'),'index')
license_text=re.search(r'<!--(.*?)-->',source.read_text(encoding='utf8'),re.S).group(1)
(out/'FONT_LICENSES.txt').write_text(license_text,encoding='utf8')
(out/'manifest.json').write_text(json.dumps({'pages':pages,'fonts':font_entries},indent=2))
print(json.dumps({'pages':pages,'fonts':len(font_entries)}))
