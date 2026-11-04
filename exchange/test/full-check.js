// Full functional test of the AuraGen exchange demo / sandbox (Playwright).
// usage: node test/full-check.js "$PWD/auragen-exchange-sandbox-sell-v7.html" sandbox /tmp/shot
//        node test/full-check.js "$PWD/auragen-exchange-demo-v7.html" demo /tmp/shot
const {chromium}=require('playwright');
const [file,mode,shot]=process.argv.slice(2);
const SB=mode==='sandbox';
let pass=0,fail=0;const fails=[];
function check(name,cond,detail=''){if(cond){pass++;}else{fail++;fails.push(name+(detail?' — '+detail:''));}console.log((cond?'PASS ':'FAIL ')+name+(detail&&!cond?' — '+detail:''));}
(async()=>{
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1400,height:900}});
const pg=await ctx.newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
let dialogs=[];pg.on('dialog',d=>{dialogs.push(d.message());d.accept()});
const url='file://'+file;
await pg.goto(url);await pg.waitForTimeout(700);
const ev=(f,a)=>pg.evaluate(f,a);
const cards=()=>ev(()=>[...document.querySelectorAll('#markets .market')].map(c=>c.dataset.id||c.dataset.labId));
const bal=()=>ev(()=>parseFloat(document.getElementById('sbBal').textContent.replace(/[$,]/g,'')));
const toast=()=>ev(()=>document.getElementById('toast').textContent);
const closeAll=async()=>{for(let i=0;i<4;i++){await pg.keyboard.press('Escape');await pg.waitForTimeout(120);}await ev(()=>document.querySelectorAll('[data-panel-close]').forEach(b=>b.offsetParent&&b.click()));await pg.waitForTimeout(250);};
const vis=sel=>ev(s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();const cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.opacity!=='0'},sel);

// ---------- 1. initial load ----------
check('17 market cards render',(await cards()).length===17);
check('open-market count shows 17',(await ev(()=>openMarketCount.textContent))==='17');
check('balance chip starts at $10,000',(await bal())===10000);
check('sandbox banner '+(SB?'present':'absent'),(await ev(()=>!!document.getElementById('sbReset')))===SB);
const navBtns=await ev(()=>[...document.querySelectorAll('.nav-actions button')].map(b=>b.textContent.trim()).filter(Boolean));
check('nav panels: '+navBtns.join(' / '),SB?navBtns.includes('AMM Ledger'):!navBtns.includes('AMM Ledger'));

// ---------- 2. search ----------
await pg.fill('#search','fed');await pg.waitForTimeout(200);
let c=await cards();check('search "fed" finds Fed market',c.includes('1'),c.join());
check('search status announces result',(await ev(()=>searchStatus.textContent)).includes('found'));
await pg.fill('#search','macrodesk');await pg.waitForTimeout(150);
c=await cards();check('search by creator (MacroDesk → 2)',c.length===2,c.join());
await pg.fill('#search','zzzzqq');await pg.waitForTimeout(150);
check('no-result empty state',await ev(()=>!!document.querySelector('.empty')));
await pg.click('[data-empty-clear]');await pg.waitForTimeout(150);
check('empty-state Clear search restores list',(await cards()).length===17);
await pg.fill('#search','gold');await pg.click('#searchClear');await pg.waitForTimeout(150);
check('× clear button clears search',(await ev(()=>search.value))===''&&(await cards()).length===17);
await pg.click('body',{position:{x:5,y:600}});await pg.keyboard.press('/');
check('"/" focuses search',await ev(()=>document.activeElement.id==='search'));
await pg.keyboard.press('Escape');await ev(()=>document.activeElement.blur());

// ---------- 3. categories ----------
const catNames=await ev(()=>[...document.querySelectorAll('[data-cat]')].map(b=>b.dataset.cat));
for(const cat of catNames){
  await pg.click(`[data-cat="${cat}"]`);await pg.waitForTimeout(120);
  const r=await ev(cat=>{const cs=[...document.querySelectorAll('#markets .market')];return{n:cs.length,ok:cs.every(c=>cat==='All'||c.querySelector('.market-cat').textContent.startsWith(cat))}},cat);
  check(`category ${cat}: ${r.n} cards, all match`,r.n>0&&r.ok);
}
await pg.click('[data-cat="All"]');

