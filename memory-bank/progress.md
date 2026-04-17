# 进度记录

## 2026-04-16

### 已完成

- 完成 implementation plan 第 1 步：初始化项目结构
- 建立 `apps/`、`packages/`、`tests/` 与 `memory-bank/` 协作结构
- 建立根级 `package.json`、`pnpm-workspace.yaml`、TypeScript 配置、ESLint、Prettier、Vitest 配置
- 建立 `bot-server` 与各基础 package 的最小入口文件
- 建立 `.env.example`
- 建立最小测试 `tests/workspace-structure.test.ts`

### 验证结果

- `corepack pnpm install` 通过
- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 运行 `pnpm` 相关命令时，当前环境需要通过 `corepack pnpm ...`
- `typecheck`、`test` 与 `rebuild esbuild` 在本地沙箱内会遇到 `spawn EPERM`，本轮已通过提权完成验证
- 当前仅完成工程骨架，尚未进入业务逻辑开发

### 下一步

- 进入 implementation plan 第 2 步：建立配置系统

## 2026-04-16

### 已完成

- 完成 implementation plan 第 2 步：建立配置系统
- 在 `packages/config` 中实现统一配置加载入口
- 加入 Zod 配置校验与 `ConfigError`
- 实现默认值、布尔值解析、数字解析、别名拆分
- 将 `bot-server` 占位入口接入配置模块
- 新增配置测试 `tests/config.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前配置模块仍基于 `process.env` 输入，不包含 `.env` 文件加载逻辑
- 当前默认主动插话基础概率固定为 `0.15`
- 根级 `typecheck` 已切换为 `tsc -b`，以适配 project references

### 下一步

- 进入 implementation plan 第 3 步：建立日志与请求追踪能力

## 2026-04-16

### 已完成

- 完成 implementation plan 第 3 步：建立日志与请求追踪能力
- 在 `packages/core` 中引入 Pino 并建立统一 logger 创建入口
- 实现 `traceId` 生成与链路上下文
- 实现消息接收、决策、发送任务、记忆写入、异常等固定日志 helper
- 将 `bot-server` 启动入口接入结构化日志
- 新增日志测试 `tests/logging.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前日志层已满足第 3 步要求，但还未接入真实 NapCat webhook / 事件流
- `traceId` 当前为本地生成，后续可扩展为 HTTP/消息入口统一注入
- 当前日志事件已固定第一批命名，后续功能可以在此基础上扩展

### 下一步

- 进入 implementation plan 第 4 步：实现健康检查与服务启动入口

## 2026-04-16

### 已完成

- 完成 implementation plan 第 4 步：实现健康检查与服务启动入口
- 引入 Fastify 作为最小服务框架
- 实现 `/health/live` 与 `/health`
- 在健康检查中暴露 NapCat / PostgreSQL / Redis 的配置状态
- 将启动入口改为实际监听端口
- 增加健康检查测试 `tests/healthcheck.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前健康检查里的依赖状态仍是配置层面，不是实际连接层面的探针
- 这一步已经满足“服务启动”和“依赖状态可观测”的最小要求
- 下一步进入数据库模型与迁移阶段

### 下一步

- 进入 implementation plan 第 5 步：建立数据库模型与迁移机制

## 2026-04-16

### 已完成

- 完成 implementation plan 第 5 步：建立数据库模型与迁移机制
- 接入 Drizzle ORM、drizzle-kit、pg、tsx
- 建立 PostgreSQL schema、迁移脚本和验证脚本
- 生成首个迁移文件到 `packages/memory/drizzle/`
- 新增本地 `infra/docker/docker-compose.yml`
- 新增数据库 schema 测试 `tests/database-schema.test.ts`

### 验证结果

- `corepack pnpm db:generate` 通过
- `corepack pnpm db:migrate` 首次执行通过
- `corepack pnpm db:migrate` 二次执行通过
- `corepack pnpm db:verify` 通过
- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 本轮使用真实 PostgreSQL 容器完成迁移验证，不是纯内存替身
- Docker Desktop 在执行前需要先启动
- 当前数据库层只完成结构与迁移，还未进入 repository 和业务写入逻辑

### 下一步

- 进入 implementation plan 第 6 步：建立 Redis 连接与基础状态能力

## 2026-04-16

### 已完成

- 完成 implementation plan 第 6 步：建立 Redis 连接与基础状态能力
- 在 `packages/core` 中建立 Redis client、key builder、TTL 策略和基础状态封装
- 新增 Redis 验证脚本 `redis:verify`
- 新增 Redis 单元测试 `tests/redis.test.ts`
- 在真实 Redis 容器上完成连接、写入、读取、TTL 过期验证

### 验证结果

- `corepack pnpm redis:verify` 通过
- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前 Redis 层是基础设施层，后续第 13 步的去重与防重复发送会复用它
- Redis 容器已经可以通过 `infra/docker/docker-compose.yml` 启动
- 当前 `/health` 还没有接入真实 Redis 连通性探针

### 下一步

- 进入 implementation plan 第 7 步：定义统一消息事件模型
## 2026-04-16

### 已完成

- 完成 implementation plan 第 7 步：定义统一消息事件模型
- 在 `packages/core` 中新增统一消息事件 schema、mention schema、reply schema 和发送结果 schema
- 新增统一消息事件解析函数与统一发送结果解析函数
- 明确无效事件拒绝规则：缺关键字段或内容为空时直接拒绝
- 新增统一事件模型测试 `tests/message-event.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前只完成平台无关契约层，NapCat 到统一事件的真实转换会在下一步实现
- 当前统一事件模型已经可以作为后续消息入库、决策引擎和发送调度的稳定输入边界
- 统一发送结果结构也已经冻结，后续 sender 和平台适配层都应复用

