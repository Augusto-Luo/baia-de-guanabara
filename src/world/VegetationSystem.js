import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  getTerrainHeight,
  getTerrainNormal,
  getUrbanMask,
  sampleCrescentCurve,
} from '../config/geography.js';
import { createFoliageMaterial } from '../shaders/foliageShader.js';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Lush volumetric 3D tropical rainforest tree crown built from 9 organically cupped botanical branch cards
// with spherical canopy lighting normals so every tree catches twilight rim light & inner AO seamlessly!
function buildVolumetricCanopyGeometry(spread = 1.0) {
  const parts = [];
  const cardConfigs = [
    { rx: -1.18, ry: 0.0, rz: 0.0, tx: 0.0, ty: 0.64, tz: 0.0, s: 1.04 },
    { rx: -0.72, ry: 0.55, rz: 0.14, tx: 0.22, ty: 0.48, tz: 0.24, s: 0.94 },
    { rx: -0.68, ry: 3.65, rz: -0.12, tx: -0.22, ty: 0.46, tz: -0.22, s: 0.92 },
    { rx: -0.45, ry: 0.0, rz: 0.1, tx: 0.0, ty: 0.16, tz: 0.32, s: 0.96 },
    { rx: -0.42, ry: 1.05, rz: -0.08, tx: 0.28, ty: 0.22, tz: 0.12, s: 0.94 },
    { rx: -0.48, ry: 2.10, rz: 0.06, tx: 0.22, ty: 0.16, tz: -0.24, s: 0.98 },
    { rx: -0.44, ry: 3.14, rz: -0.1, tx: -0.10, ty: 0.18, tz: -0.30, s: 0.95 },
    { rx: -0.46, ry: 4.19, rz: 0.08, tx: -0.28, ty: 0.20, tz: -0.10, s: 0.93 },
    { rx: -0.44, ry: 5.24, rz: -0.06, tx: -0.24, ty: 0.16, tz: 0.20, s: 0.92 },
  ];

  for (const cfg of cardConfigs) {
    const plane = new THREE.PlaneGeometry(1.92 * cfg.s * spread, 1.92 * cfg.s, 2, 2);
    const pos = plane.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const r2 = px * px + py * py;
      pos.setZ(i, -r2 * 0.17);
    }
    plane.rotateX(cfg.rx);
    plane.rotateZ(cfg.rz);
    plane.rotateY(cfg.ry);
    plane.translate(cfg.tx * spread, cfg.ty, cfg.tz * spread);
    parts.push(plane);
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();

  const pos = merged.attributes.position;
  const norm = merged.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i) - 0.04, pos.getZ(i));
    v.y += 0.44;
    v.normalize();
    norm.setXYZ(i, v.x, v.y, v.z);
  }
  norm.needsUpdate = true;
  return merged;
}

// Iconic umbrella-tiered Embaúba / Cecropia candelabra crown silhouette!
function buildCecropiaCrownGeometry() {
  const parts = [];
  const tiers = [
    { tx: 0.0, ty: 0.72, tz: 0.0, rx: -1.35, ry: 0.2, s: 1.05 },
    { tx: 0.42, ty: 0.56, tz: 0.22, rx: -1.12, ry: 1.4, s: 0.88 },
    { tx: -0.38, ty: 0.58, tz: 0.28, rx: -1.15, ry: 2.8, s: 0.90 },
    { tx: 0.14, ty: 0.50, tz: -0.44, rx: -1.10, ry: 4.1, s: 0.86 },
    { tx: -0.32, ty: 0.38, tz: -0.26, rx: -0.95, ry: 5.3, s: 0.82 },
    { tx: 0.26, ty: 0.34, tz: 0.08, rx: -0.82, ry: 0.8, s: 0.80 },
  ];
  for (const cfg of tiers) {
    const plane = new THREE.PlaneGeometry(1.75 * cfg.s, 1.75 * cfg.s, 2, 2);
    const pos = plane.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      pos.setZ(i, -(px * px + py * py) * 0.15);
    }
    plane.rotateX(cfg.rx);
    plane.rotateY(cfg.ry);
    plane.translate(cfg.tx, cfg.ty, cfg.tz);
    parts.push(plane);
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();

  const pos = merged.attributes.position;
  const norm = merged.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i) + 0.48, pos.getZ(i)).normalize();
    norm.setXYZ(i, v.x, v.y, v.z);
  }
  norm.needsUpdate = true;
  return merged;
}

