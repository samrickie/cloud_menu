export function assertBudgets({initialJsGzip,lcp,profile,shell}){
 assertJsBudget(initialJsGzip);if(!Number.isFinite(lcp)||lcp<=0)throw Error('Missing or invalid performance metrics');
 if(!['3g','4g','repeat'].includes(profile))throw Error('Unknown performance profile');
 if(profile==='repeat'&&(!Number.isFinite(shell)||shell<=0))throw Error('Missing or invalid repeat metric');
 if(initialJsGzip>150000)throw Error(`Initial JS ${initialJsGzip} exceeds 150000 gzip bytes`);
 const max=profile==='4g'?2500:4000;
 if(lcp>max)throw Error(`${profile} LCP ${lcp}ms exceeds ${max}ms`);
 if(profile==='repeat'&&shell>1500)throw Error(`Repeat shell ${shell}ms exceeds 1500ms`);
}
export function assertJsBudget(bytes){if(!Number.isSafeInteger(bytes)||bytes<=0)throw Error('Missing or invalid bundle measurement');if(bytes>150000)throw Error(`Initial JS ${bytes} exceeds 150000 gzip bytes`);}
export function assertCompleteLighthouse(report){if(report.runtimeError||report.runWarnings?.length)throw Error('Incomplete Lighthouse run: '+(report.runtimeError?.message??report.runWarnings.join('; ')));}
