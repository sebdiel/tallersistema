from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
from copy import deepcopy
source=Path(r'D:\Downloads\requeriminetos\130983-2_Manuscrito_con_datos_de_autor_DYNA_10_paginas.docx')
out=Path(r'D:\Desktop\SISTEMA\tallersistema\entregables_DYNA\mejora_analisis_conclusiones');n={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'};W='{'+n['w']+'}'
with ZipFile(source) as z:parts={i.filename:(i,z.read(i.filename)) for i in z.infolist()}
r=E.fromstring(parts['word/document.xml'][1]);b=r.find('w:body',n);ps=b.findall('w:p',n)
def write(p,text):
 pp=p.find('w:pPr',n);rp=p.find('.//w:rPr',n)
 for c in list(p):
  if c is not pp:p.remove(c)
 rr=E.SubElement(p,W+'r')
 if rp is not None:rr.append(deepcopy(rp))
 E.SubElement(rr,W+'t').text=text
es='Esta revisión sistemática analiza cinco preguntas sobre integración, patrones arquitectónicos, indicadores, beneficios y vacíos de las Aplicaciones Web Progresivas (PWA), los motores de reglas y los indicadores clave de rendimiento (KPI) para micro-talleres. La búsqueda en nueve fuentes, con selección documentada mediante PRISMA 2020, recuperó 1247 registros e incluyó 40 estudios; diez revisiones previas aportaron contexto. El análisis identifica ausencia de integración conjunta (P1), reglas ejecutadas en el servidor sin integración directa con PWA (P2), indicadores sin aplicación a micro-talleres (P3), ventajas de las PWA condicionadas por caché, sincronización y seguridad (P4), y falta de validación arquitectónica y de campo en ese dominio (P5). Se concluye que existe evidencia sobre componentes individuales, pero no sobre los beneficios de su combinación para micro-talleres. Se requiere diseñar y evaluar esa integración. El revisor único y la cobertura limitada restringen las conclusiones al corpus analizado.'
en='This systematic review addresses five questions on integration, architectural patterns, indicators, benefits and gaps concerning Progressive Web Apps (PWA), business rule engines and key performance indicators (KPIs) for micro-workshops. Searches across nine sources, with selection documented using PRISMA 2020, retrieved 1,247 records and included 40 studies; ten previous reviews provided context. The analysis identifies no joint integration (RQ1), server-side rules without direct PWA integration (RQ2), indicators not applied to micro-workshops (RQ3), PWA advantages constrained by caching, synchronization and security (RQ4), and a lack of architectural and field validation in this domain (RQ5). Evidence supports individual components but does not establish the benefits of their combination for micro-workshops. Designing and evaluating this integration remains necessary. Single-reviewer screening and limited source coverage restrict conclusions to the corpus examined.'
assert len(es.split())<=150,(len(es.split()),'Resumen')
assert len(en.split())<=150
write(ps[10],en);write(ps[15],es)
# Integrative result analysis after P1-P5, preserving the separate evidence for each question.
h=deepcopy(ps[85]);write(h,'4.6  Síntesis del análisis de resultados');ps[113].addprevious(h)
a=deepcopy(ps[112]);write(a,'Las respuestas a P1–P5 convergen en una brecha entre disponibilidad tecnológica y evidencia de integración. P1 muestra que los beneficios individuales no equivalen a beneficios de una solución conjunta; P2 sitúa la decisión en el servidor y la autonomía en el cliente; P3 distingue métricas técnicas de KPI operativos pertinentes al taller. P4 aporta comparaciones favorables a las PWA bajo condiciones concretas, sin validar su superioridad en negocios con recursos limitados. P5 reúne esas limitaciones en una agenda de evaluación arquitectónica y de campo. En consecuencia, la integración constituye una hipótesis de diseño que requiere validación, no una solución cuya eficacia haya sido demostrada por el corpus.');ps[113].addprevious(a)
# Remove repetition in discussion to preserve the journal's page budget.
changes={114:'Los hallazgos delimitan una oportunidad de investigación y no demuestran la viabilidad o rentabilidad de una solución integrada. La contribución consiste en relacionar los componentes con sus estudios de respaldo y explicitar las condiciones bajo las cuales podrían combinarse.',115:'La tensión principal es la consistencia de las reglas centralizadas [29-31] frente a la disponibilidad local de las PWA [19,27]. La sincronización puede modificar decisiones e indicadores calculados sin conexión; su efecto conjunto en micro-talleres no fue evaluado por los estudios revisados.',116:'La calidad media de 3.74/5 no elimina sesgos ni asegura validez externa. Los indicadores operativos deben distinguirse de las métricas técnicas y de la mera presencia de tableros; resultados sólidos en otros dominios no se transfieren automáticamente a talleres.',117:'Las ventajas de las PWA dependen de conectividad, caché, plataforma y diseño experimental [11-18,24,25]. La ausencia de impacto energético significativo en [13] no demuestra ahorro. Los riesgos de seguridad [22,23] y los conflictos de sincronización [19,27] deben incorporarse a cualquier evaluación de la arquitectura propuesta.',118:'Como inferencias de diseño se plantean una PWA cliente de un servicio de decisiones y una arquitectura de microservicios con presentación desacoplada [21,29-31]. Debe definirse qué reglas funcionan sin conexión, qué datos valida el servidor y cómo se recalculan los KPI. Estas propuestas no son implementaciones validadas por la revisión.'}
for i,t in changes.items():write(ps[i],t)
conclusions=[
'La revisión de 40 estudios y diez revisiones previas permite formular conclusiones para las cinco preguntas, limitadas al corpus y a las condiciones metodológicas descritas.',
'P1. No se identificó integración conjunta de PWA, motor de reglas y KPI en los 40 estudios, ni comparación de esa combinación con gestión manual o aplicaciones nativas. La evidencia disponible respalda capacidades separadas, pero no permite atribuir beneficios a una arquitectura integrada para micro-talleres.',
'P2. Los motores de reglas documentados se ejecutan en el servidor y no se integran directamente con PWA. Consumir decisiones mediante API es un patrón candidato; su funcionamiento sin conexión exige definir reglas locales, consistencia y sincronización. Esa combinación requiere evaluación, pues no constituye un patrón validado por el corpus.',
'P3. Veintidós estudios reportan indicadores, pero solo tres los sitúan en pequeñas empresas y ninguno en micro-talleres. Las métricas de rendimiento web no sustituyen los KPI del negocio. Se requiere definir y validar indicadores del ciclo de órdenes de trabajo y del inventario de repuestos.',
'P4. Diez estudios aportan comparaciones que respaldan ventajas potenciales de las PWA en tamaño, carga, reutilización de código u operación offline, con condiciones y desafíos de caché, seguridad y sincronización. La evidencia no demuestra superioridad frente a aplicaciones nativas en organizaciones con recursos limitados.',
'P5. El vacío pendiente es un patrón replicable y una evaluación de campo de la integración en micro-talleres. La continuidad del trabajo debe contrastar decisiones, indicadores y desempeño con líneas base reales. El revisor único, las fuentes no consultadas y la heterogeneidad impiden generalizar la ausencia de integración a toda la literatura.'
]
anchor=ps[123]
for t in conclusions:
 q=deepcopy(ps[123]);write(q,t);anchor.addprevious(q)
for i in [123,124,125]:ps[i].getparent().remove(ps[i])
# Keep affiliation readable: only its letter marker is superscript.
for p in b.findall('w:p',n):
 t=''.join(p.xpath('.//w:t/text()',namespaces=n))
 if t.startswith('a Bachiller,'):
  pp=p.find('w:pPr',n)
  for e in list(p):
   if e is not pp:p.remove(e)
  for s,sup in [('a',True),(t[1:],False)]:
   rr=E.SubElement(p,W+'r');rp=E.SubElement(rr,W+'rPr');E.SubElement(rp,W+'rFonts').attrib.update({W+'ascii':'Times New Roman',W+'hAnsi':'Times New Roman'});E.SubElement(rp,W+'sz').set(W+'val','16');E.SubElement(rp,W+'i')
   if sup:E.SubElement(rp,W+'vertAlign').set(W+'val','superscript')
   tt=E.SubElement(rr,W+'t');tt.set('{http://www.w3.org/XML/1998/namespace}space','preserve');tt.text=s
parts['word/document.xml']=(parts['word/document.xml'][0],E.tostring(r,xml_declaration=True,encoding='UTF-8',standalone=True))
final=out/'130983_Manuscrito_DYNA_analisis_y_conclusiones_mejorados.docx'
with ZipFile(final,'w',ZIP_DEFLATED) as z:
 for info,data in parts.values():z.writestr(info,data)
print(final);print('Palabras Resumen:',len(es.split()),'Abstract:',len(en.split()))
