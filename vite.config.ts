import { defineConfig } from "vite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(resolve(dir, e.name)) : [resolve(dir, e.name)],
  );
}
export default defineConfig({
  server: { port: 5173 },
  build: { target: "es2022", chunkSizeWarningLimit: 650 },
  plugins: [
    {
      name: "offline-game",
      generateBundle(_options, bundle) {
        const assets = [
          "/",
          ...Object.keys(bundle).map((p) => `/${p}`),
          ...files(resolve("public")).map(
            (p) => `/${relative(resolve("public"), p)}`,
          ),
        ];
        const hash = createHash("sha256").update(
          JSON.stringify(Object.keys(bundle)),
        );
        hash.update(readFileSync(resolve("index.html")));
        for (const path of files(resolve("public")))
          hash.update(readFileSync(path));
        const version = hash.digest("hex").slice(0, 12);
        const source = `const CACHE='shanhai-${version}';const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('shanhai-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  // Prefer deployed files while online, including after a release rollback.
  // Keep the offline copy for disconnected play without changing local saves.
  event.respondWith(fetch(event.request).then(async response=>{
    if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone()).catch(()=>{});}
    return response;
  }).catch(async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(event.request,{ignoreVary:true}) || (event.request.mode==='navigate' ? await cache.match('/') : null) || Response.error();
  }));
});`;
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  ],
});
