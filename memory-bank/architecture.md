# 架构约束与执行决策

## 1. 文档目的

本文档记录当前阶段已经确认的架构决策、行为约束和默认实现口径。

它的职责不是替代 [design-document.md](C:\Users\wyk24\Desktop\Bot-momo\memory-bank\design-document.md) 或 [implementation-plan.md](C:\Users\wyk24\Desktop\Bot-momo\memory-bank\implementation-plan.md)，而是把开发过程中已经拍板的问题固定下来，避免后续实现再次分叉。

写任何代码前必须完整阅读本文档。

每完成一个重大功能或里程碑后，必须更新本文档，补充：

- 当前实现了什么
- 哪些规则被细化或修改
- 有哪些已知限制
- 下一阶段准备怎么扩展

## 2. 当前项目边界

- 产品形态：真正接入线上群聊平台的群聊机器人
- 首个平台：QQ 群
- 平台接入方案：NapCat
- 目标重点：像真实群友一样参与群聊，而不是客服式问答机器人
- 当前阶段：MVP 优先

当前阶段不做：

- 复杂社交关系图谱
- 自动学习新关键词
- 面向普通用户的管理后台
- 高级向量检索

## 3. 接入层决策

### 3.1 平台与协议

- 第一版平台固定为 QQ 群
- 使用 NapCat 作为平台接入层
- 内部必须先将平台消息转换为统一消息事件，再进入业务流程

说明：

- NapCat 的具体接入协议实现细节可以在真正编码时再落到适配器层
- 但架构上已经确定为“NapCat -> 统一事件 -> 业务链路”

### 3.2 回复行为

- 回复群友时允许引用对方消息
- 第一版建议在以下场景默认优先引用原消息：
  - 平台原生 `@`
  - 回复机器人消息后的再次应答
  - 明确点名机器人名字或别名

目标是让群友更清楚机器人是在回复谁。

## 4. 回复触发规则

### 4.1 必须回复

以下场景属于 `must_reply`：

- QQ 群里被平台原生 `@`
- 群友回复了机器人上一条消息，即使没有 mention
- 命中关键词规则

### 4.2 可以考虑回复

以下场景属于候选回复，不是强制回复：

- 文本中出现机器人名字
- 文本中出现机器人别名
- 语义上明显在和机器人对话，但没有平台原生 `@`
- 主动插话机会出现时，命中概率型主动回复策略

默认口径：

- 文本里出现机器人名字或别名时，先进入 `should_reply` 候选池
- 不是直接 `must_reply`

### 4.3 一定不回

以下场景第一版默认 `skip`：

- 群友只是复读机器人上一句话
- 明显是群友之间互相聊天，且没有点名机器人
- 已经明确标记为不回的场景

## 5. 关键词规则

- 关键词命中后第一版固定为必回
- 关键词优先级仍然保留，用于多关键词同时命中的排序
- 关键词命中后不再进入“是否回复”的二次裁决
- 关键词命中后仍允许参与发送样式决策，例如是否引用原消息、是否拆句

## 6. 冷却与频率控制

### 6.1 当前阶段决策

当前已明确：

- 第一版暂时不考虑冷却问题
- 第一版没有连续发言上限

因此当前执行口径为：

- 不实现“因为发言过多而不回复”的冷却抑制逻辑
- 只允许保留最小的技术性去重与防重复发送能力
- 如果后续重新引入冷却，应作为新一轮架构决策写回本文档

### 6.2 仍然保留的频率控制方式

虽然不做冷却，但第一版仍然保留下面两种控制：

- 概率性主动插话
- 拆句连续性限制

## 7. 主动插话策略

- 第一版必须实现概率性主动插话
- 主动插话不是“看见任何消息都随机回复”
- 主动插话应只发生在与机器人有关、或与机器人熟悉话题相关、或文本里出现机器人名字/别名的候选场景

当前默认约束：

- 主动插话必须经过规则层判断，不能直接无门槛触发
- 主动插话不是为了刷存在感，而是为了模拟真实群友偶尔接话

说明：

- 具体概率数值和分层策略尚未在本文档中定死
- 如后续实现时需要固定默认概率，请优先把默认值追加到本文档

## 8. 人格与表达风格

### 8.1 默认人格

第一版全局使用默认人格，不做按群差异化配置。

默认人格特点：

- 偏朋友感
- 口语化
- 允许适度话痨
- 允许玩梗
- 允许使用语气词
- 允许使用少量表情和颜文字

### 8.2 人格限制

- 不能整段消息全是表情或颜文字
- 不能为了拟人化而显得过度浮夸
- 当前不按群自动漂移人格
- 后续如果支持按群配置人格，由前端页面管理

### 8.3 允许模拟的人类特征

机器人允许“装作有人类情绪/作息”。

当前允许的方向：

- 困
- 忙
- 刚醒
- 想摸鱼
- 情绪化吐槽

注意：

- 这是表达风格层面的拟人化
- 后续如果要进一步定义“可否虚构持续性现实身份”，应在本文档中单独补充

## 9. 记忆系统约束

### 9.1 记忆范围

- 用户记忆按“全局用户唯一”管理
- 同一用户跨群的记忆可以共享

### 9.2 第一版禁止写入长期记忆的敏感信息

- 电话号码
- 身份证号
- 家庭住址

默认要求：

- 发现上述信息时，不写入长期记忆
- 如有必要，连中期摘要也应避免原样保留

### 9.3 可查看范围

- 第一版不允许直接查看用户记忆原文
- 管理接口只能查看摘要化、脱敏后的信息

## 10. 摘要策略

- 第一版优先使用 LLM 做摘要
- 如果 LLM 摘要失败，则回退到规则摘要
- 摘要必须可测试、可回放、可审计
- 群级摘要和用户级摘要都应支持回退机制

### 10.1 模型使用口径

