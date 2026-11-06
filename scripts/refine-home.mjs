import {readFileSync,writeFileSync} from 'node:fs';
const file='src/app.js';let s=readFileSync(file,'utf8');
for(const [a,b] of Object.entries({'YOUR LEARNING JOURNEY':'五週學習路線','READY TO EXPLORE?':'準備出發','FIVE WEEKS · ONE ADVENTURE':'五週，一場創作冒險','DRIVING QUESTION · 五週驅動問題':'五週驅動問題',"TEACHER'S CORNER":'教師園地','LEARNING TOOLKIT':'學習工具箱','SHARE YOUR CREATION':'分享你的作品','SUBMIT YOUR WORK':'繳交作品','A LITTLE HELP':'操作小幫手','TRY · TEST · DISCOVER':'動手・測試・發現','OBSERVE & THINK':'觀察與思考','GROW TOGETHER':'一起成長'}))s=s.replaceAll(a,b);
s=s.replace('<p class="hero-swipe" aria-hidden="true">← 左右滑動，看看五週路線 →</p>','');
s=s.replace('<figcaption>五週學習路線：從 micro:bit 與 MakeCode，走到食農作品。</figcaption>','<figcaption>五週學習路線：從 micro:bit 與 MakeCode，走到食農作品。</figcaption>');
s=s.replace('${dqBanner()}<section class="section">','<nav class="hero-course-stops" aria-label="五週學習節點">'+['計步器','網頁進度條','紅綠競跑','鄉鎮資料卡','領地戰'].map((t,i)=>`<a href="#/weeks/w${i+1}"><b>0${i+1}</b>第 ${i+1} 週 · ${t}</a>`).join('')+'</nav>${dqBanner()}<section class="section">');
writeFileSync(file,s);
