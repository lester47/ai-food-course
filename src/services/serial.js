export class SerialConnection {
 constructor(onLine,onStatus){this.onLine=onLine;this.onStatus=onStatus;this.port=null;this.reader=null;this.pending='';this.closing=false;this.connecting=false;this.running=null;}
 async connect(){
  if(this.port||this.connecting)return;
  if(!globalThis.isSecureContext||!navigator.serial){this.onStatus('目前無法使用 Web Serial。請用 Chrome／Edge 桌機開啟 HTTPS（或本機 localhost），也可繼續使用示範模式。',false);return;}
  this.connecting=true;
  try{this.port=await navigator.serial.requestPort();await this.port.open({baudRate:115200});this.closing=false;this.onStatus('已連接 micro:bit（115200 baud）',true);this.running=this.read();}
  catch(e){this.port=null;this.onStatus(e.name==='NotFoundError'?'未選取裝置，仍為示範模式。':`無法連接：${e.message}。請檢查資料線、裝置占用或權限。`,false);}
  finally{this.connecting=false;}
 }
 async read(){let failure='';try{const decoder=new TextDecoder();this.pending='';this.reader=this.port.readable.getReader();while(!this.closing){const {value,done}=await this.reader.read();if(done)break;this.pending+=decoder.decode(value,{stream:true});const lines=this.pending.split('\n');this.pending=lines.pop();for(const line of lines){if(line.trim())this.onLine(line);}if(this.pending.length>512){this.pending='';this.onStatus('收到過長資料，已捨棄。請確認逐行傳送格式。',true);}}}catch(e){failure=`連線中斷：${e.message}。請檢查 USB 並重新連接。`;}finally{this.reader?.releaseLock();this.reader=null;try{await this.port?.close();}catch{}this.port=null;this.pending='';this.onStatus(failure||'已中斷連線；目前為示範模式。',false);}}
 async disconnect(){this.closing=true;try{await this.reader?.cancel();await this.running;}catch{} }
}
