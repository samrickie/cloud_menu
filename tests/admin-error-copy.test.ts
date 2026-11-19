import {it,expect} from 'vitest';
import {platformError} from '../packages/ui/src/platform-copy.ts';
it('distinguishes existing, deactivated, deleted and invalid-format accounts',()=>{
 expect(platformError('en','ACCOUNT_UNAVAILABLE')).toBe('This account exists.');
 expect(platformError('en','BUSINESS_UNAVAILABLE')).toBe('Account Deactivated. Contact Admin.');
 expect(platformError('en','BUSINESS_DELETED')).toContain('business name');
 expect(platformError('en','VALIDATION_ERROR')).toContain('3–63');
 expect(platformError('sw','BUSINESS_UNAVAILABLE')).toContain('msimamizi');
});
