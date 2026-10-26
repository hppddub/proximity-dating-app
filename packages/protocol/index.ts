import { createHmac, randomBytes } from 'node:crypto';
export type Hello = { alias: string; nonce: string; at: number };
export type Proof = { a: Hello; b: Hello & { sig: string }; sigA: string };
export const SERVICE_UUID = '7b9e1000-29c4-4a91-8c65-66d9384a1000';
export function transcript(a: Hello, b: Hello): string {
  return `v1|${a.alias}|${b.alias}|${a.nonce}|${b.nonce}|${a.at}|${b.at}`;
}
export const sign = (key: string, text: string): string => createHmac('sha256', Buffer.from(key, 'hex')).update(text).digest('hex');
export const nonce = (): string => randomBytes(16).toString('hex');
export function makeProof(a: { alias: string; proofKey: string }, b: { alias: string; proofKey: string }, at: number): Proof {
  const x = { alias: a.alias, nonce: nonce(), at }, y = { alias: b.alias, nonce: nonce(), at };
  const text = transcript(x, y);
  return { a: x, b: { ...y, sig: sign(b.proofKey, text) }, sigA: sign(a.proofKey, text) };
}