// ---------- 4. sort ----------
await pg.click('[data-sort="newest"]');await pg.waitForTimeout(150);
c=await cards();check('Newest sort puts Brent (created 22) first',c[0]==='17',c.slice(0,3).join());
await pg.click('[data-sort="trending"]');await pg.waitForTimeout(150);
c=await cards();check('Trending sort puts Fed (trend 97) first',c[0]==='1',c.slice(0,3).join());

// ---------- 5. filters ----------
await pg.click('#filterTrigger');await pg.waitForTimeout(250);
check('filter panel opens',await ev(()=>filterPanel.classList.contains('open')));
await pg.click('.filter-option[data-filter="source"][data-value="official"]');await pg.waitForTimeout(150);
c=await cards();check('AuraGen-only filter → 3 official markets',c.sort().join()==='17,7,9',c.join());
check('filter badge shows 1',(await ev(()=>filterCount.textContent))==='1');
await pg.click('.filter-option[data-filter="source"][data-value="all"]');
await pg.click('.filter-option[data-filter="year"][data-value="2027"]');await pg.waitForTimeout(150);
const d27=await ev(()=>[...document.querySelectorAll('#markets .market')].map(c=>c.querySelector('.market-cat').textContent));
check(`2027 filter → ${d27.length} markets`,d27.length===6,d27.join(' | '));
await pg.click('#resetFilters');await pg.waitForTimeout(150);
check('Reset filters restores 17',(await cards()).length===17);
await pg.click('body',{position:{x:5,y:600}});await pg.waitForTimeout(250);
check('click outside closes filter panel',!(await ev(()=>filterPanel.classList.contains('open'))));

// ---------- 6. saved / stars ----------
await pg.click('#markets .market[data-id="3"] .star');await pg.waitForTimeout(150);
check('star saves market + toast',(await toast())==='Market saved'&&(await ev(()=>document.querySelector('.saved-count').textContent))==='1');
await pg.click('[data-saved-view]');await pg.waitForTimeout(150);
c=await cards();check('Saved view shows only saved market',c.join()==='3',c.join());
await pg.click('[data-cat="All"]');

// ---------- 7. tape ----------
const tapeIds=await ev(()=>[...document.querySelectorAll('.tape-group:first-child .tape-item')].map(t=>[t.dataset.tapeId,t.querySelector('b').textContent]));
const dataP=await ev(()=>Object.fromEntries(data.map(m=>[m.id,m.p])));
check('tape % matches card data',tapeIds.every(([id,t])=>t===dataP[id]+'% YES'),JSON.stringify(tapeIds));
await ev(()=>document.querySelector('.tape-item[data-tape-id="17"]').click());await pg.waitForTimeout(400);
check('tape click opens matching market',(await ev(()=>drawerTitle.textContent)).startsWith('Brent'));
await closeAll();
await pg.click('#tapePause');
check('tape pause toggles',await ev(()=>tapePause.getAttribute('aria-pressed')==='true'&&document.querySelector('.market-tape').classList.contains('paused')));
await pg.click('#tapePause');

// ---------- 8. drawer & inputs ----------
await pg.click('#markets .market[data-id="1"] .buy.no');await pg.waitForTimeout(400);
check('No button opens drawer with No selected',await ev(()=>drawerNo.classList.contains('selected')));
const costNo=await ev(()=>cost.textContent);
await pg.click('#drawerYes');await pg.waitForTimeout(100);
const costYes=await ev(()=>cost.textContent);
check(`Yes/No toggle changes estimate (${costNo} vs ${costYes})`,costNo!==costYes);
for(const [v,exp] of [['0',1],['-5',1],['abc',1],['2.7',2],['250',250]]){
  await pg.fill('#contractInput',v);await pg.locator('#contractInput').blur();await pg.waitForTimeout(100);
  const pay=await ev(()=>payout.textContent);
  check(`contracts "${v}" → payout $${exp}.00`,pay===`$${exp}.00`,pay);
}
await pg.click('#fullRules');check('View full rules gives feedback',(await toast()).length>0);
// focus trap
await pg.focus('#drawerYes');for(let i=0;i<25;i++)await pg.keyboard.press('Tab');
check('Tab focus stays inside drawer',await ev(()=>!!document.activeElement.closest('.drawer')));
await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
check('Escape closes drawer',!(await ev(()=>drawer.classList.contains('open'))));

