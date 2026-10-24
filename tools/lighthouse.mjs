import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {assertBudgets} from './performance-budget.mjs';
const require=createRequire(import.meta.url),lhRequire=createRequire(require.resolve('@lhci/cli/package.json'));
const {default:lighthouse}=await import(pathToFileURL(lhRequire.resolve('lighthouse')).href);
const {launch}=await import(pathToFileURL(lhRequire.resolve('chrome-launcher')).href);
const chrome=await launch({chromePath:process.env.CHROME_PATH,chromeFlags:['--headless=new','--no-sandbox','--disable-dev-shm-usage']});
await mkdir('.artifacts/lighthouse',{recursive:true});const bundle=JSON.parse(await readFile('.artifacts/bundle.json','utf8'));const entry=await(await fetch('http://127.0.0.1:4173/__demo/qr')).json();const url='http://127.0.0.1:4173'+entry.url;const report=[];
try{
 for(const profile of ['3g','4g']){
  const samples=[];
  for(let i=0;i<3;i++){
   const result=await lighthouse(url,{port:chrome.port,output:'json',logLevel:'error',onlyCategories:['performance'],formFactor:'mobile',screenEmulation:{mobile:true,width:360,height:800,deviceScaleFactor:1,disabled:false},throttlingMethod:'simulate',throttling:profile==='3g'?{rttMs:150,throughputKbps:1638.4,requestLatencyMs:562.5,downloadThroughputKbps:1474.56,uploadThroughputKbps:675,cpuSlowdownMultiplier:4}:{rttMs:40,throughputKbps:10240,requestLatencyMs:150,downloadThroughputKbps:9216,uploadThroughputKbps:4608,cpuSlowdownMultiplier:4}});
   if(!result?.lhr||result.lhr.runtimeError)throw Error(result?.lhr?.runtimeError?.message??'Lighthouse returned no result');
   const lcp=result.lhr.audits['largest-contentful-paint'].numericValue;const score=result.lhr.categories.performance.score;samples.push(lcp);report.push({profile,run:i+1,lcp_ms:lcp,performance_score:score});
   await writeFile(`.artifacts/lighthouse/${profile}-${i+1}.json`,JSON.stringify(result.lhr));
  }
  const p75=samples.sort((a,b)=>a-b)[Math.ceil(samples.length*.75)-1];assertBudgets({initialJsGzip:bundle.initial_js_gzip_bytes,lcp:p75,profile});
 }
}finally{await chrome.kill();await writeFile('.artifacts/lighthouse-summary.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
