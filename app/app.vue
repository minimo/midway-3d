<template>
  <div class="tv">
    <NavalScene />

    <!-- オープニング暗転 -->
    <transition name="fade-slow">
      <div v-if="!tl.ready || showTitleCard" class="title-card">
        <div class="title-card__inner">
          <p class="title-card__date">昭和十七年六月五日(現地時間 1942年6月4日)</p>
          <h1 class="title-card__title">激突<span>ミッドウェー</span></h1>
          <p class="title-card__sub">運命の五分間 ― 太平洋の転換点</p>
        </div>
      </div>
    </transition>

    <!-- 番組ロゴ(左上) -->
    <header class="logo">
      <div class="logo__mark">激突<span>ミッドウェー</span></div>
      <div class="logo__date">昭和17年6月 太平洋中部</div>
    </header>

    <!-- 時刻・凡例(右上) -->
    <aside class="hud">
      <div class="hud__clock">
        <span class="hud__clock-label">現地時間</span>
        <span class="hud__clock-time">{{ clockText }}</span>
      </div>
      <div class="hud__legend">
        <span class="hud__legend-item"><i class="dot dot--jp" />日本海軍(南雲機動部隊)</span>
        <span class="hud__legend-item"><i class="dot dot--us" />米海軍(第16・17任務部隊)</span>
      </div>
    </aside>

    <!-- 速報テロップ(中央) -->
    <transition name="banner">
      <div v-if="activeEvent" :key="activeEvent.text" class="event" :style="{ '--accent': activeEvent.accent }">
        <div class="event__flash">速報</div>
        <div class="event__body">
          <div class="event__text">{{ activeEvent.text }}</div>
          <div class="event__sub">{{ activeEvent.sub }}</div>
        </div>
      </div>
    </transition>

    <!-- 章テロップ + ナレーション(下部) -->
    <footer class="caption">
      <transition name="caption-swap" mode="out-in">
        <div :key="phase.chapter" class="caption__head">
          <span class="caption__chapter">{{ phase.chapter }}</span>
          <span class="caption__title">{{ phase.title }}</span>
          <span class="caption__time">{{ phase.timeLabel }}</span>
        </div>
      </transition>
      <transition name="caption-swap" mode="out-in">
        <p :key="phase.narration" class="caption__narration">{{ phase.narration }}</p>
      </transition>

      <!-- コントロール -->
      <div class="controls">
        <button class="btn btn--main" @click="tl.playing = !tl.playing">
          {{ tl.playing ? '❚❚' : '▶' }}
        </button>
        <button class="btn" @click="restart">↺</button>
        <div class="scrub" @pointerdown="onScrub" @pointermove="onScrubMove" @pointerup="scrubbing = false">
          <div class="scrub__track">
            <div class="scrub__fill" :style="{ width: (tl.time / tl.duration * 100) + '%' }" />
            <div
              v-for="(p, i) in PHASES" :key="i"
              class="scrub__marker"
              :style="{ left: (p.start / tl.duration * 100) + '%' }"
            />
          </div>
        </div>
        <div class="chapters">
          <button
            v-for="(p, i) in PHASES" :key="i"
            class="chapter-btn"
            :class="{ active: phase === p }"
            :title="p.title"
            @click="jumpTo(p.start)"
          >{{ i === 0 ? '序' : i === PHASES.length - 1 ? '終' : ['一', '二', '三', '四'][i - 1] }}</button>
        </div>
        <button class="btn btn--speed" @click="cycleSpeed">×{{ tl.speed }}</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { EVENTS, PHASES } from '~/utils/navalData'
import { useTimeline } from '~/composables/useTimeline'

const tl = useTimeline()
const showTitleCard = ref(true)
const scrubbing = ref(false)

onMounted(() => {
  // デバッグ用: ?t=75 で75秒地点から開始、&paused で一時停止
  const params = new URLSearchParams(window.location.search)
  const t0 = Number.parseFloat(params.get('t') ?? '')
  if (!Number.isNaN(t0)) {
    tl.time = Math.min(Math.max(t0, 0), tl.duration)
    showTitleCard.value = false
  }
  if (params.has('paused')) tl.playing = false
  if (showTitleCard.value) setTimeout(() => { showTitleCard.value = false }, 3600)
})

const phase = computed(() =>
  PHASES.find(p => tl.time >= p.start && tl.time < p.end) ?? PHASES[PHASES.length - 1]!
)

const activeEvent = computed(() =>
  EVENTS.find(e => tl.time >= e.t0 && tl.time <= e.t1) ?? null
)

