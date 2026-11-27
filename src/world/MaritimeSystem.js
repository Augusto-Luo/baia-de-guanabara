import * as THREE from 'three';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Sculpted tapered nautical ship/boat hull (curved pointed bow prow + sheer stern, NOT a plain box!)
function buildTaperedHullGeometry(width, height, length) {
  const shape = new THREE.Shape();
  const hw = width * 0.5;
  const hl = length * 0.5;
  shape.moveTo(0, hl); // Pointed bow
  shape.quadraticCurveTo(hw * 0.95, hl * 0.42, hw, -hl * 0.15);
  shape.lineTo(hw * 0.88, -hl); // Stern starboard
  shape.lineTo(-hw * 0.88, -hl); // Stern port
  shape.lineTo(-hw, -hl * 0.15);
  shape.quadraticCurveTo(-hw * 0.95, hl * 0.42, 0, hl);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: height * 0.12,
    bevelSize: width * 0.04,
    bevelSegments: 2,
  });
  // Extrude is in XY with depth along +Z; rotate so bow faces +Z and height is along +Y!
  geom.rotateX(Math.PI * 0.5);
  geom.translate(0, height * 0.5, 0);
  geom.computeVertexNormals();
  return geom;
}

// Detailed Maritime Life on Baía de Guanabara:
// - Signature center-cove bright boat at (-4, 0, 15) casting a crisp slender vertical white-gold water reflection!
// - Detailed offshore support vessel / jack-up rig ship in the outer central bay (+12, 0, -138)
// - Sculpted Niterói–Rio Catamaran Ferry with twin tapered pontoons & live Kelvin V-wake
// - Detailed anchored bay bulk carriers/tankers with tapered bows, hatch covers, cranes & illuminated bridges
// - Graceful moored sailboats & yachts in Charitas & Jurujuba coves with tapered hulls, booms & anchor lights!
export class MaritimeSystem {
  constructor({ glowTex }) {
    this.group = new THREE.Group();
    this.group.name = 'MaritimeSystem';
    this.glowTex = glowTex;
    this.bobbingVessels = [];

    this.ferryPos = new THREE.Vector3(-42, 0, 62);
    this.ferryDir = new THREE.Vector2(0.4, -0.9);

    this._buildSignatureCenterCoveBoat();
    this._buildOuterBayIlluminatedShip();
    this._buildAnimatedCatamaranFerry();
    this._buildAnchoredFreighters();
    this._buildMarinaBoats();
  }

