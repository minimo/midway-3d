<template>
  <div ref="container" class="scene-root" />
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  ARROWS, ATOLL, BOOMS, CAMERA_KEYS, DAMAGES, ENV_KEYS, FLEETS, SIDE_COLORS, SQUADRONS,
  clamp01, easeInOut, findSpan,
  type Arrow, type Boom, type Fleet, type ShipDef, type Side, type Squadron
} from '~/utils/navalData'
import { useTimeline } from '~/composables/useTimeline'

const container = ref<HTMLElement | null>(null)
const tl = useTimeline()

let renderer: THREE.WebGLRenderer | null = null
let rafId = 0
let cleanup: (() => void) | null = null

onBeforeUnmount(() => cleanup?.())

const _camWorld = new THREE.Vector3()

onMounted(() => {
  const el = container.value!
  const scene = new THREE.Scene()

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(el.clientWidth, el.clientHeight)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  el.appendChild(renderer.domElement)

  const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 1, 9000)

  // ---------- ライティング ----------
  const hemi = new THREE.HemisphereLight(0xcfd8e8, 0x1a2a3a, 0.6)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff3dd, 1.5)
  scene.add(sun)

  // ---------- 空 ----------
  const skyUniforms = {
    uTop: { value: new THREE.Color('#141c38') },
    uBottom: { value: new THREE.Color('#6a5a78') }
  }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4600, 24, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uBottom;
        varying vec3 vDir;
        void main() {
          float f = pow(max(vDir.y, 0.0), 0.5);
          gl_FragColor = vec4(mix(uBottom, uTop, f), 1.0);
        }`
    })
  )
  scene.add(sky)

  // ---------- 海 ----------
  const oceanUniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#0a1526') },
    uShallow: { value: new THREE.Color('#16304a') },
    uLagoon: { value: new THREE.Color('#2a9a96') },
    uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.2).normalize() },
    uSunColor: { value: new THREE.Color('#ff9a66') },
    uAmbient: { value: 0.5 },
    uAtoll: { value: new THREE.Vector2(ATOLL.x, ATOLL.z) },
    uFogColor: { value: new THREE.Color('#6a5a78') },
    uFogNear: { value: 500 },
    uFogFar: { value: 2400 }
  }
  const oceanGeo = new THREE.PlaneGeometry(3200, 2600, 190, 150)
  oceanGeo.rotateX(-Math.PI / 2)
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.ShaderMaterial({
      uniforms: oceanUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vH;
        float waveH(vec2 p) {
          return sin(p.x * 0.020 + uTime * 0.9) * 1.05
               + sin((p.x * 0.35 + p.y * 0.94) * 0.031 + uTime * 1.25) * 0.75
               + sin((p.x * -0.71 + p.y * 0.70) * 0.052 + uTime * 1.7) * 0.5;
        }
        void main() {
          vec3 pos = position;
          float h = waveH(pos.xz);
          pos.y += h;
          float e = 4.0;
          float hx = waveH(pos.xz + vec2(e, 0.0)) - waveH(pos.xz - vec2(e, 0.0));
          float hz = waveH(pos.xz + vec2(0.0, e)) - waveH(pos.xz - vec2(0.0, e));
          vNormal = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
          vH = h;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uLagoon;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uAmbient;
        uniform vec2 uAtoll;
        uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vH;
        void main() {
          vec3 N = normalize(vNormal);
          float diff = max(dot(N, uSunDir), 0.0);
          vec3 base = mix(uDeep, uShallow, clamp(vH * 0.22 + 0.5, 0.0, 1.0));
          float dA = distance(vWorld.xz, uAtoll);
          base = mix(uLagoon * (uAmbient + 0.4), base, smoothstep(44.0, 72.0, dA));
          vec3 col = base * (uAmbient + diff * 0.85);
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 R = reflect(-uSunDir, N);
          col += uSunColor * pow(max(dot(R, V), 0.0), 90.0) * 1.1;
          float fd = distance(cameraPosition, vWorld);
          col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, fd));
          gl_FragColor = vec4(col, 1.0);
        }`
    })
  )
  scene.add(ocean)

  // ---------- ミッドウェー環礁 ----------
  buildAtoll(scene)

  // ---------- 艦隊 ----------
  const shipIndex = new Map<string, ShipRuntime>()
  const fleetRuntime = FLEETS.map(f => buildFleet(scene, f, shipIndex))

  // 被弾艦の煙・火災
  const damageRuntime = DAMAGES.map(d => buildDamage(scene, d, shipIndex))

  // ---------- 飛行隊 ----------
  const squadronRuntime = SQUADRONS.map(s => buildSquadron(scene, s))

  // ---------- 矢印 ----------
  const arrowRuntime = ARROWS.map(a => buildArrow(scene, a))

  // ---------- 爆発・水柱 ----------
  const boomRuntime = BOOMS.map(b => buildBoom(scene, b))

  // ---------- 雲 ----------
  const clouds = buildClouds(scene)

  // ---------- ループ ----------
  const clock = new THREE.Clock()
  let elapsed = 0
  const camPos = new THREE.Vector3()
  const camLook = new THREE.Vector3()
  const colA = new THREE.Color()
  const colB = new THREE.Color()
  let envCloud = 0.8

  function updateEnv(t: number) {
    const { a, b, f } = findSpan(ENV_KEYS, t)
    const e = easeInOut(f)
    skyUniforms.uTop.value.lerpColors(colA.set(a.sky[0]), colB.set(b.sky[0]), e)
    skyUniforms.uBottom.value.lerpColors(colA.set(a.sky[1]), colB.set(b.sky[1]), e)
    sun.color.lerpColors(colA.set(a.sun), colB.set(b.sun), e)
    sun.intensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * e
    hemi.intensity = a.ambient + (b.ambient - a.ambient) * e
    envCloud = a.cloud + (b.cloud - a.cloud) * e

    // 太陽: 東の水平線から昇り、西へ沈む
    const dayF = t / tl.duration
    sun.position.set(1000 - 2000 * dayF, 120 + 700 * Math.sin(Math.PI * dayF), 300)

    oceanUniforms.uDeep.value.lerpColors(colA.set(a.oceanDeep), colB.set(b.oceanDeep), e)
    oceanUniforms.uShallow.value.lerpColors(colA.set(a.oceanShallow), colB.set(b.oceanShallow), e)
    oceanUniforms.uSunColor.value.copy(sun.color)
    oceanUniforms.uSunDir.value.copy(sun.position).normalize()
    oceanUniforms.uAmbient.value = hemi.intensity
    oceanUniforms.uFogColor.value.copy(skyUniforms.uBottom.value)
    oceanUniforms.uFogNear.value = a.fogNear + (b.fogNear - a.fogNear) * e
    oceanUniforms.uFogFar.value = a.fogFar + (b.fogFar - a.fogFar) * e
    oceanUniforms.uTime.value = elapsed
  }

  function crSpline(p0: number, p1: number, p2: number, p3: number, u: number): number {
    const u2 = u * u
    const u3 = u2 * u
    return 0.5 * (2 * p1 + (-p0 + p2) * u
      + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2
      + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)
  }

  function sampleCam(t: number, field: 'pos' | 'look', out: THREE.Vector3) {
    const keys = CAMERA_KEYS
    let i = 0
    while (i < keys.length - 2 && t > keys[i + 1]!.t) i++
    const k0 = keys[Math.max(0, i - 1)]![field]
    const k1 = keys[i]![field]
    const k2 = keys[Math.min(keys.length - 1, i + 1)]![field]
    const k3 = keys[Math.min(keys.length - 1, i + 2)]![field]
    const span = keys[Math.min(keys.length - 1, i + 1)]!.t - keys[i]!.t
    const u = span > 0 ? clamp01((t - keys[i]!.t) / span) : 0
    out.set(
      crSpline(k0[0], k1[0], k2[0], k3[0], u),
      crSpline(k0[1], k1[1], k2[1], k3[1], u),
      crSpline(k0[2], k1[2], k2[2], k3[2], u)
    )
  }

  function updateCamera(t: number) {
    sampleCam(t, 'pos', camPos)
    sampleCam(t, 'look', camLook)
    camPos.x += Math.sin(elapsed * 0.3) * 3.5
    camPos.y += Math.sin(elapsed * 0.22 + 2) * 2
    camPos.z += Math.cos(elapsed * 0.26 + 1) * 3.5
    if (camPos.y < 18) camPos.y = 18
    camera.position.copy(camPos)
    camera.lookAt(camLook)
    _camWorld.copy(camera.position)
  }

  function updateClouds(delta: number) {
    for (const c of clouds) {
      c.sprite.position.x += c.vx * delta
      c.sprite.position.z += c.vz * delta
      if (c.sprite.position.x > 1100) c.sprite.position.x = -1300
      if (c.sprite.position.z > 900) c.sprite.position.z = -800
      const mat = c.sprite.material as THREE.SpriteMaterial
      mat.opacity = c.base * envCloud
      mat.color.copy(skyUniforms.uBottom.value).lerp(colA.set('#ffffff'), 0.6)
    }
  }

  function frame() {
    rafId = requestAnimationFrame(frame)
    const delta = Math.min(clock.getDelta(), 0.1)
    elapsed += delta
    if (tl.playing) tl.time = (tl.time + delta * tl.speed) % tl.duration
    const t = tl.time

    updateEnv(t)
    updateCamera(t)
    for (const fr of fleetRuntime) updateFleet(fr, t, delta, elapsed)
    for (const dr of damageRuntime) updateDamage(dr, t, elapsed, shipIndex)
    for (const sr of squadronRuntime) updateSquadron(sr, t, elapsed)
    for (const ar of arrowRuntime) updateArrow(ar, t, elapsed)
    for (const br of boomRuntime) updateBoom(br, t, shipIndex)
    updateClouds(delta)

    renderer!.render(scene, camera)
    if (!tl.ready) tl.ready = true
  }

  function onResize() {
    if (!renderer || !container.value) return
    const w = container.value.clientWidth
    const h = container.value.clientHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)

  cleanup = () => {
    cancelAnimationFrame(rafId)
    window.removeEventListener('resize', onResize)
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const mat = (mesh as any).material
      if (mat) {
        for (const m of Array.isArray(mat) ? mat : [mat]) {
          if (m.map) m.map.dispose()
          m.dispose()
        }
      }
    })
    renderer?.dispose()
    renderer = null
  }

  frame()
})

