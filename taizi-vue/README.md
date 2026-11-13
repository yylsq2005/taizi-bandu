# 太子伴读 · 五彩片语广场（Vue 3 + Hono 版）

> 把此刻的一点点，写在五彩的广场上。

本项目以 **TDD** 方式从单文件 `index.html` 演进为前后端分离工程：

- 前端：Vue 3.5（Composition API + `<script setup lang="ts">`）+ Pinia 3 + Vite 6 + TypeScript
- 后端：**Hono 4 + @hono/node-server**，RESTful API + **内存存储**（进程重启即重置）
- 测试：Vitest 3 + Vue Test Utils 2，**11 个测试文件，覆盖前后端**（用例数不写死，随功能演进）

原先写在浏览器 `localStorage` 里的片语，现在全部由后端内存仓储提供；前端不再向浏览器本地写入任何数据。

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
| 发布 | 多行输入框，上限 140 字（按 Unicode 码点计数）；`POST /api/posts` 落库到服务端内存 |
| 实时字数 | 进度条 + 「还可输入 N 字」；剩余 ≤ 20 字转琥珀色，超出变红并禁用发布 |
| 查看详情 | 卡片右下角的立体「查看」按钮，弹出详情面板：全文、字数、获赞、收藏、发布日期 |
| 点赞 | 独立接口 `POST /api/posts/:id/like`；卡片与详情面板都可点赞，先乐观更新，再用服务端返回校正，失败自动回滚 |
| 收藏 | 独立接口 `POST /api/posts/:id/favorite`；卡片与详情面板的星形按钮一键收藏/取消，与点赞各自独立计数，收藏后卡片徽标变琥珀金 |
| 删除 | 详情面板内删除，二次确认；服务端返回成功后才从列表移除 |
| 搜索 | 顶部搜索框实时过滤正文；点击正文里的 #话题 或右侧热议榜也能直接搜索 |
| 排序 | 「全部」按时间倒序，「热门」按获赞排序，「收藏」只看已收藏（`GET /api/posts?favorited=true`） |
| 热议榜 | 从所有片语里的 #话题 自动统计条数，不足 5 条时用默认话题补齐 |
| 示例数据 | 服务启动时写入 3 条示例片语 |
| 持久化 | 服务端**内存**存储；浏览器刷新、切标签页都不会丢，进程重启后回到示例数据 |
| 多端一致 | 窗口重新可见（`visibilitychange`）时自动重新拉取列表 |
| 错误反馈 | 接口失败统一转成中文轻提示，发布失败保留草稿 |
| 响应式 | 桌面三栏（我的 / 信息流 / 热议），平板两栏，移动端单栏 + 吸底导航 |
| 无障碍 | `aria-live` 字数播报、`role="dialog"` 弹层、`aria-pressed` 表达点赞/收藏状态、Esc 关闭、焦点归位、遵循「减少动态效果」偏好 |

---

## 快速开始

```bash
cd taizi-vue
npm install
npm run dev        # 同时启动 API（8787）与前端（5173）
```

打开 http://localhost:5173 即可；Vite 会把 `/api` 代理到 `http://127.0.0.1:8787`。

其他命令：

```bash
npm run dev:api    # 只启动 Hono（tsx watch）
npm run dev:web    # 只启动 Vite
npm run test       # 运行全部测试（前端 jsdom + 后端 node 环境）
npm run test:watch # 监听模式
npm run build      # 类型检查（vue-tsc，含 server/）+ 生产构建
npm run start      # 以非 watch 模式启动 API
```

需要 Node.js 18+（已在 Node 22 上验证）。可用 `PORT` 覆盖 API 端口，或用 `API_TARGET` 覆盖 Vite 代理目标。

---

## RESTful API

Base：`/api`，响应均为 JSON（204 除外）。错误统一为 `{ "error": { "code": string, "message": string } }`。

| 方法 | 路径 | 请求体 | 成功响应 |
| --- | --- | --- | --- |
| GET | `/api/health` | — | 200 `{ status: 'ok', posts: number }` |
| GET | `/api/posts?sort=newest\|hot&q=<关键词>&favorited=true` | — | 200 `{ posts: Post[] }` |
| GET | `/api/posts/:id` | — | 200 `Post` |
| POST | `/api/posts` | `{ content: string }` | 201 `Post` |
| POST | `/api/posts/:id/like` | 空 body 或 `{ liked: boolean }` | 200 `Post` |
| POST | `/api/posts/:id/favorite` | 空 body 或 `{ favorited: boolean }` | 200 `Post` |
| PATCH | `/api/posts/:id` | `{ content?: string, liked?: boolean, favorited?: boolean }` | 200 `Post` |
| DELETE | `/api/posts/:id` | — | 204，空 body |

- 校验：`content` 必须是字符串，`trim()` 后非空且 ≤ 140 个 Unicode 码点，否则 400 `VALIDATION_ERROR`
- 点赞：`POST /api/posts/:id/like`，不传 body 即切换，传 `{ liked: boolean }` 即显式设置（幂等）；`likes` 随之 ± 1，最小 0
- 收藏：`POST /api/posts/:id/favorite`，语义与点赞一致（不传 body 切换 / 传 `favorited` 幂等设置）；`favorites` 与 `likes` 各自独立计数
- 兼容：`PATCH /api/posts/:id` 仍支持 `content` / `liked`，并新增 `favorited`
- 筛选：`favorited=true` 只返回已收藏的片语，可与 `sort`、`q` 叠加
- 排序：`newest`（默认）按 `createdAt` 倒序；`hot` 按 `likes` 倒序，并列按时间倒序；非法 `sort` 退回 `newest`
- 搜索：`q` 对正文做大小写不敏感子串过滤，空串不过滤
- 不存在：404 `NOT_FOUND`（含未匹配路由）；未捕获异常：500 `INTERNAL_ERROR`

