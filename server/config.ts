import 'dotenv/config';
import { z } from 'zod';
export type Config={databaseUrl:string;encryptionKey:string;tokenKey:string;origin:string;production:boolean;mock:boolean;approved:boolean;port:number;retentionDays:number;privacyVersion:string;sensitiveVersion:string;processorName:string;privacyContact:string;trustProxy:number;icpRecord?:string;databaseCa?:string};
export function readConfig():Config{
 const e=z.object({DATABASE_URL:z.string().min(1),DATA_ENCRYPTION_KEY:z.string().regex(/^[a-f0-9]{64}$/),TOKEN_HASH_KEY:z.string().regex(/^[a-f0-9]{64}$/),APP_ORIGIN:z.string().url(),PORT:z.coerce.number().default(8080),RETENTION_DAYS:z.coerce.number().int().min(1).max(365).default(90),TRUST_PROXY_HOPS:z.coerce.number().int().min(0).max(3).default(0)}).parse(process.env);
 const production=process.env.NODE_ENV==='production'; const mock=process.env.DATA_MODE!=='real',approved=process.env.LAUNCH_APPROVED==='true';
 if(!mock&&!approved)throw new Error('Real data requires completed launch approval');
 if(production&&!e.APP_ORIGIN.startsWith('https://'))throw new Error('HTTPS origin required');
 if(production&&(!process.env.DATABASE_CA_PEM||process.env.DATABASE_SSL!=='true'))throw new Error('Production database TLS and CA required');
 if(e.DATA_ENCRYPTION_KEY===e.TOKEN_HASH_KEY)throw new Error('Independent encryption and token keys required');
 if(!mock&&(!process.env.PRIVACY_VERSION||!process.env.SENSITIVE_VERSION||process.env.PRIVACY_VERSION.startsWith('draft')||process.env.SENSITIVE_VERSION.startsWith('draft')))throw new Error('Verified privacy document versions required');
 if(!mock&&(!process.env.PROCESSOR_NAME||!process.env.PRIVACY_CONTACT))throw new Error('Verified processor and privacy contact required');
 return {databaseUrl:e.DATABASE_URL,encryptionKey:e.DATA_ENCRYPTION_KEY,tokenKey:e.TOKEN_HASH_KEY,origin:new URL(e.APP_ORIGIN).origin,production,mock,approved,port:e.PORT,retentionDays:e.RETENTION_DAYS,privacyVersion:process.env.PRIVACY_VERSION||'draft-2026-10-08',sensitiveVersion:process.env.SENSITIVE_VERSION||'draft-2026-10-08',processorName:process.env.PROCESSOR_NAME||'待人工核验的项目运营主体',privacyContact:process.env.PRIVACY_CONTACT||'待人工核验的隐私联系渠道',trustProxy:e.TRUST_PROXY_HOPS,icpRecord:process.env.ICP_RECORD,databaseCa:process.env.DATABASE_CA_PEM};
}
