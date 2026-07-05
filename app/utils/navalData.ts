// ============================================================
// ミッドウェー海戦 ― 艦隊・飛行隊・爆発・天候・カメラ・章構成
// 座標系: x+ = 東, z+ = 南, y = 高度。タイムライン: 0〜150秒
// 現地時間 1942年6月4日 午前4時30分〜日没 に対応
// ============================================================

export type Side = 'jp' | 'us'

export const SIDE_COLORS: Record<Side, number> = {
  jp: 0xd6413a, // 日本海軍: 緋
  us: 0x4d7fd6  // 米海軍: 青
}

// ---------- ミッドウェー環礁 ----------

export const ATOLL = { x: 520, z: 360, lagoonR: 52, reefR: 68 }

// ---------- 艦隊 ----------

export interface FleetKey { t: number; x: number; z: number }

export interface ShipDef {
  id?: string          // 被弾演出などで参照する艦のみ
  name?: string        // ラベルを出す艦のみ
  type: 'cv' | 'bb' | 'ca' | 'dd'
  dx: number           // 陣形内オフセット(進行方向基準)
  dz: number
}

export interface Fleet {
  id: string
  side: Side
  keys: FleetKey[]
  ships: ShipDef[]
}

export const FLEETS: Fleet[] = [
  {
    // 南雲機動部隊(第一航空艦隊)― 北西よりミッドウェーへ
    id: 'kido', side: 'jp',
    keys: [
      { t: 0, x: -430, z: -230 },
      { t: 70, x: -310, z: -130 },
      { t: 95, x: -310, z: -130 },
      { t: 150, x: -520, z: -330 }
    ],
    ships: [
      { id: 'akagi', name: '赤城(旗艦)', type: 'cv', dx: 0, dz: -10 },
      { id: 'kaga', name: '加賀', type: 'cv', dx: 55, dz: 28 },
      { id: 'soryu', name: '蒼龍', type: 'cv', dx: -52, dz: 32 },
      { id: 'hiryu', name: '飛龍', type: 'cv', dx: 12, dz: -78 },
      { name: '榛名', type: 'bb', dx: -108, dz: 72 },
      { name: '霧島', type: 'bb', dx: -122, dz: -52 },
      { name: '利根', type: 'ca', dx: 96, dz: -48 },
      { name: '筑摩', type: 'ca', dx: 122, dz: 42 },
      { type: 'dd', dx: 0, dz: 95 },
      { type: 'dd', dx: 165, dz: -5 },
      { type: 'dd', dx: -165, dz: 12 },
      { type: 'dd', dx: 62, dz: -125 },
      { type: 'dd', dx: -62, dz: 115 },
      { type: 'dd', dx: -30, dz: -145 }
    ]
  },
  {
    // 米第16任務部隊(スプルーアンス)
    id: 'tf16', side: 'us',
    keys: [
      { t: 0, x: 420, z: -300 },
      { t: 50, x: 270, z: -205 },
      { t: 95, x: 280, z: -215 },
      { t: 150, x: 350, z: -250 }
    ],
    ships: [
      { id: 'enterprise', name: 'エンタープライズ', type: 'cv', dx: 0, dz: 0 },
      { id: 'hornet', name: 'ホーネット', type: 'cv', dx: 72, dz: 48 },
      { type: 'ca', dx: -55, dz: 42 },
      { type: 'ca', dx: 42, dz: -55 },
      { type: 'ca', dx: 115, dz: -8 },
      { type: 'dd', dx: -95, dz: -45 },
      { type: 'dd', dx: 25, dz: 95 },
      { type: 'dd', dx: 140, dz: 75 },
      { type: 'dd', dx: -35, dz: -100 }
    ]
  },
  {
    // 米第17任務部隊(フレッチャー)
    id: 'tf17', side: 'us',
    keys: [
      { t: 0, x: 530, z: -185 },
      { t: 95, x: 475, z: -178 },
      { t: 108, x: 468, z: -176 },
      { t: 150, x: 466, z: -175 }
    ],
    ships: [
      { id: 'yorktown', name: 'ヨークタウン', type: 'cv', dx: 0, dz: 0 },
      { type: 'ca', dx: -48, dz: 38 },
      { type: 'ca', dx: 52, dz: -35 },
      { type: 'dd', dx: -80, dz: -42 },
      { type: 'dd', dx: 30, dz: 78 },
      { type: 'dd', dx: 95, dz: 30 }
    ]
  }
]

// 被弾・炎上する艦
export interface Damage { ship: string; burnAt: number; list?: number }