`Post`：

```json
{
  "id": "4b8cfd25-843a-46c5-8af7-e16ae12f07d4",
  "content": "窗外的梧桐叶全黄了，风一吹像有人在翻书。#今日片语",
  "createdAt": 1794551724272,
  "likes": 1,
  "liked": true,
  "favorites": 3,
  "favorited": false,
  "hue": 158
}
```

`id` / `createdAt` / `hue` 均由服务端生成：色相从 `[340, 268, 205, 158, 35, 12, 300]` 按已有条数轮转，保持「一条一色」。

---

## TDD 实践

先写测试（红），再写实现（绿），最后重构。测试按「纯逻辑 → 网络层 → 状态 → 组件」四层展开：

| 测试文件 | 关注点 |
| --- | --- |
| `server/store.spec.ts` | 内存仓储：种子数据、色相轮转、码点校验、点赞 / 收藏联动与幂等、实例隔离 |
| `server/app.spec.ts` | API 契约：状态码、错误结构、排序 / 搜索 / 收藏筛选、校验边界、404/204 |
| `tests/api-client.spec.ts` | 请求 URL / 方法 / body、`ApiError` 映射、204 不解析、网络中断兜底 |
| `tests/feed-store.spec.ts` | 载入、发布、乐观点赞 / 收藏及回滚、删除、筛选搜索、热议榜、错误清理 |
| `tests/format.spec.ts` | 码点计数、相对 / 绝对时间、话题提取、FNV-1a 色相推导 |
| `tests/components/ComposerCard.spec.ts` | 字数状态机、发布成功 / 失败分支、重复提交防护、快捷话题 |
| `tests/components/FeedView.spec.ts` | 列表渲染、空状态、热门 / 收藏筛选、事件转发与点赞 / 收藏委派 |
| `tests/components/TopicsRail.spec.ts` | 热议榜排名、条数 / 待开启文案、点击搜索 |
| `tests/components/PostCard.spec.ts` | 话题渲染、XSS 纯文本渲染、点赞 / 收藏态语义、事件上报 |
| `tests/components/Modals.spec.ts` | 详情四项统计与操作事件、删除确认弹层语义 |

当前：**11 个测试文件全部通过**（前端 jsdom + 后端 node 两套环境，用例数随功能演进）；`npm run build` 无类型错误（`server/**` 一并纳入类型检查）。

后端测试文件首行标注 `// @vitest-environment node`，与前端 jsdom 环境共存于同一套 Vitest 配置。

---

## 目录结构

```
taizi-vue/
├── index.html                  # Vite 入口（保留原 meta / 图标 / noscript）
├── vite.config.ts              # Vite + Vitest + /api 开发代理
├── tsconfig.json
├── server/                     # Hono 后端
│   ├── index.ts                # Node 入口（@hono/node-server）
│   ├── app.ts                  # 路由、校验、错误结构
│   ├── store.ts                # 内存仓储（种子数据、排序、搜索）
│   ├── app.spec.ts
│   └── store.spec.ts
├── src/
│   ├── main.ts                 # createApp + Pinia + 全局样式
│   ├── App.vue                 # 页面骨架：顶栏 / 三栏 / 吸底导航 / 弹层 / 提示
│   ├── constants.ts            # 140 字上限、发布延迟、时间刷新、默认话题
│   ├── types.ts                # Post / Filter / TopicEntry
│   ├── api/client.ts           # RESTful 客户端 + ApiError
│   ├── assets/main.css         # 设计系统与全部样式
│   ├── components/             # LeftRail / ComposerCard / FeedView / PostCard / …
│   ├── composables/            # toast / ticker
│   ├── stores/feed.ts          # Pinia store：数据 + 筛选 + 搜索 + 统计
│   └── utils/                  # format / clipboard
└── tests/                      # 与 src 对应的前端测试
```

---

## 状态与数据流

- **服务端是唯一数据源**：`server/store.ts` 内的内存仓储持有全部片语，`server/app.ts` 暴露 RESTful 接口。
- **客户端只做展示层派生**：`useFeedStore` 持有 `posts`、`filter`、`keyword`、`loading`、`error`；
  `visiblePosts`、`topics`、`totalLikes`、`favoriteCount`、`feedLabel` 全部由 `computed` 派生，搜索/排序/收藏筛选在本地即时完成，不额外打请求。
- **写操作走接口**：
  - `publish` 先在本地校验（空/超长直接返回中文提示，不发请求），成功后把服务端返回的 `Post` 插到首位；
  - `toggleLike` 先乐观更新，再用 `POST /api/posts/:id/like` 的返回值校正，失败回滚到原值；
  - `toggleFavorite` 同理走 `POST /api/posts/:id/favorite`，与点赞互不影响；
  - `removePost` 等 `DELETE` 成功后才从列表移除。
- **错误出口唯一**：任何失败都写入 `store.error`，`App.vue` 监听后用轻提示播报并清空。
- **组件契约**：`PostCard` 只收 `post` prop，通过 `like / favorite / view / copy / tag` 事件向上汇报，数据写入统一走 store。

## 安全说明

- 用户输入一律通过模板插值渲染，未使用 `v-html`，`<img onerror=...>` 等输入只会显示为纯文本。
- 服务端在写入前做类型、长度与字段校验，错误以固定结构返回，不泄露内部异常细节。
- 无第三方统计、无外部请求；前后端只通过同源 `/api` 通信。

## 数据说明

片语保存在 API 进程的内存中：刷新页面、切换标签页都不会丢，**重启服务即恢复为 3 条示例数据**。
浏览器 `localStorage` 已完全不再使用（验收时 `localStorage` 键列表为空）。

## License

MIT
