import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
test.use({serviceWorkers:'block'});
for(const fail of [false,true]) test(`isolated ad ${fail?'failure collapses':'loads once without access to records'}`,async({page})=>{
  let scripts=0;
  await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='pagead2.googlesyndication.com') {
      scripts++;
      if(fail)return route.abort();
      return route.fulfill({contentType:'text/javascript',body:`window.adsbygoogle={push(){document.querySelector('ins').setAttribute('data-ad-status','filled')}};`});
    }
    if(u.hostname==='ads.test') {
      if(u.pathname.endsWith('frame.js'))return route.fulfill({contentType:'text/javascript',body:await readFile('ads-dist/frame.js','utf8')});
      return route.fulfill({contentType:'text/html; charset=utf-8',body:`<ins class="adsbygoogle" data-ad-client="ca-pub-1234567890123456" data-ad-slot="1234567890"></ins><script src="/frame.js"></script><script src="/frame.js"></script>`});
    }
    if(u.hostname==='yani.test') {
      if(u.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<div id="ad"></div><button id="action">記録操作</button><script type="module">import{mountAd}from'/src/ads.js';const c={adsense:{enabled:true,consentConfigured:true,clientId:'ca-pub-1234567890123456',slotRecord:'1234567890',hostUrl:'https://ads.test/'}};mountAd(document.querySelector('#ad'),c,'slotRecord',true);mountAd(document.querySelector('#ad'),c,'slotRecord',true);document.querySelector('#action').onclick=e=>e.target.textContent='操作できた';</script>`});
      return route.fulfill({contentType:'text/javascript',body:await readFile(path.join('dist',u.pathname),'utf8')});
    }
    return route.abort();
  });
  await page.goto('https://yani.test/');
  if(fail) { await expect(page.locator('#ad iframe')).toHaveCount(0); await expect(page.locator('#ad')).toHaveJSProperty('offsetHeight',0); }
  else {
    await expect(page.locator('#ad')).toHaveClass('advert');
    const frame=page.frames().find(f=>f.url().startsWith('https://ads.test'));
    expect(await frame.evaluate(()=>{try{return Boolean(parent.indexedDB);}catch{return false;}})).toBe(false);
  }
  expect(scripts).toBe(1);
  await page.locator('#action').click();await expect(page.locator('#action')).toHaveText('操作できた');
});
