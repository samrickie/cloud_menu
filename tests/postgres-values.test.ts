import {it,expect} from 'vitest';
import {normalizeRow} from '../apps/api/src/store.ts';
it('PostgreSQL BIGINT money is serialized as a safe integer, never a string or rounded number',()=>{
 expect(normalizeRow({price_tzs:'25000',seq:'23',business_date:new Date('2026-10-24T00:00:00Z')})).toEqual({price_tzs:25000,seq:23,business_date:'2026-10-24'});
 expect(()=>normalizeRow({price_tzs:'9007199254740993'})).toThrow();
});
