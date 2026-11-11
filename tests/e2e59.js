const {chromium,devices}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 13']});const p=await ctx.newPage();let f=0;const ok=(c,m)=>{console.log(c?'✔':'✘',m);if(!c)f++};let msg='';p.on('dialog',d=>{msg=d.message();d.accept()});
await p.goto('file://'+process.cwd()+'/Ranking.html');await p.waitForFunction(()=>db!==null);
await p.evaluate(()=>importImages([new File(['x'],'a.png',{type:'image/png'})]));
ok(/am PC/.test(msg),'Handy: Hinweis statt Import: '+msg.slice(0,40));
const n=await p.evaluate(async()=>(await idbGetAll(db.transaction('images').objectStore('images'))).length);ok(n===0,'kein Bild angelegt');
await b.close();process.exit(f?1:0)})();
