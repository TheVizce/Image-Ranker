const {chromium}=require('playwright');
const ok=(c,m)=>console.log((c?'✔ ':'✘ FEHLER: ')+m)||(!c&&(process.exitCode=1));
(async()=>{
 const b=await chromium.launch(); const p=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('dialog',d=>d.accept());
 await p.goto('file://'+process.cwd()+'/Ranking.html'); await p.waitForFunction(()=>db!==null);
 await p.evaluate(async()=>{
  const blob=new Blob(['x'],{type:'image/png'}); const tx=db.transaction(['images','tagDefinitions'],'readwrite');
  const names=['A1','B2','C3','D4','E5','F6','G7','H8','I9'];
  const tags={}; names.forEach(n=>tags[n]={value:'Wert '+n,showBadge:true});
  for(let i=0;i<3;i++) tx.objectStore('images').add({tab:'Standard',name:'N'+i,blob,elo:1200,wins:0,losses:0,streak:0,history:[1200],peak:1200,tags});
  names.forEach(n=>tx.objectStore('tagDefinitions').add({tab:'Standard',tagName:n,options:[]}));
  await new Promise(r=>tx.oncomplete=r);
 });
 await p.reload(); await p.waitForFunction(()=>db!==null); await p.waitForTimeout(1200);
 const expect={1:[1],2:[2],3:[3],4:[4],5:[3,2],6:[3,3],7:[4,3],8:[4,4],9:[3,3,3]};
 for(let n=1;n<=9;n++){
  // nur die ersten n Eigenschaften anzeigen: showBadge der übrigen aus
  await p.evaluate(async n=>{
   const names=['A1','B2','C3','D4','E5','F6','G7','H8','I9'];
   curL.tags=Object.fromEntries(names.map((x,i)=>[x,{value:i<n?'Wert '+x:'',showBadge:false}]));
   await renderTagBadges('left',curL);
  },n);
  const rows=await p.$$eval('#properties-left > div',els=>{const m={};els.forEach(e=>{const y=Math.round(e.getBoundingClientRect().top);m[y]=(m[y]||0)+1;});return Object.keys(m).sort((a,b)=>a-b).map(k=>m[k]);});
  const widths=await p.$$eval('#properties-left > div',els=>new Set(els.map(e=>Math.round(e.getBoundingClientRect().width))).size);
  ok(JSON.stringify(rows)===JSON.stringify(expect[n])&&widths===1,n+' Eigenschaften → Reihen '+rows.join('+')+' (gleich breit: '+(widths===1)+')');
  if(n===5) await p.screenshot({path:'shots/tags5.png',clip:{x:240,y:700,width:700,height:300}});
 }
 await p.evaluate(async()=>{curL.tags={};await renderTagBadges('left',curL);});
 ok(await p.$eval('#properties-left',e=>getComputedStyle(e).display)==='none','Ohne Eigenschaften: Leiste ausgeblendet');
 ok(errs.length===0,'Keine JS-Fehler '+errs.join('|'));
 await b.close();
})();
