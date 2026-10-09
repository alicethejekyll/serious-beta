import {localDatabase,seedMock} from './bootstrap.js';import {poolFor,assertRuntimeRole} from '../server/db.js';import {createApp} from '../server/app.js';import {spawn} from 'node:child_process';import {writeFile} from 'node:fs/promises';import QRCode from 'qrcode';
const local=await localDatabase('.local',55432);await seedMock(local.migrationUrl,local.config);const pool=poolFor(local.config);await assertRuntimeRole(pool);
await writeFile('.local/admin-setup.json',JSON.stringify({username:'local-admin',password:local.state.adminPassword,totpSecret:local.state.totp,note:'仅供本地模拟环境，请用动态验证码 App 导入 TOTP'},null,2),{mode:0o600});
await QRCode.toFile('.local/admin-totp.png',`otpauth://totp/认真认识:local-admin?secret=${local.state.totp}&issuer=认真认识`);
const server=createApp(pool,local.config).listen(8080,'127.0.0.1');const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'inherit'});
console.log('本地模拟环境：用户 http://127.0.0.1:5173 / 管理 http://127.0.0.1:5173/admin。仅本机访问，不能用作手机公网扫码地址。管理员本地凭证位于 .local/admin-setup.json。');
let closing=false;async function close(){if(closing)return;closing=true;vite.kill();server.close();await pool.end();await local.postgres.stop();process.exit(0);}for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{void close();});vite.on('exit',()=>{void close();});
