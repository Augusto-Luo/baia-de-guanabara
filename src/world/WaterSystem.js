import * as THREE from 'three';
import { getTerrainHeight, GEO_FIELD_BOUNDS } from '../config/geography.js';
import { createWaterMaterial } from '../shaders/waterShader.js';

// Fullscreen triangle helper for GPU reflection vertical shimmer streak pre-filter passes
function createFullscreenQuad(material) {
  const geom = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geom, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { scene, camera, mesh };
}

// Pass A: Extract bright HDR lights (cities, coastal lamps, bridge, ships, fiery sunset core)
// and stretch them smoothly along the vertical reflection axis (17 weighted taps!)
function createVerticalStreakPass1Material() {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tInput: { value: null },
      uTexelSize: { value: new THREE.Vector2(1 / 512, 1 / 256) },
      uThreshold: { value: 0.58 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tInput;
      uniform vec2 uTexelSize;
      uniform float uThreshold;
      varying vec2 vUv;

      float sanitize(float x) {
        return (x >= 0.0 && x <= 20.0) ? x : ((x > 20.0 && x < 1e20) ? 20.0 : 0.0);
      }

      vec3 fetchBright(vec2 uv) {
        vec3 c = texture2D(tInput, clamp(uv, vec2(0.002), vec2(0.998))).rgb;
        c = vec3(sanitize(c.r), sanitize(c.g), sanitize(c.b));
        float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // Soft-knee bright HDR extraction so glowing lamps, windows, bridge & ships form shimmering ribbons
        float mask = smoothstep(uThreshold, uThreshold + 0.85, luma);
        return c * mask;
      }

      void main() {
        vec3 accum = vec3(0.0);
        float wSum = 0.0;
        // 17-tap exponentially weighted vertical stretch spanning ~64px in reflection space!
        for (int i = -8; i <= 8; i++) {
          float fi = float(i);
          float w = exp(-abs(fi) * 0.24);
          vec2 off = vec2(0.0, fi * uTexelSize.y * 2.2);
          accum += fetchBright(vUv + off) * w;
          wSum += w;
        }
        // Subtle extra horizontal averaging (3-tap) to eliminate single-pixel aliasing flicker
        vec3 leftB = fetchBright(vUv + vec2(-uTexelSize.x * 1.1, 0.0));
        vec3 rightB = fetchBright(vUv + vec2(uTexelSize.x * 1.1, 0.0));
        vec3 res = (accum / max(wSum, 1e-4)) * 0.86 + (leftB + rightB) * 0.07;
        gl_FragColor = vec4(res, 1.0);
      }
    `,
  });
}

// Pass B: Second vertical cascade stretch (produces buttery-smooth, continuous long twilight light pillars
// extending down across the bay surface with ZERO discrete dotted stepping!)
function createVerticalStreakPass2Material() {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tInput: { value: null },
      uTexelSize: { value: new THREE.Vector2(1 / 512, 1 / 256) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tInput;
      uniform vec2 uTexelSize;
      varying vec2 vUv;

      void main() {
        vec3 accum = vec3(0.0);
        float wSum = 0.0;
        // Wider vertical cascade (asymmetric bias stretching slightly further downward toward camera!)
        for (int i = -6; i <= 8; i++) {
          float fi = float(i);
          float w = exp(-abs(fi) * 0.26);
          vec2 uv = clamp(vUv + vec2(0.0, fi * uTexelSize.y * 4.4), vec2(0.002), vec2(0.998));
          accum += texture2D(tInput, uv).rgb * w;
          wSum += w;
        }
        vec3 center = texture2D(tInput, vUv).rgb;
        vec3 res = mix(center, accum / max(wSum, 1e-4), 0.72);
        gl_FragColor = vec4(res, 1.0);
      }
    `,
  });
}

// AAA Real-Time HDR Planar Reflection + Dual-Pass Anisotropic Light-Column Water System for Baía de Guanabara
export class WaterSystem {
  constructor({ swellNormalMap, capillaryNormalMap, geoFieldTex, preset, quality = 'ultra' }) {
    this.quality = quality;
    this.waterY = 0.0;

    // Virtual mirrored camera & math scratch objects (zero per-frame allocations)
    this.virtualCamera = new THREE.PerspectiveCamera();
    this.reflectorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.normal = new THREE.Vector3(0, 1, 0);
    this.reflectorWorldPosition = new THREE.Vector3(0, this.waterY, 0);
    this.cameraWorldPosition = new THREE.Vector3();
    this.rotationMatrix = new THREE.Matrix4();
    this.lookAtPosition = new THREE.Vector3(0, 0, -1);
    this.clipPlane = new THREE.Vector4();
    this.view = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.q = new THREE.Vector4();
    this.textureMatrix = new THREE.Matrix4();

    // Create HDR HalfFloat reflection render target + dual-pass anisotropic vertical shimmer targets
    this._createRenderTargets(quality);

    this.streakMat1 = createVerticalStreakPass1Material();
    this.streakMat2 = createVerticalStreakPass2Material();
    this.streakPass1 = createFullscreenQuad(this.streakMat1);
    this.streakPass2 = createFullscreenQuad(this.streakMat2);

    this.material = createWaterMaterial({
      swellNormalMap,
      capillaryNormalMap,
      geoFieldTex,
      geoBounds: GEO_FIELD_BOUNDS,
      reflectionTexture: this.renderTarget.texture,
      streakTexture: this.streakTargetB.texture,
      preset,
    });

    this.mesh = this._buildAdaptiveWaterMesh();
    this.mesh.name = 'GuanabaraBayWater';
  }