- 生成和摘要不用强制拆成不同模型
- 第一版可以使用同一个 provider 和同一个模型完成生成与摘要

## 11. LLM 提供层约束

第一版必须兼容多提供商。

当前要求支持：

- OpenAI
- Claude Code
- GLM
- DeepSeek
- Kimi

实现约束：

- 业务层不得直接绑定单一厂商 SDK
- 必须通过统一 provider 抽象层接入
- provider 切换应由配置决定

## 12. 拆句发送规则 v1

### 12.1 触发拆句

满足以下条件时拆句：

- 满足全部基础条件中的前两条，或任一强触发条件

基础条件：

- 消息长度大于 45 字
- 不属于“绝不拆句”类型

强触发条件：

- 消息长度大于 90 字
- 含两个以上语义单元
- 同时包含“评价/情绪”和“建议/解释”
- 含明显分段连接词：但是、不过、所以、然后、先、再、因为

### 12.2 拆句数量

- 默认目标：2 句
- 中等复杂：3 句
- 上限：4 句
- 禁止超过 4 句

### 12.3 句间延迟

- 1 到 8 字：600ms 到 1200ms
- 9 到 20 字：900ms 到 1600ms
- 21 到 35 字：1200ms 到 2200ms
- 36 字以上：1800ms 到 2500ms

默认总范围可以概括为 600ms 到 2500ms。

### 12.4 绝不拆句

- 长度小于等于 22 的短消息
- URL、路径、命令、代码、配置
- 单一判断
- 单一命令
- 单一问句
- 道歉、拒绝、澄清、提醒等严肃消息

### 12.5 额外限制

- 如果上一条回复已经拆成 3 句以上，那么接下来 2 分钟内优先单句回复
- 普通闲聊整轮总输出不超过 70 字
- 解释型回复整轮总输出不超过 120 字

## 13. 占位回复规则

- 只在 `@` 场景使用占位回复
- 如果预计等待超过 10 秒，先发占位短句
- 占位后正式回复应立刻补发
- 如果正式回复超时超过 30 秒，则放弃发送正式回复

## 14. 管理接口规则

### 14.1 定位

- 第一版仅用于开发和测试
- 不面向普通用户
- 默认不暴露公网

### 14.2 鉴权

- 第一版必须有最小鉴权
- 推荐并固定为 `X-Admin-Token`
- token 从环境变量读取
- 未携带或错误时返回 401 或 403

### 14.3 查看范围

管理接口可查看：

- 健康状态
- 关键词规则
- 用户记忆摘要
- 最近回复日志

管理接口不可查看：

- 用户记忆原文
- 未脱敏敏感信息

## 15. 测试策略

### 15.1 必须具备

- 单元测试
- 集成测试

### 15.2 建议至少具备

- 2 到 4 条主链路端到端烟雾测试

### 15.3 单元测试覆盖

- 回复决策
- 拆句规则
- 关键词匹配
- 去重判断
- Zod fallback
- 权限判断

### 15.4 集成测试覆盖

- webhook 到 router
- router 到 BullMQ
- worker 到 PostgreSQL
- Redis 状态到决策层
- 管理接口到鉴权到查询

### 15.5 端到端测试覆盖

- 被 `@` 后回复
- 普通消息不回复
- 记忆成功提取并落库
- LLM 坏输出 fallback

### 15.6 外部依赖策略

平台：

- 第一版 E2E 允许完全 mock

LLM：

- 第一版 E2E 允许完全 mock

PostgreSQL：

- 集成测试和 E2E 使用真实容器

Redis：

- 集成测试和 E2E 使用真实容器

内存替身：

- 仅用于单元测试辅助
- 不作为集成测试和 E2E 主方案

## 16. 当前文档状态

本文件已记录当前已拍板的核心架构决策。

后续每做完一个大功能，应继续在本文档补充：

- 实现现状
- 与本文档不一致的新结论
- 需要回补到 design / implementation 的变更点

## 17. 当前实现现状

### 17.1 已完成里程碑

当前已完成 implementation plan 的第 1 步：初始化项目结构。

### 17.2 当前仓库结构

当前已建立以下基础目录：

- `apps/bot-server`
- `packages/core`
- `packages/config`
- `packages/decision-engine`
- `packages/memory`
- `packages/llm`
- `packages/sender`
- `tests`
- `memory-bank`

### 17.3 当前基础工程能力

当前已经具备：

- `pnpm` workspace 结构
- 根级 TypeScript 配置
- 各 package 最小 `tsconfig`
- 根级 ESLint 和 Prettier 配置
- Vitest 测试入口
- `.env.example`
- 最小 bot-server 占位入口

### 17.4 当前验证结果

本轮已完成以下验证：

- `corepack pnpm install`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

验证结果：

- 安装成功
- 类型检查通过
- 测试通过
- 静态检查通过

### 17.5 当前仍未开始的业务能力

以下能力尚未开始实现：

- NapCat 适配器
- 配置加载与校验逻辑
- 消息事件模型
- 回复决策引擎
- 关键词规则
- 记忆系统
- LLM provider 层
- 发送调度

### 17.6 下一步建议

下一步进入 implementation plan 第 2 步：建立配置系统。

## 18. 配置系统实现现状

### 18.1 已实现能力

当前已完成 implementation plan 第 2 步：建立配置系统。

已实现内容：

- `packages/config` 统一配置模块
- 基于 Zod 的配置校验
- 启动期失败快报错
- 默认值策略
- 布尔值和数字字符串解析
- 机器人别名列表解析
- `bot-server` 占位入口已接入配置加载

### 18.2 当前配置覆盖范围

当前已覆盖的配置项包括：

- 应用端口
- 日志级别
- NapCat 基础地址
- NapCat access token
- 管理接口 token
- 默认 provider
- 机器人名称
- 机器人别名
- 主动插话开关
- 主动插话基础概率
- 分句发送开关
- 关键词触发开关
- PostgreSQL 连接串
- Redis 连接串

