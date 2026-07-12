import { cp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const client = resolve(dist, 'client');
const server = resolve(dist, 'server');
const metadata = resolve(dist, '.openai');

await rm(client, { recursive: true, force: true });
await rm(server, { recursive: true, force: true });
await rm(metadata, { recursive: true, force: true });
await mkdir(client, { recursive: true });

for (const entry of await readdir(dist)) {
  if (entry === 'client' || entry === 'server' || entry === '.openai') continue;
  await rename(resolve(dist, entry), resolve(client, entry));
}

await mkdir(server, { recursive: true });
await writeFile(
  resolve(server, 'index.js'),
  `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== 'GET') return response;

    const fallbackUrl = new URL('/index.html', request.url);
    return env.ASSETS.fetch(new Request(fallbackUrl, request));
  },
};
`,
);

await mkdir(metadata, { recursive: true });
await cp(resolve(root, '.openai', 'hosting.json'), resolve(metadata, 'hosting.json'));
