import {describe,it,expect} from 'vitest';
import {themes,contrastRatio,customTheme,validateTheme} from '../packages/ui/src/theme.ts';
describe('Noir & Gold design system and accessible venue themes',()=>{
 it('uses the exact supplied default brand tokens',()=>{expect(themes.noir).toMatchObject({background:'#0C0D0F',surface:'#16171A',border:'#2B2C30',text:'#F4EFE6',muted:'#A9A397',primary:'#C9A24B',highlight:'#E6C46F'});});
 it('keeps normal text and button labels at or above WCAG 4.5:1 in every preset',()=>{for(const theme of Object.values(themes)){expect(validateTheme(theme)).toEqual([]);expect(contrastRatio(theme.text,theme.background)).toBeGreaterThanOrEqual(4.5);expect(contrastRatio(theme.primaryText,theme.primary)).toBeGreaterThanOrEqual(4.5);}});
 it('automatically chooses readable custom brand button text',()=>{for(const brand of ['#FFFFFF','#000000','#808080','#FF00FF','#135E45']){const t=customTheme(brand);expect(contrastRatio(t.primaryText,t.primary)).toBeGreaterThanOrEqual(4.5);}});
 it('refuses invalid colours and a failing requested custom text combination',()=>{expect(()=>customTheme('url(evil)')).toThrow();expect(()=>customTheme('#FFFFFF','#F4EFE6')).toThrow(/contrast/i);expect(contrastRatio('#000000','#FFFFFF')).toBe(21);});
});