// ============================================================
// ミッドウェー環礁
// ============================================================

function buildAtoll(scene: THREE.Scene) {
  const g = new THREE.Group()
  g.position.set(ATOLL.x, 0, ATOLL.z)

  // 環礁のリーフ(白波の輪)
  const reef = new THREE.Mesh(
    new THREE.RingGeometry(ATOLL.reefR - 7, ATOLL.reefR, 48),
    new THREE.MeshBasicMaterial({ color: 0xe8f2ee, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  )
  reef.rotation.x = -Math.PI / 2
  reef.position.y = 2.2
  g.add(reef)

  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd8cba0, roughness: 1 })
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x6a7c4a, roughness: 1 })
  const runwayMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.9 })

  // サンド島
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(15, 17, 3, 20), sandMat)
  sand.position.set(-17, 2.5, 6)
  g.add(sand)
  const sandBush = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 1.6, 16), bushMat)
  sandBush.position.set(-19, 4.2, 6)
  g.add(sandBush)

  // イースタン島(滑走路)
  const eastern = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 3, 18), sandMat)
  eastern.position.set(16, 2.5, 14)
  g.add(eastern)
  const rw1 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 3), runwayMat)
  rw1.position.set(16, 4.2, 13)
  rw1.rotation.y = 0.5
  g.add(rw1)
  const rw2 = new THREE.Mesh(new THREE.BoxGeometry(17, 0.5, 3), runwayMat)
  rw2.position.set(15, 4.2, 16)
  rw2.rotation.y = -0.7
  g.add(rw2)

  scene.add(g)

  // 基地ラベル
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeLabelTexture('ミッドウェー基地', '米軍前哨・滑走路2本', SIDE_COLORS.us),
    transparent: true, depthTest: false
  }))
  label.position.set(ATOLL.x, 46, ATOLL.z)
  label.scale.set(92, 20, 1)
  label.renderOrder = 10
  scene.add(label)
  atollLabel = label
}

