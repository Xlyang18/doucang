# 参与与发版

这个项目主要给自己用，但欢迎提 issue 说需求、报 bug。

---

## 报 bug

开 issue 时请带上：

1. **版本号**：关于页可以看到，或 `cat ~/Library/Application\ Support/豆藏/activity.log | head -3`
2. **复现步骤**：点了哪里、期望什么、实际什么
3. **活动日志片段**：`~/Library/Application Support/豆藏/activity.log` 的尾部
4. **截图**：界面问题尽量带图

> 数据涉及个人消费记录，贴日志前请自行删掉品牌名、价格等敏感内容。

---

## 提 PR

```bash
git clone https://github.com/Xlyang18/doucang.git
cd doucang
pnpm install

# 改完提交前，这三条必须过
pnpm test      # 单元测试
pnpm smoke     # 端到端冒烟
pnpm build     # 渲染层能构建
```

### 代码约定

- **计算只写一处**：养豆窗口、状态、份数、单杯成本、余量，一律走 `src/lib/calc.js` 的 `resolveBean()`。页面里不许出现第二套算法
- **统计只写一处**：`src/lib/stats.js` 供统计页、分享卡片、Excel 共用
- **改数据结构必须走迁移**：`electron/main.mjs` 的 `migrate()`，并升 `SCHEMA_VERSION`。迁移前必须留档，读失败时绝不能用空数据覆盖原文件
- **动效遵守 `src/styles/motion.css` 的规范**：只用 `transform` / `opacity`，时长走 `--dur-*` 变量，曲线走 `--ease-*` 变量；不要 animate `width` / `height` / `top` / `left`
- **中文界面**：文案统一中文，技术术语可保留英文
- **新增计算逻辑要配测试**：`tests/` 下按模块建 `.test.mjs`

---

## 发版流程

### 一、改版本号

```bash
# 三处要同步：package.json、CHANGELOG、README 徽章
npm version 2.2.0 --no-git-tag-version
```

`package.json` 的 `version` 是唯一真源，`electron/main.mjs` 从 `app.getVersion()` 读。

### 二、写更新日志

在 `CHANGELOG.md` 顶部的 `[未发布]` 下写清楚，发版时把标题改成 `[2.2.0] - YYYY-MM-DD`。

分组用：`新增` / `变更` / `修复` / `移除` / `测试`。

### 三、跑全量测试

```bash
pnpm test && pnpm smoke && pnpm build
```

三条全绿再往下走。

### 四、打包

```bash
# 重要：必须走 npm script，它带 afterSign 钩子
pnpm dist

# 等价于
# vite build && electron-builder --mac dmg --x64 --arm64 --config.afterSign=scripts/after-sign.cjs
```

**别直接敲 `electron-builder`**。漏掉 `--config.afterSign` 时产物只有 linker-signed adhoc 签名，能打出 DMG，但**双击启动会静默挂起、没有任何报错**。

### 五、验证产物（必做）

```bash
# 1. 签名级别：必须含 flags=0x2(adhoc)
codesign -dv release/mac-arm64/豆藏.app 2>&1 | grep CodeDirectory

# 2. 挂载 DMG 实跑
hdiutil attach release/doucang-2.1.0-arm64.dmg -nobrowse -mountpoint /tmp/dcverify
open "/tmp/dcverify/豆藏.app"
sleep 10
curl -s http://127.0.0.1:47823/status   # 应返回 {"ok":true,...}

hdiutil detach /tmp/dcverify
```

第 2 步能返回 JSON，才说明主进程真的起来了。

### 六、提交并打标签

```bash
git add -A
git commit -m "release: v2.2.0"
git tag -a v2.2.0 -m "豆藏 v2.2.0"

# 推上去
git push origin main
git push origin v2.2.0
```

### 七、发 Release

```bash
gh release create v2.2.0 \
  "release/doucang-2.2.0-arm64.dmg" \
  "release/doucang-2.2.0-x64.dmg" \
  --title "豆藏 v2.2.0" \
  --notes-file /tmp/release-notes.md
```

`/tmp/release-notes.md` 内容直接从 `CHANGELOG.md` 对应版本段落复制。

> 标签名统一 `vX.Y.Z`（带 v），文件名用 `doucang-X.Y.Z-<arch>.dmg`（ASCII，中文名会被 GitHub 过滤掉字符）。

### 八、收尾

- 确认 Release 页两个 DMG 都能下载
- 把 `CHANGELOG.md` 的 `[未发布]` 重新留空
- 更新 README 里的徽章版本号

---

## 版本号怎么定

| 变更多大 | 版本号 |
|---|---|
| 只修 bug、改文案 | `2.1.0` → `2.1.1`（patch） |
| 加功能、改界面，数据兼容 | `2.1.0` → `2.2.0`（minor） |
| 改数据结构且不向下兼容、大改版 | `2.1.0` → `3.0.0`（major） |

数据结构的 `SCHEMA_VERSION` 与 `package.json` 的 `version` 是两回事：前者只在字段变了时升，后者每次发版都升。

---

## 日常开发备忘

```bash
pnpm dev                       # 构建 + 启动 Electron
pnpm preview                   # 生成 .preview/index.html，浏览器里看界面（无需启动 Electron）

# 用示例数据预览（不碰真实数据）
SEED=/path/to/data.json node scripts/make-preview.cjs

# 开发时隔离数据目录
DOUCANG_DATA_DIR=/tmp/dcdev pnpm dev
```

截图工具：`scripts/make-preview.cjs` 生成的是纯静态页，可以直接用浏览器截图，不必截 Electron 窗口。
