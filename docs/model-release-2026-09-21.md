# 模型实验室上线记录 · 2026-09-21

## 发布与身份

- 功能发布提交：[`744fe2e`](https://github.com/cl-vv-h/AI_Infra_Tutor_Page/commit/744fe2e0ef8efdc457b794d606ceea711fa5b8c3)。其文件树 `cb2a4788418b80c97378142c6742f0d5a5f7d119` 与已验收的本地 `73c128a` 完全一致。
- 使用用户指出的 SSH 通道正常快进推送，父提交为最新远端 `5815397`；没有强推、修改登录配置或写入 API key。
- 发布提交的 author/committer 均为非个人机器人身份。两个早期本地提交不是机器人身份，因此保留本地开发历史、以相同文件树生成单个发布提交，没有把该历史中的作者信息上传。
- [GitHub Pages 工作流 35522122325](https://github.com/cl-vv-h/AI_Infra_Tutor_Page/actions/runs/35522122325) 已完成且结论为 `success`。
- 正式站点入口已更新为 `index-DVHL0QeB.js`；GLM-5.2 DPA、Qwen3-8B DPA 和 V4.1 路由均存在，并已完成下文正式域名的页面功能回归。

## 六项要求与公开入口

详细计算来源、独立算式、单元与渲染测试范围见 [六项验收](model-acceptance-2026-09-16.md)。本次发布没有再改变这些计算公式。

1. **准确性与统计范围**：[Kimi 权重工作区](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/models/kimi-k3?view=weights&tp=1)。完整权重文件为 1,560,936,091,448 B；文件体积、图示 Decoder、当前 rank 参数与运行时显存分开解释，MXFP4 scales、全部常驻专家和复制项不省略。
2. **TP / EP / DP / DPA**：普通工作区支持组内 EP、MoE-TP 和独立 DP 副本；[GLM DPA](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/models/glm-5-2/dpa) 与 [Qwen DPA](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/models/qwen3-8b/dpa) 展示 Attention TP、请求组、空组、不均匀负载、对齐与缓存归属。
3. **模块混合精度**：六个已核对模型提供 Dense/Shared MLP 与 routed experts 策略，自定义 Router FP32；payload、weight/input scales 和 W4 初始/后处理分别核算，对齐不满足的格式不伪装为受支持。
4. **热度排序**：[模型目录](https://cl-vv-h.github.io/AI_Infra_Tutor_Page/#/models)默认按 19 个精确 checkpoint 的公开近月下载快照排序，明确显示快照日期、非实时性及过期提醒，不采集个人访客行为。
5. **学习与展示**：结构/缓存/权重工作区分开，目录和明细按需展开；按统计范围定位、先选 DP 副本再选 TP rank，保留键盘导航、移动布局和可分享配置。
6. **逐 rank Shape 与大小**：滑块联动 B/S/阶段、TP/EP/DP、模块/层/精度，查看输入输出、内部逻辑张量、专家与 head 归属、权重分片及 packed/scale 容器和字节数。

## 线上验证

`npm run test:models:browser` 已针对正式 GitHub Pages 域名完成，退出码 0。Chrome 152.0.7977.83，在 360/390/768/1440 px 全部通过；311 次宽度溢出检查通过，无捕获到的页面运行时错误。测试使用隔离上下文，不使用个人浏览器资料。

真实页面断言覆盖下载排序/筛选、模块与层切换、TP/EP 动态滑块边界、独立 DP/rank 选择、混合精度与 W4 初始/后处理、Kimi 文件和原生加载账本、GLM/Qwen DPA、Q/KV head 归属、V4.1 参考布局、键盘操作与 URL 重载。该结果来自线上构建，不是复用本地预览结果。

结合六项验收中的独立算式、文件元数据、单元/渲染测试、当前远端文件树、成功部署和线上交互证据，本次六项页面改进已完成上线验收；以下明确边界仍然适用。

边界不变：这是基于固定模型与 SGLang 版本的教学计算，不是通用部署承诺。未运行 GPU/NPU 推理，不声称实际速度、模型质量或峰值显存已经验证；动态专家 token 数不伪造，逻辑输入/输出/views 不相加当作内存峰值。

原新闻工作区的未提交改动未被修改或发布；此次发布包含的新闻文件与发布父提交完全一致。周报仍使用原有 Luna 自动化，没有引入模型 API 凭证。
