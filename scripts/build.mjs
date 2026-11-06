import {mkdir,rm,cp,readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const name of ['index.html','src','docs'])await cp(new URL(name,root),new URL(name,dist),{recursive:true});
await cp(new URL('public/',root),dist,{recursive:true});
await writeFile(new URL('.nojekyll',dist),'');
console.log('靜態網站已建立：dist/。支援相對資源及 hash 子頁路由。');