### 18.3 当前默认值

当前默认值已固定为：

- `NODE_ENV=development`
- `PORT=3000`
- `LOG_LEVEL=info`
- `DEFAULT_PROVIDER=openai`
- `BOT_NAME=momo`
- `ACTIVE_REPLY_ENABLED=true`
- `ACTIVE_REPLY_BASE_PROBABILITY=0.15`
- `SENTENCE_SPLIT_ENABLED=true`
- `KEYWORD_TRIGGER_ENABLED=true`

### 18.4 当前验证结果

本轮已完成以下验证：

- 缺失必填配置时抛出 `ConfigError`
- 布尔值解析正确
- 数字和概率值解析正确
- 非法布尔值失败
- 非法概率值失败

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 18.5 当前已知限制

- 尚未接入 `.env` 文件读取，当前配置入口基于 `process.env`
- 尚未按 provider 拆分各自专属配置
- 尚未接入健康检查与依赖状态输出

### 18.6 下一步建议

下一步进入 implementation plan 第 3 步：建立日志与请求追踪能力。

## 19. 日志与请求追踪实现现状

### 19.1 已实现能力

当前已完成 implementation plan 第 3 步：建立日志与请求追踪能力。

已实现内容：

- `packages/core` 中的统一 logger 创建入口
- 统一 JSON 日志格式
- `traceId` 生成与链路传递
- 固定事件日志 helper
- 错误日志结构化输出
- `bot-server` 启动日志接入

### 19.2 当前固定日志事件

当前已定义并可直接复用的日志事件包括：

- `message.received`
- `reply.decision`
- `send.task.queued`
- `memory.write`
- `processing.error`
- `app.startup`

### 19.3 当前固定链路字段

当前日志链路中重点固定的字段包括：

- `service`
- `traceId`
- `messageId`
- `groupId`
- `userId`
- `event`

不同事件会附加各自业务字段，例如：

- `decision`
- `reason`
- `confidence`
- `taskId`
- `sentenceCount`
- `memoryScope`
- `phase`

### 19.4 当前验证结果

本轮已完成以下验证：

- 同一条模拟消息处理链路中的所有日志共享同一个 `traceId`
- 消息接收、决策、发送任务、记忆写入都能输出结构化日志
- 异常日志包含 `traceId`、`phase` 和结构化错误对象

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 19.5 当前已知限制

- 目前 trace 仍是进程内基础实现，尚未接入 HTTP request 或 NapCat 事件入口
- 目前尚未实现日志持久化或外部采集
- 当前仅覆盖了基础事件类型，后续会随业务模块继续补充

### 19.6 下一步建议

下一步进入 implementation plan 第 4 步：实现健康检查与服务启动入口。

## 20. 健康检查与启动入口实现现状

### 20.1 已实现能力

当前已完成 implementation plan 第 4 步：实现健康检查与服务启动入口。

已实现内容：

- 基于 Fastify 的最小服务实例
- `/health/live` 存活检查接口
- `/health` 健康检查接口
- 启动期依赖状态输出
- 基础 HTTP 错误处理
- 启动入口从“输出状态”升级为“实际监听端口”

### 20.2 当前健康检查接口

当前已提供两个最小接口：

- `/health/live`
  - 用于判断服务是否存活
- `/health`
  - 用于查看服务是否可用、配置摘要和依赖状态

### 20.3 当前健康检查返回内容

`/health` 当前返回：

- 服务名
- `ok` 状态
- 当前启用的 provider
- 当前机器人名称
- 主动插话开关状态
- NapCat / PostgreSQL / Redis 的配置可见性状态

说明：

- 当前依赖状态仍是“配置可用性”级别，不是实际网络连通性探测
- 后续接入数据库和 Redis 客户端后，可以升级为真实探针

### 20.4 当前验证结果

本轮已完成以下验证：

- 健康检查接口可通过 Fastify 注入测试访问
- `/health/live` 返回 200
- `/health` 返回依赖状态信息
- 健康检查结果可区分应用存活与依赖配置状态

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 20.5 当前已知限制

- 尚未接入真实 PostgreSQL / Redis 连接探针
- 尚未接入 NapCat 平台事件入口
- 当前启动日志仍是单进程本地能力

### 20.6 下一步建议

下一步进入 implementation plan 第 5 步：建立数据库模型与迁移机制。

## 21. 数据库模型与迁移实现现状

### 21.1 已实现能力

当前已完成 implementation plan 第 5 步：建立数据库模型与迁移机制。

已实现内容：

- 基于 Drizzle ORM 的 PostgreSQL schema
- 根级 `drizzle.config.ts`
- 数据库迁移生成脚本
- 数据库迁移执行脚本
- 数据结构验证脚本
- 本地 PostgreSQL / Redis 的 Docker Compose 定义

### 21.2 当前已落地的核心表

当前数据库模型已覆盖以下 MVP 表：

- `groups`
- `users`
- `messages`
- `keyword_rules`
- `user_memories`
- `memory_facts`
- `conversation_summaries`
- `reply_logs`

### 21.3 当前结构约束

当前已明确：

- `groups` 使用 `(platform, external_group_id)` 唯一索引
- `users` 使用 `(platform, external_user_id)` 唯一索引
- `messages` 建立群、用户、回复链索引
- `keyword_rules` 建立启用状态与优先级索引
- `memory_facts` 建立用户与 scope 索引
- `reply_logs` 建立消息和 trace 索引

并已使用 enum 固定以下字段：

- 关键词匹配方式
- 记忆层级
- 摘要作用域
- 回复状态

### 21.4 当前迁移流程

当前已具备以下脚本：

- `corepack pnpm db:generate`
- `corepack pnpm db:migrate`
- `corepack pnpm db:verify`

### 21.5 当前验证结果

本轮已完成以下验证：

