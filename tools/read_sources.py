from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
import json

root = Path(__file__).resolve().parents[1]
paths = {
 '01_Vision_Charter_Personas.docx': 'docs/01-vision/01_Vision_Charter_Personas.docx',
 '02_Product_Backlog.xlsx': 'docs/02-backlog/02_Product_Backlog.xlsx',
 '03_Architecture_API_Spec.docx': 'docs/03-architecture/03_Architecture_API_Spec.docx',
 '03_Architecture_API_Spec.pdf': 'docs/03-architecture/03_Architecture_API_Spec.pdf',
 '03_cloud_menu_schema.sql': 'db/migrations/0001_init.sql',
 '04_Wireframes_Flows_Roadmap.pptx': 'docs/04-planning/04_Wireframes_Flows_Roadmap.pptx',
 '04_Roadmap_and_Risk_Matrix.xlsx': 'docs/04-planning/04_Roadmap_and_Risk_Matrix.xlsx',
}
out = root / '.source-text'
out.mkdir(exist_ok=True)
with ZipFile('C:/Users/e00922585/Downloads/files.zip') as archive:
 for name, dest in paths.items():
  target = root / dest
  target.parent.mkdir(parents=True, exist_ok=True)
  target.write_bytes(archive.read(name))
  lines = []
  if target.suffix == '.sql':
   lines = [target.read_text(encoding='utf-8')]
  elif target.suffix in ('.docx', '.pptx'):
   with ZipFile(target) as z:
    members = ['word/document.xml'] if target.suffix == '.docx' else sorted([n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')], key=lambda n:int(n.split('slide')[-1].split('.')[0]))
    for member in members:
     tree = ET.fromstring(z.read(member))
     lines.append(member)
     for p in tree.iter():
      if p.tag.rsplit('}',1)[-1] == 'p':
       texts = [x.text or '' for x in p.iter() if x.tag.rsplit('}',1)[-1] == 't']
       if texts: lines.append(''.join(texts))
  elif target.suffix == '.xlsx':
   import openpyxl
   wb = openpyxl.load_workbook(target, data_only=False)
   for ws in wb:
    lines.append('SHEET: '+ws.title)
    for row in ws.iter_rows():
     values = [f'{c.column_letter}: {c.value}' for c in row if c.value is not None]
     if values: lines.append(f'ROW {row[0].row}: '+' | '.join(values))
  if lines:
   (out / (target.stem+'.txt')).write_text('\n'.join(lines),encoding='utf-8')
print('\n'.join(p.name for p in out.iterdir()))
