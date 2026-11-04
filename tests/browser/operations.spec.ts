import {test,expect,type Page} from '@playwright/test';

import sharp from 'sharp';

test('owner menu photos, automatic inventory, real dashboard and manager/kitchen access work end to end',async({page,browser,request})=>{

 test.setTimeout(90000);page.setDefaultTimeout(10000);

 await page.goto('/owner/');await page.getByLabel('Full name').fill('Sample data Operations Owner');await page.getByLabel('Email address').fill(`sample-ops-${crypto.randomUUID()}@example.test`);await page.getByLabel('Password',{exact:true}).fill('Sample-test-password-only-123');await page.getByRole('button',{name:'Create account',exact:true}).click();const slug='sample-ops-'+crypto.randomUUID().slice(0,8);await page.getByLabel('Venue name').fill('Sample data Operations');await page.getByLabel('Website address').fill(slug);const created=page.waitForResponse(r=>r.url().endsWith('/v1/owner/venues')&&r.request().method()==='POST');await page.getByRole('button',{name:'Create venue',exact:true}).click();const venue=await(await created).json(),headers={authorization:'Bearer '+venue.staff_token};await expect(page.getByRole('heading',{name:'Launch your venue in 7 steps'})).toBeVisible();

 await page.getByRole('button',{name:'4 Menu',exact:true}).click();await page.getByLabel('Item name · English').fill('Sample data grilled meal');await page.getByLabel('Description · English').fill('Freshly grilled with rice and seasonal vegetables');await page.getByLabel('Description · Swahili').fill('Chakula cha kuchomwa na wali');await page.getByLabel('Price (TZS)').fill('12345');const image=await sharp({create:{width:320,height:240,channels:3,background:'#C9A24B'}}).png().toBuffer();await page.getByLabel('Item photo',{exact:true}).setInputFiles({name:'sample-data.png',mimeType:'image/png',buffer:image});await expect(page.getByAltText('Photo preview')).toBeVisible();await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByRole('status')).toContainText('Item added');await expect(page.locator('.ops-menu-items')).toContainText('Freshly grilled');await page.getByRole('button',{name:'Edit item · Sample data grilled meal',exact:true}).click();await page.getByLabel('Item name · Swahili').fill('Chakula cha mfano');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('status')).toContainText('Item saved');

 await page.getByRole('button',{name:'Inventory',exact:true}).click();await page.getByRole('button',{name:'Manage stock · Sample data grilled meal',exact:true}).click();await page.getByLabel('Track stock',{exact:true}).check();await page.getByLabel('Units',{exact:true}).fill('4');await page.getByLabel('Reason',{exact:true}).fill('Sample data opening count');await page.getByRole('button',{name:'Save stock',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('status')).toHaveText('Stock saved');

 await page.getByRole('button',{name:'Team',exact:true}).click();async function createStaff(name:string,role:string){await page.getByLabel('Full name',{exact:true}).fill(name);await page.getByLabel('Role',{exact:true}).selectOption(role);await page.getByLabel('Staff PIN',{exact:true}).fill('654321');const pending=page.waitForResponse(r=>r.url().endsWith('/v1/owner/staff')&&r.request().method()==='POST');await page.getByRole('button',{name:'Create staff',exact:true}).click();const s=(await(await pending).json()).staff;await expect(page.locator('.ops-list')).toContainText(name);return s;}

 const manager=await createStaff('Sample data Manager','MANAGER'),kitchen=await createStaff('Sample data Chef','KITCHEN');

 const tables=await(await request.post('/v1/admin/tables/range',{headers,data:{from:1,to:1,prefix:'Sample',seats:4,zone:'Sample data'}})).json();await page.getByRole('button',{name:'Dashboard',exact:true}).click();await expect(page.getByTestId('kpi-orders')).toContainText('0');

 for(const width of [280,360,720,884,1440]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);if([360,1440].includes(width))await expect(page).toHaveScreenshot(`dashboard-${width}.png`,{fullPage:true,maskColor:'#2B2C30',mask:[page.locator('.ops-updated'),page.locator('.venue-link')]});}

 const guestContext=await browser.newContext(),guest=await guestContext.newPage();await guest.goto(tables.tables[0].url);await expect(guest.getByText('Freshly grilled with rice and seasonal vegetables',{exact:true})).toBeVisible();await guest.getByRole('button',{name:'Add Sample data grilled meal',exact:true}).click();await expect(guest.locator('.item-detail-photo')).toBeVisible();await guest.getByLabel('Quantity',{exact:true}).fill('2');await guest.getByLabel('Message to the kitchen / bar',{exact:true}).fill('Please grill well, sauce on the side');await guest.getByRole('button',{name:/Add to cart/}).click();await guest.getByRole('button',{name:/View cart/}).click();await guest.getByRole('button',{name:'Send order',exact:true}).click();await expect(guest.getByRole('status').filter({hasText:'Order received'})).toBeVisible();

 await page.getByRole('button',{name:'Dashboard',exact:true}).click();await page.getByRole('button',{name:'Refresh dashboard',exact:true}).click();await expect(page.getByTestId('kpi-orders')).toContainText('1');await expect(page.getByTestId('ordered-sales')).toHaveText('TZS 24,690');await expect(page.getByTestId('kpi-revenue_tzs').locator('strong')).toHaveText('TZS 0');await expect(page.getByRole('img',{name:'Orders by hour',exact:true})).toBeVisible();await expect(page.locator('article').filter({has:page.getByRole('heading',{name:'Payment mix',exact:true})}).getByText('No successful payments in this period.',{exact:true})).toBeVisible();

 for(const width of [360,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`.artifacts/operations-dashboard-${width}.png`,fullPage:true});}

 const csv=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();expect((await csv).suggestedFilename()).toBe('cloud-menu-dashboard.csv');

 async function signIn(p:Page,id:string){await p.goto('/staff/');await p.getByLabel('Sign in as').selectOption(id===manager.id?'MANAGER':'KITCHEN');await p.getByLabel('Venue code',{exact:true}).fill(slug);await p.getByLabel('Staff name or ID',{exact:true}).fill(id);await p.getByLabel('PIN',{exact:true}).fill('654321');await p.getByRole('button',{name:'Sign in',exact:true}).click();}

 const managerContext=await browser.newContext({viewport:{width:360,height:900}}),mp=await managerContext.newPage();await signIn(mp,manager.id);await expect(mp.getByRole('heading',{name:'Venue dashboard',exact:true})).toBeVisible();await expect(mp.getByTestId('ordered-sales')).toHaveText('TZS 24,690');await expect(mp.getByRole('button',{name:'Team',exact:true})).toHaveCount(0);expect(await mp.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);await mp.screenshot({path:'.artifacts/operations-manager-360.png',fullPage:true});

 const kitchenContext=await browser.newContext({viewport:{width:360,height:900}}),kp=await kitchenContext.newPage();await signIn(kp,kitchen.full_name);await kp.getByRole('button',{name:'Inventory',exact:true}).click();await expect(kp.locator('.ops-list-row').filter({hasText:'Sample data grilled meal'}).locator('.ops-stock-number')).toHaveText('2');await expect(kp.getByRole('button',{name:'Dashboard',exact:true})).toHaveCount(0);await kp.getByRole('button',{name:'Manage stock · Sample data grilled meal',exact:true}).click();await kp.getByLabel('Stock action',{exact:true}).selectOption('RECEIVE');await kp.getByLabel('Units',{exact:true}).fill('3');await kp.getByLabel('Reason',{exact:true}).fill('Sample data delivery');await kp.getByRole('button',{name:'Save stock',exact:true}).click();await expect(kp.locator('.ops-list-row').filter({hasText:'Sample data grilled meal'}).locator('.ops-stock-number')).toHaveText('5');expect(await kp.evaluate(()=>document.documentElement.scrollWidth)).toBe(360);await kp.screenshot({path:'.artifacts/operations-kitchen-stock-360.png',fullPage:true});await kp.getByRole('button',{name:'Orders',exact:true}).click();await expect(kp.locator('.ops-ticket-note')).toContainText('Please grill well, sauce on the side');await kp.getByRole('combobox',{name:'Languages'}).selectOption('sw');await expect(kp.getByRole('heading',{name:'Maagizo ya karibuni',exact:true})).toBeVisible();

 await kp.locator('header').getByRole('combobox').selectOption('en');
 const mealRow=kp.getByRole('row').filter({hasText:'Sample data grilled meal'});
 for(const stage of ['Accepted','Preparing','Ready'])await mealRow.getByRole('button',{name:'Sample data grilled meal: '+stage,exact:true}).click();
 await guest.getByRole('button',{name:'Call waiter',exact:true}).click();
 await guest.getByLabel('Optional message').fill('Sample data water refill');
 await guest.getByRole('button',{name:'Send waiter request'}).click();
 await mp.getByRole('button',{name:'Orders',exact:true}).click();
 const refill=mp.locator('article').filter({hasText:'Sample data water refill'});
 await refill.getByRole('button',{name:'On my way'}).click();
 await expect(guest.getByText('On my way',{exact:true})).toBeVisible();
 await refill.getByRole('button',{name:'Mark resolved'}).click();
 await mp.getByRole('row').filter({hasText:'Sample data grilled meal'}).getByRole('button',{name:'Sample data grilled meal: Served',exact:true}).click();
 await expect(guest.getByRole('heading',{name:'Rate your service'})).toBeVisible({timeout:10000});
 await guest.getByRole('group',{name:'Waiter service'}).getByRole('radio',{name:'5 of 5 stars'}).check();
 await guest.getByRole('group',{name:'Sample data grilled meal'}).getByRole('radio',{name:'4 of 5 stars'}).check();
 await guest.getByLabel('Comment (optional)').fill('Sample private service feedback');
 await guest.getByRole('button',{name:'Submit rating'}).click();
 await expect(guest.getByText('Thank you for rating your service.')).toBeVisible();
 const second=await browser.newContext(),newGuest=await second.newPage();await newGuest.goto(tables.tables[0].url);
 await expect(newGuest.getByRole('heading',{name:'Most rated food'})).toBeVisible();
 await expect(newGuest.getByRole('region',{name:'Your orders'})).toHaveCount(0);
 await expect(newGuest.getByText('Sample private service feedback')).toHaveCount(0);
 await second.close();
 await guestContext.close();await managerContext.close();await kitchenContext.close();

});
