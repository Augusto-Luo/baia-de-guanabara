import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  getTerrainHeight,
  getTerrainNormal,
  getUrbanMask,
  sampleCrescentCurve,
} from '../config/geography.js';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Build a stepped Brazilian modernist apartment tower (main block + penthouse/elevator rooftop cap!)
function buildSteppedTowerGeometry() {
  const main = new THREE.BoxGeometry(1.0, 0.92, 1.0);
  main.translate(0, 0.46, 0);
  const pent = new THREE.BoxGeometry(0.54, 0.14, 0.54);
  pent.translate(0.08, 0.96, -0.06);
  // Keep BoxGeometry 6 material groups cleanly mapped by using plain Box for multi-mat shaft
  // and instancing a separate architectural rooftop penthouse/parapet pass!
  main.dispose();
  pent.dispose();
  const base = new THREE.BoxGeometry(1, 1, 1);
  base.translate(0, 0.5, 0);
  return base;
}

// Build a pitched hipped roof for coastal Brazilian villas (telha cerâmica!)
function buildPitchedRoofGeometry() {
  const cone = new THREE.ConeGeometry(0.76, 0.36, 4);
  cone.rotateY(Math.PI * 0.25);
  cone.translate(0, 0.18, 0);
  return cone;
}

// Build a slender curved waterfront lamppost pole (Av. Quintino Bocaiúva & Icaraí promenade!)
function buildLamppostPoleGeometry() {
  const shaft = new THREE.CylinderGeometry(0.028, 0.048, 1.15, 5);
  shaft.translate(0, 0.575, 0);
  const arm = new THREE.BoxGeometry(0.32, 0.032, 0.032);
  arm.translate(0.14, 1.14, 0);
  const merged = mergeGeometries([shaft, arm], false);
  shaft.dispose();
  arm.dispose();
  return merged;
}

