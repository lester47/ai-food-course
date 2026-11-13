import {week1Tasks} from './week1.js';
import {week2Tasks, week3Tasks} from './week23.js';
const later=[
 [ ['認識南投13鄉鎮','行政地理','在鄉鎮卡片中逐一選取 13 鄉鎮，對照官方地圖認識位置。卡片不是行政地圖。','可以指出南投市與其餘鄉鎮名稱。'],['建立食農資料卡','資料結構','為選定鄉鎮整理名稱、農產、特色、圖片授權、參考來源及查閱日期；待核對資料先不公開。','每筆農產都有可核對的來源。'],['AI 協助修改頁面','提示詞與驗證','提示 AI：只修改選定資料卡文字，保留按鍵、進度、重置；逐項比對官方來源。','能指出 AI 內容中需要查核的一項資訊。'],['導入真實地圖','SVG／GeoJSON','由教師提供既有穩定版地圖網址或核准 GeoJSON，先在獨立副本測試。缺少界線時使用卡片練習。','地圖需包含真實 13 鄉鎮界線，不能用任意形狀替代。'],['領地變色','狀態與介面更新','在卡片練習選紅隊或綠隊，再選鄉鎮並占領；觀察歸屬與數量。','占領更換時分數會同步更正，重置清空。'],['資料查核與交件','資訊素養','核對農產、地點、圖片使用權及來源；將核對紀錄與作品連結一併交件。','同學能依來源連結找到相同資料。'] ],
 [ ['系統組裝','模組整合','在整合實驗室選隊伍與鄉鎮，先用示範按鍵測雙隊進度，再視設備接 USB。','手動模式與 USB 狀態明確可分。'],['達標攻佔','達標觸發','先選鄉鎮，每隊累積到 10 才能按攻佔；攻佔後該隊步數歸零再開始。','未滿 10 時不會占領；達標後可占領選定鄉鎮。'],['食農知識挑戰','評量與回饋','回答實驗室的三題食農素養題，閱讀每題即時解說，再修正答案。','能解釋來源查核、產地與季節的關係。'],['遊戲修正','測試與除錯','測試無效訊息、達標、換隊、RESET、拔線與重連；將問題寫入測試紀錄。','重置後步數、領地及題目都可重新開始。'],['小組展示','溝通與表達','分工介紹輸入、處理、輸出；示範一筆 USB 訊息及一筆已核對農產資料。','能用自己的話說明 STEP 或 R、G 格式。'],['期末作品紀錄','作品紀錄','整理作品網址、影片或截圖、來源、心得與測試紀錄；開啟老師設定的表單。','以 Google 表單回應確認交件，本機勾選不代表老師收到。'] ]
];
const practiceFor=i=>i<5?'counter':i<10?'heart':'led';
export const tasks = week1Tasks.map((a,i)=>({...a,id:`w1-t${String(i+1).padStart(2,'0')}`,weekId:'w1',advanced:a.tiers.challenge,images:[],submissionRequired:i===week1Tasks.length-1,practiceId:practiceFor(i)}));
// 第 2 週（燈條＋USB＋一板雙隊；第 1、2 關連到燈條課頁）與第 3 週（雙人競賽實驗室）
week2Tasks.forEach((a,i)=>tasks.push({...a,id:`w2-t${String(i+1).padStart(2,'0')}`,weekId:'w2',advanced:a.tiers.challenge,images:[],submissionRequired:i===week2Tasks.length-1,practiceId:i<4?'usb':'race',...(i<2?{practiceUrl:i===0?'./ws2812/#lesson1':'./ws2812/#lesson3'}:{})}));
week3Tasks.forEach((a,i)=>tasks.push({...a,id:`w3-t${String(i+1).padStart(2,'0')}`,weekId:'w3',advanced:a.tiers.challenge,images:[],submissionRequired:i===week3Tasks.length-1,practiceId:'race',practiceUrl:i===0?'./race/lesson.html':'./race/'}));
later.forEach((list,wi)=>list.forEach((a,i)=>tasks.push({id:`w${wi+4}-t${String(i+1).padStart(2,'0')}`,weekId:`w${wi+4}`,title:a[0],concept:a[1],durationMinutes:30,analogy:'把大作品拆成一個個可測試的小任務，完成後再接起來。',objectives:[a[3]],steps:[a[2],'依測試方法操作，記錄實際結果與遇到的問題。','與同學說明結果，確認後再前往下一關。'],testing:[a[3]],troubleshooting:['一次只改一項設定；先確認輸入與預期格式，再檢查畫面。需要時請老師協助。'],advanced:['記錄一種失敗情境，說明你怎麼找到問題。'],images:[],submissionRequired:i===5,practiceId:wi===0?'map':'game',outline:true})));
