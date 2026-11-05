import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root='../blotcanvas-public-figure';
const manifest=JSON.parse(fs.readFileSync('../public-safari-save-verification-20260918.json','utf8'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
let results;
for(let attempt=0;attempt<6;attempt++) {
  results={};
  for(const file of [...manifest.files,'assets/index-figure-52b19cf0902c.css']) {
    const response=await fetch('https://bonnginn.github.io/blotcanvas/'+file+'?verification=20260918',{cache:'no-store'});
    const bytes=Buffer.from(await response.arrayBuffer()),local=fs.readFileSync(root+'/'+file);
    const normalized=bytes.toString('utf8').replace(/\r\n/g,'\n');
    results[file]={status:response.status,match:response.ok&&normalized===local.toString('utf8').replace(/\r\n/g,'\n'),sha256:hash(bytes)};
  }
  if(Object.values(results).every(x=>x.match)) break;
  if(attempt<5) await new Promise(resolve=>setTimeout(resolve,8000));
}
manifest.deployedCommit='b5ad224cc786a0026984c3c22cdcd4f1dd4bd923';
manifest.liveVerification={checkedAt:new Date().toISOString(),results,allMatch:Object.values(results).every(x=>x.match)};
fs.writeFileSync('../public-safari-save-verification-20260918.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest.liveVerification,null,2));
assert.ok(manifest.liveVerification.allMatch,'live HTML/SW/JS/CSS match the limited release');
