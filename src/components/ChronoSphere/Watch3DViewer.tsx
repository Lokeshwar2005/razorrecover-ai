'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Watch3DViewerProps {
  initialDialColor?: string
  initialStrapColor?: string
  modelName?: string
  brand?: string
}

export const Watch3DViewer: React.FC<Watch3DViewerProps> = ({
  initialDialColor = '#1e3a8a',
  initialStrapColor = '#111827',
  modelName = 'Stellar Chronograph',
  brand = 'ChronoSphere',
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [dialColor, setDialColor] = useState(initialDialColor)
  const [strapColor, setStrapColor] = useState(initialStrapColor)
  const [isRotating, setIsRotating] = useState(true)

  const sceneRef = useRef<THREE.Scene | null>(null)
  const dialMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const strapMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null)
  const secondHandRef = useRef<THREE.Mesh | null>(null)

  const colorPresets = [
    { name: 'Royal Sapphire', hex: '#1e3a8a', label: 'Sapphire' },
    { name: 'Obsidian Black', hex: '#0f172a', label: 'Obsidian' },
    { name: 'Emerald Forest', hex: '#064e3b', label: 'Emerald' },
    { name: 'Champagne Gold', hex: '#d97706', label: 'Gold' },
    { name: 'Titanium Silver', hex: '#64748b', label: 'Silver' },
  ]

  const strapPresets = [
    { name: 'Midnight Black', hex: '#111827' },
    { name: 'Cognac Brown', hex: '#78350f' },
    { name: 'Brushed Steel', hex: '#94a3b8' },
    { name: 'Deep Navy', hex: '#1e293b' },
  ]

  useEffect(() => {
    if (!mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth || 400
    const height = container.clientHeight || 350

    // 1. Scene & Camera
    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    camera.position.set(0, 0, 9)

    // 2. Renderer with Antialias & Tone Mapping
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    // 3. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9)
    scene.add(ambientLight)

    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.2)
    keyLight.position.set(6, 8, 8)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x99ccff, 1.4)
    fillLight.position.set(-6, -4, 6)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.8)
    rimLight.position.set(0, 8, -6)
    scene.add(rimLight)

    // 4. Watch Geometry Hierarchy
    const watchGroup = new THREE.Group()

    // 4a. Bezel / Main Case
    const caseGeom = new THREE.CylinderGeometry(2.4, 2.4, 0.45, 64)
    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.15,
    })
    const watchCase = new THREE.Mesh(caseGeom, steelMaterial)
    watchCase.rotation.x = Math.PI / 2
    watchGroup.add(watchCase)

    // 4b. Polished Outer Ring / Bezel
    const bezelGeom = new THREE.TorusGeometry(2.38, 0.14, 24, 64)
    const goldAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.1,
    })
    const bezel = new THREE.Mesh(bezelGeom, goldAccentMaterial)
    bezel.position.z = 0.24
    watchGroup.add(bezel)

    // 4c. Watch Dial Face
    const dialGeom = new THREE.CircleGeometry(2.2, 64)
    const dialMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(dialColor),
      metalness: 0.65,
      roughness: 0.28,
    })
    dialMaterialRef.current = dialMat
    const dial = new THREE.Mesh(dialGeom, dialMat)
    dial.position.z = 0.235
    watchGroup.add(dial)

    // 4d. Hour Markers (12 Indices)
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6
      const isQuarter = i % 3 === 0
      const markerGeom = new THREE.BoxGeometry(isQuarter ? 0.08 : 0.04, isQuarter ? 0.38 : 0.22, 0.04)
      const marker = new THREE.Mesh(markerGeom, goldAccentMaterial)
      const r = 1.85
      marker.position.set(Math.sin(angle) * r, Math.cos(angle) * r, 0.25)
      marker.rotation.z = -angle
      watchGroup.add(marker)
    }

    // 4e. Sub-dials (Chronograph)
    const subDialGeom = new THREE.RingGeometry(0.35, 0.42, 32)
    const sub1 = new THREE.Mesh(subDialGeom, goldAccentMaterial)
    sub1.position.set(-0.85, 0, 0.245)
    watchGroup.add(sub1)

    const sub2 = new THREE.Mesh(subDialGeom, goldAccentMaterial)
    sub2.position.set(0.85, 0, 0.245)
    watchGroup.add(sub2)

    const sub3 = new THREE.Mesh(subDialGeom, goldAccentMaterial)
    sub3.position.set(0, -0.85, 0.245)
    watchGroup.add(sub3)

    // 4f. Hands (Hour, Minute, Second)
    const hourHandGeom = new THREE.BoxGeometry(0.1, 1.1, 0.03)
    hourHandGeom.translate(0, 0.45, 0)
    const hourHand = new THREE.Mesh(hourHandGeom, goldAccentMaterial)
    hourHand.position.z = 0.27
    hourHand.rotation.z = -Math.PI / 4 // 10 o'clock
    watchGroup.add(hourHand)

    const minuteHandGeom = new THREE.BoxGeometry(0.07, 1.6, 0.03)
    minuteHandGeom.translate(0, 0.7, 0)
    const minuteHand = new THREE.Mesh(minuteHandGeom, steelMaterial)
    minuteHand.position.z = 0.28
    minuteHand.rotation.z = Math.PI / 6 // 2 o'clock
    watchGroup.add(minuteHand)

    const secondHandGeom = new THREE.BoxGeometry(0.025, 1.8, 0.02)
    secondHandGeom.translate(0, 0.75, 0)
    const redAccentMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8, roughness: 0.2 })
    const secondHand = new THREE.Mesh(secondHandGeom, redAccentMat)
    secondHand.position.z = 0.29
    secondHandRef.current = secondHand
    watchGroup.add(secondHand)

    // 4g. Center Pin Cap
    const pinGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 24)
    const pin = new THREE.Mesh(pinGeom, goldAccentMaterial)
    pin.rotation.x = Math.PI / 2
    pin.position.z = 0.31
    watchGroup.add(pin)

    // 4h. Crown & Pushers
    const crownGeom = new THREE.CylinderGeometry(0.22, 0.22, 0.35, 24)
    const crown = new THREE.Mesh(crownGeom, goldAccentMaterial)
    crown.rotation.z = Math.PI / 2
    crown.position.set(2.55, 0, 0)
    watchGroup.add(crown)

    const pusherGeom = new THREE.CylinderGeometry(0.14, 0.14, 0.28, 24)
    const pusherTop = new THREE.Mesh(pusherGeom, steelMaterial)
    pusherTop.rotation.z = Math.PI / 3
    pusherTop.position.set(2.35, 1.25, 0)
    watchGroup.add(pusherTop)

    const pusherBot = new THREE.Mesh(pusherGeom, steelMaterial)
    pusherBot.rotation.z = -Math.PI / 3
    pusherBot.position.set(2.35, -1.25, 0)
    watchGroup.add(pusherBot)

    // 4i. Watch Strap (Top & Bottom Bands)
    const strapMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(strapColor),
      metalness: 0.2,
      roughness: 0.8,
    })
    strapMaterialRef.current = strapMat

    const strapTopGeom = new THREE.BoxGeometry(1.6, 2.6, 0.22)
    const strapTop = new THREE.Mesh(strapTopGeom, strapMat)
    strapTop.position.set(0, 3.1, -0.05)
    strapTop.rotation.x = -0.18
    watchGroup.add(strapTop)

    const strapBottomGeom = new THREE.BoxGeometry(1.6, 2.6, 0.22)
    const strapBottom = new THREE.Mesh(strapBottomGeom, strapMat)
    strapBottom.position.set(0, -3.1, -0.05)
    strapBottom.rotation.x = 0.18
    watchGroup.add(strapBottom)

    // 4j. Sapphire Glass Dome
    const glassGeom = new THREE.CircleGeometry(2.3, 64)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      roughness: 0.05,
      transmission: 0.95,
      ior: 1.52,
    })
    const glass = new THREE.Mesh(glassGeom, glassMat)
    glass.position.z = 0.32
    watchGroup.add(glass)

    scene.add(watchGroup)

    // 5. Orbit & Touch Controls
    let isDragging = false
    let prevMouseX = 0
    let prevMouseY = 0
    let targetRotY = 0.25
    let targetRotX = 0.15

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - prevMouseX
      const deltaY = e.clientY - prevMouseY
      targetRotY += deltaX * 0.012
      targetRotX += deltaY * 0.012
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true
        prevMouseX = e.touches[0].clientX
        prevMouseY = e.touches[0].clientY
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      const deltaX = e.touches[0].clientX - prevMouseX
      const deltaY = e.touches[0].clientY - prevMouseY
      targetRotY += deltaX * 0.012
      targetRotX += deltaY * 0.012
      prevMouseX = e.touches[0].clientX
      prevMouseY = e.touches[0].clientY
    }

    const dom = renderer.domElement
    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    dom.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onMouseUp)

    // 6. Animation Loop
    let reqId: number
    let clock = new THREE.Clock()

    const animate = () => {
      reqId = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      // Smooth manual and auto rotation
      if (isRotating && !isDragging) {
        targetRotY += 0.005
      }

      watchGroup.rotation.y += (targetRotY - watchGroup.rotation.y) * 0.08
      watchGroup.rotation.x += (targetRotX - watchGroup.rotation.x) * 0.08

      // Second hand ticking animation
      if (secondHandRef.current) {
        secondHandRef.current.rotation.z = -elapsed * 1.8
      }

      renderer.render(scene, camera)
    }
    animate()

    // 7. Resize Observer
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth || 400
      const h = container.clientHeight || 350
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(reqId)
      window.removeEventListener('resize', handleResize)
      dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      dom.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onMouseUp)
      if (container.contains(dom)) {
        container.removeChild(dom)
      }
      renderer.dispose()
    }
  }, [])

  // Update dial color on the fly
  useEffect(() => {
    if (dialMaterialRef.current) {
      dialMaterialRef.current.color.set(dialColor)
    }
  }, [dialColor])

  // Update strap color on the fly
  useEffect(() => {
    if (strapMaterialRef.current) {
      strapMaterialRef.current.color.set(strapColor)
    }
  }, [strapColor])

  return (
    <div className="w-full flex flex-col items-center bg-gradient-to-b from-[#090e1a] to-[#040711] rounded-2xl border border-[#1e293b] p-4 relative overflow-hidden shadow-2xl">
      {/* 3D Model Header Badges */}
      <div className="w-full flex items-center justify-between z-10 mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-[#38bdf8]/10 border border-[#38bdf8]/40 text-[#38bdf8] font-mono text-[10px] font-bold">
            3D INTERACTIVE STUDIO
          </span>
          <span className="text-xs font-semibold text-[#cbd5e1]">{brand}</span>
        </div>
        <button
          onClick={() => setIsRotating((prev) => !prev)}
          className="text-[10px] px-2.5 py-1 rounded-lg bg-[#1e293b] text-[#94a3b8] hover:text-white transition font-mono cursor-pointer"
        >
          {isRotating ? '⏸ Pause Orbit' : '▶ Auto-Orbit'}
        </button>
      </div>

      {/* Canvas Mount Container */}
      <div
        ref={mountRef}
        className="w-full h-72 sm:h-80 cursor-grab active:cursor-grabbing flex items-center justify-center relative select-none touch-none"
      />

      {/* Interactive Customizer Controls */}
      <div className="w-full mt-3 pt-3 border-t border-[#1e293b] flex flex-wrap items-center justify-between gap-3 z-10">
        {/* Dial Color Swatches */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#94a3b8] font-medium">Dial Finish:</span>
          <div className="flex items-center gap-1.5">
            {colorPresets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => setDialColor(preset.hex)}
                title={preset.name}
                style={{ backgroundColor: preset.hex }}
                className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                  dialColor === preset.hex ? 'border-white scale-125 shadow-lg' : 'border-[#334155] hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Strap Color Swatches */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#94a3b8] font-medium">Strap Material:</span>
          <div className="flex items-center gap-1.5">
            {strapPresets.map((strap) => (
              <button
                key={strap.name}
                onClick={() => setStrapColor(strap.hex)}
                title={strap.name}
                style={{ backgroundColor: strap.hex }}
                className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                  strapColor === strap.hex ? 'border-[#38bdf8] scale-125 shadow-lg' : 'border-[#334155] hover:scale-110'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-[#64748b] font-mono mt-2 flex items-center gap-1">
        <span>💡 Drag to rotate 360° · Precision WebGL Swiss Watch Visualization</span>
      </div>
    </div>
  )
}
