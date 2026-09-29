import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const require=createRequire(import.meta.url),modulePath=process.env.MODEL_QA_PLAYWRIGHT||'playwright'
const {chromium}=require(modulePath),{expect}=require(`${modulePath}/test`)
const base=process.env.MODEL_QA_BASE||'http://127.0.0.1:4195/AI_Infra_Tutor_Page/',route=`${base}#/models/communication`
const browser=await chromium.launch({headless:true,...(process.env.MODEL_QA_CHANNEL?{channel:process.env.MODEL_QA_CHANNEL}:{})})
const screenshots=process.env.MODEL_QA_SCREENSHOTS
if(screenshots)await mkdir(screenshots,{recursive:true})
const controls=async p=>{if(!await p.getByLabel('总 TP',{exact:true}).isVisible())await p.locator('summary').filter({hasText:/^实验条件/}).click()}
const witness=async p=>{if(!await p.getByTestId('witness-value').isVisible())await p.locator('summary').filter({hasText:/^数值与分片归属/}).click()}
const finish=async p=>{const value=await p.getByRole('combobox',{name:'跳转轮次',exact:true}).locator('option').last().getAttribute('value');await p.getByRole('combobox',{name:'跳转轮次',exact:true}).selectOption(value)}
try{
  const enabled=JSON.parse(await readFile(new URL('../config/communication-topology.json',import.meta.url),'utf8')).enabled
  if(!enabled){
    const page=await browser.newPage();page.setDefaultTimeout(15000)
    await page.goto(`${base}#/models`);await expect(page.getByRole('navigation',{name:'模型知识导航'})).toBeVisible()
    await expect(page.getByRole('link',{name:'通信拓扑',exact:true})).toHaveCount(0)
    await page.goto(route);await expect(page.getByRole('heading',{name:'通信拓扑实验室',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{level:1})).toBeVisible()
    console.log('Communication independent build-time gate: route absent and catalog retained')
  }else{
    for(const width of [360,390,768,1440]){
      const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[],outgoing=[]
      page.setDefaultTimeout(15000)
      page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method())||new URL(r.url()).origin!==new URL(base).origin)outgoing.push(r.url())})
      await page.goto(route);await expect(page.getByRole('heading',{name:'通信拓扑实验室',exact:true})).toBeVisible()
      await page.locator('summary').filter({hasText:'逐 rank 发送量与计算假设'}).click()
      await expect(page.getByRole('link',{name:/概念图：为什么共享出口/})).toHaveAttribute('href',new URL('diagrams/communication-topology.html',base).pathname)
      if(width===1440){
        const artifact=await page.request.get(new URL('diagrams/communication-topology.html',base).href)
        assert.equal(artifact.status(),200)
        assert.equal(createHash('sha256').update(await artifact.body()).digest('hex'),'0e2389ee7d2545646d6e457066d04c6807c6d7dae7acb7bdea21773336ce12ac')
        const license=await page.request.get(new URL('diagrams/communication-topology-LICENSE.txt',base).href)
        assert.equal(license.status(),200);assert.match(await license.text(),/MIT License/)
      }
      await page.locator('summary').filter({hasText:'逐 rank 发送量与计算假设'}).click()
      await expect(page.getByTestId('设备总数')).toHaveText('16');await expect(page.getByTestId('所选组发送总量')).toHaveText('14.00 MiB')
      await expect(page.getByTestId('其中跨机发送')).toHaveText('0.00 KiB');await expect(page.getByTestId('同步轮次模型估时')).toHaveText('34.12 µs')
      await expect(page.getByRole('button',{name:'播放',exact:true})).toBeDisabled()
      await page.getByRole('button',{name:'下一步',exact:true}).focus();await page.keyboard.press('Enter')
      await expect(page.getByTestId('round-status')).toHaveText('已完成 1 / 14 轮')
      await witness(page);await page.getByRole('combobox',{name:'接收 rank',exact:true}).selectOption('1')
      await page.getByRole('combobox',{name:'观察分片',exact:true}).selectOption('7')
      await expect(page.getByTestId('witness-value')).toHaveText('24');await expect(page.getByTestId('witness-contributors')).toHaveText('来源组序：0、1')
      await finish(page);await expect(page.getByTestId('witness-value')).toHaveText('288')
      await expect(page.getByTestId('witness-status')).toContainText('完成后的输出')
      await page.getByRole('button',{name:'同组跨机交错',exact:true}).click()
      await expect(page.getByTestId('其中跨机发送')).toHaveText('14.00 MiB');await expect(page.getByTestId('同步轮次模型估时')).toHaveText('405.60 µs')
      await expect(page.getByTestId('message-scope')).toContainText('跨机消息')
      const saved=page.url();await page.reload();assert.equal(page.url(),saved);await expect(page.getByTestId('round-status')).toHaveText('已完成 0 / 14 轮')
      await page.goBack();await expect(page.getByTestId('其中跨机发送')).toHaveText('0.00 KiB')
      await controls(page);await page.getByRole('combobox',{name:'通信算法',exact:true}).selectOption('tree-allreduce')
      await page.getByRole('button',{name:'应用参数',exact:true}).click();await expect(page.getByTestId('round-status')).toHaveText('已完成 0 / 6 轮')
      await finish(page);await witness(page);await expect(page.getByTestId('witness-value')).toHaveText('36')
      await controls(page);await page.getByRole('combobox',{name:'通信算法',exact:true}).selectOption('ring-reducescatter')
      await page.getByRole('button',{name:'应用参数',exact:true}).click();await expect(page.getByTestId('round-status')).toHaveText('已完成 0 / 7 轮')
      await finish(page);await witness(page);await page.getByRole('combobox',{name:'接收 rank',exact:true}).selectOption('7')
      await expect(page.getByRole('combobox',{name:'观察分片',exact:true})).toHaveValue('7');await expect(page.getByTestId('witness-value')).toHaveText('288')
      await page.getByRole('combobox',{name:'观察分片',exact:true}).selectOption('0');await expect(page.getByTestId('witness-status')).toContainText('不是 Reduce-Scatter 的输出')
      await controls(page);await page.getByRole('combobox',{name:'通信算法',exact:true}).selectOption('ring-allgather')
      await page.getByRole('button',{name:'应用参数',exact:true}).click();await expect(page).toHaveURL(/mode=ring-allgather/)
      await finish(page);await witness(page);await page.getByRole('combobox',{name:'观察分片',exact:true}).selectOption('7');await expect(page.getByTestId('witness-value')).toHaveText('8')
      await page.getByRole('button',{name:'EP 分发',exact:true}).click();await expect(page).toHaveURL(/group=ep/)
      await expect(page.getByTestId('其中跨机发送')).toHaveText('4.00 MiB')
      await page.getByRole('combobox',{name:'观察本轮消息',exact:true}).selectOption('3');await expect(page.getByTestId('message-scope')).toContainText('跨机消息')
      await finish(page);await witness(page);await page.getByRole('combobox',{name:'观察分片',exact:true}).selectOption('7');await expect(page.getByTestId('witness-value')).toHaveText('8001')
      if(screenshots){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(screenshots,`communication-${width}.png`)});await page.getByRole('region',{name:'通信轮次实验',exact:true}).screenshot({path:join(screenshots,`communication-flow-${width}.png`)})}
      await page.getByRole('button',{name:'PP 阶段传递',exact:true}).click();await expect(page.getByTestId('round-status')).toHaveText('已完成 0 / 3 轮')
      await finish(page);await witness(page);await page.getByRole('combobox',{name:'接收 rank',exact:true}).selectOption('3');await expect(page.getByTestId('witness-value')).toHaveText('1')
      await page.getByRole('button',{name:'TP 留在机内',exact:true}).click();await expect(page.getByTestId('round-status')).toHaveText('已完成 0 / 14 轮')
      await controls(page);await page.getByLabel('EP',{exact:true}).fill('3');await page.getByRole('button',{name:'应用参数',exact:true}).click()
      await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByTestId('所选组发送总量')).toHaveText('14.00 MiB')
      await page.getByRole('button',{name:'TP 留在机内',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByLabel('EP',{exact:true})).toHaveValue('4')
      for(const [label,value] of [['总 TP','64'],['EP','64'],['Attention DP','64'],['PP stages','64'],['独立副本','64'],['每台设备数','64'],['锚定 rank','262143']])await page.getByLabel(label,{exact:true}).fill(value)
      await page.getByRole('combobox',{name:'rank 放置',exact:true}).selectOption('striped')
      await page.getByRole('button',{name:'应用参数',exact:true}).click();await expect(page.getByTestId('设备总数')).toHaveText('262,144')
      await expect(page.getByRole('button',{name:/^R262143/})).toBeVisible()
      await page.getByRole('button',{name:'上一组主机',exact:true}).click();await expect(page.getByRole('button',{name:'下一组主机',exact:true})).toBeEnabled()
      await finish(page);await witness(page);await expect(page.getByTestId('witness-value')).toHaveText('2080')
      await controls(page);await page.getByRole('combobox',{name:'观察逻辑组',exact:true}).selectOption('attention');await page.getByRole('button',{name:'应用参数',exact:true}).click()
      await expect(page.getByTestId('round-status')).toHaveText('已完成 0 / 0 轮');await expect(page.getByTestId('同步轮次模型估时')).toHaveText('0.00 µs');await expect(page.getByRole('button',{name:'下一步',exact:true})).toBeDisabled()
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal document overflow')
      assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0})
      assert.deepEqual(errors,[]);assert.deepEqual(outgoing,[])
      await page.close();console.log(`Communication ${width}px: all algorithms, exact byte/time/result witnesses, rank axes, large worlds, keyboard and privacy passed`)
    }
    const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});page.setDefaultTimeout(15000)
    await page.goto(route);await page.getByRole('button',{name:'播放',exact:true}).click();await expect(page.getByTestId('round-status')).toContainText('已完成 1',{timeout:6000})
    await page.getByRole('button',{name:'暂停',exact:true}).click();await page.waitForTimeout(100)
    const label=await page.getByRole('img',{name:/示意进度/}).getAttribute('aria-label');await page.waitForTimeout(700)
    assert.equal(await page.getByRole('img',{name:/示意进度/}).getAttribute('aria-label'),label)
    await page.getByRole('button',{name:'播放',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByRole('button',{name:'播放',exact:true})).toBeDisabled()
    await page.emulateMedia({reducedMotion:'no-preference'});await page.getByRole('button',{name:'播放',exact:true}).click();await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
    await expect(page.getByRole('button',{name:'播放',exact:true})).toBeEnabled()
    await page.getByRole('combobox',{name:'跳转轮次',exact:true}).selectOption('13');await page.getByRole('combobox',{name:'播放速度',exact:true}).selectOption('4');await page.getByRole('button',{name:'播放',exact:true}).click()
    await expect(page.getByTestId('round-status')).toHaveText('已完成 14 / 14 轮');await expect(page.getByRole('button',{name:'播放',exact:true})).toBeDisabled()
    await page.getByRole('button',{name:'重新开始',exact:true}).click();await controls(page);await page.getByLabel('逻辑缓冲区 S（KiB）',{exact:true}).fill('1');await expect(page.getByRole('button',{name:'播放',exact:true})).toBeDisabled()
    await page.getByRole('button',{name:'应用参数',exact:true}).click();await expect(page.getByTestId('所选组发送总量')).toHaveText('14.00 KiB')
    // Explore direct algorithm/placement alternatives without creating saved scenarios.
    const comparison=page.getByRole('region',{name:'算法与放置对照',exact:true})
    await comparison.getByRole('button',{name:'应用此对照',exact:true}).last().click();await expect(page).toHaveURL(/mode=tree-allreduce/);await expect(page).toHaveURL(/placement=striped/)
    for(const query of ['v=2','tp=2&ep=4','group=ep','localGBs=0','rank=999999','tp=8&tp=16']){
      await page.goto(`${route}?${query}`);await expect(page.getByRole('alert')).toBeVisible();await page.getByRole('button',{name:'重置为默认参数',exact:true}).click();await expect(page.getByTestId('round-status')).toHaveText('已完成 0 / 14 轮')
    }
    await page.route('**/assets/ModelCatalog-*.js',async r=>{await new Promise(resolve=>setTimeout(resolve,2500));await r.continue()})
    await page.getByRole('button',{name:'播放',exact:true}).click();await page.getByRole('link',{name:'模型目录',exact:true}).click();await expect(page.getByRole('button',{name:'暂停',exact:true})).toHaveCount(0);await expect(page).toHaveURL(/#\/models$/)
    await page.close()
    const failed=await browser.newPage();failed.setDefaultTimeout(15000)
    await failed.route('**/assets/CommunicationTopology-*.js',r=>r.abort());await failed.goto(route);await expect(failed.getByRole('heading',{name:'通信实验室暂时无法加载',exact:true})).toBeVisible()
    await failed.unroute('**/assets/CommunicationTopology-*.js');await failed.getByRole('button',{name:'重新加载实验室',exact:true}).click();await expect(failed.getByTestId('round-status')).toHaveText('已完成 0 / 14 轮');await failed.close()
    console.log('Communication playback completion/pause, reduced motion, pending navigation, strict URLs and lazy-load recovery passed')
  }
}finally{await browser.close()}
