export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface MasterFish {
  id: string
  name: string
  rarity: Rarity
  description: string
  image: string
  resultImage?: string
  weight: number
  minSizeCm: number
  maxSizeCm: number
  color: string
}

/** マスター魚データ（Firestore master_fishes と同内容） */
export const MASTER_FISHES: MasterFish[] = [
  {
    id: 'marukin',
    name: 'まるきん',
    rarity: 'common',
    description: 'ぽよぽよのお腹が自慢の金魚さん。見つめるだけでほっこりするよ。',
    image: '/assets/fish/marukin.png',
    resultImage: '/assets/fish/marukin_surprise.png',
    weight: 45,
    minSizeCm: 5,
    maxSizeCm: 12,
    color: '#ff9f43',
  },
  {
    id: 'fukufuku',
    name: 'ふくふくフグ',
    rarity: 'common',
    description: 'びっくりするとまるく膨らむけど、いつもニコニコ。とげもふわふわだよ。',
    image: '/assets/fish/fukufuku.png',
    resultImage: '/assets/fish/fukufuku_happy.png',
    weight: 35,
    minSizeCm: 6,
    maxSizeCm: 14,
    color: '#f9ca24',
  },
  {
    id: 'ribon_demekin',
    name: 'りぼんデメキン',
    rarity: 'uncommon',
    description: 'おしゃれなりぼんがトレードマーク。ぱっちりおめめでこっちを見てるよ。',
    image: '/assets/fish/ribon_demekin.png',
    weight: 15,
    minSizeCm: 7,
    maxSizeCm: 15,
    color: '#f8a5c2',
  },
  {
    id: 'oukan_madai',
    name: 'おうかんマダイ',
    rarity: 'rare',
    description: '小さな王冠をかぶったお姫さま。めでたい日に会えるかも…？',
    image: '/assets/fish/oukan_madai.png',
    weight: 4,
    minSizeCm: 10,
    maxSizeCm: 22,
    color: '#ee5a6f',
  },
  {
    id: 'hoshizora_jinbee',
    name: 'ほしぞらジンベエ',
    rarity: 'legendary',
    description: '体にきらめく星たちが、夜空みたいにきれい。伝説の癒しオーラだよ。',
    image: '/assets/fish/hoshizora_jinbee.png',
    weight: 1,
    minSizeCm: 18,
    maxSizeCm: 40,
    color: '#74b9ff',
  },
]

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'コモン',
  uncommon: 'アンコモン',
  rare: 'レア',
  legendary: 'レジェンダリー',
}

export const RARITY_CLASS: Record<Rarity, string> = {
  common: 'rarity-common',
  uncommon: 'rarity-uncommon',
  rare: 'rarity-rare',
  legendary: 'rarity-legendary',
}

export type BaitId = 'worm' | 'lure'

export interface Bait {
  id: BaitId
  name: string
  description: string
  image: string
  /** レア度ブースト係数（weight 調整用） */
  rareBoost: number
}

export const BAITS: Bait[] = [
  {
    id: 'worm',
    name: 'みみずエサ',
    description: '定番のやさしいエサ。こまめに釣れるよ',
    image: '/assets/ui/bait_worm.png',
    rareBoost: 1,
  },
  {
    id: 'lure',
    name: 'きらきらルアー',
    description: 'レアなお魚が少し寄りやすい',
    image: '/assets/ui/lure.png',
    rareBoost: 1.8,
  },
]

export function getFishById(id: string): MasterFish | undefined {
  return MASTER_FISHES.find((f) => f.id === id)
}

export function rollFish(baitId: BaitId = 'worm'): MasterFish {
  const bait = BAITS.find((b) => b.id === baitId) ?? BAITS[0]
  const weighted = MASTER_FISHES.map((f) => {
    let w = f.weight
    if (f.rarity === 'rare' || f.rarity === 'legendary' || f.rarity === 'uncommon') {
      w *= bait.rareBoost
    }
    return { fish: f, w }
  })
  const total = weighted.reduce((s, x) => s + x.w, 0)
  let r = Math.random() * total
  for (const item of weighted) {
    r -= item.w
    if (r <= 0) return item.fish
  }
  return MASTER_FISHES[0]
}

export function rollSizeCm(fish: MasterFish): number {
  const t = Math.random()
  const size = fish.minSizeCm + t * (fish.maxSizeCm - fish.minSizeCm)
  return Math.round(size * 10) / 10
}
