import Link from 'next/link'

const providerCards = [
  {
    title: '火山引擎',
    models: 'Seedance 2.0 / Seedance 2.0 Fast',
    desc: '覆盖视频生成，支持官方任务提交、状态同步、费用统计与素材落库。',
  },
  {
    title: '阿里云',
    models: 'Wan 2.7 Video',
    desc: '统一接入万相视频能力，适合做双厂商对比、团队共享与商业场景验证。',
  },
]

const featureCards = [
  '统一素材上传与 TOS / OSS 存储',
  '双厂商模型配置与团队隔离',
  '视频任务统一列表与明细',
  '厂商级与模型级费用统计',
  '适合二开、SaaS、工作室和渠道演示',
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100">
      <section className="relative overflow-hidden border-b border-zinc-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_30%)]" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-12 px-6 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/80 px-4 py-1 text-sm text-zinc-300">
              Seedance 2.0 Wan 2.7 AIGC Dashboard
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white md:text-6xl">
              面向火山引擎与阿里云的
              <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent"> 双厂商 AIGC 控制台</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 md:text-lg">
              这个开源分支聚焦最有落地价值的主链路：Seedance 2.0、Wan 2.7 Video 的统一接入，
              配套素材管理、对象存储、任务同步、费用统计与团队配置，方便你直接部署、演示、二开和商用验证。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100"
              >
                进入后台
              </Link>
              <Link
                href="/register"
                className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-medium text-zinc-100 transition hover:border-zinc-500"
              >
                创建账号
              </Link>
              <Link
                href="https://github.com/lcnwys/seedance2.0-wan2.7-AIGC-Dashboard"
                className="rounded-2xl border border-zinc-700 bg-transparent px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                查看 GitHub 仓库
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-xl gap-4">
            {providerCards.map((item) => (
              <div key={item.title} className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                <div className="text-sm text-zinc-500">{item.title}</div>
                <div className="mt-2 text-xl font-medium text-zinc-100">{item.models}</div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          {featureCards.map((item) => (
            <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm text-zinc-300">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-7">
          <div className="text-sm text-zinc-500">部署方式</div>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-100">适合直接开源、部署与演示</h2>
          <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-400">
            <p>支持本地开发、宝塔面板、常规 Linux + PM2 + Nginx，也保留了团队级 API Key 配置、TOS / OSS 上传和双厂商模型切换能力。</p>
            <p>如果你准备把它作为公开版基础盘，这个分支已经适合继续叠加自己的品牌、支付、邀请码、私有模型或渠道体系。</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard?tab=ai-video" className="rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-300">
              直达视频创作
            </Link>
            <Link href="/dashboard?tab=ai-video" className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
              直达视频创作
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900 p-7">
          <div className="text-sm text-zinc-500">展示位预留</div>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-100">这里留给你自己的品牌内容</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-zinc-400">
            <p>这一块建议你后续自行替换成品牌介绍、二维码、赞赏码、活动海报、社群入口，或者任何你希望公开展示的内容。</p>
            <p>公开版默认只保留中性占位，不替你预设代理、商务或引流话术，方便你按自己的方式包装。</p>
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-700 bg-black/20 p-6 text-sm text-zinc-500">
            可替换为：品牌卡片 / 微信二维码 / 赞赏码 / 官网入口 / 使用指南
          </div>
        </div>
      </section>
    </main>
  )
}
