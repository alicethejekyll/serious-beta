export type Meta={name:string;mock:boolean;approved:boolean;retentionDays:number;privacyVersion:string;sensitiveVersion:string;processorName:string;privacyContact:string;accepting:boolean;hasPublished:boolean;icpRecord?:string};
export function PrivacyText({meta,sensitive=false}:{meta:Meta;sensitive?:boolean}){return <div className="legal-copy">
 <p className="eyebrow">{sensitive?'SENSITIVE INFORMATION':'YOUR PRIVACY'}</p><h2>{sensitive?'敏感个人信息处理说明':'个人信息处理规则'}</h2>
 {meta.mock&&<p className="notice">当前为模拟测试环境。下列规则为模板，运营主体、联系渠道、保存期限、必要性及备份安排尚需正式上线前人工核验。</p>}
 <p>处理者：{meta.processorName}。隐私联系渠道：{meta.privacyContact}。规则版本：{sensitive?meta.sensitiveVersion:meta.privacyVersion}。</p>
 <h3>目的与范围</h3><p>仅面向年满 18 周岁的参与者，在上海首轮内测中，通过问卷初步了解长期、排他性关系期待。回答用于人工审核、人工匹配、联系双方确认介绍及处理你的个人信息权利请求。首轮不收费，不提供用户聊天或公开档案。</p>
 {sensitive?<><h3>为什么需要单独同意</h3><p>性别、约会对象偏好、关系期待、生育想法及开放文本可能揭示性取向和亲密关系等高度敏感信息。初筛需要双向核对约会对象偏好和关系期待；部分价值观与生活规划用于相容性参考。泄露可能造成隐私、人格尊严或歧视风险。请不要填写他人的个人信息、精确住址或不必要的身份信息。</p><p>敏感题会明确标注。你可拒绝同意并退出，或随时撤回参与；拒绝后无法进行这项匹配服务。问卷回答仅由获授权的管理员在审核、分析和确认介绍时访问，并记录访问审计。</p></>:<><h3>收集的信息</h3><p>收集年龄、性别及约会对象偏好、关系期待、价值观、生活规划、沟通方式、兴趣和生活习惯。联系方式另表保存，选填并单独确认同意；技术侧记录会话、匿名限流标识、同意版本和安全审计。我们不要求微信授权、传统账号、实名或身份证。</p><h3>介绍与共享</h3><p>问卷不向其他用户开放。管理员审核后，先分别征求两位用户同意，并另行确认要介绍的资料范围；双方明确同意后才能介绍。本系统只记录确认状态，不自动发送联系方式。CloudBase 作为境内托管和数据库服务提供方，服务地区及受托协议需人工核验。AI 分析关闭，回答不发送给 AI 服务，不用于训练或开发测试。</p></>}
 <h3>保存与保护</h3><p>当前配置保存 {meta.retentionDays} 天，从建立草稿或最后一次提交起计算，到期由定时维护任务清理。使用 HTTPS、回答和联系方式加密、会话凭证及最小权限访问。备份计划默认保留 7 天；上线前需核验云备份、自动删除任务及恢复演练。恢复时重放删除台账，防止已删除信息再次出现。匿名审计默认保留 180 天。</p>
 <h3>修改、撤回与删除</h3><p>同一浏览器会话或安全恢复凭证可访问自己的回答、修改、撤回和删除。公开用户 ID 无法恢复身份。撤回后停止匹配并立即删除在线回答、联系方式和匹配记录；你也可删除全部在线个人记录。备份按配置周期失效。凭证丢失且会话过期时，请通过核验后的隐私渠道联系管理员，管理员需核验身份后处理，不能仅凭公开 ID 交付回答。</p>
 <p>正式上线前需核验：处理者身份、隐私联系渠道、敏感信息处理必要性、个人信息保护影响评估、第三方受托协议、域名备案、安全验收、备份及删除响应期限。当前模板不表示已经完成合规审查。</p>
 </div>;}
