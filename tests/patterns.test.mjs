import test from 'node:test';
import assert from 'node:assert/strict';
import { hourlyPattern } from '../src/patterns.js';
import { makeEvent, initialState } from '../src/core.js';
import { mergeRecords } from '../src/transfer.js';
import { adSettings } from '../src/ads.js';
const settings = {product:{id:'a',name:'A',packPrice:600,count:20},tone:'praise',freeMinutes:5};
const now = new Date(2026,9,7,23,59);
const event = (day,hour,type='saved') => makeEvent(type, settings, {lifeMinutesPerStick:20}, new Date(2026,9,day,hour));
test('empty and one event do not claim a pattern; all 24 bins exist', () => {
  for (const es of [[],[event(7,0)]]) { const p = hourlyPattern(es,'today',now); assert.equal(p.hours.length,24); assert.equal(p.peak,null); assert.match(p.summary,/もう少し/); }
});
test('today, Monday week and all include both event types with date boundaries', () => {
  const es = [event(4,23),event(5,0,'smoked'),event(6,23),event(7,0),event(7,23,'smoked'),event(8,0)];
  assert.equal(hourlyPattern(es,'today',now).total,2);
  assert.equal(hourlyPattern(es,'week',now).total,4);
  assert.equal(hourlyPattern(es,'all',now).total,5);
  assert.equal(hourlyPattern(es,'today',now).hours[23],1);
  const monday = new Date(2026,9,5,1);
  assert.equal(hourlyPattern(es,'week',monday).total,1);
});
test('adjacent hours identify a three-hour band and cross midnight', () => {
  for (const start of [14,23]) {
    const es = [5,6,7].flatMap(d => [event(d,start),event(d,(start+1)%24),event(d,(start+1)%24,'smoked'),event(d,(start+2)%24)]);
    const p = hourlyPattern(es,'all',now); assert.equal(p.peak.start,start); assert.equal(p.peak.end,(start+3)%24);
  }
});
test('sparse days and a uniform or competing distribution do not assert a peak', () => {
  assert.equal(hourlyPattern(Array.from({length:20},()=>event(7,15)),'all',now).peak,null);
  const uniform=[5,6,7].flatMap(d=>Array.from({length:24},(_,h)=>event(d,h)));
  assert.equal(hourlyPattern(uniform,'all',now).peak,null);
});
test('large history counted without truncation; saved wall hour survives timezone change', () => {
  const es = Array.from({length:50000},(_,i)=>({...event(5+i%3,i%24),hour:23}));
  const p=hourlyPattern(es,'all',now); assert.equal(p.total,50000); assert.equal(p.hours[23],50000);
});
test('record transfer preserves current settings, historical prices, and deduplicates', () => {
  const a={...initialState(),settings,events:[event(5,1)]};
  const b={...initialState(),settings:{...settings,freeMinutes:10},events:[...a.events,event(6,2)]};
  const merged=mergeRecords(a,b); assert.equal(merged.events.length,2); assert.equal(merged.settings.freeMinutes,5); assert.equal(merged.events[0].unitPrice,30);
  assert.equal(mergeRecords(merged,b).events.length,2);
  assert.throws(()=>mergeRecords(a,{...b,events:[{...a.events[0],unitPrice:999}]}));
  assert.throws(()=>mergeRecords(a,{version:1,events:[]}));
});
test('ads require production, HTTPS, valid IDs, configured consent and valid banner settings', () => {
  const loc={origin:'https://ads.example.org',protocol:'https:'};
  const config={adsense:{enabled:true,consentConfigured:true,clientId:'ca-pub-1234567890123456',slotRecord:'1234567890',hostUrl:'https://ads.example.org/'}};
  assert.ok(adSettings(config,'slotRecord',{origin:'https://ads.example.org',protocol:'https:'},true));
  assert.equal(adSettings(config,'slotRecord',loc,false),null);
  for(const patch of [{enabled:false},{consentConfigured:false},{clientId:''},{slotRecord:''}]) assert.equal(adSettings({adsense:{...config.adsense,...patch}},'slotRecord',loc,true),null);
});

test('ownership verification is independent of ad slots and excluded from development', async () => {
  const {adsenseHead}=await import('../scripts/adsense-head.mjs');
  const config={adsense:{clientId:'ca-pub-8745360624658964',siteVerification:true,enabled:false}};
  assert.equal(adsenseHead(config,false),'');
  assert.equal(adsenseHead({adsense:{...config.adsense,siteVerification:false}},true),'');
  assert.equal(adsenseHead({adsense:{...config.adsense,clientId:'invalid'}},true),'');
  const head=adsenseHead(config,true);
  assert.match(head,/google-adsense-account/);
  assert.match(head,/client=ca-pub-8745360624658964/);
  assert.match(head,/location.hostname === 'yaniwars.pages.dev'/);
  assert.doesNotMatch(head,/localStorage|indexedDB|events|settings|adSlot|push\(/);
});
