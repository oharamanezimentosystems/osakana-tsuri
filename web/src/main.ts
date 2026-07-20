import './style.css'
import { APP_NAME, DEBUG, FISHING_DURATION_MS, fishingMood } from './config'
import {
  BAITS,
  MASTER_FISHES,
  RARITY_CLASS,
  RARITY_LABEL,
  getFishById,
  rollFish,
  rollSizeCm,
  type BaitId,
  type MasterFish,
} from './data/fishes'
import { store } from './store'
import { requestNotificationPermission, notifyFishReady } from './notify'
import { isFirebaseConfigured, useCloudFunctions, linkGoogleAccount } from './firebase'

type Tab = 'fish' | 'dex' | 'profile'

const app = document.querySelector<HTMLDivElement>('#app')!

let selectedBait: BaitId = 'worm'
let currentTab: Tab = 'fish'
let timerId: number | null = null
let notifiedForSession = false
let lastResult: { fish: MasterFish; sizeCm: number; isNew: boolean } | null = null

function formatRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r}秒`
  return `${m}分${String(r).padStart(2, '0')}秒`
}

function shell() {
  app.innerHTML = `
    <div class="loading-screen" id="loading">うみのなか… 🐠</div>

    <header class="app-header" id="header" hidden>
      <div class="logo">🐟 ${APP_NAME}</div>
      <div class="badge" id="debug-badge" ${DEBUG ? '' : 'hidden'}>DEBUG ${FISHING_DURATION_MS / 1000}s</div>
    </header>

    <section class="view" id="view-fish" hidden></section>
    <section class="view hidden" id="view-dex" hidden></section>
    <section class="view hidden" id="view-profile" hidden></section>

    <nav class="tab-nav" id="tabs" hidden>
      <button class="tab-btn active" data-tab="fish"><span class="icon">🎣</span>つり</button>
      <button class="tab-btn" data-tab="dex"><span class="icon">📖</span>ずかん</button>
      <button class="tab-btn" data-tab="profile"><span class="icon">👤</span>プロフィール</button>
    </nav>

    <div class="result-overlay" id="result">
      <div class="sparkles" id="sparkles"></div>
      <img class="result-fish" id="result-img" alt="" />
      <div class="result-title" id="result-title">つれた！</div>
      <div class="result-name" id="result-name"></div>
      <div class="result-meta" id="result-meta"></div>
      <button class="btn btn-primary" id="result-close">やったね！</button>
    </div>

    <div class="modal-backdrop" id="modal">
      <div class="modal">
        <img id="modal-img" alt="" />
        <div id="modal-rarity"></div>
        <h3 id="modal-name"></h3>
        <p id="modal-desc"></p>
        <p id="modal-stats" class="meta"></p>
        <button class="btn btn-secondary" id="modal-close">とじる</button>
      </div>
    </div>

    <div class="toast" id="toast"></div>
  `

  document.getElementById('tabs')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]')
    if (!btn) return
    switchTab(btn.dataset.tab as Tab)
  })

  document.getElementById('result-close')!.addEventListener('click', () => {
    document.getElementById('result')!.classList.remove('show')
    store.clearSession()
    renderFishView()
  })

  document.getElementById('modal-close')!.addEventListener('click', () => {
    document.getElementById('modal')!.classList.remove('show')
  })
  document.getElementById('modal')!.addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) {
      document.getElementById('modal')!.classList.remove('show')
    }
  })
}

function switchTab(tab: Tab) {
  currentTab = tab
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.classList.toggle('active', (b as HTMLElement).dataset.tab === tab)
  })
  document.getElementById('view-fish')!.classList.toggle('hidden', tab !== 'fish')
  document.getElementById('view-dex')!.classList.toggle('hidden', tab !== 'dex')
  document.getElementById('view-profile')!.classList.toggle('hidden', tab !== 'profile')

  if (tab === 'fish') renderFishView()
  if (tab === 'dex') renderDex()
  if (tab === 'profile') renderProfile()
}

function renderFishView() {
  const el = document.getElementById('view-fish')!
  const fishing = store.state.fishing
  const active = fishing && !fishing.claimed
  const ready = store.isReadyToClaim()
  const progress = store.progress01()
  const mood = active ? fishingMood(progress, ready) : null

  el.innerHTML = `
    <div class="pond" data-mood="${mood?.mood ?? 'idle'}">
      <div class="sun"></div>
      <div class="clouds">
        <div class="cloud cloud-a"></div>
        <div class="cloud cloud-b"></div>
      </div>
      <div class="swim-lane" aria-hidden="true">
        <span class="swim-fish swim-1">🐟</span>
        <span class="swim-fish swim-2">🐠</span>
        <span class="swim-fish swim-3">🐡</span>
      </div>
      <div class="water-surface">
        <div class="wave wave-1"></div>
        <div class="wave wave-2"></div>
        <div class="wave wave-3"></div>
        <div class="bubbles">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="ripple ${active && !ready ? 'on' : ''}"></div>
      </div>
      ${
        active
          ? `<div class="float ${ready ? 'ready' : ''} ${mood?.mood === 'nibble' || mood?.mood === 'close' ? 'nibble' : ''}" id="float">
               <div class="float-tip"></div><div class="float-body"></div>
             </div>
             <div class="pond-message" id="pond-message">${mood!.message}</div>`
          : `<div class="pond-message">エサをえらんで、つりをはじめよう</div>`
      }
    </div>

    <div class="panel">
      ${
        active
          ? `
        <div class="phase-row">
          <span class="phase ${progress >= 0 || ready ? 'done' : ''}">投げた</span>
          <span class="phase ${progress >= 0.35 || ready ? 'done' : ''} ${progress >= 0.15 && progress < 0.35 ? 'now' : ''}">待ち</span>
          <span class="phase ${progress >= 0.7 || ready ? 'done' : ''} ${progress >= 0.35 && progress < 0.7 ? 'now' : ''}">反応</span>
          <span class="phase ${ready ? 'done now' : ''} ${progress >= 0.7 && !ready ? 'now' : ''}">ゲット</span>
        </div>
        <div class="timer-row">
          <div class="timer-text" id="timer-text">${ready ? 'READY!' : formatRemaining(store.remainingMs())}</div>
          <div class="progress"><i id="progress-bar" style="width:${progress * 100}%"></i></div>
        </div>
        <p class="live-hint" id="live-hint">${mood!.message}</p>
        ${
          ready
            ? `<button class="btn btn-claim" id="btn-claim">つりあげる！ ✨</button>`
            : `<button class="btn btn-primary" id="btn-start" disabled>つりちゅう… 👀</button>
               <p class="hint">約${Math.round(FISHING_DURATION_MS / 1000)}秒でかかるよ。タブを閉じてもOK！</p>`
        }
      `
          : `
        <h2>エサをえらぶ</h2>
        <div class="bait-list" id="bait-list">
          ${BAITS.map(
            (b) => `
            <button type="button" class="bait-card ${selectedBait === b.id ? 'selected' : ''}" data-bait="${b.id}">
              <img src="${b.image}" alt="" />
              <div class="name">${b.name}</div>
              <div class="desc">${b.description}</div>
            </button>`,
          ).join('')}
        </div>
        <button class="btn btn-primary" id="btn-start">つりをはじめる 🎣</button>
        <p class="hint">待ち時間 約${Math.round(FISHING_DURATION_MS / 1000)}秒 → すぐつりあげ！${DEBUG ? '（デバッグ）' : ''}</p>
      `
      }
    </div>
  `

  el.querySelectorAll<HTMLButtonElement>('[data-bait]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedBait = btn.dataset.bait as BaitId
      renderFishView()
    })
  })

  const startBtn = document.getElementById('btn-start')
  startBtn?.addEventListener('click', async () => {
    if (startBtn.hasAttribute('disabled')) return
    startBtn.setAttribute('disabled', 'true')
    startBtn.textContent = 'じゅんび中…'
    try {
      const ok = await store.startFishing(selectedBait)
      if (!ok) {
        showToast('いまはつりはじめられないよ')
        return
      }
      notifiedForSession = false
      lastMoodKey = ''
      maybeAskNotification()
      renderFishView()
      startTimerLoop()
    } finally {
      // renderFishView でボタンは作り直される
    }
  })

  document.getElementById('btn-claim')?.addEventListener('click', () => {
    void claim()
  })
}

async function claim() {
  if (!store.isReadyToClaim()) return

  const server = await store.claimFishServer()
  if (server) {
    const fish = getFishById(server.fishId)
    if (!fish) return
    lastResult = { fish, sizeCm: server.sizeCm, isNew: server.isNew }
    showResult()
    return
  }

  const baitId = (store.state.fishing?.baitId as BaitId) || 'worm'
  const fish = rollFish(baitId)
  const sizeCm = rollSizeCm(fish)
  const wasNew = !store.state.caught[fish.id]
  const result = store.claimFish(fish.id, sizeCm)
  if (!result) return

  lastResult = { fish, sizeCm, isNew: wasNew }
  showResult()
}

function showResult() {
  if (!lastResult) return
  const { fish, sizeCm, isNew } = lastResult
  const img = document.getElementById('result-img') as HTMLImageElement
  img.src = fish.resultImage || fish.image
  img.alt = fish.name

  document.getElementById('result-title')!.textContent = isNew ? 'NEW！つれた！' : 'つれた！'
  document.getElementById('result-name')!.textContent = fish.name
  document.getElementById('result-meta')!.innerHTML = `
    <span class="rarity-pill ${RARITY_CLASS[fish.rarity]}">${RARITY_LABEL[fish.rarity]}</span><br/>
    サイズ ${sizeCm.toFixed(1)} cm<br/>
    ${fish.description}
  `

  const sparks = document.getElementById('sparkles')!
  sparks.innerHTML = ''
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('div')
    s.className = 'sparkle'
    s.style.left = `${Math.random() * 100}%`
    s.style.top = `${20 + Math.random() * 60}%`
    s.style.animationDelay = `${Math.random() * 0.8}s`
    s.style.background = ['#ffeaa7', '#fd79a8', '#74b9ff', '#55efc4', '#a29bfe'][i % 5]
    sparks.appendChild(s)
  }

  document.getElementById('result')!.classList.add('show')
}

function renderDex() {
  const el = document.getElementById('view-dex')!
  const unique = store.uniqueCaught()
  const total = MASTER_FISHES.length

  el.innerHTML = `
    <div class="dex-header">
      <h1>おさかなずかん 📖</h1>
      <p>あつめたおさかな ${unique} / ${total}　｜　つった数 ${store.caughtCount()} ひき</p>
    </div>
    <div class="dex-grid">
      ${MASTER_FISHES.map((f) => {
        const c = store.state.caught[f.id]
        const locked = !c
        return `
          <button type="button" class="dex-card ${locked ? 'locked' : ''}" data-fish="${f.id}">
            <div class="rarity-pill ${RARITY_CLASS[f.rarity]}">${RARITY_LABEL[f.rarity]}</div>
            <img src="${f.image}" alt="" />
            <div class="fish-name">${locked ? '？？？' : f.name}</div>
            <div class="meta">${locked ? 'みはっけん' : `${c.count}ひき · 最大${c.maxSizeCm.toFixed(1)}cm`}</div>
          </button>
        `
      }).join('')}
    </div>
  `

  el.querySelectorAll<HTMLButtonElement>('[data-fish]').forEach((btn) => {
    btn.addEventListener('click', () => openFishModal(btn.dataset.fish!))
  })
}

function openFishModal(id: string) {
  const f = getFishById(id)
  if (!f) return
  const c = store.state.caught[id]
  const locked = !c
  ;(document.getElementById('modal-img') as HTMLImageElement).src = f.image
  document.getElementById('modal-img')!.style.filter = locked ? 'brightness(0) opacity(0.4)' : ''
  document.getElementById('modal-rarity')!.innerHTML =
    `<span class="rarity-pill ${RARITY_CLASS[f.rarity]}">${RARITY_LABEL[f.rarity]}</span>`
  document.getElementById('modal-name')!.textContent = locked ? '？？？' : f.name
  document.getElementById('modal-desc')!.textContent = locked
    ? 'まだ会えていないお魚だよ。つりを続けてみよう！'
    : f.description
  document.getElementById('modal-stats')!.textContent = locked
    ? ''
    : `つった数: ${c.count} ／ 最大サイズ: ${c.maxSizeCm.toFixed(1)} cm`
  document.getElementById('modal')!.classList.add('show')
}

function renderProfile() {
  const el = document.getElementById('view-profile')!
  const cloudHint =
    store.mode === 'firebase'
      ? 'クラウド保存ON'
      : isFirebaseConfigured
        ? 'Auth未設定 → 端末保存（コンソールで匿名ログインをONにすると同期）'
        : 'Firebase未設定 → 端末保存'

  el.innerHTML = `
    <div class="profile-card">
      <div class="avatar">🎣</div>
      <h2 id="profile-name">${escapeHtml(store.state.name)}</h2>
      <div class="stats">
        <div class="stat"><div class="num">${store.caughtCount()}</div><div class="label">つった数</div></div>
        <div class="stat"><div class="num">${store.uniqueCaught()}/${MASTER_FISHES.length}</div><div class="label">ずかん</div></div>
      </div>
      <div class="name-form">
        <input id="name-input" maxlength="16" value="${escapeAttr(store.state.name)}" placeholder="なまえ" />
        <button class="btn btn-primary" id="btn-rename">へんこう</button>
      </div>
      <div class="mode-pill">${cloudHint}${useCloudFunctions ? ' · Functions' : ''}</div>

      <div class="profile-actions">
        <button class="btn btn-secondary" id="btn-export">データ書き出し 💾</button>
        <button class="btn btn-secondary" id="btn-import">データ読み込み 📂</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden />
      </div>

      ${
        store.mode === 'firebase'
          ? `<button class="btn btn-secondary" id="btn-google" style="margin-top:12px">Googleでサインイン（データ引き継ぎ）</button>`
          : `<p class="hint" style="margin-top:12px">
              クラウド保存を使うには
              <a href="https://console.firebase.google.com/project/osakana-tsuri/authentication" target="_blank" rel="noopener">Authentication</a>
              で匿名ログインを有効にしてください
            </p>`
      }
    </div>
  `

  document.getElementById('btn-rename')!.addEventListener('click', () => {
    const v = (document.getElementById('name-input') as HTMLInputElement).value
    store.setName(v)
    renderProfile()
    showToast('なまえを更新したよ！')
  })

  document.getElementById('btn-export')!.addEventListener('click', () => {
    const blob = new Blob([store.exportSave()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `osakana-save-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('セーブデータを書き出したよ！')
  })

  document.getElementById('btn-import')!.addEventListener('click', () => {
    document.getElementById('import-file')!.click()
  })

  document.getElementById('import-file')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    if (store.importSave(text)) {
      showToast('データを読み込んだよ！')
      renderProfile()
    } else {
      showToast('読み込みに失敗したよ…JSONを確認してね')
    }
  })

  document.getElementById('btn-google')?.addEventListener('click', async () => {
    try {
      await linkGoogleAccount()
      showToast('Googleアカウントと連携したよ！')
      renderProfile()
    } catch (e) {
      console.error(e)
      showToast('連携に失敗しました（Auth設定 or 既に連携済みかも）')
    }
  })
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