// ---------- 9. order review: balance, cap ----------
await pg.click('#markets .market[data-id="1"] .buy.yes');await pg.waitForTimeout(400);
await pg.fill('#contractInput','500');await pg.click('#reviewOrder');await pg.waitForTimeout(400);
let capShown=await ev(()=>orderCapWarning.classList.contains('show')),placeDis=await ev(()=>placeOrder.disabled);
if(SB)check('sandbox: no $250 cap block on $400 order',!capShown&&!placeDis);
else check('demo: $250 cap blocks $400 order with warning',capShown&&placeDis);
await pg.click('.edit-order');await pg.waitForTimeout(300);
check('Edit order returns to drawer',!(await ev(()=>orderLayer.classList.contains('open')))&&(await ev(()=>drawer.classList.contains('open'))));
await pg.fill('#contractInput','20000');await pg.click('#reviewOrder');await pg.waitForTimeout(400);
const pt=await ev(()=>placeOrder.textContent);
if(SB)check('20,000 contracts → Insufficient balance, disabled',pt.includes('Insufficient balance')&&(await ev(()=>placeOrder.disabled)),pt);
else check('demo 20,000 contracts blocked (cap or balance)',await ev(()=>placeOrder.disabled),pt);
await closeAll();
// small order that passes everywhere: 200 YES @80 ≈ $162
await pg.click('#markets .market[data-id="1"] .buy.yes');await pg.waitForTimeout(400);
await pg.fill('#contractInput','200');await pg.click('#reviewOrder');await pg.waitForTimeout(400);
const tot=parseFloat((await ev(()=>orderTotal.textContent)).replace(/[$,]/g,''));
await pg.click('#placeOrder');await pg.waitForTimeout(500);
check('order fills, success screen shows',await ev(()=>orderSuccess.classList.contains('show')&&orderSuccess.textContent.includes('Bought 200 YES')));
check(`balance drops by order total $${tot}`,Math.abs((await bal())-(10000-tot))<0.005,String(await bal()));
await pg.click('#doneOrder');await pg.waitForTimeout(300);
check('Done closes order review',!(await ev(()=>orderLayer.classList.contains('open'))));
await closeAll();
const p1=await ev(()=>document.querySelector('#markets .market[data-id="1"] .prob').firstChild.textContent);
const pool1=await ev(()=>{const p=AuraAMM.state().pools[1];return AuraAMM.lPrice(p.qY,p.qN,p.b)});
check('pool price rose after YES buy ('+pool1.toFixed(5)+')',pool1>0.8);
check('Done toast points to My Positions',(await toast())==='Order added to My Positions',await toast());
const word=await ev(()=>document.querySelector('#markets .market[data-id="1"] .prob-chance b').textContent);

// ---------- 10. persistence ----------
const balBefore=await bal();
await pg.reload();await pg.waitForTimeout(700);
check('balance persists after reload',(await bal())===balBefore);
check('saved star persists after reload',(await ev(()=>document.querySelector('.saved-count').textContent))==='1');
check('card price persists after reload',(await ev(()=>document.querySelector('#markets .market[data-id="1"] .prob').firstChild.textContent))===p1);

