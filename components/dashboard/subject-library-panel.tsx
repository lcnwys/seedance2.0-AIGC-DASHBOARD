'use client'

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DashboardSelect } from '@/components/dashboard/dashboard-select'
import type { DashboardAsset } from '@/components/dashboard/types'
import { getStoredToken } from '@/lib/modules/auth/browser-session'
import { DEFAULT_IMAGE_MODEL, IMAGE_MODEL_OPTIONS, getImageModelConfig } from '@/lib/modules/image/models'

type SubjectFilter = 'all' | 'character' | 'scene' | 'prop'
type SubjectType = Exclude<SubjectFilter, 'all'>
type PageMode = 'library' | 'view' | 'edit' | 'create'

export type SubjectCreationDraft = {
  subjectName: string
  subjectType: SubjectType
  prompt: string
  referenceImages: DashboardAsset[]
  preferredModel: string
  size: string
  outputFormat: 'jpeg' | 'png'
}

type UploadTarget = { method: 'PUT'; uploadUrl: string; fileUrl: string; headers?: Record<string, string> }
type Draft = { key: string; name: string; type: SubjectType; createdAt: string }
type Meta = { style: string; desc: string; model: string; prompts: Record<string, string> }
type Subject = { key: string; name: string; type: SubjectType; assets: DashboardAsset[]; cover: DashboardAsset | null; createdAt: string }
type Slot = { id: string; step: number; label: string; empty: string; keywords: string[]; needMain?: boolean; prompt: (name: string) => string }
type Form = { name: string; type: SubjectType; style: string; desc: string; model: string; prompts: Record<string, string> }

const DRAFT_KEY = 'seedance_subject_drafts_v1'
const META_KEY = 'seedance_subject_meta_v3'
const TYPE_LABEL: Record<SubjectType, string> = { character: '人物', scene: '场景', prop: '道具' }
const TYPE_NAME: Record<SubjectType, string> = { character: '角色', scene: '场景', prop: '道具' }
const STYLE_OPTIONS: Record<SubjectType, string[]> = {
  character: ['写实人物', '国风角色', '影视概念', '二次元角色'],
  scene: ['电影场景', '国风场景', '城市空间', '商业空间'],
  prop: ['工业产品', '古风道具', '商品静物', '影视道具'],
}
const SLOTS: Record<SubjectType, Slot[]> = {
  character: [
    { id: 'main', step: 1, label: '角色主视图', empty: '角色主视图', keywords: ['主视图', '正面', '定妆'], prompt: (n) => `为角色「${n}」生成主视图设定图，人物完整出镜，正对镜头，五官、发型、服装、配色统一。` },
    { id: 'tri', step: 2, label: '角色三视图', empty: '角色三视图', keywords: ['三视图', '正侧背'], needMain: true, prompt: (n) => `基于角色「${n}」主视图，生成三视图参考图，包含正面、侧面、背面，要求体型和服装结构一致。` },
  ],
  scene: [
    { id: 'main', step: 1, label: '场景正视图', empty: '场景正视图', keywords: ['正视图', '主视图', '建立'], prompt: (n) => `为场景「${n}」生成正视图设定图，要求空间结构清晰、透视稳定、主体元素明确。` },
    { id: 'angle', step: 2, label: '场景多角度', empty: '场景多角度', keywords: ['多角度', '45度', '俯视', '低机位'], needMain: true, prompt: (n) => `基于场景「${n}」正视图，生成多角度场景参考图，包含斜侧、俯视或低机位变化，保持空间结构一致。` },
  ],
  prop: [
    { id: 'main', step: 1, label: '道具主视图', empty: '道具主视图', keywords: ['主视图', '正面'], prompt: (n) => `为道具「${n}」生成主视图设定图，要求结构完整、比例准确、材质明确。` },
    { id: 'detail', step: 2, label: '道具细节图', empty: '道具细节图', keywords: ['细节', '特写', '局部'], needMain: true, prompt: (n) => `基于道具「${n}」主视图，继续生成结构细节和材质特写，突出局部构造与工艺细节。` },
  ],
}