let atollLabel: THREE.Sprite | null = null

// ============================================================
// 艦隊・艦船
// ============================================================

interface ShipRuntime {
  def: ShipDef
  group: THREE.Group
  label?: THREE.Sprite
  worldPos: THREE.Vector3
  bobPhase: number
  listAngle: number
}

interface FleetRuntime {
  def: Fleet
  ships: ShipRuntime[]
  heading: number
}

// 共有マテリアル
const hullMatJP = new THREE.MeshStandardMaterial({ color: 0x757b84, roughness: 0.75 })
const hullMatUS = new THREE.MeshStandardMaterial({ color: 0x6b7a96, roughness: 0.75 })
const deckMatJP = new THREE.MeshStandardMaterial({ color: 0xb0a068, roughness: 0.9 })
const deckMatUS = new THREE.MeshStandardMaterial({ color: 0x5b6880, roughness: 0.9 })
const superMat = new THREE.MeshStandardMaterial({ color: 0x8b9199, roughness: 0.8 })
const hinomaruMat = new THREE.MeshBasicMaterial({ color: 0xd6413a })

function buildShipModel(type: ShipDef['type'], side: Side): THREE.Group {
  const g = new THREE.Group()
  const hullMat = side === 'jp' ? hullMatJP : hullMatUS

  if (type === 'cv') {
    // 船体 + 全通飛行甲板 + 艦橋
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.4, 24), hullMat)
    hull.position.y = 1.0
    g.add(hull)
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.5, 27),
      side === 'jp' ? deckMatJP : deckMatUS
    )
    deck.position.y = 2.4
    g.add(deck)
    if (side === 'jp') {
      const maru = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.12, 16), hinomaruMat)
      maru.position.set(0, 2.72, 10)
      g.add(maru)
    }
    const island = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 4), superMat)
    island.position.set(side === 'jp' ? -3.4 : 3.4, 3.6, -2)
    g.add(island)
  } else if (type === 'bb') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 22), hullMat)
    hull.position.y = 1.1
    g.add(hull)
    const sup1 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 7), superMat)
    sup1.position.y = 3.4
    g.add(sup1)
    const pagoda = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 1.8), superMat)
    pagoda.position.set(0, 5.6, 1.5)
    g.add(pagoda)
    for (const tz of [8.2, -8.2, -10.8]) {
      const turret = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 3), hullMat)
      turret.position.set(0, 2.8, tz)
      g.add(turret)
    }
  } else if (type === 'ca') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 16.5), hullMat)
    hull.position.y = 0.9
    g.add(hull)
    const sup = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.9, 5.5), superMat)
    sup.position.y = 2.8
    g.add(sup)
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 11), hullMat)
    hull.position.y = 0.7
    g.add(hull)
    const sup = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 3), superMat)
    sup.position.y = 2.1
    g.add(sup)
  }

  // 航跡(細長い白帯)
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 16),
    new THREE.MeshBasicMaterial({ color: 0xcfe4e8, transparent: true, opacity: 0.28, depthWrite: false })
  )
  wake.rotation.x = -Math.PI / 2
  wake.position.set(0, 0.3, -(type === 'dd' ? 12 : 20))
  g.add(wake)

  return g
}