// ---------- 11. positions & selling ----------
await pg.locator('.nav-actions button',{hasText:'My Positions'}).click();await pg.waitForTimeout(300);
const posTxt=await ev(()=>document.getElementById('sbPosPanel').innerText);
check('positions panel lists 200 YES',posTxt.includes('200 YES'),posTxt.slice(0,120));
await pg.locator('#sbPosPanel button',{hasText:'Sell half'}).click();await pg.waitForTimeout(300);
check('Sell half → 100 YES left + toast',(await ev(()=>document.getElementById('sbPosPanel').innerText)).includes('100 YES')&&(await toast()).startsWith('Sold 100 YES'));
await pg.locator('#sbPosPanel button',{hasText:'Sell all'}).click();await pg.waitForTimeout(300);
check('Sell all → no open positions',(await ev(()=>document.getElementById('sbPosPanel').innerText)).includes('No open positions'));
const afterRound=await bal();
check(`round trip loses only fees+spread (balance ${afterRound})`,afterRound<10000&&afterRound>9990);
await closeAll();
// drawer sell
await pg.click('#markets .market[data-id="11"] .buy.no');await pg.waitForTimeout(350);
await pg.fill('#contractInput','50');await pg.click('#reviewOrder');await pg.waitForTimeout(300);await pg.click('#placeOrder');await pg.waitForTimeout(300);await pg.click('#doneOrder');await pg.waitForTimeout(400);
await pg.click('#markets .market[data-id="11"] .market-open');await pg.waitForTimeout(400);
check('drawer shows "Your position" after buy',await ev(()=>!!document.getElementById('sbPosInfo')));
await pg.locator('#sbPosInfo button',{hasText:'Sell all'}).click();await pg.waitForTimeout(300);
check('Sell all from drawer clears position',!(await ev(()=>!!document.getElementById('sbPosInfo'))));
await closeAll();

// ---------- 12. settle / reopen (sandbox) ----------
if(SB){
  await pg.click('#markets .market[data-id="17"] .buy.yes');await pg.waitForTimeout(350);
  await pg.fill('#contractInput','100');await pg.click('#reviewOrder');await pg.waitForTimeout(300);await pg.click('#placeOrder');await pg.waitForTimeout(300);await pg.click('#doneOrder');await pg.waitForTimeout(300);
  await pg.click('#markets .market[data-id="17"] .market-open');await pg.waitForTimeout(400);
  const b0=await bal();
  check('sandbox strip visible with drawer',await vis('#sbStrip'));
  await pg.click('#sbSettleYes');await pg.waitForTimeout(400);
  check('Settle YES pays $100',Math.abs((await bal())-(b0+100))<0.005,`${b0} → ${await bal()}`);
  check('review button disabled on resolved market',await ev(()=>reviewOrder.disabled));
  check('strip switches to Reopen',await vis('#sbReopenBtn'));
  await closeAll();
  check('card shows RESOLVED ribbon + disabled buttons',await ev(()=>{const c=document.querySelector('#markets .market[data-id="17"]');return c.querySelector('.sb-resolved-ribbon')?.textContent==='SANDBOX RESOLVED YES'&&c.querySelector('.buy.yes').disabled}));
  await pg.click('[data-cat="Economy"]');await pg.waitForTimeout(250);
  check('resolved state survives list re-render',await ev(()=>!!document.querySelector('#markets .market[data-id="17"] .sb-resolved-ribbon')));
  await pg.click('[data-cat="All"]');await pg.waitForTimeout(250);
  await pg.click('#markets .market[data-id="9"] [data-mini-settle="9,no"]');await pg.waitForTimeout(300);
  await pg.locator('.nav-actions button',{hasText:'AMM Ledger'}).click();await pg.waitForTimeout(300);
  const led=await ev(()=>document.getElementById('sbLedPanel').innerText);
  check('ledger lists settled Brent + S&P',led.includes('Brent')&&led.includes('S&P'),led.slice(0,200));
  await closeAll();
  await pg.click('#markets .market[data-id="9"] [data-mini-reopen]');await pg.waitForTimeout(300);
  check('card Reopen re-enables trading',await ev(()=>!document.querySelector('#markets .market[data-id="9"] .buy.yes').disabled));
  await pg.click('#sbReopenAll');await pg.waitForTimeout(300);
  check('Reopen all reopens Brent',await ev(()=>!document.querySelector('#markets .market[data-id="17"] .sb-resolved-ribbon')));
  // sandbox ignores pause
  await pg.click('.avatar');await pg.waitForTimeout(400);
  await pg.click('[data-settings-tab="wellbeing"]').catch(()=>{});
  check('sandbox: pause + cap controls locked with note',await ev(()=>pauseTradingToggle.disabled&&fundingCapInput.disabled&&document.body.innerText.includes('pause and funding cap are off')));
  await ev(()=>{pauseTradingToggle.checked=true});await pg.click('[data-save-wellbeing]');await pg.waitForTimeout(200);
  check('sandbox: save cannot turn pause on',await ev(()=>!tradingPaused));
  await pg.click('[data-page="markets"]');await pg.waitForTimeout(400);
  check('sandbox: buy buttons stay enabled',await ev(()=>!document.querySelector('#markets .market[data-id="3"] .buy.yes').disabled));
  await pg.click('#markets .market[data-id="3"] .buy.yes');await pg.waitForTimeout(350);await pg.fill('#contractInput','10');await pg.click('#reviewOrder');await pg.waitForTimeout(300);
  const bq=await bal();await pg.click('#placeOrder');await pg.waitForTimeout(400);
  check('sandbox: after saving settings, order shows confirmation',await ev(()=>orderSuccess.classList.contains('show')&&orderSuccess.textContent.includes('Bought 10 YES'))&&(await bal())<bq);
  await pg.click('#doneOrder');await closeAll();
}

