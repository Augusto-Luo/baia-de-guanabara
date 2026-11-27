import * as THREE from 'three';

// Shared analytical geography for Baía de Guanabara (viewed from Parque da Cidade, Niterói toward Rio de Janeiro)
// Scale: 1 world unit ≈ 10 meters. Sea level y = 0.0.
// Negative Z = West-Northwest across Baía de Guanabara toward Rio de Janeiro & Serra dos Órgãos.
// Negative X = South-West (Atlantic entrance, Sugarloaf, Corcovado, Pedra da Gávea, Morro do Morcego).
// Positive X = North-East (Icaraí, MAC Niterói, Centro de Niterói, Ponte Rio-Niterói).

function hash2(ix, iz) {
  let n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function noise2D(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uz = fz * fz * (3.0 - 2.0 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x, z, octaves = 4) {
  let value = 0.0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    value += amp * (noise2D(x * freq, z * freq) * 2.0 - 1.0);
    const nx = x * 0.8 - z * 0.6;
    const nz = x * 0.6 + z * 0.8;
    x = nx;
    z = nz;
    freq *= 2.04;
    amp *= 0.5;
  }
  return value;
}

export function ridgeFbm(x, z, octaves = 4) {
  let value = 0.0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    const n = 1.0 - Math.abs(noise2D(x * freq, z * freq) * 2.0 - 1.0);
    value += amp * n * n;
    const nx = x * 0.8 - z * 0.6;
    const nz = x * 0.6 + z * 0.8;
    x = nx;
    z = nz;
    freq *= 2.07;
    amp *= 0.48;
  }
  return value;
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a, b, k) {
  return -smin(-a, -b, k);
}

// Sculpted angular mountain peak with optional directional ridge sharpness
function peak(x, z, cx, cz, rx, rz, height, power = 1.65, angle = 0) {
  const dx0 = x - cx;
  const dz0 = z - cz;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dx = dx0 * c - dz0 * s;
  const dz = dx0 * s + dz0 * c;
  const d2 = (dx * dx) / (rx * rx) + (dz * dz) / (rz * rz);
  if (d2 > 9.5) return 0;
  return height * Math.exp(-Math.pow(d2, power * 0.5));
}

