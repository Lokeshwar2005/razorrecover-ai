import * as THREE from 'three'
import { GraphNodeDefinition, GraphNodeId, GraphTransactionContext, NodeVisualStatus } from '../../types/graph'

export const GRAPH_NODES: GraphNodeDefinition[] = [
  {
    id: 'txn',
    stageNumber: 0,
    key: '00',
    title: 'Transaction',
    subtitle: 'Signal Ingested',
    position: [-3.3, 1.3, -0.3],
    baseColor: 0x8a7a65,
    activeColor: 0xe5a944,
  },
  {
    id: 'detect',
    stageNumber: 1,
    key: '01',
    title: 'Detect',
    subtitle: 'Failure Signature',
    position: [-2.2, 2.4, 0.3],
    baseColor: 0x8a7a65,
    activeColor: 0xe5a944,
  },
  {
    id: 'diagnose',
    stageNumber: 2,
    key: '02',
    title: 'Diagnose',
    subtitle: 'Root Cause Classification',
    position: [0.0, 2.85, 0.5],
    baseColor: 0x8a7a65,
    activeColor: 0xe5a944,
  },
  {
    id: 'risk',
    stageNumber: 3,
    key: '03',
    title: 'Risk',
    subtitle: 'Friction & Safety Score',
    position: [2.3, 2.15, 0.3],
    baseColor: 0x8a7a65,
    activeColor: 0xf59e0b,
  },
  {
    id: 'policy',
    stageNumber: 4,
    key: '04',
    title: 'Policy Gate',
    subtitle: 'Bounded Evaluation',
    position: [3.35, 0.2, 0.0],
    baseColor: 0x8a7a65,
    activeColor: 0x10b981,
  },
  {
    id: 'action',
    stageNumber: 5,
    key: '05',
    title: 'Action',
    subtitle: 'Bounded Intervention',
    position: [2.15, -1.95, 0.35],
    baseColor: 0x8a7a65,
    activeColor: 0x10b981,
  },
  {
    id: 'verify',
    stageNumber: 6,
    key: '06',
    title: 'Verify',
    subtitle: 'Outcome Confirmation',
    position: [-0.4, -2.75, 0.55],
    baseColor: 0x8a7a65,
    activeColor: 0x34d399,
  },
]

export interface SceneOptions {
  canvas: HTMLCanvasElement
  onNodeClick?: (nodeId: GraphNodeId) => void
  onNodeHover?: (nodeId: GraphNodeId | null) => void
}

interface NodeMeshGroup {
  definition: GraphNodeDefinition
  group: THREE.Group
  sphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>
  halo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>
  beacon: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  targetColor: THREE.Color
  currentColor: THREE.Color
  targetScale: number
  currentScale: number
  status: NodeVisualStatus
}

interface ConduitGroup {
  fromNodeId: GraphNodeId
  toNodeId: GraphNodeId
  curve: THREE.CatmullRomCurve3
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>
  particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  particleOffsets: Float32Array
  particleSpeeds: Float32Array
  isActive: boolean
  isBlocked: boolean
  targetOpacity: number
  currentOpacity: number
}

// Reusable color instances to prevent garbage collection in render loops
const COLOR_IDLE = new THREE.Color(0x453d32)
const COLOR_ACTIVE = new THREE.Color(0xf5a623)
const COLOR_PROCESSING = new THREE.Color(0xfcd34d)
const COLOR_PASSED = new THREE.Color(0x34d399)
const COLOR_BLOCKED = new THREE.Color(0xef4444)
const COLOR_VERIFIED = new THREE.Color(0x10b981)
const COLOR_CORE_BASE = new THREE.Color(0x6b4314)
const COLOR_CORE_EMISSIVE = new THREE.Color(0xe4a83f)

const TMP_VEC = new THREE.Vector3()
const TMP_COLOR = new THREE.Color()

export class RecoveryGraphScene {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private coreGroup: THREE.Group
  private graphGroup: THREE.Group
  private coreSphere: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>
  private coreShell: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>
  private coreRings: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>[] = []
  private ambientParticles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  
  private nodeMeshGroups: Map<GraphNodeId, NodeMeshGroup> = new Map()
  private conduits: ConduitGroup[] = []
  private coreRadialLines: THREE.Line[] = []

