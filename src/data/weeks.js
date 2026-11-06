export const weeks = [
 {id:'w1',title:'從按鍵到紅綠隊 LED 計步器',short:'讓第一顆 LED 亮起來',tag:'程式啟蒙',icon:'▦',description:'從按下 A 鍵開始，把想法變成會發光的小作品。',equipment:'電腦、網路、MakeCode 瀏覽器模擬器；實體 micro:bit 選用。',prior:'不需要程式經驗。',submission:'MakeCode 分享連結（如可取得）、模擬器或積木截圖、30～80 字心得，依教師要求擇一。',output:'LED 計步器'},
 {id:'w2',title:'micro:bit USB 直接控制網頁',short:'把步數送進網頁',tag:'感測連線',icon:'↗',description:'用一條 USB 線，讓你的每一步出現在網頁上。',equipment:'micro:bit、可傳輸資料的 USB 線、Chrome／Edge 桌機與 HTTPS 網頁。',prior:'能建立步數變數與按鍵事件。',submission:'USB 連線與步數畫面的截圖或影片連結，加上資料傳送原理簡述。',output:'USB 網頁進度條'},
 {id:'w3',title:'紅綠隊即時競跑網頁',short:'一起跑，讓雙隊競賽開始',tag:'資料分流',icon:'⚑',description:'一塊板子、兩支隊伍，學會讀懂資料中的隊伍標籤。',equipment:'一塊 micro:bit、資料 USB 線、Chrome／Edge 桌機。',prior:'完成 STEP 逐行資料傳送。',submission:'雙隊競跑作品網址或測試截圖／影片，以及 R、G 訊息格式說明。',output:'雙隊競跑網頁'},
 {id:'w4',title:'南投13鄉鎮食農互動地圖',short:'用程式探索南投的好味道',tag:'在地探索',icon:'❋',description:'從鄉鎮資料卡出發，連結農產、土地與資訊查核。',equipment:'電腦、網路、教師核准的食農資料與真實行政界線資料。',prior:'理解按鈕事件與介面更新。',submission:'互動頁網址、至少一筆已核對的食農資料與參考來源。',output:'食農互動資料卡'},
 {id:'w5',title:'AI 食農大使：領地爭霸戰',short:'讓學過的能力一起發揮',tag:'整合創作',icon:'✳',description:'結合競跑與食農知識，完成屬於小組的期末作品。',equipment:'電腦與網路；USB 設備選用，保留手動示範模式。',prior:'理解雙隊進度與鄉鎮選取。',submission:'作品網址、截圖或影片連結、小組心得與測試紀錄。',output:'食農領地挑戰'}
].map((w,i)=>({...w,number:i+1,durationMinutes:180}));
export const towns=['南投市','草屯鎮','埔里鎮','竹山鎮','集集鎮','名間鄉','鹿谷鄉','中寮鄉','魚池鄉','國姓鄉','水里鄉','信義鄉','仁愛鄉'];
// 不虛構農產配對：由教師依官方資料補入並註明來源後再公開。
export const foods=towns.map((name,i)=>({id:`town-${i}`,name,product:'待教師核對',feature:'請查找官方農業或鄉鎮公所資料，記下農產特色及資料日期。',source:'',image:''}));