- 在空数据库上成功生成首个迁移文件
- 在真实 PostgreSQL 容器上成功执行迁移
- 再次执行迁移成功，验证可重复执行
- 插入最小测试数据成功
- 查询最小测试数据成功

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 21.6 当前已知限制

- 当前数据库验证依赖本地 Docker Desktop
- 当前依赖状态尚未接入真实数据库连通性探针
- 还没有 repository / query service 层
- 还没有消息入库和回复日志写入逻辑，只完成了结构准备

### 21.7 下一步建议

下一步进入 implementation plan 第 6 步：建立 Redis 连接与基础状态能力。

## 22. Redis 连接与基础状态实现现状

### 22.1 已实现能力

当前已完成 implementation plan 第 6 步：建立 Redis 连接与基础状态能力。

已实现内容：

- 基于 `redis` 客户端的连接创建入口
- Redis 重连策略
- Redis 连接事件日志
- 通用 key 前缀与命名规范
- TTL 策略常量
- 基础文本 / JSON 读写封装
- Redis 验证脚本

### 22.2 当前 key 规范

当前 key 统一格式为：

- `bot-momo:{namespace}:{part1}:{part2}...`

当前已预留的 namespace 包括：

- `dedupe`
- `short-state`
- `active-reply`
- `send-task`
- `context`
- `test`

### 22.3 当前 TTL 策略

当前已固定的 TTL 策略包括：

- `dedupe`
- `shortTermState`
- `activeReply`
- `sendTask`
- `test`

说明：

- 当前 TTL 值已集中在代码中统一定义
- 后续业务模块必须复用这些策略，而不是各自随意写过期秒数

### 22.4 当前日志事件

当前 Redis 连接层已输出以下诊断日志：

- `redis.connect`
- `redis.ready`
- `redis.reconnecting`
- `redis.error`
- `redis.end`

### 22.5 当前验证结果

本轮已完成以下验证：

- Redis key 命名测试通过
- Redis 文本 / JSON 读写测试通过
- Redis 连接事件日志测试通过
- 在真实 Redis 容器上完成连接、写入、读取、过期验证

并已通过：

- `corepack pnpm redis:verify`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 22.6 当前已知限制

- 当前 Redis 层还是基础设施，尚未接入去重、主动插话或发送调度业务
- 当前 Redis 健康状态尚未接入 `/health` 的真实连通性探针
- 当前只实现了基础状态封装，没有做批量操作或锁语义

### 22.7 下一步建议

下一步进入 implementation plan 第 7 步：定义统一消息事件模型。
## 23. 统一消息事件模型实现现状

### 23.1 已实现能力

当前已完成 implementation plan 第 7 步：定义统一消息事件模型。

已实现内容：

- 在 `packages/core` 中新增统一消息事件契约
- 定义标准 mention 结构
- 定义标准 reply/reference 结构
- 定义标准发送结果结构
- 新增统一消息事件解析入口
- 新增统一发送结果解析入口
- 对无效事件统一返回结构化校验错误

### 23.2 当前统一消息事件字段

当前标准消息事件已覆盖以下字段：

- `eventType`
- `platform`
- `messageId`
- `groupId`
- `userId`
- `nickname`
- `content`
- `timestamp`
- `mentions`
- `replyTo`
- `rawPayload`

说明：

- 所有平台消息在进入业务层前都必须先转换成这套结构
- `rawPayload` 继续保留平台原始载荷，便于审计、排障和回放

### 23.3 当前标准发送结果字段

当前标准发送结果已覆盖以下字段：

- `status`
- `platform`
- `target`
- `requestId`
- `providerMessageId`
- `traceId`
- `sentenceIndex`
- `sentenceCount`
- `sentAt`
- `skippedReason`
- `errorCode`
- `errorMessage`
- `rawResponse`

说明：

- 发送层后续必须统一输出该结构
- 这样后续 reply log、发送调度和适配器层可以共享同一契约

### 23.4 当前无效事件处理规则

当前已明确：

- 缺失必填字段的事件直接拒绝进入业务链路
- `content` 在 trim 后为空的事件直接拒绝
- 校验失败统一返回 `schema_invalid`
- 校验错误会附带字段级 issues，便于日志记录与适配器排障

### 23.5 当前验证结果

本轮已完成以下验证：

- 标准消息事件可正确通过校验
- mention 与 reply 关系可正确表达
- 缺失关键字段的事件会被拒绝
- 空内容事件会被拒绝
- 标准发送结果可正确通过校验
- 非法发送目标会被拒绝

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 23.6 当前已知限制

- 当前仅完成统一契约与校验，还未接入 NapCat 实际 payload 转换
- 当前事件模型只覆盖 `message.created`，尚未扩展撤回、编辑或系统通知事件
- 当前 `rawPayload` 与 `rawResponse` 仍为宽松保留字段，脱敏策略将在后续入库阶段补齐

### 23.7 下一步建议

下一步进入 implementation plan 第 8 步：实现 NapCat 平台适配器骨架。

## 24. NapCat 适配器骨架实现现状

### 24.1 已实现能力

当前已完成 implementation plan 第 8 步：实现 NapCat 平台适配器骨架。

已实现内容：

- 在 `apps/bot-server` 中新增 NapCat 适配器模块
- 新增 NapCat group message 到统一消息事件的转换逻辑
- 新增 NapCat webhook 处理入口
- 新增统一事件回调注入点
- 新增 NapCat group message 发送抽象
- 新增统一发送结果转换
- 将 NapCat HTTP 入口接入 Fastify 服务

### 24.2 当前接收入口

当前已提供最小接收入口：

- `POST /adapters/napcat/events`

当前入口职责固定为：

- 接收 NapCat payload
- 转换为统一事件
- 调用内部事件处理回调
- 返回统一的 accepted / ignored 结果

说明：

- 当前入口只做协议转换与边界校验
- 当前不在适配器层内写业务规则、回复决策或记忆逻辑