// AAA Photorealistic Coastal Urban Fabric of Niterói & Rio de Janeiro:
// - 3 distinct Brazilian architectural archetypes:
//   1. Modernist cream/concrete beachfront apartment blocks (with rooftop penthouses & water towers!)
//   2. Sleek twilight glass commercial & medical towers (Centro Rio, Centro Niterói, São Francisco right promenade)
//   3. Terracotta pitched-roof coastal houses & villas nestled in leafy inner neighborhoods
// - Grounded 3D lamppost poles lining Av. Quintino Bocaiúva & Icaraí (ZERO floating hillside orbs!)
// - Refined floodlit emerald football pitch & animated dual-lane coastal avenue traffic!
export class CitySystem {
  constructor({ facadeTex, glowTex, pitchTex, preset }) {
    this.group = new THREE.Group();
    this.group.name = 'CitySystem';
    this.glowTex = glowTex;
    this.emissiveMats = [];

    this.concreteRoofMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a4e5c'),
      emissive: new THREE.Color('#2a2018'),
      emissiveIntensity: 0.36, // Subtle warm upward urban twilight ambient bounce on rooftops!
      roughness: 0.86,
      metalness: 0.06,
    });
    this.emissiveMats.push({ mat: this.concreteRoofMat, base: 0.36 });

    this.terracottaRoofMat = new THREE.MeshStandardMaterial({
      map: facadeTex.terracottaRoof,
      color: new THREE.Color('#ba6e4c'),
      emissive: new THREE.Color('#422012'),
      emissiveIntensity: 0.42, // Warm Brazilian clay tile glow under golden neighborhood streetlamps!
      roughness: 0.82,
      metalness: 0.02,
    });
    this.emissiveMats.push({ mat: this.terracottaRoofMat, base: 0.42 });

    this.aptSideMat = new THREE.MeshStandardMaterial({
      map: facadeTex.apartment.map,
      emissiveMap: facadeTex.apartment.emissiveMap,
      emissive: new THREE.Color('#ffc274'),
      emissiveIntensity: 1.24,
      color: new THREE.Color('#b8b4ae'),
      roughness: 0.70,
      metalness: 0.08,
    });
    this.emissiveMats.push({ mat: this.aptSideMat, base: 1.24 });

    this.glassSideMat = new THREE.MeshStandardMaterial({
      map: facadeTex.glassTower.map,
      emissiveMap: facadeTex.glassTower.emissiveMap,
      emissive: new THREE.Color('#ffe2b8'),
      emissiveIntensity: 1.35,
      roughness: 0.28,
      metalness: 0.52,
    });
    this.emissiveMats.push({ mat: this.glassSideMat, base: 1.35 });

    this.villaSideMat = new THREE.MeshStandardMaterial({
      map: facadeTex.villa.map,
      emissiveMap: facadeTex.villa.emissiveMap,
      emissive: new THREE.Color('#ffb45c'),
      emissiveIntensity: 1.08,
      roughness: 0.82,
      metalness: 0.04,
    });
    this.emissiveMats.push({ mat: this.villaSideMat, base: 1.08 });

    this.rioTowerMat = new THREE.MeshStandardMaterial({
      map: facadeTex.glassTower.map,
      emissiveMap: facadeTex.glassTower.emissiveMap,
      emissive: new THREE.Color('#ffd08a'),
      emissiveIntensity: 1.55,
      roughness: 0.42,
      metalness: 0.38,
    });
    this.emissiveMats.push({ mat: this.rioTowerMat, base: 1.55 });

    // Multi-material Box arrays: [+x, -x, +y (dark concrete roof!), -y, +z, -z]
    this.aptMaterials = [
      this.aptSideMat,
      this.aptSideMat,
      this.concreteRoofMat,
      this.concreteRoofMat,
      this.aptSideMat,
      this.aptSideMat,
    ];
    this.glassMaterials = [
      this.glassSideMat,
      this.glassSideMat,
      this.concreteRoofMat,
      this.concreteRoofMat,
      this.glassSideMat,
      this.glassSideMat,
    ];
    this.villaMaterials = [
      this.villaSideMat,
      this.villaSideMat,
      this.concreteRoofMat,
      this.concreteRoofMat,
      this.villaSideMat,
      this.villaSideMat,
    ];
    this.rioMaterials = [
      this.rioTowerMat,
      this.rioTowerMat,
      this.concreteRoofMat,
      this.concreteRoofMat,
      this.rioTowerMat,
      this.rioTowerMat,
    ];

    this.lampHdrMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 1.44, 0.44),
    });

    this.whiteLampMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.2, 2.08, 1.78),
    });

    this.poleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2c323e'),
      roughness: 0.55,
      metalness: 0.6,
    });

    this._buildUrbanBuildings();
    this._buildCoastalAvenueLightsAndTraffic();
    this._buildForegroundFootballPitch(pitchTex);
    this._buildRioWaterfrontLights();

    this.applyPreset(preset);
  }

  _buildUrbanBuildings() {
    const rand = createRng(11272026);
    const apartments = [];
    const glassTowers = [];
    const villas = [];
    const rioBuildings = [];
    const penthouses = [];

    const isClearZone = (x, z) => {
      if (Math.hypot(x - 105, z + 34) < 20.5) return false; // Keep Mirante da Boa Viagem cliff around MAC scenic!
      if (Math.hypot(x - 84, z + 42) < 11.5) return false;  // Keep Ilha da Boa Viagem clear!
      if (Math.hypot(x - 0, z - 156) < 11.2) return false;  // Keep foreground São Francisco football pitch clear!
      return true;
    };

    // --- ZONE 1: Foreground São Francisco & Charitas Neighborhood (wrapping continuously all around the cove!) ---
    let tries = 0;
    let fgCount = 0;
    while (fgCount < 1380 && tries < 13000) {
      tries++;
      const theta = 0.02 * Math.PI + rand() * 0.96 * Math.PI;
      const sideFactor = Math.abs(Math.cos(theta)); // 1 on left/right curves, 0 at bottom center
      // Hug closer to the waterline on the curving left/right flanks so ZERO bare dark gap ever appears!
      const minOff = 9.2 - sideFactor * 5.2;
      const offset = minOff + Math.pow(rand(), 0.82) * 44.0;
      const pt = sampleCrescentCurve(theta)(offset);
      const x = pt.x + (rand() - 0.5) * 2.6;
      const z = pt.z + (rand() - 0.5) * 2.6;
      if (!isClearZone(x, z)) continue;

      const y = getTerrainHeight(x, z);
      if (y < 0.72 || y > 9.8) continue;
      const n = getTerrainNormal(x, z, 0.8);
      if (n.y < 0.72) continue;

      const isBeachfront = offset < 19.5;
      const isRightDistrict = x > 18.0; // Signature modern commercial/medical district at bottom-right of photo!
      const rotY = Math.atan2(x + 4, z - 52) + (rand() - 0.5) * 0.16;

      if (isBeachfront && isRightDistrict && rand() < 0.46) {
        const w = 1.6 + rand() * 1.9;
        const d = 1.5 + rand() * 1.6;
        const h = 2.6 + rand() * 4.2;
        glassTowers.push({ x, y: y - 0.35, z, w, h, d, rotY, tint: 0.78 + rand() * 0.30 });
        penthouses.push({ x, y: y - 0.35 + h, z, w: w * 0.52, h: 0.45 + rand() * 0.35, d: d * 0.52, rotY });
      } else if (isBeachfront || rand() < 0.34) {
        const w = 1.25 + rand() * 1.65;
        const d = 1.2 + rand() * 1.45;
        const h = isBeachfront ? 1.8 + rand() * 2.9 : 1.15 + rand() * 1.85;
        apartments.push({ x, y: y - 0.35, z, w, h, d, rotY, tint: 0.74 + rand() * 0.34 });
        if (h > 2.2) {
          penthouses.push({ x, y: y - 0.35 + h, z, w: w * 0.48, h: 0.38, d: d * 0.48, rotY });
        }
      } else {
        // Authentic cozy terracotta-roofed Brazilian coastal villas!
        const w = 0.95 + rand() * 1.15;
        const d = 0.95 + rand() * 1.15;
        const h = 0.65 + rand() * 0.95;
        villas.push({ x, y: y - 0.32, z, w, h, d, rotY, tint: 0.76 + rand() * 0.32 });
      }
      fgCount++;
    }

    // --- ZONE 2: Jurujuba Cozy Coastal Fishing Village tucked beneath Morro do Morcego ---
    tries = 0;
    let jurujubaCount = 0;
    while (jurujubaCount < 175 && tries < 2000) {
      tries++;
      const t = rand();
      const x = -118 + t * 62 + (rand() - 0.5) * 13;
      const z = 44 - t * 32 + (rand() - 0.5) * 11;
      const y = getTerrainHeight(x, z);
      if (y < 0.85 || y > 5.8) continue;
      const n = getTerrainNormal(x, z, 0.8);
      if (n.y < 0.75) continue;

      villas.push({
        x,
        y: y - 0.32,
        z,
        w: 0.95 + rand() * 1.25,
        h: 0.68 + rand() * 1.25,
        d: 0.95 + rand() * 1.15,
        rotY: rand() * Math.PI,
        tint: 0.78 + rand() * 0.3,
      });
      jurujubaCount++;
    }

    // --- ZONE 3: Icaraí, Ingá, Gragoatá & Centro de Niterói Illuminated High-Rise Skyline ---
    tries = 0;
    let niteroiSkyCount = 0;
    while (niteroiSkyCount < 880 && tries < 8000) {
      tries++;
      const x = 66 + rand() * 195;
      const z = -152 + rand() * 215;
      if (!isClearZone(x, z)) continue;
      const y = getTerrainHeight(x, z);
      if (y < 0.85 || y > 7.6) continue;
      const n = getTerrainNormal(x, z, 0.9);
      if (n.y < 0.78) continue;
      if (getUrbanMask(x, z, y, n.y) < 0.32) continue;

      const isHighRiseCore =
        (x > 116 && x < 174 && z > -22 && z < 48) ||
        (x > 80 && x < 188 && z > -130 && z < -54);
      const isTall = isHighRiseCore && rand() < 0.44;
      const rotY = (rand() - 0.5) * 0.25 + Math.floor(rand() * 4) * (Math.PI * 0.5);

      const w = isTall ? 1.65 + rand() * 1.85 : 1.15 + rand() * 1.55;
      const d = isTall ? 1.65 + rand() * 1.85 : 1.15 + rand() * 1.45;
      const h = isTall ? 3.5 + rand() * 6.8 : 1.1 + rand() * 2.5;
      const entry = { x, y: y - 0.35, z, w, h, d, rotY, tint: 0.72 + rand() * 0.34 };

      if (isTall && rand() < 0.35) {
        glassTowers.push(entry);
        penthouses.push({ x, y: y - 0.35 + h, z, w: w * 0.5, h: 0.65, d: d * 0.5, rotY });
      } else if (isTall || rand() < 0.68) {
        apartments.push(entry);
        if (isTall) penthouses.push({ x, y: y - 0.35 + h, z, w: w * 0.48, h: 0.52, d: d * 0.48, rotY });
      } else {
        villas.push({ ...entry, h: Math.min(entry.h, 1.35) });
      }
      niteroiSkyCount++;
    }

    // --- ZONE 4: Rio de Janeiro Waterfront Skyline (Botafogo, Flamengo, Glória, Centro, Porto Maravilha) ---
    tries = 0;
    while (rioBuildings.length < 760 && tries < 8500) {
      tries++;
      const x = -265 + rand() * 375;
      const z = -445 + rand() * 235;
      const y = getTerrainHeight(x, z);
      if (y < 0.8 || y > 7.6) continue;
      const n = getTerrainNormal(x, z, 1.0);
      if (n.y < 0.80) continue;
      if (getUrbanMask(x, z, y, n.y) < 0.34) continue;

      const isCentro = x > -108 && x < 28 && z > -380 && z < -265;
      const isBotafogo = x > -245 && x < -130 && z > -295 && z < -215;
      const isTower = (isCentro && rand() < 0.44) || (isBotafogo && rand() < 0.34);

      const w = isTower ? 2.1 + rand() * 2.4 : 1.5 + rand() * 2.0;
      const d = isTower ? 2.1 + rand() * 2.4 : 1.5 + rand() * 2.0;
      const h = isTower ? 4.8 + rand() * 10.2 : 1.4 + rand() * 3.2;

      rioBuildings.push({
        x,
        y: y - 0.35,
        z,
        w,
        h,
        d,
        rotY: Math.floor(rand() * 4) * (Math.PI * 0.5) + (rand() - 0.5) * 0.2,
        tint: 0.74 + rand() * 0.32,
      });
    }

    const boxGeom = buildSteppedTowerGeometry();
    const roofGeom = buildPitchedRoofGeometry();

    const buildInstancedCity = (list, mats, warmBias = [1.0, 0.96, 0.92]) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(boxGeom, mats, list.length);
      mesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        dummy.position.set(b.x, b.y, b.z);
        dummy.rotation.set(0, b.rotY, 0);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        col.setRGB(b.tint * warmBias[0], b.tint * warmBias[1], b.tint * warmBias[2]);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
    };

    buildInstancedCity(apartments, this.aptMaterials, [1.04, 0.99, 0.93]);
    buildInstancedCity(glassTowers, this.glassMaterials, [0.92, 0.98, 1.06]);
    buildInstancedCity(villas, this.villaMaterials, [1.05, 0.96, 0.88]);
    buildInstancedCity(rioBuildings, this.rioMaterials, [1.02, 0.98, 0.96]);

    // Mount authentic pitched clay-tile terracotta roofs on every Brazilian coastal villa!
    if (villas.length > 0) {
      const roofMesh = new THREE.InstancedMesh(roofGeom, this.terracottaRoofMat, villas.length);
      roofMesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      for (let i = 0; i < villas.length; i++) {
        const v = villas[i];
        dummy.position.set(v.x, v.y + v.h, v.z);
        dummy.rotation.set(0, v.rotY, 0);
        dummy.scale.set(v.w * 1.08, 0.55 + (i % 4) * 0.14, v.d * 1.08);
        dummy.updateMatrix();
        roofMesh.setMatrixAt(i, dummy.matrix);
        const shade = 0.72 + (i % 5) * 0.09;
        col.setRGB(shade * 1.05, shade * 0.86, shade * 0.78);
        roofMesh.setColorAt(i, col);
      }
      roofMesh.instanceMatrix.needsUpdate = true;
      if (roofMesh.instanceColor) roofMesh.instanceColor.needsUpdate = true;
      this.group.add(roofMesh);
    }

    // Mount architectural concrete rooftop penthouses & elevator cores on apartment & glass towers!
    if (penthouses.length > 0) {
      const pentMesh = new THREE.InstancedMesh(boxGeom, this.concreteRoofMat, penthouses.length);
      pentMesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < penthouses.length; i++) {
        const p = penthouses[i];
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rotY, 0);
        dummy.scale.set(p.w, p.h, p.d);
        dummy.updateMatrix();
        pentMesh.setMatrixAt(i, dummy.matrix);
      }
      pentMesh.instanceMatrix.needsUpdate = true;
      this.group.add(pentMesh);
    }
  }

  // Sweeping Golden Sodium-Vapor Streetlamp Promenade + 3D Lamppost Poles + Grounded Urban Lights (ZERO Floating Hill Balls!)
  _buildCoastalAvenueLightsAndTraffic() {
    const rand = createRng(777333);
    const amberPoints = [];
    const whitePoints = [];
    const polePlacements = [];

    const crescentCurvePts = [];
    const countCrescent = 152;
    for (let i = 0; i < countCrescent; i++) {
      const t = i / (countCrescent - 1);
      const theta = 0.08 * Math.PI + t * 0.84 * Math.PI;
      // Hug cleanly along the exact curved beachfront promenade (closer to shore on curving left/right flanks!)
      const sideFactor = Math.abs(Math.cos(theta));
      const roadOffset = 7.0 - sideFactor * 4.2;
      const pt = sampleCrescentCurve(theta)(roadOffset);
      if (pt.y < 0.45) continue;
      crescentCurvePts.push(new THREE.Vector3(pt.x, pt.y + 0.30, pt.z));
      amberPoints.push(new THREE.Vector3(pt.x, pt.y + 1.15, pt.z));
      polePlacements.push({
        x: pt.x,
        y: pt.y,
        z: pt.z,
        yaw: Math.atan2(-4 - pt.x, 52 - pt.z),
      });

      // Secondary neighborhood street rings (strictly checked against flat urban elevation!)
      if (i % 2 === 0) {
        const pt2 = sampleCrescentCurve(theta)(17.5 + (rand() - 0.5) * 3.5);
        const n2 = getTerrainNormal(pt2.x, pt2.z, 0.8);
        if (pt2.y > 0.85 && pt2.y < 7.8 && n2.y > 0.78) {
          amberPoints.push(new THREE.Vector3(pt2.x, pt2.y + 1.12, pt2.z));
        }
      }
      if (i % 2 === 1) {
        const pt3 = sampleCrescentCurve(theta)(29.5 + (rand() - 0.5) * 6.0);
        const n3 = getTerrainNormal(pt3.x, pt3.z, 0.8);
        if (pt3.y > 1.0 && pt3.y < 8.5 && n3.y > 0.78) {
          (rand() < 0.78 ? amberPoints : whitePoints).push(
            new THREE.Vector3(pt3.x, pt3.y + 1.1, pt3.z)
          );
        }
      }
      if (i % 3 === 0) {
        const pt4 = sampleCrescentCurve(theta)(41.5 + (rand() - 0.5) * 7.0);
        const n4 = getTerrainNormal(pt4.x, pt4.z, 0.8);
        if (pt4.y > 1.2 && pt4.y < 8.8 && n4.y > 0.78) {
          amberPoints.push(new THREE.Vector3(pt4.x, pt4.y + 1.05, pt4.z));
        }
      }
    }

    // 3D Slender Metal Lamppost Poles along Av. Quintino Bocaiúva!
    if (polePlacements.length > 0) {
      const poleGeom = buildLamppostPoleGeometry();
      const poleMesh = new THREE.InstancedMesh(poleGeom, this.poleMat, polePlacements.length);
      poleMesh.frustumCulled = false;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < polePlacements.length; i++) {
        const p = polePlacements[i];
        dummy.position.set(p.x, p.y - 0.05, p.z);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.setScalar(1.0);
        dummy.updateMatrix();
        poleMesh.setMatrixAt(i, dummy.matrix);
      }
      poleMesh.instanceMatrix.needsUpdate = true;
      this.group.add(poleMesh);
    }

    // Smooth dual-lane animated evening traffic gliding along Av. Quintino Bocaiúva!
    if (crescentCurvePts.length > 6) {
      this.avenueCurve = new THREE.CatmullRomCurve3(crescentCurvePts);
      const roadCars = 68;
      const carGeom = new THREE.BoxGeometry(0.28, 0.16, 0.58);
      const carMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      this.avenueCarsMesh = new THREE.InstancedMesh(carGeom, carMat, roadCars);
      this.avenueCarsMesh.frustumCulled = false;

      this.avenueCars = [];
      const hCol = new THREE.Color(2.4, 2.1, 1.55);
      const tCol = new THREE.Color(2.3, 0.25, 0.14);
      for (let i = 0; i < roadCars; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        this.avenueCars.push({
          t: (i / roadCars + rand() * 0.08) % 1,
          speed: (0.012 + rand() * 0.006) * dir,
          laneOffset: dir * 0.45,
        });
        this.avenueCarsMesh.setColorAt(i, dir > 0 ? hCol : tCol);
      }
      if (this.avenueCarsMesh.instanceColor) this.avenueCarsMesh.instanceColor.needsUpdate = true;
      this.group.add(this.avenueCarsMesh);
    }

    // Jurujuba Cove Shoreline Streetlamps (strictly grounded on low village shelf!)
    for (let i = 0; i < 36; i++) {
      const t = i / 35;
      const x = -114 + t * 58;
      const z = 40 - t * 28 + Math.sin(t * Math.PI) * 5;
      const y = getTerrainHeight(x, z);
      const n = getTerrainNormal(x, z, 0.8);
      if (y > 0.35 && y < 4.8 && n.y > 0.78) {
        amberPoints.push(new THREE.Vector3(x, y + 1.05, z));
      }
    }

    // Icaraí -> Boa Viagem -> Ingá -> Gragoatá -> Centro de Niterói Waterfront Ribbons
    // Strictly filtered by height < 5.5 and flat urban slope (COMPLETELY eliminates floating hillside orange balls!)
    const niteroiCoastPaths = [
      [
        [126, 50],
        [120, 22],
        [116, -4],
        [114, -18],
      ],
      [
        [98, -50],
        [88, -64],
        [74, -78],
        [94, -92],
        [128, -104],
        [168, -120],
      ],
      [
        [136, 36],
        [138, -16],
        [128, -70],
        [166, -94],
      ],
    ];

    for (const path of niteroiCoastPaths) {
      const pts3 = path.map(([px, pz]) => new THREE.Vector3(px, Math.max(1.0, getTerrainHeight(px, pz)) + 1.0, pz));
      const curve = new THREE.CatmullRomCurve3(pts3);
      const nSamples = 36;
      for (let i = 0; i <= nSamples; i++) {
        const p = curve.getPoint(i / nSamples);
        if (Math.hypot(p.x - 105, p.z + 34) < 16.5) continue;
        const gy = getTerrainHeight(p.x, p.z);
        const gn = getTerrainNormal(p.x, p.z, 0.85);
        if (gy > 0.35 && gy < 5.4 && gn.y > 0.80) {
          (i % 5 === 0 ? whitePoints : amberPoints).push(
            new THREE.Vector3(p.x, gy + 1.15, p.z)
          );
        }
      }
    }

    // Strictly grounded neighborhood lights in flat urban Niterói ONLY (y < 6.2 & slope > 0.82 & urbanMask > 0.45!)
    for (let i = 0; i < 240; i++) {
      const x = 80 + rand() * 175;
      const z = -145 + rand() * 195;
      if (Math.hypot(x - 105, z + 34) < 19.5) continue;
      if (Math.hypot(x - 84, z + 42) < 11.5) continue;
      const y = getTerrainHeight(x, z);
      const n = getTerrainNormal(x, z, 0.9);
      if (y > 0.9 && y < 6.2 && n.y > 0.82 && getUrbanMask(x, z, y, n.y) > 0.45) {
        (rand() < 0.82 ? amberPoints : whitePoints).push(
          new THREE.Vector3(x, y + 1.15, z)
        );
      }
    }

    const bulbGeom = new THREE.SphereGeometry(0.16, 6, 6);
    const dummy = new THREE.Object3D();

    const makeLightOrbs = (pts, mat, scaleBase) => {
      if (!pts.length) return;
      const mesh = new THREE.InstancedMesh(bulbGeom, mat, pts.length);
      mesh.frustumCulled = false;
      for (let i = 0; i < pts.length; i++) {
        dummy.position.copy(pts[i]);
        dummy.scale.setScalar(scaleBase * (0.82 + (i % 5) * 0.08));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    };

    makeLightOrbs(amberPoints, this.lampHdrMat, 0.92);
    makeLightOrbs(whitePoints, this.whiteLampMat, 0.82);

    this._buildAdditiveGlowCloud(amberPoints, '#ff942e', 5.2, 0.44);
    this._buildAdditiveGlowCloud(whitePoints, '#ffeed2', 4.4, 0.40);
  }

  // Rio de Janeiro Waterfront Glittering Curtain (Botafogo, Flamengo, Glória, Santos Dumont Airport, Centro)
  _buildRioWaterfrontLights() {
    const rand = createRng(918273);
    const rioAmber = [];
    const rioWhite = [];

    const rioShore = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-258, 1.8, -214),
      new THREE.Vector3(-195, 1.8, -238),
      new THREE.Vector3(-135, 1.8, -262),
      new THREE.Vector3(-76, 2.0, -290),
      new THREE.Vector3(-20, 2.2, -322),
      new THREE.Vector3(38, 2.2, -372),
      new THREE.Vector3(98, 2.0, -432),
    ]);

    const count = 165;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = rioShore.getPoint(t);
      const gy = Math.max(0.7, getTerrainHeight(p.x, p.z));
      const isSantosDumont = t > 0.30 && t < 0.52;
      const h = gy + (isSantosDumont ? 1.4 : 1.2 + rand() * 1.1);
      if (isSantosDumont || i % 3 === 0) {
        rioWhite.push(new THREE.Vector3(p.x, h, p.z));
      } else {
        rioAmber.push(new THREE.Vector3(p.x, h, p.z));
      }
    }

    // Strictly grounded Rio waterfront & Botafogo/Centro neighborhood lights (ZERO lights floating on mountains!)
    for (let i = 0; i < 210; i++) {
      const x = -255 + rand() * 355;
      const z = -435 + rand() * 205;
      const y = getTerrainHeight(x, z);
      const n = getTerrainNormal(x, z, 1.0);
      if (y > 0.85 && y < 6.8 && n.y > 0.82 && getUrbanMask(x, z, y, n.y) > 0.42) {
        (rand() < 0.72 ? rioAmber : rioWhite).push(
          new THREE.Vector3(x, y + 1.2 + rand() * 1.4, z)
        );
      }
    }

    const bulbGeom = new THREE.SphereGeometry(0.32, 5, 5);
    const dummy = new THREE.Object3D();

    const makeOrbs = (pts, mat) => {
      if (!pts.length) return;
      const mesh = new THREE.InstancedMesh(bulbGeom, mat, pts.length);
      mesh.frustumCulled = false;
      for (let i = 0; i < pts.length; i++) {
        dummy.position.copy(pts[i]);
        dummy.scale.setScalar(0.88 + (i % 4) * 0.14);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    };

    makeOrbs(rioAmber, this.lampHdrMat);
    makeOrbs(rioWhite, this.whiteLampMat);

    this._buildAdditiveGlowCloud(rioAmber, '#ffa03c', 8.6, 0.46);
    this._buildAdditiveGlowCloud(rioWhite, '#fff0d4', 7.8, 0.48);
  }

  _buildAdditiveGlowCloud(points, colorHex, size, opacity = 0.44) {
    if (!points.length) return;
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      map: this.glowTex,
      color: new THREE.Color(colorHex),
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const cloud = new THREE.Points(geom, mat);
    cloud.frustumCulled = false;
    this.group.add(cloud);
    this.glowClouds = this.glowClouds || [];
    this.glowClouds.push({ mat, baseOpacity: opacity });
  }

  // Iconic Foreground Floodlit Green Football Pitch right in São Francisco (photographic micro-landmark!)
  _buildForegroundFootballPitch(pitchTex) {
    const px = 0.0;
    const pz = 156.0;
    const py = getTerrainHeight(px, pz);

    const group = new THREE.Group();
    group.position.set(px, py + 0.12, pz);
    group.rotation.y = 0.08;

    const pitchMat = new THREE.MeshStandardMaterial({
      map: pitchTex,
      emissiveMap: pitchTex,
      emissive: new THREE.Color('#54e87e'),
      emissiveIntensity: 0.62,
      roughness: 0.86,
    });
    this.emissiveMats.push({ mat: pitchMat, base: 0.62 });

    // Subtle concrete apron surround
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(11.4, 7.2),
      new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.9 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    group.add(apron);

    const field = new THREE.Mesh(new THREE.PlaneGeometry(9.8, 6.0), pitchMat);
    field.rotation.x = -Math.PI / 2;
    group.add(field);

    const poleMat = new THREE.MeshStandardMaterial({ color: '#3b434f', roughness: 0.6 });
    const floodMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.45, 2.0) });
    for (const sx of [-5.1, 5.1]) {
      for (const sz of [-3.2, 3.2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.10, 2.4, 5), poleMat);
        pole.position.set(sx, 1.2, sz);
        group.add(pole);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.2), floodMat);
        head.position.set(sx, 2.4, sz);
        group.add(head);

        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTex,
            color: new THREE.Color('#dcffe6'),
            transparent: true,
            opacity: 0.46,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        sprite.position.set(sx, 2.45, sz);
        sprite.scale.set(2.8, 2.8, 1);
        group.add(sprite);
      }
    }

    this.group.add(group);
  }

  update(elapsed) {
    if (!this.avenueCurve || !this.avenueCarsMesh) return;
    const dummy = new THREE.Object3D();
    const tangent = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < this.avenueCars.length; i++) {
      const c = this.avenueCars[i];
      let t = (c.t + elapsed * c.speed) % 1;
      if (t < 0) t += 1;
      const p = this.avenueCurve.getPoint(t);
      this.avenueCurve.getTangent(t, tangent);
      right.crossVectors(tangent, up).normalize();

      dummy.position.set(
        p.x + right.x * c.laneOffset,
        p.y + 0.18,
        p.z + right.z * c.laneOffset
      );
      dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      this.avenueCarsMesh.setMatrixAt(i, dummy.matrix);
    }
    this.avenueCarsMesh.instanceMatrix.needsUpdate = true;
  }

  applyPreset(preset) {
    const scale = preset.cityEmissiveScale;
    for (const item of this.emissiveMats) {
      item.mat.emissiveIntensity = item.base * scale;
    }
    this.lampHdrMat.color.setRGB(2.4 * scale, 1.44 * scale, 0.44 * scale);
    this.whiteLampMat.color.setRGB(2.2 * scale, 2.02 * scale, 1.72 * scale);
    if (this.glowClouds) {
      for (const gc of this.glowClouds) {
        gc.mat.opacity = Math.min(0.78, gc.baseOpacity * (0.45 + 0.55 * scale));
      }
    }
  }
}
