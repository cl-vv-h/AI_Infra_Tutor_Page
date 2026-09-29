import {spawn} from 'node:child_process'
import {setTimeout as sleep} from 'node:timers/promises'
const port='4193',base=`http://127.0.0.1:${port}/AI_Infra_Tutor_Page/`
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',port,'--strictPort'],{stdio:'ignore'})
try{
  let ready=false
  for(let i=0;i<60;i++){if(server.exitCode!==null)throw new Error('Preview server exited');try{ready=(await fetch(base)).ok}catch{}if(ready)break;await sleep(500)}
  if(!ready)throw new Error('Preview readiness timed out')
  for(const file of ['tests/weekly-news-browser.mjs','tests/profiling-guide-browser.mjs','tests/weight-deployment-browser.mjs','tests/scenario-library-browser.mjs','tests/scenario-comparison-browser.mjs']){
    await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[file],{stdio:'inherit',env:{...process.env,MODEL_QA_BASE:base}});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(`${file} failed (${code})`)))})
  }
}finally{server.kill('SIGTERM')}
