# 技术栈建议

## 1. 目标

基于 [design-document.md](C:\Users\wyk24\Desktop\Bot-momo\memory-bank\design-document.md) 的需求，这个项目的核心不是“做一个会调用大模型的机器人”，而是做一个在群聊里更像人的系统。因此技术栈需要优先满足下面几件事：

- TypeScript 全栈统一，开发效率高
- 便于处理消息事件流和状态机逻辑
- 能稳定管理群上下文、用户记忆和关键词规则
- 容易接入 LLM
- 方便后续从 MVP 扩展到多群、多人格、多记忆层级

## 2. 推荐结论

如果目标是先快速做出一个可运行、可迭代的版本，推荐采用下面这套主技术栈：

- 语言：TypeScript
- 运行时：Node.js 22 LTS
- 包管理：pnpm
- Web/服务框架：Fastify
- 机器人接入层：按目标平台选择适配器，内部统一成事件总线
- 数据库：PostgreSQL
- ORM：Drizzle ORM
- 缓存 / 队列 / 限流：Redis
- 向量检索：第一阶段先不单独上向量库，先用 PostgreSQL + 结构化记忆；后续再接 pgvector
- LLM 接入：OpenAI API 兼容封装层
- 配置校验：Zod
- 日志：Pino
- 定时任务 / 延迟发送：BullMQ
- 测试：Vitest
- 代码规范：ESLint + Prettier
- 部署：Docker Compose

这套组合比较适合你这个项目，因为它兼顾了三个重点：规则判断、状态控制、记忆管理。

## 3. 为什么这样选

## 3.1 TypeScript + Node.js

这是最适合你当前目标的基础组合。

原因：
- 你明确想用 TS
- 机器人系统本质上是事件驱动，Node.js 很适合处理消息、定时、队列、网络请求
- 和各种 IM 平台 SDK、HTTP 回调、WebSocket 生态兼容性好
- 后面写规则引擎、上下文管理、消息调度都比较顺手

推荐版本：
- Node.js 22 LTS
- TypeScript 5.x

## 3.2 Fastify 而不是 Express / NestJS

推荐优先用 Fastify。

原因：
- 比 Express 更现代，性能和类型体验更好
- 比 NestJS 更轻，不会在 MVP 阶段引入太重的框架心智负担
- 适合做 webhook、管理接口、健康检查、配置接口

适用场景：
- 接 IM 平台回调
- 提供关键词配置接口
- 提供记忆查看 / 调试接口
- 提供健康检查和后台管理入口

如果你后面想做非常完整的后台管理系统，再考虑把管理端单独拆出来。

## 3.3 PostgreSQL 作为主存储

推荐 PostgreSQL 作为唯一主数据库。

原因：
- 结构化数据很适合存用户记忆、群配置、关键词规则、消息记录、发言日志
- 后续如果你要做语义检索，可以直接加 `pgvector`，不用马上引入新的数据库
- 一套数据库就能覆盖 MVP 和后续扩展，成本低

建议存储的核心表：
- `groups`
- `users`
- `messages`
- `user_memories`
- `memory_facts`
- `keyword_rules`
- `reply_logs`
- `conversation_summaries`
- `bot_profiles`

## 3.4 Drizzle ORM

推荐 Drizzle，而不是 Prisma。

原因：
- 类型直接、轻量、贴近 SQL
- 对 TS 项目很友好
- 更适合你这种“规则系统 + 数据结构明确 + 需要自己掌控表设计”的项目
- 后期做消息检索、复杂过滤时，不容易被 ORM 抽象卡住

如果你更偏爱 Prisma 也能做，但从这个项目的“可控性”和“轻量程度”来看，我更推荐 Drizzle。

## 3.5 Redis

Redis 在这个项目里非常关键，建议第一阶段就上。

它适合处理：
- 群级冷却时间
- 用户级冷却时间
- 最近发言频率统计
- 延迟回复任务
- 分句发送调度
- 临时上下文缓存
- 并发锁，避免同一条消息被重复处理

为什么不能只靠数据库：
- 冷却、计数、短期状态这些都是高频读写
- 用 Redis 会明显更顺手，且延迟低

## 3.6 BullMQ

推荐和 Redis 配套使用 BullMQ。

它非常适合你的“像人一样延迟发言”和“分几句发”这类行为。

可用来处理：
- `@` 后立即发一句占位，再异步补全
- 把一条长回复拆成多个发送任务
- 按随机延迟发送每一句
- 高峰期排队，避免机器人同时连发很多消息

这是拟人化体验里非常重要的一层，不建议只用 `setTimeout` 硬写。

## 3.7 LLM 接入层

建议不要把业务逻辑直接绑死在某一家模型 SDK 上，而是做一层统一封装。

推荐方式：
- 内部定义 `LLMProvider` 接口
- 第一阶段先接 OpenAI 兼容 API
- 后面可以切换不同模型提供商，而不影响业务层

建议拆成两个模型调用场景：
- 生成型调用：用于正常回复
- 提取型调用：用于记忆提取、摘要压缩、是否值得写入长期记忆

这样做的好处：
- 不同任务可以用不同模型和参数
- 更容易控制成本
- 更容易做降级策略

## 3.8 Zod

推荐把 Zod 用在所有“进入系统的边界”上。

包括：
- webhook 入参校验
- 配置文件校验
- 管理接口参数校验
- LLM 输出结构校验

特别是 LLM 输出结构化结果时，例如：
- 是否回复
- 记忆提取结果
- 摘要对象
- 分句结果

用 Zod 做兜底，会稳定很多。

## 3.9 Pino 日志

推荐 Pino。

这个项目后期调试会非常依赖日志，因为你要看清楚机器人为什么“回了”或“没回”。

