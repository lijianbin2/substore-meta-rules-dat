// 本地自测：用 JSON 顶替 Sub-Store 的 ProxyUtils.yaml，校验脚本逻辑
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'substore-meta-rules-dat.js'), 'utf8');

const BASE = {
  'mixed-port': 7890,
  mode: 'rule',
  'geo-auto-update': false,
  proxies: [{ name: 'HK-01', type: 'ss', server: '1.2.3.4', port: 443, cipher: 'aes-128-gcm', password: 'x' }],
  'proxy-groups': [
    { name: '🚀 节点选择', type: 'select', proxies: ['♻️ 自动选择', 'HK-01'] },
    { name: '♻️ 自动选择', type: 'url-test', proxies: ['HK-01'] },
    { name: '🎯 全球直连', type: 'select', proxies: ['DIRECT'] },
    { name: '🛑 广告拦截', type: 'select', proxies: ['REJECT', 'DIRECT'] },
    { name: '🐟 漏网之鱼', type: 'select', proxies: ['🚀 节点选择', 'DIRECT'] },
    { name: '📲 电报消息', type: 'select', proxies: ['🚀 节点选择'] },
    { name: '🎥 奈飞视频', type: 'select', proxies: ['🚀 节点选择'] },
    { name: 'Ⓜ️ 微软服务', type: 'select', proxies: ['DIRECT', '🚀 节点选择'] }
  ],
  'rule-providers': {
    Google: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Google.list', path: './ruleset/Google.list', interval: 86400 },
    Telegram: { type: 'http', behavior: 'ipcidr', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Telegram.list', path: './ruleset/Telegram.list' },
    Apple: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Apple.list', path: './ruleset/Apple.list' },
    Microsoft: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Microsoft.list', path: './ruleset/Microsoft.list' },
    Netflix: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Netflix.list', path: './ruleset/Netflix.list' },
    OpenAI: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/OpenAI.list', path: './ruleset/OpenAI.list' },
    ChinaMax: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/ChinaMax.list', path: './ruleset/ChinaMax.list' },
    AdvertisingLite: { type: 'http', behavior: 'classical', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/AdvertisingLite.list', path: './ruleset/AdvertisingLite.list' },
    Private: { type: 'http', behavior: 'ipcidr', url: 'https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Private.list', path: './ruleset/Private.list' },
    ProxyMedia: { type: 'http', behavior: 'classical', url: 'https://example.com/ProxyMedia.list', path: './ruleset/ProxyMedia.list' }
  },
  rules: [
    'DOMAIN,example.com,DIRECT',
    'RULE-SET,Private,🎯 全球直连',
    'RULE-SET,AdvertisingLite,🛑 广告拦截',
    'RULE-SET,Google,🚀 节点选择',
    'RULE-SET,Telegram,📲 电报消息,no-resolve',
    'RULE-SET,Apple,🎯 全球直连',
    'RULE-SET,Microsoft,Ⓜ️ 微软服务',
    'RULE-SET,Netflix,🎥 奈飞视频',
    'RULE-SET,OpenAI,🚀 节点选择',
    'RULE-SET,ProxyMedia,🚀 节点选择',
    'RULE-SET,ChinaMax,🎯 全球直连',
    'MATCH,🐟 漏网之鱼'
  ]
};

// 用户截图里的真实形态：ACL4SSR 风格英文组名
const EN_GROUPS = ['Proxies', 'Cloudflare', 'YouTube', 'Disney', 'Hbomax', 'Netflix', 'Bahamut', 'Bilibili',
  'Spotify', 'Steam', 'Telegram', 'Google', 'Microsoft', 'OpenAI', 'PayPal', 'Apple Push', 'Apple', 'Final',
  'HK', 'JP', 'SG', 'TW', 'US'];
const enCfg = () => ({
  proxies: [{ name: '🇭🇰 日用 专线 香港', type: 'ss' }, { name: '🇯🇵 日用 专线 日本', type: 'ss' }],
  'proxy-groups': EN_GROUPS.map((n) => ({ name: n, type: 'select', proxies: ['DIRECT'] })),
  rules: []
});

const fakeYaml = {
  safeLoad: (s) => JSON.parse(s),
  dump: (o) => JSON.stringify(o, null, 2)
};

function run(argText, cfg = JSON.parse(JSON.stringify(BASE)), logs) {
  const ctx = {
    $content: JSON.stringify(cfg),
    $arguments: argText,
    ProxyUtils: { yaml: fakeYaml },
    console: { log: (m) => { if (logs) logs.push(m); } }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { timeout: 5000 });
  return JSON.parse(ctx.$content);
}

const fails = [];
function check(name, cond, extra) {
  if (!cond) fails.push(name + (extra ? ' → ' + extra : ''));
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (cond ? '' : ' → ' + extra));
}

function invariants(tag, out) {
  const provs = out['rule-providers'] || {};
  const names = new Set(Object.keys(provs));
  (out.rules || []).forEach((r) => {
    const m = /^RULE-SET,([^,]+),/.exec(r);
    if (m) check(`${tag}: 规则集 ${m[1]} 存在`, names.has(m[1]), r);
  });
  Object.keys(provs).forEach((n) => {
    const d = provs[n];
    if (!String(n).startsWith('msd-')) {
      check(`${tag}: 保留项 ${n} 未被改动`, /^https:\/\/example\.com|ACL4SSR/.test(d.url), d.url);
      return;
    }
    check(`${tag}: ${n} 字段完整`,
      d.type === 'http' && d.format === 'yaml' && !!d.url && !!d.path && !!d.behavior, JSON.stringify(d));
    check(`${tag}: ${n} URL 指向 meta-rules-dat`, /meta-rules-dat[/@]meta\/geo\//.test(d.url), d.url);
    check(`${tag}: ${n} behavior 与目录一致`,
      (d.url.includes('/geoip/') && d.behavior === 'ipcidr') ||
      (d.url.includes('/geosite/') && d.behavior === 'domain'), d.url + ' / ' + d.behavior);
  });
  if (tag === 'strict') check(`${tag}: 无第三方残留`, !JSON.stringify(provs).includes('ACL4SSR'));
}

function assertTargets(tag, out) {
  const groups = new Set((out['proxy-groups'] || []).map((g) => g && g.name));
  (out.rules || []).forEach((r) => {
    const parts = String(r).split(',');
    const kind = parts[0].toUpperCase();
    let target = null;
    if (kind === 'RULE-SET') target = (parts[2] || '').trim();
    else if (kind === 'MATCH') target = (parts[1] || '').trim();
    if (!target) return;
    check(`${tag}: 目标 ${target} 存在`, groups.has(target) || /^(DIRECT|REJECT)$/.test(target), r);
  });
}

console.log('\n=== case 1: patch（默认）===');
const p1 = run('mode=patch');
console.log(JSON.stringify({ providers: Object.keys(p1['rule-providers']), rules: p1.rules, geox: p1['geox-url'] }, null, 2));
invariants('patch', p1);
check('patch: Google 已换成 geosite', p1.rules.includes('RULE-SET,msd-geosite-google,🚀 节点选择'), p1.rules.join(' | '));
check('patch: Telegram(ipcidr) 走 geoip 且保留 no-resolve',
  p1.rules.includes('RULE-SET,msd-geoip-telegram,📲 电报消息,no-resolve'), p1.rules.join(' | '));
check('patch: ChinaMax 拆成 geosite+geoip 两条',
  p1.rules.filter((r) => r.includes('msd-geosite-cn') || r.includes('msd-geoip-cn')).length === 2, p1.rules.join(' | '));
check('patch: 识别不了的 ProxyMedia 原样保留', p1.rules.includes('RULE-SET,ProxyMedia,🚀 节点选择'));
check('patch: DOMAIN 规则不受影响', p1.rules.includes('DOMAIN,example.com,DIRECT'));
check('patch: Private 走 geoip', !!p1['rule-providers']['msd-geoip-private']);
check('patch: geox-url 指向 release', p1['geox-url'].geoip.includes('release/geoip.dat'), JSON.stringify(p1['geox-url']));
check('patch: 旧规则集已删除', !p1['rule-providers']['Google']);

console.log('\n=== case 2: 幂等（连续跑两次 patch）===');
const p2 = run('mode=patch', JSON.parse(JSON.stringify(p1)));
check('幂等: 规则集数量不变',
  Object.keys(p2['rule-providers']).length === Object.keys(p1['rule-providers']).length);
check('幂等: rules 完全一致', JSON.stringify(p2.rules) === JSON.stringify(p1.rules));

console.log('\n=== case 3: strict + jsdelivr + geodata ===');
const p3 = run('mode=patch&strict=1&cdn=jsdelivr&geodata=1');
check('strict: ProxyMedia 已删除', !p3['rule-providers']['ProxyMedia']);
check('strict: 其规则也被移除', !p3.rules.some((r) => r.includes('ProxyMedia')));
check('jsdelivr: URL 生效',
  p3['rule-providers']['msd-geosite-google'].url.startsWith('https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/google.yaml'),
  p3['rule-providers']['msd-geosite-google'].url);
check('geodata: geodata-mode=true', p3['geodata-mode'] === true);
invariants('strict', p3);

console.log('\n=== case 4: rebuild（无 groups 参数，不动分组）===');
const p4 = run('mode=rebuild');
console.log(JSON.stringify({ groups: p4['proxy-groups'].map((g) => g.name), rules: p4.rules }, null, 2));
invariants('rebuild', p4);
check('rebuild: 分组命中（电报/奈飞/微软/广告/漏网之鱼）',
  p4.rules.includes('RULE-SET,msd-geosite-telegram,📲 电报消息') &&
  p4.rules.includes('RULE-SET,msd-geosite-netflix,🎥 奈飞视频') &&
  p4.rules.includes('RULE-SET,msd-geosite-microsoft,Ⓜ️ 微软服务') &&
  p4.rules.includes('RULE-SET,msd-geosite-category-ads-all,🛑 广告拦截') &&
  p4.rules[p4.rules.length - 1] === 'MATCH,🐟 漏网之鱼', p4.rules.join(' | '));
check('rebuild: 旧规则集全部清空', !p4['rule-providers']['Google'] && !p4['rule-providers']['ProxyMedia']);
check('rebuild: 保留 proxies / proxy-groups', p4.proxies.length === 1 && p4['proxy-groups'].length === 8);
check('rebuild: 无 RULE-SET 重复', new Set(p4.rules).size === p4.rules.length);

console.log('\n=== case 4.5: groups=1（空配置 + 节点）===');
const bare = {
  'mixed-port': 7890,
  proxies: [{ name: 'HK-01', type: 'ss' }, { name: 'JP-01', type: 'ss' }],
  rules: []
};
const g1 = run('mode=rebuild&groups=1', bare);
const gg = Object.fromEntries(g1['proxy-groups'].map((g) => [g.name, g]));
check('groups: 生成 10 个组', g1['proxy-groups'].length === 10, g1['proxy-groups'].length);
check('groups: 组名唯一', new Set(g1['proxy-groups'].map((g) => g.name)).size === 10);
check('groups: 节点选择 → 故障转移', gg['🚀 节点选择'].type === 'select' && gg['🚀 节点选择'].proxies[0] === '🔯 故障转移');
check('groups: 故障转移是 fallback', gg['🔯 故障转移'].type === 'fallback');
check('groups: 故障转移带 url/interval',
  gg['🔯 故障转移'].url === 'http://www.gstatic.com/generate_204' && gg['🔯 故障转移'].interval === 300);
check('groups: 故障转移含全部节点', JSON.stringify(gg['🔯 故障转移'].proxies) === '["HK-01","JP-01"]',
  JSON.stringify(gg['🔯 故障转移'].proxies));
check('groups: AI 是 fallback 且只留非香港节点',
  gg['🤖 AI服务'].type === 'fallback' && JSON.stringify(gg['🤖 AI服务'].proxies) === '["JP-01"]',
  JSON.stringify(gg['🤖 AI服务']));
check('groups: AI 组紧跟故障转移下面',
  g1['proxy-groups'].map((g) => g.name).indexOf('🤖 AI服务') ===
  g1['proxy-groups'].map((g) => g.name).indexOf('🔯 故障转移') + 1,
  g1['proxy-groups'].map((g) => g.name).join(' | '));
assertTargets('groups', g1);

console.log('\n=== case 4.55: 地区识别（AI 排除 HK + 未知地区）===');
const regionNodes = [
  '🇭🇰 HK-01', '香港 02', '深港专线',
  '🇯🇵 JP-01', 'US-03', 'RUSSIA-01', 'SINGAPORE-01', '英国 伦敦', '🇹🇼 TW-01',
  'IPLC 01', '01', '未知线路', '完美解锁 01', 'No.1 01', 'No.1 香港 02'
].map((n) => ({ name: n, type: 'ss' }));
const g5 = run('mode=rebuild&groups=1', { proxies: regionNodes, rules: [] });
const ai = g5['proxy-groups'].find((g) => g.name === '🤖 AI服务');
const aiNames = ai.proxies;
console.log('AI服务 nodes:', JSON.stringify(aiNames));
check('region: AI 类型是 fallback', ai.type === 'fallback');
check('region: 香港三种写法都被排除', !aiNames.some((n) => /HK-01|香港|深港/.test(n)), aiNames.join(' | '));
check('region: 未知地区被排除',
  !aiNames.includes('IPLC 01') && !aiNames.includes('01') && !aiNames.includes('未知线路'));
check('region: RUSSIA 没被 US 误吞', aiNames.includes('RUSSIA-01'));
check('region: SINGAPORE 没被 IN 误吞', aiNames.includes('SINGAPORE-01'));
check('region: 日本/美国/台湾/英国保留',
  ['🇯🇵 JP-01', 'US-03', '🇹🇼 TW-01', '英国 伦敦'].every((n) => aiNames.includes(n)), aiNames.join(' | '));
check('region: AI 节点数量正确', aiNames.length === 6, '实际 ' + aiNames.length + ' 个');
check('region: 「完美解锁」没被单字「美」误判', !aiNames.some((n) => n.includes('完美')));
check('region: 「No.1 01」没被当成挪威', !aiNames.includes('No.1 01'));
check('region: 「No.1 香港 02」仍判为香港', !aiNames.includes('No.1 香港 02'));
const g6 = run('mode=rebuild&groups=1&ai_exclude=HK,TW', { proxies: regionNodes, rules: [] });
const ai6 = g6['proxy-groups'].find((g) => g.name === '🤖 AI服务').proxies;
check('region: ai_exclude=HK,TW 生效', !ai6.some((n) => /TW-01/.test(n)) && ai6.length === 5, ai6.join(' | '));

console.log('\n=== case 4.6: groups=1（已有同名组不覆盖 / 幂等）===');
const partial = {
  proxies: [{ name: 'HK-01', type: 'ss' }],
  'proxy-groups': [{ name: '🚀 节点选择', type: 'select', proxies: ['DIRECT'] }],
  rules: []
};
const g2 = run('mode=rebuild&groups=1', JSON.parse(JSON.stringify(partial)));
check('groups: 已有同名组内容不变',
  g2['proxy-groups'].find((g) => g.name === '🚀 节点选择').proxies.join() === 'DIRECT');
check('groups: 只补缺的 9 个', g2['proxy-groups'].length === 10, g2['proxy-groups'].length);
const g2b = run('mode=rebuild&groups=1', JSON.parse(JSON.stringify(g2)));
check('groups: 重复执行不重复建组', g2b['proxy-groups'].length === 10, g2b['proxy-groups'].length);

console.log('\n=== case 4.7: groups=1（只有 proxy-providers）===');
const provOnly = {
  proxies: [],
  'proxy-providers': { airport: { type: 'http', url: 'https://example.com/sub', path: './proxy_providers/airport.yaml', interval: 3600 } },
  rules: []
};
const g3 = run('mode=rebuild&groups=1', provOnly);
const gg3 = Object.fromEntries(g3['proxy-groups'].map((g) => [g.name, g]));
check('groups: 用 use 引用 provider', JSON.stringify(gg3['🚀 节点选择'].use) === '["airport"]');
check('groups: 故障转移也走 use', JSON.stringify(gg3['🔯 故障转移'].use) === '["airport"]');
check('groups: AI 组走 use + filter', JSON.stringify(gg3['🤖 AI服务'].use) === '["airport"]' &&
  typeof gg3['🤖 AI服务'].filter === 'string', JSON.stringify(gg3['🤖 AI服务']));
check('groups: AI filter 排除香港、保留日本',
  !/香港|HKG/.test(gg3['🤖 AI服务'].filter) && /日本/.test(gg3['🤖 AI服务'].filter), gg3['🤖 AI服务'].filter);

console.log('\n=== case 4.8: groups=1（一个节点都没有）===');
const g4 = run('mode=rebuild&groups=1', { proxies: [], rules: [] });
const gg4 = Object.fromEntries(g4['proxy-groups'].map((g) => [g.name, g]));
check('groups: 无节点时故障转移兜底 DIRECT', JSON.stringify(gg4['🔯 故障转移'].proxies) === '["DIRECT"]');
check('groups: 无节点时 AI 不空', gg4['🤖 AI服务'].proxies.length > 0, JSON.stringify(gg4['🤖 AI服务']));

console.log('\n=== case 4.95: 机场自带的 dns / tun / sniffer 必须原样保留 ===');
const airport = JSON.parse(JSON.stringify(BASE));
airport.dns = {
  enable: true, ipv6: false, 'enhanced-mode': 'fake-ip', 'fake-ip-range': '198.18.0.1/16',
  'fake-ip-filter': ['+.lan', '*.example.com', 'rule-set:msd-geosite-cn'],
  nameserver: ['https://223.5.5.5/dns-query', 'https://doh.pub/dns-query'],
  fallback: ['https://1.1.1.1/dns-query', 'tls://8.8.4.4:853'],
  'nameserver-policy': { 'geosite:cn': 'https://223.5.5.5/dns-query', 'www.example.com': 'system' },
  'default-nameserver': ['223.5.5.5', '119.29.29.29']
};
airport.tun = { enable: true, stack: 'mixed', 'auto-route': true, 'dns-hijack': ['any:53'] };
airport.sniffer = { enable: true, 'parse-pure-ip': true, 'force-dns-mapping': true };
airport.profile = { 'store-selected': true, 'store-fake-ip': true };
airport.hosts = { 'router.lan': '192.168.1.1' };
airport['proxy-providers'] = {
  sub1: { type: 'http', url: 'https://airport.example.com/sub', path: './proxy_providers/sub1.yaml', interval: 3600 }
};
airport['geox-url'] = { geoip: 'https://airport.example.com/geoip.dat', asn: 'https://airport.example.com/asn.mmdb' };

const snap = (o) => JSON.stringify(o);
['patch', 'rebuild'].forEach((mode) => {
  const o = run('mode=' + mode + '&groups=1', JSON.parse(JSON.stringify(airport)));
  check(`preserve(${mode}): dns 完全一致`, snap(o.dns) === snap(airport.dns), snap(o.dns).slice(0, 200));
  check(`preserve(${mode}): tun 完全一致`, snap(o.tun) === snap(airport.tun));
  check(`preserve(${mode}): sniffer 完全一致`, snap(o.sniffer) === snap(airport.sniffer));
  check(`preserve(${mode}): profile 完全一致`, snap(o.profile) === snap(airport.profile));
  check(`preserve(${mode}): hosts 完全一致`, snap(o.hosts) === snap(airport.hosts));
  check(`preserve(${mode}): proxy-providers 完全一致`, snap(o['proxy-providers']) === snap(airport['proxy-providers']));
  check(`preserve(${mode}): proxies 完全一致`, snap(o.proxies) === snap(airport.proxies));
  check(`preserve(${mode}): geox-url.asn 保留`, o['geox-url'].asn === 'https://airport.example.com/asn.mmdb');
  check(`preserve(${mode}): geox-url.geoip 换成 meta-rules-dat`, o['geox-url'].geoip.includes('meta-rules-dat'));
});

console.log('\n=== case 6: mode=geo（中文组名配置，不建组）===');
const GEO_BASE = [
  'DOMAIN,cpa.wisdamsatan.de,DIRECT',
  'DOMAIN-SUFFIX,bingsoft.net,DIRECT',
  'DOMAIN-SUFFIX,war.gov,🚀 节点选择',
  'RULE-SET,cn,DIRECT',
  'GEOSITE,category-ads-all,🛑 广告拦截',
  'GEOSITE,private,DIRECT',
  'GEOSITE,category-ai-!cn,🚀 节点选择',
  'GEOSITE,youtube,🚀 节点选择',
  'GEOSITE,google,🚀 节点选择',
  'GEOSITE,twitter,🚀 节点选择',
  'GEOSITE,pixiv,🚀 节点选择',
  'GEOSITE,category-scholar-!cn,🚀 节点选择',
  'GEOSITE,biliintl,🚀 节点选择',
  'GEOSITE,onedrive,DIRECT',
  'GEOSITE,microsoft@cn,DIRECT',
  'GEOSITE,apple-cn,DIRECT',
  'GEOSITE,steam@cn,DIRECT',
  'GEOSITE,category-games@cn,DIRECT',
  'GEOSITE,geolocation-!cn,🚀 节点选择',
  'GEOSITE,cn,DIRECT',
  'GEOIP,private,DIRECT,no-resolve',
  'GEOIP,telegram,📲 电报消息',
  'GEOIP,JP,🚀 节点选择',
  'GEOIP,CN,DIRECT',
  'DST-PORT,80/8080/443/8443,🚀 节点选择',
  'MATCH,DIRECT'
];
const ge = run('mode=geo');
const geDiff = GEO_BASE.filter((r, i) => ge.rules[i] !== r);
check('geo: 目标落到已有组（节点选择/广告拦截/电报消息）', geDiff.length === 0, '不一致: ' + JSON.stringify(geDiff));
check('geo: 没建新组', ge['proxy-groups'].length === 8, ge['proxy-groups'].length);
check('geo: 清空无用规则集', Object.keys(ge['rule-providers']).length === 0);
check('geo: 强制 geodata-mode', ge['geodata-mode'] === true);
check('geo: geox-url 指向 meta-rules-dat',
  ge['geox-url'].geosite.includes('meta-rules-dat') && ge['geox-url'].geoip.includes('meta-rules-dat'));
assertTargets('geo', ge);

const geStrict = run('mode=geo&strict=1');
check('geo: strict=1 删掉缺规则集的 RULE-SET,cn', !geStrict.rules.some((r) => r.startsWith('RULE-SET,')));

console.log('\n=== case 6.1: mode=geo&groups=1（中文组名，缺的才建）===');
const GEO_CREATED = [
  'DOMAIN,cpa.wisdamsatan.de,DIRECT',
  'DOMAIN-SUFFIX,bingsoft.net,DIRECT',
  'DOMAIN-SUFFIX,war.gov,🤖 AI服务',
  'RULE-SET,cn,DIRECT',
  'GEOSITE,category-ads-all,🛑 广告拦截',
  'GEOSITE,private,DIRECT',
  'GEOSITE,category-ai-!cn,🤖 AI服务',
  'GEOSITE,youtube,🎥 国际媒体',
  'GEOSITE,google,🚀 节点选择',
  'GEOSITE,twitter,🐦 社交平台',
  'GEOSITE,pixiv,🎥 国际媒体',
  'GEOSITE,category-scholar-!cn,📚 学术资源',
  'GEOSITE,biliintl,🎥 国际媒体',
  'GEOSITE,onedrive,DIRECT',
  'GEOSITE,microsoft@cn,DIRECT',
  'GEOSITE,apple-cn,DIRECT',
  'GEOSITE,steam@cn,DIRECT',
  'GEOSITE,category-games@cn,DIRECT',
  'GEOSITE,geolocation-!cn,🚀 节点选择',
  'GEOSITE,cn,DIRECT',
  'GEOIP,private,DIRECT,no-resolve',
  'GEOIP,telegram,📲 电报消息',
  'GEOIP,JP,🚀 节点选择',
  'GEOIP,CN,DIRECT',
  'DST-PORT,80/8080/443/8443,🚀 节点选择',
  'MATCH,DIRECT'
];
const gm = run('mode=geo&groups=1');
const gmDiff = GEO_CREATED.filter((r, i) => gm.rules[i] !== r);
check('geo+groups: 规则逐条映射正确', gmDiff.length === 0, '不一致: ' + JSON.stringify(gmDiff));
check('geo+groups: 只补 4 个组', gm['proxy-groups'].length === 12, gm['proxy-groups'].length);
check('geo+groups: AI 排在国际媒体之前',
  gm['proxy-groups'].map((g) => g.name).indexOf('🤖 AI服务') <
  gm['proxy-groups'].map((g) => g.name).indexOf('🎥 国际媒体'),
  gm['proxy-groups'].map((g) => g.name).join(' | '));
assertTargets('geo+groups', gm);

console.log('\n=== case 6.2: mode=geo（你截图里的英文组名）===');
const en = run('mode=geo', enCfg());
console.log(en.rules.join('\n'));
check('geo-en: 主组落到 Proxies', en.rules.includes('GEOSITE,geolocation-!cn,Proxies'));
check('geo-en: AI 落到 OpenAI', en.rules.includes('GEOSITE,category-ai-!cn,OpenAI'));
check('geo-en: youtube→YouTube', en.rules.includes('GEOSITE,youtube,YouTube'));
check('geo-en: google→Google', en.rules.includes('GEOSITE,google,Google'));
check('geo-en: biliintl→Bilibili', en.rules.includes('GEOSITE,biliintl,Bilibili'));
check('geo-en: telegram→Telegram', en.rules.includes('GEOIP,telegram,Telegram'));
check('geo-en: 没有广告组就用 REJECT', en.rules.includes('GEOSITE,category-ads-all,REJECT'));
check('geo-en: 一个组都没新建', en['proxy-groups'].length === EN_GROUPS.length, en['proxy-groups'].length);
check('geo-en: 不再有 PROXY 字面量', !en.rules.some((r) => /,PROXY$/.test(r)), en.rules.join(' | '));
assertTargets('geo-en', en);

const en2 = run('mode=geo&groups=1', enCfg());
check('geo-en+groups: 只补 3 个（媒体/学术/社交）', en2['proxy-groups'].length === EN_GROUPS.length + 3,
  en2['proxy-groups'].length);
check('geo-en+groups: AI 仍复用 OpenAI', en2.rules.includes('GEOSITE,category-ai-!cn,OpenAI'));
check('geo-en+groups: twitter 进社交平台', en2.rules.includes('GEOSITE,twitter,🐦 社交平台'));
check('geo-en+groups: pixiv 进国际媒体', en2.rules.includes('GEOSITE,pixiv,🎥 国际媒体'));
assertTargets('geo-en2', en2);

const en3 = run('mode=geo', enCfg());
check('geo-en: 幂等', JSON.stringify(en3.rules) === JSON.stringify(en.rules));

console.log('\n=== case 6.4: mode=geo（已有 cn 规则集 / 已有 PROXY）===');
const withCn = JSON.parse(JSON.stringify(BASE));
withCn['rule-providers'].cn = { type: 'http', behavior: 'domain', url: 'https://example.com/cn.yaml', path: './ruleset/cn.yaml' };
const ge3 = run('mode=geo', withCn);
check('geo: 有 cn 规则集时保留该行', ge3.rules.includes('RULE-SET,cn,DIRECT'));
check('geo: 同时保留被引用的规则集', !!ge3['rule-providers'].cn);
check('geo: 未被引用的规则集被清掉', !ge3['rule-providers'].Google);

const noMain = { proxies: [{ name: 'HK-01', type: 'ss' }], 'proxy-groups': [], rules: [] };
const ge4 = run('mode=geo', noMain);
check('geo: 没有任何组时建 PROXY', ge4['proxy-groups'].some((g) => g.name === 'PROXY'), JSON.stringify(ge4['proxy-groups'].map((g) => g.name)));
check('geo: 同时建故障转移', ge4['proxy-groups'].some((g) => g.name === '🔯 故障转移'));
check('geo: 规则目标都落到 PROXY', ge4.rules.includes('DST-PORT,80/8080/443/8443,PROXY'));
assertTargets('geo-nogroup', ge4);

console.log('\n=== case 8: mode=full（整份配置重写）===');
const FULL_EXPECT = [
  'DOMAIN,cpa.wisdamsatan.de,DIRECT',
  'DOMAIN-SUFFIX,bingsoft.net,DIRECT',
  'DOMAIN-SUFFIX,war.gov,🤖 AI服务',
  'GEOSITE,category-ads-all,🛑 广告拦截',
  'GEOSITE,private,DIRECT',
  'GEOSITE,category-ai-!cn,🤖 AI服务',
  'GEOSITE,youtube,🎥 国际媒体',
  'GEOSITE,google,PROXY',
  'GEOSITE,twitter,🐦 社交平台',
  'GEOSITE,pixiv,🎥 国际媒体',
  'GEOSITE,category-scholar-!cn,📚 学术资源',
  'GEOSITE,biliintl,🎥 国际媒体',
  'GEOSITE,onedrive,DIRECT',
  'GEOSITE,microsoft@cn,DIRECT',
  'GEOSITE,apple-cn,DIRECT',
  'GEOSITE,steam@cn,DIRECT',
  'GEOSITE,category-games@cn,DIRECT',
  'GEOSITE,geolocation-!cn,PROXY',
  'GEOSITE,cn,DIRECT',
  'GEOIP,private,DIRECT,no-resolve',
  'GEOIP,telegram,📲 电报消息',
  'GEOIP,JP,PROXY',
  'GEOIP,CN,DIRECT',
  'DST-PORT,80/8080/443/8443,PROXY',
  'MATCH,DIRECT'
];
const FULL_GROUP_NAMES = ['PROXY', '🔯 故障转移', '🤖 AI服务', '🎥 国际媒体', '📚 学术资源',
  '🐦 社交平台', '📲 电报消息', '🛑 广告拦截', '🎯 全球直连'];

const fu = run('mode=full');
check('full: 规则逐条正确', JSON.stringify(fu.rules) === JSON.stringify(FULL_EXPECT),
  JSON.stringify(fu.rules.filter((r, i) => FULL_EXPECT[i] !== r)));
check('full: 组名固定且顺序正确',
  JSON.stringify(fu['proxy-groups'].map((g) => g.name)) === JSON.stringify(FULL_GROUP_NAMES),
  fu['proxy-groups'].map((g) => g.name).join(' | '));
check('full: PROXY 含全部节点', fu['proxy-groups'][0].proxies.includes('HK-01'));
check('full: 故障转移是 fallback 且带探测',
  fu['proxy-groups'][1].type === 'fallback' && fu['proxy-groups'][1].url === 'http://www.gstatic.com/generate_204');
check('full: AI 组不含香港节点', !fu['proxy-groups'][2].proxies.includes('HK-01'),
  JSON.stringify(fu['proxy-groups'][2]));

const fuMix = run('mode=full', {
  proxies: [{ name: 'HK-01', type: 'ss' }, { name: 'JP-01', type: 'ss' }, { name: 'IPLC 01', type: 'ss' }],
  rules: []
});
const fuAi = fuMix['proxy-groups'].find((g) => g.name === '🤖 AI服务');
check('full: AI 是 fallback 且只留非香港/非未知节点',
  fuAi.type === 'fallback' && JSON.stringify(fuAi.proxies) === '["JP-01"]', JSON.stringify(fuAi));

const fuInfo = run('mode=full', {
  proxies: [
    { name: '到期: 2027-05-06', type: 'anytls' },
    { name: '流量: 286.77 GB / 400 GB', type: 'anytls' },
    { name: '🇭🇰 香港 01', type: 'ss' },
    { name: '🇯🇵 日本 01', type: 'ss' }
  ],
  rules: []
});
const fuInfoAi = fuInfo['proxy-groups'].find((g) => g.name === '🤖 AI服务').proxies;
check('full: 信息假节点不进 AI 组', !fuInfoAi.some((n) => /到期|流量/.test(n)), fuInfoAi.join(' | '));
check('full: 信息假节点不污染地区判断（GB 不被当英国）',
  JSON.stringify(fuInfoAi) === '["🇯🇵 日本 01"]', fuInfoAi.join(' | '));
check('full: 信息假节点仍保留在 proxies 里', fuInfo.proxies.length === 4);
check('full: 信息假节点也不进故障转移？—— 按需求保留在其它组',
  fuInfo['proxy-groups'][1].proxies.some((n) => /流量|到期/.test(n)),
  fuInfo['proxy-groups'][1].proxies.join(' | '));
check('full: 不再有 rule-providers 字段', fu['rule-providers'] === undefined);
check('full: geodata-mode 打开', fu['geodata-mode'] === true);
check('full: proxies 未被动过', fu.proxies.length === BASE.proxies.length);
assertTargets('full', fu);

const fuEn = run('mode=full', enCfg());
check('full: 不依赖原组名（英文配置输出相同组）',
  JSON.stringify(fuEn['proxy-groups'].map((g) => g.name)) === JSON.stringify(FULL_GROUP_NAMES));
check('full: 不依赖原组名（规则相同）', JSON.stringify(fuEn.rules) === JSON.stringify(FULL_EXPECT));

const fuPreserve = run('mode=full', (() => {
  const c = JSON.parse(JSON.stringify(BASE));
  c.dns = { enable: true, nameserver: ['https://223.5.5.5/dns-query'], 'fake-ip-filter': ['+.lan'] };
  c.hosts = { 'cncgzbgp01.169cdn-agent.com': 'c79983ae.169cdn-agent.com' };
  c.tun = { enable: true, stack: 'mixed' };
  c.sniffer = { enable: true };
  c['external-controller'] = '127.0.0.1:9090';
  c['mixed-port'] = 9999;
  return c;
})());
check('full: dns 原样保留', JSON.stringify(fuPreserve.dns).includes('223.5.5.5'));
check('full: hosts 原样保留', JSON.stringify(fuPreserve.hosts).includes('cncgzbgp01'), JSON.stringify(fuPreserve.hosts));
check('full: tun 被丢弃', fuPreserve.tun === undefined);
check('full: sniffer 被丢弃', fuPreserve.sniffer === undefined);
check('full: external-controller 被丢弃', fuPreserve['external-controller'] === undefined);
check('full: 端口用默认 7890（不继承机场 9999）', fuPreserve['mixed-port'] === 7890, fuPreserve['mixed-port']);
check('full: 只剩这些字段',
  JSON.stringify(Object.keys(fuPreserve).sort()) === JSON.stringify(
    ['allow-lan', 'dns', 'geo-auto-update', 'geo-update-interval', 'geodata-mode', 'geox-url', 'hosts',
     'ipv6', 'log-level', 'mixed-port', 'mode', 'proxies', 'proxy-groups', 'rules']),
  Object.keys(fuPreserve).join(','));

const fuProv = run('mode=full', {
  proxies: [],
  'proxy-providers': { airport: { type: 'http', url: 'https://example.com/sub', path: './proxy_providers/airport.yaml' } },
  rules: []
});
check('full: 只有 provider 时用 use', JSON.stringify(fuProv['proxy-groups'][0].use) === '["airport"]',
  JSON.stringify(fuProv['proxy-groups'][0]));
check('full: provider 模式没有空组', fuProv['proxy-groups'].every((g) => (g.proxies || []).length > 0 || (g.use || []).length > 0),
  JSON.stringify(fuProv['proxy-groups']));

const fuEmpty = run('mode=full', { proxies: [], rules: [] });
check('full: 零节点也能加载（组不空）',
  fuEmpty['proxy-groups'].every((g) => (g.proxies || []).length > 0), JSON.stringify(fuEmpty['proxy-groups']));

const fu2 = run('mode=full', JSON.parse(JSON.stringify(fu)));
check('full: 幂等', JSON.stringify(fu2.rules) === JSON.stringify(fu.rules) &&
  JSON.stringify(fu2['proxy-groups'].map((g) => g.name)) === JSON.stringify(FULL_GROUP_NAMES));

console.log('\n=== case 7: 参数非法 / 空输入 ===');
try { run('magic'); check('非法 mode 默认走 patch（不抛错）', true); }
catch (e) { check('非法 mode 不应抛错', false, e.message); }

let threw = false;
try {
  const ctx = { $content: '', $arguments: '', ProxyUtils: { yaml: fakeYaml }, console: { log: () => {} } };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
} catch (e) { threw = true; }
check('空内容给出明确报错', threw);

let wrongScope = '';
try {
  const ctx = {
    $content: JSON.stringify([{ name: 'HK-01', type: 'ss', server: '1.2.3.4', port: 443 }]),
    $arguments: '',
    ProxyUtils: { yaml: fakeYaml },
    console: { log: () => {} }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
} catch (e) { wrongScope = e.message; }
check('误挂到订阅上时报错清晰', /节点数组/.test(wrongScope), wrongScope);

console.log('\n' + (fails.length ? '失败 ' + fails.length + ' 项:\n' + fails.join('\n') : '全部通过'));
process.exit(fails.length ? 1 : 0);