### 下一步

- 进入 implementation plan 第 8 步：实现 NapCat 平台适配器骨架

## 2026-04-16

### 已完成

- 完成 implementation plan 第 8 步：实现 NapCat 平台适配器骨架
- 新增 `apps/bot-server/src/napcat-adapter.ts`
- 实现 NapCat group message 到统一消息事件的转换
- 实现 `POST /adapters/napcat/events` 接收入口
- 实现 NapCat group message 发送抽象与统一发送结果转换
- 新增适配层测试 `tests/napcat-adapter.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前适配器层只负责协议转换，不包含回复决策、记忆写入或发送调度
- 当前只支持 NapCat 的群消息主链路，其他事件类型后续再扩展
- 统一事件回调入口已经预留好，下一步可以直接接消息入库和审计

### 下一步

- 进入 implementation plan 第 9 步：实现消息入库与基础审计

## 2026-04-16

### 已完成

- 完成 implementation plan 第 9 步：实现消息入库与基础审计
- 在 `packages/memory/src/message-audit.ts` 中实现统一事件入库编排
- 实现群、用户、消息记录的自动 upsert / insert
- 实现 Redis 入站消息去重 key
- 实现基础审计查询接口
- 将 NapCat 事件回调接入消息入库链路
- 新增测试 `tests/message-audit.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前已经打通“NapCat 入站 -> 统一事件 -> 幂等入库 -> 基础审计”的最小闭环
- 当前 reply log 仍是审计占位记录，真正的决策与发送状态会在后续步骤补齐
- 当前 dedupe 只针对消息入库，不代表完整回复发送防重

### 下一步

- 进入 implementation plan 第 10 步：实现关键词规则存储与读取

## 2026-04-16

### 已完成

- 完成 implementation plan 第 10 步：实现关键词规则存储与读取
- 在 `packages/memory/src/keyword-rules.ts` 中实现关键词规则保存、启用切换、启用列表读取和缓存失效
- 新增测试 `tests/keyword-rules.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前关键词规则层已经能为后续命中引擎提供稳定输入源
- 当前只处理规则配置、缓存和读取，不处理文本命中
- 缓存 key 与失效边界已经固定，后续管理接口可以直接复用

### 下一步

- 进入 implementation plan 第 11 步：实现消息是否与机器人相关的基础判定

## 2026-04-16

### 已完成

- 完成 implementation plan 第 11 步：实现消息是否与机器人相关的基础判定
- 在 `packages/decision-engine/src/relevance.ts` 中实现 mention、名字、别名、回复机器人和延续上下文判定
- 新增测试 `tests/relevance.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前判定层已经可以回答“这条消息是否和机器人相关”
- 当前输出的是基础相关性结果，不是最终回复决策
- 第 12 到第 15 步会在这个基础上继续叠加必回、关键词命中和总决策引擎

### 下一步

- 进入 implementation plan 第 12 步：实现 `@` 必回规则

## 2026-04-16

### 已完成

- 完成 implementation plan 第 12 步：实现 `@` 必回规则
- 在 `packages/decision-engine/src/must-reply.ts` 中实现 mention 提升为 `must_reply`
- 新增测试 `tests/must-reply.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前 mention 已经拥有最高优先级的基础决策地位
- 这一步还没有整合关键词和总决策引擎

### 下一步

- 进入 implementation plan 第 13 步：实现基础去重与防重复发送

## 2026-04-16

### 已完成

- 完成 implementation plan 第 13 步：实现基础去重与防重复发送
- 在 `packages/sender/src/dedupe.ts` 中实现发送任务幂等 key 和 claim 逻辑
- 新增测试 `tests/sender-dedupe.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前已经补上发送层最小幂等边界
- 这一步只做发送任务防重，不做真实发送调度

### 下一步

- 进入 implementation plan 第 14 步：实现关键词命中判断

## 2026-04-16

### 已完成

