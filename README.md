# AI Infra Space

一个持续生长的 AI Infra 开放知识空间：系统课程、SGLang 源码阅读，以及可追溯的全球新闻信号。

线上地址：<https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/>

## 信息架构

- `#/`：模块化门户首页。新增模块只需扩展 `src/data/modules.ts`。
- `#/learn`：AI Infra 课程地图，按“基础 → 框架 → 硬件与算子”组织。
- `#/models/*`：可交互模型结构实验室，可检查权重、张量 Shape、TP 分片和知识索引。
- `#/category/*`、`#/article/*`：主题与文章详情，支持中文/英文切换。
- `#/news`：AI、科技、金融、国际形势四板块的每日信号与每周报告。

## 本地开发

建议使用 Node.js 20：

```bash
npm ci
npm run dev
```

质量检查：

```bash
npm run check
npm run lint
npm run build
```

## 同步 SGLang Tutor 课程

网站会通过 `import.meta.glob` 自动建立双语课程索引，因此新增文章不需要手写 TypeScript import。

当 `SGLang_Tutor` 与本仓库位于同一父目录时：

```bash
npm run sync:curriculum
```

也可以显式传入本地仓库路径：

```bash
SGLANG_TUTOR_PATH=/path/to/SGLang_Tutor npm run sync:curriculum
```

同步脚本只复制 `learning/zh` 与 `learning/en` 中的 Markdown、Python 教学代码和图片资源，不会读取或提交源仓库的 Git 配置、凭证与本地索引。

## 新闻雷达

### 每日采集

`.github/workflows/daily-news.yml` 每天 `00:30 UTC` 运行。它从公开 RSS/Atom 信源采集新闻，执行 URL 清理、标题去重、时间窗口过滤和信源/时效加权，并写入：

- `src/data/news/daily.json`：网页当前内容；
- `src/data/news/library.json`：近 90 天的 AI Infra 工程与研究长读；
- `src/data/news/archive/YYYY-MM-DD.json`：周报所需的七日公开数据。

本地可运行：

```bash
npm run news:fetch
```

信源配置位于 `scripts/news-sources.mjs`，目前覆盖论文与研究、AI 推理框架发布、PyTorch/NVIDIA/AMD 等工程博客、央行与国际机构原文和多地区国际媒体。排序会额外提升 inference、serving、kernel、compiler、GPU/NPU、quantization、attention 等技术信号的权重；arXiv 条目还会经过标题关键词过滤，避免泛化的分布式系统论文挤占版面。

页面分为每日信号、技术长读、历史归档、阅读清单四个视图，支持来源类别、技术主题、关键词组合筛选。归档按日期延迟加载。长读从工程/研究来源中按 AI Infra 关键词筛选，保留 90 天内文章，每来源最多 8 篇；这是自动筛选，不是逐篇人工审读。每日信号保留 48 小时时间窗口，每个来源最多 3 条，避免单个高频媒体挤占板块。

收藏保存文章快照（标题、摘要、链接等公开元数据），每日数据更新后仍可阅读。旧版编号收藏会尝试从归档恢复；存储失败会在页面提示，不阻止阅读。支持导出 JSON 到用户本机；收藏不上传、不进入仓库。订阅状态目录显示最近采集是否成功、各来源收录数量；自动聚合不等于事实核查，所有条目始终保留原始来源链接。

采集器优先选择 Atom HTML alternate 链接，拒绝返回 HTML 错误页的伪成功响应，并在所有来源均无可用条目时保留上一版数据。单次临时连接失败会重试一次，同日归档合并已收录条目，避免较晚采集丢失较早数据。`npm run test:news`（Node.js 22.18+）覆盖解析、时间窗口、来源多样性、收藏恢复和筛选。

## 模型结构实验室

模型结构数据位于 `src/data/models.ts`、`src/data/qwen-models.ts` 与 `src/data/hybrid-models.ts`，页面组件位于 `src/pages/Models.tsx`。当前提供七个代表模型：

