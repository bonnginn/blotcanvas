import test from "node:test";
import { autoLabelLayout } from "../app/label-layout.ts";
import assert from "node:assert/strict";
import { figureDrawingMetrics, figureCropHeight, figureMarkerBottom } from "../app/figure-layout.ts";

const measure=(value:string)=>value.length*10;
const gel=(lanes:number,label="A",width=80)=>({id:"g",name:"Synthetic",width,lanes,laneSpan:100,
 conditions:[{name:"Dose",visible:true,values:Array(lanes).fill(label)}]});

test("6 / 12 / 24 lane figures use readable pitch across one or two gels without changing project data",()=>{
 for(const count of [1,2]) for(const [lanes,expected] of [[6,430],[12,528],[24,1056]]){
  const project={panelWidthMm:25.5,gels:Array.from({length:count},()=>gel(lanes))};
  const before=structuredClone(project);
  const actual=figureDrawingMetrics(project.gels,["Ab"],20,"antibody-left",measure);
  assert.equal(actual.baseW,expected);assert.deepEqual(project,before);
 }
});

test("long atomic identifiers increase lane pitch with bounded width; group spans share their label space",()=>{
 const long="Protein_A_variant-1";
 assert.equal(figureDrawingMetrics([gel(12,long)],[],20,"antibody-left",measure).baseW,864);
 assert.equal(figureDrawingMetrics([gel(12,long.repeat(10))],[],20,"antibody-left",measure).baseW,864);
 const grouped={...gel(12),conditions:[{name:"Dose",visible:true,values:[],groups:[{label:"Protein_A_variant-1",span:6}]}]};
 assert.equal(figureDrawingMetrics([grouped],[],20,"antibody-left",measure).baseW,528);
 const narrow={...gel(12),width:40,laneSpan:80};
 // Twelve 44-unit lanes occupy 80% of the half-width panel: 12*44/0.8*2.
 assert.equal(figureDrawingMetrics([gel(12),narrow],[],20,"antibody-left",measure).baseW,1320);
});

test("long antibody and visible row names reserve space on the selected side",()=>{
 const g=gel(6);g.conditions[0].name="Long condition descriptor";
 const label="Anti_Protein_A_variant-1_subunit";
 const expected=label.length*10+28;
 const left=figureDrawingMetrics([g],[label],20,"antibody-left",measure);
 const right=figureDrawingMetrics([g],[label],20,"antibody-right",measure);
 assert.equal(left.labelW,expected);assert.equal(left.gap,110);
 assert.equal(right.labelW,80);assert.equal(right.gap,expected);
 g.conditions[0].name="X".repeat(50);
 assert.equal(figureDrawingMetrics([g],[label],20,"antibody-left",measure).labelW,528);
 g.conditions[0].visible=false;
 assert.equal(figureDrawingMetrics([g],[label],20,"antibody-left",measure).labelW,expected);
});

test("drawing preserves 4:1, 8:1 and one-pixel crop aspect without a minimum-height stretch",()=>{
 assert.equal(figureCropHeight(480,1200,600,80,40),120);
 assert.equal(figureCropHeight(480,1200,600,80,20),60);
 assert.equal(figureCropHeight(480,1200,600,80,0.1),0.5);
 // Canvas rounds a 10.6-pixel width to 11 and a 1.49-pixel height to 1.
 assert.equal(figureCropHeight(110,106,149,10,1),10);
});

test("nearby marker labels reserve font-plus-three spacing below thin images",()=>{
 // Three labels: 20 high, then two 23-unit steps and a four-unit trailing margin.
 assert.equal(figureMarkerBottom(125,100,3,20),170);
 assert.equal(figureMarkerBottom(210,100,3,20),210);
 assert.equal(figureMarkerBottom(100,100,1,20),124);
});


test("Figure identifiers stay atomic and rotate when the full token cannot fit",()=>{
 const name="Protein_A_variant-1";
 assert.deepEqual(autoLabelLayout(name,300,20,true),{mode:"single",lines:[name],fontScale:1});
 const narrow=autoLabelLayout(name,90,20,true);
 assert.equal(narrow.mode,"rotate");assert.deepEqual(narrow.lines,[name]);
 const twoTokens=autoLabelLayout(name+" Control",260,20,true);
 assert.equal(twoTokens.mode,"wrap");assert.deepEqual(twoTokens.lines,[name,"Control"]);
});