建议记录：
- 收到什么消息
- 决策结果是什么
- 命中了哪条规则
- 从哪些上下文生成了回复
- 发送了几句
- 每句实际发送时间
- 是否触发冷却或限流

## 4. 架构建议

## 4.1 推荐架构风格

建议采用“规则优先 + LLM 辅助”的架构，而不是“所有判断都交给模型”。

推荐顺序：
1. 事件接入
2. 规则判断是否需要回复
3. 检索相关记忆和上下文
4. 再调用 LLM 生成回复
5. 分句和延迟发送
6. 回写记忆和摘要

这样做的原因：
- 可控
- 成本低
- 更容易调试
- 更像真实群友，而不是模型看到消息就输出

## 4.2 模块拆分建议

- `apps/bot-server`
  - Fastify 服务入口
- `packages/core`
  - 消息事件模型、类型定义、通用工具
- `packages/decision-engine`
  - 是否回复、冷却、关键词命中、优先级计算
- `packages/memory`
  - 用户记忆、群摘要、记忆提取和压缩
- `packages/llm`
  - 模型适配层、prompt 构建、输出解析
- `packages/sender`
  - 分句、延迟、发送调度
- `packages/platform-adapters`
  - 不同聊天平台适配
- `packages/config`
  - 配置加载、Zod 校验

如果你不想一开始就上 monorepo，也可以先单仓单服务，后面再拆。

## 5. 针对需求的技术映射

## 5.1 被 `@` 必须回复

推荐实现：
- 平台适配器负责解析 `mentions`
- 决策引擎内置最高优先级规则
- BullMQ 负责兜底短句和正式回复的异步发送

需要的技术：
- TypeScript
- Fastify
- Redis
- BullMQ

## 5.2 不是每句话都回复

推荐实现：
- 规则引擎先判断是否与机器人有关
- Redis 记录群级 / 用户级冷却时间
- PostgreSQL 记录最近发言历史
- 必要时用轻量模型做辅助分类，但不要作为唯一判断依据

需要的技术：
- PostgreSQL
- Redis
- Drizzle
- 可选 LLM 分类调用

## 5.3 一段话拆成几句发

推荐实现：
- 先生成完整回复
- 再走一个“分句器”
- 将拆出的多句丢给 BullMQ 按间隔发送

需要的技术：
- BullMQ
- Redis
- `sender` 模块

## 5.4 给每个群友建立记忆

推荐实现：
- PostgreSQL 持久化长期记忆和摘要
- Redis 缓存短期上下文
- 定时或事件触发进行记忆压缩

需要的技术：
- PostgreSQL
- Drizzle
- Redis
- LLM 提取器

## 5.5 关键词触发出现

推荐实现：
- PostgreSQL 保存关键词配置
- 内存或 Redis 做热点规则缓存
- 决策引擎执行命中检测和冷却判断

需要的技术：
- PostgreSQL
- Redis
- 决策引擎模块

## 6. 可选增强组件

这些不是 MVP 必需，但后续很有用。

### 6.1 pgvector

适合场景：
- 记忆量变大后，需要语义检索
- 想根据“相似话题”回忆群友过去说过的事

建议：
- 第一阶段先不急着上
- 当记忆规模和检索复杂度上来后再接

### 6.2 后台管理前端

推荐：
- Next.js
- Tailwind CSS
- shadcn/ui

适合做：
- 关键词配置页
- 机器人人格配置页
- 记忆查看页
- 回复日志与命中规则调试页

这部分可以晚一点做，不影响机器人先跑起来。

### 6.3 OpenTelemetry

适合后期做链路追踪：
- 收消息
- 判断是否回复
- 调模型
- 发消息
- 回写记忆

如果项目后面变复杂，这会很有帮助。

## 7. 不太推荐的选择

## 7.1 不推荐一开始就上向量数据库

原因：
- 你当前的核心挑战不是“海量知识库检索”
- 而是“群聊决策 + 用户记忆 + 发言节奏”
- 太早上 Milvus / Weaviate / Qdrant 会让系统变重

先把结构化记忆和摘要做好，更重要。

## 7.2 不推荐一开始就用 NestJS

原因：
- 对这个项目来说，前期会比较重
- 会把注意力分散到装饰器、模块化样板代码上
- 你现在最重要的是快速验证机器人行为是否自然

如果后面团队变大、模块变多，再评估也不晚。

## 7.3 不推荐把“是否回复”完全交给模型

原因：
- 成本高
- 延迟高
- 不稳定
- 难调试

“是否回复”应该主要靠规则和状态控制，模型只负责补充语义理解。

## 8. 推荐项目结构

```txt
bot-momo/
  apps/
    bot-server/
      src/
        main.ts
        app.ts
        routes/
        adapters/
        jobs/
  packages/
    core/
    config/
    decision-engine/
    memory/
    llm/
    sender/
  infra/
    docker/
  memory-bank/
    design-document.md
    tech-stack.md
    implementation-plan.md
    progress.md
    architecture.md
  package.json
  pnpm-workspace.yaml
```

## 9. MVP 最小落地组合

如果你想尽快开工，最小可行组合我建议这样：

- Node.js 22
- TypeScript
- pnpm
- Fastify
- PostgreSQL
- Drizzle ORM
- Redis
- BullMQ
- Zod
- Pino
- Vitest

这已经足够把下面这些做出来：
- `@` 必回
- 关键词触发
- 回复门控
- 用户记忆
- 分句发送
- 延迟发送
- 可调试日志

## 10. 一句话建议

最适合这个项目的路线不是“重 AI 框架”，而是“TypeScript 事件系统 + PostgreSQL 记忆层 + Redis 调度层 + LLM 生成层”。

这会比单纯堆模型更像一个真实可控、可长期进化的群聊机器人系统。