export const DAMAGES: Damage[] = [
  { ship: 'kaga', burnAt: 79 },
  { ship: 'soryu', burnAt: 81.5 },
  { ship: 'akagi', burnAt: 84 },
  { ship: 'yorktown', burnAt: 108, list: 0.16 },
  { ship: 'hiryu', burnAt: 122 }
]

// ---------- 飛行隊 ----------

export interface SquadronKey { t: number; x: number; z: number; alt: number }

export interface Squadron {
  id: string
  name: string          // ラベル表示(史実の機数)
  side: Side
  count: number         // 描画する機数(代表)
  window: [number, number]
  keys?: SquadronKey[]
  orbit?: { x: number; z: number; r: number; alt: number; speed: number }
  loss?: { t0: number; t1: number; frac: number } // 損耗(この割合が順に消える)
}

export const SQUADRONS: Squadron[] = [
  {
    id: 'tomonaga', name: '友永隊 第一次攻撃隊 108機', side: 'jp', count: 21,
    window: [3, 40],
    keys: [
      { t: 3, x: -400, z: -230, alt: 8 },
      { t: 7, x: -340, z: -170, alt: 42 },
      { t: 19, x: 460, z: 310, alt: 55 },
      { t: 22, x: 560, z: 405, alt: 42 },
      { t: 25, x: 520, z: 440, alt: 50 },
      { t: 38, x: -300, z: -120, alt: 30 },
      { t: 40, x: -320, z: -135, alt: 8 }
    ]
  },
  {
    id: 'b17', name: 'B-17爆撃隊(ミッドウェー基地)', side: 'us', count: 9,
    window: [28, 47],
    keys: [
      { t: 28, x: 540, z: 385, alt: 20 },
      { t: 33, x: 250, z: 160, alt: 70 },
      { t: 39, x: -300, z: -140, alt: 78 },
      { t: 43, x: -180, z: -260, alt: 75 },
      { t: 47, x: 300, z: 100, alt: 70 }
    ]
  },
  {
    id: 'cap', name: '零戦直衛隊(CAP)', side: 'jp', count: 12,
    window: [8, 90],
    orbit: { x: -320, z: -140, r: 95, alt: 26, speed: 0.32 }
  },
  {
    id: 'vt8', name: 'VT-8 雷撃中隊 15機', side: 'us', count: 15,
    window: [46, 62],
    keys: [
      { t: 46, x: 290, z: -210, alt: 16 },
      { t: 52, x: -120, z: -150, alt: 7 },
      { t: 58, x: -290, z: -140, alt: 4 },
      { t: 62, x: -330, z: -135, alt: 3 }
    ],
    loss: { t0: 52, t1: 62, frac: 1.0 }
  },
  {
    id: 'mcclusky', name: 'マクラスキー隊 SBD 33機', side: 'us', count: 22,
    window: [60, 94],
    keys: [
      { t: 60, x: 285, z: -205, alt: 60 },
      { t: 68, x: -60, z: 70, alt: 74 },
      { t: 74, x: -250, z: -30, alt: 80 },
      { t: 78, x: -315, z: -110, alt: 76 },
      { t: 82, x: -330, z: -138, alt: 14 },
      { t: 86, x: -255, z: -195, alt: 10 },
      { t: 93, x: 180, z: -200, alt: 40 }
    ],
    loss: { t0: 82, t1: 92, frac: 0.35 }
  },
  {
    id: 'vb3', name: 'ヨークタウン隊 VB-3 17機', side: 'us', count: 12,
    window: [66, 92],
    keys: [
      { t: 66, x: 460, z: -170, alt: 62 },
      { t: 74, x: 40, z: -130, alt: 76 },
      { t: 80, x: -290, z: -155, alt: 74 },
      { t: 84, x: -335, z: -160, alt: 13 },
      { t: 88, x: -290, z: -230, alt: 15 },
      { t: 92, x: 60, z: -220, alt: 45 }
    ]
  },
  {
    id: 'hiryu-strike', name: '小林・友永隊(飛龍攻撃隊)', side: 'jp', count: 14,
    window: [96, 114],
    keys: [
      { t: 96, x: -300, z: -215, alt: 8 },
      { t: 99, x: -240, z: -190, alt: 45 },
      { t: 105, x: 250, z: -175, alt: 55 },
      { t: 108, x: 455, z: -178, alt: 25 },
      { t: 111, x: 520, z: -140, alt: 40 },
      { t: 114, x: 300, z: -100, alt: 45 }
    ],
    loss: { t0: 106, t1: 113, frac: 0.6 }
  },
  {
    id: 'us-final', name: '米第二次攻撃隊 SBD 24機', side: 'us', count: 16,
    window: [111, 128],
    keys: [
      { t: 111, x: 290, z: -220, alt: 20 },
      { t: 114, x: 160, z: -200, alt: 68 },
      { t: 119, x: -260, z: -165, alt: 76 },
      { t: 122, x: -350, z: -185, alt: 14 },
      { t: 125, x: -400, z: -260, alt: 20 },
      { t: 128, x: -200, z: -300, alt: 45 }
    ]
  }
]

