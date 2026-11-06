// 把 teacher-src/materials.mjs 加密成 src/data/teacher-vault.js。
// 密碼只從環境變數讀取，不寫進任何檔案：
//   PowerShell： $env:TEACHER_PASSWORD="你的密碼"; npm run encrypt-teacher
//   macOS/Linux：TEACHER_PASSWORD="你的密碼" npm run encrypt-teacher
import {webcrypto as crypto} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {materials} from '../teacher-src/materials.mjs';

const password = process.env.TEACHER_PASSWORD;
if (!password) { console.error('請先設定 TEACHER_PASSWORD 環境變數。'); process.exit(1); }

const ITERATIONS = 600000;
const enc = new TextEncoder();
const b64 = buf => Buffer.from(buf).toString('base64');
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, false, ['encrypt']);
const payload = enc.encode(JSON.stringify({version: 1, createdAt: new Date().toISOString(), materials}));
const data = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, payload);

const out = `// 自動產生：教師範例程式的加密檔（AES-256-GCM，PBKDF2-SHA256 ${ITERATIONS} 次）。
// 沒有密碼無法解讀內容。請勿手動修改；改內容請編輯 teacher-src/ 後重新執行 npm run encrypt-teacher。
export const teacherVault = ${JSON.stringify({v: 1, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data)})};
`;
await writeFile(new URL('../src/data/teacher-vault.js', import.meta.url), out);
console.log(`已加密 ${materials.length} 個單元（${materials.filter(m => m.code).length} 個有程式）→ src/data/teacher-vault.js`);