### 24.3 当前支持的入站消息范围

当前第一版仅支持：

- `post_type=message`
- `message_type=group`

当前第一版会忽略：

- 非 `message` 事件
- 非群消息事件
- 无法转换成统一事件的异常 payload

当前忽略结果会输出：

- `napcat.event.ignored` 日志
- 结构化 `reason`
- 可定位的 `details`

### 24.4 当前转换规则

当前已明确：

- `message_id` -> `messageId`
- `group_id` -> `groupId`
- `user_id` -> `userId`
- `sender.card` 优先于 `sender.nickname`
- `raw_message` 优先作为统一事件 `content`
- `message` 数组中的 `at` segment 转为统一 `mentions`
- `message` 数组中的 `reply` segment 转为统一 `replyTo`
- 原始 NapCat payload 保留在 `rawPayload`

### 24.5 当前发送抽象

当前已实现最小发送接口：

- 目标接口：NapCat `send_group_msg`
- 支持普通群消息发送
- 支持附带 reply segment 的引用回复
- 返回统一发送结果结构

说明：

- 发送层当前只完成协议封装与结果标准化
- 真正的发送调度、分句、重试和发送日志将在后续步骤接入

### 24.6 当前验证结果

本轮已完成以下验证：

- NapCat group message 可正确转换为统一事件
- `at` 与 `reply` 关系可正确映射
- 非支持 payload 会被忽略而不是错误进入业务链路
- Fastify NapCat webhook 入口可正确返回 accepted 结果
- Fastify NapCat webhook 入口可正确返回 ignored 结果
- NapCat sender 可生成标准发送请求并返回统一发送结果

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 24.7 当前已知限制

- 当前只覆盖 NapCat 群消息，不覆盖私聊、撤回、编辑、notice 或 meta_event 业务处理
- 当前 webhook 未增加额外入站鉴权，后续可根据 NapCat 实际部署方式补充
- 当前 sender 只覆盖 group send path，未覆盖图片、文件、合并转发等消息类型
- 当前事件处理回调仍是空业务入口，后续会接入消息入库和审计链路

### 24.8 下一步建议

下一步进入 implementation plan 第 9 步：实现消息入库与基础审计。

## 25. 消息入库与基础审计实现现状

### 25.1 已实现能力

当前已完成 implementation plan 第 9 步：实现消息入库与基础审计。

已实现内容：

- 在 `packages/memory` 中新增消息审计编排模块
- 实现统一事件到数据库记录的入库编排
- 实现群记录与用户记录的自动 upsert
- 实现消息去重 key 规则
- 实现原始 payload 与标准字段的持久化
- 实现基础审计查询接口
- 实现基础 reply log 写入
- 将 NapCat 事件回调接入消息入库链路

### 25.2 当前入库策略

当前已明确：

- `group_id` 统一映射到平台化 `group` 记录主键
- `user_id` 统一映射到平台化 `user` 记录主键
- `message_id` 统一映射到平台化 `message` 记录主键
- 首次收到事件时先 upsert 群和用户，再写入消息表
- `rawPayload` 保留原始 NapCat 载荷
- `mentionedBot` 根据统一事件 mention 信息写入
- `replyTo` 会映射到统一的持久化消息 id

### 25.3 当前去重策略

当前已实现：

- 入站消息 dedupe key：`incoming-message:{platform}:{messageId}`
- dedupe 状态保存在 Redis `dedupe` TTL 策略下
- 如果 dedupe 命中，则本轮事件返回 `duplicate`
- 如果数据库层发生主键冲突，则消息写入结果也会回退为 `duplicate`

说明：

- 当前去重目标是保证消息入库幂等
- 当前不负责回复发送层的防重复发送，那部分仍在后续步骤实现

### 25.4 当前审计能力

当前已具备以下基础审计能力：

- 通过持久化消息主键查询标准审计记录
- 在消息首次入库后写入基础 reply log
- 当前默认写入一条 `audited_only` / `skip` 的占位审计记录

说明：

- 这条基础 reply log 的作用是先打通消息审计闭环
- 真正的决策动作、回复内容和发送状态将在后续决策与发送步骤覆盖

### 25.5 当前验证结果

本轮已完成以下验证：

- 首次统一事件可正确完成群、用户、消息的入库编排
- 审计记录可从持久化 id 读取
- dedupe 命中时会直接返回 `duplicate`
- 平台化 group/user/message id 规则稳定可预测
- NapCat 事件回调已接入真实入库编排链路

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 25.6 当前已知限制

- 当前测试以可控内存持久化替身验证编排逻辑，数据库真连通集成校验会在后续更完整链路中继续补强
- 当前 reply log 仍是基础占位审计，不代表真实回复决策结果
- 当前尚未对 `rawPayload` 做更细粒度脱敏
- 当前还没有管理接口层去读取这些审计数据

### 25.7 下一步建议

下一步进入 implementation plan 第 10 步：实现关键词规则存储与读取。

## 26. 关键词规则存储与读取实现现状

### 26.1 已实现能力

当前已完成 implementation plan 第 10 步：实现关键词规则存储与读取。

已实现内容：

- 在 `packages/memory` 中新增关键词规则模块
- 实现关键词规则保存接口
- 实现关键词规则启用 / 禁用接口
- 实现启用规则读取接口
- 实现启用规则排序规则
- 实现启用规则 Redis 缓存
- 实现写入后缓存失效

### 26.2 当前读取规则

当前启用规则读取时固定遵循：

- 只返回 `enabled=true` 的规则
- 优先按 `priority` 升序
- 再按最近更新时间和关键字做稳定排序

说明：

- 当前这一步只负责提供稳定规则输入源
- 真正的关键词命中判断将在后续步骤接入决策引擎

### 26.3 当前缓存策略

当前已实现：