const n = (v?: string) => (v || '').trim()
const keyOf = (type: SubjectType, name: string) => `${type}:${n(name) || '未命名主体'}`
const readJson = <T,>(k: string, fallback: T) => { try { if (typeof window === 'undefined') return fallback; const v = window.localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback } catch { return fallback } }
const writeJson = (k: string, v: unknown) => { if (typeof window !== 'undefined') window.localStorage.setItem(k, JSON.stringify(v)) }
const err = (e: unknown, fallback: string) => e instanceof Error && e.message ? e.message : fallback
const modelCfg = (id: string) => getImageModelConfig(id || DEFAULT_IMAGE_MODEL)

function group(assets: DashboardAsset[], drafts: Draft[], filter: SubjectFilter) {
  const map = new Map<string, Subject>()
  for (const a of assets) {
    if (a.category !== 'subject' || !a.subjectType) continue
    const type = a.subjectType as SubjectType
    const name = n(a.subjectName || a.name) || '未命名主体'
    const key = keyOf(type, name)
    const cur = map.get(key)
    if (cur) {
      cur.assets.push(a)
      if (!cur.cover && a.type === 'image') cur.cover = a
    } else {
      map.set(key, { key, name, type, assets: [a], cover: a.type === 'image' ? a : null, createdAt: a.createdAt || new Date().toISOString() })
    }
  }
  for (const d of drafts) if (!map.has(d.key)) map.set(d.key, { key: d.key, name: d.name, type: d.type, assets: [], cover: null, createdAt: d.createdAt })
  return Array.from(map.values()).filter((s) => filter === 'all' || s.type === filter).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

function slotAsset(subject: Subject | null, slot: Slot) {
  if (!subject) return null
  const imgs = subject.assets.filter((a) => a.type === 'image')
  return imgs.find((a) => slot.keywords.some((k) => `${a.name} ${a.subjectName || ''}`.toLowerCase().includes(k.toLowerCase()))) || (slot.id === 'main' ? subject.cover : null) || null
}

function defaultMeta(type: SubjectType, name: string): Meta {
  return { style: STYLE_OPTIONS[type][0], desc: '', model: DEFAULT_IMAGE_MODEL, prompts: Object.fromEntries(SLOTS[type].map((s) => [s.id, s.prompt(name)])) }
}

function formOf(type: SubjectType, name: string, meta?: Meta): Form {
  const m = meta || defaultMeta(type, name)
  return {
    name,
    type,
    style: m.style || STYLE_OPTIONS[type][0],
    desc: m.desc || '',
    model: m.model || DEFAULT_IMAGE_MODEL,
    prompts: Object.fromEntries(SLOTS[type].map((s) => [s.id, m.prompts?.[s.id] || s.prompt(name)])),
  }
}

async function putFile(file: File, target: UploadTarget) {
  const r = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file })
  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    throw new Error(detail ? `上传到对象存储失败: ${r.status} ${detail}` : `上传到对象存储失败: ${r.status}`)
  }
}

