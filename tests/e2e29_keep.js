const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));let ans='Eeveelution';p.on('dialog',d=>{if(d.type()==='prompt')d.accept(ans);else d.accept()});
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
const N=1000;
await p.evaluate(async N=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
const types=['Feuer','Wasser','Pflanze','Gift','Flug','Normal','Käfer','Psycho'];
let id=0;const imgs=[];
for(let i=0;i<N;i++){const t1=types[i%8],t2=types[(i*3+1)%8];imgs.push({tab:'Standard',name:'P'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200+(i%50),wins:0,losses:0,history:[1200],tags:{Typ:{value:t1+', '+t2,values:t1===t2?[t1]:[t1,t2]},Gen:{value:'G'+(1+Math.floor(i/140))},Jahr:{value:String(1996+Math.floor(i/50))}}});}
// Entwicklungsreihen: Gruppen à 3 (i,i+1,i+2) bestätigt
imgs.forEach((im,i)=>{im.rivals=[];});
for(let g=0;g+2<N;g+=3){[[g,g+1],[g+1,g+2],[g,g+2]].forEach(([a,c])=>{imgs[a].rivals.push({id:c+1,status:'confirmed'});imgs[c].rivals.push({id:a+1,status:'confirmed'});});}
imgs.forEach(im=>tx.objectStore('images').add(im));
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Typ',type:'multi',options:types});
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Gen',type:'exact',options:[]});
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Jahr',type:'number',options:[],tolerance:1});
await new Promise(r=>tx.oncomplete=r);},N);
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(1500);
let t0=Date.now();
await p.evaluate(()=>openRivalHub('graph'));await p.waitForSelector('#rh-svg .rh-n');
const tOpen=Date.now()-t0;
const nodes=await p.locator('.rh-n').count();
ok(tOpen<2500,'Netzwerk öffnet schnell ('+tOpen+' ms) mit '+nodes+' Knoten');
ok(nodes<=160&&nodes>=100,'Nur Budget angezeigt: '+nodes);
ok(/weitere ausgeblendet/.test(await p.textContent('#rh-view')),'Hinweis auf ausgeblendete Cluster');
// Mehr einblenden
await p.click('text=Mehr einblenden');await p.waitForTimeout(300);
ok(await p.locator('.rh-n').count()>nodes,'Mehr einblenden zeigt mehr');
// Schneller Rechenpfad: Zeit + Gleichheit
t0=Date.now();
await p.evaluate(()=>{rivalHub.sugg=null;});
await p.evaluate(()=>rivalHubComputeSuggestions());
const tS=Date.now()-t0;ok(tS<4000,'Vorschläge für 1000 Bilder in '+tS+' ms');
const cmp=await p.evaluate(()=>{const h=rivalHub;let bad=0,chk=0;for(const s of h.sugg.slice(0,40)){const x=computeRivalSuggestions(s.a,h.images,h.defsByName,1e9).find(r=>r.img.id===s.b.id);chk++;if(!x||Math.abs(x.score-s.score)>0.01)bad++;}return [bad,chk,h.sugg.length]});
ok(cmp[0]===0,'Schnellpfad = Einzelberechnung ('+cmp[1]+' geprüft, '+cmp[2]+' Vorschläge)');
// Liste rendern
t0=Date.now();await p.evaluate(()=>rivalHubView('list'));await p.waitForSelector('.rh-row');ok(Date.now()-t0<1500,'Liste rendert: '+(Date.now()-t0)+' ms');
await p.evaluate(()=>rivalHubView('graph'));await p.waitForSelector('#rh-svg .rh-n');
ok((await p.locator('.rh-ren').count())===0,'Keine Cluster-Namen mehr (Gruppen ersetzen sie)');
// Ziehen performant
const bx=await p.locator('.rh-n >> nth=0').boundingBox();
t0=Date.now();await p.mouse.move(bx.x+bx.width/2,bx.y+bx.height/2);await p.mouse.down();for(let i=0;i<30;i++)await p.mouse.move(bx.x+10+i*4,bx.y+10+i*3);await p.mouse.up();
ok(Date.now()-t0<3000,'30 Drag-Schritte in '+(Date.now()-t0)+' ms');
await p.screenshot({path:'shots/hub_big.png'});
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
