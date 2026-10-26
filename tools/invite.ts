import { Engine } from '../services/coordinator/src/engine.ts';
import { Store } from '../services/coordinator/src/store.ts';
process.umask(0o077);
const engine=new Engine(new Store(process.env.DB_PATH??'data/prototype.sqlite'));
console.log('Single-use invitation (expires in one hour):',engine.createInvite());engine.store.close();
