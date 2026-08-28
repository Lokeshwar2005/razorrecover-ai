import * as THREE from 'three'

const stageColors = [0x8fe7ba, 0xe4a83f, 0xf0c46b, 0x8fe7ba, 0xdff7e9]

function mountScene(host: HTMLElement) {
  if (host.dataset.threeMounted === 'true') return
  host.dataset.threeMounted = 'true'
  host.classList.add('threeD-active')
  host.style.position = 'relative'

  host.querySelectorAll<HTMLElement>('.orb,.ring,.orbitDot').forEach((element) => {
    element.style.visibility = 'hidden'
  })

  const canvas = document.createElement('canvas')
  canvas.className = 'recovery-three-canvas'
  canvas.style.position = 'absolute'
  canvas.style.inset = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '1'
  host.prepend(canvas)

  host.querySelectorAll<HTMLElement>('.node,.coreGridLabel').forEach((element) => {
    element.style.zIndex = '3'
  })

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x090806, 0.035)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
  camera.position.set(0, 0.35, 8.6)

  const ambient = new THREE.AmbientLight(0xfff0d0, 1.1)
  scene.add(ambient)
  const key = new THREE.PointLight(0xe4a83f, 18, 18)
  key.position.set(2.8, 2.5, 4)
  scene.add(key)
  const rim = new THREE.PointLight(0x8fe7ba, 8, 14)
  rim.position.set(-3.5, -1.5, 2)
  scene.add(rim)

  const core = new THREE.Group()
  scene.add(core)

  const sphere = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.12, 4),
    new THREE.MeshStandardMaterial({ color: 0x2a2113, emissive: 0x6b4314, emissiveIntensity: 0.9, metalness: 0.25, roughness: 0.3 })
  )
  core.add(sphere)

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.27, 2),
    new THREE.MeshBasicMaterial({ color: 0xe4a83f, wireframe: true, transparent: true, opacity: 0.22 })
  )
  core.add(shell)

  const rings: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.65 + i * 0.46, 0.012, 8, 96),
      new THREE.MeshBasicMaterial({ color: i === 1 ? 0x8fe7ba : 0xe4a83f, transparent: true, opacity: 0.34 - i * 0.07 })
    )
    ring.rotation.x = Math.PI / 2 + i * 0.28
    ring.rotation.y = i * 0.45
    core.add(ring)
    rings.push(ring)
  }

  const nodePositions = [
    new THREE.Vector3(0, 2.1, 0),
    new THREE.Vector3(2.2, 0, 0.15),
    new THREE.Vector3(0, -2.1, 0),
    new THREE.Vector3(-2.2, 0, 0.15),
    new THREE.Vector3(0, 0, -2.15),
  ]
  const nodes: THREE.Mesh[] = []
  nodePositions.forEach((position, i) => {
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      new THREE.MeshBasicMaterial({ color: stageColors[i], transparent: true, opacity: 0.92 })
    )
    node.position.copy(position)
    core.add(node)
    nodes.push(node)

    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), position]),
      new THREE.LineBasicMaterial({ color: stageColors[i], transparent: true, opacity: 0.28 })
    )
    core.add(line)
  })

  const particleCount = 90
  const positions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 2.5 + Math.random() * 2.6
    positions[i * 3] = Math.cos(a) * r
    positions[i * 3 + 1] = (Math.random() - 0.5) * 3.8
    positions[i * 3 + 2] = Math.sin(a) * r - 1
  }
  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({ color: 0xe4a83f, size: 0.025, transparent: true, opacity: 0.55 })
  )
  scene.add(particles)

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let raf = 0
  let last = performance.now()

  const resize = () => {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(host)

  const animate = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!reducedMotion) {
      core.rotation.y += dt * 0.18
      core.rotation.x = Math.sin(now * 0.00022) * 0.08
      shell.rotation.z -= dt * 0.22
      rings.forEach((ring, i) => {
        ring.rotation.z += dt * (0.08 + i * 0.035)
      })
      particles.rotation.y += dt * 0.025
      const pulse = 1 + Math.sin(now * 0.0024) * 0.045
      sphere.scale.setScalar(pulse)
      nodes.forEach((node, i) => node.scale.setScalar(1 + Math.sin(now * 0.002 + i) * 0.25))
    }
    renderer.render(scene, camera)
    raf = requestAnimationFrame(animate)
  }
  raf = requestAnimationFrame(animate)

  const cleanup = () => {
    cancelAnimationFrame(raf)
    observer.disconnect()
    renderer.dispose()
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(material)) material.forEach((m) => m.dispose())
      else material?.dispose()
    })
  }

  const removalObserver = new MutationObserver(() => {
    if (!document.body.contains(host)) cleanup()
  })
  removalObserver.observe(document.body, { childList: true, subtree: true })
}

const boot = () => {
  document.querySelectorAll<HTMLElement>('.coreVisual').forEach(mountScene)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}

const rootObserver = new MutationObserver(boot)
rootObserver.observe(document.body, { childList: true, subtree: true })
