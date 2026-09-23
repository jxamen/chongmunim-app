/** Expo web capture only. Leaves src/ untouched; intercepts API including Metro's /cm-api proxy. */
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('C:/Users/jxame/.claude/jobs/d0d2efb0/tmp/pw/node_modules/playwright'));}
const demo=require('./demo-data');const root=path.resolve(__dirname,'../..');const base=process.env.STORE_WEB_URL||'http://localhost:8123';
async function capture(){
 const browser=await chromium.launch({headless:true});const calls=[];const errors=[];const blocked=[];let state={uploaded:false};
 try{
 const receiptPage=await browser.newPage({viewport:{width:700,height:1000}});
 await receiptPage.goto(pathToFileURL(path.join(__dirname,'demo-receipt.html')).href);await receiptPage.evaluate(()=>document.fonts.ready);await receiptPage.screenshot({path:path.join(__dirname,'demo-receipt.png')});await receiptPage.close();
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,timezoneId:'Asia/Seoul',locale:'ko-KR'});
 await page.clock.setFixedTime(new Date('2026-09-24T10:00:00+09:00'));
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(u.pathname==='/canvaskit.wasm')return route.fulfill({path:require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm'),contentType:'application/wasm'});
  if(u.pathname==='/store-demo-receipt.png')return route.fulfill({path:path.join(__dirname,'demo-receipt.png'),contentType:'image/png'});
  const isApi=u.pathname.startsWith('/cm-api/')||u.hostname==='api.j-curve.co.kr';
  if(isApi){const p=u.pathname.replace(/^\/cm-api\//,'').replace(/^\/v1\/chongmunim\//,'');calls.push({method:request.method(),path:p,mocked:true});return route.fulfill({json:demo.response(p,request.method(),state)});}
  if(u.origin===new URL(base).origin||u.protocol==='data:'||u.protocol==='blob:')return route.continue();
  blocked.push(u.origin+u.pathname);return route.abort('blockedbyclient');
 });
 await page.addInitScript(({member})=>{localStorage.clear();localStorage.setItem('cm.session',JSON.stringify({token:'STORE-DEMO-NOT-A-REAL-TOKEN',expiresAt:9999999999999}));localStorage.setItem('cm.member',JSON.stringify(member));localStorage.setItem('cm.group','901');},demo);
 const raw=path.join(root,'store/raw');fs.mkdirSync(raw,{recursive:true});
 const snap=async(name)=>{await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});await page.waitForTimeout(900);await page.screenshot({path:path.join(raw,name+'.png')});console.log(name);};
 const close=()=>page.getByText('✕',{exact:true}).click();
 await page.goto(base,{waitUntil:'networkidle'});await page.getByText('1,245,000',{exact:false}).first().waitFor();await snap('01-home');
 let chooser=page.waitForEvent('filechooser');await page.getByLabel('영수증 찍기',{exact:true}).click();await(await chooser).setFiles(path.join(__dirname,'demo-receipt.png'));await page.getByText('1장 전송하기',{exact:true}).click();await page.getByText('지금 기록',{exact:true}).click();await page.getByText('지금 기록',{exact:true}).waitFor({state:'hidden'});await page.getByText('산 것 2가지',{exact:true}).waitFor();await snap('02-record');await close();
 await page.getByRole('tab',{name:'장부',exact:true}).click();await page.getByText('식비',{exact:true}).click();await page.getByText('9/20 산마루 식당',{exact:true}).waitFor();await snap('03-ledger');
 await page.getByRole('tab',{name:'모임',exact:true}).click();await page.getByText('미납',{exact:true}).first().waitFor();await snap('04-dues');
 await page.getByText('공지',{exact:true}).click();await page.getByText('10월 정기산행 안내',{exact:true}).click();await page.getByText('읽음 6 / 8명',{exact:true}).waitFor();await page.getByText('알림 보냄',{exact:true}).first().waitFor();await snap('05-notice');await close();
 await page.getByText('8월 결산',{exact:true}).click();await page.getByText('결산 보기',{exact:true}).click();await page.getByText('당월 이월',{exact:true}).waitFor();await snap('07-closing');await close();await close();
 await page.getByRole('tab',{name:'홈',exact:true}).click();await page.getByText('지급 요청이 기다려요',{exact:true}).click();await page.getByText('시연은행 000-0000-0000 · 이서연 복사',{exact:true}).waitFor();await snap('06-request');
 fs.writeFileSync(path.join(__dirname,'capture-report.json'),JSON.stringify({viewport:[390,844],deviceScaleFactor:3,fixedDate:'2026-09-24',errors,blocked,calls},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
 }finally{await browser.close();}
}
if(require.main===module)capture().catch(e=>{console.error(e);process.exitCode=1;});module.exports=capture;
