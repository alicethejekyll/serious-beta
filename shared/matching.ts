import type { Answers } from './model.js';
export const engineVersion='rules-1.0';
export const defaultWeights={values:30,planning:25,intimacy:20,communication:15,lifestyle:10};
export type Weights=typeof defaultWeights;
export type Profile={id:string;answers:Answers;active:boolean};
const scaleScore=(a:unknown,b:unknown)=>typeof a==='number'&&typeof b==='number'?Math.max(0,100-Math.abs(a-b)*25):null;
const equalScore=(a:unknown,b:unknown)=>typeof a==='string'&&typeof b==='string'?(a===b?100:30):null;
const overlap=(a:unknown,b:unknown)=>{if(!Array.isArray(a)||!Array.isArray(b)||a.length===0||b.length===0)return null;const union=new Set([...a,...b]);return Math.round(100*a.filter(x=>b.includes(x)).length/union.size);};
export function checkPairConditions(a:Profile,b:Profile,rejected=false){
  const reasons:string[]=[];const A=a.answers,B=b.answers;
  if(a.id===b.id)reasons.push('不能与自己匹配');
  if(!a.active||!b.active)reasons.push('至少一方当前未参与匹配');
  for(const [x,y] of [[A,B],[B,A]]){
    if(typeof x.age!=='number'||x.age<18||typeof y.age!=='number'||typeof x.age_min!=='number'||typeof x.age_max!=='number'||x.age_min>x.age_max||y.age<x.age_min||y.age>x.age_max)reasons.push('不满足双方成年及年龄区间要求');
    if(!Array.isArray(x.seeking)||typeof y.gender!=='string'||!x.seeking.includes(y.gender))reasons.push('不满足双方约会对象偏好');
    if(x.relationship!=='长期且排他的恋爱关系')reasons.push('不满足首轮长期且排他的关系期待');
    if(x.match_accept!=='愿意')reasons.push('至少一方暂不接受匹配');
  }
  if(rejected)reasons.push('至少一方已明确拒绝该组合');
  return {eligible:reasons.length===0,reasons:[...new Set(reasons)]};
}
// Reserved prototype. The running application uses manual review, not this scoring engine.
export function analyzePair(a:Profile,b:Profile,weights:Weights=defaultWeights,rejected=false){
  if(Object.values(weights).some(x=>!Number.isFinite(x)||x<0)||Object.values(weights).reduce((s,x)=>s+x,0)<=0)throw new Error('权重必须非负且总和大于零');
  const {reasons}=checkPairConditions(a,b,rejected),A=a.answers,B=b.answers;
  const caveat='规则相容性参考分，仅用于人工初筛，不代表恋爱成功概率。不同生活选择没有优劣。';
  if(reasons.length)return {eligible:false,score:null,reasons:[...new Set(reasons)],dimensions:[],weights,engineVersion,caveat};
  const dimensions=[
    {key:'values',label:'核心价值观',items:['values_honesty','values_independence','values_growth'].map(k=>scaleScore(A[k],B[k]))},
    {key:'planning',label:'生活规划',items:['future_city','future_children'].map(k=>equalScore(A[k],B[k]))},
    {key:'intimacy',label:'亲密关系期待',items:['intimacy_space','intimacy_expression'].map(k=>scaleScore(A[k],B[k]))},
    {key:'communication',label:'沟通方式',items:[equalScore(A.communication,B.communication),scaleScore(A.communication_checkin,B.communication_checkin)]},
    {key:'lifestyle',label:'兴趣与生活方式',items:[overlap(A.interests,B.interests),equalScore(A.sleep,B.sleep),equalScore(A.social,B.social)]}
  ].map(d=>({key:d.key,label:d.label,weight:weights[d.key as keyof Weights],answered:d.items.filter(x=>x!==null).length,total:d.items.length,score:d.items.every(x=>x!==null)?Math.round(d.items.reduce<number>((s,x)=>s+(x??0),0)/d.items.length):null}));
  if(dimensions.some(d=>d.score===null))return {eligible:false,score:null,reasons:['匹配维度回答不完整，需补充后分析'],dimensions,weights,engineVersion,caveat};
  const sum=Object.values(weights).reduce((s,x)=>s+x,0);
  return {eligible:true,score:Math.round(dimensions.reduce((s,d)=>s+d.weight*(d.score??0),0)/sum),reasons:[],dimensions,weights,engineVersion,caveat};
}
