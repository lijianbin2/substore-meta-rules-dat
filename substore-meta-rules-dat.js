/**
 * Sub-Store 文件脚本 —— 用 MetaCubeX/meta-rules-dat 覆写 mihomo(Clash.Meta) 规则
 * ---------------------------------------------------------------------------
 * 数据源：https://github.com/MetaCubeX/meta-rules-dat
 *   · meta 分支  geo/geosite/<code>.yaml  +  geo/geoip/<code>.yaml   → rule-provider（format: yaml）
 *   · release 分支 geoip.dat / geosite.dat / country.mmdb            → geox-url（GEOIP / GEOSITE / MMDB）
 *
 * 用法：
 *   1. Sub-Store → 文件 → 新建 mihomo 配置
 *   2. 来源选机场订阅（或粘贴机场配置）；「覆写」留空
 *   3. 把本脚本贴进「处理操作 → 脚本操作」，保存
 *   4. 要换行为时在「脚本参数」里填 mode=patch 等（见下）
 *   默认 mode=full；想改默认值就改脚本顶部的 DEFAULT_MODE
 *
 * 参数（$arguments，支持 "k=v&k2=v2" 或 JSON 字符串）：
 *   mode=full       整份配置重写：组名和规则全写死，不依赖机场原有分组（默认）
 *                     组：PROXY / 🔯 故障转移 / 🤖 AI服务 / 🎥 国际媒体 / 📚 学术资源 / 🐦 社交平台 /
 *                         📲 电报消息 / 🛑 广告拦截 / 🎯 全球直连
 *                     只保留机场的 dns、hosts 和节点，其余字段（tun/sniffer/profile/流量统计/
 *                     原有分组与规则集…）全部丢弃，重新生成
 *   port=7890       full 模式下生成的 mixed-port
 *
 * 自定义规则：脚本顶部的 CUSTOM_RULES 会被前置到所有规则之前（优先级最高），
 * 目标写 `AI服务` 时按模式替换成真实组名（full → 🤖 AI服务，geo/rebuild → 现有 AI 组或主组）。
 * patch 模式不动你的规则，因此不插入。
 *   mode=patch      保留原分流结构，只把能识别出来的第三方规则集换成 meta-rules-dat 的等价规则集
 *   mode=rebuild    推倒重来：清空 rules / rule-providers，按 meta-rules-dat 的标准分类重建一套分流
 *   mode=geo        用内置的 GEOSITE/GEOIP 分流模板（走 geosite.dat / geoip.dat，不建规则集）：
 *                     RULE-SET,cn → 广告 REJECT → private → youtube/google/twitter/pixiv/
 *                     category-scholar-!cn/biliintl 走 PROXY → onedrive、microsoft@cn、apple-cn、
 *                     steam@cn、category-games@cn 直连 → geolocation-!cn 走 PROXY → cn 直连 →
 *                     GEOIP private/telegram/JP/CN → DST-PORT 80/443 走 PROXY → MATCH,DIRECT
 *                   会强制 geodata-mode: true（GEOIP,private 需要 dat），并保证有 PROXY 组
 *                   规则目标会自动适配你配置里的组名（Proxies / 节点选择 / Google / YouTube /
 *                   Telegram / OpenAI / Bilibili …），对不上的才退回主组；groups=1 时缺失的才新建
 *   groups=1        缺策略组时补一套标准分组（默认关闭）：
 *                     🚀 节点选择(select) → 🔯 故障转移 / 🎯 全球直连
 *                     🔯 故障转移(fallback)：全部节点
 *                     🤖 AI服务(fallback)：全部节点，但排除 ai_exclude 地区（默认香港）和地区不明的节点
 *                     🛑 广告拦截 / 🎥 流媒体 / 📲 电报消息 / Ⓜ️ 微软服务 / 🍎 苹果服务 / 🐟 漏网之鱼
 *                   已有同名组一律不动；有节点就填进组，只有 proxy-providers 时用 use + filter
 *   ai_exclude=HK   AI服务 排除的地区代码，逗号分隔，例如 HK,TW
 *   ai_unknown=1    AI服务 是否也收「地区识别不出来」的节点（默认 0，即排除）
 *   dns_policy=0    full/geo 模式不覆盖 dns.nameserver-policy（默认 true：覆盖成
 *                   geosite:cn,private,apple → doh.pub + alidns；geosite:category-ads-all → rcode://success）
 *   cdn=raw         默认。直连 raw.githubusercontent.com
 *   cdn=jsdelivr    cdn.jsdelivr.net（国内较快，实测带 ! 的分类也能取到）
 *   cdn=ghproxy     走 ghfast.top 加速
 *   cdn=<前缀>      任意加速前缀，例如 cdn=https://my-proxy.example.com/
 *   geox=0          不写 geox-url / geo-auto-update（默认 true，把 geodata 下载源锁到 meta-rules-dat）
 *   geodata=1       顺便把 geodata-mode 设为 true（用 .dat 而不是 mmdb 跑 GEOIP，默认不动）
 *   strict=1        patch：识别不了的规则集连同其规则一起删掉（默认保留，最安全）
 *                   geo：删掉「引用了不存在的规则集」的那一行（如 RULE-SET,cn）
 *   interval=86400  规则集更新间隔（秒）
 *   prefix=msd      生成的规则集名前缀，最终形如 msd-geosite-google
 *   path=./ruleset  规则集在客户端的落盘目录
 *
 * 作用域：文件脚本（$content 为 YAML 文本）。不要用在「单条订阅」的节点脚本上。
 *
 * 各模式对原配置的改动范围：
 *   full                → 只保留 dns、hosts（以及节点 / proxy-providers），其余字段全部丢弃
 *   patch/geo/rebuild   → 只改 rules / rule-providers / proxy-groups / geox-url，
 *                         dns、tun、sniffer、profile、hosts、proxy-providers 原样保留
 *                         （geox-url 只替换 geoip/geosite/mmdb 三个键，你自己加的 asn 等键保留）
 */

