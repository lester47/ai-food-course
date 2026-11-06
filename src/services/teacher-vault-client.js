// 在瀏覽器用 Web Crypto 解密教師範例程式。密碼不會被儲存或送出。
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export async function unlockVault(vault, password, subtle = globalThis.crypto?.subtle) {
  if (!subtle) throw new Error('此瀏覽器不支援加密功能，請改用最新版 Chrome 或 Edge，並以 HTTPS 開啟。');
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({name: 'PBKDF2', salt: fromB64(vault.salt), iterations: vault.iterations, hash: 'SHA-256'}, base, {name: 'AES-GCM', length: 256}, false, ['decrypt']);
  let plain;
  try { plain = await subtle.decrypt({name: 'AES-GCM', iv: fromB64(vault.iv)}, key, fromB64(vault.data)); }
  catch { throw new Error('密碼錯誤，請再試一次。'); }
  return JSON.parse(new TextDecoder().decode(plain));
}