- 活跃关键词缓存 key：`bot-momo:short-state:keyword-rules:active`
- 首次读取从存储层加载并写入 Redis
- 后续读取优先命中缓存
- 规则保存后主动失效缓存
- 规则启用状态变更后主动失效缓存

### 26.4 当前验证结果

本轮已完成以下验证：

- 多条启用规则可按优先级顺序读取
- 读取结果可通过缓存命中复用
- 禁用某条规则后不会再出现在启用列表
- 不同 `matchType` 元数据在读写过程中保持稳定

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 26.5 当前已知限制

- 当前还没有关键词命中逻辑，只完成规则数据源
- 当前缓存 TTL 复用了短期状态策略，后续可按业务压测再单独调整
- 当前没有管理接口去操作规则，这会在后续管理接口步骤补齐

### 26.6 下一步建议

下一步进入 implementation plan 第 11 步：实现消息是否与机器人相关的基础判定。

## 27. 消息相关性基础判定实现现状

### 27.1 已实现能力

当前已完成 implementation plan 第 11 步：实现消息是否与机器人相关的基础判定。

已实现内容：

- 在 `packages/decision-engine` 中新增基础相关性判定模块
- 支持平台 mention 判定
- 支持机器人名字判定
- 支持机器人别名判定
- 支持回复机器人消息判定
- 支持最小延续上下文短语判定
- 输出统一的相关性结果、原因和置信度

### 27.2 当前判定结果结构

当前判定结果固定输出：

- `related`
- `reason`
- `shouldReply`
- `confidence`

当前 `reason` 已覆盖：

- `mentioned`
- `bot_name`
- `bot_alias`
- `replied_to_bot`
- `continued_context`
- `not_relevant`

### 27.3 当前判定边界

当前已明确：

- 平台 mention 直接视为强相关
- 引用机器人消息直接视为强相关
- 文本中出现机器人名字或别名时视为相关
- 命中“你怎么看 / 刚才问你 / 你人呢”等延续短语时视为上下文相关
- 普通群友互聊默认判定为不相关

说明：

- 当前仍是基础判定层，不代表最终回复决策
- 最终是否回复还要叠加后续 `must_reply / should_reply / skip` 规则

### 27.4 当前验证结果

本轮已完成以下验证：

- 平台 mention 可判定为强相关
- 回复机器人消息可判定为强相关
- 机器人名字和别名可分别命中
- 延续上下文短语可命中基础相关性
- 普通群聊消息会保持不相关

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 27.5 当前已知限制

- 当前延续上下文仍是启发式短语，不包含复杂语义推理
- 当前还没有接入关键词命中与最终决策优先级整合
- 当前没有利用更长的群聊上下文窗口，只用了最小必要上下文

### 27.6 下一步建议

下一步进入 implementation plan 第 12 步：实现 `@` 必回规则。

## 28. `@` 必回规则实现现状

### 28.1 已实现能力

当前已完成 implementation plan 第 12 步：实现 `@` 必回规则。

已实现内容：

- 在 `packages/decision-engine` 中新增 `@` 必回规则模块
- 将 `mentioned` 相关性结果提升为 `must_reply`
- 保留非 mention 场景的原始原因与置信度
- 明确 mention 规则不可被低优先级 fallback 覆盖

### 28.2 当前规则边界

当前已明确：

- 只要基础相关性原因是 `mentioned`，决策结果固定为 `must_reply`
- `mentioned` 的置信度固定为 `1`
- 非 mention 场景不在本步骤被强制抬高
- 非相关消息仍保持 `skip`

### 28.3 当前验证结果

本轮已完成以下验证：

- mention 场景会稳定返回 `must_reply`
- 名字相关但非 mention 的消息不会被误判为 `must_reply`
- 普通不相关消息会保持 `skip`

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 28.4 当前已知限制

- 当前仅覆盖 `@` 必回，不包含关键词必回和总决策整合
- 当前决策结果还没有接入完整回复生成链路

### 28.5 下一步建议

下一步进入 implementation plan 第 13 步：实现基础去重与防重复发送。

## 29. 基础去重与防重复发送实现现状

### 29.1 已实现能力

当前已完成 implementation plan 第 13 步：实现基础去重与防重复发送机制。

已实现内容：

- 在 `packages/sender` 中新增发送任务去重模块
- 实现发送任务幂等 key 生成
- 实现发送任务 claim 入口
- 支持单条发送任务防重
- 支持按 sentence index 隔离的拆句发送任务防重

### 29.2 当前去重策略

当前已明确：

- 发送任务 dedupe key 结构：`bot-momo:send-task:{messageId}:{taskId}:{sentenceIndex|single}`
- 同一消息、同一任务、同一句序号只允许首次 claim 成功
- 再次 claim 同一任务时会返回 `duplicate=true`
- 不同 sentence index 的拆句任务彼此独立

### 29.3 当前验证结果

本轮已完成以下验证：

- 单条发送任务 key 稳定可预测
- 重复 claim 同一发送任务时会被识别为 duplicate
- 拆句发送任务在不同 sentence index 下互不冲突

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 29.4 当前已知限制

- 当前只完成发送任务防重，不包含真实发送调度
- 当前尚未把发送层防重接入 NapCat sender 调用链
- 当前还没有失败重试与状态回写

### 29.5 下一步建议

下一步进入 implementation plan 第 14 步：实现关键词命中判断。

## 30. 关键词命中判断实现现状

### 30.1 已实现能力

当前已完成 implementation plan 第 14 步：实现关键词命中判断。

已实现内容：

- 在 `packages/decision-engine` 中新增关键词命中模块
- 支持 `exact` 命中
- 支持 `fuzzy` 命中
- 支持 `regex` 命中
- 支持多规则优先级排序后命中
- 会忽略禁用规则
- 会忽略非法正则规则

### 30.2 当前命中结果结构

当前命中结果固定输出：

- `matched`
- `reason`
- `ruleId`
- `keyword`
- `matchType`
- `priority`
- `responseMode`

