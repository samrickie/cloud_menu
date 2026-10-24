export function assertBudgets({initialJsGzip,lcp,profile,shell}){
 if(initialJsGzip>150000)throw Error(`Initial JS ${initialJsGzip} exceeds 150000 gzip bytes`);
 const max=profile==='4g'?2500:4000;
 if(lcp>max)throw Error(`${profile} LCP ${lcp}ms exceeds ${max}ms`);
 if(profile==='repeat'&&shell>1500)throw Error(`Repeat shell ${shell}ms exceeds 1500ms`);
}
