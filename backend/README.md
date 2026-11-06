# ICPPC 2026 Conference Interaction System — Backend

ICPPC 2026 大会互动系统后端，基于 NestJS + Prisma + SQLite，为 Vue3 H5 前端提供
REST API、Socket.io 实时广播，并与前端共享同一套问题/身份契约。

## 技术栈

- [NestJS 11](https://nestjs.com/)（Express 平台）
- [Prisma 6](https://www.prisma.io/) + SQLite（WAL 模式）
- Socket.io（`/ws` 命名空间，`newAnswer` / `checkin` 事件）
- `class-validator` / `class-transformer` 参数校验
- `@nestjs/throttler` 全局兜底限流 + 业务层冷却
- Swagger（`/api/docs`）
- Jest（单元测试 + e2e，含 `socket.io-client` 广播断言）

## 目录结构

```
backend/
├── prisma/
│   ├── schema.prisma          # Question / Answer / Institution
│   ├── seed.ts                # 8 问 + seed-data/institutions.json 机构数据
│   ├── seed-data/
│   │   └── institutions.json  # 清洗产物（72 家机构）
│   └── migrations/
├── scripts/
│   ├── clean-institutions.ts  # Excel → seed-data 清洗脚本（tsx）
│   └── parse-domain-words.ts  # 词表清单.docx → src/wordcloud 的 3 个词典文件（tsx）
├── src/
│   ├── main.ts                # 启动、全局前缀 /api、CORS、IoAdapter、Swagger
│   ├── app.module.ts          # 根模块（Config、Throttler、全局守卫）
│   ├── config/                # 配置映射与 env 校验
│   ├── common/                # 常量、DTO、过滤器、工具
│   ├── prisma/                # PrismaService（WAL pragma + 生命周期钩子）
│   ├── health/                # GET /api/health
│   ├── questions/             # GET /api/questions
│   ├── institutions/          # GET /api/institutions（筛选/分页/双语标签）
│   ├── answers/               # POST /api/answer（校验 → 冷却 → 落库 → 广播）
│   ├── realtime/              # AnswersGateway（/ws，screens 房间）
│   └── wordcloud/             # 词云统计（保护性分词 → jieba → 还原 → 归一）
│       ├── domain-words.txt   # 词表（生成物）
│       ├── synonyms.json      # 原词 → 归一目标词（生成物）
│       └── terms.json         # 任意写法 → 词条（生成物）
└── test/                      # e2e 测试 + jest 配置
```

## 环境变量

复制 `.env.example` 为 `.env`，关键项：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | 相对 `prisma/schema.prisma` |
| `PORT` | `3000` | HTTP 端口 |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | 逗号分隔白名单（REST + WS） |
| `ANSWER_COOLDOWN_MS` | `30000` | 同 `clientIp + questionId` 提交冷却 |
| `ANSWER_RATE_LIMIT` / `ANSWER_RATE_TTL_MS` | `20` / `60000` | 每 `IP + 身份` 限流 |
| `GLOBAL_RATE_LIMIT` / `GLOBAL_RATE_TTL_MS` | `120` / `60000` | 全局兜底（按 IP） |
| `SCREEN_TOKEN` | （空） | 大屏客户端握手 token（可选） |
| `SWAGGER_ENABLED` | `true` | 是否启用 `/api/docs` |

## 安装与运行

```bash
cd backend
npm install                          # postinstall 会自动执行 prisma generate
npx prisma migrate dev --name init   # 首次会创建 dev.db 并执行 seed
npm run start:dev                    # http://localhost:3000/api
```

> 若 npm 官方源较慢，可追加 `--registry=https://registry.npmmirror.com`。

### 依赖安装后必须能生成 Prisma Client（重要）

`src` 里对 `@prisma/client` 的类型（`Prisma.InstitutionWhereInput`、`Prisma.JsonValue` 等）直接依赖
`prisma generate` 的产物。如果生成失败，`node_modules/.prisma/client` 只会留下一份 **stub**
（`index.d.ts` 里 `PrismaClient: any`），表现为：

```text
src/institutions/institutions.service.ts(3,23): error TS2305: Module '"@prisma/client"' has no exported member 'Institution'.
src/institutions/institutions.service.ts(14,32): error TS2694: ... has no exported member 'JsonValue'.
...
Error: @prisma/client did not initialize yet. Please run "prisma generate" and try to import it again.
```

本项目已内置三层自愈，正常情况下不会复现：

| 触发时机 | 脚本 | 作用 |
| --- | --- | --- |
| `npm install` / `npm ci` 之后 | `postinstall` → `scripts/prisma-postinstall.mjs` | 显式补跑 `prisma generate`；`--omit=dev` 缺 `prisma` CLI 时只告警不中断安装；会清理过期（>10 分钟）的 `@prisma/engines/download-lock` |
| `npm run start:dev` 之前 | `prestart:dev` → `prisma generate` | 切换到别的分支 / 拉了新 schema 后自动同步 Client |
| `npm run build` 之前 | `prebuild` → `prisma generate` | 保证 `dist` 与 schema 一致 |

排障命令：

```bash
npx prisma generate                    # 手动生成
npx prisma -v                          # 会补齐缺失的 query/schema engine
ls node_modules/.prisma/client         # 正常应包含 index.d.ts（约 200KB）与 query_engine-*.*
```

若引擎下载被中断（`node_modules/@prisma/engines/download-lock` 残留、`query_engine-*` 缺失）：

```bash
rm -f node_modules/@prisma/engines/download-lock
npm rebuild @prisma/engines prisma @prisma/client   # 或直接重跑 npm install
npx prisma generate
```

### Node / npm 版本说明

- 仓库内 `.nvmrc` 固定 Node 22，`package.json` 声明 `"engines": { "node": ">=20.19 <23" }`；
  已验证可用组合为 **Node 22 + npm 10.9.x**。
- **npm ≥ 11 默认拦截「依赖包」的 install/postinstall 脚本**，需要在 `package.json` 的
  `allowScripts` 中批准（本项目已按包名批准 `@prisma/client`、`@prisma/engines`、`prisma`、
  `esbuild`、`@scarf/scarf`）。
  - 注意不要写死版本号（如 `"prisma@6.19.3": true`）：依赖一升级，key 匹配不上，脚本会被**静默**
    拦截，于是又回到“Client 未生成”的状态。确需锁版本时，升级后必须重跑
    `npm install-scripts approve`。
  - 常用命令：`npm install-scripts ls`（查看未批准的脚本）、`npm install-scripts approve --all`、
    `npm install-scripts prune`。批准之后**必须再执行一次 `npm install` 或 `npm rebuild`**，
    否则被跳过的脚本不会补跑。
- npm 10.x 不认 `allowScripts` 字段（也不拦截依赖脚本）；但**切换 npm / Node 版本本身不会补跑
  已跳过的脚本**，node_modules 可能停留在“半安装”状态。遇到这种情况执行
  `npx prisma generate`（或删掉 `node_modules` 重新 `npm ci`）即可。


## 服务器部署与数据初始化

`prisma/*.db` 被 `.gitignore` 忽略，**服务器上的数据库不会随代码同步**。只拉代码 + 构建
不建表不播种时，`GET /api/questions` 返回空数组，`POST /api/answer` 会返回：

```json
{ "statusCode": 404, "message": "题目不存在或已下线", "error": "Not Found" }
```

首次部署（或重建数据库后）务必在服务器执行：

```bash
cd backend
npm ci                        # 含 devDependencies：seed 依赖 tsx，构建依赖 prisma CLI
                              # postinstall 会自动 prisma generate（见上一节）
npx prisma generate           # 兜底：服务器 npm ≥11 拦脚本 / 安装被中断时也不会漏
npx prisma migrate deploy     # 建表/应用迁移，不写入数据
npm run prisma:seed           # 写入 8 道题目、服务标签与机构数据（可重复执行）
npm run build && npm run start:prod
```

也可以一条命令完成迁移 + 播种：

```bash
npm run prisma:deploy
```

### 部署检查清单（务必逐条确认）

Prisma Client / 引擎属于**平台相关**产物：Windows 上的 `query_engine-windows.dll.node`
在 Linux 上不可用。所以：

1. **不要**把本地（尤其 Windows）的 `node_modules`、`dist`、`build` 拷贝到服务器，必须在服务器上
   `npm ci`。镜像/CI 里可以缓存 `~/.npm`，但不要缓存 `node_modules`。
2. `ls node_modules/@prisma/engines/*.node`（Linux 为 `libquery_engine-*.so.node`）应存在，
   且 `ls node_modules/.prisma/client` 里有 `index.d.ts`（约 200KB）与 `query_engine-*`。
3. `npx prisma migrate status` 输出 `Database schema is up to date!`。
4. `curl -s http://127.0.0.1:3000/api/health` → `{"status":"ok","db":"up"}`；
   `curl -s http://127.0.0.1:3000/api/questions` → 8 条题目。

快速自检脚本（一条命令验证 Client 是否真的初始化了）：

```bash
node -e "const {PrismaClient}=require('@prisma/client');new PrismaClient().\$disconnect().then(()=>console.log('prisma client OK'))"
```

### 生产环境运行方式

```bash
# PM2（注意 cwd 必须是 backend/：dist/main.js 依赖同目录 .env 的 dotenv 加载）
pm2 start dist/main.js --name icppc-api --cwd /srv/icppc/backend
pm2 save && pm2 startup
```

- 生产建议把 `DATABASE_URL` 写成绝对路径（如 `file:/srv/icppc/data/prod.db`），避免依赖工作目录。
- 每次发版固定流程：`git pull` → `npm ci` → `npx prisma migrate deploy`（有新迁移时）→
  `npm run build` → `pm2 restart icppc-api`。
- 若服务器 npm ≥ 11 且安装日志出现 `blocked install scripts`：先
  `npm install-scripts approve --all && npm install`，或直接依赖 `npx prisma generate` 兜底。
- 回滚：`prisma migrate deploy` 只前进不回滚，回滚代码前请先备份 `*.db`（WAL 模式下需同时
  停进程或执行 `PRAGMA wal_checkpoint(TRUNCATE)`，避免 `-wal` 文件遗漏导致数据丢失）。

> 应用启动时若检测到 `Question` 表为空或不可用，会在日志中输出错误提示，便于快速定位。

## API 端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查（含 DB 探活） |
| `GET` | `/api/questions` | 返回八问裸数组（`QuestionCard` 结构，带 ETag / Cache-Control） |
| `GET` | `/api/institutions` | 机构全量列表（裸数组），支持 `type`(`ward`/`clinic`)、`province`、`keyword` 叠加筛选；含 `address` / `description` / `descriptionEn` |
| `GET` | `/api/institutions/stats` | 机构统计 `{ totalInstitutions, litInstitutions, litProvinces, litCities }` |
| `GET` | `/api/institutions/checked-in` | 已点亮（`isLit = true`）机构，供大屏初始化发光状态 |
| `POST` | `/api/answer` | 提交答题，请求体 `{ questionId, identityTag, answer }` |
| `GET` | `/api/wordcloud` | 八个问题的词频 `{ q1..q8: [{ word, count }] }` |
| `GET` | `/api/wordcloud/:questionId` | 单问题词频 `[{ word, count }]`；未知题目 → `400` |
| `GET` | `/api/wordcloud/:questionId/count` | 单问题答题总数（裸数字） |
| `GET` | `/api/wordcloud/participants` | 参与人数（按 `clientIp` 去重，裸数字；NAT 共用出口 IP 时会偏低） |
| `GET` | `/api/docs` | Swagger 文档 |

`POST /api/answer` 返回顶层结构（与前端契约一致）：

```json
{ "success": true, "nextQuestionId": "q4", "completed": false }
```

`POST /api/institutions/:id/checkin` 返回机构信息 + 实时统计（大屏打卡按钮直接消费）：

```json
{
  "success": true,
  "alreadyLit": false,
  "institutionId": 12,
  "nameZh": "深圳市儿童医院",
  "province": "广东",
  "city": "深圳市",
  "litInstitutions": 8,
  "litProvinces": 5,
  "litCities": 7,
  "litAt": "2026-11-01T09:48:26.000Z"
}
```

- `alreadyLit: true`：该机构之前已点亮（或处于 10s 防刷窗口内），不会重复广播，但**同样返回机构信息与当前统计**，
  前端据此提示「已点亮」。
- `litInstitutions` = `isLit = true` 的机构总数（打卡家数）；`litProvinces` / `litCities` = 已点亮机构所在省份 / 城市去重数。
- `litAt`：已点亮时为库中时间，首次点亮为本次时间，冷却 / 并发抢占分支为 `null`。
- 机构不存在返回 `404`（「机构不存在」），`:id` 非数字返回 `400`。

错误统一为 `{ statusCode, message, error, timestamp, path }`；冷却/限流返回 `429`
并携带 `Retry-After` 头。

## WebSocket

- 命名空间：`/ws`
- 事件：`newAnswer`（答题弹幕，立即广播）、`wordCloudUpdate`（词云更新，5 秒节流）、
  `checkin`（机构打卡，仅首次点亮）
- 房间：`screens`（客户端握手携带 `auth: { role: 'screen' }`；若配置了
  `SCREEN_TOKEN`，还需 `auth: { token }`）

`newAnswer` 负载（弹幕用，最小字段集，不含任何客户端 IP）：

```json
{
  "questionId": "q3",
  "identityTag": "physician",
  "answer": "加强基层儿科培训",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`wordCloudUpdate` 负载（答题落库后只做标记，由 `WordcloudScheduler` 的
`@Interval(5000)` 统一重算并广播，**同一问题 5 秒内最多一次**）：

```json
{
  "questionId": "q3",
  "words": [
    { "word": "舒缓疗护", "count": 8 },
    { "word": "MDT", "count": 5 }
  ],
  "timestamp": "2026-01-01T00:00:05.000Z"
}
```

> 大屏收到后直接用 `words` 重绘词云；答题总数可调 `GET /api/wordcloud/:questionId/count`。

`participantCount` 负载（与词云一起节流广播：答题后最多 5 秒更新一次）：

```json
{ "count": 128 }
```

> 口径：`Answer.clientIp` 去重后的答题人数（忽略空 IP）。现场若共用同一出口 IP（NAT），
> 该数字会偏低；大屏首屏可先调 `GET /api/wordcloud/participants` 初始化。

`checkin` 负载（**仅首次点亮时广播**，用于点亮大屏气泡并刷新 KPI；`alreadyLit` 的重复打卡不广播）：

```json
{
  "success": true,
  "alreadyLit": false,
  "institutionId": 12,
  "nameZh": "深圳市儿童医院",
  "province": "广东",
  "city": "深圳市",
  "litInstitutions": 8,
  "litProvinces": 5,
  "litCities": 7
}
```

> 字段与 `POST /api/institutions/:id/checkin` 的响应对应（不含 `litAt`）；因为只在首次点亮时广播，
> `alreadyLit` 恒为 `false`。已点亮 / 10s 防刷窗口内 / 并发抢占失败都不会广播，避免多屏重复触发发光动画。

## 测试

```bash
npm test          # 单元测试（限流器）
npm run test:e2e  # e2e（自动重建 test.db 并 seed，含 Socket.io 广播断言）
npm run build     # 编译
npm run typecheck # 纯类型检查
```

## 前端集成

两端都用 `src/shared/api.ts` 里的 `request()` 统一处理 `{ statusCode, message }` 错误体，
并在 `vite.config.ts` 里把 `/api` 与 `/socket.io`（`ws: true`）代理到 `http://localhost:3000`，
因此开发期同源、不依赖 CORS。

| 前端 | 已接接口 |
| --- | --- |
| H5（5173） | `GET /api/questions`（启动时预取，失败/为空回退本地 `QUESTION_CARDS`）、`POST /api/answer` |
| 大屏（5174，`base: '/screen/'`） | `GET /api/institutions`、`/stats`、`/checked-in`、`POST /api/institutions/:id/checkin`、Socket `/ws` 的 `checkin` 事件 |

说明：

- H5 是观众端，不订阅 `screens` 房间，因此没有 socket 客户端代码。
- 大屏握手 `auth: { role: 'screen', token? }`；后端配置 `SCREEN_TOKEN` 时通过构建变量
  `VITE_SCREEN_TOKEN` 注入。
- 生产同域部署：nginx 需同时处理 `/api`、`/socket.io`（Upgrade）与 `/screen/` 静态目录
  （地图 JSON 在 `/screen/maps/china.json`）。

## SQLite 说明

- 不使用枚举，改用 `String` + 应用层白名单校验（`identities.ts` / `query-institutions.dto.ts`）。
- 不使用标量数组，标签直接用 `Json` 列（`wardProjects` / `clinicDepartments` / `typeTags`）。
- 启动时设置 `PRAGMA journal_mode=WAL` 与 `busy_timeout=5000` 以支持并发写入。