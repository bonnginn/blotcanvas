import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";
import {autoLabelLayout as generalAutoLabelLayout, figureLabelWidthEstimate} from "../app/label-layout.ts";
import {figureMarkerBottom} from "../app/figure-layout.ts";

const source=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const start=source.indexOf("const autoLabelLayout ="),end=source.indexOf("const save =",start);
assert.ok(start>=0&&end>start);
const actual=new Function("generalAutoLabelLayout","figureLabelWidthEstimate","groupShowsSeparator","esc",
  stripTypeScriptTypes(source.slice(start,end))+";return {svgAutoLabel,conditionRowHeight,conditionRowNeedsRotation,markerLabelPositions};")(
  generalAutoLabelLayout,figureLabelWidthEstimate,()=>false,(value:string)=>value);

test("actual SVG label shrinking uses inline size so the cond class cannot override it",()=>{
  const svg=actual.svgAutoLabel("ABCDE",10,20,60,20);
  assert.match(svg,/style="font-size:18px"/);
  assert.doesNotMatch(svg,/transform="rotate/);
  assert.match(svg,/>ABCDE<\/text>/);
});

test("scientific figure identifiers remain intact when labels need rotation",()=>{
  for(const value of ["TPX2+M","sensor_phosTag","pAur/totalAur"]) {
    const svg=actual.svgAutoLabel(value,10,20,25,20);
    assert.match(svg,/transform="rotate\(-90 10 20\)"/);
    assert.ok(svg.includes(`>${value}</text>`));
    assert.doesNotMatch(svg,/<tspan/);
  }
});

test("a row forced to rotate reserves the full text even for another label that would wrap",()=>{
  const row={visible:true,name:"Condition",values:["ABCDE","AAA BBB CCC"]};
  const gel={lanes:2,laneSpan:100};
  assert.equal(actual.conditionRowNeedsRotation(row,gel,96,20),true);
  const forced=actual.svgAutoLabel("AAA BBB CCC",10,20,40,20,true);
  assert.match(forced,/rotate\(-90/);
  assert.ok(forced.includes(">AAA BBB CCC</text>"));
  // 11 regular glyphs at 0.66 em, 20 px. The whole string is rotated, not just AAA.
  assert.ok(actual.conditionRowHeight(row,gel,96,20)>=11*0.66*20+16-1e-9);
});

test("expanded marker bounds keep dense label baselines spaced without moving their source ticks",()=>{
  for(const fontSize of [9,17,30]) for(const count of [1,7,20]) {
    const top=100,imageBottom=top+10;
    const input=Array.from({length:count},(_,index)=>({key:`m${index}`,mw:10+index,markerY:top+index/Math.max(1,count)}));
    const before=structuredClone(input),bottom=figureMarkerBottom(imageBottom,top,count,fontSize);
    const placed=actual.markerLabelPositions(input,bottom,fontSize,top,bottom);
    assert.deepEqual(input,before);
    for(let i=0;i<count;i++) {
      assert.equal(placed[i].markerY,input[i].markerY);
      assert.ok(placed[i].labelY>=top+fontSize-1e-9);
      assert.ok(placed[i].labelY<=bottom-2+1e-9);
      if(i) assert.ok(placed[i].labelY-placed[i-1].labelY>=fontSize+3-1e-9);
    }
  }
});
