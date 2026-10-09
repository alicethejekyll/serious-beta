import {checkPairConditions,type Profile} from '../shared/matching.js';

// Basic participation restrictions do not rank candidates or produce compatibility scores.
export function manualReport(a:Profile,b:Profile,rejected=false){
 const conditions=checkPairConditions(a,b,rejected);
 return {
  mode:'manual' as const,
  eligible:conditions.eligible,
  score:null,
  reasons:conditions.reasons,
  dimensions:[],
  engineVersion:'manual-review-1',
  caveat:'暂未启用匹配算法或 AI。候选记录须由管理员逐一审核并明确授权，且双方确认同意后才能介绍。',
 };
}
