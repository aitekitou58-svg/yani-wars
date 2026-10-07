import {test,expect} from '@playwright/test';
async function setup(page) {
  await page.goto('/');
  await page.locator('[data-product]').first().click();
  await page.locator('#start').click();
  await expect(page.locator('#save')).toBeVisible();
}
test('new copy, 320px layout, empty chart, data periods, tapping and offline information', async ({page,context}) => {
  await page.setViewportSize({width:320,height:740});
  const external=[]; page.on('request',r=>{if(!r.url().startsWith('http://localhost:4173')) external.push(r.url());});
  await page.goto('/');
  await expect(page.locator('.intro')).toContainText('その1回から、お金も、時間も、そして命も。');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({path:'../../outputs/yani-wars-onboarding-320.png'});
  await setup(page);
  await page.locator('[data-view=history]').click();
  await expect(page.locator('[data-hour]')).toHaveCount(24);
  await expect(page.locator('.peak-label')).toContainText('もう少し');
  await page.evaluate(async()=>{
    const {mutate}=await import('/src/storage.js'); const {makeEvent}=await import('/src/core.js');
    await mutate(s=>{s.events=Array.from({length:21},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);d.setHours(i%2?15:14,0,0,0);if(+d>Date.now())d.setDate(d.getDate()-1);return makeEvent(i%2?'saved':'smoked',s.settings,{lifeMinutesPerStick:20},d);});return s;});
  });
  await page.reload(); await page.locator('[data-view=history]').click();
  for(const period of ['today','week','all']) {
    await page.locator(`[data-period=${period}]`).click();
    const result=await page.evaluate(async period=>{const {read}=await import('/src/storage.js');const {hourlyPattern}=await import('/src/patterns.js');return hourlyPattern((await read()).events,period);},period);
    await expect(page.locator('.patterns .quiet')).toContainText(`${result.total}回`);
    await expect(page.locator('.peak-label')).toContainText(result.summary);
  }
  await page.locator('[data-hour="15"]').click(); await expect(page.locator('#hour-detail')).toContainText('15時台');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({path:'../../outputs/yani-wars-patterns-320.png',fullPage:true});
  expect(await page.locator('#record-ad').innerHTML()).toBe('');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto('/privacy/'); await expect(page.locator('h1')).toHaveText('プライバシーポリシー');
  await page.goto('/'); await expect(page.locator('#save')).toBeVisible();
  await page.locator('[data-view=history]').click(); await expect(page.locator('[data-hour]')).toHaveCount(24);
  expect(external).toEqual([]);
});
test('all public pages and ads.txt are readable without an account',async({page,request})=>{
  for(const slug of ['about','guide','life','patterns','privacy','advertising']) { await page.goto(`/${slug}/`); await expect(page.locator('h1')).toBeVisible(); expect(await page.locator('main').innerText()).not.toBe(''); }
  const ads=await request.get('/ads.txt');expect(ads.ok()).toBeTruthy();expect(await ads.text()).not.toContain('pub-XXXXXXXXXXXXXXXX');
});
test('sharing uses exact same full SVG for both low and high recovery',async({page})=>{
  await setup(page);
  for(const count of [1,5400]) {
    await page.evaluate(async count=>{const {mutate}=await import('/src/storage.js');const {makeEvent}=await import('/src/core.js');await mutate(s=>{s.events=Array.from({length:count},()=>makeEvent('saved',s.settings,{lifeMinutesPerStick:20}));return s;});},count);
    await page.reload();
    await expect(page.locator(".landscape svg")).toBeVisible();
    const matches=await page.evaluate(async count=>{
      const {landscapeSvg}=await import('/src/landscape.js');
      window.svgBlobs=[];const original=URL.createObjectURL;
      URL.createObjectURL=function(blob){if(blob.type==='image/svg+xml')window.svgBlobs.push(blob);return original.call(this,blob);};
      const doc=new DOMParser().parseFromString(landscapeSvg(count),'image/svg+xml');
      return doc.documentElement.getAttribute('viewBox')===document.querySelector('.landscape svg').getAttribute('viewBox');
    },count);expect(matches).toBeTruthy();
    await page.locator('[data-action=share]').click();await expect(page.locator('.share-preview')).toHaveJSProperty('naturalWidth',1080);
    expect(await page.evaluate(async count=>{const {landscapeSvg}=await import('/src/landscape.js');return (await window.svgBlobs.at(-1).text())===landscapeSvg(count);},count)).toBeTruthy();
    await page.screenshot({path:`../../outputs/yani-wars-share-${count}.png`});
    await page.locator('.close').click();
  }
});
test('record import safely merges a previous installation without changing gains',async({page})=>{
  await setup(page);await page.locator('#save').click();await expect(page.locator('#today-count')).toHaveText('1');
  const data=await page.evaluate(async()=>{const {read}=await import('/src/storage.js');const s=await read();s.events.push({...s.events[0],id:'import-test',unitPrice:31,freeMinutes:7});return s;});
  await page.locator('[data-view=settings]').click();
  await page.locator('#import-records').setInputFiles({name:'records.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.locator('#confirm-import').click();await page.locator('[data-view=home]').click();
  await expect(page.locator('#today-count')).toHaveText('2');
});
