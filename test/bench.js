// 性能基准：构造 N 个节点，重复跑 full / geo，输出单次耗时
// 用法：node test/bench.js [节点数] [轮次]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'substore-meta-rules-dat.js'), 'utf8');
const NODES = parseInt(process.argv[2], 10) || 300;
const ROUNDS = parseInt(process.argv[3], 10) || 30;

const samples = [
  '🇭🇰 香港 01', '🇯🇵 日本 02', '🇸🇬 狮城 03', '🇺🇸 美国 洛杉矶 04', '🇹🇼 台湾 05', '🇰🇷 韩国 06',
  '🇬🇧 英国 伦敦 07', '🇩🇪 德国 08', '🇷🇺 俄罗斯 09', '🇨🇦 加拿大 10', '🇦🇺 澳洲 11', '🇮🇳 印度 12',
  'IPLC 中转 13', '专线 14', 'SINGAPORE-15', 'RUSSIA-16', 'US-17', 'JP-18', '完美解锁 19', 'No.1 20',
  '到期: 2027-05-06', '流量: 286 GB / 400 GB'
];
const proxies = [];
for (let i = 0; i < NODES; i++) proxies.push({ name: samples[i % samples.length] + ' #' + i, type: 'ss' });

const yaml = { safeLoad: JSON.parse, dump: (o) => JSON.stringify(o) };
const cfg = {
  proxies,
  dns: { enable: true, nameserver: ['https://223.5.5.5/dns-query'] },
  hosts: { 'a.example.com': '1.2.3.4' },
  'proxy-groups': [{ name: 'Proxies', type: 'select', proxies: ['DIRECT'] }],
  rules: ['MATCH,DIRECT']
};

function run(mode) {
  const ctx = {
    $content: JSON.stringify(cfg),
    $arguments: 'mode=' + mode,
    ProxyUtils: { yaml },
    console: { log: () => {} }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { timeout: 30000 });
  return JSON.parse(ctx.$content);
}

for (const mode of ['full', 'geo']) {
  run(mode); // 预热
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ROUNDS; i++) run(mode);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`${mode.padEnd(5)} ${NODES} 节点 x ${ROUNDS} 次：${ms.toFixed(0)} ms（单次 ${(ms / ROUNDS).toFixed(2)} ms）`);
}

const out = run('full');
const ai = out['proxy-groups'].find((g) => g.name === '🤖 AI服务');
console.log(`校验：组 ${out['proxy-groups'].length} 个，规则 ${out.rules.length} 条，AI 成员 ${ai.proxies.length}，规则组 ${out['rule-providers'] ? Object.keys(out['rule-providers']).length : 0}`);
