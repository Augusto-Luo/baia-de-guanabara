import * as THREE from 'three';

// AAA Multi-Biome Coastal Terrain Shader for Baía de Guanabara:
// - Triplanar Rio Striated Granite Gneiss with crisp weathered grey feldspar & dark vertical rainwater streaks
// - Deep normal-mapped Mata Atlântica Rainforest Canopy carpet on slopes & peaks
// - Wet & Dry Praia de São Francisco / Charitas / Icaraí golden beaches catching sky & streetlamp sheen
// - Refined dark coastal asphalt urban ground with localized pinpoint golden streetlight pools (ZERO orange grid stripes!)
export function createTerrainMaterial({ forestTex, graniteTex, geoFieldTex, geoBounds, preset }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uForestMap: { value: forestTex.map },
      uForestNormal: { value: forestTex.normalMap },
      uGraniteMap: { value: graniteTex.map },
      uGraniteNormal: { value: graniteTex.normalMap },
      uGeoField: { value: geoFieldTex },
      uGeoBounds: {
        value: new THREE.Vector4(
          geoBounds.minX,
          geoBounds.minZ,
          1.0 / (geoBounds.maxX - geoBounds.minX),
          1.0 / (geoBounds.maxZ - geoBounds.minZ)
        ),
      },
      uSunDir: { value: preset.sunDir.clone() },
      uSunColor: { value: preset.sunLightColor.clone() },
      uSunIntensity: { value: preset.sunLightIntensity },
      uHemiSky: { value: preset.hemiSkyColor.clone() },
      uHemiGround: { value: preset.hemiGroundColor.clone() },
      uHemiIntensity: { value: preset.hemiIntensity },
      uFogCool: { value: preset.fogCool.clone() },
      uFogWarm: { value: preset.fogWarm.clone() },
      uFogDensity: { value: preset.fogDensity },
      uCityBounce: { value: preset.cityBounceColor.clone() },
      uCityEmissive: { value: preset.cityEmissiveScale },
      uClipPlaneY: { value: -1000.0 },
    },
    vertexShader: /* glsl */ `
      attribute float aUrban;
      attribute float aBeach;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vUrban;
      varying float vBeach;

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vUrban = aUrban;
        vBeach = aBeach;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uForestMap;
      uniform sampler2D uForestNormal;
      uniform sampler2D uGraniteMap;
      uniform sampler2D uGraniteNormal;
      uniform sampler2D uGeoField;
      uniform vec4 uGeoBounds;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform float uSunIntensity;
      uniform vec3 uHemiSky;
      uniform vec3 uHemiGround;
      uniform float uHemiIntensity;
      uniform vec3 uFogCool;
      uniform vec3 uFogWarm;
      uniform float uFogDensity;
      uniform vec3 uCityBounce;
      uniform float uCityEmissive;
      uniform float uClipPlaneY;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying float vUrban;
      varying float vBeach;

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

      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.55 * noise(p);
        v += 0.30 * noise(p * 2.13 + vec2(3.7, 1.9));
        v += 0.15 * noise(p * 4.21 + vec2(7.1, 5.3));
        return v;
      }

      vec3 sampleTriplanarColor(sampler2D tex, vec3 p, vec3 n, float scale) {
        vec3 w = abs(n);
        w = pow(w, vec3(4.0));
        w /= max(w.x + w.y + w.z, 1e-4);
        vec3 cx = texture2D(tex, p.zy * scale).rgb;
        vec3 cy = texture2D(tex, p.xz * scale).rgb;
        vec3 cz = texture2D(tex, p.xy * scale).rgb;
        return cx * w.x + cy * w.y + cz * w.z;
      }

      void main() {
        if (vWorldPos.y < uClipPlaneY) discard;

        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Baked Geography Field for razor-crisp beachfront promenade & beach precision!
        vec2 geoUv = (vWorldPos.xz - uGeoBounds.xy) * uGeoBounds.zw;
        float inGeo = step(0.002, geoUv.x) * step(geoUv.x, 0.998) * step(0.002, geoUv.y) * step(geoUv.y, 0.998);
        vec4 geoSample = texture2D(uGeoField, clamp(geoUv, vec2(0.002), vec2(0.998)));
        float fieldBeach = mix(vBeach, geoSample.g, inGeo * 0.85);
        float promenadeRoad = geoSample.b * inGeo;

        // 1. Multi-scale Mata Atlântica Rainforest Canopy carpet
        vec2 fUv1 = vWorldPos.xz * 0.062;
        vec2 fUv2 = vWorldPos.xz * 0.018 + vec2(0.37, 0.19);
        vec3 forestCol1 = texture2D(uForestMap, fUv1).rgb;
        vec3 forestCol2 = texture2D(uForestMap, fUv2).rgb;
        vec3 forestAlbedo = mix(forestCol1, forestCol2 * 0.86, 0.40) * 0.72;

        vec3 fNormTex = texture2D(uForestNormal, fUv1).xyz * 2.0 - 1.0;
        vec3 Nforest = normalize(N + vec3(fNormTex.x, 0.0, fNormTex.y) * 0.52);

        // 2. Rio Striated Granite Gneiss (weathered cool-grey feldspar + dark vertical rainwater streaks!)
        vec3 graniteAlbedo = sampleTriplanarColor(uGraniteMap, vWorldPos, N, 0.044) * vec3(0.96, 0.95, 1.02);
        vec3 gNormTex = texture2D(uGraniteNormal, vec2(vWorldPos.x + vWorldPos.z, vWorldPos.y * 0.7) * 0.046).xyz * 2.0 - 1.0;
        vec3 Ngranite = normalize(N + vec3(gNormTex.x, gNormTex.z * 0.25, gNormTex.y) * 0.54);

        float cliffSlope = smoothstep(0.76, 0.44, N.y);
        float highGranite = smoothstep(26.0, 50.0, vWorldPos.y) * smoothstep(0.88, 0.58, N.y);
        float coastalRock = smoothstep(3.8, 0.15, vWorldPos.y) * smoothstep(0.84, 0.54, N.y) * (1.0 - fieldBeach);
        float graniteWeight = clamp(max(max(cliffSlope, highGranite), coastalRock), 0.0, 1.0);

        // Clinging tropical moss & scrub on granite shelves
        float mossMask = smoothstep(0.56, 0.82, N.y) * smoothstep(0.44, 0.76, fbm(vWorldPos.xz * 0.18)) * graniteWeight * 0.52;
        graniteAlbedo = mix(graniteAlbedo, vec3(0.08, 0.14, 0.07), mossMask);

        // 3. Golden Wet & Dry Sand for Praia de São Francisco, Charitas, Icaraí & Praia Vermelha
        float sandGrain = noise(vWorldPos.xz * 2.4) * 0.11;
        float wetShore = smoothstep(0.72, 0.04, vWorldPos.y);
        vec3 drySand = vec3(0.36, 0.29, 0.21) + sandGrain * 0.07;
        vec3 wetSand = vec3(0.15, 0.13, 0.11);
        vec3 sandAlbedo = mix(drySand, wetSand, wetShore);

        // 4. Photorealistic Dark Evening Urban Ground (Charcoal Asphalt + Sidewalks + Courtyard Greenery!)
        //    Strictly flat-gated so ZERO street shading ever bleeds onto hills/cliffs!
        float flatGround = smoothstep(0.82, 0.93, N.y);
        float urbanClean = vUrban * flatGround;
        float blockVar = fbm(vWorldPos.xz * 0.24);
        float finePave = noise(vWorldPos.xz * 1.15);
        vec3 asphaltCol = vec3(0.032, 0.036, 0.046);
        vec3 sidewalkCol = vec3(0.068, 0.066, 0.068);
        vec3 gardenCol = vec3(0.030, 0.058, 0.028);
        vec3 urbanAlbedo = mix(asphaltCol, sidewalkCol, smoothstep(0.32, 0.68, blockVar));
        urbanAlbedo = mix(urbanAlbedo, gardenCol, smoothstep(0.64, 0.86, blockVar) * 0.55);
        urbanAlbedo = mix(urbanAlbedo, vec3(0.026, 0.030, 0.038), promenadeRoad * 0.90);
        urbanAlbedo *= (0.88 + 0.24 * finePave);

        // Blend biomes
        vec3 albedo = mix(forestAlbedo, graniteAlbedo, graniteWeight);
        vec3 surfN = normalize(mix(Nforest, Ngranite, graniteWeight));

        albedo = mix(albedo, urbanAlbedo, urbanClean * 0.96);
        surfN = normalize(mix(surfN, N, urbanClean * 0.92));

        albedo = mix(albedo, sandAlbedo, fieldBeach);
        surfN = normalize(mix(surfN, N, fieldBeach * 0.92));

        float submerged = smoothstep(0.08, -1.6, vWorldPos.y);
        albedo = mix(albedo, vec3(0.025, 0.055, 0.085), submerged);

        // 5. Twilight Physical Lighting
        float NdotL = max(dot(surfN, L), 0.0);
        float wrapDiff = max(dot(surfN, L) * 0.55 + 0.45, 0.0);

        vec3 hemi = mix(uHemiGround, uHemiSky, surfN.y * 0.5 + 0.5) * uHemiIntensity;
        vec3 direct = uSunColor * (NdotL * 0.78 + wrapDiff * 0.22) * uSunIntensity * 0.62;

        // Wet shoreline sand + damp twilight asphalt + weathered granite sheen
        vec3 H = normalize(L + V);
        float NdotH = clamp(dot(surfN, H), 0.0, 1.0);
        float wetSpecMask = clamp(fieldBeach * wetShore + promenadeRoad * 0.42, 0.0, 1.0);
        float specPow = mix(18.0, 96.0, wetSpecMask + graniteWeight * 0.3);
        float specStrength = mix(0.03, 0.40, wetSpecMask) + graniteWeight * 0.08;
        float spec = pow(NdotH, specPow) * specStrength;

        float NdotV = clamp(dot(surfN, V), 0.0, 1.0);
        float wetFresnel = pow(max(1.0 - NdotV, 0.0), 3.2) * fieldBeach * wetShore;
        vec3 wetSkyGlaze = uHemiSky * wetFresnel * 0.58;

        // Subtle cool twilight sky rim catch on exposed steep granite faces (Sugarloaf, Corcovado, Pedra da Gávea!)
        float rockRim = pow(max(1.0 - NdotV, 0.0), 2.6) * graniteWeight * 0.14;
        vec3 color = albedo * (hemi + direct) + uSunColor * spec * 0.55 + wetSkyGlaze + uHemiSky * rockRim;

        // 6. Subtle, Photographic Localized Streetlamp Pools (ZERO Waffle-Iron Orange Grid Stripes!)
        // Fine organic dotted streetlight wash strictly on flat urban pavement + warm curving coastal promenade!
        float poolNoise1 = smoothstep(0.46, 0.90, noise(vWorldPos.xz * 0.52));
        float poolNoise2 = smoothstep(0.54, 0.94, noise(vWorldPos.xz * 1.18 + vec2(4.2, -3.1)));
        float fineUrbanWash = urbanClean * (0.06 + 0.22 * poolNoise1 + 0.18 * poolNoise2) * uCityEmissive;

        // Distinct golden coastal avenue glow right along Av. Quintino Bocaiúva (restrained so asphalt stays dark & classy!)
        vec2 relCove = vWorldPos.xz - vec2(-4.0, 52.0);
        float angCove = atan(relCove.y, relCove.x);
        float lampPools = 0.58 + 0.42 * pow(0.5 + 0.5 * sin(angCove * 115.0), 2.0);
        float aveGlow = promenadeRoad * lampPools * 0.62 * uCityEmissive;

        // Gentle warm sodium spill onto dry upper beach sand next to promenade (keeps sand natural golden-tan!)
        float beachSpill = fieldBeach * smoothstep(0.22, 1.45, vWorldPos.y) * (0.20 + 0.18 * poolNoise1) * uCityEmissive;

        // Delicate warm upward city bounce onto lower Parque da Cidade rainforest slopes facing the town
        float slopeBounce = smoothstep(24.0, 4.5, vWorldPos.y) * smoothstep(140.0, 196.0, vWorldPos.z) * (1.0 - urbanClean) * 0.22 * uCityEmissive;

        color += uCityBounce * vec3(1.0, 0.72, 0.34) * fineUrbanWash * 0.26;
        color += uCityBounce * vec3(1.06, 0.76, 0.38) * aveGlow * 0.42;
        color += uCityBounce * vec3(1.02, 0.74, 0.40) * beachSpill * 0.26;
        color += uCityBounce * albedo * slopeBounce * 1.25;

        // 7. Directional Twilight Aerial Perspective
        float dist = length(cameraPosition - vWorldPos);
        vec3 viewDir = normalize(vWorldPos - cameraPosition);
        vec2 vXZ = normalize(viewDir.xz + vec2(1e-5));
        vec2 sXZ = normalize(L.xz + vec2(1e-5));
        float sunAlign = pow(max(dot(vXZ, sXZ), 0.0), 3.4);
        vec3 fogColor = mix(uFogCool, uFogWarm, sunAlign * 0.68);

        float heightAtten = exp(-max(vWorldPos.y, 0.0) * 0.014);
        float fogAmt = 1.0 - exp(-dist * uFogDensity * (0.62 + 0.38 * heightAtten));
        fogAmt *= smoothstep(65.0, 215.0, dist);
        color = mix(color, fogColor, clamp(fogAmt, 0.0, 0.86));
        color = clamp(color, vec3(0.0), vec3(12.0));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}