function buildFleet(scene: THREE.Scene, def: Fleet, index: Map<string, ShipRuntime>): FleetRuntime {
  const ships: ShipRuntime[] = def.ships.map(sd => {
    const group = buildShipModel(sd.type, def.side)
    scene.add(group)
    let label: THREE.Sprite | undefined
    if (sd.name) {
      const typeName = sd.type === 'cv' ? '空母' : sd.type === 'bb' ? '戦艦' : '重巡'
      label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeLabelTexture(sd.name, typeName, SIDE_COLORS[def.side]),
        transparent: true, depthTest: false
      }))
      label.renderOrder = 10
      scene.add(label)
    }
    const rt: ShipRuntime = {
      def: sd, group, label,
      worldPos: new THREE.Vector3(),
      bobPhase: Math.random() * Math.PI * 2,
      listAngle: 0
    }
    if (sd.id) index.set(sd.id, rt)
    return rt
  })

  // 初期針路
  const k = def.keys
  const heading = Math.atan2(k[1]!.x - k[0]!.x, k[1]!.z - k[0]!.z)
  return { def, ships, heading }
}

function updateFleet(fr: FleetRuntime, t: number, delta: number, elapsed: number) {
  const { a, b, f } = findSpan(fr.def.keys, t)
  const e = easeInOut(f)
  const fx = a.x + (b.x - a.x) * e
  const fz = a.z + (b.z - a.z) * e

  // 針路をゆっくり旋回させる
  const dx = b.x - a.x
  const dz = b.z - a.z
  if (dx * dx + dz * dz > 1) {
    const target = Math.atan2(dx, dz)
    let diff = target - fr.heading
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    const maxTurn = 0.25 * delta
    fr.heading += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn)
  }

  const cos = Math.cos(fr.heading)
  const sin = Math.sin(fr.heading)
  for (const s of fr.ships) {
    const ox = s.def.dx
    const oz = s.def.dz
    const wx = fx + ox * cos + oz * sin
    const wz = fz - ox * sin + oz * cos
    s.worldPos.set(wx, 0, wz)
    s.group.position.set(wx, Math.sin(elapsed * 0.8 + s.bobPhase) * 0.35, wz)
    s.group.rotation.y = fr.heading
    // 波によるゆれ + 被雷時の傾斜
    s.group.rotation.z = Math.sin(elapsed * 0.7 + s.bobPhase) * 0.02 + s.listAngle
    s.group.rotation.x = Math.sin(elapsed * 0.6 + s.bobPhase + 1) * 0.015

    if (s.label) {
      s.label.position.set(wx, 30, wz)
      const dist = s.worldPos.distanceTo(_camWorld)
      const sc = THREE.MathUtils.clamp(dist / 700, 0.45, 1.8)
      s.label.scale.set(80 * sc, 17.5 * sc, 1)
    }
  }
}

