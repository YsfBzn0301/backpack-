/// <reference lib="webworker" />
/**
 * Worker-side runtime. Each agent file calls `defineAgent` once; this wires up
 * the message loop, task dispatch, tool calls back to the host, and helpers for
 * emitting insights and publishing state.
 */
import type { AgentContext, AgentName, AgentStatus, HostMessage, Insight, ToolCalls, ToolName, WorkerMessage } from './protocol'

export interface AgentApi<S> {
  name: AgentName
  context: () => AgentContext | null
  emit: (insight: Omit<Insight, 'id' | 'agent' | 'ts'> & { ts?: number }) => void
  retract: (key: string) => void
  publish: (patch: Partial<S>) => void
  state: () => S
  status: (s: AgentStatus, detail?: string) => void
  tool: <T extends ToolName>(tool: T, args: ToolCalls[T]['args']) => Promise<ToolCalls[T]['result']>
}

export interface AgentDefinition<S> {
  name: AgentName
  initialState: S
  init?: (api: AgentApi<S>) => void | Promise<void>
  onContext?: (ctx: AgentContext, prev: AgentContext | null, api: AgentApi<S>) => void | Promise<void>
  tasks: Record<string, (payload: never, api: AgentApi<S>) => unknown>
}

const scope = self as unknown as DedicatedWorkerGlobalScope

export function defineAgent<S extends object>(def: AgentDefinition<S>) {
  let context: AgentContext | null = null
  let state = def.initialState
  let busy = 0
  let seq = 0
  const pendingTools = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  const post = (m: WorkerMessage) => scope.postMessage(m)

  const api: AgentApi<S> = {
    name: def.name,
    context: () => context,
    emit: (i) => post({ type: 'insight', insight: { ...i, id: `${def.name}-${i.key}-${Date.now()}`, agent: def.name, ts: i.ts ?? Date.now() } }),
    retract: (key) => post({ type: 'retract', key }),
    publish: (patch) => {
      state = { ...state, ...patch }
      post({ type: 'state', state })
    },
    state: () => state,
    status: (status, detail) => post({ type: 'status', status, detail }),
    tool: (tool, args) =>
      new Promise((resolve, reject) => {
        const id = `${def.name}-tool-${++seq}`
        pendingTools.set(id, { resolve: resolve as (v: unknown) => void, reject })
        post({ type: 'tool', id, tool, args })
        setTimeout(() => {
          if (pendingTools.delete(id)) reject(new Error(`tool ${tool} timed out`))
        }, 20_000)
      }),
  }

  /** Wrap work so the UI can show which agents are thinking. */
  const track = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    if (busy++ === 0) api.status('thinking')
    try {
      return await fn()
    } finally {
      if (--busy === 0) api.status('idle')
    }
  }

  scope.onmessage = async (e: MessageEvent<HostMessage>) => {
    const msg = e.data
    switch (msg.type) {
      case 'context': {
        const prev = context
        context = msg.context
        if (def.onContext) {
          track(() => def.onContext!(msg.context, prev, api)).catch((err) => api.status('error', String(err?.message ?? err)))
        }
        break
      }
      case 'task': {
        const handler = def.tasks[msg.task]
        if (!handler) {
          post({ type: 'result', id: msg.id, ok: false, error: `unknown task ${msg.task}` })
          return
        }
        try {
          const result = await track(() => handler(msg.payload as never, api))
          post({ type: 'result', id: msg.id, ok: true, result })
        } catch (err) {
          post({ type: 'result', id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) })
        }
        break
      }
      case 'tool-result': {
        const p = pendingTools.get(msg.id)
        if (!p) return
        pendingTools.delete(msg.id)
        if (msg.ok) p.resolve(msg.result)
        else p.reject(new Error(msg.error))
        break
      }
    }
  }

  Promise.resolve(def.init?.(api))
    .catch((err) => api.status('error', String(err?.message ?? err)))
    .finally(() => {
      post({ type: 'ready' })
      post({ type: 'state', state })
      api.status('idle')
    })
}

/** Local wall-clock hour at the context location. */
export function localHour(ctx: AgentContext) {
  const d = new Date(ctx.now + ctx.utcOffsetSec * 1000)
  return d.getUTCHours() + d.getUTCMinutes() / 60
}

export function formatLocalTime(ctx: AgentContext) {
  const d = new Date(ctx.now + ctx.utcOffsetSec * 1000)
  let h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`
}

export async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}
