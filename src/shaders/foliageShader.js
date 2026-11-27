import * as THREE from 'three';

// AAA Mata Atlântica Botanical Foliage Shader (InstancedMesh compatible):
// - Deep, lush photographic Atlantic Forest chlorophyll palette (ZERO icy blue frost!)
// - Per-pixel Sobel tangent-space leaf-vein normal mapping + packed alpha translucency map
// - Waxy tropical cuticle micro-specular sheen catching the twilight sky & sunset glow
// - Vein-modulated backlit emerald-gold subsurface scattering (SSS)
// - Multi-frequency hierarchical wind sway (trunk gust + crown rustle + individual leaf-tip flutter)
// - Realistic warm golden upward city bounce from São Francisco avenues onto lower foreground branches
export function createFoliageMaterial({ map, normalMap, preset, windAmp = 0.20, alphaTest = 0.42 }) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uMap: { value: map },
      uNormalMap: { value: normalMap },
      uTime: { value: 0 },
      uWindAmp: { value: windAmp },
      uAlphaTest: { value: alphaTest },
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
      uniform float uTime;
      uniform float uWindAmp;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vColorTint;
      varying float vLocalHeight;
      varying float vRadialAO;

      void main() {
        vUv = uv;
        vLocalHeight = clamp(position.y * 0.55 + 0.5, 0.0, 1.0);
        vRadialAO = clamp(length(position.xyz) * 0.72, 0.28, 1.08);

        #ifdef USE_INSTANCING_COLOR
          vColorTint = instanceColor;
        #else
          vColorTint = vec3(1.0);
        #endif

        vec3 pos = position;

        vec4 anchor = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          anchor = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #endif

        // Hierarchical tropical breeze: slow canopy wave + brisk leaf-tip micro-flutter
        float phase = anchor.x * 0.13 + anchor.z * 0.10 + uTime * 1.35;
        float gust = sin(phase) * 0.62 + sin(phase * 2.25 + anchor.x * 0.07) * 0.38;
        float flutter = sin(uTime * 4.4 + position.x * 4.8 + position.z * 3.6 + anchor.z) * 0.16;
        float swayWeight = clamp((position.y + 0.45) * 0.52, 0.0, 1.18);
        pos.x += (gust + flutter) * uWindAmp * swayWeight;
        pos.z += (cos(phase * 0.88) + flutter * 0.6) * uWindAmp * 0.55 * swayWeight;
        pos.y += sin(uTime * 2.9 + position.x * 3.2 + anchor.x) * uWindAmp * 0.08 * swayWeight;

        vec4 wp;
        vec3 wn;
        #ifdef USE_INSTANCING
          wp = modelMatrix * instanceMatrix * vec4(pos, 1.0);
          wn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          wp = modelMatrix * vec4(pos, 1.0);
          wn = normalize(mat3(modelMatrix) * normal);
        #endif

        vWorldPos = wp.xyz;
        vWorldNormal = wn;

        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform sampler2D uNormalMap;
      uniform float uAlphaTest;
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

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vColorTint;
      varying float vLocalHeight;
      varying float vRadialAO;

      void main() {
        if (vWorldPos.y < uClipPlaneY) discard;

        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < uAlphaTest) discard;

        vec3 baseN = normalize(vWorldNormal);
        if (!gl_FrontFacing) baseN = -baseN;

        // Per-pixel botanical leaf-vein normal + packed blade translucency mask (in alpha!)
        vec4 normTrans = texture2D(uNormalMap, vUv);
        vec3 leafN = normTrans.xyz * 2.0 - 1.0;
        float translucency = clamp(normTrans.a, 0.15, 1.0);

        vec3 upRef = abs(baseN.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 T = normalize(cross(upRef, baseN));
        vec3 B = cross(baseN, T);
        vec3 N = normalize(baseN + (T * leafN.x + B * leafN.y) * 0.56);

        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Deep natural inner-crown & vertical ambient occlusion so dense rainforest canopies have lush 3D volume!
        float ao = mix(0.32, 1.08, vLocalHeight) * mix(0.68, 1.05, vRadialAO);
        vec3 albedo = tex.rgb * vColorTint * ao * 0.94;

        // Chlorophyll-balanced twilight sky hemisphere (never frosted icy blue!)
        vec3 canopySky = mix(uHemiSky, vec3(0.22, 0.35, 0.23), 0.44);
        vec3 hemi = mix(uHemiGround * 0.60, canopySky, N.y * 0.5 + 0.5) * uHemiIntensity * 1.08;
        float wrapDiff = max((dot(N, L) + 0.40) / 1.40, 0.0);
        vec3 direct = uSunColor * wrapDiff * uSunIntensity * 0.62;

        // Waxy tropical leaf cuticle specular highlight + sky-grazing velvet sheen (NaN-safe for Apple Metal!)
        vec3 H = normalize(L + V);
        float NdotV = clamp(dot(N, V), 0.0, 1.0);
        float NdotH = clamp(dot(N, H), 0.0, 1.0);
        float sunSpec = pow(NdotH, 44.0) * 0.18 * uSunIntensity;
        float skyFresnel = pow(max(1.0 - NdotV, 0.0), 3.8) * max(N.y, 0.0);
        vec3 cuticleSheen = canopySky * skyFresnel * 0.13 + uSunColor * sunSpec * 0.62;

        // Vein-modulated backlit chlorophyll Subsurface Scattering (SSS) glowing warm emerald-amber toward sunset!
        float backLight = pow(clamp(dot(-L, V), 0.0, 1.0), 2.5);
        float rimView = pow(max(1.0 - NdotV, 0.0), 2.4);
        vec3 sssColor = albedo * vec3(1.55, 1.78, 0.62);
        vec3 sss = sssColor * uSunColor * (backLight * 0.52 + rimView * 0.18) * translucency * uSunIntensity * 0.56;

        vec3 color = albedo * (hemi + direct) + cuticleSheen + sss;

        // Realistic warm golden-amber upward bounce light from São Francisco coastal avenues onto lower foreground branches!
        float fgSlope = smoothstep(126.0, 174.0, vWorldPos.z) * smoothstep(236.0, 178.0, vWorldPos.z);
        float lowFacing = clamp(-N.y * 0.48 + 0.52, 0.0, 1.0) * smoothstep(34.0, 4.5, vWorldPos.y);
        color += albedo * uCityBounce * fgSlope * lowFacing * 0.68 * uCityEmissive;

        // Directional Twilight Aerial Perspective
        float dist = length(cameraPosition - vWorldPos);
        vec3 viewDir = normalize(vWorldPos - cameraPosition);
        vec2 vXZ = normalize(viewDir.xz + vec2(1e-5));
        vec2 sXZ = normalize(L.xz + vec2(1e-5));
        float sunAlign = pow(clamp(dot(vXZ, sXZ), 0.0, 1.0), 3.4);
        vec3 fogColor = mix(uFogCool, uFogWarm, sunAlign * 0.68);

        float fogAmt = 1.0 - exp(-dist * uFogDensity * 0.85);
        fogAmt *= smoothstep(65.0, 210.0, dist);
        color = mix(color, fogColor, clamp(fogAmt, 0.0, 0.86));
        color = clamp(color, vec3(0.0), vec3(12.0));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}