// Sculpted multi-forked tropical tree trunk + diverging limbs for close-up foreground hero trees!
function buildBranchingTrunkGeometry() {
  const parts = [];
  // Main leaning root-flared trunk
  const main = new THREE.CylinderGeometry(0.11, 0.27, 1.0, 7, 5);
  main.translate(0, 0.5, 0);
  const pos = main.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) + Math.sin(y * 2.2) * 0.08);
    pos.setZ(i, pos.getZ(i) + Math.cos(y * 1.9) * 0.05);
  }
  main.computeVertexNormals();
  parts.push(main);

  // 3 forked upper structural limbs reaching into the canopy crown!
  const limbAngles = [0.2, 2.35, 4.45];
  for (let i = 0; i < limbAngles.length; i++) {
    const limb = new THREE.CylinderGeometry(0.045, 0.095, 0.62, 5, 2);
    limb.translate(0, 0.31, 0);
    limb.rotateZ(0.56);
    limb.rotateY(limbAngles[i]);
    limb.translate(0, 0.68 + i * 0.06, 0);
    parts.push(limb);
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

function buildPalmCrownGeometry() {
  const parts = [];
  const frondCount = 12;
  for (let f = 0; f < frondCount; f++) {
    const isUpper = f >= 7;
    const azimuth = (f / frondCount) * Math.PI * 2 + (isUpper ? 0.28 : 0.0);
    const frondLen = isUpper ? 2.45 : 3.15;
    const frondW = isUpper ? 1.15 : 1.38;

    const blade = new THREE.PlaneGeometry(frondW, frondLen, 2, 7);
    const pos = blade.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const yNorm = (pos.getY(i) + frondLen * 0.5) / frondLen;
      const archAngle = isUpper ? 0.42 : 0.72;
      const archY =
        Math.sin(yNorm * Math.PI * 0.68) * frondLen * (isUpper ? 0.58 : 0.42) -
        yNorm * yNorm * (isUpper ? 0.32 : 0.96);
      const archZ = yNorm * frondLen * (0.78 + archAngle * 0.18);
      const vFold = -Math.abs(x) * 0.17;
      pos.setXYZ(i, x, archY + vFold, archZ);
    }
    blade.computeVertexNormals();
    blade.rotateY(azimuth);
    parts.push(blade);
  }

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

// Graceful rosette of 8 arched Giant Tree Fern (Samambaia) fronds for lush foreground understory!
function buildFernRosetteGeometry() {
  const parts = [];
  const count = 8;
  for (let f = 0; f < count; f++) {
    const ang = (f / count) * Math.PI * 2 + (f % 2) * 0.22;
    const len = 1.65 + (f % 3) * 0.28;
    const wid = 0.72 + (f % 2) * 0.16;
    const blade = new THREE.PlaneGeometry(wid, len, 2, 6);
    const pos = blade.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const t = (pos.getY(i) + len * 0.5) / len;
      const archY = Math.sin(t * Math.PI * 0.74) * len * 0.42 - t * t * 0.26;
      const archZ = t * len * 0.88;
      const cup = -Math.abs(x) * 0.12;
      pos.setXYZ(i, x, archY + cup, archZ);
    }
    blade.computeVertexNormals();
    blade.rotateY(ang);
    parts.push(blade);
  }
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

function buildPalmTrunkGeometry() {
  const geom = new THREE.CylinderGeometry(0.10, 0.24, 1.0, 7, 7);
  geom.translate(0, 0.5, 0);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const lean = Math.sin(y * Math.PI * 0.65) * 0.14;
    pos.setX(i, pos.getX(i) + lean);
  }
  geom.computeVertexNormals();
  return geom;
}

