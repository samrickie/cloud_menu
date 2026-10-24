// Recovery for an interrupted local install. Uses only already-downloaded packages.
// Normal setup and CI use pnpm install with the lockfile.
import { readdir, readFile, symlink, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
 const prefix = name.replace('/', '+') + '@';
 const major = (manifest.dependencies?.[name] ?? manifest.devDependencies[name]).replace(/^[^0-9]*/, '').split('.')[0];
 const folders = (await readdir('node_modules/.pnpm')).filter(n => n.startsWith(prefix + major + '.'));
 if (folders.length !== 1) throw new Error(`Expected exactly one cached ${name}: ${folders}`);
 const target = path.join(root, 'node_modules/.pnpm', folders[0], 'node_modules', name);
 const link = path.join(root, 'node_modules', name);
 await mkdir(path.dirname(link), {recursive:true});
 try { await access(link); } catch { await symlink(target, link, 'junction'); }
 const pkg = JSON.parse(await readFile(path.join(target, 'package.json'), 'utf8'));
 if (manifest.dependencies?.[name]) manifest.dependencies[name] = pkg.version;
 if (manifest.devDependencies?.[name]) manifest.devDependencies[name] = pkg.version;
}
const { writeFile } = await import('node:fs/promises');
await writeFile('package.json', JSON.stringify(manifest,null,2)+'\n');
console.log('Linked cached dependencies; versions pinned to cached package manifests.');
