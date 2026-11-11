const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));let dlg=null;p.on('dialog',async d=>{dlg=d.message();await d.dismiss();});
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
const data=[0,1,2].map(i=>fs.readFileSync(`imgs/i${i}.jpg`).toString('base64'));
await p.evaluate(async data=>{const tx=db.transaction(['images'],'readwrite');
data.forEach((b64,i)=>{const bin=atob(b64);const u=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);tx.objectStore('images').add({tab:'Standard',name:'Bild'+i,blob:new Blob([u],{type:'image/jpeg'}),elo:1200,wins:0,losses:0,history:[1200],tags:{}});});
await new Promise(r=>tx.oncomplete=r);},data);
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(1000);
// Duplikate: i0 erneut + neues i5
await p.setInputFiles('#file-input',[`imgs/i0.jpg`,`imgs/i5.jpg`]);await p.waitForTimeout(2500);
ok(dlg&&dlg.includes('ähnlich')&&dlg.includes('Bild0'),'Duplikat-Dialog: '+(dlg||'').split('\n').slice(0,3).join(' | '));
let n=await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).length);ok(n===4,'Duplikat übersprungen, neues Bild hinzugefügt (4): '+n);
const hs=await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).every(i=>i.hash&&i.hash.length===16));ok(hs,'alle haben Hash');
// Akzent
await p.evaluate(()=>setTabAccent('#ff0066'));
ok((await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent'))).trim()==='#ff0066','Akzent gesetzt');
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(800);
ok((await p.evaluate(()=>document.documentElement.style.getPropertyValue('--accent')))==='#ff0066','Akzent nach Reload');
// Lightbox
await p.hover('#img-left, #container-left');await p.click('#container-left .zoom-btn, #img-left .zoom-btn');
ok(await p.evaluate(()=>getComputedStyle(document.getElementById('lightbox')).display)==='flex','Lightbox offen');
const votes0=await p.evaluate(async()=>(await getMatches()).length);await p.keyboard.press('ArrowLeft');await p.waitForTimeout(500);
ok(await p.evaluate(async()=>(await getMatches()).length)===votes0,'Pfeiltaste stimmt bei offener Lightbox nicht ab');
await p.keyboard.press('Escape');ok(await p.evaluate(()=>getComputedStyle(document.getElementById('lightbox')).display)==='none','Esc schließt');
// Animation
await p.click('#container-left .glass-footer, #img-left .glass-footer, #container-left');await p.waitForTimeout(150);
ok(await p.evaluate(()=>!!document.querySelector('.image-container.duel-in')),'Einblend-Animation beim neuen Duell');
await p.waitForTimeout(900);

ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
