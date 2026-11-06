import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),path=new URL('src/app.js',root);let app=await readFile(path,'utf8');
if(!app.includes("import {ProgressStore}")){
let a=app.indexOf('let progress={};'),b=app.indexOf('const wt=',a);if(a<0||b<0)throw Error('找不到進度初始化');app=app.slice(0,a)+'let progress={};\n'+app.slice(b);
a=app.indexOf("if(e.target.id==='complete')");b=app.indexOf("if(e.target.id==='team')",a);if(a<0||b<0)throw Error('找不到完成紀錄事件');
app=app.slice(0,a)+"if(e.target.id==='complete'){progressStore.set(e.target.dataset.task,e.target.checked);notify(progressStore.uid?'已記錄修改，請查看上方同步狀態；不等於正式交件。':'已保存訪客本機進度；不等於正式上繳。');}"+app.slice(b);
app="import {ProgressStore} from './services/progress-store.js';\nimport {mountAccount} from './components/account.js';\n"+app;
app=app.replace('window.scrollTo(0,0);main.focus({preventScroll:true});}',"if(t)progressStore.visit(t.id);window.scrollTo(0,0);main.focus({preventScroll:true});}");
app=app.replaceAll('僅此瀏覽器本機紀錄。','登入可同步；未登入僅此瀏覽器。').replaceAll('進度僅記錄在此瀏覽器，不等於正式上繳或評分。','登入後依上方狀態確認雲端同步；未登入只記錄在本機。進度不等於交件或評分。').replaceAll('只儲存在此瀏覽器本機，不等於老師收到作業。','登入可同步至此帳號；未登入僅記錄本機。是否已同步請看上方，不等於老師收到作業。');
app=app.replace('<span>${count(w.id)} / ${wt(w.id).length} 關完成</span>','<span data-week-progress="${w.id}">${count(w.id)} / ${wt(w.id).length} 關完成</span>');
const init=`let courseStorage;try{courseStorage=localStorage;}catch{courseStorage={getItem:()=>null,setItem:()=>{throw new Error('無法使用本機儲存');}};}
const progressStore=new ProgressStore({ids:tasks.map(t=>t.id),storage:courseStorage,onChange:s=>{progress=s.progress;const box=document.querySelector('#complete');if(box)box.checked=!!progress[box.dataset.task];document.querySelectorAll('[data-week-progress]').forEach(el=>{const id=el.dataset.weekProgress;el.textContent=count(id)+' / '+wt(id).length+' 關完成';});const currentWeek=location.hash.match(/^#\\/weeks\\/(w[1-5])$/)?.[1];if(currentWeek){const b=document.querySelector('.big-number');if(b)b.innerHTML=count(currentWeek)+' <small>/ '+wt(currentWeek).length+' 關</small>';const meter=document.querySelector('.green-panel progress');if(meter)meter.value=count(currentWeek);document.querySelectorAll('.task-list>a').forEach((el,i)=>{const id=el.hash.split('/').pop();el.querySelector('.task-num').textContent=progress[id]?'✓':String(i+1).padStart(2,'0');});}}});
progress=progressStore.progress;mountAccount(progressStore);
`;
app=app.replace("window.addEventListener('hashchange',render);",init+"window.addEventListener('hashchange',render);");await writeFile(path,app);
const index=new URL('index.html',root);let html=await readFile(index,'utf8');html=html.replace('</header><main','</header><section id="account-panel" aria-label="登入與學習進度"></section><main').replace('本機進度 ≠ 正式上繳 · 不收集學生個資','學習進度 ≠ 正式上繳 · 登入可同步個人進度');await writeFile(index,html);
}
