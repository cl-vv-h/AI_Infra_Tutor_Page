# AI Infra Space

一个持续生长的 AI Infra 开放知识空间：系统课程、SGLang 源码阅读，以及可追溯的全球新闻信号。

线上地址：<https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/>

## 信息架构

- `#/`：模块化门户首页。新增模块只需扩展 `src/data/modules.ts`。
- `#/learn`：AI Infra 课程地图，按“基础 → 框架 → 硬件与算子”组织。
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
- `src/data/news/archive/YYYY-MM-DD.json`：周报所需的七日公开数据。

本地可运行：

```bash
npm run news:fetch
```

信源配置位于 `scripts/news-sources.mjs`，目前覆盖研究机构、科技公司、央行/国际金融机构和多地区国际媒体。自动聚合不等于事实核查，网页始终保留原始来源链接。

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
