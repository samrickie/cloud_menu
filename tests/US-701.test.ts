import {describe,it,expect} from 'vitest';
import {assertBudgets,assertCompleteLighthouse} from '../tools/performance-budget.mjs';
describe('US-701 enforced performance budgets',()=>{
 it('incomplete reports and missing or non-finite metrics cannot pass performance gates',()=>{expect(()=>assertCompleteLighthouse({runWarnings:['The page loaded too slowly.']})).toThrow();expect(()=>assertCompleteLighthouse({runtimeError:{message:'failed'}})).toThrow();expect(()=>assertCompleteLighthouse({runWarnings:[]})).not.toThrow();for(const lcp of [NaN,Infinity,0,-1])expect(()=>assertBudgets({initialJsGzip:10000,lcp,profile:'3g'})).toThrow();});
 it('Performance budget in CI fails for initial JavaScript over 150KB gzipped or 3G LCP over 4s',()=>{expect(()=>assertBudgets({initialJsGzip:150001,lcp:3000,profile:'3g'})).toThrow();expect(()=>assertBudgets({initialJsGzip:10000,lcp:4001,profile:'3g'})).toThrow();expect(()=>assertBudgets({initialJsGzip:10000,lcp:2501,profile:'4g'})).toThrow();expect(()=>assertBudgets({initialJsGzip:150000,lcp:4000,profile:'3g'})).not.toThrow();});
 it('Repeat visits budget rejects cached shell renders over 1.5 seconds',()=>{expect(()=>assertBudgets({initialJsGzip:10000,lcp:1000,profile:'repeat',shell:1501})).toThrow();});
});
