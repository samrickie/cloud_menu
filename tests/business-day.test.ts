import {it,expect} from 'vitest';
import {businessDay} from '../apps/api/src/service-settings.ts';
it('business day uses Dar es Salaam and keeps the previous day before a late-night cutoff',()=>{
 expect(businessDay('04:00',Date.parse('2026-11-10T00:59:59Z'))).toEqual({date:'2026-11-09',start:'2026-11-09T01:00:00.000Z'});
 expect(businessDay('04:00',Date.parse('2026-11-10T01:00:00Z')).date).toBe('2026-11-10');
 expect(businessDay('00:00',Date.parse('2026-11-09T21:00:00Z')).date).toBe('2026-11-10');
});
