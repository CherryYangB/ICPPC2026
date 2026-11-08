# ICPPC 2026 Conference Interaction System — Backend

ICPPC 2026 大会互动系统后端，基于 NestJS + Prisma + SQLite，为 Vue3 H5 前端提供
REST API、Socket.io 实时广播，并与前端共享同一套问题/身份契约。

## 技术栈

- [NestJS 11](https://nestjs.com/)（Express 平台）
- [Prisma 6](https://www.prisma.io/) + SQLite（WAL 模式）
- Socket.io（`/ws` 命名空间，`newAnswer` / `checkin` 事件）
- `class-validator` / `class-transformer` 参数校验
- `@nestjs/throttler` 全局兜底限流 + 业务层冷却
- `@nestjs/jwt` + `passport-jwt`（后台 JWT 认证）、`bcrypt` 密码哈希
- Swagger（`/api/docs`）
- Jest（单元测试 + e2e，含 `socket.io-client` 广播断言）

## 目录结构

```
backend/
├── prisma/
│   ├── schema.prisma          # Question / Answer / Institution / CheckinRecord / User
│   ├── seed.ts                # 8 问 + 机构数据 + 默认超级管理员
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
│   ├── auth/                  # 后台认证：login / me / password、JWT Strategy、JwtAuthGuard、RolesGuard
│   ├── users/                 # 账号管理（仅 super_admin）：列表 / 新增 / 修改 / 重置密码 / 删除
│   ├── dashboard/             # GET /api/admin/dashboard 总览统计
│   ├── settings/              # 二维码上传 / 读取（theme 设置后续加入）
│   ├── health/                # GET /api/health
│   ├── questions/             # GET /api/questions
│   ├── institutions/          # 机构查询 / 打卡 + 后台增删改、手动点亮
│   ├── answers/               # POST /api/answer（校验 → 冷却 → 落库 → 广播）+ /api/admin/answers 管理
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
| `JWT_SECRET` | （必填） | 后台 JWT 签名密钥，至少 32 位；缺失时启动失败 |
| `JWT_EXPIRES_IN` | `8h` | 后台 token 有效期（`jsonwebtoken` 格式，如 `8h`、`7d`） |
| `LOGIN_RATE_LIMIT` / `LOGIN_RATE_TTL_MS` | `5` / `60000` | 登录接口限流（按 IP），防暴力破解 |
| `ONLINE_WINDOW_MINUTES` | `10` | 总览 `onlineCount` 统计窗口（最近 N 分钟有答题的去重 IP） |
| `QR_UPLOAD_DIR` | `backend/uploads` | 二维码文件目录（一般无需设置；测试使用独立目录） |
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
| `POST` | `/api/auth/login` | 后台登录（公开），返回 `{ token, user }` |
| `GET` | `/api/auth/me` | 当前登录用户（需 JWT） |
| `POST` | `/api/auth/password` | 修改自己的密码（需 JWT），用于首次登录强制改密 |
| `GET` | `/api/users` | 账号列表（仅 super_admin），支持 `role` / `keyword` / `page` / `pageSize` |
| `POST` | `/api/users` | 新增账号（仅 super_admin），用户名重复返回 `409` |
| `PATCH` | `/api/users/:id` | 修改资料 / 角色 / 启停状态（仅 super_admin） |
| `PATCH` | `/api/users/:id/password` | 重置密码（仅 super_admin），目标账号下次登录须改密 |
| `DELETE` | `/api/users/:id` | 删除账号（仅 super_admin） |
| `GET` | `/api/admin/answers` | 回答列表（JWT；viewer 可读），支持 `questionId` / `identityTag` / `isHidden` / `keyword` + 分页 |
| `PATCH` | `/api/admin/answers/:id` | 修改回答内容（仅 admin / super_admin） |
| `PATCH` | `/api/admin/answers/:id/visibility` | 设置隐藏 / 显示（仅 admin / super_admin） |
| `DELETE` | `/api/admin/answers/:id` | 删除回答（仅 admin / super_admin） |
| `POST` | `/api/admin/answers/batch-hide` | 批量隐藏，body `{ ids: string[] }` |
| `POST` | `/api/admin/answers/batch-delete` | 批量删除，body `{ ids: string[] }` |
| `GET` | `/api/admin/dashboard` | 总览监控统计（JWT；viewer 可读） |
| `POST` | `/api/admin/settings/qr` | 上传二维码（仅 admin / super_admin，multipart `file`） |
| `GET` | `/api/settings/qr` | 当前二维码元数据（公开；未上传时 `url = null`） |
| `GET` | `/api/settings/qr/image` | 当前二维码图片（公开） |
| `GET` | `/api/questions` | 返回八问裸数组（`QuestionCard` 结构，带 ETag / Cache-Control） |
| `GET` | `/api/institutions` | 机构全量列表（裸数组），支持 `type`(`ward`/`clinic`)、`province`、`keyword` 叠加筛选；含 `address` / `description` / `descriptionEn` |
| `GET` | `/api/institutions/stats` | 机构统计 `{ totalInstitutions, litInstitutions, litProvinces, litCities }` |
| `GET` | `/api/institutions/checked-in` | 已点亮（`isLit = true`）机构，供大屏初始化发光状态 |
| `POST` | `/api/institutions` | 新增机构（仅 admin / super_admin） |
| `PATCH` | `/api/institutions/:id` | 编辑机构（仅 admin / super_admin） |
| `PATCH` | `/api/institutions/:id/lit` | 手动点亮 / 撤销，body `{ isLit: boolean }` |
| `DELETE` | `/api/institutions/:id` | 删除机构（仅 admin / super_admin） |
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

## 后台认证与权限

后台管理端（`frontend/ICPPC2026_Admin`）统一走 JWT 认证，账号存于 `User` 表：

- 角色：`super_admin`（超级管理员）、`admin`（管理员）、`viewer`（只读）。
- 密码：`bcrypt`（cost 10）哈希存储，任何接口都不会返回 `passwordHash`。
- Token：`Authorization: Bearer <token>`，默认 8 小时过期；每次请求 `JwtStrategy` 都会重新查库，
  账号停用 / 角色调整立即生效。
- 登录失败统一返回 `401 用户名或密码错误`；停用账号返回 `401 账号已被停用，请联系超级管理员`。
- 登录接口额外限流（默认 5 次 / 分钟 / IP），防暴力破解。

默认超级管理员由 seed 创建（**仅首次创建，绝不覆盖已有密码**）：

| 用户名 | 密码 | 角色 |
| --- | --- | --- |
| `admin` | `icppc2026` | `super_admin` |

登录响应中的 `user.mustChangePassword` 为 `true` 时，前端必须强制跳转改密页；改密成功后置为 `false`。

```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"icppc2026"}'

# 当前用户
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer <token>"

# 修改密码
curl -X POST http://localhost:3000/api/auth/password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"icppc2026","newPassword":"NewStrongPass123"}'
```

守卫使用约定（后续 `/api/users`、`/api/settings`、答案 / 机构管理接口）：

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin') // 写操作；viewer 只读
```

保持公开、不挂 JWT 的接口：`/api/questions`、`/api/wordcloud/*`、`POST /api/answer`、
`/api/institutions/*`（含 `checked-in` 与 `:id/checkin`）、`/api/health`。

> 生产部署必须在 `backend/.env` 设置 `JWT_SECRET`（`openssl rand -hex 32`），否则应用启动即报错。

### 回答管理（`/api/admin/answers`）

- 列表：JWT 登录即可读（含 viewer）；`createdAt` 映射自数据库的 `submittedAt`。
- 写操作（改内容 / 隐藏 / 删除 / 批量）：仅 `admin`、`super_admin`。
- `Answer.id` 是 **cuid 字符串**，单条路径参数与批量 `ids` 都使用 `string`，不是数字。
- 隐藏：`PATCH /api/admin/answers/:id/visibility`，body `{ "isHidden": true }`；仅在
  `false → true` 时广播 `answerHidden`，`true → false` 只恢复词云/计数，不广播。
- 删除：广播 `answerDeleted`。
- 批量：`{ "ids": ["clx...", "clx..."] }`，最多 200 个；返回 `{ "updated": n }` 或 `{ "deleted": n }`。
- 隐藏 / 删除 / 修改内容后会把对应题目标记为脏，由词云调度器在 5 秒内重算并广播。
- 词云、答题总数、参与人数、`GET /api/answer/recent` 弹幕回放均过滤 `isHidden = true`。

### 机构管理

- `POST /api/institutions`：必填 `province` / `city` / `nameZh` / `longitude` / `latitude`；
  `province` 自动归一为短名（广东省 → 广东）；`typeTags` 未传时按 `hasWard/hasClinic` 生成。
- 唯一约束 `(province, city, nameZh)` 冲突返回 `409`。
- `PATCH /api/institutions/:id`：部分更新；不支持直接改 `isLit/litAt`。
- `PATCH /api/institutions/:id/lit`：
  - `{ "isLit": true }` → 写入 `litAt`，广播 `checkin`；
  - `{ "isLit": false }` → 清空 `litAt`，广播 `checkinRevoked { institutionId, province }`。
- `DELETE /api/institutions/:id`：删除机构行即删除其打卡状态；若删除时已点亮，额外广播
  `checkinRevoked`，避免大屏残留发光。
- 以上写操作仅 `admin` / `super_admin`；公开的 `GET /api/institutions*` 与
  `POST /api/institutions/:id/checkin` 保持不变。

### 总览监控

`GET /api/admin/dashboard`（super_admin / admin / viewer）：

```json
{
  "totalAnswers": 120,
  "todayAnswers": 15,
  "onlineCount": 8,
  "litInstitutions": 12,
  "totalInstitutions": 58,
  "litProvinces": 6,
  "answersByQuestion": [
    { "questionId": "q1", "topicZh": "症状管理", "color": "#2f80ed", "count": 18 }
  ],
  "recentActivity": [
    {
      "type": "answer",
      "questionId": "q1",
      "preview": "我们需要更加统一的临床标准……",
      "identityTag": "physician",
      "createdAt": "2026-11-08T15:00:00.000Z"
    },
    {
      "type": "checkin",
      "nameZh": "深圳市儿童医院",
      "province": "广东",
      "createdAt": "2026-11-08T14:59:00.000Z"
    }
  ]
}
```

口径：

- 所有回答统计均排除 `isHidden = true`。
- `todayAnswers` 按北京时间（UTC+8）当天 00:00 起计算。
- `onlineCount` = 最近 `ONLINE_WINDOW_MINUTES`（默认 10）分钟内答题过的去重 `clientIp` 数。
- `answersByQuestion` 固定返回 q1..q8，无回答时 `count = 0`。
- `recentActivity` 合并回答与打卡记录，按时间倒序取最近 20 条；回答 `preview` 最多 60 字符，超出追加 `…`。
- 打卡历史来自 `CheckinRecord`：公开打卡首次点亮、后台手动点亮各写入一条；删除机构级联删除，撤销点亮保留历史。

### 二维码设置

- `POST /api/admin/settings/qr`（仅 admin / super_admin）：
  - `multipart/form-data`，字段名 `file`；
  - 仅支持 JPEG / PNG（按文件头 magic bytes 校验），最大 5 MB；
  - 保存到 `backend/uploads/qr-participate.jpg` 或 `.png`，并删除另一种格式。
- `GET /api/settings/qr`：返回 `{ url, contentType, size, updatedAt }`；未上传时 `{ "url": null }`。
- `GET /api/settings/qr/image`：返回图片字节，`Content-Type` 按实际格式；未上传时 404。
- 大屏 `Interactive.vue` 启动时读取 `/api/settings/qr`，有上传版本则使用
  `/api/settings/qr/image?v=...`，加载失败自动回退到打包内的本地二维码。
- `backend/uploads/` 已被 `.gitignore` 忽略；生产部署需保证目录可写，并纳入备份。

### 账号管理（仅 super_admin）

`/api/users` 全部接口都挂 `JwtAuthGuard + RolesGuard`，并标注 `@Roles('super_admin')`；
admin / viewer 访问返回 `403`。响应通过 Prisma `select` 裁剪，**永远不会返回 `passwordHash`**。

列表响应（`GET /api/users?role=viewer&keyword=zhang&page=1&pageSize=20`）：

```json
{
  "items": [
    {
      "id": 2,
      "username": "zhangsan",
      "displayName": "张三",
      "role": "viewer",
      "email": "zhangsan@example.com",
      "isActive": true,
      "mustChangePassword": true,
      "lastLoginAt": null,
      "createdAt": "2026-11-08T14:20:43.510Z",
      "updatedAt": "2026-11-08T14:20:43.510Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

约束：

- `username` 唯一，重复新增返回 `409 用户名已存在`。
- 新增账号与重置密码后 `mustChangePassword = true`，目标账号首次登录须改密。
- 不能删除自己；不能把自己降级为 `viewer`。
- 不能把最后一个启用的 `super_admin` 降级 / 禁用；不能删除最后一个 `super_admin`。
- `pageSize` 最大 100；非法角色、短密码等返回 `400`。

## WebSocket

- 命名空间：`/ws`
- 事件：`newAnswer`（答题弹幕，立即广播）、`wordCloudUpdate`（词云更新，5 秒节流）、
  `checkin`（机构打卡，仅首次点亮）、`checkinRevoked`（后台撤销点亮）、
  `answerHidden` / `answerDeleted`（后台隐藏 / 删除回答，大屏移除弹幕）
- 房间：`screens`（客户端握手携带 `auth: { role: 'screen' }`；若配置了
  `SCREEN_TOKEN`，还需 `auth: { token }`）

`newAnswer` 负载（弹幕用，最小字段集，不含任何客户端 IP）：

```json
{
  "answerId": "clx1234567890",
  "questionId": "q3",
  "identityTag": "physician",
  "answer": "加强基层儿科培训",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

> `answerId` 与 `GET /api/answer/recent` 中的字段一致；大屏弹幕队列需保留该 id，收到
> `answerHidden` / `answerDeleted` 时按 id 移除待播放条目（已显示在画布上的条目无法撤回）。

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

`answerHidden` / `answerDeleted` 负载（后台隐藏 / 删除回答）：

```json
{ "answerId": "clx1234567890" }
```

`checkinRevoked` 负载（后台撤销点亮 / 删除已点亮机构）：

```json
{ "institutionId": 12, "province": "广东" }
```

> 大屏收到 `answerHidden` / `answerDeleted` 后按 `answerId` 从弹幕回放队列移除；收到
> `checkinRevoked` 后移除该机构发光并重新拉取 `/api/institutions/checked-in` 与统计。

## 测试

```bash
npm test          # 单元测试（限流器、RolesGuard、UsersService 保护规则）
npm run test:e2e  # e2e（自动重建 test.db 并 seed，含回答/机构管理、Socket.io 广播断言）
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
| Admin（5175，规划中，`base: '/admin/'`） | `/api/auth/*`、`/api/users`、`/api/settings`（JWT） |
| 大屏（5174，`base: '/screen/'`） | `GET /api/institutions`、`/stats`、`/checked-in`、`POST /api/institutions/:id/checkin`、Socket `/ws` 的 `checkin` 事件 |

说明：

- H5 是观众端，不订阅 `screens` 房间，因此没有 socket 客户端代码。
- 大屏握手 `auth: { role: 'screen', token? }`；后端配置 `SCREEN_TOKEN` 时通过构建变量
  `VITE_SCREEN_TOKEN` 注入。
- 生产同域部署：nginx 需同时处理 `/api`、`/socket.io`（Upgrade）与 `/screen/` 静态目录
  （地图 JSON 在 `/screen/maps/china.json`）。

## SQLite 说明

- 不使用枚举，改用 `String` + 应用层白名单校验（`identities.ts` / `query-institutions.dto.ts` / `auth.constants.ts`）。
- 不使用标量数组，标签直接用 `Json` 列（`wardProjects` / `clinicDepartments` / `typeTags`）。
- 启动时设置 `PRAGMA journal_mode=WAL` 与 `busy_timeout=5000` 以支持并发写入。