// ---------- 爆発・水柱 ----------

export interface Boom {
  t: number
  type: 'boom' | 'splash'
  size: number
  x?: number
  z?: number
  ship?: string // 指定時は艦の現在位置に追従
}

export const BOOMS: Boom[] = [
  // ミッドウェー空襲
  { t: 20.5, type: 'boom', size: 14, x: 508, z: 352 },
  { t: 22, type: 'boom', size: 16, x: 538, z: 372 },
  { t: 23.5, type: 'boom', size: 12, x: 518, z: 368 },
  // B-17の至近弾(命中せず)
  { t: 39.5, type: 'splash', size: 11, x: -336, z: -156 },
  { t: 40.8, type: 'splash', size: 12, x: -302, z: -120 },
  { t: 42.2, type: 'splash', size: 10, x: -350, z: -128 },
  // VT-8 撃墜(海面に散る)
  { t: 53, type: 'splash', size: 6, x: -240, z: -132 },
  { t: 55.5, type: 'splash', size: 6, x: -268, z: -145 },
  { t: 58, type: 'splash', size: 6, x: -295, z: -138 },
  { t: 60.5, type: 'splash', size: 6, x: -318, z: -130 },
  // 運命の五分間
  { t: 79, type: 'boom', size: 20, ship: 'kaga' },
  { t: 80.2, type: 'boom', size: 14, ship: 'kaga' },
  { t: 81.5, type: 'boom', size: 18, ship: 'soryu' },
  { t: 84, type: 'boom', size: 20, ship: 'akagi' },
  { t: 85.5, type: 'boom', size: 13, ship: 'akagi' },
  // ヨークタウン被弾
  { t: 107.5, type: 'boom', size: 15, ship: 'yorktown' },
  { t: 108.8, type: 'boom', size: 12, ship: 'yorktown' },
  { t: 109.5, type: 'splash', size: 10, x: 452, z: -190 },
  // 飛龍被弾
  { t: 121.5, type: 'boom', size: 16, ship: 'hiryu' },
  { t: 122.8, type: 'boom', size: 14, ship: 'hiryu' },
  { t: 124, type: 'boom', size: 12, ship: 'hiryu' }
]

// ---------- 進軍・攻撃矢印 ----------

export interface Arrow {
  id: string
  side: Side
  t0: number
  t1: number
  hold: number
  points: [number, number][]
  width?: number
  alt?: number // 矢印の高度(空襲経路は高め)
}

export const ARROWS: Arrow[] = [
  { id: 'adv-kido', side: 'jp', t0: 6, t1: 15, hold: 8, points: [[-450, -250], [-390, -195], [-330, -145]], width: 6 },
  { id: 'strike-tomonaga', side: 'jp', t0: 18, t1: 25, hold: 8, points: [[-360, -180], [80, 90], [495, 345]], alt: 26 },
  { id: 'sortie-tf', side: 'us', t0: 31, t1: 41, hold: 10, points: [[430, -300], [340, -245], [275, -208]], width: 6 },
  { id: 'atk-vt8', side: 'us', t0: 48, t1: 57, hold: 6, points: [[280, -205], [-30, -165], [-280, -140]], alt: 16 },
  { id: 'atk-mcclusky', side: 'us', t0: 70, t1: 80, hold: 4, points: [[280, -200], [-50, 60], [-255, -55], [-325, -128]], alt: 32 },
  { id: 'atk-vb3', side: 'us', t0: 72, t1: 82, hold: 4, points: [[465, -172], [50, -138], [-330, -158]], alt: 32 },
  { id: 'atk-hiryu', side: 'jp', t0: 96, t1: 106, hold: 6, points: [[-295, -205], [90, -190], [455, -180]], alt: 26 },
  { id: 'atk-final', side: 'us', t0: 112, t1: 120.5, hold: 6, points: [[295, -218], [-40, -185], [-345, -185]], alt: 30 },
  { id: 'retreat', side: 'jp', t0: 128, t1: 140, hold: 10, points: [[-330, -160], [-430, -250], [-535, -345]], width: 6 }
]

