const {chromium}=require('playwright');
const path='file://'+process.cwd()+'/Ranking.html';
let errors=[], confirms=[], confirmAns=false;
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext({acceptDownloads:true})).newPage();
 p.on('pageerror',e=>errors.push(e.message)); p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errors.push('console: '+m.text())});
 p.on('dialog',async d=>{ if(d.type()==='confirm'){confirms.push(d.message()); confirmAns?await d.accept():await d.dismiss();} else await d.accept(); });
 await p.goto(path); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const T=v=>({value:v,showBadge:false});
  const tx=db.transaction(['images','tagDefinitions'],'readwrite');
  const rows=[['A','Fire','1990',1400],['B','Fire','1995',1300],['C','Water','2005',1200],['D','Water','2015',1100],['E','Grass','',1000],['F','Fire','2020',1250]];
  rows.forEach(([n,ty,yr,elo])=>tx.objectStore('images').add({tab:'Standard',name:n,blob,elo,wins:3,losses:1,streak:0,history:[1200],peak:elo,tags:{Type:T(ty),Year:T(yr)}}));
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Type',options:['Fire','Water','Grass']});
  tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:'Year',options:[],type:'number',tolerance:5});
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(800);
 // Rivalen-Badge
 const ids=await p.evaluate(async()=>{const a=await new Promise(r=>db.transaction('images').objectStore('images').getAll().onsuccess=e=>r(e.target.result));return Object.fromEntries(a.map(i=>[i.name,i.id]));});
 await p.evaluate(async i=>{await setRivalStatus(i.A,i.B,'confirmed');},ids).catch(e=>console.log('setRival?',e.message));
 const fn=await p.evaluate(()=>typeof setRival+' '+Object.keys(window).filter(k=>/ival/i.test(k)).join(','));
 console.log(fn);
 const show=async(a,b2)=>{await p.evaluate(async o=>{curL=await idbGet(db.transaction('images').objectStore('images'),o.a);curR=await idbGet(db.transaction('images').objectStore('images'),o.b);await updateH2HStats();},{a,b:b2});return p.$eval('#rival-badge',e=>e.style.display);};
 ok(await show(ids.A,ids.B)!=='none','Badge sichtbar bei bestätigten Rivalen A/B');
 ok(await show(ids.A,ids.C)==='none','Badge weg bei Nicht-Rivalen A/C');
 // Tag-Statistik
 await p.evaluate(()=>openTagStats('Type')); await p.waitForSelector('#tag-stats-table tbody tr');
 let rows=await p.$$eval('#tag-stats-table tbody tr',r=>r.map(x=>[...x.cells].map(c=>c.innerText.trim())));
 const fire=rows.find(r=>r[0]==='Fire'); 
 ok(fire&&fire[1]==='3'&&fire[2].startsWith('1317'),'Fire: 3 Bilder, Ø Elo 1317: '+JSON.stringify(fire));
 ok(fire[3]==='1300'&&fire[4]==='75 %'&&fire.slice(5).some(x=>x.startsWith('A (#1)')),'Median 1300, Siegquote 75 %, bestes Bild A (#1): '+fire.join('|'));
 await p.evaluate(()=>openTagStats('Year')); await p.waitForSelector('#tag-stats-table tbody tr');
 rows=await p.$$eval('#tag-stats-table tbody tr',r=>r.map(x=>x.cells[0].innerText.trim()));
 const txt=await p.textContent('#modal-body');
 ok(txt.includes('Korrelation')&&/-0\.\d+/.test(txt.split('Korrelation')[1].slice(0,30)),'Zahl-Tag: negative Korrelation angezeigt: '+txt.split('Korrelation')[1].slice(0,60));
 ok(rows.some(r=>r.includes('–'))&&rows[rows.length-1]==='(keine Zahl)','Bins vorhanden, „(keine Zahl)“ zuunterst: '+rows.join(' / '));
 await p.evaluate(()=>sortTagStats('count')); 
 ok(true,'Sortierung ohne Fehler');
 await p.evaluate(()=>closeModal());
 // Export / Import mit Sicherheitsabfrage
 const [dl]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>exportFullSystem())]);
 const file=process.cwd()+'/t_backup.zip'; await dl.saveAs(file);
 const data=JSON.parse(require('child_process').execSync('python3 -c "import zipfile,sys;sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(\'backup.json\').decode())" '+file,{maxBuffer:1e9}).toString());
 ok(typeof data.exportedAt==='number'&&data.images.length===6,'Export enthält exportedAt und 6 Bilder');
 ok(!JSON.stringify(data).includes('"thumbs"'),'Export enthält keine Vorschaubilder');
 confirmAns=false; await p.setInputFiles('#backup-input',file); await p.waitForTimeout(800);
 ok(confirms.length===1&&confirms[0].includes('6 Bilder')&&!confirms[0].includes('ÄLTER'),'Abfrage erscheint, kein Älter-Hinweis bei gleichem Stand');
 ok((await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).length))===6,'Abbruch ändert nichts');
 // älteres Backup simulieren: aktuelles Duell hinzufügen
 await p.evaluate(async()=>{const tx=db.transaction('matches','readwrite');tx.objectStore('matches').add({leftId:1,rightId:2,winnerId:'left',delta:1,tab:'Standard',time:Date.now()+5000});await new Promise(r=>tx.oncomplete=r);});
 confirms.length=0; await p.setInputFiles('#backup-input',file); await p.waitForTimeout(800);
 ok(confirms.length===1&&confirms[0].includes('ÄLTER'),'Warnung bei älterem Backup');
 confirmAns=true; confirms.length=0; 
 await Promise.all([p.waitForEvent('load'),p.setInputFiles('#backup-input',file)]); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(1200);
 ok((await p.evaluate(async()=>(await idbGetAll(db.transaction('matches').objectStore('matches'))).length))===0,'Bestätigter Import stellt Backup her (0 Duelle)');
 ok(errors.length===0,'Keine JS-Fehler '+errors.join(' || '));
 await b.close();
})();
