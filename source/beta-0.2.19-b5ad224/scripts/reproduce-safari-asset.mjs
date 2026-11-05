import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const INPUT_SHA256 = '6a03436dc6cb632f13757399ccafd86b6bc2e9a61ea82bf22b7cc5518536c72a';
export const OUTPUT_SHA256 = 'b65c83b0e71c457e8c9c82313b2504e8affb18298b867399f5eb8e842118122b';
const before = 'let r=document.createElement(`a`);r.href=URL.createObjectURL(new Blob([t],{type:n})),r.download=e,r.click(),setTimeout(()=>URL.revokeObjectURL(r.href),1e3)},it=(e,t)=>{let n=document.createElement(`a`);n.href=URL.createObjectURL(t),n.download=e,n.click(),setTimeout(()=>URL.revokeObjectURL(n.href),1e3)';
const after = 'it(e,new Blob([t],{type:n}))},it=(e,t)=>{let n=URL.createObjectURL(t),r=document.createElement(`a`);r.href=n,r.download=e,r.target=`_blank`,r.rel=`noopener`,r.hidden=!0;try{document.body.appendChild(r),r.click()}finally{r.remove(),setTimeout(()=>URL.revokeObjectURL(n),6e4)}';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// Reproduces the recorded compiled save/saveBlob-only hotfix, never a general bundle patch.
export function reproduceSafariAsset(input) {
  if (sha(input) !== INPUT_SHA256) throw Error('Not the pinned pre-Safari Figure asset');
  const text = input.toString('utf8');
  if (text.split(before).length !== 2) throw Error('Expected one exact helper region');
  const output = Buffer.from(text.replace(before, after), 'utf8');
  if (sha(output) !== OUTPUT_SHA256) throw Error('Postprocess output does not match public b5ad224');
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) throw Error('Usage: node reproduce-safari-asset.mjs INPUT_JS NEW_OUTPUT_JS');
  const output = reproduceSafariAsset(readFileSync(process.argv[2]));
  writeFileSync(process.argv[3], output, { flag: 'wx' });
  console.log(JSON.stringify({ bytes: output.length, sha256: sha(output) }));
}
