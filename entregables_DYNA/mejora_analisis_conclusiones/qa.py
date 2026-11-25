from pathlib import Path
import pypdfium2 as pdf
from PIL import Image,ImageDraw
from zipfile import ZipFile
from lxml import etree as E
r=Path(r'D:\Desktop\SISTEMA\tallersistema\entregables_DYNA\mejora_analisis_conclusiones');d=pdf.PdfDocument(r/'revision.pdf');canvas=Image.new('RGB',(1520,1540),'#aaa')
for i,page in enumerate(d):
 im=page.render(scale=1.5).to_pil();im.save(r/f'pagina-{i+1:02}.png');im.thumbnail((380,492));canvas.paste(im,((i%4)*380,(i//4)*510+15));ImageDraw.Draw(canvas).text(((i%4)*380,(i//4)*510),str(i+1),fill='black')
 text=page.get_textpage().get_text_range()
 if any(k in text for k in ['6  Conclus','6 Conclus','4.6','P5. El vacío']):print('Revisar página',i+1)
canvas.save(r/'contacto.png')
n={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(next(r.glob('*.docx'))) as z:
 t=E.fromstring(z.read('word/document.xml'));print('Referencias',len(t.findall('.//w:body/w:p/w:pPr/w:numPr',n)))
 print('Conclusiones',[ ''.join(q.xpath('.//w:t/text()',namespaces=n))[:75] for q in t.find('w:body',n).findall('w:p',n) if ''.join(q.xpath('.//w:t/text()',namespaces=n)).startswith(('P1. No','P2. Los','P3. Veintidós','P4. Diez','P5. El vacío'))])
print('Total:',len(d),'páginas')
