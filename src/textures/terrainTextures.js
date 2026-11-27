import * as THREE from 'three';

function hash2(x, y, px, py) {
  const ix = ((x % px) + px) % px;
  const iy = ((y % py) + py) % py;
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function tileNoiseAniso(u, v, periodX, periodY) {
  const x = u * periodX;
  const y = v * periodY;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, periodX, periodY);
  const b = hash2(ix + 1, iy, periodX, periodY);
  const c = hash2(ix, iy + 1, periodX, periodY);
  const d = hash2(ix + 1, iy + 1, periodX, periodY);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function tileFbmAniso(u, v, px, py, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * tileNoiseAniso(u, v, px, py);
    norm += amp;
    px *= 2;
    py *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

function tileFbm(u, v, basePeriod, octaves = 4) {
  return tileFbmAniso(u, v, basePeriod, basePeriod, octaves);
}

function buildNormalFromHeight(heightField, size, strength) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      // Sobel 3x3 gradient for smoother, alias-free tangent normals!
      const tl = heightField[ym * size + xm];
      const t = heightField[ym * size + x];
      const tr = heightField[ym * size + xp];
      const l = heightField[y * size + xm];
      const r = heightField[y * size + xp];
      const bl = heightField[yp * size + xm];
      const b = heightField[yp * size + x];
      const br = heightField[yp * size + xp];

      const dx = ((tl + 2 * l + bl) - (tr + 2 * r + br)) * 0.25 * strength;
      const dy = ((tl + 2 * t + tr) - (bl + 2 * b + br)) * 0.25 * strength;
      const dz = 1.0;
      const inv = 1.0 / Math.hypot(dx, dy, dz);
      const i = (y * size + x) * 4;
      data[i] = Math.round((dx * inv * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function createForestTerrainTextures() {
  const size = 512;
  const colorData = new Uint8Array(size * size * 4);
  const hField = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const crowns = tileFbm(u, v, 12, 4);
      const midClump = tileFbm(u + 0.31, v + 0.17, 28, 3);
      const microLeaf = tileFbm(u + 0.67, v + 0.43, 64, 2);

      // Sharpened individual canopy mound bumps for rich distant Atlantic rainforest texture
      const crownHeight = Math.pow(crowns, 0.9) * 0.58 + Math.pow(midClump, 1.1) * 0.30 + microLeaf * 0.12;
      hField[y * size + x] = crownHeight;

      const idx = (y * size + x) * 4;
      const shade = 0.46 + crownHeight * 0.92;
      const warmVar = tileNoiseAniso(u + 0.12, v + 0.58, 16, 16);

      const r = Math.min(255, Math.round((19 + warmVar * 14 + microLeaf * 11) * shade));
      const g = Math.min(255, Math.round((43 + warmVar * 13 + crowns * 22 + microLeaf * 16) * shade));
      const b = Math.min(255, Math.round((18 + (1 - warmVar) * 9 + microLeaf * 8) * shade));

      colorData[idx] = r;
      colorData[idx + 1] = g;
      colorData[idx + 2] = b;
      colorData[idx + 3] = 255;
    }
  }

  const map = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;

  const normalMap = buildNormalFromHeight(hField, size, 5.6);
  return { map, normalMap };
}

// 100% Seamlessly Tileable Rio Striated Granite Gneiss (characteristic vertical black rainwater weathering & pale feldspar streaks!)
export function createGraniteTextures() {
  const size = 512;
  const colorData = new Uint8Array(size * size * 4);
  const hField = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      // Truly periodic vertical rainwater streaks (periodX=32, periodY=4) — ZERO seams!
      const verticalStreaks = tileFbmAniso(u, v, 32, 4, 4);
      const fineStreaks = tileFbmAniso(u + 0.23, v + 0.11, 64, 8, 3);
      const cracks = tileFbmAniso(u + verticalStreaks * 0.04, v, 14, 14, 4);
      const mineralGrain = tileFbm(u + 0.4, v + 0.7, 56, 3);

      const h = cracks * 0.50 + verticalStreaks * 0.22 + fineStreaks * 0.10 + mineralGrain * 0.18;
      hField[y * size + x] = h;

      const streakDark = Math.pow(verticalStreaks * 0.72 + fineStreaks * 0.28, 1.35);
      const base = 36 + (1.0 - streakDark) * 86 + (mineralGrain - 0.5) * 28;

      const idx = (y * size + x) * 4;
      colorData[idx] = Math.max(16, Math.min(255, Math.round(base * 1.04)));
      colorData[idx + 1] = Math.max(16, Math.min(255, Math.round(base * 0.99)));
      colorData[idx + 2] = Math.max(18, Math.min(255, Math.round(base * 1.01)));
      colorData[idx + 3] = 255;
    }
  }

  const map = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;

  const normalMap = buildNormalFromHeight(hField, size, 6.2);
  return { map, normalMap };
}

