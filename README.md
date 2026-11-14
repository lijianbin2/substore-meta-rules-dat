# Sub-Store 文件脚本 · substore-meta-rules-dat.js

用 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) 给 [Sub-Store](https://github.com/sub-store-org/Sub-Store) 生成 mihomo（Clash.Meta）分流。

不依赖任何远程转换代码，规则与分组由本脚本自己产出；机场的 `dns` 与节点保持原样。

## 四种模式

| 模式 | 行为 | 适用 |
| --- | --- | --- |
| `full`（默认） | 整份配置重写：只保留机场的 `dns`、`hosts`（和节点 / `proxy-providers`），分组与规则全部生成 | 组名想自己定、规则想固定 |
| `geo` | 只替换 `rules` 为 GEOSITE/GEOIP 模板，规则目标自动适配你已有的组名（`Proxies` / `节点选择` / `YouTube` / `OpenAI` …） | 想保留机场分组，只换规则 |
| `rebuild` | 按 meta-rules-dat 分类重建 `rules` / `rule-providers`，组名按关键词匹配 | 半自动重构 |
| `patch` | 保留原分流结构，只把能识别的第三方规则集换成等价规则集 | 只想换规则源（ACL4SSR → meta-rules-dat） |

## `full` 生成的分组

```yaml
PROXY           select    故障转移 / 全球直连 / 全部节点
🔯 故障转移      fallback  全部节点（探测 generate_204，300s）
🤖 AI服务        fallback  排除香港与地区不明的节点（ai_exclude=HK,TW 可调）
🎥 国际媒体      select    PROXY / 全球直连
📚 学术资源      select    PROXY / 全球直连
🐦 社交平台      select    PROXY / 全球直连
📲 电报消息      select    PROXY / 全球直连
🛑 广告拦截      select    REJECT / DIRECT
🎯 全球直连      select    DIRECT
```

规则走 `GEOSITE` / `GEOIP`，`geox-url` 指向 meta-rules-dat 的 `release` 分支，`geodata-mode: true`。`hosts` 会原样保留——机场常用它给节点域名做地址映射，丢了可能解析不了节点。

地区识别顺序：国旗 emoji → 中文关键词 → 英文代码（按单词边界，`RUSSIA` 不会命中 `US`）。机场塞的套餐信息假节点（`到期:` / `流量:` …）不会进 AI 组。

## 用法

1. Sub-Store → 文件 → 新建 **mihomo 配置**，来源选机场订阅（或粘贴机场配置）；
2. 把脚本贴进 **「处理操作 → 脚本操作」**（`覆写` 框只认 YAML，贴脚本会报 `Implicit keys ... /**`）；
3. 保存后用文件链接拉取；首次加载会下载 `geosite.dat` / `geoip.dat`。

脚本链接方式（自动跟随本仓库更新）：

```
https://raw.githubusercontent.com/lijianbin2/substore-meta-rules-dat/main/substore-meta-rules-dat.js
```

## 参数

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `mode` | `full` | `full` / `geo` / `rebuild` / `patch`（也可改脚本顶部 `DEFAULT_MODE`） |
| `port` | `7890` | `full` 生成的 `mixed-port` |
| `cdn` | `raw` | `jsdelivr` / `ghproxy` / 任意加速前缀，替换 geodata 的下载源 |
| `ai_exclude` | `HK` | AI 组排除的地区代码，逗号分隔 |
| `ai_unknown` | `0` | 设为 `1` 时把地区不明的节点也收进 AI 组 |
| `geox` | `true` | 写 `geox-url` / `geo-auto-update` |
| `geodata` | `false` | 额外把 `geodata-mode` 设为 `true`（`geo` / `full` 会强制开启） |
| `strict` | `false` | `patch` 删掉识别不了的规则集；`geo` 删掉引用不存在规则集的那一行 |
| `groups` | `0` | `rebuild` 时补一套标准分组；`geo` 时缺失的组才新建 |

## 本地验证

需要 Node.js 18+，无第三方依赖。

```bash
node test/meta-rules-check.js
```

覆盖四种模式的规则与分组、地区识别（含 `RUSSIA` / `SINGAPORE` / `完美解锁` / `No.1` 等误判用例）、`dns` 保留与其它字段丢弃、`proxy-providers`、零节点兜底、幂等。

## 数据源

- `meta` 分支 `geo/geosite/<code>.yaml`、`geo/geoip/<code>.yaml` → `rule-provider`（`format: yaml`）
- `release` 分支 `geoip.dat` / `geosite.dat` / `country.mmdb` → `geox-url`

已核对 `steam`、`epicgames`、`xbox`、`category-games` 等分类的存在性；`geo` 模板用到的 `pixiv`、`biliintl`、`apple-cn`、`category-scholar-!cn`、`category-ai-!cn` 均已验证可访问。

## 许可

MIT