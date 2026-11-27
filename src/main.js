import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { LIGHTING_PRESETS } from './config/lightingPresets.js';
import { CAMERA_PRESETS } from './config/landmarksData.js';
import { createGeographyFieldTexture } from './config/geography.js';
import {
  createRainforestFoliageTextures,
  createCecropiaFoliageTextures,
  createPalmFrondTextures,
  createUnderstoryFrondTextures,
  createBarkTextures,
} from './textures/vegetationTextures.js';
import {
  createForestTerrainTextures,
  createGraniteTextures,
  createWaterNormalTextures,
} from './textures/terrainTextures.js';
import {
  createCityFacadeTextures,
  createGlowSpriteTexture,
  createFootballPitchTexture,
} from './textures/cityTextures.js';
import { createSkyMaterial } from './shaders/skyShader.js';
import { TerrainSystem } from './world/TerrainSystem.js';
import { WaterSystem } from './world/WaterSystem.js';
import { VegetationSystem } from './world/VegetationSystem.js';
import { LandmarksSystem } from './world/LandmarksSystem.js';
import { CitySystem } from './world/CitySystem.js';
import { MaritimeSystem } from './world/MaritimeSystem.js';
import { PostProcessor } from './post/PostProcessor.js';
import { HudController } from './ui/HudController.js';

const loadingBar = document.getElementById('loading-bar');
const loadingStatus = document.getElementById('loading-status');
const loadingScreen = document.getElementById('loading-screen');

function setProgress(pct, msg) {
  if (loadingBar) loadingBar.style.width = `${pct}%`;
  if (loadingStatus) loadingStatus.textContent = msg;
}

async function nextFrame() {
  return new Promise((r) => requestAnimationFrame(r));
}

