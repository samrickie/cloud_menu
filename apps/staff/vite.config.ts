import {defineConfig} from 'vite';
import preact from '@preact/preset-vite';
export default defineConfig({plugins:[preact()],server:{port:5174,proxy:{'/v1':'http://127.0.0.1:3000','/media':'http://127.0.0.1:3000'}}});