let lastMoodKey = ''

function startTimerLoop() {
  if (timerId != null) window.clearInterval(timerId)
  timerId = window.setInterval(() => {
    const fishing = store.state.fishing
    if (!fishing || fishing.claimed) return

    const ready = store.isReadyToClaim()
    const progress = store.progress01()
    const mood = fishingMood(progress, ready)

    if (ready) {
      if (!notifiedForSession) {
        notifiedForSession = true
        notifyFishReady()
      }
      if (currentTab === 'fish') {
        const t = document.getElementById('timer-text')
        if (t && t.textContent !== 'READY!') {
          renderFishView()
        }
      }
      return
    }

    if (currentTab !== 'fish') return

    // ムードが変わったら演出ごと描き直し（フェーズ変化を感じる）
    if (mood.mood !== lastMoodKey) {
      lastMoodKey = mood.mood
      renderFishView()
      return
    }

    const t = document.getElementById('timer-text')
    const bar = document.getElementById('progress-bar')
    const msg = document.getElementById('pond-message')
    const hint = document.getElementById('live-hint')
    if (t) t.textContent = formatRemaining(store.remainingMs())
    if (bar) bar.style.width = `${progress * 100}%`
    if (msg) msg.textContent = mood.message
    if (hint) hint.textContent = mood.message
  }, 200)
}

