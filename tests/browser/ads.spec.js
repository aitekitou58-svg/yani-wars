import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
test.use({serviceWorkers:'block'});
for(const fail of [false,true]) test(`home banner ${fail?'failure collapses':'loads once across app rerenders'}`,async({page})=>{
  let scripts=0;
  await page.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='pagead2.googlesyndication.com') {
      scripts++;
      if(fail)return route.abort();
      return route.fulfill({contentType:'text/javascript',body:`window.adsbygoogle={push(){document.querySelector('ins').setAttribute('data-ad-status','filled')}};`});
    }
    if(u.hostname==='ads.test') {
      if(u.pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:`<div id="app"><p>奪われていたものを取り戻すほど、世界に色が戻る。</p><div id="home-ad-anchor"></div></div><button id="action">説明を読む</button><script type="module">import{positionHomeAd}from'/src/ads.js';const c={adsense:{enabled:true,consentConfigured:true,clientId:'ca-pub-1234567890123456',slotHome:'1234567890',hostUrl:'https://ads.test/'}};positionHomeAd(c,true);positionHomeAd(c,true);document.querySelector('#action').onclick=e=>{document.querySelector('#app').innerHTML='<p>世界に色が戻る。</p><div id="home-ad-anchor"></div>';positionHomeAd(c,true);e.target.textContent='操作できた';};</script>`});
      return route.fulfill({contentType:'text/javascript',body:await readFile(path.join('dist',u.pathname),'utf8')});
    }
    return route.abort();
  });
  await page.goto('https://ads.test/');
  if(fail) { await expect(page.locator('#home-banner ins')).toHaveCount(0); await expect(page.locator('#home-banner')).toHaveJSProperty('offsetHeight',0); }
  else { await expect(page.locator('ins')).toHaveAttribute('data-ad-status','filled'); }
  expect(scripts).toBe(1);
  await page.locator('#action').click();await expect(page.locator('#action')).toHaveText('操作できた');
  expect(await page.locator('iframe').count()).toBe(0);
  expect(scripts).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('real home places stable banner below world copy without sharing records', async({page})=>{
  await page.setViewportSize({width:320,height:740});
  let requests=0;
  await page.route('**/*', async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='pagead2.googlesyndication.com') {
      requests++;
      expect(u.searchParams.get('client')).toBe('ca-pub-1234567890123456');
      expect([...u.searchParams.keys()]).toEqual(['client']);
      return route.fulfill({contentType:'text/javascript',body:`window.adsbygoogle={push(){const ad=[...document.querySelectorAll('ins')].find(n=>!n.getAttribute('data-ad-status'));ad.setAttribute('data-ad-status','filled');ad.style.height='100px';ad.style.background='#eee';ad.textContent='テスト用バナー（実広告ではありません）';}};`});
    }
    if(u.hostname!=='yani.test') return route.abort();
    const file=u.pathname==='/'?'index.html':u.pathname.slice(1);
    const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.html':'text/html','.png':'image/png'};
    let body=await readFile(path.join('dist',file));
    if(file==='config.json') {const c=JSON.parse(body);c.adsense={enabled:true,consentConfigured:true,clientId:'ca-pub-1234567890123456',slotHome:'1234567890',slotRecord:'2345678901'};body=JSON.stringify(c);}
    return route.fulfill({body,contentType:(types[path.extname(file)]||'text/plain')+'; charset=utf-8'});
  });
  await page.goto('https://yani.test/');
  await page.locator('[data-product]').first().click();await page.locator('#start').click();
  await expect(page.locator('#home-banner ins')).toHaveAttribute('data-ad-status','filled');
  await expect(page.locator('#home-banner ins')).toHaveCSS('height','100px');
  expect(await page.locator('#home-banner ins').getAttribute('data-ad-format')).toBe(null);
  await page.locator('.world-copy').scrollIntoViewIfNeeded();
  const positions=await page.evaluate(()=>({copy:document.querySelector('.world-copy').getBoundingClientRect().bottom,ad:document.querySelector('#home-banner').getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>innerWidth}));
  expect(positions.ad).toBeGreaterThan(positions.copy);expect(positions.overflow).toBe(false);
  await page.screenshot({path:'../../outputs/yani-wars-home-banner-preview.png'});
  await page.locator('[data-view=history]').click();await expect(page.locator('#home-banner')).toBeHidden();
  await expect(page.locator('#record-banner ins')).toHaveAttribute('data-ad-status','filled');
  await page.locator('[data-view=home]').click();await expect(page.locator('#home-banner')).toBeVisible();
  expect(requests).toBe(1);
  await expect(page.locator('#record-banner')).toBeHidden();
});