未命中时固定输出：

- `matched=false`
- `reason=no_keyword_match`

### 30.3 当前规则边界

当前已明确：

- 规则优先按 `priority` 升序决出先后
- 同一轮判断只返回第一条命中的有效规则
- `regex` 命中使用大小写不敏感模式
- 非法正则不会抛出异常，而是安全地视为未命中

### 30.4 当前验证结果

本轮已完成以下验证：

- 多规则场景会按优先级返回首个有效命中
- `fuzzy` 和 `regex` 可正确命中
- 禁用规则不会命中
- 非法正则不会误判或中断流程

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 30.5 当前已知限制

- 当前只完成命中判断，还未接入总决策优先级整合
- 当前 `exact` 与 `fuzzy` 仍使用基础字符串包含逻辑，后续可按真实群聊噪声再收紧边界

### 30.6 下一步建议

下一步进入 implementation plan 第 15 步：实现总回复决策引擎与主动插话入口。

## 31. 总回复决策引擎与主动插话入口实现现状

### 31.1 已实现能力

当前已完成 implementation plan 第 15 步：实现总回复决策引擎与主动插话入口。

已实现内容：

- 在 `packages/decision-engine` 中新增总决策引擎模块
- 整合 mention 必回、关键词命中、基础相关性判定和主动插话概率入口
- 输出统一的 `must_reply / should_reply / skip` 决策结果
- 保留基础相关性结果
- 保留关键词命中结果
- 支持注入固定随机值，便于测试主动插话逻辑

### 31.2 当前优先级顺序

当前总决策引擎已固定以下优先级：

- mention -> `must_reply`
- keyword_hit -> `must_reply`
- relevance.shouldReply -> `should_reply`
- active_reply_candidate -> `should_reply`
- not_relevant -> `skip`

说明：

- 主动插话只在前面都没有命中时才会进入
- 当前主动插话仍是候选入口，不是最终发送行为

### 31.3 当前主动插话规则

当前已明确：

- 主动插话受 `enabled` 开关控制
- 主动插话受 `baseProbability` 控制
- 主动插话支持注入 `randomValue`，便于稳定测试
- 当随机值小于基础概率时，返回 `active_reply_candidate`

### 31.4 当前验证结果

本轮已完成以下验证：

- mention 场景会优先返回 `must_reply`
- 关键词命中场景会优先返回 `must_reply`
- 普通相关消息会返回 `should_reply`
- 无关消息在命中主动插话概率时会返回 `active_reply_candidate`
- 无关消息在未命中主动插话概率时会返回 `skip`

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 31.5 当前已知限制

- 当前总决策引擎仍是纯函数，还未接入应用层主处理链路
- 当前尚未整合回复机器人消息必回等更细的业务规则
- 当前主动插话仍未接入群聊热度、近期话题等更复杂门槛

### 31.6 下一步建议

下一步进入 implementation plan 第 16 步：实现用户记忆基础模型。

## 32. 用户记忆基础模型实现现状

### 32.1 已实现能力

当前已完成 implementation plan 第 16 步：实现用户记忆基础模型。

已实现内容：

- 在 `packages/memory` 中新增用户记忆模型模块
- 支持新用户记忆初始化
- 支持用户记忆读取或创建
- 支持用户记忆定向更新
- 支持更新时间维护

### 32.2 当前记忆字段

当前已覆盖：

- `nicknameHistory`
- `aliases`
- `traits`
- `preferences`
- `relationshipSummary`
- `lastInteractionAt`

### 32.3 当前验证结果

本轮已完成以下验证：

- 新用户可创建最小记忆档案
- 同一用户重复读取不会重复初始化
- 对一个用户的更新不会污染其他用户

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 32.4 下一步建议

下一步进入 implementation plan 第 17 步：实现短期上下文存储。

## 33. 短期上下文存储实现现状

### 33.1 已实现能力

当前已完成 implementation plan 第 17 步：实现短期上下文存储。

已实现内容：

- 在 `packages/memory` 中新增短期上下文窗口模块
- 支持群级上下文窗口
- 支持群内用户级上下文窗口
- 支持窗口裁剪
- 支持统一事件转短期上下文消息

### 33.2 当前上下文 key 规则

当前已固定：

- 群上下文 key：`bot-momo:context:group:{groupId}`
- 群内用户上下文 key：`bot-momo:context:group-user:{groupId}:{userId}`

### 33.3 当前验证结果

本轮已完成以下验证：

- 群上下文窗口超限后会裁剪旧消息
- 群内用户上下文按群和用户维度隔离
- mention 标记可正确写入短期上下文消息

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 33.4 下一步建议

下一步进入 implementation plan 第 18 步：实现记忆写入筛选规则。

## 34. 记忆写入筛选规则实现现状

### 34.1 已实现能力

当前已完成 implementation plan 第 18 步：实现记忆写入筛选规则。

已实现内容：

- 在 `packages/memory` 中新增记忆候选分类器
- 支持小聊废话过滤
- 支持敏感信息丢弃
- 支持偏好型信息识别
- 支持计划型信息识别
- 支持普通消息仅落短期上下文

### 34.2 当前筛选结果

当前支持输出：

- `discard`
- `short_term`
- `mid_term`
- `long_term`

并附带：

- `reason`
- `confidence`

### 34.3 当前验证结果

本轮已完成以下验证：

- 偏好表达会进入长期候选
- 计划表达会进入中期候选
- 手机号等敏感信息会被丢弃
- 小聊废话会被丢弃
- 普通消息会保留在短期层

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 34.4 下一步建议

下一步进入 implementation plan 第 19 步：实现 LLM 提供层骨架。

## 35. LLM 提供层骨架实现现状

### 35.1 已实现能力

当前已完成 implementation plan 第 19 步：实现 LLM 提供层骨架。

已实现内容：