// ============================================================
// 被弾・炎上(黒煙 + 火災光)
// ============================================================

interface DamageRuntime {
  shipId: string
  burnAt: number
  list: number
  smoke: THREE.Sprite[]
  fire: THREE.Sprite
}

let smokeTex: THREE.Texture | null = null
let glowTex: THREE.Texture | null = null

function buildDamage(scene: THREE.Scene, d: { ship: string; burnAt: number; list?: number }, _index: Map<string, ShipRuntime>): DamageRuntime {
  smokeTex ??= makeRadialTexture('rgba(40,38,36,0.9)', 'rgba(40,38,36,0)')
  glowTex ??= makeRadialTexture('rgba(255,170,70,1)', 'rgba(255,90,30,0)')

  const smoke: THREE.Sprite[] = []
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: smokeTex, transparent: true, depthWrite: false, opacity: 0
    }))
    s.renderOrder = 8
    scene.add(s)
    smoke.push(s)
  }
  const fire = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0
  }))
  fire.renderOrder = 7
  scene.add(fire)

  return { shipId: d.ship, burnAt: d.burnAt, list: d.list ?? 0, smoke, fire }
}

function updateDamage(dr: DamageRuntime, t: number, elapsed: number, index: Map<string, ShipRuntime>) {
  const ship = index.get(dr.shipId)
  if (!ship) return
  const act = clamp01((t - dr.burnAt) / 4)
  ship.listAngle = dr.list * clamp01((t - dr.burnAt) / 25)

  const H = 130
  for (let i = 0; i < dr.smoke.length; i++) {
    const s = dr.smoke[i]!
    const mat = s.material as THREE.SpriteMaterial
    if (act <= 0) { mat.opacity = 0; continue }
    const h = (elapsed * 20 + i * 16.3) % H
    const fh = h / H
    s.position.set(
      ship.worldPos.x + fh * 42 + Math.sin(elapsed * 0.9 + i) * 4,
      4 + h,
      ship.worldPos.z + fh * 20 + Math.cos(elapsed * 0.8 + i * 2) * 4
    )
    const sc = 15 + h * 0.55
    s.scale.set(sc, sc, 1)
    mat.opacity = act * 0.5 * (1 - fh)
  }

  const fmat = dr.fire.material as THREE.SpriteMaterial
  if (act > 0) {
    dr.fire.position.set(ship.worldPos.x, 6, ship.worldPos.z)
    const flick = 0.7 + 0.3 * Math.sin(elapsed * 11 + dr.burnAt) * Math.sin(elapsed * 4.7)
    fmat.opacity = act * 0.85 * flick
    const sc = 26 * (0.9 + 0.2 * flick)
    dr.fire.scale.set(sc, sc * 0.8, 1)
  } else {
    fmat.opacity = 0
  }
}

// ============================================================
// 飛行隊(インスタンス編隊)
// ============================================================

interface SquadronRuntime {
  def: Squadron
  mesh: THREE.InstancedMesh
  material: THREE.MeshStandardMaterial
  label: THREE.Sprite
  offsets: { ox: number; oz: number; oy: number; ph: number }[]
  dummy: THREE.Matrix4
}

let planeGeo: THREE.BufferGeometry | null = null

function getPlaneGeometry(): THREE.BufferGeometry {
  if (planeGeo) return planeGeo
  // 紙飛行機型のダート(機首 +z)
  const v = [
    // 主翼(左)
    0, 0, 3.4, -3.1, 0, -0.6, 0, 0, -1.6,
    // 主翼(右)
    0, 0, 3.4, 0, 0, -1.6, 3.1, 0, -0.6,
    // 垂直尾翼
    0, 0, -0.4, 0, 1.15, -2.2, 0, 0, -2.4
  ]
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  geo.computeVertexNormals()
  planeGeo = geo
  return geo
}

