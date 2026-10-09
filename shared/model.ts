import { z } from 'zod';
export const optionSchema = z.object({value:z.string().min(1).max(60),label:z.string().min(1).max(100)}).strict();
export const questionSchema = z.object({
  key:z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), title:z.string().min(1).max(200), description:z.string().max(500).default(''),
  type:z.enum(['single','multi','scale','text']),required:z.boolean(),sensitive:z.boolean().default(false),
  options:z.array(optionSchema).max(30).default([]),min:z.number().int().min(0).max(100).default(1),max:z.number().int().min(1).max(100).default(5),
  branch:z.object({key:z.string(),equals:z.union([z.string(),z.number()])}).strict().optional()
}).strict();
export type Question = z.infer<typeof questionSchema>;
export type Answers = Record<string, string | number | string[]>;
export const answersSchema = z.record(z.union([z.string().max(2000),z.number().finite(),z.array(z.string().max(100)).max(30)]));
const single=(key:string,title:string,options:string[],sensitive=false):Question=>({key,title,description:'',type:'single',required:true,sensitive,options:options.map(value=>({value,label:value})),min:1,max:5});
const scale=(key:string,title:string,min=1,max=5):Question=>({key,title,description:'1 表示非常不认同，5 表示非常认同。',type:'scale',required:true,sensitive:false,options:[],min,max});
export const defaultQuestions:Question[]=[
  {...scale('age','你的年龄',18,80),description:'仅填写周岁，不收集出生日期。'},
  single('gender','你如何描述自己的性别？',['女性','男性','非二元'],true),
  {...single('seeking','你愿意认识哪些性别的约会对象？',['女性','男性','非二元'],true),type:'multi'},
  {...scale('age_min','你接受的约会对象最低年龄',18,80),description:'周岁，至少 18 岁。'},
  {...scale('age_max','你接受的约会对象最高年龄',18,80),description:'周岁。'},
  single('relationship','你现在期待怎样的关系？',['长期且排他的恋爱关系','仍在探索','暂时不考虑恋爱'],true),
  single('match_accept','是否愿意接受人工审核后的匹配介绍？',['愿意','暂时不愿意'],true),
  scale('values_honesty','即使难以开口，我也倾向于坦诚沟通。'),
  scale('values_independence','进入关系后，保有个人空间对我很重要。'),
  scale('values_growth','我期待两个人共同学习和成长。'),
  single('future_city','未来两三年，你倾向于在哪里生活？',['上海','中国大陆其他城市','尚未确定']),
  single('future_children','关于未来是否养育孩子，你的想法是？',['希望','不希望','尚未确定'],true),
  scale('intimacy_space','我希望日常相处中有较多独处时间。'),
  scale('intimacy_expression','明确表达喜欢和关心对我很重要。'),
  single('communication','出现分歧时，你通常如何开始沟通？',['当下讨论','先冷静再讨论','文字梳理后讨论']),
  scale('communication_checkin','我愿意定期聊聊彼此对关系的感受。'),
  {...single('interests','你喜欢怎样度过空闲时间？',['阅读与电影','运动与户外','音乐与展览','旅行','做饭','游戏','朋友聚会']),type:'multi'},
  single('sleep','你通常的作息是？',['偏早睡早起','偏晚睡晚起','较不固定']),
  single('social','你更喜欢怎样的周末节奏？',['安静慢下来','安排一些活动','丰富的社交活动']),
  single('pets','你现在是否与宠物共同生活？',['是','否']),
  {...single('pet_kind','你与什么宠物一起生活？',['猫','狗','其他']),branch:{key:'pets',equals:'是'},required:false},
  {key:'about',title:'还有什么希望我们了解的？',description:'选填。请避免填写姓名、地址或其他人的个人信息。',type:'text',required:false,sensitive:true,options:[],min:1,max:5}
];
export function visibleQuestions(questions:Question[],answers:Answers){return questions.filter(q=>!q.branch||answers[q.branch.key]===q.branch.equals);}
export function validateQuestionnaire(questions:Question[]){
  if(questions.length<7||questions.length>80)throw new Error('问卷应有 7–80 道题');
  const seen=new Set<string>();
  for(const q of questions){
    if(seen.has(q.key))throw new Error('问题标识不能重复');
    if(q.branch&&!seen.has(q.branch.key))throw new Error('分支只能引用前面的题目');
    if(q.min>=q.max)throw new Error('量表上限必须大于下限');
    if(['single','multi'].includes(q.type)&&(q.options.length<2||new Set(q.options.map(x=>x.value)).size!==q.options.length))throw new Error('选项应有至少两个不同值');
    seen.add(q.key);
  }
  // Rule inputs stay stable across versions. Editors can change wording and order.
  const fixed=defaultQuestions.filter(q=>!['pets','pet_kind','about'].includes(q.key));
  for(const original of fixed){
    const q=questions.find(x=>x.key===original.key);
    if(!q||q.type!==original.type||!q.required||q.branch||q.min!==original.min||q.max!==original.max||JSON.stringify(q.options.map(x=>x.value).sort())!==JSON.stringify(original.options.map(x=>x.value).sort())||q.sensitive!==original.sensitive)throw new Error(`匹配必需题 ${original.key} 的类型、选项值、量表和敏感属性必须保留`);
  }
}
export function cleanAnswers(questions:Question[],input:Answers,complete=false):Answers{
  const clean:Answers={};
  for(const q of visibleQuestions(questions,input)){
    const value=input[q.key];
    if(value===undefined||value===''||(Array.isArray(value)&&value.length===0)){if(complete&&q.required)throw new Error(`请完成：${q.title}`);continue;}
    if(q.type==='text'){if(typeof value!=='string'||value.length>2000)throw new Error('文本答案不合法');clean[q.key]=value.trim();}
    else if(q.type==='scale'){if(typeof value!=='number'||!Number.isInteger(value)||value<q.min||value>q.max)throw new Error(`量表答案不合法：${q.title}`);clean[q.key]=value;}
    else {const allowed=new Set(q.options.map(x=>x.value));if(q.type==='single'){if(typeof value!=='string'||!allowed.has(value))throw new Error('单选答案不合法');clean[q.key]=value;}else{if(!Array.isArray(value)||value.some(x=>!allowed.has(x))||new Set(value).size!==value.length)throw new Error('多选答案不合法');clean[q.key]=value;}}
  }
  if(typeof clean.age_min==='number'&&typeof clean.age_max==='number'&&clean.age_min>clean.age_max)throw new Error('最低年龄不能高于最高年龄');
  return clean;
}