- Llama 3.1 8B：Dense、GQA、SwiGLU；
- DeepSeek-V3：MLA、DeepSeekMoE、MTP；
- GLM-4.7-Flash：MLA、Sparse MoE；
- Qwen3-8B：GQA、QK-Norm、Dense SwiGLU；
- Qwen3-30B-A3B：GQA、QK-Norm、128 experts / Top-8 MoE；
- Qwen3.5-9B：24 层 DeltaNet + 8 层 Gated Full Attention、Dense FFN、视觉编码器；
- Qwen3.5-35B-A3B：30 层 DeltaNet + 10 层 Gated Full Attention、256 routed / Top-8 + gated shared expert、视觉编码器。

每个模型都有可直接分享的 Hash 路由，例如 `#/models/qwen3-30b-a3b`。模块支持悬浮预览与点击锁定；窄屏点击打开原生模态详情，可用 Esc 关闭。Layer 控件展开一个真实 Decoder 层，显示两次残差连接、两次 RMSNorm，并按层号选择 Dense 或 MoE，其他层折叠。图中为自回归主干，不包含 MTP 辅助预测分支。

层分布图按 MLA、GQA/Full、Gated DeltaNet 着色，点击层号同步切换计算模块与缓存支路。Qwen3.5 的 Inspector 还显示 Q/K/V、输出门、循环矩阵等中间张量及 Prefill/Decode 算法说明；可选视觉分支显示 patch embedding、ViT 与 merger 的全局权重。

KV Cache 容量实验支持 B、S、TP、缓存字节数与 Prefill/Decode 切换，驱动数字化输入输出 Shape。计算明确区分 GQA head 分片/复制与 MLA latent 复制；展示全部主干层的每卡、全 TP 组逻辑缓存量，不将其误作部署总显存。模型的 `execution` 字段声明上下文上限、Dense 层数与缓存布局。新增模型须同时提供官方配置来源、这些元数据及模块权重。

Hybrid 缓存分为完整注意力 KV（随 S 增长）、FP32 循环矩阵（定长）及 BF16 卷积窗口（定长）。参考 Transformers 的 4 槽卷积状态分配，部分引擎使用 K−1 槽；不含前缀/推测解码额外副本、模型权重和工作空间。完整 KV 精度选项不会改变循环状态精度。公式与多种上下文长度对照均可在容量面板展开查看。

`npm run test:models`（Node.js 22.18+）校验逐层路径、Shape 模板、已知 KV 容量及 TP 复制边界；构建仍兼容 Node.js 20。

### 每周报告

每周日北京时间 `09:30`，Codex 本地自动化会在本项目中使用 `gpt-5.6-luna`，根据最近七天的公开新闻归档生成来源约束的中文周报。它随后运行本地校验，只提交 `src/data/news/weekly/latest.json`，并推送到 `main` 触发 GitHub Pages 发布。

该流程直接使用 Codex 任务自身的模型能力，不调用 OpenAI API，因此：

- 不需要配置 `OPENAI_API_KEY`；
- 不会在 GitHub Actions、仓库或构建产物中保存模型凭证；
- 运行时间到达时，本机 Codex 与该项目需要处于可运行状态；
- 如果工作区不干净、分支不是 `main`、无法快进同步或校验失败，任务会停止且不会提交或推送。

新闻标题、摘要、URL 和信源名称均按不可信输入处理；Codex 只允许基于归档中的公开信息进行总结，事实性内容必须引用归档内的 HTTPS 来源。

生成后可独立运行仓库内的确定性校验：

```bash
npm run news:weekly:check
```

不要把个人邮箱、本地绝对路径、用户标识或 `.env` 文件提交到仓库。

## 部署

推送到 `main` 后，`.github/workflows/deploy.yml` 会构建并发布 GitHub Pages。应用使用 Hash Router，可在项目子路径下稳定刷新和导航。

## 内容与许可

教学内容同步自 [SGLang Tutor](https://github.com/cl-vv-h/SGLang_Tutor)，其中保留的 SGLang 源码与相关材料仍遵循各自上游许可证。本网站用于教学导航与阅读，不是 SGLang 的替代发行版。
