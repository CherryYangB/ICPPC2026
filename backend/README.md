# ICPPC 2026 Conference Interaction System — Backend

ICPPC 2026 大会互动系统后端，基于 NestJS + Prisma + SQLite，为 Vue3 H5 前端提供
REST API、Socket.io 实时广播，并与前端共享同一套问题/身份契约。

## 技术栈

- [NestJS 11](https://nestjs.com/)（Express 平台）
- [Prisma 6](https://www.prisma.io/) + SQLite（WAL 模式）
- Socket.io（`/ws` 命名空间，`newAnswer` 事件）
- `class-validator` / `class-transformer` 参数校验
- `@nestjs/throttler` 全局兜底限流 + 业务层冷却
- Swagger（`/api/docs`）
- Jest（单元测试 + e2e，含 `socket.io-client` 广播断言）

## 目录结构

```
backend/
├── prisma/
│   ├── schema.prisma          # Question / Answer / Institution / ServiceTag / 关联表
│   ├── seed.ts                # 8 问（逐字取自前端）+ 示例机构/标签
│   └── migrations/
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
│   └── realtime/              # AnswersGateway（/ws，screens 房间）
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
npm install
npx prisma generate
npx prisma migrate dev --name init   # 首次会创建 dev.db 并执行 seed
npm run start:dev                    # http://localhost:3000/api
```

> 若 npm 官方源较慢，可追加 `--registry=https://registry.npmmirror.com`。

## API 端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查（含 DB 探活） |
| `GET` | `/api/questions` | 返回八问裸数组（`QuestionCard` 结构，带 ETag / Cache-Control） |
| `GET` | `/api/institutions` | 机构列表，支持 `province/city/district/type/keyword/tags` 筛选与 `page/pageSize` 分页 |
| `POST` | `/api/answer` | 提交答题，请求体 `{ questionId, identityTag, answer }` |
| `GET` | `/api/docs` | Swagger 文档 |

`POST /api/answer` 返回顶层结构（与前端契约一致）：

```json
{ "success": true, "nextQuestionId": "q4", "completed": false }
```

错误统一为 `{ statusCode, message, error, timestamp, path }`；冷却/限流返回 `429`
并携带 `Retry-After` 头。

## WebSocket

- 命名空间：`/ws`
- 事件：`newAnswer`
- 房间：`screens`（客户端握手携带 `auth: { role: 'screen' }`；若配置了
  `SCREEN_TOKEN`，还需 `auth: { token }`）

`newAnswer` 负载（不含任何客户端 IP）：

```json
{
  "id": "cuid",
  "questionId": "q3",
  "questionOrder": 3,
  "identityTag": "physician",
  "identityTagZh": "医生",
  "identityTagEn": "Physician",
  "answer": "加强基层儿科培训",
  "submittedAt": "2026-01-01T00:00:00.000Z"
}
```

## 测试

```bash
npm test          # 单元测试（限流器）
npm run test:e2e  # e2e（自动重建 test.db 并 seed，含 Socket.io 广播断言）
npm run build     # 编译
npm run typecheck # 纯类型检查
```

## 前端集成

前端 `src/shared/api.ts` 的 `submitAnswer` 已切换为真实 `POST /api/answer`；
`src/shared/socket.ts` 已切换为 `socket.io-client`（`createScreenSocket` /
`subscribeNewAnswer`）；`vite.config.ts` 已添加 `/api` 与 `/socket.io`（含 `ws: true`）
的开发代理，均指向 `http://localhost:3000`。

## SQLite 说明

- 不使用枚举，改用 `String` + 应用层白名单校验（`identities.ts` / `institution-types.ts`）。
- 不使用标量数组，标签关系用 `InstitutionTagLink` 关联表。
- 启动时设置 `PRAGMA journal_mode=WAL` 与 `busy_timeout=5000` 以支持并发写入。