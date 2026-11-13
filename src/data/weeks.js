export const weeks = [
 {id:'w1',title:'鄉鎮走訪計步器：從搖一搖到紅綠雙隊',short:'搖一搖，走向第一個鄉鎮',tag:'程式啟蒙',icon:'▦',description:'用事件、變數和條件，做出搖一搖就計步、走滿 10 步抵達鄉鎮的計步器，打造領地戰的第一個零件。',equipment:'電腦、網路、MakeCode 瀏覽器模擬器；實體 micro:bit 選用（可綁在手腕上踏步）。',prior:'不需要程式經驗。',submission:'MakeCode 分享連結（或積木與模擬器截圖），加上大使日誌三題。',output:'鄉鎮走訪計步器'},
 {id:'w2',title:'燈條與網頁：一塊板子兩支隊伍',short:'步數亮上燈條，也跑進網頁',tag:'感測連線',icon:'↗',description:'先讓步數亮在 10 顆 WS2812 燈條上，再用序列和字串組合把步數送進網頁，最後用 R、G 標籤分出紅綠兩隊，做出燈條＋網頁的雙隊進度條。',equipment:'micro:bit、robot:bit 擴展板與 10 顆 WS2812 燈條（接 P0，先拔蜂鳴器跳線帽）、可傳輸資料的 USB 線、Chrome／Edge 桌機；沒有燈條用 MakeCode 模擬器，沒有板子用模擬器與示範模式。',prior:'完成第一週：步數變數、搖晃事件、一機紅綠雙隊。',submission:'燈條（或模擬器）與雙隊進度條的截圖或影片、STEP 與 R、G 格式說明，以及測試紀錄。',output:'燈條＋網頁雙隊競跑'},
 {id:'w3',title:'雙人競賽實驗室：兩台電腦即時對戰',short:'兩台電腦、兩塊板子，連線對決',tag:'連線對戰',icon:'⚑',description:'複習長條圖，寫出競賽版程式，用房號配對紅綠隊，兩台電腦即時比賽，並處理斷線與公平規則。',equipment:'每人一台 Chrome／Edge 桌機與一塊 micro:bit；沒有板子可用「模擬按鈕」連線測試。',prior:'完成第二週：序列寫入、字串組合、Web Serial 連線。',submission:'比賽結果截圖、2 條公平規則與至少 3 項測試紀錄。',output:'雙人連線對戰'},
 {id:'w4',title:'南投13鄉鎮食農互動地圖',short:'用程式探索南投的好味道',tag:'在地探索',icon:'❋',description:'從鄉鎮資料卡出發，連結農產、土地與資訊查核。',equipment:'電腦、網路、教師核准的食農資料與真實行政界線資料。',prior:'理解按鈕事件與介面更新。',submission:'互動頁網址、至少一筆已核對的食農資料與參考來源。',output:'食農互動資料卡'},
 {id:'w5',title:'AI 食農大使：領地爭霸戰',short:'讓學過的能力一起發揮',tag:'整合創作',icon:'✳',description:'結合競跑與食農知識，完成屬於小組的期末作品。',equipment:'電腦與網路；USB 設備選用，保留手動示範模式。',prior:'理解雙隊進度與鄉鎮選取。',submission:'作品網址、截圖或影片連結、小組心得與測試紀錄。',output:'食農領地挑戰'}
].map((w,i)=>({...w,number:i+1,durationMinutes:180}));
export const towns=['南投市','草屯鎮','埔里鎮','竹山鎮','集集鎮','名間鄉','鹿谷鄉','中寮鄉','魚池鄉','國姓鄉','水里鄉','信義鄉','仁愛鄉'];
// 不虛構農產配對：由教師依官方資料補入並註明來源後再公開。
export const foods=towns.map((name,i)=>({id:`town-${i}`,name,product:'待教師核對',feature:'請查找官方農業或鄉鎮公所資料，記下農產特色及資料日期。',source:'',image:''}));
