import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
let server, origin;
test.beforeAll(async()=>{
  const root=path.resolve('dist');
  server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname.endsWith('/index.html')) {res.writeHead(302,{Location:pathname.slice(0,-10)});res.end();return;}
      let file=path.resolve(root,'.'+pathname);
      if(file!==root&&!file.startsWith(root+path.sep))throw Error();
      if((await stat(file)).isDirectory())file=path.join(file,'index.html');
      const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
      const body=await readFile(file);res.writeHead(200,{'Content-Type':(types[path.extname(file)]||'application/octet-stream')+'; charset=utf-8'});res.end(body);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}/`;
});
test.afterAll(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
test('Cloudflare-style index redirects preserve online and offline navigation',async({page,context})=>{
  await page.goto(origin);await page.locator('[data-product]').first().click();await page.locator('#start').click();
  await page.locator('#save').click();await expect(page.locator('#today-count')).toHaveText('1');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  expect(await page.evaluate(async()=> (await caches.match(new URL('index.html',location.href))).redirected)).toBe(true);
  await page.reload();await expect(page.locator('#today-count')).toHaveText('1');
  await context.setOffline(true);await page.reload();await expect(page.locator('#today-count')).toHaveText('1');
  await page.goto(origin+'patterns/');await expect(page.locator('h1')).toContainText('吸いたくなる時間');
});
