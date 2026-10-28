/**
 * AgentHost — main-thread orchestrator for the sub-agent workers.
 *
 *  UI ──run(task)──▶ AgentHost ──postMessage──▶ Worker (agent brain)
 *  UI ◀─insights/state── AgentHost ◀──────────── Worker
 *                        AgentHost ──tool()────▶ host services (Places SDK…)
 *
 * The host owns the event bus: every message from an agent is re-published
 * as a typed event, and the shared context is broadcast to all agents.
 */
import { useSyncExternalStore } from 'react'
import type { AgentContext, AgentName, AgentStatus, HostMessage, Insight, ToolCalls, ToolName, WorkerMessage } from './protocol'
import { nearby } from '@/services/places'

type Factory = () => Worker

const FACTORIES: Record<AgentName, Factory> = {
  scout: () => new Worker(new URL('./scout.worker.ts', import.meta.url), { type: 'module', name: 'ScoutAgent' }),
  translate: () => new Worker(new URL('./translate.worker.ts', import.meta.url), { type: 'module', name: 'TranslateAgent' }),
  budget: () => new Worker(new URL('./budget.worker.ts', import.meta.url), { type: 'module', name: 'BudgetAgent' }),
  safety: () => new Worker(new URL('./safety.worker.ts', import.meta.url), { type: 'module', name: 'SafetyAgent' }),
}

export const AGENT_META: Record<AgentName, { label: string; role: string }> = {
  scout: { label: 'Scout', role: 'Proximity & recommendations' },
  translate: { label: 'Translate', role: 'Voice & phrase translation' },
  budget: { label: 'Budget', role: 'Currency & expenses' },
  safety: { label: 'Safety', role: 'Geofence & emergency' },
}

export type BusEvent =
  | { type: 'insight'; insight: Insight }
  | { type: 'state'; agent: AgentName; state: unknown }
  | { type: 'status'; agent: AgentName; status: AgentStatus; detail?: string }
  | { type: 'context'; context: AgentContext }

type ToolHandler<T extends ToolName> = (args: ToolCalls[T]['args']) => Promise<ToolCalls[T]['result']>

class AgentHost {
  private workers = new Map<AgentName, Worker>()
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private seq = 0
  private listeners = new Set<(e: BusEvent) => void>()
  private tools: { [K in ToolName]: ToolHandler<K> } = {
    'places.nearby': (args) => nearby(args),
  }

  context: AgentContext | null = null
  insights: Insight[] = []
  states: Partial<Record<AgentName, unknown>> = {}
  statuses: Record<AgentName, AgentStatus> = { scout: 'booting', translate: 'booting', budget: 'booting', safety: 'booting' }

  private snapshot = { insights: this.insights, states: this.states, statuses: this.statuses }
  private storeListeners = new Set<() => void>()

  start() {
    if (this.workers.size) return
    for (const name of Object.keys(FACTORIES) as AgentName[]) this.spawn(name)
    // Drop expired insights once a minute.
    setInterval(() => {
      const now = Date.now()
      const next = this.insights.filter((i) => !i.ttl || i.ts + i.ttl > now)
      if (next.length !== this.insights.length) {
        this.insights = next
        this.commit()
      }
    }, 60_000)
  }

  private spawn(name: AgentName) {
    let w: Worker
    try {
      w = FACTORIES[name]()
    } catch (err) {
      this.statuses = { ...this.statuses, [name]: 'error' }
      this.commit()
      console.error(`[agents] failed to start ${name}`, err)
      return
    }
    w.onmessage = (e: MessageEvent<WorkerMessage>) => this.onMessage(name, e.data)
    w.onerror = (e) => {
      console.error(`[agents] ${name} crashed`, e.message)
      this.statuses = { ...this.statuses, [name]: 'error' }
      this.commit()
    }
    this.workers.set(name, w)
    if (this.context) w.postMessage({ type: 'context', context: this.context } satisfies HostMessage)
  }

  private onMessage(agent: AgentName, m: WorkerMessage) {
    switch (m.type) {
      case 'ready':
        break
      case 'status':
        this.statuses = { ...this.statuses, [agent]: m.status }
        this.emit({ type: 'status', agent, status: m.status, detail: m.detail })
        this.commit()
        break
      case 'state':
        this.states = { ...this.states, [agent]: m.state }
        this.emit({ type: 'state', agent, state: m.state })
        this.commit()
        break
      case 'insight': {
        const rest = this.insights.filter((i) => i.key !== m.insight.key)
        this.insights = [m.insight, ...rest].sort((a, b) => b.priority - a.priority || b.ts - a.ts).slice(0, 30)
        this.emit({ type: 'insight', insight: m.insight })
        this.commit()
        break
      }
      case 'retract': {
        const next = this.insights.filter((i) => i.key !== m.key)
        if (next.length !== this.insights.length) {
          this.insights = next
          this.commit()
        }
        break
      }
      case 'result': {
        const p = this.pending.get(m.id)
        if (!p) return
        this.pending.delete(m.id)
        if (m.ok) p.resolve(m.result)
        else p.reject(new Error(m.error))
        break
      }
      case 'tool': {
        const handler = this.tools[m.tool] as ToolHandler<ToolName> | undefined
        const w = this.workers.get(agent)
        if (!handler || !w) return
        handler(m.args as never)
          .then((result) => w.postMessage({ type: 'tool-result', id: m.id, ok: true, result } satisfies HostMessage))
          .catch((err: unknown) =>
            w.postMessage({ type: 'tool-result', id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies HostMessage),
          )
        break
      }
    }
  }

  /** Broadcast new shared context to every agent. */
  setContext(context: AgentContext) {
    this.context = context
    this.workers.forEach((w) => w.postMessage({ type: 'context', context } satisfies HostMessage))
    this.emit({ type: 'context', context })
  }

  /** Run a task on an agent and await its result. */
  run<T = unknown>(agent: AgentName, task: string, payload?: unknown, timeoutMs = 25_000): Promise<T> {
    const w = this.workers.get(agent)
    if (!w) return Promise.reject(new Error(`${agent} agent is not running`))
    const id = `${agent}-${++this.seq}`
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      w.postMessage({ type: 'task', id, task, payload } satisfies HostMessage)
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`${agent}.${task} timed out`))
      }, timeoutMs)
    })
  }

  dismiss(key: string) {
    this.insights = this.insights.filter((i) => i.key !== key)
    this.commit()
  }

  on(fn: (e: BusEvent) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(e: BusEvent) {
    this.listeners.forEach((l) => l(e))
  }

  private commit() {
    this.snapshot = { insights: this.insights, states: this.states, statuses: this.statuses }
    this.storeListeners.forEach((l) => l())
  }

  subscribe = (l: () => void) => {
    this.storeListeners.add(l)
    return () => this.storeListeners.delete(l)
  }
  getSnapshot = () => this.snapshot
}

export const agents = new AgentHost()

export function useAgents() {
  return useSyncExternalStore(agents.subscribe, agents.getSnapshot)
}

export function useAgentState<S>(name: AgentName): S | undefined {
  return useSyncExternalStore(agents.subscribe, () => agents.getSnapshot().states[name] as S | undefined)
}