export function SubjectLibraryPanel(props: {
  assets: DashboardAsset[]
  subjectFilter: SubjectFilter
  onSubjectFilterChange: (filter: SubjectFilter) => void
  onOpenAsset: (asset: DashboardAsset) => void
  onStartImageCreation?: (draft: SubjectCreationDraft) => void
  onRefreshAssets: () => Promise<void>
}) {
  const { assets, subjectFilter, onSubjectFilterChange, onOpenAsset, onRefreshAssets } = props
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [metas, setMetas] = useState<Record<string, Meta>>({})
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<Form>(formOf('character', ''))
  const [activeSlotId, setActiveSlotId] = useState('main')
  const [uploadSlotId, setUploadSlotId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [generating, setGenerating] = useState<Record<string, boolean>>({})

  useEffect(() => { setDrafts(readJson<Draft[]>(DRAFT_KEY, [])); setMetas(readJson<Record<string, Meta>>(META_KEY, {})) }, [])
  useEffect(() => { writeJson(DRAFT_KEY, drafts) }, [drafts])
  useEffect(() => { writeJson(META_KEY, metas) }, [metas])
  const subjects = useMemo(() => {
    const list = group(assets, drafts, subjectFilter)
    const q = search.trim().toLowerCase()
    return q ? list.filter((s) => s.name.toLowerCase().includes(q)) : list
  }, [assets, drafts, search, subjectFilter])

  const subjectKey = searchParams.get('subject')
  const subject = useMemo(() => subjects.find((s) => s.key === subjectKey) || null, [subjectKey, subjects])
  const typeParam = searchParams.get('subjectType')
  const mode: PageMode = searchParams.get('subjectMode') === 'view' || searchParams.get('subjectMode') === 'edit' || searchParams.get('subjectMode') === 'create'
    ? searchParams.get('subjectMode') as PageMode
    : subjectKey ? 'view' : 'library'

  const editType = mode === 'create' ? (typeParam === 'scene' || typeParam === 'prop' ? typeParam : 'character') : (subject?.type || form.type)
  const currentSubject = mode === 'create' ? subjects.find((s) => s.key === keyOf(form.type, form.name)) || null : subject
  const slots = SLOTS[editType]
  const activeSlot = slots.find((s) => s.id === activeSlotId) || slots[0]
  const preview = currentSubject?.assets.find((a) => a.id === previewId) || slotAsset(currentSubject, activeSlot) || currentSubject?.cover || null

  useEffect(() => {
    if (mode === 'create') {
      const type = typeParam === 'scene' || typeParam === 'prop' ? typeParam : 'character'
      setForm(formOf(type, form.name))
      setActiveSlotId(SLOTS[type][0].id)
      setPreviewId(null)
      return
    }
    if (subject) {
      setForm(formOf(subject.type, subject.name, metas[subject.key]))
      setActiveSlotId(SLOTS[subject.type][0].id)
      setPreviewId(null)
    }
  }, [mode, subject, typeParam, metas])

  const go = (u: Record<string, string | null>) => {
    const p = new URLSearchParams(searchParams.toString())
    Object.entries(u).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    const q = p.toString()
    router.push(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  const ensureDraft = () => {
    const name = n(form.name)
    if (!name) throw new Error('请先输入名称')
    const key = keyOf(form.type, name)
    setDrafts((prev) => prev.some((d) => d.key === key) ? prev : [{ key, name, type: form.type, createdAt: new Date().toISOString() }, ...prev])
    setMetas((prev) => ({ ...prev, [key]: { style: form.style, desc: form.desc, model: form.model, prompts: form.prompts } }))
    return { key, name, type: form.type }
  }

  const createSubjectAsset = async (token: string, subjectName: string, subjectType: SubjectType, assetName: string, url: string) => {
    const r = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: assetName, type: 'image', url, size: 0, contentType: 'image/png', category: 'subject', subjectType, subjectName }),
    })
    if (!r.ok) throw new Error('保存主体素材失败')
  }

  const pollTask = async (taskId: string, token: string) => {
    for (let i = 0; i < 40; i += 1) {
      const r = await fetch(`/api/image-tasks/${taskId}/status`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error('获取图片任务状态失败')
      const d = await r.json()
      if (d.task.status === 'succeeded' || d.task.status === 'failed') return d.task
      await new Promise((resolve) => window.setTimeout(resolve, 3000))
    }
    throw new Error('生成超时，请稍后去任务中心查看')
  }

  const gen = async (slot: Slot) => {
    try {
      const id = ensureDraft()
      const token = getStoredToken()
      if (!token) throw new Error('未登录，无法生成')
      const prompt = n(form.prompts[slot.id])
      if (!prompt) throw new Error('请先填写提示词')
      const cfg = modelCfg(form.model)
      const main = currentSubject ? slotAsset(currentSubject, slots[0]) : null
      if (slot.needMain && !main) throw new Error('请先准备主视图')
      setGenerating((p) => ({ ...p, [slot.id]: true }))
      const r = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: form.model, prompt, reference_image_urls: main ? [main.url] : [], size: cfg.defaultSize, output_format: cfg.defaultOutputFormat, watermark: false, sequential_image_generation: 'disabled', max_images: 1, enable_web_search: false }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.task?.id) throw new Error(d?.error || '发起生成失败')
      const task = await pollTask(d.task.id, token)
      if (task.status !== 'succeeded' || !task.outputAssets?.length) throw new Error(task.errorMessage || '生成失败')
      for (const a of task.outputAssets as DashboardAsset[]) await createSubjectAsset(token, id.name, id.type, `${id.name}-${slot.label}`, a.url)
      await onRefreshAssets()
      go({ subject: id.key, subjectMode: mode === 'create' ? 'create' : 'edit' })
    } catch (e) {
      window.alert(err(e, '生成失败'))
    } finally {
      setGenerating((p) => ({ ...p, [slot.id]: false }))
    }
  }

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!uploadSlotId || files.length === 0) return
    const slot = SLOTS[form.type].find((s) => s.id === uploadSlotId)
    if (!slot) return
    try {
      const id = ensureDraft()
      const token = getStoredToken()
      if (!token) throw new Error('未登录，无法上传')
      setUploading(true)
      for (const file of files) {
        const r = await fetch('/api/assets/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName: file.name, contentType: file.type }),
        })
        if (!r.ok) {
          const detail = await r.json().catch(() => null) as { error?: string } | null
          throw new Error(detail?.error || `获取上传地址失败 (${r.status})`)
        }
        const target = await r.json() as UploadTarget
        await putFile(file, target)
        await createSubjectAsset(token, id.name, id.type, `${id.name}-${slot.label}`, target.fileUrl)
      }
      await onRefreshAssets()
      go({ subject: id.key, subjectMode: mode === 'create' ? 'create' : 'edit' })
    } catch (e) {
      window.alert(err(e, '上传失败'))
    } finally {
      setUploading(false)
      setUploadSlotId(null)
    }
  }

  const save = async () => {
    try {
      setSaving(true)
      if (mode === 'create') {
        const id = ensureDraft()
        go({ subject: id.key, subjectMode: 'view', subjectType: null })
        return
      }
      if (!subject) return
      const token = getStoredToken()
      if (!token) throw new Error('未登录，无法保存')
      const nextName = n(form.name)
      if (!nextName) throw new Error('请先输入名称')
      const nextKey = keyOf(form.type, nextName)
      if (subject.name !== nextName || subject.type !== form.type) {
        for (const a of subject.assets) {
          const r = await fetch('/api/assets', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: a.id, subjectName: nextName, subjectType: form.type }),
          })
          if (!r.ok) throw new Error('更新主体素材失败')
        }
        await onRefreshAssets()
      }
      setDrafts((prev) => prev.some((d) => d.key === subject.key) ? prev.map((d) => d.key === subject.key ? { ...d, key: nextKey, name: nextName, type: form.type } : d) : prev)
      setMetas((prev) => {
        const next = { ...prev }
        delete next[subject.key]
        next[nextKey] = { style: form.style, desc: form.desc, model: form.model, prompts: form.prompts }
        return next
      })
      go({ subject: nextKey, subjectMode: 'view' })
    } catch (e) {
      window.alert(err(e, '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (s: Subject) => {
    if (!window.confirm(`确定删除主体「${s.name}」吗？`)) return
    try {
      const token = getStoredToken()
      if (!token) throw new Error('未登录，无法删除主体')
      setDeleting(true)
      if (s.assets.length) {
        const ids = s.assets.map((a) => a.id).join(',')
        const r = await fetch(`/api/assets?ids=${ids}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) throw new Error('删除主体素材失败')
      }
      setDrafts((prev) => prev.filter((d) => d.key !== s.key))
      setMetas((prev) => { const next = { ...prev }; delete next[s.key]; return next })
      await onRefreshAssets()
      go({ subject: null, subjectMode: null, subjectType: null })
    } catch (e) {
      window.alert(err(e, '删除失败'))
    } finally {
      setDeleting(false)
    }
  }

  const header = (title: string) => (
    <div className="mb-6 flex items-center gap-3">
      <button type="button" onClick={() => go({ subject: null, subjectMode: null, subjectType: null })} className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100">
        返回
      </button>
      <div className="text-2xl font-semibold text-zinc-100">{title}</div>
    </div>
  )

  if (mode === 'view' && subject) {
    const meta = metas[subject.key] || defaultMeta(subject.type, subject.name)
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-[1600px]">
          {header(TYPE_LABEL[subject.type])}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-[32px] border border-zinc-800 bg-zinc-950/80 p-4">
              <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900">
                {preview ? <div className="aspect-[4/5]"><img src={preview.url} alt={preview.name} className="h-full w-full object-contain bg-white/95" /></div> : <div className="flex aspect-[4/5] items-center justify-center text-zinc-500">暂无主体图片</div>}
              </div>
            </div>
            <aside className="rounded-[32px] border border-zinc-800 bg-zinc-950/80 p-8">
              <div className="text-3xl font-semibold text-zinc-100">{subject.name}</div>
              <div className="mt-3 text-sm text-zinc-500">{new Date(subject.createdAt).toLocaleDateString('zh-CN')} 内容由AI生成</div>
              <div className="mt-8 border-t border-zinc-800 pt-8">
                <div className="text-sm text-zinc-500">风格预设</div>
                <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-lg text-zinc-100">{meta.style}</div>
              </div>
              <div className="mt-8">
                <div className="text-sm text-zinc-500">创意描述</div>
                <div className="mt-3 max-h-[420px] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-base leading-8 text-zinc-200">{meta.desc || `${subject.name} 的主体说明暂未填写。`}</div>
              </div>
              {!!subject.assets.length && (
                <div className="mt-8 grid grid-cols-4 gap-3">
                  {subject.assets.filter((a) => a.type === 'image').slice(0, 8).map((a) => (
                    <button key={a.id} type="button" onClick={() => setPreviewId(a.id)} className={`overflow-hidden rounded-2xl border ${previewId === a.id ? 'border-indigo-500' : 'border-zinc-800'}`}>
                      <div className="aspect-square"><img src={a.url} alt={a.name} className="h-full w-full object-cover" /></div>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => go({ subject: subject.key, subjectMode: 'edit' })} className="mt-10 w-full rounded-2xl bg-zinc-800 px-5 py-4 text-lg text-zinc-100 hover:bg-zinc-700">
                编辑{TYPE_NAME[subject.type]}
              </button>
            </aside>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'edit' || mode === 'create') {
    const modelOptions = IMAGE_MODEL_OPTIONS
    const effectiveFormModel = form.model
    return (
      <div className="h-full overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-[1800px]">
          {header(`${mode === 'create' ? '创建' : '编辑'}${TYPE_NAME[editType]}`)}
          <div className="rounded-[32px] border border-zinc-800 bg-zinc-950/85 p-6 md:p-8">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px_260px]">
              <input value={form.name} onChange={(e) => setForm((p) => formOf(p.type, e.target.value, { style: p.style, desc: p.desc, model: p.model, prompts: p.prompts }))} placeholder={`请输入${TYPE_NAME[editType]}名称`} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-2xl text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
              <DashboardSelect
                value={form.style}
                onChange={(value) => setForm((p) => ({ ...p, style: value }))}
                options={STYLE_OPTIONS[editType].map((option) => ({ value: option, label: option }))}
              />
              <DashboardSelect
                value={effectiveFormModel}
                onChange={(value) => setForm((p) => ({ ...p, model: value }))}
                options={modelOptions.map((model) => ({
                  value: model.id,
                  label: model.label,
                  description: model.description,
                }))}
              />
            </div>
            {mode === 'create' && (
              <div className="mt-4 flex flex-wrap gap-3">
                {(['character', 'scene', 'prop'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => { setForm(formOf(t, form.name)); setActiveSlotId(SLOTS[t][0].id) }} className={`rounded-xl px-4 py-2.5 text-sm ${form.type === t ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              {slots.map((slot) => {
                const a = slotAsset(currentSubject, slot)
                const disabled = !!(slot.needMain && !slotAsset(currentSubject, slots[0]))
                return (
                  <div key={slot.id} className={`rounded-[28px] border p-4 ${activeSlot.id === slot.id ? 'border-zinc-500 bg-zinc-950' : 'border-zinc-800 bg-zinc-950/70'}`}>
                    <div className="mb-4 flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${activeSlot.id === slot.id ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-300'}`}>{slot.step}</div>
                      <div className="text-lg font-semibold text-zinc-100">{slot.label}</div>
                    </div>
                    <button type="button" onClick={() => { setActiveSlotId(slot.id); setPreviewId(a?.id || null) }} className="block w-full text-left">
                      <div className="overflow-hidden rounded-[22px] border border-zinc-800 bg-zinc-900">
                        {a ? <div className="aspect-[16/10]"><img src={a.url} alt={a.name} className="h-full w-full object-cover" /></div> : <div className="flex aspect-[16/10] items-center justify-center px-8 text-center text-sm text-zinc-600">{disabled ? '请先完成第一张主图' : slot.empty}</div>}
                      </div>
                    </button>
                    <div className="mt-4 flex gap-3">
                      <button type="button" onClick={() => { setActiveSlotId(slot.id); setUploadSlotId(slot.id); inputRef.current?.click() }} className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100">+ 添加</button>
                      <button type="button" onClick={() => { setActiveSlotId(slot.id); void gen(slot) }} disabled={disabled || !!generating[slot.id]} className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-40">{generating[slot.id] ? '生成中...' : '在线创作'}</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="text-lg font-medium text-zinc-100">当前槽位提示词</div>
                <textarea value={form.prompts[activeSlot.id] || ''} onChange={(e) => setForm((p) => ({ ...p, prompts: { ...p.prompts, [activeSlot.id]: e.target.value } }))} placeholder={`描述要创作的${activeSlot.label}`} className="mt-3 min-h-[180px] w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-sm leading-7 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
              </div>
              <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="text-lg font-medium text-zinc-100">{TYPE_NAME[editType]}说明（选填）</div>
                <textarea value={form.desc} onChange={(e) => setForm((p) => ({ ...p, desc: e.target.value }))} placeholder={`补充${TYPE_NAME[editType]}背景故事或设定`} className="mt-3 min-h-[180px] w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 text-sm leading-7 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600" />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-zinc-500">当前模型：{modelOptions.find((m) => m.id === effectiveFormModel)?.label || effectiveFormModel}</div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => { const id = ensureDraft(); go({ subject: id.key, subjectMode: 'view', subjectType: null }) }} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-3 text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100">保存草稿</button>
                <button type="button" onClick={() => void save()} disabled={saving} className="rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 px-8 py-3 text-sm font-medium text-white disabled:opacity-50">{saving ? '保存中...' : `${mode === 'create' ? '创建' : '更新'}${TYPE_NAME[editType]}`}</button>
              </div>
            </div>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={upload} className="hidden" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Subject Library</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-100">主体库</div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => go({ subject: null, subjectMode: 'create', subjectType: 'character' })} className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-white">新建人物</button>
            <button type="button" onClick={() => go({ subject: null, subjectMode: 'create', subjectType: 'scene' })} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100">新建场景</button>
            <button type="button" onClick={() => go({ subject: null, subjectMode: 'create', subjectType: 'prop' })} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-600 hover:text-zinc-100">新建道具</button>
          </div>
        </div>

        <div className="rounded-[32px] border border-zinc-800 bg-zinc-950/80 p-6">
          <div className="flex flex-col gap-4 border-b border-zinc-800 pb-5 lg:flex-row lg:items-center">
            <div className="flex-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索主体名称" className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600" /></div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'character', 'scene', 'prop'] as const).map((f) => (
                <button key={f} type="button" onClick={() => onSubjectFilterChange(f)} className={`rounded-xl px-3 py-2 text-sm ${subjectFilter === f ? 'bg-zinc-100 text-zinc-950' : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}>{f === 'all' ? '全部' : TYPE_LABEL[f]}</button>
              ))}
            </div>
          </div>

          {subjects.length ? (
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
              {subjects.map((s) => (
                <article key={s.key} className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/70 hover:border-zinc-600">
                  <button type="button" onClick={() => go({ subject: s.key, subjectMode: 'view', subjectType: null })} className="block w-full text-left">
                    <div className="aspect-[4/5] overflow-hidden bg-zinc-900">{s.cover ? <img src={s.cover.url} alt={s.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <div className="flex h-full items-center justify-center px-6 text-center text-sm text-zinc-500">{TYPE_NAME[s.type]}主图</div>}</div>
                    <div className="px-4 py-4">
                      <div className="truncate text-sm font-medium text-zinc-100">{s.name}</div>
                      <div className="mt-2 flex items-center justify-between gap-3"><span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-300">{TYPE_LABEL[s.type]}</span><span className="text-[11px] text-zinc-500">{s.assets.length} 项</span></div>
                    </div>
                  </button>
                  <button type="button" onClick={() => void remove(s)} disabled={deleting} className="absolute right-3 top-3 rounded-xl border border-red-500/20 bg-black/70 px-2.5 py-1 text-xs text-red-300 opacity-100 md:opacity-0 md:group-hover:opacity-100">删除</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-500">主体</div>
              <div className="mt-5 text-lg font-medium text-zinc-100">还没有主体</div>
              <div className="mt-2 text-sm text-zinc-500">从人物、场景或道具开始建立</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