function buildBoulderGeometry() {
  const geom = new THREE.IcosahedronGeometry(1.0, 2);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const disp =
      1.0 +
      0.20 * Math.sin(x * 3.1 + z * 2.4) +
      0.15 * Math.cos(y * 4.2 - x * 2.1);
    pos.setXYZ(i, x * disp * 1.28, y * disp * 0.70, z * disp * 1.08);
  }
  geom.computeVertexNormals();
  return geom;
}

export class VegetationSystem {
  constructor({ foliageTex, cecropiaTex, palmTex, understoryTex, barkTex, graniteTex, preset }) {
    this.group = new THREE.Group();
    this.group.name = 'VegetationSystem';

    this.foliageMat = createFoliageMaterial({
      map: foliageTex.map,
      normalMap: foliageTex.normalMap,
      preset,
      windAmp: 0.14,
      alphaTest: 0.42,
    });

    this.cecropiaMat = createFoliageMaterial({
      map: cecropiaTex.map,
      normalMap: cecropiaTex.normalMap,
      preset,
      windAmp: 0.16,
      alphaTest: 0.40,
    });

    this.palmMat = createFoliageMaterial({
      map: palmTex.map,
      normalMap: palmTex.normalMap,
      preset,
      windAmp: 0.24,
      alphaTest: 0.35,
    });

    this.understoryMat = createFoliageMaterial({
      map: understoryTex.map,
      normalMap: understoryTex.normalMap,
      preset,
      windAmp: 0.18,
      alphaTest: 0.36,
    });

    this.trunkMat = new THREE.MeshStandardMaterial({
      map: barkTex.map,
      normalMap: barkTex.normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.92,
      metalness: 0.0,
    });

    this.boulderMat = new THREE.MeshStandardMaterial({
      map: graniteTex.map,
      normalMap: graniteTex.normalMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 0.82,
      metalness: 0.05,
      color: new THREE.Color('#7c847c'),
      emissive: new THREE.Color('#1c2228'),
      emissiveIntensity: 0.28,
    });

    this._populateRainforestCanopy();
    this._populateTropicalPalms();
    this._populateForegroundUnderstoryAndBoulders();
  }

