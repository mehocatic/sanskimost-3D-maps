import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const url=process.env.MAP_TEST_URL || 'http://127.0.0.1:5174/';
const output=path.resolve('screenshots');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.CHROME_CHANNEL || 'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const errors=[], external=[],failed=[];
function monitor(page){
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url())});
  page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)external.push(r.url())});
}
async function ready(page){
  await page.goto(url,{waitUntil:'networkidle'});await expect(page.locator('html')).toHaveAttribute('data-ready','true',{timeout:60000});
}
async function snapshot(page,name){await page.screenshot({path:path.join(output,name+'.png'),timeout:45000})}
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});monitor(page);await ready(page);
  await expect(page.locator('#places button')).toHaveCount(4);
  await snapshot(page,'sanski-most-dan');
  await page.locator('#night').click();await expect(page.locator('#night')).toHaveAttribute('aria-pressed','true');await page.waitForTimeout(300);
  await snapshot(page,'sanski-most-noc');await page.locator('#day').click();
  await page.locator('#query').fill('Hamdije Pozderca');await expect(page.locator('#places')).toContainText('Hamdije Pozderca');await page.locator('#query').press('Enter');
  await expect(page.locator('#detail')).toContainText('Hamdije Pozderca');await page.locator('#detail .save').click();
  await page.locator('[data-tab="saved"]').click();await expect(page.locator('#places')).toContainText('Hamdije Pozderca');
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-ready','true');await page.locator('[data-tab="saved"]').click();await expect(page.locator('#places')).toContainText('Hamdije Pozderca');
  await page.locator('[data-tab="places"]').click();
  for(const id of ['w346178044','w56396323','w40699044','w226624055']){
    const button=page.locator('#places [data-id="'+id+'"]');const title=await button.locator('strong').innerText();
    await button.click();await expect(page.locator('#detail h2')).toHaveText(title);await page.waitForTimeout(900);
    if(id==='w346178044')await snapshot(page,'hamzibegova-dzamija');
  }
  await page.locator('#home').click();await page.waitForTimeout(950);
  await page.locator('#layers-btn').click();
  for(const id of ['labels','trees','cars','buildings']){
    const button=page.locator('[data-layer="'+id+'"]');await button.click();await expect(button).toHaveAttribute('aria-pressed','false');
    if(id==='labels')await expect(page.locator('#labels')).toBeHidden();
    await button.click();await expect(button).toHaveAttribute('aria-pressed','true');
  }
  await page.locator('#layers-btn').click();
  await page.locator('#perspective').click();await expect(page.locator('#perspective')).toHaveText('3D');await page.waitForTimeout(900);
  await page.locator('#perspective').click();await expect(page.locator('#perspective')).toHaveText('2D');
  await page.locator('#plus').click();await page.waitForTimeout(350);await page.locator('#minus').click();await page.waitForTimeout(350);
  const coords=await page.locator('#coords').innerText();await page.mouse.move(900,435);await page.mouse.down();await page.mouse.move(995,480,{steps:12});await page.mouse.up();
  await expect(page.locator('#coords')).not.toHaveText(coords);
  const bearing=await page.locator('#compass svg').getAttribute('style');await page.mouse.move(980,435);await page.mouse.down({button:'right'});await page.mouse.move(845,485,{steps:8});await page.mouse.up({button:'right'});
  await expect(page.locator('#compass svg')).not.toHaveAttribute('style',bearing);
  await page.locator('#compass').click();await page.waitForTimeout(900);await page.locator('#home').click();await page.waitForTimeout(950);
  // Click actual unlabelled geometry through the canvas, bypassing landmark controls.
  let picked=false;
  for(const [x,y] of [[562,659],[999,558],[902,548],[632,530],[945,528],[930,615],[505,753],[845,664],[607,752],[518,351],[922,350],[976,336],[1075,488]]){
    await page.mouse.click(x,y);if(await page.locator('#detail').isVisible()){picked=true;break}
  }
  expect(picked,'building/feature ray pick').toBeTruthy();await page.locator('#home').click();
  await page.locator('#tour').click();await expect(page.locator('#tour-number')).toHaveText('1 / 4');
  await expect(page.locator('#tour-number')).toHaveText('2 / 4',{timeout:13000});await page.locator('#next').click();await expect(page.locator('#tour-number')).toHaveText('3 / 4');
  await page.locator('#next').click();await page.locator('#next').click();await expect(page.locator('#tour-progress')).toBeHidden();
  for(const id of ['sources','help','about']){await page.locator('#'+id).click();await expect(page.locator('dialog')).toBeVisible();await page.locator('#dialog-close').click()}
  await page.locator('#full').click();expect(await page.evaluate(()=>Boolean(document.fullscreenElement))).toBeTruthy();await page.locator('#full').click();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});monitor(mobile);await ready(mobile);
  await expect(mobile.locator('#mobile-open')).toBeVisible();expect(await mobile.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await snapshot(mobile,'mobilni-prikaz');await mobile.locator('#mobile-open').tap();await mobile.locator('#places [data-id="w346178044"]').tap();await expect(mobile.locator('#detail h2')).toHaveText('Hamzibegova džamija');
  const cdp=await mobile.context().newCDPSession(mobile),before=await mobile.locator('#coords').innerText();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:120,y:240}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:177,y:283}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(mobile.locator('#coords')).not.toHaveText(before);
  expect(errors,'browser errors').toEqual([]);expect(failed,'HTTP errors').toEqual([]);expect(external,'external runtime requests').toEqual([]);
  console.log('PASS: desktop and touch UI, local data, four landmarks, ray pick, search, saved persistence, layers, day/night, camera, auto-tour, fullscreen, sources and screenshots. No browser errors, failed responses, or external requests.');
}finally{await browser.close()}

