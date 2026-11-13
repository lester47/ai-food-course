// 僅放公開的學生填答網址。不可放回應試算表、編輯連結、密碼或密鑰。
export const assignments = {
 w1: {provider:'googleForm', formUrl:'https://forms.gle/GCKzkfWkJ62obnZa6', open:true,  deadline:'', note:'請貼上 MakeCode 分享連結，並寫大使日誌三題。'},
 w2: {provider:'googleForm', formUrl:'https://forms.gle/Ae68Mfm1r7xfGCbHA', open:false, deadline:'', note:'請貼上燈條（沒有燈條可用模擬器）與雙隊進度條的截圖或影片，說明 STEP 與 R、G 資料格式，並附測試紀錄。'},
 w3: {provider:'googleForm', formUrl:'https://forms.gle/6ciK3mscTbgxbHbg9', open:false, deadline:'', note:'請貼上雙人競賽結果截圖，寫下 2 條公平規則與至少 3 項測試紀錄。'},
 w4: {provider:'googleForm', formUrl:'https://forms.gle/UC5eyTRtk4WPz47YA', open:false, deadline:'', note:'每組填寫負責鄉鎮的農產資料，一定要附官方來源網址。'},
 w5: {provider:'googleForm', formUrl:'https://forms.gle/fZTzRv9rH9z7G3f2A', open:false, deadline:'', note:'請貼上期末作品連結、小組自訂規則與測試紀錄。'}
};
export const integration = { gameUrl: 'https://lester47.github.io/nantawfood/', mapGeoJson: '' }; // 可填學校核准的 HTTPS 遊戲入口；真實 GeoJSON 可在後續版本整合。
export const gallery = []; // 僅加入已獲授權的匿名作品：{ title, weekId, url, approved: true }
