from pathlib import Path
import json
P=Path(__file__).parent
slides=[]
BLUE='#003264'; GRAY='#627792'
def slide(bg,title='',subtitle=''):
 s={'bg':bg,'texts':[],'notes':''};slides.append(s)
 if title: text(s,title,36,36,1320,48,30,True,'#ffffff')
 if subtitle:text(s,subtitle,36,80,1320,24,15,False,'#d1ae00')
 return s
def text(s,t,x,y,w,h,size=28,bold=False,color=BLUE,align='left'):
 s['texts'].append(dict(text=t,x=x,y=y,w=w,h=h,size=size,bold=bold,color=color,align=align))
def four(title,items,subtitle='',notes=''):
 s=slide(6,title,subtitle)
 for i,(label,heading,body) in enumerate(items):
  x=54+(i%2)*698;y=150+(i//2)*306
  text(s,label,x,y,60,36,18,True,'#ffffff')
  text(s,heading,x,y+60,620,55,29,True)
  text(s,body,x,y+119,615,140,27,False,GRAY)
 s['notes']=notes
 return s
def six(title,items,notes=''):
 s=slide(9);text(s,title,40,8,1360,65,44,True,'#ffffff','center')
 for i,(heading,body) in enumerate(items):
  x=63+(i%3)*466;y=165+(i//3)*314
  text(s,heading,x+100,y,310,65,25,True)
  text(s,body,x,y+90,405,155,27,False,BLUE)
 s['notes']=notes;return s

# Se conserva íntegra la portada del PDF de referencia.
s=slide(1);s['original']=True
s['notes']='Apertura sugerida: ¿Alguna vez llevaste tu vehículo al taller y no quedó claro cómo calcularon el costo final? Presentar el proyecto y enlazar con el proceso actual. Fuente: portada de la presentación original y retroalimentación docente, p. 1.'
s=slide(3);text(s,'ANTECEDENTES: PROCESO OPERATIVO ACTUAL',240,40,1130,65,36,True)
heads=['1. Recepción del cliente','2. Presupuesto empírico','3. Ejecución del servicio','4. Registro de repuestos','5. Cobro y pago','6. Historial disperso']
bodies=['Datos en cuadernos\ny hojas sueltas.','Estimación basada en\nla experiencia.','Seguimiento de tareas\nsin registro integrado.','Vales separados de\nla orden de trabajo.','Ingresos anotados en\nun cuaderno aparte.','Búsquedas prolongadas\ny decisiones intuitivas.']
for i in range(6):
 x=53+(i%3)*460;y=157+(i//3)*317
 text(s,heads[i],x,y,413,53,23,True,'#ffffff')
 text(s,bodies[i],x+70,y+75,345,145,29,False,GRAY)
s['notes']='Explicar brevemente la secuencia desde recepción hasta cobro. Los datos técnicos, el consumo de repuestos y el pago quedan separados. No leer un párrafo por etapa. Se incorporó este proceso dentro de antecedentes y se retiró la diapositiva redundante de antecedentes. Fuente: presentación original, pp. 2–3; documento del proyecto, sección 3.1.3; retroalimentación docente, pp. 1–2.'
s=slide(4,'SITUACIÓN PROBLEMÁTICA','CAUSAS Y CONSECUENCIAS EN LA GESTIÓN DEL TALLER')
items=[('Registros\nfragmentados','Duplicidad y dificultad\npara consultar\nhistoriales.'),('Inventario\naislado','Diferencias entre\nel stock físico y\nel registrado.'),('Procesos\nempíricos','Variaciones en\ncostos y tiempos\nde reparación.'),('Datos sin\nconsolidar','Dificultad para\ncalcular indicadores\ny comparar períodos.'),('Recursos\nlimitados','Dificultades de\ninfraestructura y\ncapacitación.')]
for i,(a,b) in enumerate(items):
 x=54+278*i;text(s,str(i+1),x+102,170,32,35,18,True,'#ffffff','center');text(s,a,x,242,218,105,28,True);text(s,b,x,380,218,190,27,False,GRAY)
s['notes']='Formulación del problema, tal como figura en el documento: La aplicación de procedimientos manuales desarticulados y sin estandarización en el proceso de gestión operativa de talleres mecánicos de microempresa en Cochabamba provoca pérdida de información histórica, inconsistencias en el control de repuestos, errores en la estimación de costos y ausencia de indicadores para la toma de decisiones administrativas. Las limitaciones tecnológicas son condiciones del contexto. Fuente: proyecto, pp. PDF 21–22, secciones 3.2.1–3.2.2.'
s=slide(5);s['original']=True;s['notes']='Objetivo general conservado íntegro, según lo solicitado por el docente. Fuente: proyecto, p. PDF 23.'
four('OBJETIVOS ESPECÍFICOS',[
 ('OE1','Gestión de usuarios y ficha vehicular','Desarrollar el módulo de gestión de usuarios, registro de clientes y ficha técnica vehicular para el control e historial centralizado de las operaciones.'),
 ('OE2','Órdenes de trabajo e inventario offline','Implementar el módulo transaccional de órdenes de trabajo y control de inventario con motor de persistencia local (Local-First / Offline) para garantizar el registro de servicios sin conexión a internet.'),
 ('OE3','Costos automatizados y Dashboard','Desarrollar el módulo de cálculo automatizado de costos y el panel de análisis de datos (Dashboard) para la visualización en tiempo real de indicadores clave de rendimiento (KPIs).'),
 ('OE4','Administración global (SuperAdmin)','Construir el módulo de administración global (SuperAdmin) y despliegue en servidor Cloud (VPS) para la gestión de suscripciones y mantenimiento continuo del sistema comercial.')
], 'PARA ALCANZAR EL OBJETIVO GENERAL','Objetivos completos conservados conforme al documento, p. PDF 23. Cada objetivo corresponde a una entrega de las cuatro iteraciones.')
six('ALCANCE DEL SISTEMA',[
 ('Usuarios y roles','Accesos diferenciados para SuperAdmin, administrador y mecánico.'),
 ('Clientes y vehículos','Información centralizada e historial técnico por vehículo.'),
 ('Órdenes de trabajo','Seguimiento desde la recepción hasta la entrega.'),
 ('Inventario y costos','Repuestos vinculados a la orden, mano de obra y pagos.'),
 ('PWA y trabajo offline','Registro local y sincronización al recuperar conexión.'),
 ('Indicadores y plataforma','Dashboard operativo y administración de talleres y suscripciones.')
], 'Se integró la solución propuesta dentro del alcance para evitar repeticiones, como indicó el docente. Fuente: proyecto, secciones 3.4 y 3.13, pp. PDF 24–25 y 44–46. La información compartida se consolida después de sincronizar; offline no equivale a stock global actualizado en todos los dispositivos.')
four('LÍMITES DEL PROYECTO',[
 ('01','Gestión operativa','Sin facturación electrónica del SIN ni libros contables formales.'),
 ('02','Uso interno del taller','Sin aplicación independiente de seguimiento para el cliente final.'),
 ('03','Sin integración de diagnóstico','No contempla dispositivos IoT ni lectura automática de equipos OBD2.'),
 ('04','Implementación delimitada','Sin migración masiva de cuadernos ni provisión de equipos o conectividad.')
],notes='También se excluye el soporte gratuito indefinido después de la fase académica. Fuente: proyecto, sección 3.5, p. PDF 25.')
four('METODOLOGÍA DE DESARROLLO: XP',[
 ('I1','Usuarios, clientes y vehículos','Historias de usuario y criterios de aceptación para el acceso y el historial vehicular.'),
 ('I2','Órdenes e inventario offline','Desarrollo incremental del servicio, movimientos de stock y sincronización.'),
 ('I3','Costos e indicadores','Cálculo de importes, pagos y consultas de indicadores por período.'),
 ('I4','SuperAdmin y despliegue','Gestión de talleres y suscripciones, HTTPS y respaldos en VPS.')
], '29 HISTORIAS DE USUARIO · 4 ITERACIONES ALINEADAS CON LOS OBJETIVOS', 'XP adaptada al desarrollo individual. En cada iteración: planificación con historias, diseño simple, implementación y refactorización, integración del frontend y backend, y pruebas de aceptación. No se afirma programación en parejas ni TDD. Fuente: proyecto, sección 3.12, p. PDF 42, e iteraciones 3.14–3.17.')
s=slide(8);text(s,'ARQUITECTURA GENERAL DEL SISTEMA',10,22,1120,65,43,True,'#ffffff');text(s,'Angular · NestJS · PostgreSQL',1125,60,300,30,19,True,'#e4b800','right')
text(s,'CAPA DE PRESENTACIÓN: PWA Angular 18 + Service Worker + IndexedDB (Dexie)',58,148,1300,40,22,True,'#e4b800')
for i,t in enumerate(['Usuarios','Clientes / vehículos','Órdenes de trabajo','Inventario','Costos','Dashboard KPIs']):text(s,t,68+i*224,215,210,65,18,True,BLUE,'center')
text(s,'API REST / HTTPS',600,305,300,35,20,False,GRAY,'center')
text(s,'CAPA DE NEGOCIO: API NestJS 10 (TypeScript)',58,347,1250,38,23,True,'#50d5cc')
for i,t in enumerate(['Reglas de negocio','JWT y roles','Controladores REST','Sincronización','Consultas de KPIs']):text(s,t,68+i*268,412,252,65,19,True,'#ffffff','center')
text(s,'TypeORM / consultas SQL',565,500,400,35,20,False,GRAY,'center')
text(s,'CAPA DE DATOS: PostgreSQL 16',58,540,1100,40,24,True,'#e4b800')
for i,t in enumerate(['usuarios','clientes','vehículos','órdenes','detalle / pagos','repuestos','servicios']):text(s,t,70+i*150,605,140,50,16,False,'#dce6f2','center')
text(s,'RESPALDOS\nDIARIOS',1180,573,210,80,24,True,'#ffffff','center')
text(s,'Despliegue: Docker Compose + Caddy + VPS Ubuntu',290,700,1050,35,21,False,'#ffffff','center')
s['logos']=True;s['notes']='Arquitectura basada en la sección técnica actual del documento (pp. PDF 44–46). La presentación anterior utilizaba React/Laravel/MySQL y se actualizó a Angular/NestJS/PostgreSQL para concordar con esa sección. Confirmar que coincide con la implementación vigente. Service Worker e IndexedDB pertenecen al cliente. El backend valida y aplica operaciones sincronizadas. Cuatro contenedores: web Caddy, backend NestJS, PostgreSQL y backup. Fuente de logos: Simple Icons (https://simpleicons.org/).'
six('REGLAS DE NEGOCIO AUTOMATIZADAS',[
 ('Stock insuficiente','Rechaza un consumo superior a las existencias disponibles.'),
 ('Stock mínimo','Genera una alerta según el umbral configurado por repuesto.'),
 ('Estado de la orden','Impide transiciones no permitidas en el servicio.'),
 ('Costos y descuentos','Calcula repuestos más mano de obra menos descuento.'),
 ('Control de pagos','Rechaza pagos que superan el saldo de la orden.'),
 ('Sincronización','Evita aplicar dos veces una misma operación reenviada.')
], 'Ejemplos documentados: RN-10 stock, RN-12 alertas, RN-16 descuento y RN-17 pagos. La idempotencia se comprueba en el caso 19. El stock mínimo no es un valor fijo de tres unidades. Fuente: proyecto, pp. PDF 71–75 y 86.')
four('ESTRATEGIA DE PRUEBAS',[
 ('01','Pruebas unitarias','15 pruebas reportadas para funciones y reglas de negocio.'),
 ('02','Pruebas de API','33 comprobaciones de punta a punta reportadas en el documento.'),
 ('03','Aceptación funcional','36 casos documentados: acceso, órdenes, inventario, costos y suscripciones.'),
 ('04','Offline y sincronización','Orden guardada sin conexión y reenvío de una operación aplicada una sola vez.')
], 'RESULTADOS REPORTADOS EN LA DOCUMENTACIÓN TÉCNICA', 'Las cifras proceden del documento y no constituyen una nueva ejecución. No sumar automáticamente los grupos porque pueden evaluar comportamientos relacionados. Las matrices 3.14, 3.32, 3.43 y 3.50 reportan casos aprobados. Ejemplos: stock 3 y consumo 5, rechazo y stock intacto; 250 + 150 - 50, total Bs 350; credenciales inválidas, HTTP 401; mecánico creando usuarios, HTTP 403. Fuente: proyecto, pp. PDF 42, 58–59, 74–75, 86–87 y 95–96.')
six('ESTRATEGIAS DE SEGURIDAD',[
 ('Autenticación','Tokens JWT con expiración y contraseñas con hash bcrypt.'),
 ('Permisos por rol','SuperAdmin, administrador y mecánico con accesos diferenciados.'),
 ('Separación por taller','Datos asociados a tallerId y validación del acceso en el servidor.'),
 ('Validación de entradas','DTOs, restricciones y reglas de negocio en la API.'),
 ('Acceso protegido','HTTPS y limitación de intentos de inicio de sesión.'),
 ('Respaldos y despliegue','Copia diaria, retención de 14 días y base de datos sin puerto público.')
], 'Límite de acceso documentado: 5 intentos por minuto. Las contraseñas se almacenan como hash bcrypt, no mediante cifrado reversible. El frontend no sustituye la autorización del servidor. Fuente: proyecto, pp. PDF 45–49, 54 y 93. Estas son medidas documentadas, no una auditoría de seguridad independiente.')
s=slide(10);text(s,'CONCLUSIONES PRELIMINARES',57,100,1250,45,27,True,'#9cb5d0')
text(s,'Gestión operativa integrada\ny respaldada por registros',57,200,1260,150,56,True,'#ffffff')
text(s,'El sistema reúne clientes, vehículos, órdenes, repuestos y costos.\nLas reglas de negocio controlan operaciones y preservan su trazabilidad.\nLas pruebas documentadas verifican los casos funcionales evaluados.',57,405,1290,180,32,False,'#ffffff')
text(s,'La mejora en tiempos y errores debe medirse durante el piloto en el taller.',57,660,1290,65,28,False,'#b8cbe0')
s['notes']='Conclusiones formuladas con base en funciones y pruebas documentadas. No afirmar porcentajes de reducción de tiempos ni adopción garantizada sin mediciones antes/después. El docente permitió conclusiones tentativas. Fuente: retroalimentación docente, p. 1; proyecto, iteraciones 3.14–3.17.'
four('RECOMENDACIONES',[
 ('01','Capacitación práctica','Entrenar al personal con registros y órdenes de trabajo del taller.'),
 ('02','Evaluación en campo','Comparar tiempos de búsqueda e inconsistencias antes y después del piloto.'),
 ('03','Continuidad de los datos','Verificar restauraciones de respaldos y revisar operaciones pendientes de sincronización.'),
 ('04','Mejora gradual','Ajustar reglas y experiencia de uso con la retroalimentación del propietario y los mecánicos.')
],notes='Recomendaciones propuestas a partir de los límites y riesgos del proyecto. El uso habitual, la conectividad y la capacitación deben considerarse al interpretar los resultados del piloto. No se presentan estas propuestas como resultados ya obtenidos.')
for s in slides:
 if s.get('original'):continue
 for t in s['texts']:
  if len(t['text'])>160 and s['bg']==6:t['size']=24
(P/'deck.json').write_text(json.dumps(slides,ensure_ascii=False),encoding='utf-8')
print(len(slides),'diapositivas')
