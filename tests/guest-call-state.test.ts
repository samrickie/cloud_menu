import {it,expect} from 'vitest';
import {mergeCall} from '../apps/guest-pwa/src/call-state.ts';
it('a delayed create/retry reply cannot regress an acknowledged waiter call',()=>{const open={id:'same',status:'OPEN',created_at:'2026-10-31T12:00:00Z'},ack={...open,status:'ACKNOWLEDGED'};expect(mergeCall(ack,open)).toEqual(ack);expect(mergeCall(open,ack)).toEqual(ack);});
it('a newer request replaces an older acknowledged call, and a delayed older reply is ignored',()=>{const old={id:'old',status:'ACKNOWLEDGED',created_at:'2026-10-31T12:00:00Z'},next={id:'next',status:'OPEN',created_at:'2026-10-31T12:01:01Z'};expect(mergeCall(old,next)).toEqual(next);expect(mergeCall(next,old)).toEqual(next);});
