import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// AAA Cinematic HDR Post-Processing Pipeline:
// 1. HalfFloat HDR RenderPass (4x MSAA)
// 2. NaN/Inf GPU Sanitizer
// 3. Selective Photographic HDR UnrealBloomPass (tight threshold so ONLY crisp lights & sun glints get delicate halation!)
// 4. ACES Filmic Tone-Mapping + Subtle Twilight Film Grade + Shadow-Highlight Split + Vignette + Anti-Banding Micro-Dither
const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uExposure: { value: 1.08 },
    uVignette: { value: 0.22 },
    uTime: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uExposure;
    uniform float uVignette;
    uniform float uTime;
    varying vec2 vUv;

    // Fitted ACES Filmic Tone Mapping Curve (Krzysztof Narkowicz)
    vec3 acesFilm(vec3 x) {
      const float a = 2.51;
      const float b = 0.03;
      const float c = 2.43;
      const float d = 0.59;
      const float e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    float ditherHash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    float sanitizeFloat(float x) {
      return (x >= 0.0 && x <= 24.0) ? x : ((x > 24.0 && x < 1e20) ? 24.0 : 0.0);
    }

    void main() {
      vec3 hdr = texture2D(tDiffuse, vUv).rgb;
      hdr = vec3(sanitizeFloat(hdr.r), sanitizeFloat(hdr.g), sanitizeFloat(hdr.b));

      hdr *= uExposure;

      // ACES Filmic compression preserves fiery sunset oranges & golden coastal avenues without clipping to harsh yellow!
      vec3 col = acesFilm(hdr);

      // Subtle photographic twilight shadow-to-highlight color split (crisp cool deep shadows, luminous golden highlights)
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 shadowTint = vec3(0.96, 0.99, 1.05);
      vec3 highlightTint = vec3(1.03, 1.00, 0.96);
      col *= mix(shadowTint, highlightTint, smoothstep(0.12, 0.78, luma));

      // Delicate filmic vibrancy & gentle S-curve micro-contrast
      col = mix(vec3(luma), col, 1.13);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.10);

      // Subtle wide-angle panoramic vignette
      vec2 centered = (vUv - 0.5) * vec2(1.12, 1.0);
      float vig = 1.0 - dot(centered, centered) * uVignette;
      col *= clamp(vig, 0.68, 1.0);

      // Linear -> sRGB encoding
      col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

      // Micro-dither eliminates 8-bit gradient banding in twilight sky & glossy water reflections!
      float d = (ditherHash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
      col += vec3(d);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const SanitizeHdrShader = {
  uniforms: {
    tDiffuse: { value: null },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    float sanitizeFloat(float x) {
      return (x >= 0.0 && x <= 24.0) ? x : ((x > 24.0 && x < 1e20) ? 24.0 : 0.0);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 rgb = vec3(sanitizeFloat(c.r), sanitizeFloat(c.g), sanitizeFloat(c.b));
      gl_FragColor = vec4(rgb, c.a);
    }
  `,
};

export class PostProcessor {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;

    const size = renderer.getSize(new THREE.Vector2());
    const pixelRatio = renderer.getPixelRatio();

    const rt = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(size.x * pixelRatio)),
      Math.max(1, Math.floor(size.y * pixelRatio)),
      {
        type: THREE.HalfFloatType,
        samples: 4,
      }
    );

    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.sanitizePass = new ShaderPass(SanitizeHdrShader);
    this.composer.addPass(this.sanitizePass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.34, // crisp photographic halation without washing out stone details
      0.52,
      1.12  // selective HDR threshold
    );
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(CinematicGradeShader);
    this.composer.addPass(this.gradePass);
  }

  setBloomStrength(val) {
    this.bloomPass.strength = val;
  }

  setExposure(val) {
    this.gradePass.uniforms.uExposure.value = val;
  }

  resize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  render(elapsed) {
    this.gradePass.uniforms.uTime.value = elapsed;
    this.composer.render();
  }
}
