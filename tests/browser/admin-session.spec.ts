import {test,expect} from '@playwright/test';
test('admin refresh preserves login, activity renews access, five idle minutes sign out',async({page,request})=>{
 const demo=await(await request.get('/__demo/platform')).json();
 await page.goto('/admin/');await page.getByLabel('Email address',{exact:true}).fill(demo.email);await page.getByLabel('Password',{exact:true}).fill(demo.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();await page.reload();await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
 await page.clock.install();
 await page.clock.fastForward(31000);const refresh=page.waitForResponse(r=>r.url().endsWith('/v1/platform/auth/refresh'));await page.keyboard.press('Tab');await page.clock.fastForward(1100);expect((await refresh).status()).toBe(200);
 await page.clock.fastForward(300001);await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
});