// Synthesize TWO independent seamless FFT-inspired ocean/bay wave normal maps:
// 1. swellNormal: directional multi-component bay swell + mid-scale wavelets
// 2. capillaryNormal: ultra-crisp high-frequency wind ripples & directional capillary ridges
export function createWaterNormalTextures() {
  const size = 512;
  const swellH = new Float32Array(size * size);
  const capH = new Float32Array(size * size);

  // Predefined periodic wave vectors (integer kX, kY guarantees 100% seamless tiling!)
  const swellWaves = [
    { kx: 3, ky: 2, amp: 0.22, ph: 0.4 },
    { kx: -2, ky: 5, amp: 0.17, ph: 1.7 },
    { kx: 5, ky: -3, amp: 0.13, ph: 2.9 },
    { kx: -4, ky: -4, amp: 0.10, ph: 4.1 },
    { kx: 7, ky: 4, amp: 0.075, ph: 0.8 },
    { kx: -6, ky: 7, amp: 0.065, ph: 3.5 },
    { kx: 9, ky: -6, amp: 0.05, ph: 5.2 },
    { kx: -8, ky: -7, amp: 0.045, ph: 1.2 },
  ];

  const capWaves = [
    { kx: 11, ky: 6, amp: 0.14, ph: 0.6 },
    { kx: -9, ky: 14, amp: 0.12, ph: 2.1 },
    { kx: 16, ky: -11, amp: 0.10, ph: 3.8 },
    { kx: -15, ky: -12, amp: 0.09, ph: 5.1 },
    { kx: 22, ky: 15, amp: 0.07, ph: 1.3 },
    { kx: -21, ky: 19, amp: 0.065, ph: 4.4 },
    { kx: 29, ky: -20, amp: 0.05, ph: 2.7 },
    { kx: -26, ky: -25, amp: 0.045, ph: 0.2 },
  ];

  const TWO_PI = Math.PI * 2.0;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      // Gerstner-sharpened periodic swells
      let s = 0;
      for (let i = 0; i < swellWaves.length; i++) {
        const w = swellWaves[i];
        const phase = (u * w.kx + v * w.ky) * TWO_PI + w.ph;
        // Slight crest sharpening via trochoidal harmonic
        s += w.amp * (Math.sin(phase) + 0.16 * Math.sin(phase * 2.0));
      }
      s += tileFbmAniso(u, v, 16, 12, 4) * 0.36;
      swellH[y * size + x] = s;

      // Directional high-frequency capillary ripples (stretched slightly along cross-wind axis)
      let c = 0;
      for (let i = 0; i < capWaves.length; i++) {
        const w = capWaves[i];
        const phase = (u * w.kx + v * w.ky) * TWO_PI + w.ph;
        c += w.amp * Math.sin(phase);
      }
      c += tileFbmAniso(u + 0.37, v + 0.19, 32, 48, 3) * 0.32;
      capH[y * size + x] = c;
    }
  }

  return {
    swellNormal: buildNormalFromHeight(swellH, size, 3.6),
    capillaryNormal: buildNormalFromHeight(capH, size, 4.4),
  };
}

// Keep backward-compatible helper alias if needed
export function createWaterNormalTexture() {
  return createWaterNormalTextures().swellNormal;
}