// ---------- フェーズ(番組構成) ----------

export interface Phase {
  start: number
  end: number
  chapter: string
  title: string
  narration: string
  timeLabel: string
}

export const PHASES: Phase[] = [
  {
    start: 0, end: 20,
    chapter: '序章',
    title: '暁の出撃',
    narration: '昭和17年6月4日未明(現地時間)。南雲忠一中将率いる機動部隊―空母赤城・加賀・蒼龍・飛龍―はミッドウェー島の北西240浬に達していた。午前4時30分、友永大尉率いる第一次攻撃隊108機が発艦する。',
    timeLabel: '午前4時30分'
  },
  {
    start: 20, end: 45,
    chapter: '第一章',
    title: 'ミッドウェー空襲',
    narration: '友永隊はミッドウェー基地を爆撃するも「第二次攻撃の要あり」と打電。兵装転換に着手した矢先、索敵機・利根四号機から「敵らしきもの十隻見ゆ」の報。予期せぬ米艦隊の出現が南雲司令部を激しく揺さぶる。',
    timeLabel: '午前6時20分'
  },
  {
    start: 45, end: 70,
    chapter: '第二章',
    title: '雷撃隊、全滅',
    narration: 'スプルーアンス少将は持てる攻撃隊のすべてを発進させていた。ホーネットのVT-8雷撃中隊15機は護衛なしで突入し、零戦の迎撃に全機が海へ散る。だがこの犠牲が、日本艦隊の直衛戦闘機を低空に釘付けにした。',
    timeLabel: '午前9時20分'
  },
  {
    start: 70, end: 95,
    chapter: '第三章',
    title: '運命の五分間',
    narration: '格納庫に爆弾と魚雷が散乱する最悪の瞬間、マクラスキー少佐のドーントレス急降下爆撃隊が高空から襲来。午前10時20分からのわずか5分間で、加賀・蒼龍・赤城は次々と火柱に包まれた。',
    timeLabel: '午前10時20分'
  },
  {
    start: 95, end: 120,
    chapter: '第四章',
    title: '飛龍の反撃',
    narration: 'ただ一隻残った飛龍は、山口多聞少将の指揮下でただちに反撃に転じる。小林隊・友永隊の二次にわたる攻撃がヨークタウンを大破させた。しかし午後5時、米軍の第二撃がついに飛龍を捉える。',
    timeLabel: '正午頃'
  },
  {
    start: 120, end: 150,
    chapter: '終章',
    title: '太平洋の転換点',
    narration: '日本海軍は虎の子の正規空母4隻と歴戦の搭乗員たちを一挙に失った。開戦以来無敵を誇った機動部隊の壊滅―ミッドウェーの敗北は、太平洋戦争の潮目を決定的に変えていく。',
    timeLabel: '午後5時'
  }
]

// 速報テロップ
export interface EventBanner { t0: number; t1: number; text: string; sub: string; accent: string }

export const EVENTS: EventBanner[] = [
  { t0: 20, t1: 25.5, text: 'ミッドウェー空襲', sub: '午前6時20分 ― 友永隊108機、基地を爆撃', accent: '#e8433a' },
  { t0: 33, t1: 39, text: '「敵空母見ユ」', sub: '午前7時28分 ― 利根四号機、米艦隊を発見', accent: '#f2a33c' },
  { t0: 48, t1: 53.5, text: '雷撃隊 全滅', sub: '護衛なき突入 ― VT-8、15機すべて海に散る', accent: '#4d7fd6' },
  { t0: 70, t1: 76, text: '運命の五分間', sub: '午前10時20分 ― 急降下爆撃隊、頭上に', accent: '#f2a33c' },
  { t0: 84.5, t1: 90, text: '赤城・加賀・蒼龍 被弾', sub: '三空母、瞬時に炎上', accent: '#e8433a' },
  { t0: 107, t1: 112.5, text: 'ヨークタウン被弾', sub: '飛龍攻撃隊、執念の反撃', accent: '#e8433a' },
  { t0: 121, t1: 126.5, text: '飛龍 被弾', sub: '午後5時3分 ― 最後の空母、火に包まれる', accent: '#4d7fd6' },
  { t0: 132, t1: 138, text: '機動部隊 壊滅', sub: '正規空母4隻を喪失 ― 戦局、逆転へ', accent: '#d8b24a' }
]

// ---------- カメラワーク ----------

export interface CamKey { t: number; pos: [number, number, number]; look: [number, number, number] }