  _populateRainforestCanopy() {
    const rand = createRng(20260430);
    const broadCrownGeom = buildVolumetricCanopyGeometry(1.0);
    const cecropiaCrownGeom = buildCecropiaCrownGeometry();
    const trunkGeom = buildBranchingTrunkGeometry();

    const broadTrees = [];
    const cecropiaTrees = [];
    const trunks = [];

    const pickCanopyColor = (isForeground, isCecropia = false) => {
      const r = rand();
      const c = new THREE.Color();
      if (!isCecropia && r < 0.022 && isForeground) {
        // Authentic Rio Atlantic Forest Quaresmeira twilight purple-violet flowering crown!
        c.setHSL(0.79 + rand() * 0.05, 0.34, 0.30 + rand() * 0.10);
      } else if (isCecropia) {
        // Silvery-sage Embaúba canopy tint
        const h = 0.255 + (rand() - 0.5) * 0.05;
        const s = 0.34 + rand() * 0.16;
        const l = isForeground ? 0.36 + rand() * 0.18 : 0.28 + rand() * 0.14;
        c.setHSL(h, s, l);
      } else {
        // Rich deep Atlantic Forest emerald-olive chlorophyll variation
        const h = 0.268 + (rand() - 0.5) * 0.072;
        const s = 0.44 + rand() * 0.20;
        const l = isForeground ? 0.30 + rand() * 0.19 : 0.22 + rand() * 0.14;
        c.setHSL(h, s, l);
      }
      return c;
    };

    const pushTree = (entry, isCecropia) => {
      if (isCecropia) cecropiaTrees.push(entry);
      else broadTrees.push(entry);
      if (entry.hasTrunk) trunks.push(entry);
    };

    // --- ZONE 1: Lush Hero Foreground Parque da Cidade Corner Framing Slopes ---
    // Sweeps generously across both bottom-left & bottom-right triangles of the panorama (matching reference photo!)
    // while keeping the central sightline toward São Francisco town, beach & bay 100% open!
    let attempts = 0;
    let placedFg = 0;
    while (placedFg < 2400 && attempts < 14000) {
      attempts++;
      let x, z;
      const zonePick = rand();
      if (zonePick < 0.46) {
        x = -175 + rand() * 155;
        z = 142 + rand() * 94;
      } else if (zonePick < 0.92) {
        x = 20 + rand() * 158;
        z = 142 + rand() * 94;
      } else {
        x = -42 + rand() * 84;
        z = 190 + rand() * 26;
      }

      // Carve a graceful natural V-corridor down in front of the central lookout (0, 42.5, 224)
      const distFromLookoutZ = 216 - z;
      const vWindowHalfWidth = 18 + Math.max(0, distFromLookoutZ) * 0.54;
      if (Math.abs(x) < vWindowHalfWidth && z > 165 && z < 222) {
        continue;
      }
      // Keep camera lenses cleanly clear!
      if (Math.hypot(x, z - 224) < 14) continue;
      if (Math.hypot(x + 58, z - 196) < 9.5) continue;

      const y = getTerrainHeight(x, z);
      if (y < 4.2) continue;
      const n = getTerrainNormal(x, z, 0.8);
      if (n.y < 0.40) continue;
      if (getUrbanMask(x, z, y, n.y) > 0.32) continue;

      const isCecropia = rand() < 0.24;
      const scale = (1.85 + rand() * 2.75) * (z > 195 ? 0.84 : 1.0);
      pushTree(
        {
          x,
          y: y - 0.35,
          z,
          sx: scale * (0.9 + rand() * 0.28),
          sy: scale * (0.72 + rand() * 0.32),
          sz: scale * (0.9 + rand() * 0.28),
          rotY: rand() * Math.PI * 2,
          tiltX: (rand() - 0.5) * 0.16,
          tiltZ: (rand() - 0.5) * 0.16,
          color: pickCanopyColor(true, isCecropia),
          hasTrunk: z > 148,
        },
        isCecropia
      );
      placedFg++;
    }

    // --- ZONE 1B: Dedicated Cinematic Foreground Framing Canopy Wings (Exact Reference Photo Bottom-Left & Bottom-Right Diagonals!) ---
    const wingSpecs = [
      { xMin: -72, xMax: -12, zMin: 176, zMax: 220, count: 290 },
      { xMin: 12, xMax: 72, zMin: 176, zMax: 220, count: 290 },
    ];
    for (const wing of wingSpecs) {
      let placed = 0;
      let tries = 0;
      while (placed < wing.count && tries < 2600) {
        tries++;
        const x = wing.xMin + rand() * (wing.xMax - wing.xMin);
        const z = wing.zMin + rand() * (wing.zMax - wing.zMin);
        const zFrac = (z - 176) / 44; // 0 front -> 1 near camera
        const minAbsX = 31 - zFrac * 18.0;
        if (Math.abs(x) < minAbsX) continue;
        if (Math.hypot(x, z - 224) < 14.0) continue;
        if (Math.hypot(x + 52, z - 194) < 10.5) continue;

        const groundY = getTerrainHeight(x, z);
        const cascadeY = Math.max(groundY, 13.5 + zFrac * 19.8 + (Math.abs(x) - minAbsX) * 0.22);
        const isCecropia = rand() < 0.28;
        const sc = 2.2 + rand() * 2.6;
        pushTree(
          {
            x,
            y: cascadeY - 0.85,
            z,
            sx: sc * (0.94 + rand() * 0.26),
            sy: sc * (0.78 + rand() * 0.28),
            sz: sc * (0.94 + rand() * 0.26),
            rotY: rand() * Math.PI * 2,
            tiltX: (rand() - 0.5) * 0.16,
            tiltZ: (rand() - 0.5) * 0.16,
            color: pickCanopyColor(true, isCecropia),
            hasTrunk: true,
          },
          isCecropia
        );
        placed++;
      }
    }

    // --- ZONE 1C: Neighborhood Street & Garden Trees nestled among São Francisco & Charitas houses! ---
    // Breaks up urban blocks organically just like the real leafy Niterói coastal neighborhoods!
    let townTrees = 0;
    let tTries = 0;
    while (townTrees < 260 && tTries < 2200) {
      tTries++;
      const theta = 0.05 * Math.PI + rand() * 0.90 * Math.PI;
      const offset = 11.0 + rand() * 38.0;
      const pt = sampleCrescentCurve(theta)(offset);
      if (Math.hypot(pt.x, pt.z - 156) < 11.5) continue; // keep football pitch open
      if (pt.y < 1.2 || pt.y > 9.5) continue;
      const sc = 0.85 + rand() * 0.95;
      pushTree(
        {
          x: pt.x + (rand() - 0.5) * 2.5,
          y: pt.y - 0.2,
          z: pt.z + (rand() - 0.5) * 2.5,
          sx: sc,
          sy: sc * 0.88,
          sz: sc,
          rotY: rand() * Math.PI * 2,
          tiltX: 0,
          tiltZ: 0,
          color: pickCanopyColor(true, false),
          hasTrunk: true,
        },
        false
      );
      townTrees++;
    }

    // --- ZONE 2: Mid-Ground Headlands & Landmark Mountains (Tighter organic scales hugging ridges!) ---
    const midRegions = [
      // Morro do Morcego / Jurujuba headland (dense sleek tropical rainforest blanket, NOT oversized lumpy spheres!)
      { cx: -102, cz: -4, rx: 66, rz: 44, count: 520, minY: 2.5, maxY: 27, scaleMin: 1.6, scaleMax: 3.3 },
      { cx: -34, cz: -26, rx: 16, rz: 14, count: 110, minY: 2.2, maxY: 16, scaleMin: 1.3, scaleMax: 2.5 },
      { cx: 184, cz: 86, rx: 52, rz: 48, count: 240, minY: 5.5, maxY: 28, scaleMin: 2.2, scaleMax: 4.2 },
      { cx: 188, cz: -46, rx: 34, rz: 30, count: 160, minY: 6.5, maxY: 20, scaleMin: 2.0, scaleMax: 3.8 },
      // Ilha da Boa Viagem lush fringe & MAC cliff collar (keep MAC summit deck clean!)
      { cx: 84, cz: -42, rx: 6.5, rz: 5.8, count: 38, minY: 1.4, maxY: 6.8, scaleMin: 0.9, scaleMax: 1.75 },
      { cx: 105, cz: -34, rx: 13.5, rz: 12.5, count: 48, minY: 1.2, maxY: 5.6, scaleMin: 0.95, scaleMax: 1.75 },
      // Mid-bay island
      { cx: 42, cz: -98, rx: 13, rz: 9.5, count: 68, minY: 1.4, maxY: 9.5, scaleMin: 1.25, scaleMax: 2.3 },
      // Sugarloaf lower shoulders & Morro da Urca (strictly keeps sheer granite faces exposed!)
      { cx: -265, cz: -182, rx: 42, rz: 28, count: 320, minY: 2.8, maxY: 27, scaleMin: 1.7, scaleMax: 3.4 },
      // Corcovado lush Tijuca flanks
      { cx: -260, cz: -325, rx: 50, rz: 42, count: 340, minY: 14.0, maxY: 58, scaleMin: 2.4, scaleMax: 4.6 },
    ];

    for (const reg of midRegions) {
      let placed = 0;
      let tries = 0;
      while (placed < reg.count && tries < reg.count * 7) {
        tries++;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand());
        const x = reg.cx + Math.cos(a) * r * reg.rx;
        const z = reg.cz + Math.sin(a) * r * reg.rz;
        const y = getTerrainHeight(x, z);
        if (y < reg.minY || y > reg.maxY) continue;
        // Keep MAC cliff plaza & Morro da Urca Bondinho station visibly clear!
        if (Math.hypot(x - 105, z + 34) < 7.8 && y > 5.0) continue;
        if (Math.hypot(x + 278, z + 176) < 7.5 && y > 17.0) continue;
        const n = getTerrainNormal(x, z, 0.85);
        // Allow clinging lush scrub on Morro da Urca ledges while keeping sheer vertical Sugarloaf rock bare!
        const minNy = reg.cx < -230 && reg.cz > -210 ? 0.44 : 0.56;
        if (n.y < minNy) continue;
        if (getUrbanMask(x, z, y, n.y) > 0.36) continue;

        const isCecropia = rand() < 0.18;
        const sc = reg.scaleMin + rand() * (reg.scaleMax - reg.scaleMin);
        pushTree(
          {
            x,
            y: y - 0.4,
            z,
            sx: sc * (0.9 + rand() * 0.24),
            sy: sc * (0.72 + rand() * 0.28),
            sz: sc * (0.9 + rand() * 0.24),
            rotY: rand() * Math.PI * 2,
            tiltX: (rand() - 0.5) * 0.14,
            tiltZ: (rand() - 0.5) * 0.14,
            color: pickCanopyColor(false, isCecropia),
            hasTrunk: false,
          },
          isCecropia
        );
        placed++;
      }
    }

