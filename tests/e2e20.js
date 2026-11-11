const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:780},isMobile:true,hasTouch:true});const p=await ctx.newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(async()=>{const tx=db.transaction(['images'],'readwrite');for(let i=0;i<4;i++)tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob:new Blob(['x'],{type:'image/png'}),elo:1200-i,wins:0,losses:0,history:[1200],tags:{}});await new Promise(r=>tx.oncomplete=r);});
await p.reload();await p.waitForFunction(()=>db!==null);await p.waitForTimeout(1000);
for(const [name,fn] of [['Einstellungen',()=>openSettings()],['Rangliste',()=>openFullRanking()],['Statistik',()=>openStats()],['Details',()=>showDetailsByID(1)],['Studio',()=>openMatchupStudio()]]){
 await p.evaluate(fn);await p.waitForTimeout(900);
 await p.evaluate(()=>{document.getElementById('modal').scrollTop=5000});await p.waitForTimeout(200);
 const r=await p.evaluate(()=>{const x=document.querySelector('#modal .modal-content > span');const b=x.getBoundingClientRect();const top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {y:Math.round(b.y),w:Math.round(b.width),vis:top===x||x.contains(top)}});
 ok(r.y>=0&&r.y<80&&r.w>=40&&r.vis,name+': Kreuz sichtbar und tippbar nach Scrollen '+JSON.stringify(r));
 await p.tap('#modal .modal-content > span');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>getComputedStyle(document.getElementById('modal')).display)==='none',name+': schließt per Tippen');
}
ok(errs.length===0,'keine JS-Fehler '+errs);
await b.close();process.exit(f?1:0)})();
