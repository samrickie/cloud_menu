import {test,expect} from '@playwright/test';
test('a controlling guest service worker never replaces health or readiness responses with the QR application',async({page,request})=>{
 const entry=await(await request.get('/__demo/qr')).json();await page.goto(entry.url);await expect(page.getByPlaceholder('Search the menu')).toBeVisible();await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await expect(page.getByPlaceholder('Search the menu')).toBeVisible();expect(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 for(const url of ['/health','/health?probe=1']){const response=await page.goto(url);expect(response!.headers()['content-type']).toContain('application/json');expect(await response!.json()).toEqual({status:'ok'});}
 // The loopback fixture has no real database/Redis readiness probe. Its 404
 // must remain a JSON problem, not be hidden behind the cached guest shell.
 const response=await page.goto('/ready?probe=1');expect(response!.status()).toBe(404);expect(response!.headers()['content-type']).toContain('application/problem+json');expect((await response!.json()).code).toBe('NOT_FOUND');
});
