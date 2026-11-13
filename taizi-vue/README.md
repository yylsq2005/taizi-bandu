# 太子伴读 · 五彩片语广场（Vue 3 版）

> 把此刻的一点点，写在五彩的广场上。

原单文件版本（根目录 `index.html`）已通过 **TDD** 改写为 **Node.js + Vue 3 + Pinia** 工程：
数据仍然只保存在浏览器 `localStorage` 中，不上传、不请求任何服务器。

技术栈：Vue 3.5（Composition API + `<script setup lang="ts">`）、Pinia 3、Vite 6、TypeScript、Vitest 3 + Vue Test Utils 2。

---

## 功能截图

桌面端（三栏）：

![桌面端界面](screenshots/desktop.png)

移动端（390 × 844）：

![移动端界面](screenshots/mobile.png)

详情弹层：

![详情弹层](screenshots/detail.png)

---

## 功能清单

| 功能 | 说明 |
| --- | --- |
| 发布 | 多行输入框，上限 140 字；按 Unicode 码点计数，中文与 emoji 都不会被算成多个字 |
| 实时字数 | 进度条 + 「还可输入 N 字」；剩余 ≤ 20 字转琥珀色，超出变红并禁用发布 |
| 查看详情 | 卡片右下角的立体「查看」按钮，弹出详情面板：全文、字数、获赞、发布日期 |
| 点赞 | 卡片与详情面板都可点赞，爱心有弹跳反馈，状态写入本地 |
| 删除 | 详情面板内删除，触发二次确认；确认后从本地移除 |
| 搜索 | 顶部搜索框实时过滤正文；点击正文里的 #话题 或右侧热议榜也能直接搜索 |
| 排序 | 「全部」按时间倒序，「热门」按获赞排序 |
| 热议榜 | 从所有片语里的 #话题 自动统计条数，不足 5 条时用默认话题补齐 |
| 示例数据 | 首次打开写入 3 条示例片语 |
| 持久化 | localStorage 存储；多标签页通过 `storage` 事件同步 |
| 响应式 | 桌面三栏（我的 / 信息流 / 热议），平板两栏，移动端单栏 + 吸底导航 |
| 无障碍 | `aria-live` 字数播报、`role="dialog"` 弹层、Esc 关闭、焦点归位、遵循「减少动态效果」偏好 |

---

## 快速开始

```bash
cd taizi-vue
npm install
npm run dev        # 开发服务器，默认 http://localhost:5173
```

其他命令：

```bash
npm run test       # 运行全部单元 / 组件测试（Vitest + jsdom）
npm run test:watch # 监听模式
npm run build      # 类型检查（vue-tsc）+ 生产构建
npm run preview    # 预览 dist 产物
```

需要 Node.js 18+（已在 Node 22 上验证）。

---

## TDD 实践

先写测试（红），再写实现（绿），最后重构。测试按「纯逻辑 → 状态 → 组件」三层展开：

| 测试文件 | 关注点 |
| --- | --- |
| `tests/format.spec.ts` | 码点计数、相对/绝对时间、话题提取、FNV-1a 色相推导 |
| `tests/storage.spec.ts` | 数据规范化兜底、旧结构兼容、损坏数据降级、隐私模式降级、写入失败兜底 |
| `tests/feed-store.spec.ts` | 发布 / 点赞 / 删除 / 筛选 / 搜索 / 热议榜 / 统计文案 / 持久化 / 多标签重载 |
| `tests/components/PostCard.spec.ts` | 话题渲染、XSS 纯文本渲染、点赞态语义、事件上报 |
| `tests/components/ComposerCard.spec.ts` | 字数状态机、禁用规则、发布延迟、重复提交防护、快捷话题插入 |
| `tests/components/FeedView.spec.ts` | 列表渲染、两种空状态、热门排序、事件转发 |
| `tests/components/TopicsRail.spec.ts` | 热议榜排名、条数 / 待开启文案、点击搜索 |
| `tests/components/Modals.spec.ts` | 详情统计与操作事件、删除确认弹层语义 |
| `tests/components/Toast.spec.ts` | 显示 / 自动隐藏 / 连续提示重置计时 |

当前：**9 个测试文件、110 个用例全部通过**；`npm run build` 无类型错误。

---

## 目录结构

```
taizi-vue/
├── index.html                  # Vite 入口（保留原 meta / 图标 / noscript）
├── vite.config.ts              # Vite + Vitest（jsdom）配置
├── tsconfig.json
├── src/
│   ├── main.ts                 # createApp + Pinia + 全局样式
│   ├── App.vue                 # 页面骨架：顶栏 / 三栏 / 吸底导航 / 弹层 / 提示
│   ├── constants.ts            # 140 字上限、发布延迟、时间刷新间隔
│   ├── types.ts                # Post / Filter / TopicEntry / StorageLike
│   ├── assets/main.css         # 原设计系统与全部样式（响应式、3D 按钮、极光背景）
│   ├── components/
│   │   ├── LeftRail.vue        # 我的信息 + 导航
│   │   ├── ComposerCard.vue    # 发布器（字数状态机、延迟发布）
│   │   ├── FeedView.vue        # 工具条 + 时间线 + 空状态
│   │   ├── PostCard.vue        # 单条片语卡片
│   │   ├── TopicsRail.vue      # 此刻热议 + 玩法提示
│   │   ├── DetailModal.vue     # 详情弹层
│   │   ├── ConfirmModal.vue    # 删除确认弹层
│   │   └── Toast.vue           # 轻提示
│   ├── composables/
│   │   ├── toast.ts            # 模块级共享提示状态
│   │   └── ticker.ts           # 30 秒心跳，驱动相对时间刷新
│   ├── stores/feed.ts          # Pinia setup store：数据 + 筛选 + 搜索 + 统计
│   └── utils/
│       ├── format.ts           # 计数 / 时间 / 话题 / 色相
│       ├── storage.ts          # 读取、校验、写入、示例数据
│       └── clipboard.ts        # 复制（Clipboard API + execCommand 降级）
└── tests/                      # 与 src 对应的测试
```

---

## 状态与数据流

- **单一数据源**：`useFeedStore`（`stores/feed.ts`）持有 `posts`、`filter`、`keyword`；
  `visiblePosts`、`topics`、`totalLikes`、`feedLabel` 全部由 `computed` 派生。
- **组件契约**：`PostCard` 只收 `post` prop，通过 `like / view / copy / tag` 事件向上汇报；
  列表与弹层由 `App.vue` 编排，数据写入统一走 store。
- **样式与视觉**：原 `index.html` 的 CSS 完整迁移到 `assets/main.css`，类名保持一致，
  因此三栏布局、极光背景、3D 按钮、移动端吸底导航等效果与原版一致。

存储结构（键名仍为 `taizi.feed.v2`，带版本号）：

```json
{
  "version": 2,
  "posts": [
    {
      "id": "c6744657-18cf-499b-889d-b5dc657372a9",
      "content": "窗外的梧桐叶全黄了，风一吹像有人在翻书。#今日片语",
      "createdAt": 1794533206827,
      "likes": 12,
      "liked": false,
      "hue": 340
    }
  ]
}
```

读取时逐字段校验：缺 `hue` 的旧数据用 FNV-1a 从 `id` 推导色相，空内容条目直接丢弃，
损坏 JSON 降级为空列表，`localStorage` 不可用（隐私模式）时退回内存示例数据并提示。

## 安全说明

- 用户输入一律通过模板插值渲染，未使用 `v-html`，`<img onerror=...>` 等输入只会显示为纯文本。
- 仅在 `localStorage` 中保存数据，无任何网络请求、无第三方统计。

## License

MIT
