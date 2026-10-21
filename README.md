# 第六届儿童舒缓安宁国际大会（2026）电子互动大屏系统

6th International Conference on Paediatric Palliative Care — Interactive Display System

## 项目简介

本项目为第六届儿童舒缓安宁国际大会（2026）配套的电子互动大屏系统，包含三个前端应用和一个后端服务：

- **大屏端**：会议现场 LED 屏展示，包含八问互动问答（弹幕 + 词云）和中国地图资源打卡。
- **移动端 H5**：参会者扫码答题、机构打卡，无需登录、无需下载 App。
- **管理后台**：内容审核、词表管理、机构数据管理。
- **后端服务**：提供 API、WebSocket 实时推送、数据存储。

会议主题：聚力 · 聚光 · 蝶变（Together for Care / Together for Hope / Together to Transform）

会议时间：2026 年 11 月 14 日—15 日  
会议地点：湖南省儿童医院 / 233 艺术中心（湖南长沙）  
主办单位：湖南省儿童医院、长沙市蝴蝶之家儿童舒缓护理中心  
参会规模：约 100 人，中英双语

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端（大屏 / H5 / 后台） | Vue 3 + Vite + TypeScript + Vue Router + ECharts |
| 后端 | NestJS + Prisma |
| 数据库 | SQLite（开发阶段），可平滑迁移至 PostgreSQL |
| 实时通信 | Socket.io（WebSocket） |
| 分词与词云 | jieba 分词 + 自定义领域词表 |
| 部署 | Nginx + Node.js（香港轻量服务器，无需备案） |

## 目录结构


## 本地开发

### 环境要求

- Node.js ≥ 18（推荐 20 LTS）
- npm ≥ 9
- Git

### 启动前端（H5）

```bash
cd frontend
npm install
npm run dev

```

### 启动后端（待开发）

```bash
cd backend
npm install
npx prisma migrate dev
npm run start:dev

```


