import { test } from 'node:test';
import assert from 'node:assert/strict';
import {parseRecords,summarize,type Trial,type Battery} from './report.ts';
const trial=(trial:string,extra:Partial<Trial>={}):Trial=>({kind:'trial',trial,pairing:'mixed',devicePair:'samsung_iphone',state:'locked5',entryAt:1000,departureAt:181000,...extra});
test('missed and late notifications remain in timing denominator',()=>{
 const r=summarize([trial('a',{displayAAt:31000,displayBAt:41000}),trial('b',{displayAAt:41000}),trial('c',{displayAAt:61000,displayBAt:131000})]).results[0];
 assert.equal(r.medianObservedMs,85000);assert.equal(r.n,3);assert.equal(r.within60,1);assert.equal(r.within120,1);assert.equal(r.missed,1);assert.equal(r.timingGate,'insufficient sample');assert.equal(r.p95ObservedMs,null);
});
test('simulations are excluded rather than counted as physical evidence',()=>{const r=summarize([trial('demo',{simulated:true,displayAAt:2000,displayBAt:2000})]);assert.equal(r.excludedSimulations,1);assert.equal(r.results.length,0);});
test('invalid intervals, duplicate trial IDs and sensitive observer fields are rejected',()=>{
 assert.throws(()=>parseRecords(JSON.stringify(trial('a',{displayAAt:500}))));assert.throws(()=>parseRecords([trial('a'),trial('a')].map(r=>JSON.stringify(r)).join('\n')));assert.throws(()=>parseRecords(JSON.stringify({...trial('a'),latitude:1})));
});
test('notifications after departure do not count as a useful bilateral alert',()=>{const r=summarize([trial('a',{departureAt:11000,displayAAt:10000,displayBAt:12000})]).results[0];assert.equal(r.within60,0);});
test('sample gates and wrong-context controls use separate denominators',()=>{
 const rows=Array.from({length:30},(_,i)=>trial('p'+i,{displayAAt:10000,displayBAt:i<27?11000:i<29?91000:131000}));
 const controls=Array.from({length:30},(_,i)=>trial('n'+i,{negative:true,offerCreated:i===0}));
 const r=summarize([...rows,...controls]).results[0];assert.equal(r.timingGate,'preliminary pass');assert.equal(r.controlGate,'preliminary pass');assert.equal(r.controls,30);assert.equal(r.wrongOffers,1);
});
test('battery comparison uses matched eight-hour runs and reports insufficient samples',()=>{
 const b=(condition:Battery['condition'],drop:number):Battery=>({kind:'battery',device:'samsung',condition,startPercent:90,endPercent:90-drop,durationHours:8});
 assert.equal(summarize([b('idle',2),b('discovery',4)]).batteries[0].gate,'insufficient sample');
 const r=summarize([...Array.from({length:3},()=>b('idle',2)),...Array.from({length:3},()=>b('discovery',4))]).batteries[0];assert.equal(r.additionalPoints,2);assert.equal(r.gate,'preliminary pass');
 assert.throws(()=>parseRecords(JSON.stringify({...b('idle',2),durationHours:1})));
});
