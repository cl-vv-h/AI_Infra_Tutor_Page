export default function KimiLatentMoeFlow() {
  return <details aria-label="LatentMoE 支路图" className="mt-3 rounded-xl border border-violet-200/25 bg-violet-200/5 p-3 text-sm leading-6 text-white/70">
    <summary className="cursor-pointer text-violet-100">展开 routed / shared 数据流</summary>
    <p className="mt-3 rounded-lg border border-white/15 p-3 text-center text-cyan-100">同一份 FFN 输入 x：<span className="font-mono">[N, 7168]</span><br />两支独立读取 x</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <section aria-label="Routed latent 支路" className="min-w-0 rounded-xl border border-violet-200/20 p-3">
        <h4 className="font-semibold text-violet-100">Routed · 16 / 896</h4>
        <ol className="mt-3 space-y-3">
          <li>Router 读取原始 x → Top-16 编号与权重</li>
          <li>↓ 共享降维投影<br /><span className="font-mono">7168 → 3584</span></li>
          <li>↓ 所选专家 SiTU-GLU<br /><span className="font-mono">3584 → 3072 → 3584</span></li>
          <li>↓ 按路由权重合并，并完成所需 TP 归约</li>
          <li>↓ 对完整 latent 做 RMSNorm<br /><span className="font-mono">[N, 3584]</span></li>
          <li>↓ 共享升维投影<br /><span className="font-mono">3584 → 7168</span></li>
        </ol>
      </section>
      <section aria-label="Shared 主干支路" className="min-w-0 rounded-xl border border-emerald-200/20 p-3">
        <h4 className="font-semibold text-emerald-100">Shared · 每 token 执行</h4>
        <p className="mt-3">直接读取原始 x，不读取 routed latent 或其 Norm 结果。</p>
        <p className="mt-3 font-mono">7168 → 6144 → 7168</p>
        <p className="mt-3">2 个 shared experts 的中间维合并；SiTU-GLU。按图示 TP 做所需输出归约。</p>
      </section>
    </div>
    <p className="mt-3 rounded-lg border border-cyan-200/20 p-3 text-center text-cyan-100">两支 7168 维结果相加 → MoE 输出<br />再交给下方 FFN → Block Prefix 累加</p>
    <p className="mt-3 text-xs text-white/55">表示数据依赖，不保证硬件实际同时执行；归约可能由实现合并到共享 collective，但不能在局部 routed 和上提前做非线性 Norm。</p>
  </details>
}