function maybeAskNotification() {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'default') {
    store.setNotifGranted(Notification.permission === 'granted')
    return
  }
  if (store.state.notifGranted) return

  const toast = document.getElementById('toast')!
  toast.innerHTML = `
    お魚がかかったらおしらせする？ 🔔
    <div class="actions">
      <button class="btn btn-primary" id="toast-yes">いいよ</button>
      <button class="btn btn-secondary" id="toast-no">あとで</button>
    </div>
  `
  toast.classList.add('show')

  document.getElementById('toast-yes')!.onclick = async () => {
    const p = await requestNotificationPermission()
    store.setNotifGranted(p === 'granted')
    toast.classList.remove('show')
    if (p === 'granted') showToast('通知ONにしたよ！')
  }
  document.getElementById('toast-no')!.onclick = () => {
    toast.classList.remove('show')
  }
}

function showToast(msg: string) {
  const toast = document.getElementById('toast')!
  toast.textContent = msg
  toast.classList.add('show')
  window.setTimeout(() => toast.classList.remove('show'), 2200)
}

async function boot() {
  shell()
  await store.init()

  document.getElementById('loading')!.classList.add('hidden')
  document.getElementById('header')!.hidden = false
  document.getElementById('tabs')!.hidden = false
  document.getElementById('view-fish')!.hidden = false

  switchTab('fish')
  startTimerLoop()

  // resume ready state after reload
  if (store.isReadyToClaim() && !notifiedForSession) {
    notifiedForSession = true
  }
}

boot()