- 完成 implementation plan 第 14 步：实现关键词命中判断
- 在 `packages/decision-engine/src/keyword-match.ts` 中实现 `exact`、`fuzzy`、`regex` 三种命中方式
- 新增测试 `tests/keyword-match.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前关键词判断已经可以输出稳定的命中结果、来源规则和优先级
- 下一步会把它和 mention / 相关性 / 主动插话整合进总决策引擎

### 下一步

- 进入 implementation plan 第 15 步：实现总回复决策引擎与主动插话入口

## 2026-04-16

### 已完成

- 完成 implementation plan 第 15 步：实现总回复决策引擎与主动插话入口
- 在 `packages/decision-engine/src/decision.ts` 中整合 mention、关键词、相关性和主动插话概率
- 新增测试 `tests/decision-engine.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前已经具备统一的第一层回复决策入口
- 决策引擎目前还是纯函数，后续接业务链时风险比较低
- 主动插话已经进入决策层，但还没接到真实发送链路

### 下一步

- 进入 implementation plan 第 16 步：实现用户记忆基础模型

## 2026-04-16

### 已完成

- 完成 implementation plan 第 16 步：实现用户记忆基础模型
- 完成 implementation plan 第 17 步：实现短期上下文存储
- 完成 implementation plan 第 18 步：实现记忆写入筛选规则
- 完成 implementation plan 第 19 步：实现 LLM 提供层骨架

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 用户记忆、短期上下文和记忆筛选这三层现在已经都具备了独立可测的基础能力
- LLM 层已经有统一超时和错误包装，后面接真实生成链路时只需要补 transport 和 prompt 组装

### 下一步

- 进入 implementation plan 第 20 步：实现回复生成最小链路

## 2026-04-16

### 已完成

- 完成 implementation plan 第 20 步：实现回复生成最小链路
- 完成 implementation plan 第 21 步：实现 `@` 场景下的兜底占位回复
- 完成 implementation plan 第 22 步：实现分句策略
- 完成 implementation plan 第 23 步：实现延迟发送调度
- 完成 implementation plan 第 24 步：实现发送结果记录
- 在 `apps/bot-server/src/main.ts` 中接通“入站消息 -> 决策 -> 生成 -> 分句 -> 顺序发送 -> 回复日志状态更新”最小主链路
- 新增测试：
  - `tests/reply-generator.test.ts`
  - `tests/placeholder.test.ts`
  - `tests/sentence-split.test.ts`
  - `tests/schedule.test.ts`
  - `tests/dispatch.test.ts`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 当前回复生成使用启发式 transport，先保证主链路可测、可运行，后续再替换真实模型调用
- 回复日志现在已经会根据发送结果回写 `sent` 或 `failed`
- 分句与延迟调度当前为进程内顺序执行，尚未接入正式队列系统

### 下一步

- 进入 implementation plan 第 25 步：实现记忆回写

## 2026-04-16

### 已完成

- 完成 implementation plan 第 25 步：实现记忆回写
- 完成 implementation plan 第 26 步：实现最近对话摘要
- 完成 implementation plan 第 27 步：实现管理接口的最小集
- 完成 implementation plan 第 28 步：建立端到端消息回放测试
- 完成 implementation plan 第 29 步：建立异常与降级测试
- 完成 implementation plan 第 30 步：进行 MVP 验收
- 新增 `apps/bot-server/src/message-processor.ts`，把消息处理主链路抽成独立可测模块
- 新增群级/用户级摘要存储、memory facts 存储、记忆回写计划器
- 新增管理接口与 `X-Admin-Token` 鉴权
- 产出 `memory-bank/mvp-acceptance.md`

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- 目前自动化测试总计 29 个测试文件、86 条用例，已经覆盖 MVP 主链路、路由调试能力和主要降级路径
- 当前 MVP 验收以自动化回放与降级测试为主，真实 QQ 群联调仍建议作为下一阶段第一件事
- 这次初版已经具备被 `@` 必回、关键词触发、非全量回复、分句发送、用户记忆回写与调试查看能力

### 下一步

- 进入真实环境灰度联调，优先替换真实 LLM transport 并补任务队列

## 2026-04-17

### 已完成

- 完成真实多 provider transport 第一版
- 新增 `packages/llm/src/transport.ts`
- 配置层新增 `LLM_TRANSPORT_MODE` 与各 provider 的 `apiKey / baseUrl / model`
- `main.ts` 已支持按配置在 heuristic 与 remote 之间切换
- 更新 `.env.example`
- 新增测试：
  - `tests/llm-transport.test.ts`
  - `tests/config.test.ts` 中的 remote 模式校验

### 验证结果

- `corepack pnpm typecheck` 通过
- `corepack pnpm test` 通过
- `corepack pnpm lint` 通过

### 备注

- OpenAI、GLM、DeepSeek、Kimi 当前统一走 OpenAI-compatible transport
- Claude 当前走 Anthropic messages transport
- 真实 provider 已可接入，但还没有在真实外网环境逐个联调

### 下一步

- 进入 BullMQ 队列化发送调度
