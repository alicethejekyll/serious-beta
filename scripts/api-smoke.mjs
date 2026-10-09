// Read-only checks: never log response bodies, cookies, tokens or answers.
import assert from 'node:assert/strict';
const input = process.argv[2];
if (!input) throw new Error('用法：pnpm test:api <实际页面原点>，例如 http://127.0.0.1:5173');
const origin = new URL(input);
const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/' ||
    !(origin.protocol === 'https:' || (origin.protocol === 'http:' && loopback))) {
  throw new Error('只接受无路径、无凭证参数的 HTTPS 原点；本机可使用 HTTP');
}
const cases = [
  ['用户页面', '/', 200, 'text/html'],
  ['管理员登录页面', '/admin', 200, 'text/html'],
  ['数据库健康检查', '/api/health', 200, 'application/json'],
  ['公开配置', '/api/meta', 200, 'application/json'],
  ['用户接口拒绝匿名读取', '/api/me', 401, 'application/json'],
  ['管理员接口拒绝匿名读取', '/api/admin/users', 401, 'application/json'],
  ['未知 API 返回 JSON 404', '/api/smoke-nonexistent', 404, 'application/json'],
];
for (const [label, path, status, type] of cases) {
  const response = await fetch(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, status, `${label} 状态不正确`);
  assert.ok(response.headers.get('content-type')?.includes(type), `${label} 响应类型不正确`);
  if (path.startsWith('/api/')) assert.match(response.headers.get('cache-control') || '', /no-store/);
  if (path === '/api/health') assert.equal((await response.json()).ok, true);
  if (path === '/api/meta') {
    const meta = await response.json();
    assert.equal(meta.name, '认真认识');
    assert.equal(meta.mock, true, '朋友测试只接受模拟信息环境');
    assert.equal(meta.aiEnabled, false);
    assert.equal(meta.matchingMode, 'manual', '匹配必须保持人工审核与授权模式');
    assert.equal(meta.accepting, true, '问卷尚未开放，需管理员发布或恢复');
    assert.equal(meta.hasPublished, true, '没有已发布问卷');
  }
  console.log(`PASS ${label} (${status})`);
}
console.log('7 项可访问性检查通过。持久化、身份隔离与完整提交验证请运行 pnpm test，并执行云端验收清单。');
