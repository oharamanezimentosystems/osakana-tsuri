import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'

initializeApp()
setGlobalOptions({ region: 'asia-northeast1' })

const db = getFirestore()

/** 本番の待ち時間（ミリ秒）。既定 30秒。環境変数 FISHING_MS で上書き可 */
const FISHING_MS = Number(process.env.FISHING_MS ?? 30_000)

const MASTER_WEIGHTS: Record<string, number> = {
  marukin: 45,
  fukufuku: 35,
  ribon_demekin: 15,
  oukan_madai: 4,
  hoshizora_jinbee: 1,
}

const SIZE_RANGE: Record<string, [number, number]> = {
  marukin: [5, 12],
  fukufuku: [6, 14],
  ribon_demekin: [7, 15],
  oukan_madai: [10, 22],
  hoshizora_jinbee: [18, 40],
}

function rollFishId(baitId: string): string {
  const boost = baitId === 'lure' ? 1.8 : 1
  const entries = Object.entries(MASTER_WEIGHTS).map(([id, w]) => {
    let weight = w
    if (id !== 'marukin' && id !== 'fukufuku') weight *= boost
    return { id, weight }
  })
  const total = entries.reduce((s, e) => s + e.weight, 0)
  let r = Math.random() * total
  for (const e of entries) {
    r -= e.weight
    if (r <= 0) return e.id
  }
  return 'marukin'
}

function rollSize(fishId: string): number {
  const [min, max] = SIZE_RANGE[fishId] ?? [5, 12]
  return Math.round((min + Math.random() * (max - min)) * 10) / 10
}

async function requireUid(auth: { uid: string } | undefined): Promise<string> {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'ログインが必要です')
  return auth.uid
}

/** サーバー時刻で釣り開始を記録（チート対策） */
export const startFishing = onCall(async (request) => {
  const uid = await requireUid(request.auth)
  const baitId = String(request.data?.baitId ?? 'worm')
  if (baitId !== 'worm' && baitId !== 'lure') {
    throw new HttpsError('invalid-argument', '不正なエサです')
  }

  const userRef = db.collection('users').doc(uid)
  const snap = await userRef.get()
  const data = snap.data() ?? {}
  const fishing = data.fishing as
    | { claimed?: boolean; readyAt?: number }
    | null
    | undefined

  const now = Date.now()
  if (fishing && !fishing.claimed && fishing.readyAt && now < fishing.readyAt) {
    throw new HttpsError('failed-precondition', 'すでに釣り中です')
  }

  const session = {
    baitId,
    startedAt: now,
    readyAt: now + FISHING_MS,
    claimed: false,
  }

  await userRef.set(
    {
      fishing: session,
      updatedAt: now,
      createdAt: data.createdAt ?? now,
      name: data.name ?? 'つりびと',
      caught: data.caught ?? {},
    },
    { merge: true },
  )

  return { fishing: session, serverNow: now }
})

/** サーバー側で時間判定＋ガチャ */
export const claimFish = onCall(async (request) => {
  const uid = await requireUid(request.auth)
  const userRef = db.collection('users').doc(uid)
  const snap = await userRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'ユーザーがありません')

  const data = snap.data()!
  const fishing = data.fishing as {
    baitId?: string
    readyAt?: number
    claimed?: boolean
  } | null

  if (!fishing || fishing.claimed) {
    throw new HttpsError('failed-precondition', '釣り上げられる状態ではありません')
  }

  const now = Date.now()
  // クライアント時計のズレを少し許容
  if (!fishing.readyAt || now + 2000 < fishing.readyAt) {
    throw new HttpsError('failed-precondition', 'まだ時間が足りません')
  }

  const fishId = rollFishId(fishing.baitId ?? 'worm')
  const sizeCm = rollSize(fishId)
  const caught = { ...(data.caught ?? {}) } as Record<
    string,
    { fishId: string; count: number; maxSizeCm: number; lastCaughtAt: number }
  >
  const prev = caught[fishId]
  caught[fishId] = {
    fishId,
    count: (prev?.count ?? 0) + 1,
    maxSizeCm: Math.max(prev?.maxSizeCm ?? 0, sizeCm),
    lastCaughtAt: now,
  }

  await userRef.set(
    {
      fishing: { ...fishing, claimed: true },
      caught,
      updatedAt: now,
    },
    { merge: true },
  )

  return {
    fishId,
    sizeCm,
    isNew: !prev,
    count: caught[fishId].count,
    maxSizeCm: caught[fishId].maxSizeCm,
    serverNow: now,
  }
})

/** 匿名→Google 連携後の確認用（任意） */
export const pingAuth = onCall(async (request) => {
  const uid = await requireUid(request.auth)
  const user = await getAuth().getUser(uid)
  return {
    uid,
    providers: user.providerData.map((p) => p.providerId),
    isAnonymous: user.providerData.length === 0,
  }
})

// FieldValue を使わない静的解析回避用（将来拡張）
void FieldValue