// ---------- 13. demo pause ----------
if(!SB){
  await pg.click('.avatar');await pg.waitForTimeout(400);await pg.click('[data-settings-tab="wellbeing"]');
  await ev(()=>{pauseTradingToggle.checked=true});await pg.click('[data-save-wellbeing]');await pg.waitForTimeout(200);
  await pg.click('[data-page="markets"]');await pg.waitForTimeout(400);
  check('demo: Pause disables buy buttons',await ev(()=>[...document.querySelectorAll('#markets .buy')].every(b=>b.disabled)));
  await pg.click('#markets .market[data-id="3"] .market-open');await pg.waitForTimeout(350);await pg.click('#reviewOrder');await pg.waitForTimeout(350);
  check('demo: Pause blocks Place order',await ev(()=>placeOrder.disabled),await ev(()=>placeOrder.textContent));
  await closeAll();
  await pg.reload();await pg.waitForTimeout(600);
  check('demo: pause persists after reload',await ev(()=>document.querySelector('#markets .buy').disabled));
  await pg.click('.avatar');await pg.waitForTimeout(400);await pg.click('[data-settings-tab="wellbeing"]');
  await ev(()=>{pauseTradingToggle.checked=false});await pg.click('[data-save-wellbeing]');await pg.waitForTimeout(200);
  await pg.click('[data-page="markets"]');await pg.waitForTimeout(400);
  check('demo: resume re-enables buy buttons',await ev(()=>!document.querySelector('#markets .buy').disabled));
  // cap change
  await pg.click('.avatar');await pg.waitForTimeout(300);await pg.click('[data-settings-tab="wellbeing"]');await pg.fill('#fundingCapInput','1000');await pg.click('[data-save-wellbeing]');await pg.click('[data-page="markets"]');await pg.waitForTimeout(300);
  await pg.click('#markets .market[data-id="1"] .buy.yes');await pg.waitForTimeout(350);await pg.fill('#contractInput','500');await pg.click('#reviewOrder');await pg.waitForTimeout(350);
  check('demo: raising cap to $1,000 allows $400 order',!(await ev(()=>placeOrder.disabled)));
  await closeAll();
}

// ---------- 14. settings ----------
await pg.click('.avatar');await pg.waitForTimeout(400);
check('settings page opens',await ev(()=>document.body.dataset.view==='settings'));
const tabs=await ev(()=>[...document.querySelectorAll('[data-settings-tab]')].map(t=>t.dataset.settingsTab));
for(const t of tabs){await pg.click(`[data-settings-tab="${t}"]`);await pg.waitForTimeout(100);
  check(`settings tab ${t} shows its panel`,await ev(t=>document.querySelector(`[data-settings-panel="${t}"]`).classList.contains('active')&&document.querySelectorAll('[data-settings-panel].active').length===1,t));}