function buildSquadron(scene: THREE.Scene, def: Squadron): SquadronRuntime {
  const material = new THREE.MeshStandardMaterial({
    color: SIDE_COLORS[def.side],
    roughness: 0.6,
    side: THREE.DoubleSide,
    transparent: true
  })
  const mesh = new THREE.InstancedMesh(getPlaneGeometry(), material, def.count)
  mesh.frustumCulled = false
  scene.add(mesh)

  // V字編隊オフセット
  const offsets = []
  for (let i = 0; i < def.count; i++) {
    const row = Math.ceil(i / 2)
    const side = i === 0 ? 0 : (i % 2 === 1 ? -1 : 1)
    offsets.push({
      ox: side * row * 5.2 + (Math.random() - 0.5) * 1.5,
      oz: -row * 6 + (Math.random() - 0.5) * 1.5,
      oy: (Math.random() - 0.5) * 2,
      ph: Math.random() * Math.PI * 2
    })
  }

  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeLabelTexture(def.name, def.side === 'jp' ? '日本海軍' : '米海軍', SIDE_COLORS[def.side]),
    transparent: true, depthTest: false
  }))
  label.renderOrder = 10
  scene.add(label)

  return { def, mesh, material, label, offsets, dummy: new THREE.Matrix4() }
}

const _sqPos = new THREE.Vector3()
const _sqAhead = new THREE.Vector3()
const _sqQ = new THREE.Quaternion()
const _sqE = new THREE.Euler()
const _sqS = new THREE.Vector3(1, 1, 1)
const _sqP = new THREE.Vector3()

function squadronPosAt(def: Squadron, t: number, elapsed: number, out: THREE.Vector3) {
  if (def.orbit) {
    const o = def.orbit
    const ang = elapsed * o.speed
    out.set(o.x + Math.cos(ang) * o.r, o.alt, o.z + Math.sin(ang) * o.r)
    return
  }
  const { a, b, f } = findSpan(def.keys!, t)
  const e = easeInOut(f)
  out.set(
    a.x + (b.x - a.x) * e,
    a.alt + (b.alt - a.alt) * e,
    a.z + (b.z - a.z) * e
  )
}

function updateSquadron(sr: SquadronRuntime, t: number, elapsed: number) {
  const d = sr.def
  const [w0, w1] = d.window
  const opacity = clamp01((t - w0) / 1.5) * (1 - clamp01((t - (w1 - 1.5)) / 1.5))
  sr.material.opacity = opacity * 0.95
  const visible = opacity > 0.02
  sr.mesh.visible = visible
  sr.label.visible = visible && opacity > 0.4
  if (!visible) return

  squadronPosAt(d, t, elapsed, _sqPos)
  squadronPosAt(d, t + 0.4, elapsed + 0.4, _sqAhead)
  const dirX = _sqAhead.x - _sqPos.x
  const dirZ = _sqAhead.z - _sqPos.z
  const heading = (dirX * dirX + dirZ * dirZ > 0.0001) ? Math.atan2(dirX, dirZ) : 0
  const pitch = Math.atan2(-(_sqAhead.y - _sqPos.y), Math.hypot(dirX, dirZ) + 0.001) * 0.7

  // 損耗: 後方の機体から順に消える
  let survivors = d.count
  if (d.loss) {
    const lf = clamp01((t - d.loss.t0) / (d.loss.t1 - d.loss.t0)) * d.loss.frac
    survivors = Math.round(d.count * (1 - lf))
  }

  const cos = Math.cos(heading)
  const sin = Math.sin(heading)
  for (let i = 0; i < d.count; i++) {
    const o = sr.offsets[i]!
    if (i >= survivors) {
      _sqS.set(0, 0, 0)
    } else {
      _sqS.set(1, 1, 1)
    }
    const wx = _sqPos.x + o.ox * cos + o.oz * sin
    const wz = _sqPos.z - o.ox * sin + o.oz * cos
    const wy = Math.max(3, _sqPos.y + o.oy + Math.sin(elapsed * 2.1 + o.ph) * 0.8)
    _sqP.set(wx, wy, wz)
    _sqQ.setFromEuler(_sqE.set(pitch, heading, Math.sin(elapsed * 1.3 + o.ph) * 0.08))
    sr.dummy.compose(_sqP, _sqQ, _sqS)
    sr.mesh.setMatrixAt(i, sr.dummy)
  }
  sr.mesh.instanceMatrix.needsUpdate = true

  sr.label.position.set(_sqPos.x, _sqPos.y + 26, _sqPos.z)
  const dist = _sqPos.distanceTo(_camWorld)
  const sc = THREE.MathUtils.clamp(dist / 700, 0.45, 1.4)
  sr.label.scale.set(84 * sc, 18 * sc, 1)
  sr.label.material.opacity = opacity
}

