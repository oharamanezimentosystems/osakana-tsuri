/**
 * ゲーム設定
 * DEBUG: 放置時間を短くしてループ検証できるようにする
 */
export const DEBUG = import.meta.env.VITE_DEBUG !== 'false'

/**
 * 本番の待ち時間（既定 30秒）。
 * 長時間放置より「何度も釣る」楽しさを優先。
 */
export const PRODUCTION_FISHING_MS = Number(
  import.meta.env.VITE_PRODUCTION_FISHING_MS ?? 30_000,
)

export const FISHING_DURATION_MS = DEBUG
  ? Number(import.meta.env.VITE_FISHING_MS ?? 10_000)
  : PRODUCTION_FISHING_MS

export const APP_NAME = 'おさかなつり'

/** 待ち時間中の演出メッセージ（進捗 0〜1） */
export function fishingMood(progress01: number, ready: boolean): {
  message: string
  mood: 'cast' | 'wait' | 'nibble' | 'close' | 'ready'
} {
  if (ready) return { message: 'ウキが沈んだ！つりあげよう！🎣', mood: 'ready' }
  if (progress01 < 0.15) return { message: 'ぽちゃん… エサを投げたよ', mood: 'cast' }
  if (progress01 < 0.4) return { message: 'きらきら… 水面がゆれてる', mood: 'wait' }
  if (progress01 < 0.65) return { message: 'ん…？ なにかいるかも…', mood: 'nibble' }
  if (progress01 < 0.85) return { message: 'ピクッ！ ウキが動いた！', mood: 'nibble' }
  return { message: 'もうすぐかかるよ…！', mood: 'close' }
}
