// 僅放公開的學生填答網址。不可放回應試算表、編輯連結、密碼或密鑰。
export const assignments = Object.fromEntries([1,2,3,4,5].map(n => [`w${n}`, {
  provider: 'googleForm', formUrl: '', open: false, deadline: '', note: '請依老師公告準備作品連結與心得。'
}]));
export const integration = { gameUrl: '', mapGeoJson: '' }; // 可填學校核准的 HTTPS 遊戲入口；真實 GeoJSON 可在後續版本整合。
export const gallery = []; // 僅加入已獲授權的匿名作品：{ title, weekId, url, approved: true }
