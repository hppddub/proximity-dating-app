import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { get } from 'node:https';
import { isIPv4 } from 'node:net';
import { join, resolve } from 'node:path';
import { Engine } from '../services/coordinator/src/engine.ts';
import { Store } from '../services/coordinator/src/store.ts';

if (process.platform !== 'darwin') throw Error('Run phone:mac on your Mac, not Windows or Linux.');
const smoke = process.argv.includes('--smoke');
const architecture = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : undefined;
if (!architecture) throw Error('This setup supports Apple Silicon and Intel Macs.');
process.umask(0o077);
const directory = resolve('data/mac-phone-test');
const caDirectory = join(directory, 'ca');
mkdirSync(caDirectory, { recursive: true, mode: 0o700 });
const capture = (program: string, args: string[]) => execFileSync(program, args, { encoding: 'utf8' }).trim();
let ip = '127.0.0.1';
if (!smoke) {
  const ports = capture('/usr/sbin/networksetup', ['-listallhardwareports']);
  const wifi = /Hardware Port: (?:Wi-Fi|AirPort)\r?\nDevice: (\S+)/.exec(ports)?.[1];
  if (!wifi) throw Error('Wi-Fi interface not found. Connect the Mac to Wi-Fi; run networksetup -listallhardwareports if it still fails.');
  ip = capture('/usr/sbin/ipconfig', ['getifaddr', wifi]);
  if (!isIPv4(ip)) throw Error('Connect the Mac to the same Wi-Fi as both phones, then retry.');
}
const mkcert = join(directory, `mkcert-1.4.4-${architecture}`);
const expectedHashes = {
  amd64: 'a32dfab51f1845d51e810db8e47dcf0e6b51ae3422426514bf5a2b8302e97d4e',
  arm64: 'c8af0df44bce04359794dad8ea28d750437411d632748049d08644ffb66a60c6',
};
if (!existsSync(mkcert)) {
  console.log('Downloading the pinned mkcert utility from its official GitHub release…');
  execFileSync('/usr/bin/curl', ['--fail', '--location', '--retry', '2', '--max-time', '120',
    `https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-darwin-${architecture}`, '-o', mkcert], { stdio: 'inherit' });
}
if (createHash('sha256').update(readFileSync(mkcert)).digest('hex') !== expectedHashes[architecture]) {
  unlinkSync(mkcert);
  throw Error('mkcert checksum did not match; the download was removed.');
}
chmodSync(mkcert, 0o700);
const toolEnvironment = { ...process.env, CAROOT: caDirectory };
const runMkcert = (args: string[]) => execFileSync(mkcert, args, { env: toolEnvironment, stdio: 'inherit' });
if (!smoke) {
  console.log('Preparing a private test certificate authority. macOS may ask for your administrator password.');
  runMkcert(['-install']);
}
const cert = join(directory, 'coordinator.pem'), key = join(directory, 'coordinator-key.pem');
runMkcert(['-cert-file', cert, '-key-file', key, ip, 'localhost', '127.0.0.1']);
const publicCertificate = join(directory, 'phone-test-ca.cer');
execFileSync('/usr/bin/openssl', ['x509', '-in', join(caDirectory, 'rootCA.pem'), '-outform', 'DER', '-out', publicCertificate]);

process.env.HOST = smoke ? '127.0.0.1' : '0.0.0.0';
process.env.PORT = smoke ? '8792' : '8787';
process.env.DEMO_MODE = 'false';
process.env.DB_PATH = join(directory, 'phones.sqlite');
process.env.TLS_CERT_FILE = cert;
process.env.TLS_KEY_FILE = key;
const url = `https://${ip}:${process.env.PORT}`;
const engine = new Engine(new Store(process.env.DB_PATH));
const samsungInvite = engine.createInvite(), iphoneInvite = engine.createInvite();
engine.store.close();
if (!smoke) {
  console.log(`\nPHONE URL: ${url}`);
  console.log(`SAMSUNG INVITE: ${samsungInvite}`);
  console.log(`IPHONE INVITE: ${iphoneInvite}`);
  console.log('Invites are single-use and expire in one hour. Leave this terminal running.');
  console.log(`Share ONLY this public certificate with the phones: ${publicCertificate}`);
  console.log('Do not share private keys or the entire folder. Install/trust the certificate on both phones.');
  console.log('Use the same Wi-Fi on the Mac and both phones; allow Node incoming connections if macOS asks.\n');
  execFileSync('/usr/bin/open', ['-R', publicCertificate]);
  const awake = spawn('/usr/bin/caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' });
  process.once('exit', () => { awake.kill(); });
}
await import('../services/coordinator/src/main.ts');
if (smoke) {
  try {
    await new Promise<void>((resolveHealth, reject) => {
      const request = get(`${url}/health`, { ca: readFileSync(join(caDirectory, 'rootCA.pem')) }, response => {
        let data = ''; response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try { if (response.statusCode !== 200 || JSON.parse(data).ok !== true) throw Error('HTTPS health failed'); resolveHealth(); }
          catch (error) { reject(error); }
        });
      });
      request.on('error', reject); request.setTimeout(10000, () => { request.destroy(Error('HTTPS health timeout')); });
    });
    console.log('Mac setup smoke check passed: checksum, CA/leaf generation, DER export and trusted HTTPS health. No phone evidence.');
  } finally { process.kill(process.pid, 'SIGTERM'); }
}