await pg.click('[data-settings-tab="account"]');await pg.fill('#displayName','Alex');await pg.locator('[data-save-settings]').first().click();
check('save account updates avatar label',(await ev(()=>document.querySelector('.avatar').getAttribute('aria-label')))==="Open Alex's settings");
const notifBtns=await ev(()=>[...document.querySelectorAll('[data-save-settings]')].length);
await pg.click('[data-settings-tab="notifications"]');await pg.waitForTimeout(100);
await pg.locator('[data-settings-panel="notifications"] .save-settings').click();
check('save notifications gives toast',(await toast()).length>0,await toast());
await pg.click('[data-settings-tab="preferences"]');
await pg.selectOption('#appearanceSelect','dark');await ev(()=>{compactToggle.checked=true;tapeToggle.checked=false;defaultSort.value='newest'});
await pg.click('[data-save-preferences]');await pg.waitForTimeout(200);
check('preferences: dark theme applied',await ev(()=>document.body.dataset.theme==='dark'));
check('preferences: compact + hide tape applied',await ev(()=>document.body.classList.contains('compact-markets')&&document.body.classList.contains('hide-tape')));
await pg.click('[data-page="markets"]');await pg.waitForTimeout(400);
c=await cards();check('preferences: default sort newest applied',c[0]==='17'||c[0].startsWith('cm'),c[0]);
await pg.screenshot({path:shot+'-dark.png'});
const darkContrast=await ev(()=>{const s=getComputedStyle(document.body);return [s.backgroundColor,s.color]});
check('dark mode body colors set '+darkContrast.join(' / '),darkContrast[0]!==darkContrast[1]);
await pg.click('#themeToggle');
check('theme toggle switches back to light',await ev(()=>document.body.dataset.theme==='light'));
await pg.click('[data-sort="trending"]');await ev(()=>{document.body.classList.remove('compact-markets','hide-tape')});

// ---------- 15. creators directory ----------
await pg.click('#viewCreators');await pg.waitForTimeout(400);
check('creator directory opens with 8',(await ev(()=>creatorDirectory.querySelectorAll('.creator-row-full').length))===8);
await pg.fill('#creatorSearch','macro');await pg.waitForTimeout(100);
check('creator search filters to 1',(await ev(()=>creatorDirectory.querySelectorAll('.creator-row-full').length))===1);
await pg.fill('#creatorSearch','zzz');check('creator search empty message',await ev(()=>!!creatorDirectory.querySelector('.creator-empty')));
await pg.keyboard.press('Escape');await pg.waitForTimeout(300);
check('Escape closes creator directory',!(await ev(()=>creatorLayer.classList.contains('open'))));

