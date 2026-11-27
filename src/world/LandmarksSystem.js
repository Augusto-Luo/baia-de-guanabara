import * as THREE from 'three';
import {
  getTerrainHeight,
  sampleBridgePoint,
  sampleCrescentCurve,
} from '../config/geography.js';

// Build an upright, twist-free swept box-girder ribbon along a 3D curve (world UP = (0,1,0) always!)
function buildUprightBridgeRibbon(curve, segments, halfWidth, heightTop, heightBottom, taperBottom = 0.84) {
  const positions = [];
  const normals = [];
  const indices = [];

  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const right = new THREE.Vector3();
  const pt = new THREE.Vector3();

  const ringStride = 8;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPoint(t, pt);
    curve.getTangent(t, tangent);
    right.crossVectors(tangent, up).normalize();

    const tl = new THREE.Vector3(pt.x - right.x * halfWidth, pt.y + heightTop, pt.z - right.z * halfWidth);
    const tr = new THREE.Vector3(pt.x + right.x * halfWidth, pt.y + heightTop, pt.z + right.z * halfWidth);
    const br = new THREE.Vector3(pt.x + right.x * halfWidth * taperBottom, pt.y - heightBottom, pt.z + right.z * halfWidth * taperBottom);
    const bl = new THREE.Vector3(pt.x - right.x * halfWidth * taperBottom, pt.y - heightBottom, pt.z - right.z * halfWidth * taperBottom);

    // Top face (0, 1)
    positions.push(tl.x, tl.y, tl.z, tr.x, tr.y, tr.z);
    normals.push(0, 1, 0, 0, 1, 0);
    // Right face (2, 3)
    positions.push(tr.x, tr.y, tr.z, br.x, br.y, br.z);
    normals.push(right.x, 0, right.z, right.x, 0, right.z);
    // Bottom face (4, 5)
    positions.push(br.x, br.y, br.z, bl.x, bl.y, bl.z);
    normals.push(0, -1, 0, 0, -1, 0);
    // Left face (6, 7)
    positions.push(bl.x, bl.y, bl.z, tl.x, tl.y, tl.z);
    normals.push(-right.x, 0, -right.z, -right.x, 0, -right.z);
  }

  for (let i = 0; i < segments; i++) {
    const baseA = i * ringStride;
    const baseB = (i + 1) * ringStride;
    for (let f = 0; f < 4; f++) {
      const a0 = baseA + f * 2;
      const a1 = a0 + 1;
      const b0 = baseB + f * 2;
      const b1 = b0 + 1;
      indices.push(a0, b0, a1, a1, b0, b1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geom.setIndex(indices);
  return geom;
}

// Procedural panoramic gallery window glass texture for MAC Niterói (dark twilight glass + crisp mullions + warm museum gallery!)
function createMacGlassTexture() {
  const w = 1024;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, '#161f2e');
  g.addColorStop(0.28, '#2b2d34');
  g.addColorStop(0.62, '#a68252');
  g.addColorStop(0.86, '#765734');
  g.addColorStop(1.0, '#2a221c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Subtle warm museum ceiling gallery spotlights
  for (let i = 0; i < 32; i++) {
    const x = ((i + 0.5) / 32) * w;
    const rg = ctx.createRadialGradient(x, h * 0.55, 3, x, h * 0.55, 30);
    rg.addColorStop(0, 'rgba(255, 224, 168, 0.72)');
    rg.addColorStop(1, 'rgba(255, 198, 120, 0.0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 30, 0, 60, h);
  }

  // Crisp dark vertical structural glass mullions (signature Niemeyer MAC silhouette!)
  ctx.fillStyle = '#0e131d';
  for (let i = 0; i < 64; i++) {
    ctx.fillRect((i / 64) * w, 0, 3.2, h);
  }
  ctx.fillRect(0, 0, w, 7);
  ctx.fillRect(0, h - 7, w, 7);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Sculpted, museum-grade recognizable landmarks of Baía de Guanabara:
// 1. Cristo Redentor (Art Deco pleated soapstone sculpture, Capela pedestal, seamless Corcovado summit!)
// 2. Pão de Açúcar, Morro da Urca & 3D Braided-Cable Bondinho Glass Gondolas
// 3. MAC Niterói (Oscar Niemeyer saucer, 3D exterior mullions, sky-reflecting pool, red spiral ramp + support piers)
// 4. Ilha da Boa Viagem (Colonial Capela with bell tower & cross, stone fort ramparts, arched footbridge)
// 5. Ponte Rio–Niterói (Twin box-girder spans, H-frame crossbeam piers, waterline ship fenders, Vão Central steel girder)
// 6. Estação Hidroviária de Charitas (Oscar Niemeyer curved concrete vault & mullioned glass terminal!)
// 7. Fortaleza de Santa Cruz da Barra & Coastal Lighthouse
// 8. Ilha Fiscal (Neo-Gothic turreted palace on Rio bay islet!) & Santos Dumont Airport Waterfront Approach Beacons!
export class LandmarksSystem {
  constructor({ glowTex, graniteTex, soapstoneTex, preset }) {
    this.group = new THREE.Group();
    this.group.name = 'LandmarksSystem';
    this.glowTex = glowTex;
    this.graniteTex = graniteTex;
    this.soapstoneTex = soapstoneTex;
    this.emissiveMaterials = [];
    this.glowSprites = [];
    this.beaconLights = [];

    this._buildCristoRedentor();
    this._buildSugarloafBondinho();
    this._buildMacNiteroi();
    this._buildIlhaBoaViagem();
    this._buildPonteRioNiteroi();
    this._buildCharitasPier();
    this._buildFortalezaAndBeacons();
    this._buildIlhaFiscalAndAirport();

    this.applyPreset(preset);
  }

  _addGlowSprite(parent, pos, colorHex, scale, opacity = 0.85) {
    const mat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color: new THREE.Color(colorHex),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(pos);
    sprite.scale.set(scale, scale, 1);
    parent.add(sprite);
    this.glowSprites.push({ sprite, baseOpacity: opacity });
    return sprite;
  }

  // 1. CORCOVADO & CRISTO REDENTOR (Museum-Grade Art Deco Pleated Soapstone Sculpture + Seamless Rock Terrace!)
  _buildCristoRedentor() {
    const cx = -262;
    const cz = -328;
    const summitY = getTerrainHeight(cx, cz);

    const group = new THREE.Group();
    group.position.set(cx, summitY - 0.55, cz);
    group.rotation.y = Math.atan2(262, 550);

    // Pedra-Sabão Art Deco soapstone mosaic material — restrained emissive so REAL upward floodlights sculpt crisp 3D relief!
    const soapstoneMat = new THREE.MeshStandardMaterial({
      map: this.soapstoneTex || null,
      color: new THREE.Color('#ece5d8'),
      emissive: new THREE.Color('#ffd8a6'),
      emissiveIntensity: 0.15,
      roughness: 0.60,
      metalness: 0.04,
    });
    this.emissiveMaterials.push({ mat: soapstoneMat, base: 0.15 });

    const pedestalMat = new THREE.MeshStandardMaterial({
      map: this.soapstoneTex || null,
      color: new THREE.Color('#9a9084'),
      emissive: new THREE.Color('#c89864'),
      emissiveIntensity: 0.14,
      roughness: 0.80,
    });
    this.emissiveMaterials.push({ mat: pedestalMat, base: 0.14 });

    // Sun-kissed granite terrace retaining base matching Corcovado's twilight rock tone cleanly (ZERO black cork collar!)
    const rockRetainingMat = new THREE.MeshStandardMaterial({
      map: this.graniteTex ? this.graniteTex.map : null,
      normalMap: this.graniteTex ? this.graniteTex.normalMap : null,
      color: new THREE.Color('#7c7672'),
      emissive: new THREE.Color('#3b3234'),
      emissiveIntensity: 0.35,
      roughness: 0.88,
    });

    const portalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#282018'),
      emissive: new THREE.Color('#ffa848'),
      emissiveIntensity: 0.85,
      roughness: 0.5,
    });
    this.emissiveMaterials.push({ mat: portalMat, base: 0.85 });

    // Compact architectural stone retaining base recessed smoothly into the flattened Corcovado summit plateau
    const rockCrown = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.35, 1.8, 28), rockRetainingMat);
    rockCrown.position.y = 0.05;
    group.add(rockCrown);

    // Circular Mirante Observation Deck + Parapet Ring + Warm Rim Uplights
    const terrace = new THREE.Mesh(new THREE.CylinderGeometry(3.85, 4.15, 0.72, 24), pedestalMat);
    terrace.position.y = 1.25;
    group.add(terrace);

    const parapet = new THREE.Mesh(new THREE.TorusGeometry(3.72, 0.14, 8, 28), pedestalMat);
    parapet.rotation.x = Math.PI * 0.5;
    parapet.position.y = 1.66;
    group.add(parapet);

    // Art Deco Stepped Chapel Base (Capela de Nossa Senhora Aparecida) with glowing arched entrance!
    const ped1 = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.55, 2.75), pedestalMat);
    ped1.position.y = 2.38;
    group.add(ped1);

    // Corner stepped Art Deco pilasters on pedestal
    for (const sx of [-1.25, 1.25]) {
      for (const sz of [-1.25, 1.25]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.72, 0.42), pedestalMat);
        pil.position.set(sx, 2.42, sz);
        group.add(pil);
      }
    }

    const chapelDoor = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.05, 0.16), portalMat);
    chapelDoor.position.set(0, 2.15, 1.38);
    group.add(chapelDoor);

    const ped2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 2.0), pedestalMat);
    ped2.position.y = 3.55;
    group.add(ped2);

    // --- Sculpted Art Deco Fluted Robe Column (vertical architectural pleats!) ---
    const robePts = [
      new THREE.Vector2(1.12, 3.92),
      new THREE.Vector2(1.06, 4.65),
      new THREE.Vector2(0.92, 5.75),
      new THREE.Vector2(0.76, 6.95),
      new THREE.Vector2(0.84, 7.65),
      new THREE.Vector2(0.92, 8.28),
      new THREE.Vector2(0.56, 8.62),
      new THREE.Vector2(0.32, 8.75),
    ];
    const robeGeom = new THREE.LatheGeometry(robePts, 28);
    const rp = robeGeom.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const rx = rp.getX(i);
      const ry = rp.getY(i);
      const rz = rp.getZ(i);
      const ang = Math.atan2(rz, rx);
      // Iconic Art Deco vertical drapery folds + front-to-back anatomical flattening!
      const pleat = 1.0 + 0.065 * Math.cos(ang * 10.0) * Math.min(1, (8.4 - ry) * 0.4);
      const chestFlatten = 0.78;
      rp.setXYZ(i, rx * pleat * 1.06, ry, rz * pleat * chestFlatten);
    }
    robeGeom.computeVertexNormals();
    group.add(new THREE.Mesh(robeGeom, soapstoneMat));

    // Draped Mantle Sash & Sacred Heart Chest Relief
    const mantle = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.05, 0.92), soapstoneMat);
    mantle.position.set(0, 8.15, 0.06);
    group.add(mantle);

    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 1), soapstoneMat);
    heart.scale.set(0.9, 1.15, 0.45);
    heart.position.set(0, 7.92, 0.56);
    group.add(heart);

    // Sculpted Neck & Serene Bowed Art Deco Head with Brow/Beard/Hair Volume!
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.35, 0.48, 12), soapstoneMat);
    neck.position.set(0, 8.85, 0.05);
    group.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 9.32, 0.16);
    headGroup.rotation.x = 0.24; // Iconic compassionate downward gaze toward Guanabara Bay!

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.50, 16, 14), soapstoneMat);
    cranium.scale.set(0.84, 1.14, 0.92);
    headGroup.add(cranium);

    // Sculpted Art Deco shoulder-length hair & beard silhouette
    const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.78, 12), soapstoneMat);
    hairBack.position.set(0, -0.14, -0.14);
    hairBack.scale.set(0.95, 1.0, 0.72);
    headGroup.add(hairBack);

    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.48, 8), soapstoneMat);
    beard.rotation.x = Math.PI;
    beard.position.set(0, -0.42, 0.18);
    headGroup.add(beard);

    group.add(headGroup);

    // --- Iconic Outstretched Arms with Sculpted Sweeping Art Deco Draped Sleeves & Hands! ---
    const armBeam = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.46, 0.50), soapstoneMat);
    armBeam.position.set(0, 8.38, 0.0);
    group.add(armBeam);

    // Custom extruded sweeping curved Art Deco hanging robe drapery under both outstretched arms!
    const drapeShape = new THREE.Shape();
    drapeShape.moveTo(0.4, 8.45);
    drapeShape.lineTo(3.45, 8.45);
    drapeShape.lineTo(3.45, 8.15);
    drapeShape.quadraticCurveTo(2.45, 7.62, 1.65, 7.38);
    drapeShape.quadraticCurveTo(1.05, 7.22, 0.58, 6.72);
    drapeShape.lineTo(0.4, 8.45);

    const drapeExtrude = {
      depth: 0.46,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
    };
    const rightDrapeGeom = new THREE.ExtrudeGeometry(drapeShape, drapeExtrude);
    rightDrapeGeom.translate(0, 0, -0.23);
    group.add(new THREE.Mesh(rightDrapeGeom, soapstoneMat));

    const leftDrape = new THREE.Mesh(rightDrapeGeom, soapstoneMat);
    leftDrape.scale.x = -1;
    group.add(leftDrape);

    for (const side of [-1, 1]) {
      const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8), soapstoneMat);
      wrist.rotation.z = Math.PI * 0.5;
      wrist.position.set(side * 3.55, 8.36, 0.02);
      group.add(wrist);

      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 0.36), soapstoneMat);
      hand.position.set(side * 3.92, 8.34, 0.06);
      hand.rotation.y = -side * 0.12;
      group.add(hand);
    }

    // Authentic Ground-Mounted Architectural Floodlights (asymmetric key + cool twilight sky side fill for crisp 3D relief!)
    const uplightKey = new THREE.PointLight('#ffdfaa', 22.0, 38, 1.35);
    uplightKey.position.set(2.4, 3.6, 5.2);
    group.add(uplightKey);

    const uplightRim = new THREE.PointLight('#7da8e0', 9.5, 32, 1.5);
    uplightRim.position.set(-4.6, 6.8, -2.8);
    group.add(uplightRim);

    // Subtle soft twilight beacon halo visible from Parque da Cidade without washing out close-up stone folds!
    this._addGlowSprite(group, new THREE.Vector3(0, 8.1, 0.4), '#ffebd0', 6.8, 0.22);

    this.group.add(group);
  }

  // 2. PÃO DE AÇÚCAR, MORRO DA URCA & DETAILED 3D-CABLE BONDINHO GLASS GONDOLAS
  _buildSugarloafBondinho() {
    const sugarPos = new THREE.Vector3(-252, getTerrainHeight(-252, -188), -188);
    const urcaPos = new THREE.Vector3(-278, getTerrainHeight(-278, -176), -176);
    const basePos = new THREE.Vector3(-300, Math.max(1.8, getTerrainHeight(-300, -170)), -170);

    const group = new THREE.Group();

    const concreteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a505c'),
      roughness: 0.72,
      metalness: 0.18,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6b7485'),
      roughness: 0.42,
      metalness: 0.75,
    });
    const litWindowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffe0ab'),
      emissive: new THREE.Color('#ffbd62'),
      emissiveIntensity: 1.55,
      roughness: 0.2,
    });
    this.emissiveMaterials.push({ mat: litWindowMat, base: 1.55 });

    // --- Sugarloaf Summit Station (Cantilevered Modernist Viewing Deck + Sheave Tower + Red Aviation Mast) ---
    const sStation = new THREE.Group();
    sStation.position.set(sugarPos.x - 1.2, sugarPos.y - 0.65, sugarPos.z + 0.5);
    sStation.rotation.y = 0.42;

    const sBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.8, 3.0), concreteMat);
    sBase.position.y = 0.2;
    sStation.add(sBase);
    const sDeck = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.26, 3.6), concreteMat);
    sDeck.position.y = 1.15;
    sStation.add(sDeck);
    const sPavilion = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.95, 2.3), litWindowMat);
    sPavilion.position.set(0.2, 1.72, 0);
    sStation.add(sPavilion);
    const sRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.24, 2.8), concreteMat);
    sRoof.position.set(0.2, 2.28, 0);
    sStation.add(sRoof);
    // Steel cable receiving portal
    for (const sz of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.4, 6), steelMat);
      leg.position.set(-1.9, 1.8, sz);
      sStation.add(leg);
    }
    const sMast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 3.4, 6), steelMat);
    sMast.position.set(1.1, 3.9, 0);
    sStation.add(sMast);
    const redBeacon = this._addGlowSprite(
      sStation,
      new THREE.Vector3(1.1, 5.7, 0),
      '#ff3828',
      3.6,
      0.92
    );
    this.beaconLights.push({ sprite: redBeacon, phase: 0.0, speed: 2.8 });
    this._addGlowSprite(sStation, new THREE.Vector3(0.2, 1.7, 0), '#ffc670', 5.2, 0.34);
    group.add(sStation);

    // --- Morro da Urca Station (Broad Panoramic Amphitheater & Cable Transfer Terminal) ---
    const uStation = new THREE.Group();
    uStation.position.set(urcaPos.x, urcaPos.y + 0.15, urcaPos.z);
    uStation.rotation.y = 0.42;

    const uBase = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.2, 4.2), concreteMat);
    uBase.position.y = 0.15;
    uStation.add(uBase);
    const uWin = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.95, 3.7), litWindowMat);
    uWin.position.y = 1.55;
    uStation.add(uWin);
    const uRoof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.28, 4.4), concreteMat);
    uRoof.position.y = 2.15;
    uStation.add(uRoof);
    this._addGlowSprite(uStation, new THREE.Vector3(0, 1.6, 0), '#ffbe60', 6.8, 0.48);
    group.add(uStation);

    // --- Real 3D Braided Metallic Suspension Cables (TubeGeometry — crisp & visible at every zoom!) ---
    const pA = new THREE.Vector3(urcaPos.x + 2.2, urcaPos.y + 2.1, urcaPos.z - 0.8);
    const pB = new THREE.Vector3(sugarPos.x - 2.6, sugarPos.y + 1.2, sugarPos.z + 1.0);
    const mid = pA.clone().lerp(pB, 0.5);
    mid.y -= 3.1;
    this.bondinhoCurve = new THREE.QuadraticBezierCurve3(pA, mid, pB);

    const cableMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#a6b2c6'),
      emissive: new THREE.Color('#303846'),
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.82,
    });

    for (const offsetZ of [-0.58, 0.58]) {
      const shiftedCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(pA.x, pA.y, pA.z + offsetZ),
        new THREE.Vector3(mid.x, mid.y, mid.z + offsetZ),
        new THREE.Vector3(pB.x, pB.y, pB.z + offsetZ)
      );
      group.add(new THREE.Mesh(new THREE.TubeGeometry(shiftedCurve, 32, 0.055, 5, false), cableMat));
    }

    // Lower Praia Vermelha -> Morro da Urca cables
    const mid2 = basePos.clone().lerp(urcaPos, 0.5);
    mid2.y -= 2.2;
    const lowerCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(basePos.x, basePos.y + 1.6, basePos.z),
      mid2,
      new THREE.Vector3(urcaPos.x - 2.0, urcaPos.y + 1.4, urcaPos.z + 0.5)
    );
    group.add(new THREE.Mesh(new THREE.TubeGeometry(lowerCurve, 26, 0.05, 5, false), cableMat));

    // --- Detailed Iconic Glass-Walled Bondinho Gondolas with Overhead Bogie Trolleys! ---
    this.bondinhoCars = [];
    const carGlassMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffecd0'),
      emissive: new THREE.Color('#ffbe64'),
      emissiveIntensity: 1.75,
      roughness: 0.14,
      metalness: 0.25,
    });
    this.emissiveMaterials.push({ mat: carGlassMat, base: 1.75 });
    const carTrimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c83226'), roughness: 0.38, metalness: 0.3 });

    for (let i = 0; i < 2; i++) {
      const car = new THREE.Group();
      // Wheeled steel bogie carriage gripping the overhead cable
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.14, 0.24), steelMat);
      bogie.position.y = 0.04;
      car.add(bogie);
      // Curved steel hanger arm
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.15, 6), steelMat);
      hanger.position.y = -0.56;
      car.add(hanger);
      // Signature Bondinho rounded panoramic glass cabin (faceted octagonal capsule!)
      const cabin = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.52, 0.72, 8), carGlassMat);
      cabin.scale.set(1.25, 1.0, 0.82);
      cabin.position.y = -1.35;
      car.add(cabin);
      // Red/white capsule roof & floor skirt
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.60, 0.18, 8), carTrimMat);
      roof.scale.set(1.25, 1.0, 0.82);
      roof.position.y = -0.92;
      car.add(roof);
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.44, 0.20, 8), steelMat);
      skirt.scale.set(1.25, 1.0, 0.82);
      skirt.position.y = -1.78;
      car.add(skirt);

      this._addGlowSprite(car, new THREE.Vector3(0, -1.35, 0), '#ffd284', 2.8, 0.48);

      group.add(car);
      this.bondinhoCars.push({ mesh: car, offsetZ: i === 0 ? -0.58 : 0.58, phase: i * Math.PI });
    }

    this.group.add(group);
  }

  // 3. MAC NITERÓI (Oscar Niemeyer) — Architectural Visualization Grade:
  //    Weathered white modernist concrete saucer, sky-reflecting espelho d'água, 3D exterior glass mullions,
  //    sweeping red-carpet spiral ramp with curved concrete parapets, handrail LED glow & grounded support piers!
  _buildMacNiteroi() {
    const mx = 105;
    const mz = -34;
    const baseY = getTerrainHeight(mx, mz);

    const group = new THREE.Group();
    group.position.set(mx, baseY - 0.35, mz);
    group.scale.setScalar(0.76);

    const whiteConcrete = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#eae8e2'),
      emissive: new THREE.Color('#ffd9b0'),
      emissiveIntensity: 0.20,
      roughness: 0.48,
      metalness: 0.04,
    });
    this.emissiveMaterials.push({ mat: whiteConcrete, base: 0.20 });

    const foundationRock = new THREE.MeshStandardMaterial({
      map: this.graniteTex ? this.graniteTex.map : null,
      normalMap: this.graniteTex ? this.graniteTex.normalMap : null,
      color: new THREE.Color('#52545d'),
      roughness: 0.88,
    });

    const macGlassTex = createMacGlassTexture();
    const darkGlass = new THREE.MeshStandardMaterial({
      map: macGlassTex,
      emissiveMap: macGlassTex,
      emissive: new THREE.Color('#ffc97c'),
      emissiveIntensity: 0.82,
      roughness: 0.14,
      metalness: 0.58,
    });
    this.emissiveMaterials.push({ mat: darkGlass, base: 0.82 });

    const mullionMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1a202c'),
      roughness: 0.42,
      metalness: 0.65,
    });

    const redCarpet = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#b82022'),
      emissive: new THREE.Color('#6a1410'),
      emissiveIntensity: 0.34,
      roughness: 0.64,
    });

    // Luminous twilight sky-reflecting circular espelho d'água!
    const poolWater = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#284664'),
      emissive: new THREE.Color('#345272'),
      emissiveIntensity: 0.42,
      roughness: 0.06,
      metalness: 0.88,
    });
    this.emissiveMaterials.push({ mat: poolWater, base: 0.42 });

    // Retaining foundation drum blending cleanly into the rocky Mirante da Boa Viagem cliff
    const retainingWall = new THREE.Mesh(
      new THREE.CylinderGeometry(8.8, 10.8, 6.2, 36),
      foundationRock
    );
    retainingWall.position.y = -3.05;
    group.add(retainingWall);

    // Overlook plaza deck + raised pool curb + reflecting pool
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(8.7, 9.0, 0.55, 40),
      whiteConcrete
    );
    plaza.position.y = 0.28;
    group.add(plaza);

    const poolCurb = new THREE.Mesh(
      new THREE.TorusGeometry(5.65, 0.14, 8, 44),
      whiteConcrete
    );
    poolCurb.rotation.x = Math.PI * 0.5;
    poolCurb.position.y = 0.58;
    group.add(poolCurb);

    const pool = new THREE.Mesh(
      new THREE.CylinderGeometry(5.55, 5.55, 0.12, 40),
      poolWater
    );
    pool.position.y = 0.56;
    group.add(pool);

    // Sculpted Niemeyer Chalice / Saucer Hull (smooth 64-seg architectural lathe)
    const lathePoints = [
      new THREE.Vector2(1.88, 0.54),
      new THREE.Vector2(1.94, 2.25),
      new THREE.Vector2(2.65, 2.75),
      new THREE.Vector2(5.15, 3.68),
      new THREE.Vector2(7.08, 4.72),
      new THREE.Vector2(7.38, 5.04),
      new THREE.Vector2(7.38, 5.24),
      new THREE.Vector2(6.55, 5.30),
    ];
    group.add(new THREE.Mesh(new THREE.LatheGeometry(lathePoints, 64), whiteConcrete));

    // Slanted 360° panoramic gallery window ribbon + 32 REAL 3D slanted exterior mullions!
    const glassBand = new THREE.Mesh(
      new THREE.CylinderGeometry(7.10, 6.72, 1.38, 64, 1, true),
      darkGlass
    );
    glassBand.position.y = 5.96;
    group.add(glassBand);

    const mullionGeom = new THREE.BoxGeometry(0.09, 1.46, 0.12);
    const mullionMesh = new THREE.InstancedMesh(mullionGeom, mullionMat, 36);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r = 6.94;
      dummy.position.set(Math.cos(a) * r, 5.96, Math.sin(a) * r);
      dummy.rotation.set(0, -a, 0);
      dummy.rotateZ(-0.26); // Slanted outward matching MAC's signature inclined glass!
      dummy.updateMatrix();
      mullionMesh.setMatrixAt(i, dummy.matrix);
    }
    mullionMesh.instanceMatrix.needsUpdate = true;
    group.add(mullionMesh);

    // Overhanging curved white saucer roof dome
    const roofPoints = [
      new THREE.Vector2(7.58, 6.58),
      new THREE.Vector2(7.48, 6.84),
      new THREE.Vector2(5.85, 7.24),
      new THREE.Vector2(2.8, 7.46),
      new THREE.Vector2(0.0, 7.54),
    ];
    group.add(new THREE.Mesh(new THREE.LatheGeometry(roofPoints, 64), whiteConcrete));

    // Iconic sweeping red-carpeted exterior spiral access ramp + curved white side parapets + grounded support piers!
    const rampPts = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      const ang = -0.35 + t * Math.PI * 1.18;
      const rad = 5.3 + Math.sin(t * Math.PI) * 4.0;
      const ry = 0.62 + t * 3.92;
      rampPts.push(new THREE.Vector3(Math.cos(ang) * rad, ry, Math.sin(ang) * rad));
    }
    const rampCurve = new THREE.CatmullRomCurve3(rampPts);
    group.add(new THREE.Mesh(buildUprightBridgeRibbon(rampCurve, 36, 0.62, 0.16, 0.24), whiteConcrete));
    group.add(new THREE.Mesh(buildUprightBridgeRibbon(rampCurve, 36, 0.44, 0.21, -0.10), redCarpet));

    // Slender white concrete support columns grounding the sweeping ramp naturally to the cliff/plaza!
    for (const tCol of [0.22, 0.48, 0.72]) {
      const pt = rampCurve.getPoint(tCol);
      const colH = pt.y + 1.8;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, colH, 10), whiteConcrete);
      col.position.set(pt.x, pt.y - colH * 0.5 - 0.15, pt.z);
      group.add(col);
    }

    // Subtle architectural uplights washing MAC's cantilevered white saucer hull & reflecting pool!
    const macLight1 = new THREE.PointLight('#ffdfba', 7.5, 34, 1.55);
    macLight1.position.set(-5.4, 2.2, 5.8);
    group.add(macLight1);
    const macLight2 = new THREE.PointLight('#ffe5c8', 6.0, 30, 1.55);
    macLight2.position.set(5.6, 2.4, -4.4);
    group.add(macLight2);

    this._addGlowSprite(group, new THREE.Vector3(0, 5.6, 0), '#ffe4bc', 9.5, 0.22);

    this.group.add(group);
  }

  // 4. ILHA DA BOA VIAGEM (Historic Colonial White Chapel, Bell Tower, Cross, Fort Ramparts & Arched Stone Footbridge!)
  _buildIlhaBoaViagem() {
    const ix = 84;
    const iz = -42;
    const topY = getTerrainHeight(ix, iz);

    const group = new THREE.Group();

    const wallMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#eae3d6'),
      emissive: new THREE.Color('#ffd292'),
      emissiveIntensity: 0.28,
      roughness: 0.72,
    });
    this.emissiveMaterials.push({ mat: wallMat, base: 0.28 });

    const roofMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#8e3b26'), roughness: 0.84 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#5a5852'), roughness: 0.90 });

    const chapel = new THREE.Group();
    chapel.position.set(ix, topY - 0.35, iz);
    chapel.rotation.y = 0.5;

    // Historic stone fort bastion platform under the chapel
    const bastion = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.1, 1.6, 12), stoneMat);
    bastion.position.y = -0.35;
    chapel.add(bastion);

    const nave = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.75, 3.8), wallMat);
    nave.position.y = 1.15;
    chapel.add(nave);

    // Gable terracotta roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.25, 1.05, 4), roofMat);
    roof.rotation.y = Math.PI * 0.25;
    roof.scale.set(0.84, 1.0, 1.38);
    roof.position.y = 2.52;
    chapel.add(roof);

    // Iconic colonial bell tower + pyramid spire + iron cross!
    const belfry = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.75, 0.92), wallMat);
    belfry.position.set(0.75, 2.35, 1.35);
    chapel.add(belfry);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.65, 4), roofMat);
    spire.rotation.y = Math.PI * 0.25;
    spire.position.set(0.75, 3.55, 1.35);
    chapel.add(spire);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.08), wallMat);
    crossV.position.set(0.75, 4.02, 1.35);
    chapel.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.08, 0.08), wallMat);
    crossH.position.set(0.75, 4.12, 1.35);
    chapel.add(crossH);

    this._addGlowSprite(chapel, new THREE.Vector3(0, 1.8, 1.8), '#ffd086', 3.8, 0.30);
    group.add(chapel);

    // Arched stone pedestrian footbridge linking Ilha da Boa Viagem to the shore
    const bridgePts = [
      new THREE.Vector3(88.2, 1.35, -39.8),
      new THREE.Vector3(93.8, 2.25, -37.2),
      new THREE.Vector3(99.4, 2.55, -35.5),
    ];
    const bCurve = new THREE.CatmullRomCurve3(bridgePts);
    group.add(new THREE.Mesh(buildUprightBridgeRibbon(bCurve, 18, 0.34, 0.16, 0.26), wallMat));

    this.group.add(group);
  }

  // 5. PONTE RIO–NITERÓI (Presidente Costa e Silva) — Twin Box-Girder Viaduct, H-Frame Crossbeam Piers,
  //    Waterline Ship-Collision Fenders, Elevated Steel Vão Central, Dual-Arm Lamp Standards & Crisp Traffic!
  _buildPonteRioNiteroi() {
    const group = new THREE.Group();

    const samples = 96;
    const curvePts = [];
    for (let i = 0; i <= samples; i++) {
      const p = sampleBridgePoint(i / samples);
      curvePts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    this.bridgeCurve = new THREE.CatmullRomCurve3(curvePts);

    const concreteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4d5564'),
      roughness: 0.76,
      metalness: 0.14,
    });
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2b303a'),
      roughness: 0.86,
      metalness: 0.08,
    });
    const steelSpanMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2c3442'),
      roughness: 0.46,
      metalness: 0.62,
    });

    // Main upright viaduct road deck + crisp side safety guardrails + raised central median!
    group.add(new THREE.Mesh(buildUprightBridgeRibbon(this.bridgeCurve, 108, 1.72, 0.26, 0.46, 0.80), concreteMat));
    group.add(new THREE.Mesh(buildUprightBridgeRibbon(this.bridgeCurve, 108, 1.48, 0.29, -0.22, 1.0), asphaltMat));

    // Side jersey safety barriers + median divider
    const up = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3();
    const right = new THREE.Vector3();
    for (const laneOff of [-1.62, 0.0, 1.62]) {
      const railPts = [];
      for (let i = 0; i <= 72; i++) {
        const t = i / 72;
        const pt = this.bridgeCurve.getPoint(t);
        this.bridgeCurve.getTangent(t, tangent);
        right.crossVectors(tangent, up).normalize();
        railPts.push(new THREE.Vector3(pt.x + right.x * laneOff, pt.y + 0.34, pt.z + right.z * laneOff));
      }
      const railCurve = new THREE.CatmullRomCurve3(railPts);
      group.add(new THREE.Mesh(buildUprightBridgeRibbon(railCurve, 72, laneOff === 0 ? 0.14 : 0.10, 0.22, 0.08, 1.0), concreteMat));
    }

    // Iconic deep haunched orthotropic steel box-girder at Vão Central navigation channel (t ∈ [0.34, 0.58])!
    const archPts = [];
    for (let i = 0; i <= 28; i++) {
      const t = 0.34 + (i / 28) * 0.24;
      const p = sampleBridgePoint(t);
      archPts.push(new THREE.Vector3(p.x, p.y - 0.36, p.z));
    }
    const archCurve = new THREE.CatmullRomCurve3(archPts);
    group.add(new THREE.Mesh(buildUprightBridgeRibbon(archCurve, 28, 1.46, 0.12, 1.18, 0.86), steelSpanMat));

    // 42 Twin-Column H-Frame Concrete Piers + Horizontal Pier Caps + Waterline Ship-Collision Fenders!
    const pierCount = 42;
    const colGeom = new THREE.BoxGeometry(0.46, 1.0, 0.58);
    colGeom.translate(0, -0.5, 0);
    const pierMesh = new THREE.InstancedMesh(colGeom, concreteMat, pierCount * 2);
    pierMesh.frustumCulled = false;

    const capGeom = new THREE.BoxGeometry(2.6, 0.52, 0.72);
    const capMesh = new THREE.InstancedMesh(capGeom, concreteMat, pierCount);
    capMesh.frustumCulled = false;

    const fenderGeom = new THREE.CylinderGeometry(1.15, 1.35, 1.15, 10);
    const fenderMesh = new THREE.InstancedMesh(fenderGeom, concreteMat, pierCount);
    fenderMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    let pIdx = 0;
    for (let i = 0; i < pierCount; i++) {
      const t = 0.025 + (i / (pierCount - 1)) * 0.95;
      const skip = Math.abs(t - 0.46) < 0.032; // Clear wide 300m Vão Central ship navigation channel!
      const p = this.bridgeCurve.getPoint(t);
      this.bridgeCurve.getTangent(t, tangent);
      right.crossVectors(tangent, up).normalize();
      const yaw = Math.atan2(tangent.x, tangent.z);
      const isMainPier = Math.abs(t - 0.46) < 0.068;

      for (const side of [-1.05, 1.05]) {
        if (skip) {
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.position.set(p.x + right.x * side, p.y - 0.36, p.z + right.z * side);
          dummy.rotation.set(0, yaw, 0);
          dummy.scale.set(isMainPier ? 1.75 : 1.0, p.y + 4.8, isMainPier ? 1.6 : 1.0);
        }
        dummy.updateMatrix();
        pierMesh.setMatrixAt(pIdx++, dummy.matrix);
      }

      if (skip) {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        capMesh.setMatrixAt(i, dummy.matrix);
        fenderMesh.setMatrixAt(i, dummy.matrix);
      } else {
        // Horizontal H-frame pier crossbeam cap right beneath the viaduct girders
        dummy.position.set(p.x, p.y - 0.62, p.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(isMainPier ? 1.25 : 1.0, isMainPier ? 1.4 : 1.0, isMainPier ? 1.4 : 1.0);
        dummy.updateMatrix();
        capMesh.setMatrixAt(i, dummy.matrix);

        // Waterline concrete ship-protection pile cap / dolphin
        dummy.position.set(p.x, 0.15, p.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(isMainPier ? 1.85 : 1.05, 1.0, isMainPier ? 1.35 : 0.72);
        dummy.updateMatrix();
        fenderMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    pierMesh.instanceMatrix.needsUpdate = true;
    capMesh.instanceMatrix.needsUpdate = true;
    fenderMesh.instanceMatrix.needsUpdate = true;
    group.add(pierMesh);
    group.add(capMesh);
    group.add(fenderMesh);

    // 90 Slender Dual-Arm Median Streetlamp Standards + Refined Pinpoint Warm Sodium Bulbs!
    const lampCount = 90;
    const poleGeom = new THREE.CylinderGeometry(0.036, 0.055, 1.42, 4);
    poleGeom.translate(0, 0.71, 0);
    const poleMesh = new THREE.InstancedMesh(poleGeom, steelSpanMat, lampCount);
    poleMesh.frustumCulled = false;

    const lampMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(2.4, 1.48, 0.54),
    });
    const lampGeom = new THREE.SphereGeometry(0.15, 6, 6);
    const lampMesh = new THREE.InstancedMesh(lampGeom, lampMat, lampCount);
    lampMesh.frustumCulled = false;

    for (let i = 0; i < lampCount; i++) {
      const t = 0.012 + (i / (lampCount - 1)) * 0.976;
      const p = this.bridgeCurve.getPoint(t);

      dummy.position.set(p.x, p.y + 0.32, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      poleMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, p.y + 1.72, p.z);
      dummy.updateMatrix();
      lampMesh.setMatrixAt(i, dummy.matrix);

      if (i % 2 === 0) {
        this._addGlowSprite(
          group,
          new THREE.Vector3(p.x, p.y + 1.74, p.z),
          '#ffaa44',
          3.4,
          0.44
        );
      }
    }
    poleMesh.instanceMatrix.needsUpdate = true;
    lampMesh.instanceMatrix.needsUpdate = true;
    group.add(poleMesh);
    group.add(lampMesh);

    // Marine navigation clearance beacons on Vão Central
    const navMid = this.bridgeCurve.getPoint(0.46);
    const navL = this.bridgeCurve.getPoint(0.422);
    const navR = this.bridgeCurve.getPoint(0.498);
    this._addGlowSprite(group, new THREE.Vector3(navMid.x, navMid.y - 1.55, navMid.z), '#44ff88', 3.4, 0.85);
    this._addGlowSprite(group, new THREE.Vector3(navL.x, navL.y - 1.35, navL.z), '#ff3b2f', 3.0, 0.80);
    this._addGlowSprite(group, new THREE.Vector3(navR.x, navR.y - 1.35, navR.z), '#ff3b2f', 3.0, 0.80);

    // Smooth Dual-Lane Bridge Traffic (160 crisp miniature white headlights & ruby taillights!)
    const carCount = 160;
    const carGeom = new THREE.BoxGeometry(0.24, 0.14, 0.56);
    const carMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.bridgeCarsMesh = new THREE.InstancedMesh(carGeom, carMat, carCount);
    this.bridgeCarsMesh.frustumCulled = false;

    this.bridgeCars = [];
    const headCol = new THREE.Color(2.2, 1.98, 1.52);
    const tailCol = new THREE.Color(2.3, 0.25, 0.14);
    for (let i = 0; i < carCount; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const laneSub = (i % 4 < 2) ? 0.58 : 1.04;
      this.bridgeCars.push({
        t: (i / carCount + ((i * 0.137) % 1)) % 1,
        speed: (0.010 + (i % 7) * 0.0014) * dir,
        laneOffset: dir * laneSub,
      });
      this.bridgeCarsMesh.setColorAt(i, dir > 0 ? headCol : tailCol);
    }
    if (this.bridgeCarsMesh.instanceColor) this.bridgeCarsMesh.instanceColor.needsUpdate = true;
    group.add(this.bridgeCarsMesh);

    this.group.add(group);
  }

  // 6. ESTAÇÃO HIDROVIÁRIA DE CHARITAS (Oscar Niemeyer's Sleek White Curved Concrete Vault & Glass Ferry Terminal!)
  _buildCharitasPier() {
    const shorePt = sampleCrescentCurve(0.73 * Math.PI)(0.0);
    const group = new THREE.Group();
    group.position.set(shorePt.x, 0.35, shorePt.z);
    group.rotation.y = Math.atan2(-4 - shorePt.x, 45 - shorePt.z);

    const concreteMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#646c78'), roughness: 0.72 });
    const canopyWhite = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e6e8ec'),
      emissive: new THREE.Color('#ffdcb0'),
      emissiveIntensity: 0.16, // Crisp shaded modernist white concrete — NEVER glowing yellow mailbox!
      roughness: 0.48,
    });
    this.emissiveMaterials.push({ mat: canopyWhite, base: 0.16 });

    const macGlassTex = createMacGlassTexture();
    const terminalGlass = new THREE.MeshStandardMaterial({
      map: macGlassTex,
      emissiveMap: macGlassTex,
      emissive: new THREE.Color('#ffc272'),
      emissiveIntensity: 0.75,
      roughness: 0.16,
      metalness: 0.55,
    });
    this.emissiveMaterials.push({ mat: terminalGlass, base: 0.75 });

    const steelMat = new THREE.MeshStandardMaterial({ color: '#343c48', roughness: 0.5, metalness: 0.65 });
    const lampHdr = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.72, 0.88) });

    // Concrete pier walkway extending over the bay on paired pilings
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.36, 22.0), concreteMat);
    deck.position.set(0, 0.42, 9.5);
    group.add(deck);

    // Pier side railings
    for (const sx of [-1.22, 1.22]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 21.5), steelMat);
      rail.position.set(sx, 0.82, 9.5);
      group.add(rail);
    }

    for (let z = 1; z <= 20; z += 3.0) {
      for (const sx of [-1.05, 1.05]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.2, 6), concreteMat);
        pile.position.set(sx, -0.85, z);
        group.add(pile);
      }
    }

    // Niemeyer white curved vaulted shell pavilion + dark mullioned glass passenger hall
    const terminalPlatform = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.35, 7.6), concreteMat);
    terminalPlatform.position.set(0, 0.45, 18.0);
    group.add(terminalPlatform);

    const terminalRoof = new THREE.Mesh(
      new THREE.CylinderGeometry(2.85, 2.85, 7.4, 24, 1, true, 0, Math.PI),
      canopyWhite
    );
    terminalRoof.rotation.z = Math.PI * 0.5;
    terminalRoof.rotation.y = Math.PI * 0.5;
    terminalRoof.scale.set(1.0, 0.46, 1.0);
    terminalRoof.position.set(0, 1.52, 18.0);
    group.add(terminalRoof);

    // Curved ceiling underside light glow & panoramic glass hall
    const terminalHall = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.15, 5.4), terminalGlass);
    terminalHall.position.set(0, 1.15, 18.0);
    group.add(terminalHall);

    // Floating catamaran docking pontoon beside terminal
    const pontoon = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.28, 5.6), steelMat);
    pontoon.position.set(3.4, 0.14, 18.5);
    group.add(pontoon);

    for (let z = 1.5; z <= 14.5; z += 3.2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.15, 5), steelMat);
      pole.position.set(0, 1.12, z);
      group.add(pole);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), lampHdr);
      bulb.position.set(0, 1.72, z);
      group.add(bulb);
      this._addGlowSprite(group, new THREE.Vector3(0, 1.74, z), '#ffc46a', 2.8, 0.46);
    }
    this._addGlowSprite(group, new THREE.Vector3(0, 1.65, 18.2), '#ffd898', 5.2, 0.40);

    this.group.add(group);
  }

  // 7. FORTALEZA DE SANTA CRUZ DA BARRA & COASTAL LIGHTHOUSE BEACON
  _buildFortalezaAndBeacons() {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#787064'),
      emissive: new THREE.Color('#966a3c'),
      emissiveIntensity: 0.24,
      roughness: 0.86,
    });
    const whiteTowerMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#e2ddd2'),
      emissive: new THREE.Color('#ffd090'),
      emissiveIntensity: 0.22,
      roughness: 0.68,
    });

    const fx = -114;
    const fz = -24;
    const fy = Math.max(1.2, getTerrainHeight(fx, fz));
    const fort = new THREE.Group();
    fort.position.set(fx, fy - 0.45, fz);
    fort.rotation.y = 0.65;

    // Angled historic coastal stone fort ramparts & corner bastions
    const wallMain = new THREE.Mesh(new THREE.BoxGeometry(11.0, 2.4, 3.8), stoneMat);
    wallMain.position.y = 1.1;
    fort.add(wallMain);
    const wallWing = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 3.2), stoneMat);
    wallWing.position.set(-4.2, 1.0, 2.2);
    wallWing.rotation.y = 0.55;
    fort.add(wallWing);
    for (const sx of [-5.2, 0, 5.2]) {
      const bastion = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 2.7, 8), stoneMat);
      bastion.position.set(sx, 1.25, 1.7);
      fort.add(bastion);
    }

    // White historic Barra lighthouse tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.82, 4.2, 10), whiteTowerMat);
    tower.position.set(3.8, 2.6, 0.5);
    fort.add(tower);
    const fortBeacon = this._addGlowSprite(
      fort,
      new THREE.Vector3(3.8, 4.9, 0.5),
      '#fff4d2',
      4.5,
      0.86
    );
    this.beaconLights.push({ sprite: fortBeacon, phase: 1.5, speed: 1.4 });
    this._addGlowSprite(fort, new THREE.Vector3(0, 1.6, 2.0), '#ffa84a', 5.0, 0.34);
    group.add(fort);

    const px = -24;
    const pz = -26;
    const py = Math.max(1.0, getTerrainHeight(px, pz));
    const tipBeacon = this._addGlowSprite(
      group,
      new THREE.Vector3(px, py + 1.4, pz),
      '#ff4a38',
      3.2,
      0.75
    );
    this.beaconLights.push({ sprite: tipBeacon, phase: 0.7, speed: 2.1 });

    this.group.add(group);
  }

  // 8. ILHA FISCAL (Neo-Gothic Mint-Green Turreted Palace on Rio Bay Islet!) & SANTOS DUMONT RUNWAY APPROACH!
  _buildIlhaFiscalAndAirport() {
    const group = new THREE.Group();

    const ix = -34;
    const iz = -278;
    const iy = Math.max(1.1, getTerrainHeight(ix, iz));
    const palace = new THREE.Group();
    palace.position.set(ix, iy - 0.25, iz);
    palace.rotation.y = 0.42;

    const mintMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7ca892'),
      emissive: new THREE.Color('#6db88c'),
      emissiveIntensity: 0.45,
      roughness: 0.65,
    });
    this.emissiveMaterials.push({ mat: mintMat, base: 0.45 });

    const roofMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#343d48'), roughness: 0.75 });
    const winMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffe0a2'),
      emissive: new THREE.Color('#ffb854'),
      emissiveIntensity: 1.55,
    });
    this.emissiveMaterials.push({ mat: winMat, base: 1.55 });

    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.9, 2.4), mintMat);
    mainHall.position.y = 0.95;
    palace.add(mainHall);

    const winStrip = new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.45, 2.5), winMat);
    winStrip.position.y = 1.05;
    palace.add(winStrip);

    // Signature central Neo-Gothic clock tower & spire + twin flanking turrets!
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4.2, 1.5), mintMat);
    tower.position.y = 2.1;
    palace.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.85, 4), roofMat);
    spire.rotation.y = Math.PI * 0.25;
    spire.position.y = 5.1;
    palace.add(spire);

    for (const sx of [-2.4, 2.4]) {
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 2.6, 8), mintMat);
      turret.position.set(sx, 1.3, 0);
      palace.add(turret);
      const tSpire = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.15, 8), roofMat);
      tSpire.position.set(sx, 3.15, 0);
      palace.add(tSpire);
    }

    this._addGlowSprite(palace, new THREE.Vector3(0, 2.6, 0), '#a8ffd0', 6.8, 0.36);
    group.add(palace);

    // Santos Dumont Airport rhythmic waterfront runway edge & red/white approach lights reflecting cleanly in the bay!
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      const rx = -102 + t * 44;
      const rz = -268 - t * 24;
      const col = i < 3 ? '#ff4636' : i > 12 ? '#54ff92' : '#fff4dc';
      this._addGlowSprite(group, new THREE.Vector3(rx, 1.85, rz), col, 3.6, 0.62);
    }

    this.group.add(group);
  }

  update(elapsed) {
    if (this.bondinhoCurve && this.bondinhoCars) {
      for (const car of this.bondinhoCars) {
        const t = 0.08 + 0.84 * (0.5 + 0.5 * Math.sin(elapsed * 0.12 + car.phase));
        const pos = this.bondinhoCurve.getPoint(t);
        car.mesh.position.set(pos.x, pos.y, pos.z + car.offsetZ);
      }
    }

    if (this.bridgeCurve && this.bridgeCarsMesh) {
      const dummy = new THREE.Object3D();
      const tangent = new THREE.Vector3();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);

      for (let i = 0; i < this.bridgeCars.length; i++) {
        const c = this.bridgeCars[i];
        let t = (c.t + elapsed * c.speed) % 1;
        if (t < 0) t += 1;
        const p = this.bridgeCurve.getPoint(t);
        this.bridgeCurve.getTangent(t, tangent);
        right.crossVectors(tangent, up).normalize();

        dummy.position.set(
          p.x + right.x * c.laneOffset,
          p.y + 0.38,
          p.z + right.z * c.laneOffset
        );
        dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
        dummy.scale.setScalar(1.0);
        dummy.updateMatrix();
        this.bridgeCarsMesh.setMatrixAt(i, dummy.matrix);
      }
      this.bridgeCarsMesh.instanceMatrix.needsUpdate = true;
    }

    for (const b of this.beaconLights) {
      const pulse = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * b.speed + b.phase), 3.0);
      b.sprite.material.opacity = pulse;
    }
  }

  applyPreset(preset) {
    const scale = preset.cityEmissiveScale;
    for (const item of this.emissiveMaterials) {
      item.mat.emissiveIntensity = item.base * (0.55 + 0.45 * scale);
    }
    for (const g of this.glowSprites) {
      g.sprite.material.opacity = Math.min(1.0, g.baseOpacity * (0.5 + 0.5 * scale));
    }
  }
}