  _addLightGlow(parent, pos, colorHex, scale, opacity = 0.85) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    sprite.position.copy(pos);
    sprite.scale.set(scale, scale, 1);
    parent.add(sprite);
    return sprite;
  }

  // Exact iconic illuminated boat sitting calmly in the middle of Enseada de São Francisco!
  _buildSignatureCenterCoveBoat() {
    const boat = new THREE.Group();
    boat.position.set(-4.0, 0.05, 15.0);
    boat.rotation.y = 0.35;

    const hullMat = new THREE.MeshStandardMaterial({ color: '#2b3442', roughness: 0.52, metalness: 0.12 });
    const deckWhite = new THREE.MeshStandardMaterial({ color: '#dcdde2', roughness: 0.45 });
    const cabinMat = new THREE.MeshStandardMaterial({
      color: '#f5f2ec',
      emissive: '#ffdfaa',
      emissiveIntensity: 1.85,
    });
    const mastLightMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(3.4, 2.9, 2.1),
    });

    const hull = new THREE.Mesh(buildTaperedHullGeometry(1.15, 0.52, 3.4), hullMat);
    hull.position.y = 0.14;
    boat.add(hull);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.58, 1.55), cabinMat);
    cabin.position.set(0, 0.65, -0.22);
    boat.add(cabin);

    const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 1.65), deckWhite);
    cabinRoof.position.set(0, 0.98, -0.22);
    boat.add(cabinRoof);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.05, 5), deckWhite);
    mast.position.set(0, 1.48, -0.22);
    boat.add(mast);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mastLightMat);
    lamp.position.set(0, 2.02, -0.22);
    boat.add(lamp);

    this._addLightGlow(boat, new THREE.Vector3(0, 2.02, -0.22), '#fff2d2', 4.8, 0.92);
    this._addLightGlow(boat, new THREE.Vector3(0, 0.78, 0.6), '#ffbe66', 3.4, 0.62);

    this.group.add(boat);
    this.bobbingVessels.push({ obj: boat, phase: 0.4, amp: 0.045 });
  }

  // Detailed illuminated offshore supply vessel / jack-up rig ship in outer central bay (+12, -138)
  _buildOuterBayIlluminatedShip() {
    const ship = new THREE.Group();
    ship.position.set(12.0, 0.1, -138.0);
    ship.rotation.y = -0.22;

    const darkHull = new THREE.MeshStandardMaterial({ color: '#242c38', roughness: 0.62 });
    const redBoot = new THREE.MeshStandardMaterial({ color: '#782822', roughness: 0.68 });
    const whiteSuper = new THREE.MeshStandardMaterial({ color: '#d8dbe2', roughness: 0.55 });
    const litBridge = new THREE.MeshStandardMaterial({
      color: '#ffe4b4',
      emissive: '#ffb852',
      emissiveIntensity: 2.2,
    });
    const hdrMast = new THREE.MeshBasicMaterial({
      color: new THREE.Color(3.0, 2.0, 0.95),
    });

    const hull = new THREE.Mesh(buildTaperedHullGeometry(3.6, 1.35, 12.2), darkHull);
    hull.position.y = 0.52;
    ship.add(hull);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.32, 9.8), redBoot);
    boot.position.set(0, 0.06, -0.5);
    ship.add(boot);

    // Tiered bridge accommodation block with illuminated windows
    const lowerAccom = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.5, 3.6), whiteSuper);
    lowerAccom.position.set(0, 1.85, -2.6);
    ship.add(lowerAccom);

    const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.55, 2.8), litBridge);
    bridgeWin.position.set(0, 2.88, -2.5);
    ship.add(bridgeWin);

    const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.28, 3.0), whiteSuper);
    bridgeRoof.position.set(0, 3.28, -2.5);
    ship.add(bridgeRoof);

    // Helipad ring on stern + offshore lattice derrick crane boom!
    const helipad = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.16, 14), darkHull);
    helipad.position.set(0, 3.55, -2.5);
    ship.add(helipad);

    const derrick = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.56, 5.2, 6), darkHull);
    derrick.position.set(0, 4.9, 1.4);
    ship.add(derrick);

    const craneBoom = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 4.8), whiteSuper);
    craneBoom.position.set(0.5, 5.2, 3.1);
    craneBoom.rotation.x = -0.45;
    ship.add(craneBoom);

    const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 8), hdrMast);
    topLight.position.set(0, 7.6, 1.4);
    ship.add(topLight);

    this._addLightGlow(ship, new THREE.Vector3(0, 3.1, -1.8), '#ffc466', 10.5, 0.85);
    this._addLightGlow(ship, new THREE.Vector3(0, 7.6, 1.4), '#ffe2a6', 7.8, 0.74);
    this._addLightGlow(ship, new THREE.Vector3(-1.8, 2.4, 3.8), '#ff3e30', 3.0, 0.75);
    this._addLightGlow(ship, new THREE.Vector3(1.8, 2.4, 3.8), '#3cff88', 3.0, 0.75);

    this.group.add(ship);
    this.bobbingVessels.push({ obj: ship, phase: 1.7, amp: 0.055 });
  }

  // Animated Niterói (Charitas) <-> Rio Catamaran Ferry gliding smoothly with live Kelvin V-wake
  _buildAnimatedCatamaranFerry() {
    this.ferryRoute = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-58, 0.08, 86),
        new THREE.Vector3(-24, 0.08, 42),
        new THREE.Vector3(4, 0.08, -18),
        new THREE.Vector3(-12, 0.08, -86),
        new THREE.Vector3(-42, 0.08, -155),
        new THREE.Vector3(-22, 0.08, -110),
        new THREE.Vector3(18, 0.08, -32),
        new THREE.Vector3(-18, 0.08, 48),
      ],
      true
    );

    const ferry = new THREE.Group();
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#e6e8ec', roughness: 0.35 });
    const blueStripeMat = new THREE.MeshStandardMaterial({ color: '#1b4b8a', roughness: 0.4 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#ffe8be',
      emissive: '#ffbf5e',
      emissiveIntensity: 1.95,
    });

    // Twin sleek tapered catamaran pontoons
    const pontoonGeom = buildTaperedHullGeometry(0.46, 0.44, 4.8);
    for (const sx of [-0.76, 0.76]) {
      const pontoon = new THREE.Mesh(pontoonGeom, whiteMat);
      pontoon.position.set(sx, 0.14, 0);
      ferry.add(pontoon);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 3.9), blueStripeMat);
    deck.position.y = 0.48;
    ferry.add(deck);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.62, 2.8), windowMat);
    cabin.position.set(0, 0.88, -0.15);
    ferry.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.18, 3.0), whiteMat);
    roof.position.set(0, 1.26, -0.15);
    ferry.add(roof);
    const wheelhouse = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.36, 0.85), whiteMat);
    wheelhouse.position.set(0, 1.50, 0.65);
    ferry.add(wheelhouse);

    this._addLightGlow(ferry, new THREE.Vector3(0, 1.35, 1.7), '#fff3d6', 4.0, 0.70);
    this._addLightGlow(ferry, new THREE.Vector3(-0.98, 1.1, 0.4), '#ff3b30', 2.2, 0.70);
    this._addLightGlow(ferry, new THREE.Vector3(0.98, 1.1, 0.4), '#3eff84', 2.2, 0.70);

    this.ferry = ferry;
    this.group.add(ferry);
  }

  // Detailed Anchored Bay Bulk Carriers & Tankers out in Baía de Guanabara
  _buildAnchoredFreighters() {
    const locations = [
      { x: -115, z: -135, rot: 0.45, scale: 1.0 },
      { x: -58, z: -168, rot: -0.6, scale: 1.15 },
      { x: 58, z: -205, rot: 0.2, scale: 1.2 },
      { x: 112, z: -265, rot: -0.35, scale: 1.05 },
    ];

    const hullMat = new THREE.MeshStandardMaterial({ color: '#242b36', roughness: 0.68 });
    const deckMat = new THREE.MeshStandardMaterial({ color: '#58332c', roughness: 0.78 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#d4d8e0', roughness: 0.55 });
    const bridgeWinMat = new THREE.MeshStandardMaterial({
      color: '#ffdfaa',
      emissive: '#ffc472',
      emissiveIntensity: 1.75,
    });

    const freighterHull = buildTaperedHullGeometry(2.8, 1.15, 11.4);

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const ship = new THREE.Group();
      ship.position.set(loc.x, 0.08, loc.z);
      ship.rotation.y = loc.rot;
      ship.scale.setScalar(loc.scale);

      const hull = new THREE.Mesh(freighterHull, hullMat);
      hull.position.y = 0.42;
      ship.add(hull);

      // Cargo hold hatch covers + deck cranes
      for (const hz of [-0.4, 2.0]) {
        const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.36, 1.8), deckMat);
        hatch.position.set(0, 1.12, hz);
        ship.add(hatch);
      }
      const crane = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.4, 6), whiteMat);
      crane.position.set(0, 2.1, 0.8);
      ship.add(crane);

      // Aft accommodation superstructure + lit bridge ribbon
      const accom = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.85, 2.3), whiteMat);
      accom.position.set(0, 1.75, -3.5);
      ship.add(accom);
      const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.42, 1.6), bridgeWinMat);
      bridgeWin.position.set(0, 2.38, -3.2);
      ship.add(bridgeWin);

      this._addLightGlow(ship, new THREE.Vector3(0, 2.75, -3.3), '#ffc978', 7.2, 0.65);
      this._addLightGlow(ship, new THREE.Vector3(0, 1.55, 5.1), '#fff4dc', 4.0, 0.52);

      this.group.add(ship);
      this.bobbingVessels.push({ obj: ship, phase: i * 1.3 + 0.5, amp: 0.05 });
    }
  }

  // Moored sailboats & yachts near Charitas Pier, Jurujuba & São Francisco (graceful tapered hulls, masts & booms!)
  _buildMarinaBoats() {
    const rand = createRng(441122);
    const boats = [];

    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2;
      const r = 4 + Math.sqrt(rand()) * 28;
      boats.push({
        x: -66 + Math.cos(a) * r,
        z: 96 + Math.sin(a) * r * 0.72,
        rot: rand() * Math.PI * 2,
        scale: 0.68 + rand() * 0.62,
        hasMast: rand() < 0.62,
      });
    }
    for (let i = 0; i < 32; i++) {
      const a = rand() * Math.PI * 2;
      const r = 3 + Math.sqrt(rand()) * 24;
      boats.push({
        x: -94 + Math.cos(a) * r,
        z: 56 + Math.sin(a) * r * 0.68,
        rot: rand() * Math.PI * 2,
        scale: 0.64 + rand() * 0.58,
        hasMast: rand() < 0.64,
      });
    }
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const r = 3 + Math.sqrt(rand()) * 16;
      boats.push({
        x: 78 + Math.cos(a) * r,
        z: 96 + Math.sin(a) * r * 0.65,
        rot: rand() * Math.PI * 2,
        scale: 0.68 + rand() * 0.5,
        hasMast: rand() < 0.68,
      });
    }

    const hullGeom = buildTaperedHullGeometry(0.56, 0.26, 1.65);
    const mastGeom = new THREE.CylinderGeometry(0.022, 0.032, 2.05, 4);
    mastGeom.translate(0, 1.02, 0);

    const hullMat = new THREE.MeshStandardMaterial({ color: '#bfc5cf', roughness: 0.45 });
    const mastMat = new THREE.MeshStandardMaterial({ color: '#cfd4de', roughness: 0.35 });

    const hullMesh = new THREE.InstancedMesh(hullGeom, hullMat, boats.length);
    const mastMesh = new THREE.InstancedMesh(mastGeom, mastMat, boats.length);
    hullMesh.frustumCulled = false;
    mastMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < boats.length; i++) {
      const b = boats[i];
      dummy.position.set(b.x, 0.08, b.z);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.setScalar(b.scale);
      dummy.updateMatrix();
      hullMesh.setMatrixAt(i, dummy.matrix);
      // Mix of white yachts & dark navy fishing boats
      const isDark = i % 3 === 0;
      col.setRGB(isDark ? 0.22 : 0.78, isDark ? 0.26 : 0.80, isDark ? 0.32 : 0.84);
      hullMesh.setColorAt(i, col);

      if (b.hasMast) {
        mastMesh.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mastMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    hullMesh.instanceMatrix.needsUpdate = true;
    if (hullMesh.instanceColor) hullMesh.instanceColor.needsUpdate = true;
    mastMesh.instanceMatrix.needsUpdate = true;

    this.group.add(hullMesh);
    this.group.add(mastMesh);
  }

  update(elapsed) {
    for (const v of this.bobbingVessels) {
      v.obj.position.y = 0.06 + Math.sin(elapsed * 1.15 + v.phase) * v.amp;
      v.obj.rotation.z = Math.sin(elapsed * 0.85 + v.phase) * 0.018;
    }

    if (this.ferry && this.ferryRoute) {
      const t = (elapsed * 0.0085) % 1.0;
      const pos = this.ferryRoute.getPointAt(t);
      const tan = this.ferryRoute.getTangentAt(t);
      this.ferry.position.set(pos.x, 0.08 + Math.sin(elapsed * 2.4) * 0.025, pos.z);
      this.ferry.rotation.y = Math.atan2(tan.x, tan.z);

      this.ferryPos.copy(pos);
      const len = Math.hypot(tan.x, tan.z) || 1;
      this.ferryDir.set(tan.x / len, tan.z / len);
    }
  }
}