(function () {
  'use strict';

  // ─────────────────────────── 0. 基础工具 ───────────────────────────
  // 机场常把套餐信息塞成假节点，例如 "到期: 2027-05-06" / "流量: 286 GB / 400 GB"
  var INFO_NODE_RE = /到期|重置|获取|流量|剩余|套餐|官网|客服|欢迎|公告/;
  function isInfoNodeName(name) {
    return INFO_NODE_RE.test(String(name == null ? '' : name));
  }
  function nodeNames(proxies) {
    return (Array.isArray(proxies) ? proxies : [])
      .map(function (p) { return p && p.name; })
      .filter(Boolean);
  }
  var REPO = 'MetaCubeX/meta-rules-dat';
  var RAW = 'https://raw.githubusercontent.com/' + REPO;

  function log(msg) {
    try { console.log('[meta-rules-dat] ' + msg); } catch (e) {}
  }

  var YAML = (typeof ProxyUtils !== 'undefined' && ProxyUtils && ProxyUtils.yaml) ||
             (typeof yaml !== 'undefined' ? yaml : null) ||
             (typeof require === 'function' ? (function () {
               try { return require('js-yaml'); } catch (e) { return null; }
             })() : null);

  if (!YAML || (!YAML.dump && !JSON)) {
    throw new Error('[meta-rules-dat] 当前环境没提供 YAML 工具（ProxyUtils.yaml / yaml / js-yaml 都没有）。' +
      '如果用覆写脚本，请确认它能访问 Node 的 require；否则请改用「文件 → 脚本操作」');
  }

  // ─────────────────────────── 1. 参数 ───────────────────────────
  function parseArgs(raw) {
    if (raw === undefined || raw === null || raw === '') return {};
    if (typeof raw === 'object') return raw;
    var s = String(raw).trim();
    if (s.charAt(0) === '{') {
      try { return JSON.parse(s); } catch (e) { /* 落到 kv 解析 */ }
    }
    var out = {};
    String(s).split(/[&;]+/).forEach(function (token) {
      token = token.trim();
      if (!token) return;
      // 支持 a=1,b=2 这种用逗号连写的写法；但 ai_exclude=HK,TW 这种「值里带逗号」的要整体保留
      var pieces = token.split(',');
      var looksLikeList = pieces.length > 1 && pieces.slice(1).every(function (p) {
        return p.indexOf('=') > 0;
      });
      if (!looksLikeList) pieces = [token];
      pieces.forEach(function (kv) {
        kv = kv.trim();
        if (!kv) return;
        var i = kv.indexOf('=');
        if (i < 0) out[kv] = true;
        else out[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
      });
    });
    return out;
  }

  var A = parseArgs(typeof $arguments === 'undefined' ? null : $arguments);

  function flag(name, def) {
    if (!Object.prototype.hasOwnProperty.call(A, name)) return def;
    var v = A[name];
    if (v === true || v === 1) return true;
    return /^(1|true|yes|on)$/i.test(String(v));
  }

  function str(name, def) {
    if (!Object.prototype.hasOwnProperty.call(A, name)) return def;
    var v = A[name];
    if (v === true || v === '' || v === null) return def;
    return String(v);
  }

  // 没传 mode 参数时的默认行为（覆写脚本里通常没有参数框，就靠这里）
  var DEFAULT_MODE = 'full'; // 'full' 整份重写 / 'patch' 只换规则集 / 'geo' / 'rebuild'

  var CFG = {
    mode: str('mode', DEFAULT_MODE).toLowerCase(),
    cdn: str('cdn', 'raw').toLowerCase(),
    groups: flag('groups', false),
    geox: flag('geox', true),
    geodata: flag('geodata', false),
    strict: flag('strict', false),
    interval: parseInt(str('interval', '86400'), 10) || 86400,
    port: parseInt(str('port', '7890'), 10) || 7890,
    aiExclude: str('ai_exclude', 'HK').toUpperCase().split(/[;,\s]+/).filter(Boolean),
    aiUnknown: flag('ai_unknown', false),
    dnsPolicy: flag('dns_policy', true),
    prefix: (str('prefix', 'msd').replace(/[^\w.-]/g, '') || 'msd'),
    pathDir: str('path', './ruleset').replace(/[\\/]+$/, '')
  };

  // ─────────────────────────── 2. URL 构造 ───────────────────────────
  function ghUrl(branch, path) {
    var base = RAW + '/' + branch + '/' + path;
    var cdn = CFG.cdn;
    if (cdn === '' || cdn === 'raw' || cdn === 'github') return base;
    if (cdn === 'jsdelivr' || cdn === 'jsd') {
      return 'https://cdn.jsdelivr.net/gh/' + REPO + '@' + branch + '/' + path;
    }
    if (cdn === 'ghproxy') return 'https://ghfast.top/' + base;
    return cdn.replace(/\/+$/, '') + '/' + base; // 自建 / 任意加速前缀
  }

  function providerName(kind, code) {
    return CFG.prefix + '-' + kind + '-' + code;
  }

  function providerDef(kind, code) {
    var dir = kind === 'geoip' ? 'geoip' : 'geosite';
    return {
      type: 'http',
      behavior: kind === 'geoip' ? 'ipcidr' : 'domain',
      format: 'yaml',
      url: ghUrl('meta', 'geo/' + dir + '/' + code + '.yaml'),
      path: CFG.pathDir + '/' + providerName(kind, code) + '.yaml',
      interval: CFG.interval
    };
  }

  // ─────────────────────────── 3. 规则集名称映射 ───────────────────────────
  // 归一化：小写 + 去掉空格/符号（保留 ! 与中文），"🚀 Google-1" → "google1"
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}!]/gu, '');
  }

  var TABLE = {
    // 常用服务
    'google': { geosite: 'google' },
    'youtube': { geosite: 'youtube' },
    'netflix': { geosite: 'netflix' },
    'disney': { geosite: 'disney' },
    'disneyplus': { geosite: 'disney' },
    'spotify': { geosite: 'spotify' },
    'telegram': { geosite: 'telegram', geoip: 'telegram' },
    'tg': { geosite: 'telegram', geoip: 'telegram' },
    '电报': { geosite: 'telegram', geoip: 'telegram' },
    'twitter': { geosite: 'twitter' },
    '推特': { geosite: 'twitter' },
    'x': { geosite: 'twitter' },
    'facebook': { geosite: 'facebook' },
    '脸书': { geosite: 'facebook' },
    'instagram': { geosite: 'instagram' },
    'tiktok': { geosite: 'tiktok' },
    'apple': { geosite: 'apple' },
    '苹果': { geosite: 'apple' },
    'microsoft': { geosite: 'microsoft' },
    '微软': { geosite: 'microsoft' },
    'amazon': { geosite: 'amazon' },
    '亚马逊': { geosite: 'amazon' },
    'adobe': { geosite: 'adobe' },
    'github': { geosite: 'github' },
    'openai': { geosite: 'openai' },
    'chatgpt': { geosite: 'openai' },
    'gpt': { geosite: 'openai' },
    'ai': { geosite: 'category-ai-!cn' },
    '人工智能': { geosite: 'category-ai-!cn' },
    'paypal': { geosite: 'paypal' },
    'steam': { geosite: 'steam' },
    'bahamut': { geosite: 'bahamut' },
    '巴哈': { geosite: 'bahamut' },
    'bilibili': { geosite: 'bilibili' },
    'b站': { geosite: 'bilibili' },
    '哔哩哔哩': { geosite: 'bilibili' },
    // 地域 / 特殊分类
    'cn': { geosite: 'cn', geoip: 'cn' },
    'china': { geosite: 'cn', geoip: 'cn' },
    'chinamax': { geosite: 'cn', geoip: 'cn' },
    'mainland': { geosite: 'cn', geoip: 'cn' },
    '国内': { geosite: 'cn', geoip: 'cn' },
    '中国': { geosite: 'cn', geoip: 'cn' },
    'private': { geosite: 'private', geoip: 'private' },
    'lan': { geosite: 'private', geoip: 'private' },
    '局域网': { geosite: 'private', geoip: 'private' },
    'ads': { geosite: 'category-ads-all' },
    'adblock': { geosite: 'category-ads-all' },
    'advertising': { geosite: 'category-ads-all' },
    '广告': { geosite: 'category-ads-all' },
    'categoryadsall': { geosite: 'category-ads-all' },
    'global': { geosite: 'geolocation-!cn' },
    '国外': { geosite: 'geolocation-!cn' },
    'geolocationcn': { geosite: 'geolocation-!cn' }
  };

  // 归一化一次，按归一化后的 key 建表
  var MAP = {};
  Object.keys(TABLE).forEach(function (k) {
    MAP[norm(k)] = TABLE[k];
  });

  var MAP_KEYS = Object.keys(MAP).filter(function (k) { return k && k.length >= 4; });

  function lookup(name) {
    var k = norm(name);
    if (!k) return null;
    if (MAP[k]) return MAP[k];
    var noDigit = k.replace(/\d+$/, '');
    if (MAP[noDigit]) return MAP[noDigit];
    // 兜底：名称里包含已知关键词（只认 4 个字符以上，避免误伤）
    var best = null;
    for (var i = 0; i < MAP_KEYS.length; i++) {
      var key = MAP_KEYS[i];
      if (k.indexOf(key) >= 0 && (!best || key.length > best.length)) best = key;
    }
    return best ? MAP[best] : null;
  }

  function isManaged(name, def) {
    if (String(name).indexOf(CFG.prefix + '-') === 0) return true;
    return !!(def && typeof def.url === 'string' && def.url.indexOf('meta-rules-dat') >= 0);
  }

  // 根据旧规则集的 behavior 决定换成 geosite 还是 geoip
  // 域名类规则集（classical/domain）如果同时存在 IP 分类（cn / private / telegram），
  // 额外补一条 geoip 规则，否则纯 IP 访问会漏掉
  function planFor(name, def) {
    var hit = lookup(name);
    if (!hit) return null;
    var behavior = String((def && def.behavior) || 'classical').toLowerCase();
    var out = [];
    if (behavior === 'ipcidr') {
      if (hit.geoip) out.push({ kind: 'geoip', code: hit.geoip });
      return out.length ? out : null;
    }
    if (hit.geosite) out.push({ kind: 'geosite', code: hit.geosite });
    if (hit.geoip) out.push({ kind: 'geoip', code: hit.geoip });
    return out.length ? out : null;
  }

  // ─────────────────────────── 4. 规则改写 ───────────────────────────
  function rewriteRules(list, rename) {
    if (!Array.isArray(list)) return list;
    var out = [];
    list.forEach(function (rule) {
      if (typeof rule !== 'string') { out.push(rule); return; }
      var m = /^\s*RULE-SET\s*,\s*([^,]+?)\s*,\s*([^,]+?)\s*(?:,\s*(.+?))?\s*$/i.exec(rule);
      if (!m) { out.push(rule); return; }
      var oldName = m[1].trim();
      var target = m[2].trim();
      var extra = (m[3] || '').trim();
      if (!Object.prototype.hasOwnProperty.call(rename, oldName)) { out.push(rule); return; }

      rename[oldName].forEach(function (item) {
        var tail = '';
        if (extra) {
          var keep = extra.split(',').map(function (s) { return s.trim(); }).filter(function (s) {
            if (!s) return false;
            // no-resolve 只对 ipcidr 类规则集有意义
            if (s.toLowerCase() === 'no-resolve' && item.kind !== 'geoip') return false;
            return true;
          });
          if (keep.length) tail = ',' + keep.join(',');
        }
        out.push('RULE-SET,' + item.name + ',' + target + tail);
      });
    });
    return out;
  }

  // ─────────────────────────── 5. patch：只换规则源 ───────────────────────────
  function applyPatch(cfg) {
    var providers = cfg['rule-providers'];
    if (!providers || typeof providers !== 'object' || Array.isArray(providers)) {
      providers = cfg['rule-providers'] = {};
    }

    var rename = {};
    var replaced = 0;
    var dropped = 0;

    Object.keys(providers).forEach(function (name) {
      var def = providers[name];
      if (isManaged(name, def)) return;

      var plan = planFor(name, def);
      if (!plan) {
        if (CFG.strict) {
          delete providers[name];
          rename[name] = [];
          dropped++;
          log('strict：删除无法识别的规则集 ' + name);
        }
        return;
      }

      var created = plan.map(function (p) {
        var pn = providerName(p.kind, p.code);
        if (!providers[pn]) providers[pn] = providerDef(p.kind, p.code);
        return { name: pn, kind: p.kind };
      });

      delete providers[name];
      rename[name] = created;
      replaced++;
    });

    cfg.rules = rewriteRules(cfg.rules, rename);
    if (cfg['sub-rules'] && typeof cfg['sub-rules'] === 'object' && !Array.isArray(cfg['sub-rules'])) {
      Object.keys(cfg['sub-rules']).forEach(function (k) {
        cfg['sub-rules'][k] = rewriteRules(cfg['sub-rules'][k], rename);
      });
    }

    log('patch：替换 ' + replaced + ' 个规则集' + (dropped ? '，删除 ' + dropped + ' 个' : '') +
        '；当前共 ' + Object.keys(providers).length + ' 个，rules ' + (cfg.rules || []).length + ' 条');
    return cfg;
  }

  // ─────────────────────────── 6. groups：补齐标准策略组 + 地区识别 ───────────────────────────
  var TEST_URL = 'http://www.gstatic.com/generate_204';

  // 地区表：code = ISO 3166-1 alpha-2；cjk 按子串匹配，latin 按单词边界匹配（避免 RUSSIA 命中 US）
  var REGIONS = [
    { code: 'HK', cjk: ['香港', '深港', '沪港', '京港', '新界', '九龙', '港岛'], latin: ['HK', 'HKG', 'HONG KONG', 'HONGKONG'] },
    { code: 'TW', cjk: ['台湾', '台灣', '臺灣', '台北', '新北', '桃园', '彰化', '台中', '高雄'], latin: ['TW', 'TWN', 'TAIWAN', 'TAIPEI'] },
    { code: 'JP', cjk: ['日本', '东京', '大阪', '埼玉', '名古屋', '福冈'], latin: ['JP', 'JPN', 'JAPAN', 'TOKYO', 'OSAKA'] },
    { code: 'SG', cjk: ['新加坡', '狮城', '坡县'], latin: ['SG', 'SGP', 'SINGAPORE'] },
    { code: 'US', cjk: ['美国', '美西', '美东', '洛杉矶', '圣何塞', '硅谷', '西雅图', '达拉斯', '芝加哥', '纽约', '阿什本', '迈阿密', '波特兰', '凤凰城', '拉斯维加斯', '弗里蒙特', '盐湖城'], latin: ['US', 'USA', 'UNITED STATES', 'AMERICA', 'LAX', 'SJC', 'SEA', 'DFW', 'ORD', 'NYC', 'IAD', 'MIA', 'ASH'] },
    { code: 'KR', cjk: ['韩国', '韓國', '首尔', '春川'], latin: ['KR', 'KOR', 'KOREA', 'SEOUL'] },
    { code: 'GB', cjk: ['英国', '英國', '伦敦', '曼彻斯特'], latin: ['UK', 'GB', 'GBR', 'BRITAIN', 'ENGLAND', 'LONDON'] },
    { code: 'DE', cjk: ['德国', '德國', '法兰克福', '柏林'], latin: ['DE', 'DEU', 'GERMANY', 'FRANKFURT', 'BERLIN'] },
    { code: 'FR', cjk: ['法国', '法國', '巴黎'], latin: ['FR', 'FRA', 'FRANCE', 'PARIS'] },
    { code: 'NL', cjk: ['荷兰', '荷蘭', '阿姆斯特丹', '鹿特丹'], latin: ['NL', 'NLD', 'NETHERLANDS', 'AMSTERDAM'] },
    { code: 'RU', cjk: ['俄罗斯', '俄羅斯', '莫斯科', '圣彼得堡'], latin: ['RU', 'RUS', 'RUSSIA', 'MOSCOW'] },
    { code: 'CA', cjk: ['加拿大', '多伦多', '蒙特利尔', '温哥华'], latin: ['CA', 'CAN', 'CANADA', 'TORONTO', 'VANCOUVER'] },
    { code: 'AU', cjk: ['澳大利亚', '澳大利亞', '澳洲', '悉尼', '墨尔本'], latin: ['AU', 'AUS', 'AUSTRALIA', 'SYDNEY', 'MELBOURNE'] },
    { code: 'IN', cjk: ['印度', '孟买'], latin: ['IND', 'INDIA', 'MUMBAI'] },
    { code: 'TR', cjk: ['土耳其', '伊斯坦布尔'], latin: ['TR', 'TUR', 'TURKEY', 'ISTANBUL'] },
    { code: 'AE', cjk: ['阿联酋', '迪拜'], latin: ['AE', 'ARE', 'UAE', 'DUBAI'] },
    { code: 'BR', cjk: ['巴西', '圣保罗'], latin: ['BR', 'BRA', 'BRAZIL'] },
    { code: 'AR', cjk: ['阿根廷', '布宜诺斯艾利斯'], latin: ['AR', 'ARG', 'ARGENTINA'] },
    { code: 'MX', cjk: ['墨西哥'], latin: ['MX', 'MEX', 'MEXICO'] },
    { code: 'CH', cjk: ['瑞士', '苏黎世', '日内瓦'], latin: ['CH', 'CHE', 'SWITZERLAND', 'ZURICH'] },
    { code: 'SE', cjk: ['瑞典', '斯德哥尔摩'], latin: ['SE', 'SWE', 'SWEDEN'] },
    { code: 'NO', cjk: ['挪威'], latin: ['NOR', 'NORWAY'] },
    { code: 'FI', cjk: ['芬兰', '芬蘭', '赫尔辛基'], latin: ['FI', 'FIN', 'FINLAND'] },
    { code: 'DK', cjk: ['丹麦', '丹麥'], latin: ['DK', 'DNK', 'DENMARK'] },
    { code: 'PL', cjk: ['波兰', '波蘭', '华沙'], latin: ['PL', 'POL', 'POLAND'] },
    { code: 'IE', cjk: ['爱尔兰', '愛爾蘭', '都柏林'], latin: ['IE', 'IRL', 'IRELAND'] },
    { code: 'IT', cjk: ['意大利', '米兰', '罗马'], latin: ['ITA', 'ITALY', 'MILAN'] },
    { code: 'ES', cjk: ['西班牙', '马德里'], latin: ['ES', 'ESP', 'SPAIN', 'MADRID'] },
    { code: 'PT', cjk: ['葡萄牙', '里斯本'], latin: ['PT', 'PRT', 'PORTUGAL'] },
    { code: 'CZ', cjk: ['捷克', '布拉格'], latin: ['CZ', 'CZE', 'CZECH'] },
    { code: 'AT', cjk: ['奥地利', '奧地利', '维也纳'], latin: ['AT', 'AUT', 'AUSTRIA'] },
    { code: 'UA', cjk: ['乌克兰', '烏克蘭'], latin: ['UA', 'UKR', 'UKRAINE'] },
    { code: 'VN', cjk: ['越南', '胡志明'], latin: ['VN', 'VNM', 'VIETNAM'] },
    { code: 'TH', cjk: ['泰国', '泰國', '曼谷'], latin: ['TH', 'THA', 'THAILAND', 'BANGKOK'] },
    { code: 'MY', cjk: ['马来西亚', '馬來西亞', '吉隆坡'], latin: ['MY', 'MYS', 'MALAYSIA', 'KUALA'] },
    { code: 'ID', cjk: ['印尼', '印度尼西亚', '雅加达'], latin: ['ID', 'IDN', 'INDONESIA', 'JAKARTA'] },
    { code: 'PH', cjk: ['菲律宾', '菲律賓', '马尼拉'], latin: ['PH', 'PHL', 'PHILIPPINES', 'MANILA'] },
    { code: 'NZ', cjk: ['新西兰', '紐西蘭'], latin: ['NZ', 'NZL', 'NEW ZEALAND'] },
    { code: 'CL', cjk: ['智利'], latin: ['CL', 'CHL', 'CHILE'] },
    { code: 'IL', cjk: ['以色列'], latin: ['IL', 'ISR', 'ISRAEL'] },
    { code: 'SA', cjk: ['沙特', '利雅得'], latin: ['SAU', 'SAUDI'] },
    { code: 'EG', cjk: ['埃及'], latin: ['EG', 'EGY', 'EGYPT'] },
    { code: 'ZA', cjk: ['南非'], latin: ['ZA', 'ZAF', 'SOUTH AFRICA'] },
    { code: 'KZ', cjk: ['哈萨克'], latin: ['KZ', 'KAZ', 'KAZAKHSTAN'] },
    { code: 'CN', cjk: ['中国', '中國', '回国', '回國', '大陆', '內地', '内地'], latin: ['CN', 'CHN', 'CHINA'] }
  ];

  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 英文/数字代码按单词边界匹配，避免 RUSSIA → US、SINGAPORE → IN 这类误伤

  // 启动时把每个地区的英文关键词合并成一个正则，避免每节点每关键词都 new RegExp
  REGIONS.forEach(function (r) {
    if (!r.latin || !r.latin.length) return;
    r.latinRe = new RegExp('(?:^|[^a-z])(?:' + r.latin.map(escapeRe).join('|') + ')(?:[^a-z]|$)', 'i');
  });

  function flagOf(code) {
    return String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
  }

  function flagInName(name) {
    var m = /[\u{1F1E6}-\u{1F1FF}]{2}/u.exec(String(name));
    if (!m) return null;
    var a = m[0].codePointAt(0) - 0x1F1E6 + 65;
    var b = m[0].codePointAt(2) - 0x1F1E6 + 65;
    return String.fromCharCode(a, b);
  }

  // 返回 ISO 代码；识别不出来返回 null（= 未知地区）
  function detectRegion(name) {
    var s = String(name == null ? '' : name);
    var byFlag = flagInName(s);
    if (byFlag) return byFlag;
    for (var i = 0; i < REGIONS.length; i++) {
      var r = REGIONS[i];
      for (var j = 0; j < r.cjk.length; j++) {
        if (s.indexOf(r.cjk[j]) >= 0) return r.code;
      }
      if (r.latinRe && r.latinRe.test(s)) return r.code;
    }
    return null;
  }

  // 生成 AI 组的节点白名单：排除 ai_exclude 里的地区（默认 HK）与识别不出地区的节点
  function pickAiNodes(names) {
    var excluded = CFG.aiExclude;
    var out = [];
    names.forEach(function (n) {
      if (isInfoNodeName(n)) return; // 机场套餐信息假节点不进 AI 组
      var code = detectRegion(n);
      if (!code) {
        if (CFG.aiUnknown) out.push(n);
        return;
      }
      if (excluded.indexOf(String(code).toUpperCase()) < 0) out.push(n);
    });
    return out;
  }

  // proxy-providers 场景没法在生成阶段过滤，用 filter 正则让运行时只留非排除地区的节点
  function buildAiFilter() {
    var plain = [], latin = [];
    REGIONS.forEach(function (r) {
      if (CFG.aiExclude.indexOf(r.code) >= 0) return;
      plain.push(flagOf(r.code));
      r.cjk.forEach(function (k) { plain.push(k); });
      r.latin.forEach(function (k) { latin.push(k); });
    });
    var parts = [];
    if (plain.length) parts.push('(?i)(' + plain.map(escapeRe).join('|') + ')');
    if (latin.length) parts.push('(?i)\\b(' + latin.map(escapeRe).join('|') + ')\\b');
    return parts.join('|');
  }

  // members：固定成员；all: true 表示再把现有节点追加进来（有 proxy-providers 时同时用 use）
  var STD_GROUPS = [
    { name: '🚀 节点选择', type: 'select', members: ['🔯 故障转移', '🎯 全球直连'], all: true },
    { name: '🔯 故障转移', type: 'fallback', members: [], all: true },
    { name: '🤖 AI服务', type: 'fallback', members: [], ai: true },
    { name: '🎯 全球直连', type: 'select', members: ['DIRECT'] },
    { name: '🛑 广告拦截', type: 'select', members: ['REJECT', 'DIRECT'] },
    { name: '🎥 流媒体', type: 'select', members: ['🚀 节点选择', '🎯 全球直连'] },
    { name: '📲 电报消息', type: 'select', members: ['🚀 节点选择', '🎯 全球直连'] },
    { name: 'Ⓜ️ 微软服务', type: 'select', members: ['DIRECT', '🚀 节点选择'] },
    { name: '🍎 苹果服务', type: 'select', members: ['DIRECT', '🚀 节点选择'] },
    { name: '🐟 漏网之鱼', type: 'select', members: ['🚀 节点选择', '🎯 全球直连', 'DIRECT'] }
  ];

  function applyGroups(cfg, specs) {
    specs = Array.isArray(specs) && specs.length ? specs : STD_GROUPS;
    var existed = Array.isArray(cfg['proxy-groups']) ? cfg['proxy-groups'] : [];
    var existNames = {};
    existed.forEach(function (g) { if (g && g.name) existNames[g.name] = true; });

    var proxyNames = nodeNames(cfg.proxies);
    var useList = Object.keys(cfg['proxy-providers'] || {});
    var hasNodes = proxyNames.length > 0 || useList.length > 0;

    if (!hasNodes) {
      log('groups：配置里还没有节点，节点选择/故障转移 暂时只有 DIRECT；' +
          '请把脚本排在「从订阅添加节点」之后');
    }

    var created = [];
    specs.forEach(function (spec) {
      if (existNames[spec.name]) return;

      var members = spec.members.slice();
      var g = { name: spec.name, type: spec.type };

      // 需要按地区筛节点的组（目前只有 AI服务）
      if (spec.ai) {
        var aiNodes = pickAiNodes(proxyNames);
        g.type = 'fallback';
        g.url = TEST_URL;
        g.interval = 300;
        if (useList.length) {
          g.use = useList.slice();
          var aiFilter = buildAiFilter();
          if (aiFilter) g.filter = aiFilter;
          g.proxies = aiNodes;
        } else if (aiNodes.length) {
          g.proxies = aiNodes;
        } else {
          // 全被排除时退回可选组，否则空组会让 mihomo 起不来
          g.type = 'select';
          g.proxies = ['🚀 节点选择', '🎯 全球直连'];
          log('groups：没有「排除 ' + CFG.aiExclude.join('/') + ' 且地区可识别」的节点，AI服务 退回 select');
        }
        created.push(g);
        existNames[spec.name] = true;
        return;
      }

      if (spec.all) {
        members = members.concat(proxyNames);
        if (useList.length) g.use = useList.slice();
        if (!hasNodes) members = members.concat(['DIRECT']);
      }

      if (spec.type === 'fallback') {
        // 故障转移：只放真实节点（或 use 引用），不再挂子组
        members = proxyNames.slice();
        if (!hasNodes) members = ['DIRECT'];
        g.url = TEST_URL;
        g.interval = 300;
      }

      g.proxies = members;
      created.push(g);
      existNames[spec.name] = true;
    });

    if (!created.length) {
      log('groups：策略组已齐备，未新增');
      return cfg;
    }

    cfg['proxy-groups'] = created.concat(existed);
    log('groups：新增 ' + created.length + ' 个策略组（' +
        created.map(function (x) { return x.name; }).join('、') + '）');
    return cfg;
  }

  // ─────────────────────────── 7. rebuild：按 meta-rules-dat 重建分流 ───────────────────────────
  function applyRebuild(cfg) {
    var names = (Array.isArray(cfg['proxy-groups']) ? cfg['proxy-groups'] : [])
      .map(function (g) { return g && g.name; })
      .filter(Boolean);

    function pick(kws) {
      for (var i = 0; i < kws.length; i++) {
        var kw = kws[i].toLowerCase();
        for (var j = 0; j < names.length; j++) {
          if (names[j].toLowerCase().indexOf(kw) >= 0) return names[j];
        }
      }
      return null;
    }

    var g = {
      PROXY: pick(['节点选择', 'proxy', 'select', '手动', '自动', 'auto']) || names[0] || 'PROXY',
      DIRECT: pick(['全球直连', 'direct', '直连', '直达']) || 'DIRECT',
      REJECT: pick(['广告', '拦截', 'adblock', 'reject', '阻断']) || 'REJECT',
      AI: pick(['人工智能', 'ai', 'gpt', 'chatgpt', 'openai']),
      MEDIA: pick(['流媒体', '媒体', 'media', '奈飞', 'netflix', '影视']),
      TG: pick(['电报', 'telegram', 'tg']),
      MSFT: pick(['微软', 'microsoft']),
      APPLE: pick(['苹果', 'apple']),
      FINAL: pick(['漏网之鱼', '兜底', 'final', '其他', '默认'])
    };
    g.FINAL = g.FINAL || g.PROXY;

    function target(key) {
      return g[key] || g.PROXY;
    }

    // [类型, 分类代码, 策略组, 额外参数]
    var PLAN = [
      ['geosite', 'private', 'DIRECT'],
      ['geoip', 'private', 'DIRECT', 'no-resolve'],
      ['geosite', 'category-ads-all', 'REJECT'],
      ['geosite', 'category-ai-!cn', 'AI'],
      ['geosite', 'openai', 'AI'],
      ['geosite', 'google', 'PROXY'],
      ['geosite', 'youtube', 'MEDIA'],
      ['geosite', 'netflix', 'MEDIA'],
      ['geosite', 'disney', 'MEDIA'],
      ['geosite', 'spotify', 'MEDIA'],
      ['geosite', 'tiktok', 'MEDIA'],
      ['geosite', 'bahamut', 'MEDIA'],
      ['geosite', 'telegram', 'TG'],
      ['geoip', 'telegram', 'TG', 'no-resolve'],
      ['geosite', 'twitter', 'PROXY'],
      ['geosite', 'facebook', 'PROXY'],
      ['geosite', 'instagram', 'PROXY'],
      ['geosite', 'apple', 'APPLE'],
      ['geosite', 'microsoft', 'MSFT'],
      ['geosite', 'amazon', 'PROXY'],
      ['geosite', 'adobe', 'PROXY'],
      ['geosite', 'github', 'PROXY'],
      ['geosite', 'paypal', 'PROXY'],
      ['geosite', 'steam', 'PROXY'],
      ['geosite', 'bilibili', 'DIRECT'],
      ['geosite', 'cn', 'DIRECT'],
      ['geoip', 'cn', 'DIRECT', 'no-resolve'],
      ['geosite', 'geolocation-!cn', 'PROXY']
    ];

    var providers = {};
    var rules = [];
    PLAN.forEach(function (item) {
      var kind = item[0], code = item[1], policy = target(item[2]), extra = item[3];
      var pn = providerName(kind, code);
      if (!providers[pn]) providers[pn] = providerDef(kind, code);
      rules.push('RULE-SET,' + pn + ',' + policy + (extra ? ',' + extra : ''));
    });
    rules.push('MATCH,' + g.FINAL);

    cfg['rule-providers'] = providers;
    cfg.rules = rules;

    if (cfg['sub-rules']) {
      delete cfg['sub-rules'];
      log('rebuild：已移除 sub-rules（避免指向被删掉的旧规则集）');
    }

    log('rebuild：生成 ' + Object.keys(providers).length + ' 个规则集、' + rules.length +
        ' 条规则；分组 → ' + Object.keys(g).map(function (k) { return k + '=' + g[k]; }).join(' '));
    return cfg;
  }

  // ─────────────────────────── 8. geo：用户指定的 GEOSITE/GEOIP 分流模板 ───────────────────────────
  // 这份分流走 geosite.dat / geoip.dat（不是 rule-provider），所以不需要规则集文件
  var GEO_RULES = [
    'RULE-SET,cn,DIRECT',
    'GEOSITE,category-ads-all,REJECT',
    'GEOSITE,private,DIRECT',
    'GEOSITE,category-ai-!cn,🤖 AI服务',
    'GEOSITE,youtube,PROXY',
    'GEOSITE,google,PROXY',
    'GEOSITE,twitter,PROXY',
    'GEOSITE,pixiv,PROXY',
    'GEOSITE,category-scholar-!cn,PROXY',
    'GEOSITE,biliintl,PROXY',
    'GEOSITE,onedrive,DIRECT',
    'GEOSITE,microsoft@cn,DIRECT',
    'GEOSITE,apple-cn,DIRECT',
    'GEOSITE,steam@cn,DIRECT',
    'GEOSITE,category-games@cn,DIRECT',
    'GEOSITE,geolocation-!cn,PROXY',
    'GEOSITE,cn,DIRECT',
    'GEOIP,private,DIRECT,no-resolve',
    'GEOIP,telegram,PROXY',
    'GEOIP,JP,PROXY',
    'GEOIP,CN,DIRECT',
    'DST-PORT,80/8080/443/8443,PROXY',
    'MATCH,DIRECT'
  ];

  function applyGeo(cfg) {
    var missing = [];
    var rules = GEO_RULES.filter(function (r) {
      var m = /^\s*RULE-SET\s*,\s*([^,]+)\s*,/i.exec(r);
      if (!m) return true;
      var need = m[1].trim();
      var prov = cfg['rule-providers'] && cfg['rule-providers'][need];
      if (prov) return true;
      missing.push(need);
      return !CFG.strict; // strict 才真的删掉这一行
    });

    // 只保留仍被规则引用的规则集，其余清掉（GEOSITE/GEOIP 走 dat，用不到）
    var referenced = {};
    rules.forEach(function (r) {
      var m = /^\s*RULE-SET\s*,\s*([^,]+)\s*,/i.exec(r);
      if (m) referenced[m[1].trim()] = true;
    });
    var old = (cfg['rule-providers'] && typeof cfg['rule-providers'] === 'object') ? cfg['rule-providers'] : {};
    var kept = {};
    Object.keys(old).forEach(function (k) { if (referenced[k]) kept[k] = old[k]; });
    cfg['rule-providers'] = kept;

    cfg.rules = rules;
    // GEOIP,private 这类要用 geoip.dat，必须开 geodata-mode
    cfg['geodata-mode'] = true;

    if (cfg['sub-rules']) {
      delete cfg['sub-rules'];
      log('geo：已移除 sub-rules（旧的子规则不再适用）');
    }

    if (missing.length) {
      log('geo：规则里的 ' + missing.join('、') + ' 没有对应规则集，' +
          (CFG.strict ? '已按 strict=1 删除该行' : 'mihomo 会跳过这一行；不需要就删掉它，或加 strict=1'));
    }
    log('geo：规则 ' + rules.length + ' 条，规则集剩 ' + Object.keys(kept).length + ' 个（其余走 geosite/geoip dat）');
    return cfg;
  }

  // 这套分流需要的「角色」：优先复用配置里已有的组名，缺失时才按 groups=1 新建
  // hints 从具体到通用，命中即用（Proxies / 节点选择 / Proxy 都算主组）
  var GEO_ROLE = {
    ai: { name: '🤖 AI服务', hints: ['openai', '人工智能', 'chatgpt', 'gpt'], type: 'ai' },
    media: { name: '🎥 国际媒体', hints: ['流媒体', '媒体', 'media'], type: 'select' },
    scholar: { name: '📚 学术资源', hints: ['学术', 'scholar'], type: 'select' },
    social: { name: '🐦 社交平台', hints: ['社交', 'social', '推特'], type: 'select' }
  };

  // 规则分类 → 优先找哪个组；找不到就落到角色对应的组
  var GEO_CATEGORY = {
    'GEOSITE:category-ads-all': { hints: ['广告', 'adblock', 'ads', '拦截'], role: 'ads' },
    'GEOSITE:category-ai-!cn': { hints: ['openai', 'chatgpt', 'gpt'], role: 'ai' },
    'GEOSITE:youtube': { hints: ['youtube', '油管'], role: 'media' },
    'GEOSITE:google': { hints: ['google', '谷歌'], role: 'proxy' },
    'GEOSITE:twitter': { hints: ['twitter', '推特'], role: 'social' },
    'GEOSITE:pixiv': { hints: ['pixiv'], role: 'media' },
    'GEOSITE:biliintl': { hints: ['bilibili', '哔哩', 'b站'], role: 'media' },
    'GEOSITE:category-scholar-!cn': { hints: ['学术', 'scholar'], role: 'scholar' },
    'GEOIP:telegram': { hints: ['telegram', '电报', 'tg'], role: 'proxy' }
  };

  function geoFindGroup(names, hints) {
    for (var i = 0; i < hints.length; i++) {
      var h = String(hints[i]).toLowerCase();
      for (var j = 0; j < names.length; j++) {
        if (names[j].toLowerCase().indexOf(h) >= 0) return names[j];
      }
    }
    return null;
  }

  function buildGeoAiGroup(cfg, names) {
    var proxyNames = names || nodeNames(cfg.proxies);
    var useList = Object.keys(cfg['proxy-providers'] || {});
    var g = { name: GEO_ROLE.ai.name, type: 'fallback', url: TEST_URL, interval: 300 };
    var nodes = pickAiNodes(proxyNames);
    if (useList.length) {
      g.use = useList.slice();
      var f = buildAiFilter();
      if (f) g.filter = f;
      g.proxies = nodes;
    } else if (nodes.length) {
      g.proxies = nodes;
    } else {
      g.type = 'select';
      g.proxies = ['DIRECT'];
      log('groups：没有「排除 ' + CFG.aiExclude.join('/') + ' 且地区可识别」的节点，AI 组暂用 DIRECT');
    }
    return g;
  }

  // 把规则里的目标换成配置里真实存在的组名
  function resolveGeoTargets(cfg) {
    var groups = Array.isArray(cfg['proxy-groups']) ? cfg['proxy-groups'] : (cfg['proxy-groups'] = []);
    var names = groups.map(function (g) { return g && g.name; }).filter(Boolean);

    var proxy = geoFindGroup(names, ['proxies', 'proxy', '节点选择', '手动切换', 'select', 'global', '🚀']);
    var head = []; // 本次新建的组，统一放到最前面
    var created = [];

    if (!proxy) {
      head = head.concat(buildProxyChain(cfg));
      proxy = 'PROXY';
      created.push('PROXY');
    }

    var target = {
      proxy: proxy,
      ads: geoFindGroup(names, ['广告', 'adblock', 'ads', '拦截']) || 'REJECT'
    };
    var mapped = { PROXY: proxy, ADS: target.ads };

    Object.keys(GEO_ROLE).forEach(function (key) {
      var role = GEO_ROLE[key];
      var hit = geoFindGroup(names, role.hints);
      if (!hit && CFG.groups) {
        var g = role.type === 'ai'
          ? buildGeoAiGroup(cfg)
          : { name: role.name, type: 'select', proxies: [proxy, 'DIRECT'] };
        head.push(g);
        names.push(g.name);
        hit = g.name;
        created.push(g.name);
      }
      target[key] = hit || proxy;
      mapped[key.toUpperCase()] = target[key];
    });

    // 新建组的展示顺序：PROXY → 故障转移 → AI → 媒体 → 学术 → 社交
    var order = ['PROXY', '🔯 故障转移', '🤖 AI服务', '🎥 国际媒体', '📚 学术资源', '🐦 社交平台'];
    head.sort(function (a, b) {
      var ia = order.indexOf(a.name), ib = order.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    if (head.length) cfg['proxy-groups'] = head.concat(groups);

    cfg.rules = cfg.rules.map(function (r) {
      var parts = r.split(',');
      var kind = String(parts[0] || '').trim().toUpperCase();
      var code = String(parts[1] || '').trim();
      if (parts[2] === undefined) return r;
      var spec = GEO_CATEGORY[kind + ':' + code];
      if (spec) {
        parts[2] = geoFindGroup(names, spec.hints) || target[spec.role] || proxy;
      } else if (String(parts[2]).trim().toUpperCase() === 'PROXY') {
        parts[2] = proxy;
      }
      return parts.join(',');
    });

    log('geo：目标映射 ' + Object.keys(mapped).map(function (k) {
      return k + '→' + mapped[k];
    }).join('，') + (created.length ? '；新建 ' + created.join('、') : '；未新建任何组'));
    return cfg;
  }

  // 规则里用的是 PROXY / DIRECT / REJECT，DI/RE 是内置策略，PROXY 得是真实策略组
  // 返回需要新建的组（不改 cfg），由调用方决定摆放位置
  function buildProxyChain(cfg) {
    var existed = Array.isArray(cfg['proxy-groups']) ? cfg['proxy-groups'] : [];
    var names = {};
    existed.forEach(function (g) { if (g && g.name) names[g.name] = true; });

    if (names['PROXY']) {
      log('groups：已有 PROXY 组，保持不变');
      return [];
    }

    var proxyNames = nodeNames(cfg.proxies);
    var useList = Object.keys(cfg['proxy-providers'] || {});
    var created = [];

    if (!names['🔯 故障转移']) {
      var fb = { name: '🔯 故障转移', type: 'fallback', proxies: proxyNames.slice(), url: TEST_URL, interval: 300 };
      if (useList.length) fb.use = useList.slice();
      if (!proxyNames.length && !useList.length) fb.proxies = ['DIRECT'];
      created.push(fb);
    }

    var sel = { name: 'PROXY', type: 'select', proxies: ['🔯 故障转移'].concat(proxyNames) };
    if (useList.length) sel.use = useList.slice();
    if (!proxyNames.length && !useList.length) {
      sel.proxies = ['🔯 故障转移', 'DIRECT'];
      log('groups：配置里还没有节点，PROXY 暂时只有 DIRECT；请把脚本排在「从订阅添加节点」之后');
    }
    created.push(sel);

    log('groups：新建 ' + created.map(function (x) { return x.name; }).join('、') + '，规则里的 PROXY 指向它');
    return created;
  }

  // ─────────────────────────── 9. full：整份配置重写（组名/规则全写死）───────────────────────────
  // 组名是自带的，所以不依赖机场原有的分组；dns/tun/sniffer 等仍原样保留
  var FULL_GROUPS = [
    { name: 'PROXY', type: 'select', members: ['🔯 故障转移', '🎯 全球直连'], all: true },
    { name: '🔯 故障转移', type: 'fallback', all: true },
    { name: '🤖 AI服务', type: 'ai' },
    { name: '🎥 国际媒体', type: 'select', members: ['PROXY', '🎯 全球直连'] },
    { name: '📚 学术资源', type: 'select', members: ['PROXY', '🎯 全球直连'] },
    { name: '🐦 社交平台', type: 'select', members: ['PROXY', '🎯 全球直连'] },
    { name: '📲 电报消息', type: 'select', members: ['PROXY', '🎯 全球直连'] },
    { name: '🛑 广告拦截', type: 'select', members: ['REJECT', 'DIRECT'] },
    { name: '🎯 全球直连', type: 'select', members: ['DIRECT'] }
  ];

  // DNS 策略：整块覆盖保留下来的 dns.nameserver-policy（其它 dns 字段不动）
  var DNS_POLICY = {
    'geosite:cn,private,apple': [
      'https://doh.pub/dns-query',
      'https://dns.alidns.com/dns-query'
    ],
    'geosite:category-ads-all': 'rcode://success'
  };

  function applyDnsPolicy(cfg) {
    if (!CFG.dnsPolicy) return cfg;
    // patch / rebuild 承诺「dns 一个字符都不动」，所以只在这两种重写模式里覆盖
    var m = CFG.mode;
    if (m !== 'full' && m !== 'rewrite' && m !== 'geo' && m !== 'rules' && m !== 'geosite') return cfg;
    if (!cfg.dns || typeof cfg.dns !== 'object') {
      log('dns：原配置没有 dns，跳过 nameserver-policy');
      return cfg;
    }
    var before = cfg.dns['nameserver-policy'] && typeof cfg.dns['nameserver-policy'] === 'object'
      ? Object.keys(cfg.dns['nameserver-policy']).length : 0;
    var np = {};
    Object.keys(DNS_POLICY).forEach(function (k) { np[k] = DNS_POLICY[k]; });
    cfg.dns['nameserver-policy'] = np; // 整块覆盖，不保留机场原有 policy
    log('dns：覆盖 nameserver-policy' + (before ? '（丢弃机场原有 ' + before + ' 个键）' : '') +
        ' → ' + Object.keys(DNS_POLICY).join(' / '));
    return cfg;
  }

  // 自定义规则：优先于 GEOSITE/GEOIP 生效，目标写 AI服务 时按模式替换成真实组名
  var CUSTOM_RULES = [
    'DOMAIN,cpa.wisdamsatan.de,DIRECT',
    'DOMAIN-SUFFIX,bingsoft.net,DIRECT',
    'DOMAIN-SUFFIX,war.gov,AI服务'
  ];

  function prependCustomRules(cfg, aiTarget) {
    var extra = CUSTOM_RULES.map(function (r) {
      return r.replace(/,AI服务$/, ',' + (aiTarget || '🤖 AI服务'));
    });
    cfg.rules = extra.concat(cfg.rules || []);
    log('rules：前置 ' + extra.length + ' 条自定义规则（AI 目标 = ' + (aiTarget || '🤖 AI服务') + '）');
    return cfg;
  }

  // 当前配置里 AI 组的真实名字；找不到就退回主组，绝不返回不存在的组
  function currentAiTarget(cfg) {
    var names = (Array.isArray(cfg['proxy-groups']) ? cfg['proxy-groups'] : [])
      .map(function (g) { return g && g.name; }).filter(Boolean);
    if (names.indexOf(GEO_ROLE.ai.name) >= 0) return GEO_ROLE.ai.name;
    return geoFindGroup(names, GEO_ROLE.ai.hints) ||
           geoFindGroup(names, ['proxies', 'proxy', '节点选择', '手动切换', 'select', 'global', '🚀']) ||
           'DIRECT';
  }

  var FULL_RULES = [
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

  function applyFull(cfg) {
    var proxyNames = nodeNames(cfg.proxies);
    var useList = Object.keys(cfg['proxy-providers'] || {});
    var hasNodes = proxyNames.length > 0 || useList.length > 0;

    if (!hasNodes) {
      log('full：配置里没有节点，也没有 proxy-providers；组里先用 DIRECT 占位，' +
          '请把脚本排在「从订阅添加节点」之后，或让文件来源选订阅');
    }

    var groups = FULL_GROUPS.map(function (spec) {
      if (spec.type === 'ai') {
        var ai = buildGeoAiGroup(cfg, proxyNames);
        if (!ai.proxies || !ai.proxies.length) ai.proxies = ['DIRECT'];
        return ai;
      }
      var g = { name: spec.name, type: spec.type };
      var members = (spec.members || []).slice();
      if (spec.all) members = members.concat(proxyNames);
      if (spec.type === 'fallback') {
        members = proxyNames.slice();
        g.url = TEST_URL;
        g.interval = 300;
      }
      if (useList.length) g.use = useList.slice();
      if (!members.length && !useList.length) members = ['DIRECT'];
      g.proxies = members;
      return g;
    });

    // 只保留机场的 dns / hosts，其余字段全部丢弃，重新生成一份干净配置
    var out = {
      'mixed-port': CFG.port,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      ipv6: false
    };
    if (cfg.dns !== undefined) out.dns = cfg.dns;
    if (cfg.hosts !== undefined) out.hosts = cfg.hosts; // 机场常用 hosts 给节点域名做映射，必须保留
    out['geodata-mode'] = true; // GEOSITE/GEOIP 走 dat
    if (useList.length) out['proxy-providers'] = cfg['proxy-providers'];
    out.proxies = Array.isArray(cfg.proxies) ? cfg.proxies : [];
    out['proxy-groups'] = groups;
    out.rules = FULL_RULES.slice();

    Object.keys(cfg).forEach(function (k) { delete cfg[k]; });
    Object.keys(out).forEach(function (k) { cfg[k] = out[k]; });

    prependCustomRules(cfg, '🤖 AI服务');

    var keptFields = [cfg.dns !== undefined ? 'dns' : '', cfg.hosts !== undefined ? 'hosts' : '']
      .filter(Boolean).join('、');
    log('full：重建配置 → 组 ' + groups.length + ' 个、规则 ' + cfg.rules.length + ' 条、节点 ' +
        proxyNames.length + ' 个' + (useList.length ? ' + provider ' + useList.length + ' 个' : '') +
        '；保留 ' + (keptFields || '（无 dns/hosts）') + '，其余全新建');
    return cfg;
  }

  // ─────────────────────────── 10. geox：把 geodata 下载源锁到 meta-rules-dat ───────────────────────────
  function applyGeox(cfg) {
    if (!CFG.geox) return cfg;
    var geox = (cfg['geox-url'] && typeof cfg['geox-url'] === 'object') ? cfg['geox-url'] : {};
    geox.geoip = ghUrl('release', 'geoip.dat');
    geox.geosite = ghUrl('release', 'geosite.dat');
    geox.mmdb = ghUrl('release', 'country.mmdb');
    cfg['geox-url'] = geox;

    cfg['geo-auto-update'] = true;
    if (cfg['geo-update-interval'] === undefined) cfg['geo-update-interval'] = 24;
    if (CFG.geodata) cfg['geodata-mode'] = true;
    log('geox：geoip/geosite/mmdb 已指向 meta-rules-dat release 分支');
    return cfg;
  }

  // ─────────────────────────── 11. 读写 ───────────────────────────
  function readInput() {
    var raw = null;
    if (typeof $content !== 'undefined' && $content !== null && $content !== '') raw = $content;
    else if (typeof $files !== 'undefined' && $files && $files.length) raw = $files[0];
    else if (typeof $config !== 'undefined' && $config) raw = $config;   // 覆写脚本环境
    else if (typeof config !== 'undefined' && config) raw = config;      // Sparkle 风格

    if (raw === null || raw === undefined) {
      throw new Error('[meta-rules-dat] 没拿到文件内容：$content 与 $files 都是空的');
    }
    if (typeof raw === 'string') {
      var obj = tryParseYaml(raw);
      if (!obj || typeof obj !== 'object') {
        throw new Error('[meta-rules-dat] 解析出来不是 YAML 对象，请确认脚本挂在 mihomo 配置文件上');
      }
      return { value: obj, isString: true };
    }
    return { value: raw, isString: false };
  }

  function writeOutput(input, cfg) {
    var text = YAML.dump ? YAML.dump(cfg) : YAML.safeDump(cfg);
    var value = input.isString ? text : cfg;

    // 兼容不同运行环境：文件脚本看 $content，覆写脚本/Node 风格看返回值或 module.exports
    if (typeof $content !== 'undefined') $content = value;
    if (typeof module !== 'undefined' && module && module.exports !== undefined) module.exports = value;
    if (typeof $config !== 'undefined') $config = value;
    return value;
  }

  // 内容看起来像脚本而不是 YAML（多半是贴错框了）
  function looksLikeScript(text) {
    return /^\s*(\/\*|\/\/|\*|\(function|\(async|async function|function\s|\$\{|const |let |var )/.test(text) &&
      !/^\s*[\w-]+\s*:/.test(text);
  }

  function tryParseYaml(text) {
    try {
      return YAML.safeLoad ? YAML.safeLoad(text) : YAML.load(text);
    } catch (e) {
      if (looksLikeScript(text)) {
        throw new Error('[meta-rules-dat] 当前处理的内容是一段 JS 脚本，不是 YAML 配置。' +
          '脚本要贴在「脚本操作」框里；「覆写」框和「内容」框只能放 YAML。');
      }
      throw new Error('[meta-rules-dat] YAML 解析失败：' + (e && e.message));
    }
  }

  // ─────────────────────────── 12. main ───────────────────────────
  log('启动：mode=' + CFG.mode + (CFG.groups ? '&groups=1' : '') + '，开始读取文件内容');

  var input = readInput();
  var cfg = input.value;

  if (Array.isArray(cfg)) {
    throw new Error('[meta-rules-dat] 拿到的是节点数组，说明脚本被挂在了订阅/节点上；' +
      '请挂到「文件 → mihomo 配置 → 脚本操作」');
  }

  if (!cfg || typeof cfg !== 'object') {
    throw new Error('[meta-rules-dat] 配置为空，无法处理');
  }

  if (CFG.mode === 'rebuild' || CFG.mode === 'reset') {
    // 先补组，rebuild 才能把规则落到新组上
    if (CFG.groups) applyGroups(cfg);
    applyRebuild(cfg);
    prependCustomRules(cfg, currentAiTarget(cfg));
  } else if (CFG.mode === 'geo' || CFG.mode === 'rules' || CFG.mode === 'geosite') {
    applyGeo(cfg);
    // 规则里的 PROXY / 中文组名 → 换成你配置里真实存在的组
    resolveGeoTargets(cfg);
    prependCustomRules(cfg, currentAiTarget(cfg));
  } else if (CFG.mode === 'full' || CFG.mode === 'rewrite') {
    applyFull(cfg);
  } else {
    applyPatch(cfg);
    if (CFG.groups) applyGroups(cfg);
  }

  applyDnsPolicy(cfg);
  applyGeox(cfg);

  // full 是重建，其余模式只改 rules/rule-providers/proxy-groups/geox-url
  if (CFG.mode === 'full' || CFG.mode === 'rewrite') {
    log('输出字段：' + Object.keys(cfg).join('、'));
  } else {
    var untouched = [];
    ['dns', 'tun', 'sniffer', 'profile', 'experimental', 'hosts', 'proxy-providers'].forEach(function (k) {
      if (cfg[k] !== undefined) untouched.push(k);
    });
    if (untouched.length) log('原样保留：' + untouched.join('、'));
  }

  writeOutput(input, cfg);
})();
