import {mkdir,rm,cp,readFile,writeFile,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const name of ['index.html','src','docs','race'])await cp(new URL(name,root),new URL(name,dist),{recursive:true});
await cp(new URL('public/',root),dist,{recursive:true});
await writeFile(new URL('.nojekyll',dist),'');
// 版本號：每次建置不同，強制瀏覽器抓最新的 JS／CSS，避免看到舊版設定
const v=(process.env.GITHUB_SHA||Date.now().toString(36)).slice(0,10);
const bust=s=>s.replace(/(from\s*|import\s*\(\s*)(['"])(\.{1,2}\/[^'"?]+\.js)\2/g,`$1$2$3?v=${v}$2`);
const walk=async u=>{for(const e of await readdir(u,{withFileTypes:true})){const c=new URL(e.name+(e.isDirectory()?'/':''),u);if(e.isDirectory())await walk(c);else if(e.name.endsWith('.js'))await writeFile(c,bust(await readFile(c,'utf8')));}};
await walk(new URL('src/',dist));
await writeFile(new URL('version.json',dist),JSON.stringify({v}));
// 雙人競賽伺服器網址：建置時若有 RACE_SERVER_URL（GitHub Actions 變數），寫入 dist 的設定檔
const raceUrl=(process.env.RACE_SERVER_URL||'').trim().replace(/\/$/,'');
if(raceUrl){if(!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(raceUrl))throw new Error('RACE_SERVER_URL 格式錯誤：'+raceUrl);await writeFile(new URL('src/config/race.js',dist),`export const RACE_SERVER = ${JSON.stringify(raceUrl)};\n`);console.log('雙人競賽伺服器：'+raceUrl);}
// index.html 由內嵌程式讀取 version.json 後再載入 CSS／JS，這裡不必替換
console.log(`靜態網站已建立：dist/（版本 ${v}）。支援相對資源及 hash 子頁路由。`);
