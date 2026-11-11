const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
const r=await p.evaluate(async()=>{const l=[...document.querySelectorAll('link[rel~=icon],link[rel=apple-touch-icon]')];const out=[];for(const e of l){const im=new Image();im.src=e.href;await im.decode().then(()=>out.push([e.rel,im.naturalWidth])).catch(()=>out.push([e.rel,0]));}return out});
ok(r.length===2&&r.every(x=>x[1]>0),'Icons vorhanden und dekodierbar: '+JSON.stringify(r));
ok(errs.length===0,'keine JS-Fehler');
await b.close();process.exit(f?1:0)})();