  _getResolutionForQuality(quality) {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 720;
    const aspect = Math.max(1.0, w / Math.max(1, h));
    if (quality === 'medium') return { w: Math.round(620 * aspect), h: 620 };
    if (quality === 'high') return { w: Math.round(860 * aspect), h: 860 };
    return { w: Math.min(2048, Math.round(1120 * aspect)), h: Math.min(1280, 1120) };
  }

  _createRenderTargets(quality) {
    const res = this._getResolutionForQuality(quality);
    this.renderTarget = new THREE.WebGLRenderTarget(res.w, res.h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      samples: quality === 'ultra' ? 4 : quality === 'high' ? 2 : 0,
    });
    this.renderTarget.texture.generateMipmaps = false;

    const sw = Math.max(256, Math.round(res.w * 0.5));
    const sh = Math.max(160, Math.round(res.h * 0.5));
    const streakOpts = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.streakTargetA = new THREE.WebGLRenderTarget(sw, sh, streakOpts);
    this.streakTargetA.texture.generateMipmaps = false;
    this.streakTargetB = new THREE.WebGLRenderTarget(sw, sh, streakOpts);
    this.streakTargetB.texture.generateMipmaps = false;
  }

  setQuality(quality) {
    if (quality === this.quality) return;
    this.quality = quality;
    this.renderTarget.dispose();
    this.streakTargetA.dispose();
    this.streakTargetB.dispose();
    this._createRenderTargets(quality);
    this.material.uniforms.uReflectionTex.value = this.renderTarget.texture;
    this.material.uniforms.uStreakTex.value = this.streakTargetB.texture;
  }

  resize() {
    const res = this._getResolutionForQuality(this.quality);
    this.renderTarget.setSize(res.w, res.h);
    const sw = Math.max(256, Math.round(res.w * 0.5));
    const sh = Math.max(160, Math.round(res.h * 0.5));
    this.streakTargetA.setSize(sw, sh);
    this.streakTargetB.setSize(sw, sh);
  }

  // Adaptive water mesh concentrating vertex density in Enseada de São Francisco & mid-bay
  // while per-pixel uGeoField guarantees razor-smooth shorelines everywhere!
  _buildAdaptiveWaterMesh() {
    const segX = 240;
    const segZ = 240;
    const vertCount = (segX + 1) * (segZ + 1);
    const positions = new Float32Array(vertCount * 3);
    const shoreDepth = new Float32Array(vertCount);

    const mapX = (u) => {
      const s = Math.sign(u);
      const a = Math.abs(u);
      return s * (280.0 * a + 720.0 * a * a * a);
    };
    const mapZ = (v) => {
      // v in [0, 1] -> foreground (+245) to far bay/horizon (-1080)
      const lin = 245.0 - v * 580.0;
      const farStretch = -745.0 * Math.pow(Math.max(0, v - 0.36) / 0.64, 2.0);
      return lin + farStretch;
    };

    let ptr = 0;
    let p3 = 0;
    for (let iz = 0; iz <= segZ; iz++) {
      const z = mapZ(iz / segZ);
      for (let ix = 0; ix <= segX; ix++) {
        const u = (ix / segX) * 2.0 - 1.0;
        const x = mapX(u);
        positions[p3] = x;
        positions[p3 + 1] = this.waterY;
        positions[p3 + 2] = z;

        const groundH = getTerrainHeight(x, z);
        shoreDepth[ptr] = this.waterY - groundH;
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
    geom.setAttribute('aShoreDepth', new THREE.BufferAttribute(shoreDepth, 1));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeBoundingSphere();

    const mesh = new THREE.Mesh(geom, this.material);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    return mesh;
  }

  // Render mirrored planar reflection pass + 2-pass anisotropic vertical light-ribbon pre-filter
  renderReflection(renderer, scene, camera, onBeforeReflection, onAfterReflection) {
    camera.updateMatrixWorld();
    this.cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
    if (this.cameraWorldPosition.y <= this.waterY + 0.05) return;

    this.reflectorWorldPosition.set(0, this.waterY, 0);
    this.normal.set(0, 1, 0);

    // Mirror camera position across y = 0
    this.view.subVectors(this.reflectorWorldPosition, this.cameraWorldPosition);
    this.view.reflect(this.normal).negate();
    this.view.add(this.reflectorWorldPosition);

    // Mirror look target across y = 0
    this.rotationMatrix.extractRotation(camera.matrixWorld);
    this.lookAtPosition.set(0, 0, -1);
    this.lookAtPosition.applyMatrix4(this.rotationMatrix);
    this.lookAtPosition.add(this.cameraWorldPosition);

    this.target.subVectors(this.reflectorWorldPosition, this.lookAtPosition);
    this.target.reflect(this.normal).negate();
    this.target.add(this.reflectorWorldPosition);

    const vc = this.virtualCamera;
    vc.position.copy(this.view);
    vc.up.set(0, 1, 0);
    vc.up.applyMatrix4(this.rotationMatrix);
    vc.up.reflect(this.normal);
    vc.lookAt(this.target);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.fov = camera.fov;
    vc.aspect = camera.aspect;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    // Compute projective texture matrix BEFORE oblique clip plane
    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0
    );
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    this.material.uniforms.uTextureMatrix.value.copy(this.textureMatrix);

    // Eric Lengyel Oblique Near-Plane Clipping: zero underwater geometry leakage!
    this.reflectorPlane.setFromNormalAndCoplanarPoint(
      this.normal,
      this.reflectorWorldPosition
    );
    this.reflectorPlane.applyMatrix4(vc.matrixWorldInverse);

    this.clipPlane.set(
      this.reflectorPlane.normal.x,
      this.reflectorPlane.normal.y,
      this.reflectorPlane.normal.z,
      this.reflectorPlane.constant
    );

    const pm = vc.projectionMatrix;
    this.q.x = (Math.sign(this.clipPlane.x) + pm.elements[8]) / pm.elements[0];
    this.q.y = (Math.sign(this.clipPlane.y) + pm.elements[9]) / pm.elements[5];
    this.q.z = -1.0;
    this.q.w = (1.0 + pm.elements[10]) / pm.elements[14];

    const dot = this.clipPlane.dot(this.q);
    if (Math.abs(dot) > 1e-6) {
      this.clipPlane.multiplyScalar(2.0 / dot);
      const clipBias = 0.0018;
      pm.elements[2] = this.clipPlane.x;
      pm.elements[6] = this.clipPlane.y;
      pm.elements[10] = this.clipPlane.z + 1.0 - clipBias;
      pm.elements[14] = this.clipPlane.w;
    }

    this.mesh.visible = false;
    if (onBeforeReflection) onBeforeReflection();

    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;

    // 1. Primary ultra-crisp HDR planar reflection render
    renderer.setRenderTarget(this.renderTarget);
    renderer.autoClear = true;
    renderer.clear();
    renderer.render(scene, vc);

    // 2. GPU Anisotropic Vertical Light-Pillar Pre-Filter Pass 1 (HDR bright extract + vertical stretch)
    this.streakMat1.uniforms.tInput.value = this.renderTarget.texture;
    this.streakMat1.uniforms.uTexelSize.value.set(
      1.0 / Math.max(1, this.streakTargetA.width),
      1.0 / Math.max(1, this.streakTargetA.height)
    );
    renderer.setRenderTarget(this.streakTargetA);
    renderer.clear();
    renderer.render(this.streakPass1.scene, this.streakPass1.camera);

    // 3. GPU Anisotropic Vertical Light-Pillar Pre-Filter Pass 2 (silky continuous downward light ribbon!)
    this.streakMat2.uniforms.tInput.value = this.streakTargetA.texture;
    this.streakMat2.uniforms.uTexelSize.value.set(
      1.0 / Math.max(1, this.streakTargetB.width),
      1.0 / Math.max(1, this.streakTargetB.height)
    );
    renderer.setRenderTarget(this.streakTargetB);
    renderer.clear();
    renderer.render(this.streakPass2.scene, this.streakPass2.camera);

    renderer.autoClear = prevAutoClear;
    renderer.setRenderTarget(prevTarget);

    if (onAfterReflection) onAfterReflection();
    this.mesh.visible = true;
  }

  update(elapsed, ferryPos, ferryDir) {
    this.material.uniforms.uTime.value = elapsed;
    if (ferryPos) {
      this.material.uniforms.uFerryPos.value.copy(ferryPos);
    }
    if (ferryDir) {
      this.material.uniforms.uFerryDir.value.copy(ferryDir);
    }
  }

  setWindStrength(val) {
    this.material.uniforms.uWindStrength.value = val;
  }

  setReflectionCrispness(val) {
    this.material.uniforms.uReflectionCrispness.value = val;
  }

  applyPreset(preset) {
    const u = this.material.uniforms;
    u.uSunDir.value.copy(preset.sunDir);
    u.uSunColor.value.copy(preset.sunLightColor);
    u.uSunsetCore.value.copy(preset.sunsetCore);
    u.uSkyHorizon.value.copy(preset.skyHorizon);
    u.uWaterDeep.value.copy(preset.waterDeep);
    u.uWaterShallow.value.copy(preset.waterShallow);
    u.uFogCool.value.copy(preset.fogCool);
    u.uFogWarm.value.copy(preset.fogWarm);
    u.uFogDensity.value = preset.fogDensity;
  }
}
