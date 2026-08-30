'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface SplineWatchViewerProps {
  dialColor?: string
  caseMaterial?: string
  strapMaterial?: string
  brand?: string
  model?: string
  isInteractive?: boolean
  className?: string
}

export const SplineWatchViewer: React.FC<SplineWatchViewerProps> = ({
  dialColor = '#0f172a',
  caseMaterial = '#cbd5e1',
  strapMaterial = '#78350f',
  brand = 'CHRONOVA',
  model = 'CALIBRE 3D',
  isInteractive = true,
  className = 'w-full h-80 sm:h-96'
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const [isRotating, setIsRotating] = useState<boolean>(true)
  const [activeLighting, setActiveLighting] = useState<'studio' | 'gold' | 'neon'>('studio')

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    // Scene, Camera, Renderer
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000)
    camera.position.set(0, 0, 7)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
    scene.add(ambientLight)

    const mainStudioLight = new THREE.DirectionalLight(0xffffff, 2.5)
    mainStudioLight.position.set(5, 8, 5)
    mainStudioLight.castShadow = true
    scene.add(mainStudioLight)

    const rimLight = new THREE.PointLight(0x38bdf8, 2, 20)
    rimLight.position.set(-5, -3, -3)
    scene.add(rimLight)

    const fillLight = new THREE.DirectionalLight(0xffedd5, 1.5)
    fillLight.position.set(-5, 5, 5)
    scene.add(fillLight)

    // Materials
    const caseColorHex = caseMaterial.toLowerCase().includes('gold') ? 0xd97706 : caseMaterial.toLowerCase().includes('black') ? 0x18181b : 0xd1d5db
    const strapColorHex = strapMaterial.toLowerCase().includes('brown') || strapMaterial.toLowerCase().includes('leather') ? 0x78350f : strapMaterial.toLowerCase().includes('gold') ? 0xb45309 : 0x111827

    const caseMat = new THREE.MeshStandardMaterial({
      color: caseColorHex,
      metalness: 0.95,
      roughness: 0.15,
    })

    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.2,
    })

    const dialMat = new THREE.MeshStandardMaterial({
      color: dialColor.toLowerCase().includes('blue') ? 0x1e3a8a : dialColor.toLowerCase().includes('green') ? 0x064e3b : dialColor.toLowerCase().includes('white') ? 0xf8fafc : 0x09090b,
      metalness: 0.4,
      roughness: 0.3,
    })

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.9,
      thickness: 0.5,
      transparent: true,
      opacity: 0.4,
    })

    const strapMat = new THREE.MeshStandardMaterial({
      color: strapColorHex,
      metalness: 0.2,
      roughness: 0.6,
    })

    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.1,
    })

    // Watch Group
    const watchGroup = new THREE.Group()

    // 1. Case (Cylinder with chamfer)
    const caseGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.45, 64)
    const caseMesh = new THREE.Mesh(caseGeo, caseMat)
    caseMesh.rotation.x = Math.PI / 2
    watchGroup.add(caseMesh)

    // 2. Bezel Ring
    const bezelGeo = new THREE.TorusGeometry(1.5, 0.12, 24, 64)
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat)
    bezelMesh.position.z = 0.22
    watchGroup.add(bezelMesh)

    // 3. Dial Plate
    const dialGeo = new THREE.CircleGeometry(1.42, 64)
    const dialMesh = new THREE.Mesh(dialGeo, dialMat)
    dialMesh.position.z = 0.23
    watchGroup.add(dialMesh)

    // 4. Sapphire Crystal Dome
    const glassGeo = new THREE.CylinderGeometry(1.45, 1.45, 0.08, 64)
    const glassMesh = new THREE.Mesh(glassGeo, glassMat)
    glassMesh.rotation.x = Math.PI / 2
    glassMesh.position.z = 0.28
    watchGroup.add(glassMesh)

    // 5. Crown & Pushers
    const crownGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.35, 32)
    const crownMesh = new THREE.Mesh(crownGeo, caseMat)
    crownMesh.rotation.z = Math.PI / 2
    crownMesh.position.set(1.75, 0, 0)
    watchGroup.add(crownMesh)

    const pusher1Geo = new THREE.CylinderGeometry(0.12, 0.12, 0.25, 24)
    const pusher1Mesh = new THREE.Mesh(pusher1Geo, caseMat)
    pusher1Mesh.rotation.z = Math.PI / 2
    pusher1Mesh.position.set(1.65, 0.75, 0)
    watchGroup.add(pusher1Mesh)

    const pusher2Mesh = pusher1Mesh.clone()
    pusher2Mesh.position.set(1.65, -0.75, 0)
    watchGroup.add(pusher2Mesh)

    // 6. Straps (Top & Bottom Curve)
    const strapTopGeo = new THREE.BoxGeometry(1.3, 2.2, 0.18)
    const strapTop = new THREE.Mesh(strapTopGeo, strapMat)
    strapTop.position.set(0, 2.4, -0.1)
    strapTop.rotation.x = 0.15
    watchGroup.add(strapTop)

    const strapBottom = strapTop.clone()
    strapBottom.position.set(0, -2.4, -0.1)
    strapBottom.rotation.x = -0.15
    watchGroup.add(strapBottom)

    // 7. Hands (Hour, Minute, Seconds)
    const hourHandGeo = new THREE.BoxGeometry(0.08, 0.7, 0.04)
    const hourHand = new THREE.Mesh(hourHandGeo, goldAccentMat)
    hourHand.position.set(0, 0.35, 0.25)
    hourHand.rotation.z = 0.8
    watchGroup.add(hourHand)

    const minHandGeo = new THREE.BoxGeometry(0.06, 1.05, 0.04)
    const minHand = new THREE.Mesh(minHandGeo, goldAccentMat)
    minHand.position.set(0, 0.5, 0.26)
    minHand.rotation.z = -1.2
    watchGroup.add(minHand)

    const secHandGeo = new THREE.BoxGeometry(0.02, 1.2, 0.02)
    const secHand = new THREE.Mesh(secHandGeo, new THREE.MeshBasicMaterial({ color: 0xef4444 }))
    secHand.position.set(0, 0.4, 0.27)
    secHand.rotation.z = 2.4
    watchGroup.add(secHand)

    const centerPinGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 24)
    const centerPin = new THREE.Mesh(centerPinGeo, goldAccentMat)
    centerPin.rotation.x = Math.PI / 2
    centerPin.position.z = 0.28
    watchGroup.add(centerPin)

    // Initial Tilt
    watchGroup.rotation.x = 0.35
    watchGroup.rotation.y = -0.4
    scene.add(watchGroup)

    // Interactive Drag / Orbit Controls
    let isDragging = false
    let prevMousePos = { x: 0, y: 0 }

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMousePos = { x: e.clientX, y: e.clientY }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - prevMousePos.x
      const deltaY = e.clientY - prevMousePos.y
      watchGroup.rotation.y += deltaX * 0.01
      watchGroup.rotation.x += deltaY * 0.01
      prevMousePos = { x: e.clientX, y: e.clientY }
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true
        prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      const deltaX = e.touches[0].clientX - prevMousePos.x
      const deltaY = e.touches[0].clientY - prevMousePos.y
      watchGroup.rotation.y += deltaX * 0.01
      watchGroup.rotation.x += deltaY * 0.01
      prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }

    const onTouchEnd = () => {
      isDragging = false
    }

    if (isInteractive) {
      container.addEventListener('mousedown', onMouseDown)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      container.addEventListener('touchstart', onTouchStart, { passive: true })
      window.addEventListener('touchmove', onTouchMove, { passive: true })
      window.addEventListener('touchend', onTouchEnd)
    }

    // Animation Loop
    let animationFrameId: number
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      if (isRotating && !isDragging) {
        watchGroup.rotation.y += 0.006
      }
      secHand.rotation.z -= 0.02
      renderer.render(scene, camera)
    }
    animate()

    // Handle Resize
    const handleResize = () => {
      if (!container) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      if (isInteractive) {
        container.removeEventListener('mousedown', onMouseDown)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        container.removeEventListener('touchstart', onTouchStart)
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }
      renderer.dispose()
    }
  }, [dialColor, caseMaterial, strapMaterial, isRotating, isInteractive])

  return (
    <div className={`relative flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 ${className}`}>
      {/* Top Floating Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-400 font-mono text-xs font-bold uppercase tracking-wider backdrop-blur-md flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          SPLINE 3D REALTIME
        </span>
        <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 font-mono text-[11px] font-bold">
          {brand} · {model}
        </span>
      </div>

      {/* Control Pills */}
      <div className="absolute bottom-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700 backdrop-blur-md">
        <button
          onClick={() => setIsRotating((prev) => !prev)}
          className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
            isRotating ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          {isRotating ? '⏸ PAUSE ORBIT' : '▶ AUTO ORBIT'}
        </button>
        <span className="text-slate-600 text-xs">|</span>
        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
          🖱️ DRAG TO ROTATE 360°
        </span>
      </div>

      {/* 3D WebGL / Spline Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  )
}