  private raycaster = new THREE.Raycaster()
  private mousePos = new THREE.Vector2(-100, -100)
  private normalizedPointer = new THREE.Vector2(0, 0)
  private targetCameraPos = new THREE.Vector3(0, 0.25, 9.4)
  private currentCameraPos = new THREE.Vector3(0, 0.25, 9.4)
  private cameraLookTarget = new THREE.Vector3(0, 0, 0)

  private isDragging = false
  private dragStart = { x: 0, y: 0 }
  private orbitRotation = { x: 0, y: 0 }
  private targetOrbit = { x: 0, y: 0 }
  private zoomLevel = 9.4
  private targetZoom = 9.4

  private rafId: number = 0
  private lastTime: number = performance.now()
  private isVisible: boolean = true
  private prefersReducedMotion: boolean = false
  private resizeObserver: ResizeObserver | null = null

  private onNodeClick?: (nodeId: GraphNodeId) => void
  private onNodeHover?: (nodeId: GraphNodeId | null) => void
  private hoveredNodeId: GraphNodeId | null = null

  // Current simulation snapshot
  private transaction: GraphTransactionContext | null = null
  private activeStageIndex: number = -1
  private isRunning: boolean = false
  private isComplete: boolean = false

  constructor(options: SceneOptions) {
    this.canvas = options.canvas
    this.onNodeClick = options.onNodeClick
    this.onNodeHover = options.onNodeHover

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Initialize WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x000000, 0)