// ============================================================
// 進軍・攻撃矢印
// ============================================================

interface ArrowRuntime {
  data: Arrow
  tube: THREE.Mesh
  head: THREE.Mesh
  curve: THREE.CatmullRomCurve3
  uniforms: { uProgress: { value: number }; uOpacity: { value: number }; uTime: { value: number } }
  headMat: THREE.MeshBasicMaterial
}

function buildArrow(scene: THREE.Scene, data: Arrow): ArrowRuntime {
  const alt = data.alt ?? 10
  const pts = data.points.map(([x, z]) => new THREE.Vector3(x, alt, z))
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
  const radius = data.width ?? 4.2
  const tubeGeo = new THREE.TubeGeometry(curve, 60, radius, 8, false)

  const color = new THREE.Color(SIDE_COLORS[data.side])
  const uniforms = {
    uProgress: { value: 0 },
    uOpacity: { value: 0 },
    uTime: { value: 0 },
    uColor: { value: color }
  }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uProgress; uniform float uOpacity; uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        if (vUv.x > uProgress) discard;
        float stripe = smoothstep(0.35, 0.65, fract(vUv.x * 12.0 - uTime * 1.1));
        vec3 col = mix(uColor * 0.85, uColor * 1.45, stripe);
        float tail = smoothstep(0.0, 0.12, vUv.x);
        gl_FragColor = vec4(col, uOpacity * tail * (0.72 + 0.22 * stripe));
      }`
  })
  const tube = new THREE.Mesh(tubeGeo, mat)
  tube.frustumCulled = false
  tube.renderOrder = 5
  scene.add(tube)

  const headMat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false })
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.6, radius * 3.4, 12), headMat)
  head.renderOrder = 6
  scene.add(head)

  return { data, tube, head, curve, uniforms: uniforms as any, headMat }
}

const _tangent = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _headQ = new THREE.Quaternion()

function updateArrow(ar: ArrowRuntime, t: number, elapsed: number) {
  const d = ar.data
  const grow = easeInOut(clamp01((t - d.t0) / (d.t1 - d.t0)))
  const fadeStart = d.t1 + d.hold
  const opacity = t < d.t0 ? 0 : (1 - clamp01((t - fadeStart) / 4)) * 0.95

  ar.uniforms.uProgress.value = grow
  ar.uniforms.uOpacity.value = opacity
  ar.uniforms.uTime.value = elapsed

  const show = grow > 0.02 && opacity > 0.01
  ar.tube.visible = show
  ar.head.visible = show
  if (!show) return

  const p = Math.min(grow, 0.999)
  ar.curve.getPointAt(p, ar.head.position)
  ar.curve.getTangentAt(p, _tangent)
  _headQ.setFromUnitVectors(_up, _tangent.normalize())
  ar.head.quaternion.copy(_headQ)
  ar.headMat.opacity = opacity
  ar.head.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.08)
}

// ============================================================
// 爆発・水柱
// ============================================================

interface BoomRuntime {
  data: Boom
  flash: THREE.Sprite
  ball: THREE.Sprite
  puff: THREE.Sprite
}

let flashTex: THREE.Texture | null = null
let splashTex: THREE.Texture | null = null
let puffTex: THREE.Texture | null = null

function buildBoom(scene: THREE.Scene, data: Boom): BoomRuntime {
  flashTex ??= makeRadialTexture('rgba(255,235,180,1)', 'rgba(255,150,50,0)')
  splashTex ??= makeRadialTexture('rgba(230,242,246,0.95)', 'rgba(230,242,246,0)')
  puffTex ??= makeRadialTexture('rgba(90,86,80,0.85)', 'rgba(90,86,80,0)')

  const isSplash = data.type === 'splash'
  const mk = (tex: THREE.Texture, additive: boolean) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, opacity: 0,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    }))
    s.renderOrder = 9
    scene.add(s)
    return s
  }
  return {
    data,
    flash: mk(isSplash ? splashTex : flashTex, !isSplash),
    ball: mk(isSplash ? splashTex : flashTex, !isSplash),
    puff: mk(isSplash ? splashTex : puffTex, false)
  }
}

function updateBoom(br: BoomRuntime, t: number, index: Map<string, ShipRuntime>) {
  const d = br.data
  const lt = t - d.t
  const fm = br.flash.material as THREE.SpriteMaterial
  const bm = br.ball.material as THREE.SpriteMaterial
  const pm = br.puff.material as THREE.SpriteMaterial

  if (lt < 0 || lt > 5) {
    fm.opacity = bm.opacity = pm.opacity = 0
    return
  }

  let x = d.x ?? 0
  let z = d.z ?? 0
  if (d.ship) {
    const ship = index.get(d.ship)
    if (ship) { x = ship.worldPos.x; z = ship.worldPos.z }
  }
  const s = d.size

  if (d.type === 'boom') {
    // 閃光 → 火球 → 黒煙
    if (lt < 0.35) {
      fm.opacity = 1 - lt / 0.35
      const sc = s * (1 + lt * 7)
      br.flash.scale.set(sc, sc, 1)
      br.flash.position.set(x, 8, z)
    } else fm.opacity = 0

    if (lt < 1.4) {
      bm.opacity = 0.9 * (1 - lt / 1.4)
      const sc = s * (0.6 + lt * 1.9)
      br.ball.scale.set(sc, sc * 1.15, 1)
      br.ball.position.set(x, 8 + lt * 9, z)
    } else bm.opacity = 0

    if (lt > 0.3) {
      const pl = (lt - 0.3) / 4.4
      pm.opacity = 0.55 * (1 - pl)
      const sc = s * (0.8 + pl * 3.2)
      br.puff.scale.set(sc, sc, 1)
      br.puff.position.set(x + pl * 12, 10 + pl * 55, z + pl * 6)
    } else pm.opacity = 0
  } else {
    // 水柱: 立ち上がって崩れる
    const rise = Math.sin(Math.min(lt / 1.4, 1) * Math.PI)
    if (lt < 1.9) {
      fm.opacity = 0.85 * (1 - lt / 1.9)
      br.flash.scale.set(s * (0.5 + lt * 0.6), s * (0.8 + rise * 3.2), 1)
      br.flash.position.set(x, (s * (0.8 + rise * 3.2)) * 0.4, z)
    } else fm.opacity = 0
    if (lt > 0.4 && lt < 3.2) {
      const pl = (lt - 0.4) / 2.8
      pm.opacity = 0.4 * (1 - pl)
      const sc = s * (1 + pl * 2)
      br.puff.scale.set(sc, sc * 0.5, 1)
      br.puff.position.set(x, 3 + pl * 6, z)
    } else pm.opacity = 0
    bm.opacity = 0
  }
}

// ============================================================
// 雲
// ============================================================

interface Cloud { sprite: THREE.Sprite; vx: number; vz: number; base: number }

function buildClouds(scene: THREE.Scene): Cloud[] {
  const tex = makeRadialTexture('rgba(248,250,252,0.9)', 'rgba(248,250,252,0)')
  const list: Cloud[] = []
  const spots: [number, number, number][] = []
  // 全域に散在
  for (let i = 0; i < 26; i++) {
    spots.push([-1200 + Math.random() * 2300, -750 + Math.random() * 1550, 0.2 + Math.random() * 0.2])
  }
  // 米艦隊上空は厚め(史実: 雲が空母を隠した)
  for (let i = 0; i < 9; i++) {
    spots.push([250 + Math.random() * 400, -420 + Math.random() * 320, 0.32 + Math.random() * 0.22])
  }
  for (const [x, z, base] of spots) {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.4 })
    const s = new THREE.Sprite(mat)
    s.position.set(x, 210 + Math.random() * 120, z)
    const size = 150 + Math.random() * 180
    s.scale.set(size, size * 0.34, 1)
    s.renderOrder = 4
    scene.add(s)
    list.push({ sprite: s, vx: 6 + Math.random() * 6, vz: 2 + Math.random() * 3, base })
  }
  return list
}

// ============================================================
// テクスチャ生成
// ============================================================

function makeRadialTexture(inner: string, outer: string): THREE.Texture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeLabelTexture(name: string, sub: string, color: number): THREE.Texture {
  const cv = document.createElement('canvas')
  cv.width = 640
  cv.height = 140
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = 'rgba(8,10,16,0.72)'
  roundRect(ctx, 6, 10, 628, 120, 14)
  ctx.fill()
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`
  roundRect(ctx, 6, 10, 16, 120, 6)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 52px "Hiragino Sans", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 44, 54, 570)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '38px "Hiragino Sans", sans-serif'
  ctx.fillText(sub, 44, 104, 570)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
</script>

<style scoped>
.scene-root {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.scene-root :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