// 現地時間: 演出時間 → 1942年6月4日の時刻へマッピング
const clockText = computed(() => {
  const t = tl.time
  let hour: number
  if (t < 20) hour = 4.5 + (t / 20) * (6.33 - 4.5)             // 4:30 → 6:20
  else if (t < 45) hour = 6.33 + ((t - 20) / 25) * 3            // 6:20 → 9:20
  else if (t < 70) hour = 9.33 + ((t - 45) / 25)                // 9:20 → 10:20
  else if (t < 95) hour = 10.33 + ((t - 70) / 25) * 1.67        // 10:20 → 12:00
  else if (t < 120) hour = 12 + ((t - 95) / 25) * 5             // 12:00 → 17:00
  else hour = 17 + ((t - 120) / 30) * 2.25                      // 17:00 → 19:15
  const h = Math.floor(hour)
  const m = Math.floor((hour - h) * 6) * 10
  if (h === 12 && m === 0) return '正午頃'
  const ampm = h < 12 ? '午前' : '午後'
  const h12 = h < 12 ? h : h - 12
  return `${ampm}${h12 === 0 ? '0' : h12}時${m > 0 ? `${m}分` : ''}頃`
})

function restart() {
  tl.time = 0
  tl.playing = true
}

function jumpTo(t: number) {
  tl.time = t
  tl.playing = true
}

function cycleSpeed() {
  tl.speed = tl.speed === 1 ? 2 : tl.speed === 2 ? 0.5 : 1
}

function onScrub(e: PointerEvent) {
  scrubbing.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  applyScrub(e)
}

function onScrubMove(e: PointerEvent) {
  if (scrubbing.value) applyScrub(e)
}

function applyScrub(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  tl.time = f * tl.duration
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  height: 100%;
  background: #04070e;
  font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif;
  color: #eef2f6;
  overflow: hidden;
}

.tv { position: fixed; inset: 0; }