- 在 `packages/llm` 中新增统一 provider 抽象
- 支持多 provider 标识
- 支持任务类型区分
- 支持统一超时控制
- 支持统一错误包装
- 支持空输出校验

### 35.2 当前统一错误类型

当前已统一为：

- `timeout`
- `upstream_failure`
- `invalid_output`

### 35.3 当前验证结果

本轮已完成以下验证：

- 正常响应可通过统一 provider 返回
- 超时会包装为统一 timeout 错误
- 上游失败会包装为统一 upstream_failure 错误
- 空输出会包装为统一 invalid_output 错误

并已通过：

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm lint`

### 35.4 下一步建议

下一步进入 implementation plan 第 20 步：实现回复生成最小链路。

## 36. 回复生成、分句调度与发送记录实现现状

### 36.1 已实现能力

当前已完成 implementation plan 第 20 步到第 24 步：

- 实现最小回复生成链路
- 实现 `@` 场景占位回复判断与兜底短句
- 实现分句策略
- 实现延迟发送调度
- 实现发送结果记录更新

### 36.2 当前回复生成链路

当前应用层已经打通以下最小闭环：

- 入站消息完成入库与决策
- 从群短期上下文和用户短期上下文组装回复上下文
- 从用户记忆读取关系摘要
- 调用统一 LLM provider 生成回复
- LLM 失败时回退到规则兜底短句

说明：

- 当前仍使用启发式 transport 作为最小可测实现
- 真实多 provider HTTP 接入将在后续阶段替换 transport 层，不改变业务接口

### 36.3 当前占位与分句规则落地

当前已落地的发送前处理包括：

- `@` 场景下的占位触发判断函数
- 占位回复放弃条件
- 长短消息拆句判断
- 最多 4 句的拆句边界
- URL、代码、严肃消息等不拆句规则
- 基于句长的默认延迟档位

当前默认调度口径：

- 首句立即发送
- 后续句子按长度映射到 900ms / 1200ms / 1800ms / 2200ms 的默认延迟
- 调度层保证顺序发送，不并发乱序

### 36.4 当前发送与审计状态

当前发送链路已经具备：

- 发送任务去重 claim
- 分句任务顺序发送
- 发送成功后写回 `reply_logs.status=sent`
- 发送失败时写回 `reply_logs.status=failed`
- 记录发送次数与内容摘要

这意味着：

- 某条原始消息现在已经可以追踪到决策、生成、发送和状态回写
- 回复日志不再只是 queued 占位

### 36.5 当前已知限制

- 占位回复规则当前已实现判断与发送接口，但主链路默认不会频繁触发，因为当前最小生成链路超时较短
- 延迟调度当前是进程内顺序执行，还没有接入 BullMQ 队列
- 发送失败当前只记录失败状态，还没有实现正式的重试策略
- 拆句连续冷却和整轮字数上限还没有在调度层强制执行

### 36.6 下一步建议

下一步进入 implementation plan 第 25 步：实现记忆回写。

## 37. 记忆回写、摘要、管理接口与验收现状

### 37.1 已实现能力

当前已完成 implementation plan 第 25 步到第 30 步：

- 互动后记忆回写
- 群级与用户级最近对话摘要
- 最小管理接口
- 端到端消息回放测试
- 异常与降级测试
- MVP 验收报告输出

### 37.2 当前记忆回写闭环

当前一轮成功互动结束后已经会执行：

- 依据记忆筛选规则判断写入层级
- 更新用户昵称历史
- 更新最近互动时间
- 对长期偏好写入 `preferences`
- 对中长期事实写入 `memory_facts`
- 更新关系摘要 `relationshipSummary`

当前额外约束：

- 记忆回写会先清洗输入，避免把前缀 `@momo` 一起写入长期记忆
- 小聊废话和敏感信息仍会被拦截，不进入长期记忆

### 37.3 当前摘要策略

当前群级与用户级摘要都已接入：

- 优先走统一 LLM provider 的 summary 任务
- summary 失败时回退到规则摘要
- 每轮成功回复后都会刷新 group summary 和 user summary
- 摘要记录写入 `conversation_summaries`

说明：

- 当前最小实现使用启发式 transport，先把接口与回退链路冻结
- 后续替换真实 provider 时不需要改业务层摘要入口

### 37.4 当前管理接口

当前已提供最小内部调试接口：

- `GET /admin/health`
- `GET /admin/keyword-rules`
- `POST /admin/keyword-rules`
- `GET /admin/users/:userId/memory`
- `GET /admin/reply-logs`

鉴权规则已固定为：

- 必须携带 `X-Admin-Token`
- token 不匹配时返回 `401`

当前管理接口返回边界：

- 可查看关键词规则
- 可查看用户记忆摘要与 memory facts
- 可查看最近回复日志
- 不直接暴露用户原始长期记忆文本集合之外的敏感原文读取入口

### 37.5 当前测试与验收状态

当前自动化测试已覆盖：

- 单元测试
- 集成风格路由测试
- 端到端消息回放测试
- 异常与降级测试

当前重点覆盖的 MVP 主链路包括：

- 被 `@` 后必须回复
- 普通无关消息不回复
- 关键词命中后出现
- 回复可拆成多句顺序发送
- 用户偏好被稳定写入记忆
- LLM 失败时使用兜底短句
- 发送失败时写回失败状态并输出日志

### 37.6 当前已知限制

- 还没有在真实 QQ 群环境完成最终人工联调，本轮验收以自动化结果为主
- NapCat 已接入，但当前仍未包含更多事件类型，只覆盖群消息主链路
- 发送调度仍是进程内顺序执行，未接入正式队列和重试退避
- 占位回复规则已具备接口与判断，但在当前最小生成链路下默认不常触发

### 37.7 下一步建议

下一阶段优先做三件事：

- 接真实 provider HTTP transport
- 接 BullMQ 任务队列与重试
- 在真实 QQ 群做一轮人工灰度联调
