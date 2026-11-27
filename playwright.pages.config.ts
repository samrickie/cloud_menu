import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/pages',workers:1,use:{baseURL:'http://127.0.0.1:4180',...(process.env.LOCAL_EDGE?{channel:'msedge'}:{})},webServer:{command:'node tools/serve-pages.mjs',url:'http://127.0.0.1:4180',reuseExistingServer:false},reporter:'list'});
