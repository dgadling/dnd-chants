// placeholder – full impl in next commit with stronger PIN Argon2id
export const STORAGE_BACKUP_KEY = "dnd-chant-backup-key";
export async function deriveKeyFromPin(pin: string, salt: string): Promise<CryptoKey> {
  const enc=new TextEncoder();
  const km=await crypto.subtle.importKey("raw",enc.encode(pin) as any,"PBKDF2",false,["deriveKey"]);
  return await crypto.subtle.deriveKey({name:"PBKDF2",salt:enc.encode(salt) as any,iterations:600000,hash:"SHA-256"},km,{name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
}
