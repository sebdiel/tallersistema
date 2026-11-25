import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const runtime='C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1105-1297-0_26.1105.1297.0_x64__3k8sg7r9htsxt/dependencies';
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const {Presentation,PresentationFile}=await import(pathToFileURL(runtime+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs'));
const base='D:/Desktop/SISTEMA/tallersistema/revision_presentacion';
const spec=JSON.parse(await fs.readFile(base+'/deck.json','utf8'));
const p=Presentation.create({slideSize:{width:1440,height:810}});
p.theme.defaultFont='Calibri';
for(const d of spec){
 const s=p.slides.add();
 const bytes=new Uint8Array(await fs.readFile(base+'/'+(d.original?'original_':'fondo_')+String(d.bg).padStart(2,'0')+'.png'));
 s.images.add({blob:bytes,contentType:'image/png',position:{left:0,top:0,width:1440,height:810},alt:'Diseño de referencia original',fit:'contain'});
 for(const t of d.texts){const sh=s.shapes.add({geometry:'textbox',position:{left:t.x,top:t.y,width:t.w,height:t.h},fill:'none',line:{fill:'none',width:0}});sh.text=t.text;sh.text.style={fontFamily:'Calibri',fontSize:t.size,bold:t.bold,color:t.color,alignment:t.align,verticalAlignment:'top'};}
 s.speakerNotes.text=d.notes;
 if(d.logos){s.shapes.items[0].text.fontSize=38;s.shapes.items[0].position.width=1040;s.shapes.items[1].text='Angular · NestJS · PostgreSQL · Docker';s.shapes.items[1].position.top=85;s.shapes.items[1].text.fontSize=16;
  for(const [i,n]of ['angular','nestjs','postgresql','docker'].entries()){let svg=await fs.readFile(base+'/'+n+'.svg','utf8');svg=svg.replace('<svg ','<svg fill="#ffffff" ');s.images.add({blob:new TextEncoder().encode(svg),contentType:'image/svg+xml',position:{left:1118+i*76,top:22,width:44,height:44},alt:'Logo '+n,fit:'contain'});}
 }
}
await fs.mkdir(base+'/entrega',{recursive:true});
await (await PresentationFile.exportPptx(p)).save(base+'/candidate.pptx');
console.log('PPTX exportado');
const SKILL='C:/Users/Sebastian/.codex/plugins/cache/openai-primary-runtime/presentations/26.1105.12137/skills/presentations';
const {finalizePresentation}=await import(pathToFileURL(SKILL+'/container_tools/artifact_tool_utils.mjs'));
await finalizePresentation({workspaceDir:base,candidatePath:base+'/candidate.pptx',finalPath:base+'/entrega/Presentacion_corregida.pptx',pythonExecutable:runtime+'/python/python.exe',integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','13716000,7715250','--validate-heading-fit'],explicitTotalSlideCount:14,requiredNativeChartOwnerSlides:[],requiredNativeTableOwnerSlides:[],verifyArtifactToolImport:true,receiptPath:base+'/validacion.json'});
console.log('PPTX validado');
