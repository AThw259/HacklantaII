import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCrime, crimeLookbackDays} from '../js/crime.js';
import {crimeEvidence} from '../js/arcgis.js';
import {scoreRoute} from '../js/scoring.js';

const day=86400000;
const route={points:[[33.75,-84.39],[33.75,-84.38]]};
const feature=(code,label,daysAgo,id,now)=>({
  attributes:{OBJECTID:id,IncidentNumber:String(id),ReportDate:now-daysAgo*day,NibrsUcrCode:code,NIBRS_Offense:label},
  geometry:{x:-84.385,y:33.75}
});

test('crime types use 1-5 risk penalties',()=>{
  for(const [code,label,points] of [
    ['35A','',-1],['290','',-1],['23C','',-2],['23F','',-2],
    ['240','',-3],['220','',-3],['13B','',-3],['120','',-4],
    ['13A','',-4],['520','',-4],['','Shooting',-5],['11A','',-5],
    ['100','',-5],['09A','',-5]
  ]) assert.equal(classifyCrime({NibrsUcrCode:code,NIBRS_Offense:label}).points,points);
});

test('lookback windows follow risk level',()=>{
  assert.equal(crimeLookbackDays(1),7);
  assert.equal(crimeLookbackDays(2),7);
  assert.equal(crimeLookbackDays(3),14);
  assert.equal(crimeLookbackDays(4),30);
  assert.equal(crimeLookbackDays(5),30);
});

test('firearm flag does not prove a shooting and unknown offenses remain unknown',()=>{
  assert.equal(classifyCrime({NibrsUcrCode:'13A',FireArmInvolved:'Y'}).points,-4);
  assert.equal(classifyCrime({NIBRS_Offense:'Fraud'}),null);
  assert.equal(classifyCrime({NibrsUcrCode:'09A',NIBRS_Offense:'Homicide shooting'}).points,-5);
});

test('crime evidence applies severity-specific age windows',()=>{
  const now=Date.UTC(2026,9,11);
  const e=crimeEvidence(route,[
    feature('35A','',6,1,now),   // level 1, count
    feature('35A','',8,2,now),   // level 1, expired
    feature('240','',13,3,now),  // level 3, count
    feature('240','',15,4,now),  // level 3, expired
    feature('09A','',29,5,now)   // level 5, count
  ],now);
  assert.equal(e.crimePoints,-9);
  assert.equal(e.crimeCount,3);
});

test('crime points affect route score and retain the overall cap',()=>{
  const r={points:[[0,0],[0,.01]]};
  assert.equal(scoreRoute(r,[],[],{crimePoints:-4}).score,46);
  assert.equal(scoreRoute(r,[],[],{crimePoints:-90}).score,25);
  assert.equal(scoreRoute(r,[],[],{crimePoints:5}).score,50);
});