    // Scene & Fog
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x080705, 0.03)

    // Camera
    const width = Math.max(1, this.canvas.clientWidth)
    const height = Math.max(1, this.canvas.clientHeight)
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    this.camera.position.copy(this.currentCameraPos)
    this.camera.lookAt(this.cameraLookTarget)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffecd1, 1.2)
    this.scene.add(ambientLight)

    const keyLight = new THREE.PointLight(0xe4a83f, 15, 22)
    keyLight.position.set(3, 3.5, 4.5)
    this.scene.add(keyLight)

    const rimLight = new THREE.PointLight(0x34d399, 8, 18)
    rimLight.position.set(-3.8, -2, 3)
    this.scene.add(rimLight)

    const coreLight = new THREE.PointLight(0xf59e0b, 10, 8)
    coreLight.position.set(0, 0, 0)
    this.scene.add(coreLight)

    // Groups
    this.coreGroup = new THREE.Group()
    this.graphGroup = new THREE.Group()
    this.scene.add(this.coreGroup)
    this.scene.add(this.graphGroup)

    // Central AI Core Meshes
    const coreGeo = new THREE.IcosahedronGeometry(0.95, 3)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1f1910,
      emissive: COLOR_CORE_BASE,
      emissiveIntensity: 0.95,
      metalness: 0.35,
      roughness: 0.25,
      wireframe: false,
    })
    this.coreSphere = new THREE.Mesh(coreGeo, coreMat)
    this.coreGroup.add(this.coreSphere)

    const shellGeo = new THREE.IcosahedronGeometry(1.12, 1)
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0xe4a83f,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    })
    this.coreShell = new THREE.Mesh(shellGeo, shellMat)
    this.coreGroup.add(this.coreShell)

    // Core Orbital Rings
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(1.35 + i * 0.32, 0.012, 8, 80)
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 1 ? 0x34d399 : 0xe4a83f,
        transparent: true,
        opacity: 0.38 - i * 0.08,
      })
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.rotation.x = Math.PI / 2 + i * 0.38
      ring.rotation.y = i * 0.55
      this.coreGroup.add(ring)
      this.coreRings.push(ring)
    }

    // Ambient floating dust particles
    const particleCount = 75
    const particlePositions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 2.0 + Math.random() * 2.8
      particlePositions[i * 3] = Math.cos(angle) * radius
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4.2
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius - 0.8
    }
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMat = new THREE.PointsMaterial({
      color: 0xe4a83f,
      size: 0.032,
      transparent: true,
      opacity: 0.45,
    })
    this.ambientParticles = new THREE.Points(particleGeo, particleMat)
    this.scene.add(this.ambientParticles)

    // Build the 7 Graph Nodes
    this.buildGraphNodes()

    // Build Interconnecting Conduits & Flow Particles
    this.buildConduits()

    // Setup Event Listeners & Resize Observers
    this.setupEvents()

    // Kick off animation loop
    this.lastTime = performance.now()
    this.animate(this.lastTime)
  }

  private buildGraphNodes() {
    const nodeSphereGeo = new THREE.SphereGeometry(0.22, 24, 24)
    const nodeHaloGeo = new THREE.TorusGeometry(0.38, 0.014, 8, 48)
    const beaconGeo = new THREE.SphereGeometry(0.06, 12, 12)

    GRAPH_NODES.forEach((def) => {
      const nodeGroup = new THREE.Group()
      nodeGroup.position.set(...def.position)
      nodeGroup.userData = { nodeId: def.id, def }

      const sphereMat = new THREE.MeshStandardMaterial({
        color: 0x15120d,
        emissive: new THREE.Color(def.baseColor),
        emissiveIntensity: 0.65,
        metalness: 0.2,
        roughness: 0.35,
      })
      const sphere = new THREE.Mesh(nodeSphereGeo, sphereMat)
      nodeGroup.add(sphere)

      const haloMat = new THREE.MeshBasicMaterial({
        color: def.baseColor,
        transparent: true,
        opacity: 0.35,
      })
      const halo = new THREE.Mesh(nodeHaloGeo, haloMat)
      halo.rotation.x = Math.PI / 2
      nodeGroup.add(halo)

      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
      })
      const beacon = new THREE.Mesh(beaconGeo, beaconMat)
      beacon.position.set(0, 0.32, 0)
      nodeGroup.add(beacon)

      this.graphGroup.add(nodeGroup)

      this.nodeMeshGroups.set(def.id, {
        definition: def,
        group: nodeGroup,
        sphere,
        halo,
        beacon,
        targetColor: new THREE.Color(def.baseColor),
        currentColor: new THREE.Color(def.baseColor),
        targetScale: 1,
        currentScale: 1,
        status: 'idle',
      })

      // Radial connection from central core to node
      const radialPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...def.position)]
      const radialGeo = new THREE.BufferGeometry().setFromPoints(radialPts)
      const radialMat = new THREE.LineBasicMaterial({
        color: def.baseColor,
        transparent: true,
        opacity: 0.18,
      })
      const radialLine = new THREE.Line(radialGeo, radialMat)
      this.graphGroup.add(radialLine)
      this.coreRadialLines.push(radialLine)
    })
  }

  private buildConduits() {
    // Pipeline sequence connections:
    // txn -> detect -> diagnose -> risk -> policy -> action -> verify
    const connections: [GraphNodeId, GraphNodeId][] = [
      ['txn', 'detect'],
      ['detect', 'diagnose'],
      ['diagnose', 'risk'],
      ['risk', 'policy'],
      ['policy', 'action'],
      ['action', 'verify'],
    ]

    connections.forEach(([fromId, toId]) => {
      const fromDef = GRAPH_NODES.find((n) => n.id === fromId)!
      const toDef = GRAPH_NODES.find((n) => n.id === toId)!

      const p1 = new THREE.Vector3(...fromDef.position)
      const p2 = new THREE.Vector3(...toDef.position)
      
      // Control point arched slightly outward from core
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
      const outDir = mid.clone().normalize().multiplyScalar(0.45)
      mid.add(outDir)

      const curve = new THREE.CatmullRomCurve3([p1, mid, p2])
      const points = curve.getPoints(36)
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x8a7a65,
        transparent: true,
        opacity: 0.25,
      })
      const line = new THREE.Line(lineGeo, lineMat)
      this.graphGroup.add(line)

      // Data Packet flow particles along the conduit curve
      const particleCount = 14
      const particleOffsets = new Float32Array(particleCount)
      const particleSpeeds = new Float32Array(particleCount)
      const particlePos = new Float32Array(particleCount * 3)

      for (let i = 0; i < particleCount; i++) {
        particleOffsets[i] = i / particleCount
        particleSpeeds[i] = 0.28 + Math.random() * 0.14
        const pt = curve.getPoint(particleOffsets[i])
        particlePos[i * 3] = pt.x
        particlePos[i * 3 + 1] = pt.y
        particlePos[i * 3 + 2] = pt.z
      }

      const pGeo = new THREE.BufferGeometry()
      pGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3))
      const pMat = new THREE.PointsMaterial({
        color: 0xe5a944,
        size: 0.055,
        transparent: true,
        opacity: 0.75,
      })
      const particles = new THREE.Points(pGeo, pMat)
      this.graphGroup.add(particles)

      this.conduits.push({
        fromNodeId: fromId,
        toNodeId: toId,
        curve,
        line,
        particles,
        particleOffsets,
        particleSpeeds,
        isActive: false,
        isBlocked: false,
        targetOpacity: 0.25,
        currentOpacity: 0.25,
      })
    })
  }

  private setupEvents() {
    this.handleResize = this.handleResize.bind(this)
    this.handlePointerMove = this.handlePointerMove.bind(this)
    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handlePointerUp = this.handlePointerUp.bind(this)
    this.handleWheel = this.handleWheel.bind(this)
    this.handleClick = this.handleClick.bind(this)

    window.addEventListener('resize', this.handleResize)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    this.canvas.addEventListener('click', this.handleClick)

    this.resizeObserver = new ResizeObserver(this.handleResize)
    this.resizeObserver.observe(this.canvas.parentElement || this.canvas)

    // Visibility observer to pause renders when off-screen
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          this.isVisible = e.isIntersecting
        })
      })
      io.observe(this.canvas)
    }
  }

  private handleResize() {
    const parent = this.canvas.parentElement || this.canvas
    const width = Math.max(1, parent.clientWidth)
    const height = Math.max(1, parent.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private handlePointerMove(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect()
    this.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

    if (this.isDragging) {
      const dx = e.clientX - this.dragStart.x
      const dy = e.clientY - this.dragStart.y
      this.dragStart.x = e.clientX
      this.dragStart.y = e.clientY
      this.targetOrbit.y += dx * 0.0055
      this.targetOrbit.x += dy * 0.0055
      // Clamped pitch to avoid inverting view
      this.targetOrbit.x = Math.max(-0.65, Math.min(0.65, this.targetOrbit.x))
    } else {
      // Gentle parallax
      this.normalizedPointer.x = this.mousePos.x * 0.35
      this.normalizedPointer.y = this.mousePos.y * 0.25
    }

    // Raycast for hover
    this.raycaster.setFromCamera(this.mousePos, this.camera)
    const intersects = this.raycaster.intersectObjects(
      Array.from(this.nodeMeshGroups.values()).map((n) => n.sphere)
    )

    if (intersects.length > 0) {
      const hitGroup = intersects[0].object.parent as THREE.Group
      const nodeId = hitGroup?.userData?.nodeId as GraphNodeId | undefined
      if (nodeId && nodeId !== this.hoveredNodeId) {
        this.hoveredNodeId = nodeId
        this.canvas.style.cursor = 'pointer'
        this.onNodeHover?.(nodeId)
      }
    } else if (this.hoveredNodeId !== null) {
      this.hoveredNodeId = null
      this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'default'
      this.onNodeHover?.(null)
    }
  }

  private handlePointerDown(e: PointerEvent) {
    this.isDragging = true
    this.dragStart.x = e.clientX
    this.dragStart.y = e.clientY
    this.canvas.style.cursor = 'grabbing'
  }

  private handlePointerUp() {
    this.isDragging = false
    this.canvas.style.cursor = this.hoveredNodeId ? 'pointer' : 'default'
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault()
    this.targetZoom += e.deltaY * 0.004
    // Strict zoom bounds
    this.targetZoom = Math.max(6.8, Math.min(13.2, this.targetZoom))
  }

  private handleClick() {
    if (this.hoveredNodeId) {
      this.onNodeClick?.(this.hoveredNodeId)
    }
  }

  public resetCamera() {
    this.targetOrbit.x = 0
    this.targetOrbit.y = 0
    this.targetZoom = 9.4
    this.normalizedPointer.set(0, 0)
  }

  public updateSimulationState(
    transaction: GraphTransactionContext | null,
    activeStageIndex: number,
    isRunning: boolean,
    isComplete: boolean
  ) {
    this.transaction = transaction
    this.activeStageIndex = activeStageIndex
    this.isRunning = isRunning
    this.isComplete = isComplete

    const riskScore = transaction?.riskScore ?? 35
    const isEscalated = transaction?.policy === 'Escalated' || transaction?.result === 'Stopped'
    const isHighRisk = riskScore >= 70

    // Update each node state
    this.nodeMeshGroups.forEach((nodeGroup, id) => {
      const stageIdx = nodeGroup.definition.stageNumber

      if (isRunning) {
        if (stageIdx === activeStageIndex) {
          nodeGroup.status = 'processing'
          nodeGroup.targetColor.copy(COLOR_PROCESSING)
          nodeGroup.targetScale = 1.3
        } else if (stageIdx < activeStageIndex) {
          if (stageIdx === 4 && isEscalated) {
            nodeGroup.status = 'blocked'
            nodeGroup.targetColor.copy(COLOR_BLOCKED)
            nodeGroup.targetScale = 1.2
          } else {
            nodeGroup.status = 'passed'
            nodeGroup.targetColor.copy(COLOR_PASSED)
            nodeGroup.targetScale = 1.05
          }
        } else {
          nodeGroup.status = 'idle'
          nodeGroup.targetColor.setHex(nodeGroup.definition.baseColor)
          nodeGroup.targetScale = 0.95
        }
      } else if (isComplete || transaction) {
        if (isEscalated && stageIdx >= 4) {
          if (stageIdx === 4) {
            nodeGroup.status = 'blocked'
            nodeGroup.targetColor.copy(COLOR_BLOCKED)
            nodeGroup.targetScale = 1.25
          } else {
            // Downstream nodes remain subdued/blocked
            nodeGroup.status = 'idle'
            nodeGroup.targetColor.setHex(0x352e25)
            nodeGroup.targetScale = 0.85
          }
        } else {
          if (stageIdx === 6) {
            nodeGroup.status = 'verified'
            nodeGroup.targetColor.copy(COLOR_VERIFIED)
            nodeGroup.targetScale = 1.2
          } else if (stageIdx === 3 && isHighRisk) {
            nodeGroup.status = 'active'
            nodeGroup.targetColor.copy(COLOR_BLOCKED)
            nodeGroup.targetScale = 1.15
          } else {
            nodeGroup.status = 'passed'
            nodeGroup.targetColor.copy(COLOR_PASSED)
            nodeGroup.targetScale = 1.05
          }
        }
      } else {
        nodeGroup.status = 'idle'
        nodeGroup.targetColor.setHex(nodeGroup.definition.baseColor)
        nodeGroup.targetScale = 1.0
      }
    })

    // Update Conduits
    this.conduits.forEach((conduit, i) => {
      const fromDef = GRAPH_NODES.find((n) => n.id === conduit.fromNodeId)!
      const stageIdx = fromDef.stageNumber

      if (isRunning) {
        if (stageIdx < activeStageIndex) {
          conduit.isActive = true
          conduit.isBlocked = stageIdx >= 4 && isEscalated
          conduit.targetOpacity = conduit.isBlocked ? 0.2 : 0.85
        } else {
          conduit.isActive = false
          conduit.isBlocked = false
          conduit.targetOpacity = 0.2
        }
      } else if (isComplete || transaction) {
        if (isEscalated && stageIdx >= 4) {
          conduit.isActive = false
          conduit.isBlocked = true
          conduit.targetOpacity = 0.12
        } else {
          conduit.isActive = true
          conduit.isBlocked = false
          conduit.targetOpacity = 0.75
        }
      } else {
        conduit.isActive = false
        conduit.isBlocked = false
        conduit.targetOpacity = 0.25
      }
    })
  }

  private animate = (now: number) => {
    this.rafId = requestAnimationFrame(this.animate)

    if (!this.isVisible) return

    const dt = Math.min(0.05, (now - this.lastTime) / 1000)
    this.lastTime = now

    // Smooth Orbit & Camera Interpolation
    this.orbitRotation.x += (this.targetOrbit.x - this.orbitRotation.x) * 0.1
    this.orbitRotation.y += (this.targetOrbit.y - this.orbitRotation.y) * 0.1
    this.zoomLevel += (this.targetZoom - this.zoomLevel) * 0.08

    const phi = this.orbitRotation.x + this.normalizedPointer.y * 0.18
    const theta = this.orbitRotation.y + this.normalizedPointer.x * 0.24

    this.targetCameraPos.set(
      Math.sin(theta) * Math.cos(phi) * this.zoomLevel,
      Math.sin(phi) * this.zoomLevel + 0.2,
      Math.cos(theta) * Math.cos(phi) * this.zoomLevel
    )
    this.camera.position.lerp(this.targetCameraPos, 0.08)
    this.camera.lookAt(this.cameraLookTarget)

    if (!this.prefersReducedMotion) {
      // Core Rotations
      const speedMult = this.isRunning ? 2.2 : 1.0
      this.coreGroup.rotation.y += dt * 0.22 * speedMult
      this.coreGroup.rotation.x = Math.sin(now * 0.0003) * 0.09
      this.coreShell.rotation.z -= dt * 0.28 * speedMult

      this.coreRings.forEach((ring, idx) => {
        ring.rotation.z += dt * (0.09 + idx * 0.04) * speedMult
      })

      this.ambientParticles.rotation.y += dt * 0.035

      // Core Breathing Pulse
      const corePulse = 1 + Math.sin(now * 0.0028 * speedMult) * 0.048
      this.coreSphere.scale.setScalar(corePulse)

      // Dynamic Core Emissive Glow
      if (this.isRunning) {
        this.coreSphere.material.emissive.copy(COLOR_CORE_EMISSIVE)
        this.coreSphere.material.emissiveIntensity = 1.3 + Math.sin(now * 0.008) * 0.4
      } else if (this.transaction?.result === 'Recovered' || this.isComplete) {
        this.coreSphere.material.emissive.copy(COLOR_PASSED)
        this.coreSphere.material.emissiveIntensity = 0.95
      } else if (this.transaction?.result === 'Stopped') {
        this.coreSphere.material.emissive.copy(COLOR_BLOCKED)
        this.coreSphere.material.emissiveIntensity = 0.8
      } else {
        this.coreSphere.material.emissive.copy(COLOR_CORE_BASE)
        this.coreSphere.material.emissiveIntensity = 0.85
      }
    }

    // Node updates & halos
    this.nodeMeshGroups.forEach((nodeGroup) => {
      // Interpolate colors smoothly
      nodeGroup.currentColor.lerp(nodeGroup.targetColor, 0.12)
      nodeGroup.sphere.material.emissive.copy(nodeGroup.currentColor)
      nodeGroup.halo.material.color.copy(nodeGroup.currentColor)

      // Interpolate scale
      nodeGroup.currentScale += (nodeGroup.targetScale - nodeGroup.currentScale) * 0.1
      
      if (!this.prefersReducedMotion) {
        const pulse =
          nodeGroup.status === 'processing'
            ? 1 + Math.sin(now * 0.012) * 0.18
            : nodeGroup.status === 'blocked'
            ? 1 + Math.sin(now * 0.009) * 0.12
            : 1 + Math.sin(now * 0.0025 + nodeGroup.definition.stageNumber) * 0.04

        nodeGroup.group.scale.setScalar(nodeGroup.currentScale * pulse)
        nodeGroup.halo.rotation.z += dt * (nodeGroup.status === 'processing' ? 1.8 : 0.4)
      } else {
        nodeGroup.group.scale.setScalar(nodeGroup.currentScale)
      }
    })

    // Conduit flow particle animations
    this.conduits.forEach((conduit) => {
      conduit.currentOpacity += (conduit.targetOpacity - conduit.currentOpacity) * 0.1
      conduit.line.material.opacity = conduit.currentOpacity
      conduit.particles.material.opacity = conduit.isActive ? 0.9 : 0.2

      if (conduit.isBlocked) {
        conduit.line.material.color.copy(COLOR_BLOCKED)
        conduit.particles.material.color.copy(COLOR_BLOCKED)
      } else if (conduit.isActive) {
        conduit.line.material.color.copy(COLOR_ACTIVE)
        conduit.particles.material.color.copy(COLOR_ACTIVE)
      } else {
        conduit.line.material.color.setHex(0x605342)
        conduit.particles.material.color.setHex(0x605342)
      }

      // Move flow particles along curves
      if (!this.prefersReducedMotion && conduit.isActive && !conduit.isBlocked) {
        const posAttr = conduit.particles.geometry.getAttribute('position') as THREE.BufferAttribute
        const count = conduit.particleOffsets.length

        for (let i = 0; i < count; i++) {
          conduit.particleOffsets[i] = (conduit.particleOffsets[i] + dt * conduit.particleSpeeds[i]) % 1
          const pt = conduit.curve.getPoint(conduit.particleOffsets[i], TMP_VEC)
          posAttr.setXYZ(i, pt.x, pt.y, pt.z)
        }
        posAttr.needsUpdate = true
      }
    })

    this.renderer.render(this.scene, this.camera)
  }

  public dispose() {
    cancelAnimationFrame(this.rafId)

    window.removeEventListener('resize', this.handleResize)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    this.canvas.removeEventListener('click', this.handleClick)

    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }

    this.renderer.dispose()

    this.scene.traverse((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) {
        mesh.geometry.dispose()
      }
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose())
      } else if (mat) {
        mat.dispose()
      }
    })
  }
}