export const CAMERA_KEYS: CamKey[] = [
  { t: 0,   pos: [-720, 190, 190],  look: [-390, 0, -195] },
  { t: 10,  pos: [-570, 115, 15],   look: [-405, 8, -218] },
  { t: 19,  pos: [-160, 160, -10],  look: [200, 20, 150] },
  { t: 26,  pos: [385, 135, 225],   look: [525, 5, 362] },
  { t: 35,  pos: [355, 205, -55],   look: [405, 12, -262] },
  { t: 45,  pos: [90, 175, -245],   look: [-200, 10, -150] },
  { t: 56,  pos: [-130, 105, -15],  look: [-330, 8, -145] },
  { t: 66,  pos: [-195, 330, 65],   look: [-320, 0, -135] },
  { t: 75,  pos: [-300, 480, -35],  look: [-315, 0, -132] },
  { t: 83,  pos: [-170, 150, 30],   look: [-320, 10, -138] },
  { t: 92,  pos: [-460, 155, 45],   look: [-305, 15, -140] },
  { t: 98,  pos: [-235, 185, -250], look: [-295, 15, -195] },
  { t: 106, pos: [325, 145, -305],  look: [462, 12, -178] },
  { t: 113, pos: [430, 115, -85],   look: [468, 10, -177] },
  { t: 121, pos: [-185, 135, -330], look: [-345, 15, -168] },
  { t: 134, pos: [-380, 330, 300],  look: [-380, 0, -220] },
  { t: 150, pos: [-120, 520, 480],  look: [-450, 0, -280] }
]

// ---------- 環境(空・光・海・雲)キーフレーム ----------

export interface EnvKey {
  t: number
  sky: [string, string]     // [天頂, 地平]
  sun: string
  sunIntensity: number
  ambient: number
  oceanDeep: string
  oceanShallow: string
  cloud: number             // 雲の濃さ 0-1
  fogNear: number
  fogFar: number
}

export const ENV_KEYS: EnvKey[] = [
  { t: 0,   sky: ['#141c38', '#6a5a78'], sun: '#ff9a66', sunIntensity: 1.0, ambient: 0.62, oceanDeep: '#101f36', oceanShallow: '#1e3a58', cloud: 0.7, fogNear: 500, fogFar: 2400 },
  { t: 15,  sky: ['#2a4470', '#d89a78'], sun: '#ffb87a', sunIntensity: 1.4, ambient: 0.66, oceanDeep: '#14284a', oceanShallow: '#245078', cloud: 0.75, fogNear: 600, fogFar: 2800 },
  { t: 40,  sky: ['#3d6cb0', '#c8d8e4'], sun: '#fff0d8', sunIntensity: 1.9, ambient: 0.72, oceanDeep: '#164070', oceanShallow: '#2874a8', cloud: 0.8, fogNear: 800, fogFar: 3400 },
  { t: 70,  sky: ['#3a72c4', '#d4e4f0'], sun: '#ffffff', sunIntensity: 2.1, ambient: 0.76, oceanDeep: '#1a4478', oceanShallow: '#2a7cb4', cloud: 0.75, fogNear: 900, fogFar: 3600 },
  { t: 100, sky: ['#3f6cb2', '#dcd8c4'], sun: '#fff4dc', sunIntensity: 1.9, ambient: 0.72, oceanDeep: '#183e6e', oceanShallow: '#2872a4', cloud: 0.75, fogNear: 850, fogFar: 3400 },
  { t: 125, sky: ['#4c5490', '#eeb078'], sun: '#ffb060', sunIntensity: 1.6, ambient: 0.64, oceanDeep: '#142e52', oceanShallow: '#345078', cloud: 0.8, fogNear: 700, fogFar: 3000 },
  { t: 150, sky: ['#2c2a54', '#e08858'], sun: '#ff8850', sunIntensity: 1.4, ambient: 0.68, oceanDeep: '#1a2846', oceanShallow: '#46406a', cloud: 0.8, fogNear: 600, fogFar: 2600 }
]

// ---------- 汎用ヘルパ ----------

export function easeInOut(t: number): number {
  return t * t * (3 - 2 * t)
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export function findSpan<T extends { t: number }>(keys: T[], t: number): { a: T; b: T; f: number; i: number } {
  if (t <= keys[0]!.t) return { a: keys[0]!, b: keys[0]!, f: 0, i: 0 }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!
    const b = keys[i + 1]!
    if (t >= a.t && t <= b.t) {
      return { a, b, f: b.t === a.t ? 0 : (t - a.t) / (b.t - a.t), i }
    }
  }
  const last = keys[keys.length - 1]!
  return { a: last, b: last, f: 0, i: keys.length - 1 }
}
