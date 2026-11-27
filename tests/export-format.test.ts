import {it,expect} from 'vitest';
import {csvExport,xlsxExport} from '../apps/api/src/export-format.ts';
it('CSV neutralizes spreadsheet formulas and XLSX stores customer content as text',()=>{
 expect(csvExport([{name:'=HYPERLINK("x")',amount_tzs:1500}])).toContain("'=HYPERLINK");
 const bytes=xlsxExport([{name:'<Food> & =1+1',amount_tzs:1500}]);expect(bytes.readUInt32LE(0)).toBe(0x04034b50);expect(bytes.toString()).toContain('&lt;Food&gt; &amp; =1+1');expect(bytes.toString()).not.toContain('<f>');expect(bytes.readUInt32LE(bytes.length-22)).toBe(0x06054b50);
});
