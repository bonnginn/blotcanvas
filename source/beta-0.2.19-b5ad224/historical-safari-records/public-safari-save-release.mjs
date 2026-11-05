import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root = path.resolve('..', 'blotcanvas-public-figure');
const oldName = 'index-figure-6a03436dc6cb.js';
const old = fs.readFileSync(path.join(root,'assets',oldName),'utf8');
assert.equal(crypto.createHash('sha256').update(old).digest('hex'), '6a03436dc6cb632f13757399ccafd86b6bc2e9a61ea82bf22b7cc5518536c72a');
const before = 'rt=(e,t,n=`image/svg+xml`)=>{let r=document.createElement(`a`);r.href=URL.createObjectURL(new Blob([t],{type:n})),r.download=e,r.click(),setTimeout(()=>URL.revokeObjectURL(r.href),1e3)},it=(e,t)=>{let n=document.createElement(`a`);n.href=URL.createObjectURL(t),n.download=e,n.click(),setTimeout(()=>URL.revokeObjectURL(n.href),1e3)}';
const body = 'let n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=e,r.target=`_blank`,r.rel=`noopener`,r.hidden=!0;try{document.body.appendChild(r),r.click()}finally{r.remove(),setTimeout(()=>URL.revokeObjectURL(n),6e4)}';
const after = 'rt=(e,t,n=`image/svg+xml`)=>{it(e,new Blob([t],{type:n}))},it=(e,t)=>{'+body+'}';
assert.equal(old.split(before).length,2,'exactly one pair of save helpers');
const updated = old.replace(before,after);
assert.equal(updated.replace(after,before),old,'all other JavaScript bytes unchanged');
// Execute the actual published functions against a delayed-download model.
const live = new Map(), timers = []; let connected=false, clicks=0;
const a = {remove(){connected=false},click(){assert.ok(connected); clicks++;}};
const document = {createElement:()=>a,body:{appendChild(){connected=true}}};
const URL = {createObjectURL(blob){const url='blob:qa/'+live.size; live.set(url,blob); return url;},revokeObjectURL(url){live.delete(url)}};
const saves = new Function('document','URL','setTimeout','Blob','let '+after+';return {save:rt,saveBlob:it};')(document,URL,(run,delay)=>timers.push({run,delay}),Blob);
for(const [name,mime,bytes] of [['Figure.png','image/png',[137,80,78,71]],['outputs.zip','application/zip',[80,75,3,4]]]) {
  const blob=new Blob([new Uint8Array(bytes)],{type:mime}); saves.saveBlob(name,blob);
  assert.equal(live.get(a.href),blob); assert.equal(a.download,name); assert.equal(a.target,'_blank'); assert.equal(a.rel,'noopener'); assert.equal(connected,false);
  assert.equal(timers.at(-1).delay,60000); assert.deepEqual([...new Uint8Array(await live.get(a.href).arrayBuffer())],bytes);
}
saves.save('project.json','{"name":"anonymous"}','application/json');
assert.equal(await live.get(a.href).text(),'{"name":"anonymous"}'); assert.equal(live.get(a.href).type,'application/json');
assert.equal(clicks,3); timers.forEach(x=>x.run()); assert.equal(live.size,0);
const hash=crypto.createHash('sha256').update(updated).digest('hex');
const newName='index-safari-save-'+hash.slice(0,12)+'.js';
fs.writeFileSync(path.join(root,'assets',newName),updated);
const indexPath=path.join(root,'index.html'), swPath=path.join(root,'sw.js');
const index=fs.readFileSync(indexPath,'utf8'), sw=fs.readFileSync(swPath,'utf8');
assert.equal(index.split(oldName).length,2); assert.ok(sw.includes('blotcanvas-app-v19-figure-layout'));
fs.writeFileSync(indexPath,index.replace(oldName,newName));
fs.writeFileSync(swPath,sw.replace('blotcanvas-app-v19-figure-layout','blotcanvas-app-v19-safari-save-20260918'));
const evidence={basePublicCommit:'ee7d206',oldName,newName,sha256:hash,otherJavaScriptUnchanged:true,publishedHelpersExecuted:true,cssUnchanged:true,safariRealDevice:'not tested',files:['index.html','sw.js','assets/'+newName]};
fs.writeFileSync('../public-safari-save-verification-20260918.json',JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
