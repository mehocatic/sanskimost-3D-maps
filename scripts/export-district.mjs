import {createServer} from 'vite';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

// Expose the completed scene only inside this temporary local export server.
const server=await createServer({cacheDir:'.qa/vite-blender',optimizeDeps:{include:['three/addons/exporters/GLTFExporter.js']},server:{host:'127.0.0.1',port:0},plugins:[{
  name:'blender-scene-export',enforce:'pre',
  transform(code,id){
    if(!id.endsWith('/src/viewer.ts'))return;
    const anchor='  return {focus,home,top';
    if(!code.includes(anchor))throw Error('Viewer export hook missing');
    return code.replace(anchor,'  window.exportDistrict = {city,ground,water,blocks,life,special,island};\n'+anchor);
  }
}]});
await server.listen();
let browser;
try{
  browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>window.exportDistrict,undefined,{timeout:90000});
  const data=await page.evaluate(async()=>{
    const {exportDistrict}=await import('/scripts/district-scene.js');
    return exportDistrict(window.exportDistrict);
  });
  await writeFile(process.argv[2]??'blender/Centar.glb',Buffer.from(data.split(',')[1],'base64'));
}finally{await browser?.close();await server.close()}