/* ---------- オープニング ---------- */
.title-card {
  position: absolute; inset: 0; z-index: 50;
  background: radial-gradient(ellipse at 50% 40%, #10203a 0%, #04070e 75%);
  display: flex; align-items: center; justify-content: center;
}
.title-card__inner { text-align: center; }
.title-card__date {
  font-size: 15px; letter-spacing: 0.4em; color: #8ca8c8; margin-bottom: 22px;
}
.title-card__title {
  font-family: 'Hiragino Mincho ProN', 'Yu Mincho', serif;
  font-size: clamp(40px, 8vw, 96px);
  font-weight: 700; letter-spacing: 0.1em; line-height: 1.15;
  color: #e8f0f6;
  text-shadow: 0 0 60px rgba(90, 150, 220, 0.4);
}
.title-card__title span {
  display: block; font-size: 1.28em;
  background: linear-gradient(180deg, #d8ecff 15%, #4e82c8 90%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.title-card__sub {
  margin-top: 26px; font-size: 16px; letter-spacing: 0.32em; color: #9ab0c8;
}
.fade-slow-leave-active { transition: opacity 1.8s ease; }
.fade-slow-leave-to { opacity: 0; }

/* ---------- ロゴ ---------- */
.logo {
  position: absolute; top: 22px; left: 26px; z-index: 20;
  padding: 10px 18px 8px;
  background: linear-gradient(135deg, rgba(8, 12, 22, 0.84), rgba(14, 26, 44, 0.72));
  border: 1px solid rgba(110, 160, 220, 0.45);
  border-radius: 4px;
}
.logo__mark {
  font-family: 'Hiragino Mincho ProN', serif;
  font-size: 21px; font-weight: 700; letter-spacing: 0.1em; color: #e4ecf4;
}
.logo__mark span { color: #78aade; font-size: 1.12em; margin-left: 4px; }
.logo__date { font-size: 11px; letter-spacing: 0.22em; color: #8ca0b8; margin-top: 3px; }

/* ---------- HUD ---------- */
.hud {
  position: absolute; top: 22px; right: 26px; z-index: 20;
  display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
}
.hud__clock {
  display: flex; align-items: baseline; gap: 10px;
  padding: 8px 16px;
  background: rgba(6, 10, 18, 0.78);
  border-left: 3px solid #78aade;
  border-radius: 3px;
}
.hud__clock-label { font-size: 11px; color: #8ca0b8; letter-spacing: 0.2em; }
.hud__clock-time {
  font-size: 20px; font-weight: 700; letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums; color: #e8f2fc;
}
.hud__legend {
  display: flex; gap: 14px; padding: 7px 14px;
  background: rgba(6, 10, 18, 0.7); border-radius: 3px; font-size: 12px;
}
.hud__legend-item { display: flex; align-items: center; gap: 6px; color: #d4dce6; }
.dot { width: 11px; height: 11px; border-radius: 2px; display: inline-block; }
.dot--jp { background: #d6413a; }
.dot--us { background: #4d7fd6; }

/* ---------- 速報 ---------- */
.event {
  position: absolute; top: 17%; left: 50%; transform: translateX(-50%);
  z-index: 30; display: flex; align-items: stretch;
  filter: drop-shadow(0 6px 30px rgba(0, 0, 0, 0.6));
}
.event__flash {
  display: flex; align-items: center; padding: 0 14px;
  background: var(--accent);
  color: #fff; font-weight: 800; font-size: 15px; letter-spacing: 0.3em;
  writing-mode: vertical-rl; text-orientation: upright;
  border-radius: 4px 0 0 4px;
  animation: flashPulse 0.9s ease-in-out infinite alternate;
}
.event__body {
  padding: 14px 30px 12px;
  background: linear-gradient(100deg, rgba(4, 8, 16, 0.92), rgba(4, 8, 16, 0.78));
  border-top: 2px solid var(--accent);
  border-radius: 0 4px 4px 0;
}
.event__text {
  font-family: 'Hiragino Mincho ProN', serif;
  font-size: clamp(26px, 4.4vw, 46px); font-weight: 800; letter-spacing: 0.1em;
  color: #fff; text-shadow: 0 0 24px color-mix(in srgb, var(--accent) 65%, transparent);
}
.event__sub { margin-top: 4px; font-size: 14px; color: #c4ccd8; letter-spacing: 0.1em; }
@keyframes flashPulse { from { opacity: 1; } to { opacity: 0.55; } }
.banner-enter-active { transition: all 0.45s cubic-bezier(0.2, 1.4, 0.4, 1); }
.banner-leave-active { transition: all 0.5s ease; }
.banner-enter-from { opacity: 0; transform: translateX(-50%) scale(1.25); }
.banner-leave-to { opacity: 0; transform: translateX(-50%) translateY(-14px); }

/* ---------- 章テロップ ---------- */
.caption {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 20;
  padding: 26px min(5vw, 60px) 18px;
  background: linear-gradient(180deg, transparent 0%, rgba(3, 6, 12, 0.72) 34%, rgba(3, 6, 12, 0.92) 100%);
}
.caption__head { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.caption__chapter {
  padding: 3px 14px; background: #14406e; color: #fff;
  font-size: 13px; font-weight: 700; letter-spacing: 0.3em; border-radius: 2px;
}
.caption__title {
  font-family: 'Hiragino Mincho ProN', serif;
  font-size: clamp(20px, 3vw, 32px); font-weight: 700; letter-spacing: 0.06em;
  color: #e8f2fc;
}
.caption__time { font-size: 13px; color: #78aade; letter-spacing: 0.15em; }
.caption__narration {
  margin-top: 10px; max-width: 980px;
  font-size: clamp(13px, 1.5vw, 16px); line-height: 1.9; color: #d4dce6;
  letter-spacing: 0.04em;
}
.caption-swap-enter-active { transition: all 0.6s ease 0.15s; }
.caption-swap-leave-active { transition: all 0.3s ease; }
.caption-swap-enter-from { opacity: 0; transform: translateY(10px); }
.caption-swap-leave-to { opacity: 0; }

/* ---------- コントロール ---------- */
.controls {
  margin-top: 16px; display: flex; align-items: center; gap: 12px;
}
.btn {
  min-width: 40px; height: 34px; padding: 0 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px; color: #eef2f6; font-size: 15px; cursor: pointer;
  transition: background 0.2s;
}
.btn:hover { background: rgba(255, 255, 255, 0.18); }
.btn--main { background: #14406e; border-color: #3a6ea8; min-width: 48px; }
.btn--main:hover { background: #1c548e; }
.btn--speed { font-variant-numeric: tabular-nums; min-width: 52px; }
.scrub { flex: 1; padding: 10px 0; cursor: pointer; touch-action: none; }
.scrub__track {
  position: relative; height: 5px; border-radius: 3px;
  background: rgba(255, 255, 255, 0.16);
}
.scrub__fill {
  position: absolute; top: 0; left: 0; bottom: 0;
  background: linear-gradient(90deg, #78aade, #e8433a);
  border-radius: 3px;
}
.scrub__marker {
  position: absolute; top: -3px; width: 2px; height: 11px;
  background: rgba(255, 255, 255, 0.5);
}
.chapters { display: flex; gap: 5px; }
.chapter-btn {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #c4ccd8; font-size: 13px; cursor: pointer; transition: all 0.2s;
}
.chapter-btn:hover { background: rgba(255, 255, 255, 0.18); }
.chapter-btn.active {
  background: #78aade; border-color: #78aade; color: #0a1420; font-weight: 700;
}

@media (max-width: 720px) {
  .hud__legend { display: none; }
  .chapters { display: none; }
  .caption__narration { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
}
</style>