// Asymmetric Rio granite monolith (Sugarloaf tilted dome, Corcovado hunchback, Pedra da Gávea mesa)
function graniteMonolith(x, z, cx, cz, rx, rz, height, flatness = 0.0, angle = 0, skewX = 0.0, cliffPower = 2.3) {
  const dx0 = x - cx;
  const dz0 = z - cz;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  let dx = dx0 * c - dz0 * s;
  const dz = dx0 * s + dz0 * c;
  // Asymmetric shear so one cliff face is steeper (like Sugarloaf's Atlantic sheer cliff!)
  const rxEff = dx < 0 ? rx * (1.0 - skewX) : rx * (1.0 + skewX);
  const r = Math.sqrt((dx * dx) / (rxEff * rxEff) + (dz * dz) / (rz * rz));
  if (r > 3.2) return 0;
  const profile = Math.exp(-Math.pow(r, cliffPower));
  if (flatness > 0.0) {
    const cap = Math.min(profile * (1.0 + flatness), 1.0);
    return height * cap * (1.0 - 0.05 * r * r * 0.25);
  }
  return height * profile;
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  let t = lenSq > 1e-6 ? (wx * vx + wz * vz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * vx;
  const cz = az + t * vz;
  return {
    dist: Math.hypot(px - cx, pz - cz),
    t,
  };
}

export const COVE_CENTER = { x: -4, z: 54 };

// Signed distance to the sweeping Praia de São Francisco & Praia de Charitas crescent beach
// Positive = landward, Negative = open Enseada de São Francisco water
export function getCrescentCoveDist(x, z) {
  const dx = (x - (-4)) / 124.0;
  const dz = (z - 52) / 86.0;
  const ang = Math.atan2(dz, dx);
  const wobble =
    0.032 * Math.sin(ang * 3.0 + 0.5) +
    0.015 * fbm2D(x * 0.014, z * 0.014, 2);
  const r = Math.hypot(dx, dz) + wobble;
  const mouthOpen = smoothstep(28, -32, z) * smoothstep(115, 24, Math.abs(x + 8));
  return (r - 1.0) * 94.0 - mouthOpen * 126.0;
}

// Foreground Parque da Cidade amphitheater + São Francisco & Charitas crescent town & beach
function evalForegroundNiteroi(x, z) {
  if (z < -45) return -6.0;

  const coveDist = getCrescentCoveDist(x, z);
  const southMask = smoothstep(-20, 42, z);
  const rawLand = coveDist * southMask - (1.0 - southMask) * 45.0;

  let h = -5.5;
  if (rawLand > -12) {
    // Seabed rises gently onto golden sandy beach (y=0..1.4) and flat coastal neighborhood shelf (y=1.4..4.0)
    const beachRamp = smoothstep(-9.5, 3.2, rawLand);
    const shelfRise = smoothstep(3.2, 34.0, rawLand);
    h = -5.5 + beachRamp * 6.6 + shelfRise * 2.1;
    h += smoothstep(4.5, 28.0, rawLand) * fbm2D(x * 0.025, z * 0.025, 3) * 0.55;

    // Parque da Cidade mountain amphitheater behind São Francisco:
    // Sweeps boldly inward on LEFT & RIGHT corners (framing the panorama like the reference photograph),
    // while pulling back cleanly in the center so the beachfront town, golden avenue & bay open wide!
    const centerRecess = Math.exp(-(x * x) / (62.0 * 62.0)) * 28.0;
    const ridgeStartZ = 152.0 + centerRecess - 0.0017 * x * x;

    const upHill = smoothstep(ridgeStartZ - 8.0, ridgeStartZ + 46.0, z);
    const flankBoost = smoothstep(22.0, 86.0, Math.abs(x));

    // Dramatic left & right foreground rainforest ridges framing bottom corners of the vista
    const leftCorner = smoothstep(-22.0, -88.0, x) * smoothstep(144.0, 214.0, z);
    const rightCorner = smoothstep(22.0, 88.0, x) * smoothstep(142.0, 212.0, z);

    const hillDetail =
      (ridgeFbm(x * 0.019 + 3.1, z * 0.019 - 1.7, 4) - 0.35) * 7.2 +
      fbm2D(x * 0.055, z * 0.055, 3) * 1.8;

    const mountainH =
      upHill * (16.5 + flankBoost * 11.5) +
      leftCorner * 16.5 +
      rightCorner * 17.0 +
      upHill * hillDetail;

    h += Math.max(0, mountainH);

    // Flanking outer forested ridges (Morro da Viração / Charitas west, Morro do Cavalão / Icaraí east)
    h += peak(x, z, 188, 96, 56, 60, 25.0, 1.55, 0.2);
    h += peak(x, z, 240, 175, 88, 90, 31.0, 1.45, -0.15);
    h += peak(x, z, -184, 122, 60, 62, 26.0, 1.55, -0.2);
  }

  return h;
}

// Left-midground iconic dark coastal headland: Jurujuba, Morro do Pico, Morro do Morcego & Fortaleza de Santa Cruz
function evalJurujubaHeadland(x, z) {
  if (x > 18 || x < -250 || z > 94 || z < -88) return -6.0;

  const seg1 = distToSegment(x, z, -140, 36, -94, -12);
  const seg2 = distToSegment(x, z, -96, -14, -34, -26);
  const seg3 = distToSegment(x, z, -140, 36, -188, 10);

  const penBase1 = smoothstep(37, 11, seg1.dist) * 4.6;
  const penBase2 = smoothstep(20, 6, seg2.dist) * 3.8;
  const penBase3 = smoothstep(32, 10, seg3.dist) * 4.0;
  const baseLand = Math.max(penBase1, penBase2, penBase3);

  // Iconic sharp sculpted coastal mountain silhouettes from the reference photograph:
  // Outer left slope -> Tall crisp dark central-left peak (Morro do Pico/Morcego) -> low saddle -> sharp pointed promontory jutting into bay!
  const pOuter = peak(x, z, -156, 22, 28, 23, 18.2, 1.55, -0.35);
  const pShoulder = peak(x, z, -114, -2, 20, 17, 18.8, 1.65, 0.22);
  const pMain = graniteMonolith(x, z, -90, -14, 21.5, 18.5, 27.5, 0.0, -0.22, 0.14, 1.85);
  const pSaddle = peak(x, z, -60, -21, 15, 12, 4.8, 1.5, 0.1);
  // Crisp unmistakable conical/pyramidal dark peak jutting right into Enseada de São Francisco!
  const pFinger = graniteMonolith(x, z, -33, -26, 12.8, 10.8, 16.5, 0.0, 0.25, -0.12, 1.82);

  // Coastal village flat shelf at Jurujuba tucked inside the cove
  const villageShelf =
    smoothstep(26, 9, distToSegment(x, z, -116, 44, -56, 12).dist) * 2.5;

  const ridgeNoise =
    (ridgeFbm(x * 0.036 + 1.4, z * 0.036 - 2.3, 4) - 0.28) * 4.2 +
    fbm2D(x * 0.085, z * 0.085, 3) * 1.1;

  const total =
    baseLand + pOuter + pShoulder + pMain + pSaddle + pFinger + villageShelf;
  if (total <= 0.18) return -6.0;

  return -5.5 + total + smoothstep(3.0, 14.0, total) * ridgeNoise;
}

// Right-midground Niterói peninsula: Icaraí, Mirante da Boa Viagem (MAC), Ilha da Boa Viagem, Ingá, Centro Niterói
function evalNiteroiPeninsula(x, z) {
  if (x < 6 || x > 390 || z > 96 || z < -235) return -6.0;

  const s1 = distToSegment(x, z, 136, 48, 122, -24);
  const s2 = distToSegment(x, z, 122, -24, 72, -78);
  const s3 = distToSegment(x, z, 82, -82, 175, -108);
  const s4 = distToSegment(x, z, 158, -18, 255, -110);
  const s5 = distToSegment(x, z, 192, -105, 310, -195);

  const coastNoise = fbm2D(x * 0.025 + 5.1, z * 0.025 - 1.9, 3) * 7.2;
  const u1 = smoothstep(35 + coastNoise, 12, s1.dist);
  const u2 = smoothstep(26 + coastNoise * 0.7, 9, s2.dist);
  const u3 = smoothstep(36 + coastNoise, 12, s3.dist);
  const u4 = smoothstep(66 + coastNoise, 18, s4.dist);
  const u5 = smoothstep(54 + coastNoise, 16, s5.dist);

  let urbanMask = Math.max(u1, u2, u3, u4, u5);

  const icaraiCove = peak(x, z, 114, 18, 22, 22, 1.0, 2.0);
  const flechasCove = peak(x, z, 94, -56, 15, 14, 0.85, 2.0);
  urbanMask = Math.max(0, urbanMask - icaraiCove * 0.45 - flechasCove * 0.55);

  let h = -5.5;
  if (urbanMask > 0.01) {
    h = -5.5 + smoothstep(0.02, 0.36, urbanMask) * 7.1 + smoothstep(0.36, 0.9, urbanMask) * 1.3;
    h += smoothstep(0.2, 0.8, urbanMask) * fbm2D(x * 0.04, z * 0.04, 3) * 0.75;
  }

  // Rugged granite Mirante da Boa Viagem sea cliff (MAC Niterói pedestal) with steep rocky edges!
  const macCliff = graniteMonolith(x, z, 105, -34, 10.6, 9.8, 12.2, 0.65, 0.2, 0.05, 2.8);
  if (macCliff > 0.15) {
    const cliffCrag = (ridgeFbm(x * 0.14, z * 0.14, 3) - 0.35) * 1.45 * smoothstep(2.0, 9.0, macCliff) * smoothstep(12.0, 9.5, macCliff);
    h = smax(h, -5.5 + macCliff + cliffCrag, 1.1);
  }

  // Steep rocky Ilha da Boa Viagem islet
  const boaViagemIslet = graniteMonolith(x, z, 84, -42, 5.8, 5.0, 10.8, 0.28, -0.3, 0.08, 2.6);
  if (boaViagemIslet > 0.15) {
    const isoCrag = (ridgeFbm(x * 0.18 + 2.0, z * 0.18, 3) - 0.3) * 1.1;
    h = Math.max(h, -5.5 + boaViagemIslet + isoCrag * smoothstep(2.0, 8.0, boaViagemIslet));
  }

  // Iconic dark mid-bay rocky island (Ilha de Mocanguê / Ilha do Viana silhouette in reference photo)
  const bayIsland =
    graniteMonolith(x, z, 40, -98, 10.8, 7.6, 12.0, 0.05, 0.25, 0.1, 1.95) +
    peak(x, z, 48, -100, 6.8, 5.2, 6.8, 1.7, -0.2);
  if (bayIsland > 0.15) {
    h = Math.max(h, -5.5 + bayIsland + (ridgeFbm(x * 0.12, z * 0.12, 3) - 0.3) * 1.3);
  }

  // Rolling wooded hills behind Niterói
  const morroEstado = peak(x, z, 192, -46, 36, 32, 18.5, 1.55, 0.1);
  const morroNiteroiFar = peak(x, z, 255, -98, 52, 46, 21.5, 1.5, -0.2);
  const morroNorte = peak(x, z, 315, -172, 65, 58, 24.5, 1.45, 0.3);
  const niteroiRidge = (ridgeFbm(x * 0.028 + 4.1, z * 0.028, 3) - 0.3) * 2.8;
  h += morroEstado + morroNiteroiFar + morroNorte + smoothstep(6.0, 18.0, morroEstado + morroNiteroiFar) * niteroiRidge;

  return h;
}

// Rio de Janeiro iconic side: Sugarloaf, Morro da Urca, Corcovado, Tijuca, Dois Irmãos, Pedra da Gávea, Centro waterfront
function evalRioDeJaneiro(x, z) {
  if (z > -115 || z < -625) return -6.0;

  let h = -5.5;

  const w1 = distToSegment(x, z, -260, -225, -138, -268);
  const w2 = distToSegment(x, z, -138, -268, -28, -325);
  const w3 = distToSegment(x, z, -28, -325, 115, -435);
  const w4 = distToSegment(x, z, -400, -335, -245, -245);

  const wNoise = fbm2D(x * 0.016 - 2.4, z * 0.016 + 4.1, 3) * 9.5;
  const landW = Math.max(
    smoothstep(44 + wNoise, 12, w1.dist),
    smoothstep(46 + wNoise, 12, w2.dist),
    smoothstep(56 + wNoise, 14, w3.dist),
    smoothstep(68 + wNoise, 16, w4.dist)
  );

  const inlandZ = -268 - 0.42 * (x + 150);
  const inlandMask = smoothstep(inlandZ + 26 + wNoise, inlandZ - 35, z) * smoothstep(-625, -545, z);
  const rioBase = Math.max(landW, inlandMask);

  if (rioBase > 0.01) {
    h = -5.5 + smoothstep(0.02, 0.35, rioBase) * 7.0 + smoothstep(0.35, 0.9, rioBase) * 2.0;
  }

  // --- PÃO DE AÇÚCAR (Sugarloaf Mountain) & MORRO DA URCA ---
  // Sculpted asymmetric granite dome with sheer Atlantic face, curved spine & rugged gneiss flanks!
  const sugarCore = graniteMonolith(x, z, -252, -188, 18.2, 15.6, 48.5, 0.01, 0.25, 0.18, 2.38);
  const sugarCrown = peak(x, z, -254.5, -189.5, 11.2, 9.8, 7.2, 1.95, 0.25);
  const sugarButtress = peak(x, z, -240, -184, 12.0, 10.5, 13.5, 1.65, -0.15);
  const sugarloaf = sugarCore + sugarCrown + sugarButtress * 0.55;

  const morroUrca =
    graniteMonolith(x, z, -278, -176, 16.5, 13.8, 26.5, 0.18, -0.22, -0.1, 2.25);
  const urcaSaddle =
    peak(x, z, -265, -182, 12.2, 10.2, 12.8, 1.6, 0.1);
  const caraDeCao =
    peak(x, z, -225, -175, 13.0, 11.2, 16.2, 1.72, -0.15);
  const babilonia =
    peak(x, z, -304, -210, 26.0, 22.0, 26.5, 1.52, 0.3);

  const urcaMassif = Math.max(sugarloaf, morroUrca, urcaSaddle, caraDeCao, babilonia);
  if (urcaMassif > 0.2) {
    const sugarCrag =
      (ridgeFbm(x * 0.052 + 1.1, z * 0.052 - 0.9, 4) - 0.32) *
      smoothstep(8.0, 32.0, urcaMassif) *
      smoothstep(54.0, 44.0, urcaMassif) *
      3.8;
    const urcaGround = -5.5 + urcaMassif + smoothstep(0.2, 5.5, urcaMassif) * 5.2 + sugarCrag;
    h = smax(h, urcaGround, 2.0);
  }

  // --- CORCOVADO (Hunchback Granite Crag) & TIJUCA MASSIF ---
  // Asymmetric hunched peak with steep sheer north-east face, sweeping Tijuca ridge & seamless summit terrace!
  const corcovadoMain = graniteMonolith(x, z, -262, -328, 22.0, 20.0, 65.5, 0.14, -0.18, -0.18, 2.10);
  const corcovadoHunch = peak(x, z, -274, -334, 18.5, 15.5, 45.0, 1.58, -0.2);
  const corcovado = Math.max(corcovadoMain, corcovadoHunch);

  const donaMarta = peak(x, z, -228, -304, 24.0, 22.0, 38.5, 1.55, 0.2);
  const sumare = peak(x, z, -204, -342, 34.0, 28.0, 43.0, 1.48, -0.1);
  const tijucaMain = peak(x, z, -166, -352, 42.0, 34.0, 34.5, 1.45, 0.25);
  const santaTeresa = peak(x, z, -128, -316, 34.0, 26.0, 18.5, 1.45, -0.1);
  const picoTijuca = peak(x, z, -298, -366, 48.0, 40.0, 49.5, 1.42, 0.1);

  // --- MORRO DOIS IRMÃOS (Iconic Sharp Twin Peaks) ---
  const doisIrmaos1 = graniteMonolith(x, z, -345, -304, 16.5, 14.8, 49.0, 0.01, 0.18, 0.16, 1.95);
  const doisIrmaos2 = graniteMonolith(x, z, -366, -312, 15.0, 14.0, 42.5, 0.02, -0.12, -0.12, 1.95);

  // --- PEDRA DA GÁVEA (Iconic Flat-Topped Granite Table Monolith with dramatic notched shoulder!) ---
  const pedraGavea = graniteMonolith(x, z, -408, -338, 25.0, 21.0, 57.5, 0.62, 0.18, 0.12, 2.75);
  const pedraBonita = peak(x, z, -384, -344, 21.0, 19.0, 39.0, 1.52, -0.2);

  // --- Ilha de Villegagnon & Ilha Fiscal (Rio waterfront islets) ---
  const villegagnon = graniteMonolith(x, z, -76, -244, 10.5, 6.8, 7.6, 0.45, 0.2, 0.0, 2.4);
  if (villegagnon > 0.2) {
    h = Math.max(h, -5.5 + villegagnon);
  }
  const ilhaFiscal = graniteMonolith(x, z, -34, -278, 6.8, 5.0, 6.8, 0.55, 0.35, 0.0, 2.6);
  if (ilhaFiscal > 0.2) {
    h = Math.max(h, -5.5 + ilhaFiscal);
  }

  // --- Ilha do Governador / Fundão ---
  const governador =
    peak(x, z, -12, -455, 62.0, 38.0, 11.2, 1.5, 0.15) +
    peak(x, z, 42, -468, 48.0, 30.0, 8.2, 1.5, -0.1);

  const mountains =
    Math.max(
      corcovado,
      donaMarta,
      sumare,
      tijucaMain,
      santaTeresa,
      picoTijuca,
      doisIrmaos1,
      doisIrmaos2,
      pedraGavea,
      pedraBonita
    ) + governador;

  // Keep immediate Cristo summit plateau smooth so the chapel base integrates cleanly!
  const distCorcSummit = Math.hypot(x + 262, z + 328);
  const cragAtten = smoothstep(4.5, 15.0, distCorcSummit);

  const rockRugged =
    (ridgeFbm(x * 0.026 + 2.2, z * 0.026 - 3.1, 4) - 0.32) *
    smoothstep(8.0, 30.0, mountains) *
    cragAtten *
    8.2;

  if (mountains > 0.2) {
    h = Math.max(h, 0.8 + mountains + rockRugged);
  }

  return h;
}

// Distant Horizon Mountain Chain: Serra dos Órgãos (with subtle Dedo de Deus spire) & Serra do Mar
function evalDistantSerra(x, z) {
  if (z > -495) return -6.0;

  const chainStart = smoothstep(-520, -640, z);
  const chainPeak = Math.exp(-((z + 740) * (z + 740)) / (155 * 155));

  // Layered misty mountain chain (deliberately lower & more atmospheric than foreground monoliths, matching photo!)
  const ridge =
    (ridgeFbm(x * 0.0062 + 1.2, z * 0.0062 - 0.8, 5) * 20.5 +
      Math.max(0, fbm2D(x * 0.0032, z * 0.0035, 3)) * 12.0) *
    chainStart;

  // Signature right-center distant Serra dos Órgãos silhouette visible under the fiery sunset!
  const serraOrgaosPeak =
    peak(x, z, 316, -685, 86, 56, 26.5, 1.48, 0.14) +
    peak(x, z, 254, -695, 58, 42, 17.5, 1.50, -0.2) +
    peak(x, z, 362, -680, 52, 40, 15.0, 1.48, 0.22);

  const serraEstrela =
    peak(x, z, -35, -690, 92, 56, 18.0, 1.45, 0.05) +
    peak(x, z, -195, -660, 88, 56, 23.0, 1.45, -0.1);

  const serraTiririca =
    peak(x, z, 520, -635, 120, 75, 25.0, 1.4, 0.2) +
    peak(x, z, 650, -545, 110, 85, 24.0, 1.4, -0.1);

  const total =
    ridge * (0.45 + 0.55 * chainPeak) +
    serraOrgaosPeak +
    serraEstrela +
    serraTiririca;

  if (total <= 0.3 && z > -615) return -6.0;
  return -5.5 + chainStart * 4.5 + total;
}

export function getTerrainHeight(x, z) {
  let h = -5.5;
  const hFg = evalForegroundNiteroi(x, z);
  if (hFg > h) h = hFg;

  const hJu = evalJurujubaHeadland(x, z);
  if (hJu > h) h = smax(h, hJu, 2.0);

  const hNi = evalNiteroiPeninsula(x, z);
  if (hNi > h) h = smax(h, hNi, 1.8);

  const hRi = evalRioDeJaneiro(x, z);
  if (hRi > h) h = Math.max(h, hRi);

  const hSe = evalDistantSerra(x, z);
  if (hSe > h) h = Math.max(h, hSe);

  return h;
}

export function getTerrainNormal(x, z, eps = 0.75) {
  const hL = getTerrainHeight(x - eps, z);
  const hR = getTerrainHeight(x + eps, z);
  const hD = getTerrainHeight(x, z - eps);
  const hU = getTerrainHeight(x, z + eps);
  const nx = hL - hR;
  const ny = 2.0 * eps;
  const nz = hD - hU;
  const invLen = 1.0 / Math.hypot(nx, ny, nz);
  return { x: nx * invLen, y: ny * invLen, z: nz * invLen };
}

export function getUrbanMask(x, z, y, slopeY) {
  if (y < 0.35 || slopeY < 0.74) return 0.0;
  if (z < -480) return 0.0;

  let urban = 0.0;

  // 1. São Francisco & Charitas crescent directly below Parque da Cidade
  if (z > 10 && z < 190 && x > -158 && x < 172) {
    const coveDist = getCrescentCoveDist(x, z);
    const band =
      smoothstep(2.2, 8.5, coveDist) * smoothstep(52.0, 20.0, coveDist);
    const heightLimit = smoothstep(9.5, 4.4, y);
    urban = Math.max(urban, band * heightLimit);
  }

  // 2. Jurujuba coastal village tucked under Morro do Morcego
  if (z > 4 && z < 56 && x > -126 && x < -44 && y < 6.0) {
    const d = distToSegment(x, z, -116, 42, -56, 12).dist;
    urban = Math.max(urban, smoothstep(17, 5, d) * smoothstep(6.0, 2.8, y));
  }

  // 3. Icaraí, Ingá, Gragoatá, Centro de Niterói peninsula
  if (x > 58 && x < 285 && z > -180 && z < 88 && y < 7.8) {
    const heightLimit = smoothstep(7.8, 3.2, y);
    const macDist = Math.hypot(x - 105, z + 34);
    const isletDist = Math.hypot(x - 84, z + 42);
    const clean = smoothstep(14.5, 20.5, macDist) * smoothstep(8.5, 13.0, isletDist);
    urban = Math.max(urban, 0.92 * heightLimit * clean);
  }

  // 4. Rio de Janeiro Waterfront (Botafogo, Flamengo, Glória, Centro, Porto Maravilha)
  if (z < -195 && z > -455 && x > -275 && x < 115 && y < 8.2) {
    const heightLimit = smoothstep(8.2, 2.8, y);
    const sugarloafClear = smoothstep(30, 40, Math.hypot(x + 252, z + 188));
    urban = Math.max(urban, 0.95 * heightLimit * sugarloafClear);
  }

  return Math.max(0, Math.min(1, urban));
}

export function getBeachMask(x, z, y, slopeY) {
  if (y < -0.25 || y > 2.1 || slopeY < 0.85) return 0.0;
  let beach = 0.0;

  if (z > 32 && z < 170 && x > -138 && x < 145) {
    const coveDist = getCrescentCoveDist(x, z);
    beach = Math.max(
      beach,
      smoothstep(-2.4, 1.4, coveDist) * smoothstep(8.4, 3.0, coveDist)
    );
  }

  if (x > 92 && x < 145 && z > -65 && z < 45 && y < 1.85) {
    const macClear = smoothstep(12.5, 17.0, Math.hypot(x - 105, z + 34));
    beach = Math.max(beach, smoothstep(1.85, 0.3, y) * 0.78 * macClear);
  }

  // Praia Vermelha cove tucked beside Morro da Urca & Sugarloaf!
  if (x > -296 && x < -256 && z > -216 && z < -184 && y < 1.8) {
    beach = Math.max(beach, smoothstep(1.8, 0.2, y) * 0.72);
  }

  return Math.max(0, Math.min(1, beach));
}

// Compute proximity to the iconic sweeping coastal beachfront avenue (Av. Quintino Bocaiúva / Sílvio Picanço)
export function getPromenadeRoadMask(x, z, y) {
  if (y < 0.6 || y > 5.5) return 0.0;
  if (z > 20 && z < 180 && x > -145 && x < 152) {
    const d = getCrescentCoveDist(x, z);
    // Road strip sits right behind the sandy beach at coveDist ∈ [5.5, 9.2]
    return smoothstep(4.2, 6.0, d) * smoothstep(10.6, 8.2, d);
  }
  return 0.0;
}

export function sampleCrescentCurve(theta) {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return (offset = 0) => {
    let r = 1.0 + offset / 94.0;
    for (let i = 0; i < 4; i++) {
      const x = -4 + cosT * r * 124.0;
      const z = 52 + sinT * r * 86.0;
      const d = getCrescentCoveDist(x, z) - offset;
      r -= d / 102.0;
    }
    const x = -4 + cosT * r * 124.0;
    const z = 52 + sinT * r * 86.0;
    const y = getTerrainHeight(x, z);
    return { x, y, z };
  };
}

export const BRIDGE_START = { x: 48, z: -428 };
export const BRIDGE_END = { x: 332, z: -192 };

export function sampleBridgePoint(t) {
  const x = BRIDGE_START.x + (BRIDGE_END.x - BRIDGE_START.x) * t;
  const z =
    BRIDGE_START.z +
    (BRIDGE_END.z - BRIDGE_START.z) * t +
    Math.sin(t * Math.PI) * 18.0;
  const arch = Math.exp(-Math.pow((t - 0.46) / 0.135, 2.0));
  const approach = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.94, t);
  const y = 2.4 + approach * 1.45 + arch * 7.2;
  return { x, y, z };
}

