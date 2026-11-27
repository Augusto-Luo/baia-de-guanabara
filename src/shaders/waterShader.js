import * as THREE from 'three';

// AAA Photorealistic Baía de Guanabara Water Shader:
// - Per-pixel baked Geography Field shoreline depth -> ZERO polygonal zig-zag shoreline edges!
// - Dual-texture 5-octave FFT Swell + High-Frequency Capillary Wave Normal Synthesis + Analytical Micro-Ripples
// - Organic wind-slick mirror-calm glass channels contrasting with satin wind-ruffled breeze fetch patches!
// - Real-time Ultra-Res HDR Planar Reflection + Dual-Pass GPU Anisotropic Continuous Vertical Light Ribbons
//   modulated by razor-fine horizontal capillary wave-facet glitter (photographic twilight city & bridge reflections!)
// - Physical Beer-Lambert shallow beach absorption + Schlick Fresnel + Dual-Lobe GGX Sunset Afterglow Glints
// - Live Catamaran Kelvin V-Wake (divergent + transverse crests) + center boat concentric ripples
export function createWaterMaterial({
  swellNormalMap,
  capillaryNormalMap,
  geoFieldTex,
  geoBounds,
  reflectionTexture,
  streakTexture,
  preset,
}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSwellNormal: { value: swellNormalMap },
      uCapillaryNormal: { value: capillaryNormalMap },
      uGeoField: { value: geoFieldTex },
      uGeoBounds: {
        value: new THREE.Vector4(
          geoBounds.minX,
          geoBounds.minZ,
          1.0 / (geoBounds.maxX - geoBounds.minX),
          1.0 / (geoBounds.maxZ - geoBounds.minZ)
        ),
      },
      uReflectionTex: { value: reflectionTexture },
      uStreakTex: { value: streakTexture },
      uTextureMatrix: { value: new THREE.Matrix4() },
      uWindStrength: { value: 0.28 },
      uReflectionCrispness: { value: 0.88 },
      uSunDir: { value: preset.sunDir.clone() },
      uSunColor: { value: preset.sunLightColor.clone() },
      uSunsetCore: { value: preset.sunsetCore.clone() },
      uSkyHorizon: { value: preset.skyHorizon.clone() },
      uWaterDeep: { value: preset.waterDeep.clone() },
      uWaterShallow: { value: preset.waterShallow.clone() },
      uFogCool: { value: preset.fogCool.clone() },
      uFogWarm: { value: preset.fogWarm.clone() },
      uFogDensity: { value: preset.fogDensity },
      uBoatWakePos: { value: new THREE.Vector3(-4, 0, 15) },
      uFerryPos: { value: new THREE.Vector3(-42, 0, 62) },
      uFerryDir: { value: new THREE.Vector2(0.4, -0.9) },
    },
    vertexShader: /* glsl */ `
      uniform mat4 uTextureMatrix;
      uniform float uTime;
      uniform float uWindStrength;

      attribute float aShoreDepth;

      varying vec4 vReflectCoord;
      varying vec3 vWorldPos;
      varying float vShoreDepth;

      void main() {
        vec3 pos = position;

        float openBay = smoothstep(90.0, -70.0, pos.z);
        float swellAmp = (0.015 + uWindStrength * 0.075) * (0.30 + 0.70 * openBay);
        float w1 = sin(pos.x * 0.085 + pos.z * 0.055 + uTime * 1.15);
        float w2 = cos(pos.x * 0.048 - pos.z * 0.105 + uTime * 0.88);
        pos.y += (w1 * 0.6 + w2 * 0.4) * swellAmp * smoothstep(0.0, 2.8, aShoreDepth);

        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        vShoreDepth = aShoreDepth;
        vReflectCoord = uTextureMatrix * wp;

        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform sampler2D uSwellNormal;
      uniform sampler2D uCapillaryNormal;
      uniform sampler2D uGeoField;
      uniform vec4 uGeoBounds;
      uniform sampler2D uReflectionTex;
      uniform sampler2D uStreakTex;
      uniform float uWindStrength;
      uniform float uReflectionCrispness;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSunsetCore;
      uniform vec3 uSkyHorizon;
      uniform vec3 uWaterDeep;
      uniform vec3 uWaterShallow;
      uniform vec3 uFogCool;
      uniform vec3 uFogWarm;
      uniform float uFogDensity;
      uniform vec3 uBoatWakePos;
      uniform vec3 uFerryPos;
      uniform vec2 uFerryDir;

      varying vec4 vReflectCoord;
      varying vec3 vWorldPos;
      varying float vShoreDepth;

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
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbmLow(vec2 p) {
        float v = 0.0;
        v += 0.58 * noise(p);
        v += 0.28 * noise(p * 2.13 + vec2(5.2, 1.3));
        v += 0.14 * noise(p * 4.31 + vec2(1.7, 9.2));
        return v;
      }

      // 5-Octave Multi-Scale Bay Wave Normal (Swell + Cross-Swell + Directional Capillary + Fine Satin Micro-Ripples!)
      void sampleBayWaveNormals(
        vec2 xz,
        float time,
        float wind,
        float slickMask,
        float dist,
        out vec3 outNormal,
        out float outMicroSlopeZ
      ) {
        // Long & medium directional bay swells
        vec2 uvS1 = xz * 0.020 + vec2(time * 0.0085, -time * 0.0065);
        vec2 uvS2 = xz * 0.044 + vec2(-time * 0.0072, time * 0.0110);
        // Fine wind-driven capillary ripples (gives authentic satin sheen across the bay!)
        vec2 uvC1 = xz * 0.115 + vec2(time * 0.015, time * 0.009);
        vec2 uvC2 = xz * 0.265 + vec2(-time * 0.019, time * 0.016);

        vec3 nS1 = texture2D(uSwellNormal, uvS1).xyz * 2.0 - 1.0;
        vec3 nS2 = texture2D(uSwellNormal, uvS2).xyz * 2.0 - 1.0;
        vec3 nC1 = texture2D(uCapillaryNormal, uvC1).xyz * 2.0 - 1.0;
        vec3 nC2 = texture2D(uCapillaryNormal, uvC2).xyz * 2.0 - 1.0;

        // Distance anti-aliasing for ultra-high-frequency capillary octaves
        float nearFade = smoothstep(380.0, 45.0, dist);
        vec2 slope =
          nS1.xy * 0.36 +
          nS2.xy * 0.28 +
          nC1.xy * (0.24 * (0.35 + 0.65 * nearFade)) +
          nC2.xy * (0.16 * nearFade);

        // Micro-capillary horizontal ripple ridge harmonic (creates crisp delicate horizontal shimmer breaks!)
        float microZ =
          sin(xz.y * 1.45 + xz.x * 0.22 - time * 2.3 + nC1.x * 2.5) * 0.55 +
          sin(xz.y * 3.10 - xz.x * 0.45 + time * 3.1 + nS2.y * 2.2) * 0.45;
        outMicroSlopeZ = microZ;

        // Distinct organic wind-slick calm glass lanes (amp ≈ 0.012) vs satin ruffled breeze patches!
        float baseAmp = (0.042 + wind * 0.24) * mix(0.14, 1.28, slickMask);
        vec2 totalSlope = slope * baseAmp + vec2(0.0, microZ * 0.019 * (0.30 + 0.70 * slickMask));

        // Realistic Kelvin V-Wake (divergent arms + trailing transverse crests) behind the Catamaran Ferry!
        vec2 relF = xz - uFerryPos.xz;
        float along = dot(relF, uFerryDir);
        float across = abs(dot(relF, vec2(-uFerryDir.y, uFerryDir.x)));
        if (along < 0.5 && along > -44.0) {
          float distBack = max(0.0, -along);
          float armRadius = 0.6 + distBack * 0.27;
          float armDist = abs(across - armRadius);
          float armEnv = exp(-armDist * armDist * 0.95) * smoothstep(44.0, 2.5, distBack) * smoothstep(0.0, 1.5, distBack);
          float divergentWave = sin(distBack * 2.2 - across * 3.8 - time * 6.5) * armEnv * 0.28;

          float innerMask = smoothstep(armRadius + 0.6, armRadius * 0.55, across) * smoothstep(32.0, 2.0, distBack);
          float transverseWave = sin(distBack * 1.85 - time * 5.2) * innerMask * 0.075;

          vec2 wakeAxis = vec2(-uFerryDir.y, uFerryDir.x) * sign(dot(relF, vec2(-uFerryDir.y, uFerryDir.x)));
          totalSlope += wakeAxis * divergentWave + uFerryDir * transverseWave;
        }

        // Gentle concentric ring ripples around the signature center-cove boat
        float dBoat = length(xz - uBoatWakePos.xz);
        if (dBoat < 14.0) {
          float ring = sin(dBoat * 2.8 - time * 2.2) * exp(-dBoat * 0.22) * 0.07;
          vec2 bDir = (xz - uBoatWakePos.xz) / max(dBoat, 0.01);
          totalSlope += bDir * ring;
        }

        outNormal = normalize(vec3(totalSlope.x, 1.0, totalSlope.y));
      }

      void main() {
        vec3 viewVec = cameraPosition - vWorldPos;
        float dist = length(viewVec);
        vec3 V = viewVec / max(dist, 1e-4);
        vec3 L = normalize(uSunDir);

        // 1. Exact Per-Pixel Shoreline Depth & Beach Mask from Baked 1024x1024 Geography Field!
        //    Guarantees 100% RAZOR-SMOOTH organic curved coastlines with ZERO polygonal triangle edges!
        vec2 geoUv = (vWorldPos.xz - uGeoBounds.xy) * uGeoBounds.zw;
        float inGeo = step(0.002, geoUv.x) * step(geoUv.x, 0.998) * step(0.002, geoUv.y) * step(geoUv.y, 0.998);
        vec4 geoData = texture2D(uGeoField, clamp(geoUv, vec2(0.002), vec2(0.998)));
        float exactDepth = mix(vShoreDepth, -geoData.r, inGeo);
        float beachMask = geoData.g * inGeo;
        float coveShelter = mix(0.0, geoData.a, inGeo);

        // Discard cleanly underground well beneath land
        if (exactDepth < -0.22) discard;

        // 2. Signature Organic Glassy Calm Slick Lanes vs Gently Ruffled Breeze Bands across Enseada de São Francisco!
        //    (Exact photographic wind-patch texture visible across the foreground bay in the reference photo!)
        vec2 slickUv = vec2(vWorldPos.x * 0.012, vWorldPos.z * 0.022) + vec2(uTime * 0.0018, -uTime * 0.0010);
        float warp = fbmLow(slickUv * 1.45 + vec2(4.1, -2.7));
        float breezePatches = fbmLow(slickUv + vec2(warp * 0.85, -warp * 0.45));
        float fineLanes = fbmLow(vec2(vWorldPos.x * 0.032 + warp * 0.65, vWorldPos.z * 0.056));
        float combinedBreeze = breezePatches * 0.65 + fineLanes * 0.35;
        float slickMask = smoothstep(0.38, 0.66, combinedBreeze) * mix(1.0, 0.72, coveShelter);
        slickMask *= smoothstep(0.0, 1.6, exactDepth);

        float distDamp = mix(1.0, 0.46, smoothstep(95.0, 580.0, dist));
        vec3 N;
        float microSlopeZ;
        sampleBayWaveNormals(vWorldPos.xz, uTime, uWindStrength * distDamp, slickMask, dist, N, microSlopeZ);

        // 3. Projective Planar Reflection Coordinates
        vec2 baseUV = vReflectCoord.xy / max(vReflectCoord.w, 1e-4);

        float crisp = clamp(uReflectionCrispness, 0.15, 1.0);
        float roughFactor = mix(1.30, 0.36, crisp) * (0.36 + uWindStrength * 1.25) * mix(0.22, 1.15, slickMask);
        float grazeFactor = clamp(1.0 - V.y, 0.16, 1.0);

        // Anisotropic wave-slope refraction/reflection displacement (stronger vertically at grazing angles!)
        vec2 distort = vec2(
          N.x * 0.072 * roughFactor,
          N.z * 0.22 * roughFactor * (0.62 + grazeFactor * 1.18)
        );
        float horizAlign = mix(1.0, 0.42, smoothstep(140.0, 660.0, dist));
        distort *= horizAlign;

        // --- A. Razor-Sharp 5-Tap Locally Filtered Planar Reflection (Sky, Clouds, Dark Mountain Silhouettes, Hulls!) ---
        float vMicroSpread = (0.0018 + 0.0075 * roughFactor * grazeFactor) * horizAlign;
        float hMicroSpread = (0.0007 + 0.0022 * roughFactor) * horizAlign;

        vec2 uv0 = clamp(baseUV + distort, vec2(0.002), vec2(0.998));
        vec2 uv1 = clamp(baseUV + distort * 0.85 + vec2(hMicroSpread * microSlopeZ,  vMicroSpread), vec2(0.002), vec2(0.998));
        vec2 uv2 = clamp(baseUV + distort * 0.85 + vec2(-hMicroSpread * microSlopeZ, -vMicroSpread), vec2(0.002), vec2(0.998));
        vec2 uv3 = clamp(baseUV + distort * 1.15 + vec2(0.0,  vMicroSpread * 2.1), vec2(0.002), vec2(0.998));
        vec2 uv4 = clamp(baseUV + distort * 1.15 + vec2(0.0, -vMicroSpread * 2.1), vec2(0.002), vec2(0.998));

        vec3 reflSharp =
          texture2D(uReflectionTex, uv0).rgb * 0.40 +
          texture2D(uReflectionTex, uv1).rgb * 0.19 +
          texture2D(uReflectionTex, uv2).rgb * 0.19 +
          texture2D(uReflectionTex, uv3).rgb * 0.11 +
          texture2D(uReflectionTex, uv4).rgb * 0.11;

        // --- B. Silky Continuous Anisotropic Vertical Light Ribbons (from our 2-Pass GPU Streak Pyramid!) ---
        // Every coastal streetlight, Rio waterfront, Ponte Rio-Niterói lamp & boat forms a razor-authentic
        // continuous shimmering vertical column broken delicately by fine horizontal capillary wavelets!
        vec2 streakUV1 = clamp(baseUV + vec2(distort.x * 0.48, distort.y * 0.62), vec2(0.002), vec2(0.998));
        vec2 streakUV2 = clamp(baseUV + vec2(distort.x * 0.35, distort.y * 0.48 - 0.016 * horizAlign), vec2(0.002), vec2(0.998));
        vec3 streakCol =
          texture2D(uStreakTex, streakUV1).rgb * 0.66 +
          texture2D(uStreakTex, streakUV2).rgb * 0.34;

        // Delicate high-frequency horizontal capillary shimmer break-up (never chunky S-blobs!)
        float capillaryGlint = 0.52 + 0.48 * smoothstep(-0.30, 0.78, microSlopeZ * 0.76 + N.z * 16.0);
        // Stronger streak shimmer on lightly rippled patches, cleaner direct reflection in calm glass slicks!
        float streakWeight = mix(0.54, 1.08, slickMask * 0.65 + uWindStrength * 0.45);
        vec3 reflectionColor = reflSharp + streakCol * capillaryGlint * streakWeight;

        // 4. Physical Schlick Fresnel (F0 = 0.024 for seawater) + Calm Slick Reflectivity Contrast
        float NdotV = clamp(dot(N, V), 0.001, 1.0);
        float schlick = 0.024 + 0.976 * pow(max(1.0 - NdotV, 0.0), 4.1);
        // Distinct glassy mirror slicks catching silvery-blue sky vs satin ruffled breeze bands!
        float slickBoost = mix(0.28, 0.06, slickMask);
        float fresnel = clamp(schlick * 1.06 + slickBoost, 0.14, 0.96);

        // 5. Physical Beer-Lambert Depth Absorption & Shallow Sandy Beach Translucency
        float safeDepth = max(exactDepth, 0.0);
        vec3 transmittance = exp(-safeDepth * vec3(1.15, 0.58, 0.38));
        vec3 seabedSand = mix(vec3(0.05, 0.08, 0.11), vec3(0.24, 0.19, 0.14), beachMask);
        vec3 deepBody = mix(uWaterShallow, uWaterDeep, smoothstep(0.0, 4.2, safeDepth));
        vec3 bodyColor = mix(deepBody, seabedSand, transmittance.r * 0.72);

        // Distinct photographic luminance contrast between bright mirror calm slicks and satin ruffled breeze zones!
        float breezeContrast = mix(1.08, 0.85, slickMask);
        vec3 waterCol = mix(bodyColor, reflectionColor, fresnel) * breezeContrast;

        // 6. Dual-Lobe GGX Sunset-Afterglow Specular Glints across the Satin Ripples
        vec3 H = normalize(L + V);
        float NdotH = clamp(dot(N, H), 0.0, 1.0);
        float sunVis = smoothstep(-0.02, 0.08, uSunDir.y + 0.035);
        float broadSpec = pow(NdotH, mix(140.0, 38.0, slickMask * uWindStrength + 0.10)) * 0.11;
        float tightSpec = pow(NdotH, 420.0) * (0.28 + 0.52 * slickMask) * sunVis;
        waterCol += (uSunsetCore * broadSpec + (uSunColor * 1.3 + vec3(0.24)) * tightSpec);

        // 7. Ultra-Delicate Beach Waterline Swash (ONLY where gentle water kisses sandy beaches — ZERO hard cliff outlines!)
        float swashZone = smoothstep(0.36, 0.01, safeDepth) * smoothstep(-0.05, 0.03, exactDepth) * smoothstep(0.15, 0.65, beachMask);
        float swashWave = 0.5 + 0.5 * sin(safeDepth * 16.0 - uTime * 1.85 + noise(vWorldPos.xz * 0.75) * 4.2);
        float foamMask = swashZone * smoothstep(0.58, 0.95, swashWave) * 0.20;

        // Subtle animated catamaran Kelvin V-wake foam trail
        vec2 relF = vWorldPos.xz - uFerryPos.xz;
        float along = dot(relF, uFerryDir);
        float across = abs(dot(relF, vec2(-uFerryDir.y, uFerryDir.x)));
        if (along < 0.0 && along > -32.0) {
          float dBack = -along;
          float arm = abs(across - (0.55 + dBack * 0.26));
          float armFoam = exp(-arm * arm * 2.2) * smoothstep(32.0, 1.5, dBack) * 0.24;
          float propWash = exp(-across * across * 2.6) * smoothstep(20.0, 0.8, dBack) * 0.18;
          foamMask = max(foamMask, max(armFoam, propWash));
        }

        vec3 foamColor = mix(uSkyHorizon * 0.55, vec3(0.88, 0.80, 0.70), 0.35);
        waterCol = mix(waterCol, foamColor, clamp(foamMask, 0.0, 0.6));

        // 8. Directional Twilight Aerial Perspective matching Sky & Mountains
        vec3 viewDir = normalize(vWorldPos - cameraPosition);
        vec2 vXZ = normalize(viewDir.xz + vec2(1e-5));
        vec2 sXZ = normalize(L.xz + vec2(1e-5));
        float sunAlign = pow(max(dot(vXZ, sXZ), 0.0), 3.4);
        vec3 fogColor = mix(uFogCool, uFogWarm, sunAlign * 0.68);

        float fogAmt = 1.0 - exp(-dist * uFogDensity * 0.82);
        fogAmt *= smoothstep(120.0, 320.0, dist);
        waterCol = mix(waterCol, fogColor, clamp(fogAmt, 0.0, 0.84));

        // Razor-smooth per-pixel alpha feathering right at exact shoreline y = 0!
        float shoreAlpha = smoothstep(-0.08, 0.14, exactDepth);
        waterCol = clamp(waterCol, vec3(0.0), vec3(16.0));

        gl_FragColor = vec4(waterCol, shoreAlpha);
      }
    `,
    transparent: true,
    depthWrite: true,
  });
}
