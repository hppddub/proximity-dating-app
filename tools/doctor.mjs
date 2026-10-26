import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const major=Number(process.versions.node.split('.')[0]);
console.log(`Node ${process.versions.node}: ${major>=24?'OK':'install Node 24 or later'}`);
for(const [name,args] of [['git',['--version']],['java',['-version']],['javac',['-version']],['adb',['version']],['xcodebuild',['-version']]]) {
 const result=spawnSync(name,args,{encoding:'utf8'});
 console.log(`${name}: ${result.error?'not on PATH':(result.stdout||result.stderr).trim().split('\n')[0]}`);
}
console.log(`Android SDK: ${process.env.ANDROID_HOME&&existsSync(process.env.ANDROID_HOME)?'ANDROID_HOME exists':'set ANDROID_HOME or configure local.properties via Android Studio'}`);
console.log('No phone access is inferred from tool availability. This command does not print credentials or the environment.');
