const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images','tagDefinitions'],'readwrite');
for(let i=0;i<4;i++)tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});
tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Farbe',type:'exact',options:['Rot','Blau']});
await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(1000);
const [a,c]=await p.evaluate(()=>[curL.id,curR.id]);
// Tag des aktuellen Duell-Bildes in der DB ändern (wie Details/Rangliste es tun)
await p.evaluate(async id=>{const tx=db.transaction('images','readwrite');const st=tx.objectStore('images');const im=await idbGet(st,id);im.tags={Farbe:{value:'Rot'}};im.name='Umbenannt';st.put(im);await txDone(tx);},a);
await p.evaluate(()=>submitVote('left'));await p.waitForTimeout(800);
const r=await p.evaluate(async id=>{const im=await idbGet(db.transaction('images').objectStore('images'),id);return [im.tags.Farbe&&im.tags.Farbe.value,im.name,im.wins,im.losses]},a);
ok(r[0]==='Rot'&&r[1]==='Umbenannt','Tag und Name nach dem Voten erhalten: '+r);
ok(r[2]+r[3]===1,'Duell trotzdem gewertet: '+r);
// Anzeige synchron nach Modal schließen
const id2=await p.evaluate(()=>curL.id);
await p.evaluate(async id=>{const tx=db.transaction('images','readwrite');const st=tx.objectStore('images');const im=await idbGet(st,id);im.name='Neu-Name';st.put(im);await txDone(tx);showModal('x');},id2);
await p.evaluate(()=>closeModal());await p.waitForTimeout(500);
ok(await p.textContent('#name-left')==='Neu-Name'||await p.textContent('#name-right')==='Neu-Name','Duell-Anzeige übernimmt Änderung beim Schließen');
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
