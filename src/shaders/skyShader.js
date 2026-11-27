import * as THREE from 'three';

// AAA Photo-Calibrated Volumetric Twilight Sky Dome for Baía de Guanabara:
// Calibrated directly to the reference photograph from Parque da Cidade:
// - Deep velvety royal-indigo upper zenith curving overhead
// - Luminous silvery steel-cerulean & teal sky rifts peeking between dramatic cloud decks
// - High-contrast dark charcoal-slate billowing stratocumulus shelves catching rose-magenta & fiery tangerine bellies
// - Concentrated molten golden-amber sunset window low on the WNW horizon behind Rio & Ponte Rio-Niterói!
export function createSkyMaterial(preset) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uSunDir: { value: preset.sunDir.clone() },
      uSkyZenith: { value: preset.skyZenith.clone() },
      uSkyMid: { value: preset.skyMid.clone() },
      uSkyHorizon: { value: preset.skyHorizon.clone() },
      uSunsetCore: { value: preset.sunsetCore.clone() },
      uSunsetGlow: { value: preset.sunsetGlow.clone() },
      uCloudLight: { value: preset.cloudLight.clone() },
      uCloudMid: { value: preset.cloudMid.clone() },
      uCloudShadow: { value: preset.cloudShadow.clone() },
      uStarVisibility: { value: preset.starVisibility },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSkyZenith;
      uniform vec3 uSkyMid;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSunsetCore;
      uniform vec3 uSunsetGlow;
      uniform vec3 uCloudLight;
      uniform vec3 uCloudMid;
      uniform vec3 uCloudShadow;
      uniform float uStarVisibility;

      varying vec3 vWorldDir;

      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbm5(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.03 + vec2(17.1, 31.7);
          a *= 0.5;
        }
        return v;
      }

      float fbm4(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = rot * p * 2.05 + vec2(11.3, 23.9);
          a *= 0.5;
        }
        return v;
      }

      float starField(vec3 d) {
        vec2 uv = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0))) * 125.0;
        vec2 cell = floor(uv);
        vec2 f = fract(uv) - 0.5;
        float h = hash(cell);
        if (h < 0.9925) return 0.0;
        vec2 offset = (vec2(hash(cell + 13.7), hash(cell + 47.3)) - 0.5) * 0.6;
        float dist = length(f - offset);
        float twinkle = 0.72 + 0.28 * sin(uTime * (2.0 + h * 4.0) + h * 90.0);
        return smoothstep(0.08, 0.01, dist) * twinkle * smoothstep(0.18, 0.55, d.y);
      }

      // Dramatic multi-scale dark-slate stratocumulus deck with bold clear sky rifts (exact reference photo signature!)
      float evalStratocumulus(vec2 uv, vec2 drift) {
        vec2 p = vec2(uv.x * 0.28, uv.y * 0.66) + drift;
        float w1 = fbm4(p * 0.95 + vec2(3.1, -2.4));
        float w2 = fbm4(p * 2.15 + vec2(w1 * 1.65, -w1 * 1.15));
        vec2 warped = p + vec2(w1 * 1.15, w2 * 0.62);

        float broadDeck = fbm5(vec2(warped.x * 0.84, warped.y * 1.85));
        float billows = fbm4(vec2(warped.x * 2.35 - w2 * 0.52, warped.y * 3.9 + w1 * 0.68));
        float fineRift = fbm4(vec2(warped.x * 5.2, warped.y * 8.2));

        float combined = broadDeck * 0.54 + billows * 0.32 + fineRift * 0.14;
        return smoothstep(0.42, 0.72, combined);
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        vec3 sunDir = normalize(uSunDir);

        float elev = clamp(dir.y, -0.15, 1.0);
        float up = max(dir.y, 0.0);

        // 1. Deep Royal-Navy Zenith -> Luminous Silvery Cerulean-Teal Mid-Sky (bold contrast against dark clouds!)
        vec3 sky = mix(uSkyHorizon * 0.90, uSkyMid * 1.32, smoothstep(0.0, 0.16, up));
        sky = mix(sky, uSkyZenith * 0.88, smoothstep(0.18, 0.58, up));

        // Luminous silvery-teal twilight sky belt peeking dramatically between cloud shelves!
        float ceruleanGlow = exp(-abs(up - 0.13) * 8.5) * 0.24;
        sky += vec3(0.30, 0.62, 0.82) * ceruleanGlow;

        // 2. Concentrated Fiery Sunset Slit (Tucked Low on WNW Horizon Right Behind Rio & Bridge!)
        vec2 dirXZ = normalize(dir.xz + vec2(1e-5));
        vec2 sunXZ = normalize(sunDir.xz + vec2(1e-5));
        float azimAlign = clamp(dot(dirXZ, sunXZ), 0.0, 1.0);
        float sunCos = clamp(dot(dir, sunDir), 0.0, 1.0);

        // Tighter vertical falloff keeps the upper sky cool & dramatic instead of washing it pastel peach!
        float tightHorizon = exp(-max(elev, 0.0) * 34.0) * smoothstep(-0.04, 0.004, elev);
        float midHorizon = exp(-max(elev, 0.0) * 16.5) * smoothstep(-0.04, 0.008, elev);
        float roseBelt = exp(-max(elev, 0.0) * 18.0) * smoothstep(-0.03, 0.008, elev);

        float coreFocus = pow(azimAlign, 13.0) * tightHorizon;
        float warmSpread = pow(azimAlign, 5.2) * midHorizon;
        float roseSpread = pow(azimAlign, 1.35) * roseBelt;

        sky += uSunsetGlow * roseSpread * 0.48;
        sky += uSunsetCore * warmSpread * 0.82;
        sky += (uSunsetCore * 1.45 + vec3(0.50, 0.22, 0.02)) * coreFocus * 1.25;

        // 3. Dramatic Sweeping Multi-Altitude Twilight Cloud Decks
        if (dir.y > -0.025) {
          // --- Layer A: High Sweeping Arching Dark-Plum & Indigo Cirrus Ribbons ---
          float yProjHigh = max(dir.y, 0.016) + 0.145;
          vec2 uvHigh = dir.xz / yProjHigh;
          vec2 driftHigh = vec2(uTime * 0.0018, -uTime * 0.0009);

          vec2 cP = vec2(uvHigh.x * 0.22, uvHigh.y * 0.48) + driftHigh;
          float cWarp = fbm4(cP * 1.15 + vec2(6.4, -4.2));
          float cirrusNoise = fbm5(vec2(cP.x * 0.88 + cWarp * 0.95, cP.y * 2.8 - cWarp * 0.6));
          float cirrusDetail = fbm4(vec2(cP.x * 3.4, cP.y * 8.0 + cWarp));
          float cirrus = smoothstep(0.46, 0.78, cirrusNoise * 0.70 + cirrusDetail * 0.30);
          cirrus *= smoothstep(0.02, 0.14, dir.y) * smoothstep(0.92, 0.18, dir.y);

          float cirrusWarm = exp(-up * 6.5) * pow(azimAlign, 1.6);
          vec3 cirrusCol = mix(uCloudShadow * 0.82, uCloudMid * 0.98, clamp(cirrusWarm * 1.15, 0.0, 1.0));
          cirrusCol = mix(cirrusCol, uCloudLight * 1.18, pow(azimAlign, 4.2) * exp(-up * 13.0));
          sky = mix(sky, cirrusCol, cirrus * 0.62);

          // --- Layer B: Mid-Altitude High-Contrast Dark-Slate Stratocumulus Shelves (3-Step Sun Optical Depth!) ---
          float yProjMid = max(dir.y, 0.014) + 0.092;
          vec2 uvMid = dir.xz / yProjMid;
          vec2 driftMid = vec2(uTime * 0.0028, -uTime * 0.0013);

          float density = evalStratocumulus(uvMid, driftMid);
          float horizonFade = smoothstep(0.009, 0.062, dir.y);
          float zenithFade = smoothstep(0.95, 0.16, dir.y);
          density *= horizonFade * (0.68 + 0.32 * zenithFade);

          if (density > 0.005) {
            vec2 stepSun = sunXZ * 0.09;
            float d1 = evalStratocumulus(uvMid + stepSun * 0.8, driftMid);
            float d2 = evalStratocumulus(uvMid + stepSun * 2.0, driftMid);
            float d3 = evalStratocumulus(uvMid + stepSun * 3.6, driftMid);
            float opticalDepth = d1 * 0.48 + d2 * 0.34 + d3 * 0.18;

            float transmittance = exp(-opticalDepth * 2.8);
            float silverLining = clamp((density - d1) * 2.8 + 0.32, 0.0, 1.0) * (0.42 + 0.58 * transmittance);

            // Bold brooding slate-charcoal cloud bellies overhead; fiery crimson-orange glowing undersides near horizon!
            float lowFire = exp(-up * 16.5) * pow(azimAlign, 2.5);
            float midRose = exp(-up * 8.6) * pow(azimAlign, 1.25);

            vec3 darkBelly = mix(uCloudShadow * 0.52, uCloudShadow * 0.96 + uSkyMid * 0.12, silverLining * 0.38);
            vec3 roseLit = mix(darkBelly, uCloudMid * 1.12, clamp(midRose * (0.28 + 0.90 * silverLining), 0.0, 1.0));
            vec3 fireLit = mix(roseLit, uCloudLight * 1.48, clamp(lowFire * (0.34 + 0.96 * silverLining), 0.0, 1.0));

            // Incandescent fiery orange-gold under-rim right above the sunset slit
            float rimFire = pow(sunCos, 6.5) * exp(-up * 15.0) * transmittance * (0.48 + 0.52 * silverLining);
            fireLit += (uSunsetCore * 1.55 + vec3(0.42, 0.16, 0.01)) * rimFire * 1.25;

            sky = mix(sky, fireLit, clamp(density * 0.94, 0.0, 0.95));
          }

          // --- Layer C: Dark Silhouetted Low Cloud Bars Framing the Molten Sunset Core (Reference Photo Signature!) ---
          float yProjLow = max(dir.y, 0.010) + 0.050;
          vec2 uvLow = dir.xz / yProjLow;
          float lowWisp = fbm4(vec2(uvLow.x * 0.46 + driftMid.x * 1.8, uvLow.y * 2.6));
          float lowLayer = smoothstep(0.46, 0.74, lowWisp) * exp(-max(dir.y - 0.012, 0.0) * 26.0) * smoothstep(0.003, 0.015, dir.y);
          vec3 lowBarDark = mix(uCloudShadow * 0.65, uSunsetGlow * 0.85, pow(azimAlign, 1.8));
          vec3 lowBarCol = mix(lowBarDark, uSunsetCore * 1.45, smoothstep(0.48, 0.62, lowWisp) * pow(azimAlign, 3.8));
          sky = mix(sky, lowBarCol, lowLayer * 0.68);
        }

        // 4. Subtle Twinkling Stars High Overhead
        if (uStarVisibility > 0.01 && dir.y > 0.22) {
          float s = starField(dir);
          sky += vec3(0.85, 0.90, 1.0) * s * uStarVisibility * 1.15;
        }

        if (dir.y < 0.0) {
          sky = mix(sky, uSkyZenith * 0.70, smoothstep(0.0, -0.14, dir.y));
        }

        sky = clamp(sky, vec3(0.0), vec3(14.0));
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  });
}
