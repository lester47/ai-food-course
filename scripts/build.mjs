import {mkdir,rm,cp,readFile,writeFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const name of ['index.html','src','docs'])await cp(new URL(name,root),new URL(name,dist),{recursive:true});
await cp(new URL('public/',root),dist,{recursive:true});
await writeFile(new URL('.nojekyll',dist),'');
// 版本號：每次建置不同，強制瀏覽器抓最新的 JS／CSS，避免看到舊版設定
const v=(process.env.GITHUB_SHA||Date.now().toString(36)).slice(0,10);
const bust=s=>s.replace(/(from\s*|import\s*\(\s*)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g,`$1$2$3?v=${v}$2`);
const walk=async u=>{for(const e of await readdir(u,{withFileTypes:true})){const c=new URL(e.name+(e.isDirectory()?'/':''),u);if(e.isDirectory())await walk(c);else if(e.name.endsWith('.js'))await writeFile(c,bust(await readFile(c,'utf8')));}};
await walk(new URL('src/',dist));
const html=new URL('index.html',dist);
await writeFile(html,(await readFile(html,'utf8')).replace('./src/styles.css',`./src/styles.css?v=${v}`).replace('./src/app.js',`./src/app.js?v=${v}`));
console.log(`靜態網站已建立：dist/（版本 ${v}）。支援相對資源及 hash 子頁路由。`);
