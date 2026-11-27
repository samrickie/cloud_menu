import {defineConfig} from 'vite';
import preact from '@preact/preset-vite';
import tailwind from '@tailwindcss/vite';
export default defineConfig({base:'/staff/',plugins:[preact(),tailwind()],server:{port:5174,proxy:{'/v1':'http://127.0.0.1:3000','/media':'http://127.0.0.1:3000'}}});
