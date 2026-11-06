export function parseLine(line) {
 const value=line.trim(); if(value==='RESET') return {type:'RESET'};
 const match=/^(STEP|R|G),(0|[1-9]\d*)$/.exec(value);
 if(!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2])>100000) throw new Error('資料格式錯誤：請使用 STEP,3、R,3、G,5 或 RESET；步數須為 0～100000 的整數。');
 return {type:match[1],value:Math.min(10,Number(match[2]))};
}
export function ledCells(red,green) {return Array.from({length:25},(_,i)=>{const y=Math.floor(i/5),x=i%5;return y<2&&y*5+x<red?'red':y>2&&(y-3)*5+x<green?'green':'';});}
export function formLink(config){if(!config?.open||config.provider!=='googleForm')return null;try{const u=new URL(config.formUrl);return u.protocol==='https:'&&(u.hostname==='forms.gle'||u.hostname==='docs.google.com'&&u.pathname.startsWith('/forms/')&&u.pathname.endsWith('/viewform'))?u.href:null;}catch{return null;}}
export function safeHttps(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:null;}catch{return null;}}
export function applyMessage(state,msg){if(msg.type==='RESET')return {...state,step:0,red:0,green:0};return {...state,[{STEP:'step',R:'red',G:'green'}[msg.type]]:msg.value};}