// World-space bounds for baked per-pixel Geography DataTexture (used by Water & Terrain shaders for razor-smooth shorelines!)
export const GEO_FIELD_BOUNDS = {
  minX: -460,
  maxX: 440,
  minZ: -560,
  maxZ: 240,
};

// Bake a 768x768 HalfFloat RGBA Geography Field (100% WebGL2 core linear-filterable on every GPU!):
// R = exact terrain height (world Y — negative under water, positive on land!)
// G = beach mask [0..1]
// B = coastal promenade avenue mask [0..1]
// A = shelter/cove calm-water factor [0..1]
export function createGeographyFieldTexture(size = 768) {
  const { minX, maxX, minZ, maxZ } = GEO_FIELD_BOUNDS;
  const data = new Uint16Array(size * size * 4);
  const toHalf = THREE.DataUtils.toHalfFloat;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;

  let ptr = 0;
  for (let iz = 0; iz < size; iz++) {
    const v = iz / (size - 1);
    const z = minZ + v * spanZ;
    for (let ix = 0; ix < size; ix++) {
      const u = ix / (size - 1);
      const x = minX + u * spanX;
      const h = getTerrainHeight(x, z);
      let beach = 0.0;
      let road = 0.0;
      if (h > -0.35 && h < 6.0) {
        const hX = getTerrainHeight(x + 0.8, z);
        const hZ = getTerrainHeight(x, z + 0.8);
        const ny = 0.8 / Math.hypot(hX - h, 0.8, hZ - h);
        beach = getBeachMask(x, z, h, ny);
        road = getPromenadeRoadMask(x, z, h);
      }
      const coveDist = Math.hypot((x + 4) / 135, (z - 52) / 96);
      const shelter = smoothstep(1.35, 0.45, coveDist);

      data[ptr++] = toHalf(h);
      data[ptr++] = toHalf(beach);
      data[ptr++] = toHalf(road);
      data[ptr++] = toHalf(shelter);
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