// ---------- 16. proposal flow ----------
await pg.locator('.propose-cta').click();await pg.waitForTimeout(400);
check('proposal modal opens',await ev(()=>createLayer.classList.contains('open')));
await pg.click('#proposalNext');
check('step 1 blocks empty question',await ev(()=>questionField.classList.contains('invalid')&&demandField.classList.contains('invalid')));
const Q='Will the Fed cut rates at its January 2027 meeting?';
await pg.fill('#marketQuestion',Q);await pg.fill('#marketDemand','Rates traders want to hedge a hike-then-cut path.');
check('live preview + counter update',(await ev(()=>previewQuestion.textContent))===Q&&(await ev(()=>questionCount.textContent))===String(Q.length));
await pg.click('[data-proposal-cat="Economy"]');
await pg.click('#proposalNext');await pg.waitForTimeout(400);
check('advances to step 2',await ev(()=>document.querySelector('[data-form-step="2"]').classList.contains('active')));
await pg.fill('#marketRules','x');await pg.fill('#marketSource','not a url');await pg.click('#proposalNext');
check('step 2 blocks short rules + bad URL',await ev(()=>rulesField.classList.contains('invalid')&&sourceField.classList.contains('invalid')));
await pg.fill('#marketRules','Resolves Yes if the FOMC lowers the target range at the meeting ending January 27, 2027.');
await pg.fill('#marketSource','https://www.federalreserve.gov/monetarypolicy.htm');
await pg.click('#proposalNext');await pg.waitForTimeout(400);
check('advances to review step',await ev(()=>reviewQuestion.textContent)===Q);
check('review shows creator share',(await ev(()=>reviewShare.textContent)).includes('%'));
await pg.click('#proposalNext');
check('submit blocked without confirmation tick',!(await ev(()=>proposalSuccess.classList.contains('show'))));
await pg.click('#proposalBack');await pg.waitForTimeout(300);
check('Back returns to step 2',await ev(()=>document.querySelector('[data-form-step="2"]').classList.contains('active')));
await pg.click('#proposalNext');await pg.waitForTimeout(300);
await ev(()=>{proposalAck.checked=true});await pg.click('#proposalNext');await pg.waitForTimeout(500);
check('proposal submits',await ev(()=>proposalSuccess.classList.contains('show')));
await pg.click('#proposalNext');await pg.waitForTimeout(400);
check('Done closes proposal',!(await ev(()=>createLayer.classList.contains('open'))));
c=await cards();check('creator market card added to list',c.some(x=>x&&x.startsWith('cm')),c.slice(0,3).join());
// trade it
await pg.locator('#markets .market[data-lab-id] .buy.yes').click();await pg.waitForTimeout(400);
check('creator market opens in drawer',(await ev(()=>drawerTitle.textContent))===Q);
await pg.fill('#contractInput','100');await pg.click('#reviewOrder');await pg.waitForTimeout(400);
await pg.click('#placeOrder');await pg.waitForTimeout(400);
check('creator market order fills',await ev(()=>orderSuccess.classList.contains('show')&&orderSuccess.textContent.includes('Bought 100 YES')));
await pg.click('#doneOrder');await closeAll();
await pg.locator('.nav-actions button',{hasText:'Creator Earnings'}).click();await pg.waitForTimeout(300);
const ear=await ev(()=>document.getElementById('sbEarPanel').innerText);
check('creator earnings shows fee share',/\$0\.\d\d|\$\d+\.\d\d/.test(ear)&&ear.includes(Q.slice(0,20)),ear.slice(0,200));
await closeAll();
// clicking card body (not a button)
const errsBefore=errs.length;
await pg.locator('#markets .market[data-lab-id] .meta').click();await pg.waitForTimeout(300);
check('clicking creator card body throws no error',errs.length===errsBefore,errs.slice(errsBefore).join(' | '));
check('clicking creator card body opens it',(await ev(()=>drawer.classList.contains('open')&&drawerTitle.textContent))===Q);
await closeAll();
// re-render
await pg.click('[data-cat="Economy"]');await pg.waitForTimeout(300);
c=await cards();check('creator card survives category change',c.some(x=>x&&x.startsWith('cm')),c.join());
await pg.click('[data-cat="All"]');await pg.waitForTimeout(300);
c=await cards();check('creator card present after back to All',c.some(x=>x&&x.startsWith('cm')),c.slice(0,3).join());
await pg.fill('#search','january');await pg.waitForTimeout(200);
c=await cards();check('search finds creator market',c.some(x=>x&&x.startsWith('cm')),c.join());
await pg.fill('#search','');await pg.waitForTimeout(200);
await pg.reload();await pg.waitForTimeout(700);
c=await cards();check('creator card restored after reload',c.some(x=>x&&x.startsWith('cm')));
// expand toggle
await pg.locator('.propose-cta').click();await pg.waitForTimeout(400);
await pg.click('#proposalExpand');check('proposal expand toggles',await ev(()=>createLayer.classList.contains('expanded')));
await closeAll();

// ---------- 17. how-it-works ----------
await pg.click('[data-page="how"]');await pg.waitForTimeout(400);
check('how page shows',await ev(()=>document.body.dataset.view==='how'));
const hero=await ev(()=>document.querySelector('.hero-market h2').textContent+' '+document.querySelector('.hero-market-prob').textContent);
await pg.click('[data-example-side="no"]');await pg.waitForTimeout(400);
const hd=await ev(()=>[drawerTitle.textContent,drawerNo.classList.contains('selected')]);
check(`hero card matches market it opens (${hero})`,hero.startsWith(hd[0])&&hd[1],hd.join());
await closeAll();
await pg.click('.how-hero [data-page="markets"]');await pg.waitForTimeout(300);
check('Explore markets returns to list',await ev(()=>document.body.dataset.view==='markets'));
await pg.click('[data-page="how"]');await pg.waitForTimeout(300);
await pg.locator('button',{hasText:'See the proposal flow'}).click();await pg.waitForTimeout(300);
check('See the proposal flow opens proposal',await ev(()=>createLayer.classList.contains('open')));
await closeAll();
const faqs=await ev(()=>document.querySelectorAll('.faq details, details').length);
if(faqs){await pg.locator('details summary').first().click();check('FAQ item expands',await ev(()=>document.querySelector('details').open));}
await pg.click('.logo');await pg.waitForTimeout(300);
check('logo returns to markets',await ev(()=>document.body.dataset.view==='markets'));

