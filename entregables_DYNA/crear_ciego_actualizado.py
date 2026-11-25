from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
src=Path(r'D:\Downloads\requeriminetos\2.Manuscrito_DYNA_analisis_y_conclusiones_mejorados.docx');out=Path(r'D:\Desktop\SISTEMA\tallersistema\entregables_DYNA\manuscrito_ciego_actualizado');out.mkdir(exist_ok=True)
n={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
ident=['Sebastian Fernando','SEBASTIAN.GOMEZ@UAB.EDU.BO','S.F. Gómez-Huanco','ORCID:','Biografía del autor']
def text(p):return ''.join(p.xpath('.//w:t/text()',namespaces=n))
with ZipFile(src) as z:parts={i.filename:(i,z.read(i.filename)) for i in z.infolist()}
r=E.fromstring(parts['word/document.xml'][1]);removed=[]
for p in list(r.find('w:body',n).findall('w:p',n)):
 if any(x in text(p) for x in ident):removed.append(text(p));p.getparent().remove(p)
original=E.fromstring(parts['word/document.xml'][1]);keep=[text(p) for p in original.find('w:body',n).findall('w:p',n) if text(p) not in removed]
assert keep==[text(p) for p in r.find('w:body',n).findall('w:p',n)]
parts['word/document.xml']=(parts['word/document.xml'][0],E.tostring(r,xml_declaration=True,encoding='UTF-8',standalone=True))
for name in ['docProps/core.xml','docProps/app.xml']:
 if name not in parts:continue
 t=E.fromstring(parts[name][1])
 for q in t.iter():
  if E.QName(q).localname in ['creator','lastModifiedBy','Company','Manager']:q.text=''
 parts[name]=(parts[name][0],E.tostring(t,xml_declaration=True,encoding='UTF-8',standalone=True))
final=out/'1_Manuscrito_ciego_DYNA_actualizado.docx'
with ZipFile(final,'w',ZIP_DEFLATED) as z:
 for info,data in parts.values():z.writestr(info,data)
print(final);print('Elementos identificativos retirados:',len(removed));print('Contenido restante idéntico al manuscrito 2.')
