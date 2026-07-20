import type { BaitId } from './data/fishes'
import { FISHING_DURATION_MS } from './config'
import {
  isFirebaseConfigured,
  useCloudFunctions,
  ensureAnonymousAuth,
  loadUserProfile,
  saveUserProfile,
  callStartFishing,
  callClaimFish,
  type CaughtFishRecord,
  type FishingSession,
  type UserProfile,
} from './firebase'

const STORAGE_KEY = 'osakana-tsuri-v1'

export type LocalState = {
  uid: string
  name: string
  fishing: FishingSession | null
  caught: Record<string, CaughtFishRecord>
  createdAt: number
  updatedAt: number
  notifGranted: boolean
}

type Listener = () => void

function defaultState(): LocalState {
  return {
    uid: `local_${crypto.randomUUID()}`,
    name: 'つりびと',
    fishing: null,
    caught: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    notifGranted: false,
  }
}

function loadLocal(): LocalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return { ...defaultState(), ...JSON.parse(raw) }
  } catch {
    return defaultState()
  }
}

function saveLocal(state: LocalState) {
  state.updatedAt = Date.now()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

class Store {
  state: LocalState = loadLocal()
  private listeners = new Set<Listener>()
  ready = false
  mode: 'local' | 'firebase' = 'local'

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    saveLocal(this.state)
    for (const fn of this.listeners) fn()
  }

  async init() {
    if (isFirebaseConfigured) {
      try {
        const user = await ensureAnonymousAuth()
        if (user) {
          this.mode = 'firebase'
          this.state.uid = user.uid
          const remote = await loadUserProfile(user.uid)
          if (remote) {
            this.state.name = remote.name || this.state.name
            this.state.fishing = remote.fishing
            this.state.caught = remote.caught ?? {}
            this.state.createdAt = remote.createdAt
          } else {
            await this.persistRemote()
          }
        }
      } catch (e) {
        console.warn('Firebase auth failed, using local mode', e)
        this.mode = 'local'
      }
    }
    // 旧仕様（長い放置）のセッションが残っていたら破棄してすぐ遊び直せるようにする
    this.migrateStaleFishingSession()
    this.ready = true
    this.emit()
  }

  private migrateStaleFishingSession() {
    const f = this.state.fishing
    if (!f || f.claimed) return
    const planned = f.readyAt - f.startedAt
    // 現設定の3倍超、または残りが10分超なら古いセッションとみなす
    if (planned > FISHING_DURATION_MS * 3 || f.readyAt - Date.now() > 10 * 60 * 1000) {
      this.state.fishing = null
    }
  }

  private async persistRemote() {
    if (this.mode !== 'firebase') return
    const profile: UserProfile = {
      name: this.state.name,
      fishing: this.state.fishing,
      caught: this.state.caught,
      createdAt: this.state.createdAt,
      updatedAt: Date.now(),
    }
    await saveUserProfile(this.state.uid, profile)
  }

  setName(name: string) {
    this.state.name = name.trim() || 'つりびと'
    this.emit()
    void this.persistRemote()
  }

  async startFishing(baitId: BaitId): Promise<boolean> {
    if (this.state.fishing && !this.state.fishing.claimed) {
      const now = Date.now()
      if (now < this.state.fishing.readyAt) return false
    }

    if (this.mode === 'firebase' && useCloudFunctions) {
      try {
        const session = await callStartFishing(baitId)
        if (session) {
          this.state.fishing = session
          this.emit()
          return true
        }
      } catch (e) {
        console.warn('startFishing cloud failed, fallback local', e)
      }
    }

    const startedAt = Date.now()
    this.state.fishing = {
      baitId,
      startedAt,
      readyAt: startedAt + FISHING_DURATION_MS,
      claimed: false,
    }
    this.emit()
    void this.persistRemote()
    return true
  }

  isReadyToClaim(): boolean {
    const f = this.state.fishing
    if (!f || f.claimed) return false
    return Date.now() >= f.readyAt
  }

  remainingMs(): number {
    const f = this.state.fishing
    if (!f || f.claimed) return 0
    return Math.max(0, f.readyAt - Date.now())
  }

  progress01(): number {
    const f = this.state.fishing
    if (!f) return 0
    if (f.claimed) return 1
    const total = f.readyAt - f.startedAt
    if (total <= 0) return 1
    return Math.min(1, (Date.now() - f.startedAt) / total)
  }

  /**
   * クライアント側ガチャ結果を保存。
   * Cloud Functions 利用時は claimFishServer() を優先すること。
   */
  claimFish(fishId: string, sizeCm: number) {
    const f = this.state.fishing
    if (!f || f.claimed) return null
    if (Date.now() < f.readyAt) return null

    const prev = this.state.caught[fishId]
    const next: CaughtFishRecord = {
      fishId,
      count: (prev?.count ?? 0) + 1,
      maxSizeCm: Math.max(prev?.maxSizeCm ?? 0, sizeCm),
      lastCaughtAt: Date.now(),
    }
    this.state.caught[fishId] = next
    this.state.fishing = { ...f, claimed: true }
    this.emit()
    void this.persistRemote()
    return next
  }

  /** サーバー側ガチャ（Auth + Functions 有効時） */
  async claimFishServer(): Promise<{
    fishId: string
    sizeCm: number
    isNew: boolean
  } | null> {
    if (this.mode !== 'firebase' || !useCloudFunctions) return null
    try {
      const result = await callClaimFish()
      if (!result) return null
      const prev = this.state.caught[result.fishId]
      this.state.caught[result.fishId] = {
        fishId: result.fishId,
        count: (prev?.count ?? 0) + 1,
        maxSizeCm: Math.max(prev?.maxSizeCm ?? 0, result.sizeCm),
        lastCaughtAt: Date.now(),
      }
      if (this.state.fishing) {
        this.state.fishing = { ...this.state.fishing, claimed: true }
      }
      this.emit()
      return result
    } catch (e) {
      console.warn('claimFish cloud failed', e)
      return null
    }
  }

  clearSession() {
    this.state.fishing = null
    this.emit()
    void this.persistRemote()
  }

  setNotifGranted(v: boolean) {
    this.state.notifGranted = v
    this.emit()
  }

  exportSave(): string {
    return JSON.stringify(
      {
        v: 1,
        exportedAt: Date.now(),
        name: this.state.name,
        caught: this.state.caught,
        fishing: this.state.fishing,
        createdAt: this.state.createdAt,
      },
      null,
      2,
    )
  }

  importSave(json: string): boolean {
    try {
      const data = JSON.parse(json) as {
        name?: string
        caught?: Record<string, CaughtFishRecord>
        fishing?: FishingSession | null
        createdAt?: number
      }
      if (!data || typeof data !== 'object') return false
      if (data.name) this.state.name = String(data.name).slice(0, 16)
      if (data.caught && typeof data.caught === 'object') {
        this.state.caught = data.caught
      }
      if (data.fishing !== undefined) this.state.fishing = data.fishing
      if (data.createdAt) this.state.createdAt = data.createdAt
      this.emit()
      void this.persistRemote()
      return true
    } catch {
      return false
    }
  }

  caughtCount(): number {
    return Object.values(this.state.caught).reduce((s, c) => s + c.count, 0)
  }

  uniqueCaught(): number {
    return Object.keys(this.state.caught).length
  }
}

export const store = new Store()