// ---------- 18. reset ----------
if(SB){await pg.click('#sbReset');}
else{await pg.locator('.nav-actions button',{hasText:'My Positions'}).click();await pg.waitForTimeout(200);await pg.click('#demoReset');}
await pg.waitForTimeout(400);
check('reset: balance back to $10,000',(await bal())===10000);
c=await cards();check('reset: creator markets removed',!c.some(x=>x&&x.startsWith('cm')),c.length+'');
check('reset: prices back to start',(await ev(()=>document.querySelector('#markets .market[data-id="1"] .prob').firstChild.textContent))==='80');
await closeAll();

// ---------- 19. mobile ----------
await pg.setViewportSize({width:390,height:844});await pg.waitForTimeout(300);
const hs=async n=>{const v=await ev(()=>document.documentElement.scrollWidth-window.innerWidth);check(`mobile ${n}: no sideways scroll`,v<=0,String(v));};
await hs('markets');await pg.screenshot({path:shot+'-m-markets.png'});
await pg.click('#markets .market[data-id="1"] .buy.yes');await pg.waitForTimeout(400);
await pg.screenshot({path:shot+'-m-drawer.png'});
check('mobile drawer fits width',await ev(()=>document.querySelector('aside.drawer').getBoundingClientRect().right<=window.innerWidth+1));
await pg.click('#reviewOrder');await pg.waitForTimeout(400);await pg.screenshot({path:shot+'-m-order.png'});
check('mobile order modal fits',await ev(()=>{const r=document.querySelector('.order-modal').getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth+1}));
await closeAll();
await pg.locator('.propose-cta').click({force:true}).catch(()=>ev(()=>document.querySelector('[data-open-create]').click()));await pg.waitForTimeout(400);
await pg.screenshot({path:shot+'-m-propose.png'});
check('mobile proposal modal fits',await ev(()=>{const r=document.querySelector('.create-modal').getBoundingClientRect();return r.left>=0&&r.right<=window.innerWidth+1}));
await closeAll();
const navVisible=await ev(()=>[...document.querySelectorAll('.nav-actions > *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0}).map(e=>e.textContent.trim()||e.className));
console.log('mobile nav items visible:',JSON.stringify(navVisible));
const bar=await ev(()=>[...document.querySelectorAll('.ag-mbar button')].map(b=>b.textContent));
check('phone bar shows: '+bar.join(' / '),bar.includes('How it works')&&bar.includes('My Positions')&&bar.includes('Creator Earnings')&&(bar.includes('AMM Ledger')===SB)&&await vis('.ag-mbar'));
await pg.locator('.ag-mbar button',{hasText:'My Positions'}).click();await pg.waitForTimeout(300);
check('phone: My Positions panel opens and fits',await ev(()=>{const e=document.getElementById('sbPosPanel');const r=e.getBoundingClientRect();return e.style.display==='block'&&r.right<=innerWidth+1}));
await pg.screenshot({path:shot+'-m-positions.png'});
await pg.locator('.ag-mbar button',{hasText:'My Positions'}).click();await pg.waitForTimeout(200);
await pg.locator('.ag-mbar button',{hasText:'How it works'}).click();await pg.waitForTimeout(400);
check('phone: How it works reachable',await ev(()=>document.body.dataset.view==='how'));
await ev(()=>document.querySelector('.logo').click());await pg.waitForTimeout(300);
await pg.locator('.ag-mbar button',{hasText:'Propose a market'}).click();await pg.waitForTimeout(400);
check('phone: Propose reachable',await ev(()=>createLayer.classList.contains('open')));await closeAll();
await pg.click('.avatar');await pg.waitForTimeout(300);await hs('settings');await pg.screenshot({path:shot+'-m-settings.png'});
await ev(()=>document.querySelector('[data-page="how"]').click());await pg.waitForTimeout(300);await hs('how');await pg.screenshot({path:shot+'-m-how.png',fullPage:true});

check('no JavaScript errors overall',errs.length===0,errs.join(' | '));
console.log(`\n${mode}: ${pass} passed, ${fail} failed`);fails.forEach(f=>console.log('  ✗ '+f));
await b.close();
})().catch(e=>{console.log('SCRIPT ERROR',e.message.slice(0,900));console.log(`${pass} passed, ${fail} failed so far`);fails.forEach(f=>console.log('  ✗ '+f));process.exit(1)});
