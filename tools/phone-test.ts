import { Engine } from '../services/coordinator/src/engine.ts';
import { Store } from '../services/coordinator/src/store.ts';

// Real-phone development over adb reverse. No simulated encounters are enabled.
process.env.DEMO_MODE = 'false';
process.env.HOST = '127.0.0.1';
process.env.PORT = '8787';
process.env.DB_PATH = 'data/phone-test.sqlite';
const engine = new Engine(new Store(process.env.DB_PATH));
const invite = engine.createInvite();
engine.store.close();
console.log('\nREAL PHONE TEST — simulation disabled');
console.log('Samsung coordinator URL: http://localhost:8787');
console.log(`Samsung single-use enrollment invite: ${invite}`);
console.log('The invite expires in one hour. Keep this window open.');
console.log('USB setup required in another terminal: adb reverse tcp:8787 tcp:8787');
console.log('iPhone scanner-only check: look for service 7b9e1000-29c4-4a91-8c65-66d9384a1000.\n');
await import('../services/coordinator/src/main.ts');