async function bootstrap() {
  const params = new URLSearchParams(window.location.search);
  const initialMoodKey =
    LIGHTING_PRESETS[params.get('mood')] ? params.get('mood') : 'twilight';
  const initialPreset =
    CAMERA_PRESETS.find((p) => p.id === params.get('preset')) || CAMERA_PRESETS[0];
  const hideHudInitially = params.get('hud') === '0';
  const showLabelsInitially = params.get('labels') === '1';
  const startPaused = params.get('pause') === '1';

  const activePreset = LIGHTING_PRESETS[initialMoodKey];

  // 1. Renderer & Scene Setup
  setProgress(10, 'Initializing WebGL2 HDR rendering pipeline...');
  await nextFrame();

  const container = document.getElementById('canvas-container');
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // Handled cleanly inside our ACES Grade Pass!
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    initialPreset.fov,
    window.innerWidth / window.innerHeight,
    0.8,
    4600
  );
  camera.position.set(...initialPreset.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 4;
  controls.maxDistance = 820;
  controls.target.set(...initialPreset.target);
  controls.update();

  // Base Scene Lighting Rig (for standard PBR landmarks, buildings, trunks, ships)
  const hemiLight = new THREE.HemisphereLight(
    activePreset.hemiSkyColor,
    activePreset.hemiGroundColor,
    activePreset.hemiIntensity * 1.12
  );
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(
    activePreset.sunLightColor,
    activePreset.sunLightIntensity * 1.24
  );
  sunLight.position.copy(activePreset.sunDir).multiplyScalar(650);
  scene.add(sunLight);

  // Warm coastal city upward fill light bathing Niterói/São Francisco facades & foreground foliage
  const cityFillLight = new THREE.PointLight('#ff9c3c', 1.45, 250, 1.45);
  cityFillLight.position.set(0, 18, 138);
  scene.add(cityFillLight);

  // 2. Synthesize Procedural Botanical, Geological, Optical Wave & Architectural PBR Textures
  setProgress(24, 'Synthesizing Mata Atlântica multi-species botanical leaf, Cecropia, palm & fern PBR textures...');
  await nextFrame();
  const foliageTex = createRainforestFoliageTextures();
  const cecropiaTex = createCecropiaFoliageTextures();
  const palmTex = createPalmFrondTextures();
  const understoryTex = createUnderstoryFrondTextures();
  const barkTex = createBarkTextures();

  setProgress(42, 'Generating Rio granite gneiss, FFT dual-scale wave spectra & 1024² shoreline field...');
  await nextFrame();
  const forestTex = createForestTerrainTextures();
  const graniteTex = createGraniteTextures();
  const waterNormals = createWaterNormalTextures();
  const geoFieldTex = createGeographyFieldTexture(768);

  setProgress(56, 'Crafting Brazilian coastal architectural facades, soapstone mosaic & HDR sprites...');
  await nextFrame();
  const facadeTex = createCityFacadeTextures();
  const glowTex = createGlowSpriteTexture();
  const pitchTex = createFootballPitchTexture();

  // 3. Volumetric-Look Multi-Altitude Twilight Sky Dome
  setProgress(64, 'Building multi-altitude twilight atmospheric sky & backlit cloud decks...');
  await nextFrame();
  const skyMat = createSkyMaterial(activePreset);
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(2350, 48, 32), skyMat);
  skyDome.frustumCulled = false;
  scene.add(skyDome);

  // 4. Sculpted High-Res Baía de Guanabara Coastal & Mountain Terrain
  setProgress(74, 'Sculpting Parque da Cidade, Pão de Açúcar, Corcovado, MAC Cliff & Serra dos Órgãos...');
  await nextFrame();
  const terrainSystem = new TerrainSystem({
    forestTex,
    graniteTex,
    geoFieldTex,
    preset: activePreset,
  });
  scene.add(terrainSystem.group);

  // 5. Real-Time HDR Planar Reflection + Dual-Pass Anisotropic Vertical Light-Column Water System
  setProgress(82, 'Initializing real-time HDR planar water reflection & anisotropic shimmer engine...');
  await nextFrame();
  const waterSystem = new WaterSystem({
    swellNormalMap: waterNormals.swellNormal,
    capillaryNormalMap: waterNormals.capillaryNormal,
    geoFieldTex,
    preset: activePreset,
    quality: 'ultra',
  });
  scene.add(waterSystem.mesh);

  // 6. Multi-Species Mata Atlântica Rainforest Canopy, Branching Trunks, Palms & Giant Ferns
  setProgress(88, 'Populating Mata Atlântica canopy, Cecropia, Imperial palms, ferns & granite outcrops...');
  await nextFrame();
  const vegetationSystem = new VegetationSystem({
    foliageTex,
    cecropiaTex,
    palmTex,
    understoryTex,
    barkTex,
    graniteTex,
    preset: activePreset,
  });
  scene.add(vegetationSystem.group);

  // 7. Museum-Grade Recognizable Landmarks, Coastal Cities & Maritime Vessels
  setProgress(94, 'Placing Cristo Redentor, Bondinho, MAC Niterói, Ponte Rio-Niterói, Ilha Fiscal & vessels...');
  await nextFrame();
  const landmarksSystem = new LandmarksSystem({
    glowTex,
    graniteTex,
    soapstoneTex: facadeTex.soapstone,
    preset: activePreset,
  });
  scene.add(landmarksSystem.group);

  const citySystem = new CitySystem({
    facadeTex,
    glowTex,
    pitchTex,
    preset: activePreset,
  });
  scene.add(citySystem.group);

  const maritimeSystem = new MaritimeSystem({ glowTex });
  scene.add(maritimeSystem.group);

  // 8. Cinematic HDR Post-Processing (Selective Bloom + ACES Filmic Grade + Anti-Banding Micro-Dither)
  const postProcessor = new PostProcessor(renderer, scene, camera);
  postProcessor.setExposure(activePreset.exposure);

  // Camera smooth flight transition state
  const flight = {
    active: false,
    startTime: 0,
    duration: 2.2,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    fromFov: camera.fov,
    toFov: camera.fov,
  };

  function flyToPreset(preset) {
    flight.active = true;
    flight.startTime = performance.now();
    flight.fromPos.copy(camera.position);
    flight.toPos.set(...preset.position);
    flight.fromTarget.copy(controls.target);
    flight.toTarget.set(...preset.target);
    flight.fromFov = camera.fov;
    flight.toFov = preset.fov;
  }

  controls.addEventListener('start', () => {
    flight.active = false;
  });

  // WASD Free-Fly Support
  const keys = new Set();
  let paused = false;
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      paused = !paused;
      return;
    }
    if (['w', 'a', 's', 'd', 'q', 'e', 'shift'].includes(k)) {
      keys.add(k);
      flight.active = false;
    }
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });

  function applyMood(moodKey) {
    const p = LIGHTING_PRESETS[moodKey];
    if (!p) return;

    const su = skyMat.uniforms;
    su.uSunDir.value.copy(p.sunDir);
    su.uSkyZenith.value.copy(p.skyZenith);
    su.uSkyMid.value.copy(p.skyMid);
    su.uSkyHorizon.value.copy(p.skyHorizon);
    su.uSunsetCore.value.copy(p.sunsetCore);
    su.uSunsetGlow.value.copy(p.sunsetGlow);
    su.uCloudLight.value.copy(p.cloudLight);
    su.uCloudMid.value.copy(p.cloudMid);
    su.uCloudShadow.value.copy(p.cloudShadow);
    su.uStarVisibility.value = p.starVisibility;

    hemiLight.color.copy(p.hemiSkyColor);
    hemiLight.groundColor.copy(p.hemiGroundColor);
    hemiLight.intensity = p.hemiIntensity * 1.12;
    sunLight.color.copy(p.sunLightColor);
    sunLight.intensity = p.sunLightIntensity * 1.24;
    sunLight.position.copy(p.sunDir).multiplyScalar(650);
    cityFillLight.intensity = 1.15 * p.cityEmissiveScale;

    terrainSystem.applyPreset(p);
    waterSystem.applyPreset(p);
    vegetationSystem.applyPreset(p);
    landmarksSystem.applyPreset(p);
    citySystem.applyPreset(p);
    postProcessor.setExposure(p.exposure);
  }

  // 9. HUD & Controls
  const hud = new HudController({
    onSelectPreset: (preset) => flyToPreset(preset),
    onSelectMood: (moodKey) => applyMood(moodKey),
    onWindChange: (w) => {
      waterSystem.setWindStrength(w);
      vegetationSystem.setWindStrength(w);
    },
    onReflectionCrispnessChange: (c) => waterSystem.setReflectionCrispness(c),
    onBloomChange: (b) => postProcessor.setBloomStrength(b),
    onQualityChange: (q) => waterSystem.setQuality(q),
  });
  hud.setActivePreset(initialPreset.id);
  hud.setActiveMood(initialMoodKey);
  if (showLabelsInitially) hud.toggleLabels(true);
  if (hideHudInitially) hud.setHudHidden(true);

  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h);
    postProcessor.resize(w, h, pr);
    waterSystem.resize();
  });

  // Expose debug handle for inspection & automated camera tests
  let manualPause = startPaused;
  let renderOneFrame = null;

  window.__GUANABARA__ = {
    camera,
    controls,
    setPreset: (id) => {
      const p = CAMERA_PRESETS.find((x) => x.id === id);
      if (!p) return;
      flight.active = false;
      camera.position.set(...p.position);
      controls.target.set(...p.target);
      camera.fov = p.fov;
      camera.updateProjectionMatrix();
      controls.update();
      hud.setActivePreset(p.id);
    },
    setMood: (m) => {
      applyMood(m);
      hud.setActiveMood(m);
    },
    setHudHidden: (v) => hud.setHudHidden(v),
    toggleLabels: (v) => hud.toggleLabels(v),
    setPaused: (v) => {
      manualPause = Boolean(v);
    },
    renderOnce: () => {
      if (renderOneFrame) renderOneFrame(performance.now(), true);
    },
  };

  setProgress(100, 'Ready — Baía de Guanabara');
  await nextFrame();
  if (loadingScreen) loadingScreen.classList.add('fade-out');

  // 10. Main Real-Time Animation & HDR Planar Reflection Render Loop
  let elapsed = 0;
  let lastTime = performance.now();
  let fpsFrames = 0;
  let fpsTimer = lastTime;

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const moveDelta = new THREE.Vector3();

  function renderFrame(now, force = false) {
    if (manualPause && !force) return;

    const dt = Math.min(0.05, (now - lastTime) * 0.001);
    lastTime = now;
    if (!paused) elapsed += dt;

    if (flight.active) {
      const rawT = Math.min(1, (now - flight.startTime) / (flight.duration * 1000));
      const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;
      camera.position.lerpVectors(flight.fromPos, flight.toPos, ease);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, ease);
      camera.fov = THREE.MathUtils.lerp(flight.fromFov, flight.toFov, ease);
      camera.updateProjectionMatrix();
      if (rawT >= 1) flight.active = false;
    }

    if (keys.size > 0) {
      const speed = (keys.has('shift') ? 110 : 42) * dt;
      camera.getWorldDirection(fwd);
      right.crossVectors(fwd, camera.up).normalize();
      moveDelta.set(0, 0, 0);
      if (keys.has('w')) moveDelta.addScaledVector(fwd, speed);
      if (keys.has('s')) moveDelta.addScaledVector(fwd, -speed);
      if (keys.has('d')) moveDelta.addScaledVector(right, speed);
      if (keys.has('a')) moveDelta.addScaledVector(right, -speed);
      if (keys.has('e')) moveDelta.y += speed * 0.7;
      if (keys.has('q')) moveDelta.y -= speed * 0.7;

      camera.position.add(moveDelta);
      controls.target.add(moveDelta);
      if (camera.position.y < 1.2) camera.position.y = 1.2;
    }

    controls.update();

    skyDome.position.copy(camera.position);
    skyMat.uniforms.uTime.value = elapsed;

    vegetationSystem.update(elapsed);
    landmarksSystem.update(elapsed);
    citySystem.update(elapsed);
    maritimeSystem.update(elapsed);
    waterSystem.update(elapsed, maritimeSystem.ferryPos, maritimeSystem.ferryDir);

    // Pass 1: Real-Time HDR Planar Reflection + Dual-Pass Anisotropic Vertical Light Ribbons
    waterSystem.renderReflection(
      renderer,
      scene,
      camera,
      () => {
        terrainSystem.setClipPlane(-0.08);
        vegetationSystem.setClipPlane(-0.08);
      },
      () => {
        terrainSystem.setClipPlane(-1000.0);
        vegetationSystem.setClipPlane(-1000.0);
      }
    );

    // Pass 2: Main HDR Scene + Selective Bloom + ACES Filmic Grade
    postProcessor.render(elapsed);

    hud.updateLandmarkPins(camera, window.innerWidth, window.innerHeight);

    fpsFrames++;
    if (now - fpsTimer >= 500) {
      hud.updateFps((fpsFrames * 1000) / (now - fpsTimer));
      fpsFrames = 0;
      fpsTimer = now;
    }
  }

  renderOneFrame = renderFrame;
  function animate(now) {
    requestAnimationFrame(animate);
    renderFrame(now, false);
  }

  requestAnimationFrame(animate);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap Baía de Guanabara 3D:', err);
  if (loadingStatus) {
    loadingStatus.textContent = `Error: ${err.message}`;
  }
});