    const dummy = new THREE.Object3D();
    const mountInstancedCanopy = (list, geom, mat) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geom, mat, list.length);
      mesh.frustumCulled = false;
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        dummy.position.set(t.x, t.y + t.sy * 0.56, t.z);
        dummy.rotation.set(t.tiltX, t.rotY, t.tiltZ);
        dummy.scale.set(t.sx, t.sy, t.sz);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, t.color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
    };

    mountInstancedCanopy(broadTrees, broadCrownGeom, this.foliageMat);
    mountInstancedCanopy(cecropiaTrees, cecropiaCrownGeom, this.cecropiaMat);

    if (trunks.length > 0) {
      const trunkMesh = new THREE.InstancedMesh(trunkGeom, this.trunkMat, trunks.length);
      trunkMesh.frustumCulled = false;
      for (let i = 0; i < trunks.length; i++) {
        const t = trunks[i];
        dummy.position.set(t.x, t.y - 0.35, t.z);
        dummy.rotation.set(t.tiltX * 0.5, t.rotY, t.tiltZ * 0.5);
        dummy.scale.set(t.sx * 0.26, t.sy * 0.92, t.sz * 0.26);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);
      }
      trunkMesh.instanceMatrix.needsUpdate = true;
      this.group.add(trunkMesh);
    }
  }

  _populateTropicalPalms() {
    const rand = createRng(884211);
    const palms = [];

    // 1. Coastal Palm Promenade along Praia de São Francisco & Charitas!
    const beachPalmCount = 135;
    for (let i = 0; i < beachPalmCount; i++) {
      const t = i / (beachPalmCount - 1);
      const theta = 0.07 * Math.PI + t * 0.87 * Math.PI;
      const pt = sampleCrescentCurve(theta)(5.4 + (rand() - 0.5) * 2.0);
      if (pt.y < 0.7 || pt.y > 4.4) continue;
      palms.push({
        x: pt.x,
        y: pt.y - 0.1,
        z: pt.z,
        height: 2.1 + rand() * 1.4,
        crownScale: 0.58 + rand() * 0.24,
        rotY: rand() * Math.PI * 2,
        lean: (rand() - 0.5) * 0.18,
      });
    }

    // 2. Hero Foreground Rainforest Jerivá / Imperial Palms on Parque da Cidade framing ridges & Mata Atlântica showcase!
    for (let i = 0; i < 165; i++) {
      const side = rand() < 0.52 ? -1 : 1;
      const x = side * (30 + rand() * 118);
      const z = 154 + rand() * 68;
      if (Math.hypot(x + 58, z - 196) < 10) continue;
      const y = getTerrainHeight(x, z);
      if (y < 7.5) continue;
      const n = getTerrainNormal(x, z, 0.9);
      if (n.y < 0.50) continue;
      palms.push({
        x,
        y: y - 0.25,
        z,
        height: 3.6 + rand() * 2.6,
        crownScale: 0.88 + rand() * 0.38,
        rotY: rand() * Math.PI * 2,
        lean: (rand() - 0.5) * 0.22,
      });
    }

    // 3. Palms along Praia de Icaraí & Mirante da Boa Viagem promenade
    for (let i = 0; i < 46; i++) {
      const t = i / 45;
      const x = 116 + Math.sin(t * 2.5) * 6 + (rand() - 0.5) * 4;
      const z = 44 - t * 92;
      if (Math.hypot(x - 105, z + 34) < 13) continue;
      const y = getTerrainHeight(x, z);
      if (y < 0.6 || y > 4.2) continue;
      palms.push({
        x,
        y: y - 0.1,
        z,
        height: 2.0 + rand() * 1.3,
        crownScale: 0.58 + rand() * 0.22,
        rotY: rand() * Math.PI * 2,
        lean: (rand() - 0.5) * 0.14,
      });
    }

    const trunkGeom = buildPalmTrunkGeometry();
    const crownGeom = buildPalmCrownGeometry();

    const trunkMesh = new THREE.InstancedMesh(trunkGeom, this.trunkMat, palms.length);
    const crownMesh = new THREE.InstancedMesh(crownGeom, this.palmMat, palms.length);
    trunkMesh.frustumCulled = false;
    crownMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < palms.length; i++) {
      const p = palms[i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.lean, p.rotY, p.lean * 0.5);
      dummy.scale.set(p.crownScale * 0.88, p.height, p.crownScale * 0.88);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      const apexOffsetX = Math.sin(0.65 * Math.PI) * 0.14 * p.crownScale * 0.88;
      const cosY = Math.cos(p.rotY);
      const sinY = Math.sin(p.rotY);
      dummy.position.set(
        p.x + apexOffsetX * cosY,
        p.y + p.height * 0.98,
        p.z - apexOffsetX * sinY
      );
      dummy.rotation.set(p.lean * 0.6, p.rotY, p.lean * 0.3);
      dummy.scale.setScalar(p.crownScale);
      dummy.updateMatrix();
      crownMesh.setMatrixAt(i, dummy.matrix);

      color.setHSL(0.275 + (rand() - 0.5) * 0.04, 0.46 + rand() * 0.16, 0.36 + rand() * 0.14);
      crownMesh.setColorAt(i, color);
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
    if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;

    this.group.add(trunkMesh);
    this.group.add(crownMesh);
  }

  _populateForegroundUnderstoryAndBoulders() {
    const rand = createRng(55219);
    const fernGeom = buildFernRosetteGeometry();
    const boulderGeom = buildBoulderGeometry();

    const ferns = [];
    const boulders = [];

    // Dense tropical Giant Fern (Samambaia) rosettes carpeting foreground Parque da Cidade ridges & trailside!
    let attempts = 0;
    while (ferns.length < 480 && attempts < 3600) {
      attempts++;
      const side = rand() < 0.55 ? -1 : 1;
      const x = side * (22 + rand() * 105);
      const z = 160 + rand() * 64;
      if (Math.hypot(x, z - 224) < 13) continue;
      if (Math.hypot(x + 58, z - 196) < 6.5) continue;
      const y = getTerrainHeight(x, z);
      if (y < 6.5) continue;
      const n = getTerrainNormal(x, z, 0.8);
      if (n.y < 0.46) continue;
      ferns.push({
        x,
        y: y - 0.15,
        z,
        s: 0.85 + rand() * 1.45,
        rotY: rand() * Math.PI * 2,
        tiltX: (rand() - 0.5) * 0.25,
        tiltZ: (rand() - 0.5) * 0.25,
      });
    }

    // Mossy Rio granite boulders on foreground slopes & coastal cliffs (strictly keep Mata Atlântica camera clear!)
    for (let i = 0; i < 110; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const x = side * (30 + rand() * 98);
      const z = 168 + rand() * 54;
      if (Math.hypot(x + 52, z - 194) < 16) continue;
      if (Math.hypot(x, z - 224) < 16) continue;
      const y = getTerrainHeight(x, z);
      if (y < 7.5) continue;
      boulders.push({
        x,
        y: y - 0.35,
        z,
        s: 0.9 + rand() * 2.2,
        rx: rand() * Math.PI,
        ry: rand() * Math.PI * 2,
        rz: rand() * Math.PI,
      });
    }

    // Coastal sea boulders ringing the rocky granite base of Mirante da Boa Viagem (MAC) & Ilha da Boa Viagem!
    for (let i = 0; i < 38; i++) {
      const ang = (i / 38) * Math.PI * 2 + rand() * 0.2;
      const isMac = i < 24;
      const cx = isMac ? 105 : 84;
      const cz = isMac ? -34 : -42;
      const rad = (isMac ? 9.8 : 5.4) + rand() * 2.6;
      const bx = cx + Math.cos(ang) * rad;
      const bz = cz + Math.sin(ang) * rad;
      const by = getTerrainHeight(bx, bz);
      if (by > -1.2 && by < 3.8) {
        boulders.push({
          x: bx,
          y: Math.max(-0.3, by - 0.2),
          z: bz,
          s: 0.8 + rand() * 1.45,
          rx: rand() * Math.PI,
          ry: rand() * Math.PI * 2,
          rz: rand() * Math.PI,
        });
      }
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    if (ferns.length > 0) {
      const fernMesh = new THREE.InstancedMesh(fernGeom, this.understoryMat, ferns.length);
      fernMesh.frustumCulled = false;
      for (let i = 0; i < ferns.length; i++) {
        const f = ferns[i];
        dummy.position.set(f.x, f.y, f.z);
        dummy.rotation.set(f.tiltX, f.rotY, f.tiltZ);
        dummy.scale.setScalar(f.s);
        dummy.updateMatrix();
        fernMesh.setMatrixAt(i, dummy.matrix);
        color.setHSL(0.26 + (rand() - 0.5) * 0.05, 0.50 + rand() * 0.16, 0.35 + rand() * 0.16);
        fernMesh.setColorAt(i, color);
      }
      fernMesh.instanceMatrix.needsUpdate = true;
      if (fernMesh.instanceColor) fernMesh.instanceColor.needsUpdate = true;
      this.group.add(fernMesh);
    }

    if (boulders.length > 0) {
      const bMesh = new THREE.InstancedMesh(boulderGeom, this.boulderMat, boulders.length);
      bMesh.frustumCulled = false;
      for (let i = 0; i < boulders.length; i++) {
        const b = boulders[i];
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(b.rx, b.ry, b.rz);
        dummy.scale.set(b.s * 1.12, b.s * 0.78, b.s);
        dummy.updateMatrix();
        bMesh.setMatrixAt(i, dummy.matrix);
      }
      bMesh.instanceMatrix.needsUpdate = true;
      this.group.add(bMesh);
    }
  }

  update(elapsed) {
    this.foliageMat.uniforms.uTime.value = elapsed;
    this.cecropiaMat.uniforms.uTime.value = elapsed;
    this.palmMat.uniforms.uTime.value = elapsed;
    this.understoryMat.uniforms.uTime.value = elapsed;
  }

  setWindStrength(wind) {
    this.foliageMat.uniforms.uWindAmp.value = 0.07 + wind * 0.28;
    this.cecropiaMat.uniforms.uWindAmp.value = 0.09 + wind * 0.32;
    this.palmMat.uniforms.uWindAmp.value = 0.13 + wind * 0.42;
    this.understoryMat.uniforms.uWindAmp.value = 0.08 + wind * 0.30;
  }

  setClipPlane(y) {
    this.foliageMat.uniforms.uClipPlaneY.value = y;
    this.cecropiaMat.uniforms.uClipPlaneY.value = y;
    this.palmMat.uniforms.uClipPlaneY.value = y;
    this.understoryMat.uniforms.uClipPlaneY.value = y;
  }

  applyPreset(preset) {
    for (const mat of [this.foliageMat, this.cecropiaMat, this.palmMat, this.understoryMat]) {
      const u = mat.uniforms;
      u.uSunDir.value.copy(preset.sunDir);
      u.uSunColor.value.copy(preset.sunLightColor);
      u.uSunIntensity.value = preset.sunLightIntensity;
      u.uHemiSky.value.copy(preset.hemiSkyColor);
      u.uHemiGround.value.copy(preset.hemiGroundColor);
      u.uHemiIntensity.value = preset.hemiIntensity;
      u.uFogCool.value.copy(preset.fogCool);
      u.uFogWarm.value.copy(preset.fogWarm);
      u.uFogDensity.value = preset.fogDensity;
      u.uCityBounce.value.copy(preset.cityBounceColor);
      u.uCityEmissive.value = preset.cityEmissiveScale;
    }
  }
}
