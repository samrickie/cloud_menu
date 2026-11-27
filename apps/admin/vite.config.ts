import {defineConfig} from 'vite';
import preact from '@preact/preset-vite';
import tailwind from '@tailwindcss/vite';
export default defineConfig({base:'/admin/',plugins:[preact(),tailwind(),{name:'platform-csp',apply:'build',transformIndexHtml(html){return html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'">`);}}],server:{port:5176,proxy:{'/v1':'http://127.0.0.1:3000','/media':'http://127.0.0.1:3000'}}});
