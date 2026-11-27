import * as THREE from 'three';
import {
  getTerrainHeight,
  getTerrainNormal,
  getUrbanMask,
  getBeachMask,
  GEO_FIELD_BOUNDS,
} from '../config/geography.js';
import { createTerrainMaterial } from '../shaders/terrainShader.js';

// High-resolution adaptive coastal terrain mesh (480x480 = 460k triangles):
// - Ultra-crisp foreground Parque da Cidade & São Francisco / Charitas crescent
// - Sculpted mid-ground Jurujuba headland, Mirante da Boa Viagem (MAC), Sugarloaf, Corcovado, Rio waterfront
// - Expansive distant Serra dos Órgãos twilight mountain horizon
export class TerrainSystem {
  constructor({ forestTex, graniteTex, geoFieldTex, preset }) {
    this.group = new THREE.Group();
    this.group.name = 'TerrainSystem';

    this.material = createTerrainMaterial({
      forestTex,
      graniteTex,
      geoFieldTex,
      geoBounds: GEO_FIELD_BOUNDS,
      preset,
    });

    const mainMesh = this._buildAdaptiveCoastalMesh();
    this.group.add(mainMesh);
  }

  _buildAdaptiveCoastalMesh() {
    const segX = 480;
    const segZ = 480;
    const vertCount = (segX + 1) * (segZ + 1);

    const positions = new Float32Array(vertCount * 3);
    const normals = new Float32Array(vertCount * 3);
    const urbanAttr = new Float32Array(vertCount);
    const beachAttr = new Float32Array(vertCount);

    // Non-linear coordinate mapping concentrating vertex density on Enseada de São Francisco,
    // Parque da Cidade, Jurujuba, MAC cliff, Sugarloaf & Corcovado while extending cleanly to horizon
    const mapX = (u) => {
      const s = Math.sign(u);
      const a = Math.abs(u);
      return s * (275.0 * a + 515.0 * a * a * a);
    };

    const mapZ = (v) => {
      const lin = 310.0 - v * 645.0;
      const farStretch = -595.0 * Math.pow(Math.max(0, v - 0.42) / 0.58, 2.15);
      return lin + farStretch;
    };

    let ptr = 0;
    let p3 = 0;
    for (let iz = 0; iz <= segZ; iz++) {
      const v = iz / segZ;
      const z = mapZ(v);
      for (let ix = 0; ix <= segX; ix++) {
        const u = (ix / segX) * 2.0 - 1.0;
        const x = mapX(u);

        const y = getTerrainHeight(x, z);
        const eps = Math.abs(z) > 460 ? 2.2 : 0.72;
        const n = getTerrainNormal(x, z, eps);

        positions[p3] = x;
        positions[p3 + 1] = y;
        positions[p3 + 2] = z;

        normals[p3] = n.x;
        normals[p3 + 1] = n.y;
        normals[p3 + 2] = n.z;

        urbanAttr[ptr] = getUrbanMask(x, z, y, n.y);
        beachAttr[ptr] = getBeachMask(x, z, y, n.y);

        ptr++;
        p3 += 3;
      }
    }

    const indices = new Uint32Array(segX * segZ * 6);
    let idx = 0;
    const stride = segX + 1;
    for (let iz = 0; iz < segZ; iz++) {
      for (let ix = 0; ix < segX; ix++) {
        const a = iz * stride + ix;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;

        indices[idx++] = a;
        indices[idx++] = b;
        indices[idx++] = c;

        indices[idx++] = b;
        indices[idx++] = d;
        indices[idx++] = c;
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geom.setAttribute('aUrban', new THREE.BufferAttribute(urbanAttr, 1));
    geom.setAttribute('aBeach', new THREE.BufferAttribute(beachAttr, 1));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeBoundingSphere();

    const mesh = new THREE.Mesh(geom, this.material);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  setClipPlane(y) {
    this.material.uniforms.uClipPlaneY.value = y;
  }

  applyPreset(preset) {
    const u = this.material.uniforms;
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
