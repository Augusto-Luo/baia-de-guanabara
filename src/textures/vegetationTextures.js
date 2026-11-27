import * as THREE from 'three';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Convert height + translucency buffers into a Sobel tangent-space Normal + Translucency(A) DataTexture!
function buildBotanicalNormalTransTexture(heightData, transData, width, height, strength = 3.2) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ym = Math.max(0, y - 1);
    const yp = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(width - 1, x + 1);

      const tl = heightData[ym * width + xm];
      const t = heightData[ym * width + x];
      const tr = heightData[ym * width + xp];
      const l = heightData[y * width + xm];
      const r = heightData[y * width + xp];
      const bl = heightData[yp * width + xm];
      const b = heightData[yp * width + x];
      const br = heightData[yp * width + xp];

      const dx = ((tl + 2 * l + bl) - (tr + 2 * r + br)) * 0.25 * strength;
      const dy = ((tl + 2 * t + tr) - (bl + 2 * b + br)) * 0.25 * strength;
      const dz = 1.0;
      const inv = 1.0 / Math.hypot(dx, dy, dz);

      const idx = (y * width + x) * 4;
      data[idx] = Math.round((dx * inv * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255);
      data[idx + 3] = Math.round(Math.max(0, Math.min(1, transData[y * width + x])) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Draw one botanically detailed Atlantic Forest broadleaf with curved midrib, pinnate veins & drip-tip
function drawTropicalLeaf(ctx, hCtx, tCtx, cx, cy, length, width, angle, palette, leafType, rand) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  hCtx.save();
  hCtx.translate(cx, cy);
  hCtx.rotate(angle);

  tCtx.save();
  tCtx.translate(cx, cy);
  tCtx.rotate(angle);

  const drawShape = (c) => {
    c.beginPath();
    if (leafType === 0) {
      // Glossy Atlantic Forest Ficus / Guanandi broadleaf with drip-tip
      c.moveTo(0, 0);
      c.bezierCurveTo(width * 0.64, -length * 0.20, width * 0.60, -length * 0.72, 0, -length);
      c.bezierCurveTo(-width * 0.60, -length * 0.72, -width * 0.64, -length * 0.20, 0, 0);
    } else if (leafType === 1) {
      // Longer lanceolate rainforest leaf (Ipê / Mangifera / Jequitibá)
      c.moveTo(0, 0);
      c.bezierCurveTo(width * 0.46, -length * 0.28, width * 0.34, -length * 0.80, 0, -length);
      c.bezierCurveTo(-width * 0.34, -length * 0.80, -width * 0.46, -length * 0.28, 0, 0);
    } else {
      // Broad heart/ovate tropical Philodendron / Tibouchina leaf
      c.moveTo(0, 0);
      c.bezierCurveTo(width * 0.76, -length * 0.14, width * 0.72, -length * 0.58, 0, -length);
      c.bezierCurveTo(-width * 0.72, -length * 0.58, -width * 0.76, -length * 0.14, 0, 0);
    }
    c.closePath();
  };

  // Rich chlorophyll albedo gradient (dark shaded base -> vibrant mid-blade -> sunlit tip)
  const grad = ctx.createLinearGradient(0, 0, 0, -length);
  grad.addColorStop(0.0, palette.base);
  grad.addColorStop(0.55, palette.mid);
  grad.addColorStop(1.0, palette.tip);
  drawShape(ctx);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle shaded leaf margin & natural curl rim
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = Math.max(1.0, width * 0.048);
  ctx.stroke();

  // Midrib vein
  ctx.beginPath();
  ctx.moveTo(0, -length * 0.02);
  ctx.quadraticCurveTo(width * (rand() - 0.5) * 0.07, -length * 0.5, 0, -length * 0.95);
  ctx.strokeStyle = palette.vein;
  ctx.lineWidth = Math.max(1.2, width * 0.062);
  ctx.stroke();

  // Lateral pinnate veins
  const veinCount = 6 + Math.floor(rand() * 4);
  ctx.lineWidth = Math.max(0.75, width * 0.026);
  ctx.strokeStyle = palette.subvein;
  for (let i = 1; i <= veinCount; i++) {
    const t = i / (veinCount + 1.15);
    const y0 = -length * t;
    const span = width * Math.sin(t * Math.PI) * 0.45;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(span * 0.55, y0 - length * 0.04, span, y0 - length * 0.11);
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(-span * 0.55, y0 - length * 0.04, -span, y0 - length * 0.11);
    ctx.stroke();
  }

  // Height map: individual leaf tilt + domed half-blades + raised midrib
  const hGrad = hCtx.createLinearGradient(-width * 0.5, 0, width * 0.5, -length);
  const tiltA = Math.floor(105 + rand() * 75);
  const tiltB = Math.floor(155 + rand() * 80);
  const tiltC = Math.floor(90 + rand() * 70);
  hGrad.addColorStop(0.0, `rgb(${tiltA},${tiltA},${tiltA})`);
  hGrad.addColorStop(0.5, `rgb(${tiltB},${tiltB},${tiltB})`);
  hGrad.addColorStop(1.0, `rgb(${tiltC},${tiltC},${tiltC})`);
  drawShape(hCtx);
  hCtx.fillStyle = hGrad;
  hCtx.fill();

  hCtx.beginPath();
  hCtx.moveTo(0, 0);
  hCtx.lineTo(0, -length * 0.92);
  hCtx.strokeStyle = 'rgb(248,248,248)';
  hCtx.lineWidth = Math.max(1.8, width * 0.085);
  hCtx.stroke();

  // Translucency map: thin translucent blades (bright), thicker veins & base (darker)!
  const tGrad = tCtx.createLinearGradient(0, 0, 0, -length);
  tGrad.addColorStop(0.0, 'rgb(115,115,115)');
  tGrad.addColorStop(0.5, 'rgb(215,215,215)');
  tGrad.addColorStop(1.0, 'rgb(245,245,245)');
  drawShape(tCtx);
  tCtx.fillStyle = tGrad;
  tCtx.fill();

  tCtx.beginPath();
  tCtx.moveTo(0, 0);
  tCtx.lineTo(0, -length * 0.9);
  tCtx.strokeStyle = 'rgb(75,75,75)';
  tCtx.lineWidth = Math.max(1.8, width * 0.08);
  tCtx.stroke();

  ctx.restore();
  hCtx.restore();
  tCtx.restore();
}

// Draw iconic Brazilian Embaúba (Cecropia) palmate candelabra star-lobed leaf!
function drawCecropiaLeaf(ctx, hCtx, tCtx, cx, cy, radius, angle, rand) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  hCtx.save();
  hCtx.translate(cx, cy);
  hCtx.rotate(angle);
  tCtx.save();
  tCtx.translate(cx, cy);
  tCtx.rotate(angle);

  const lobes = 7 + Math.floor(rand() * 3);
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + (rand() - 0.5) * 0.14;
    const lobeLen = radius * (0.68 + 0.34 * Math.sin((i / lobes) * Math.PI) + (rand() - 0.5) * 0.12);
    const lobeW = lobeLen * 0.29;

    ctx.save();
    ctx.rotate(a);
    hCtx.save();
    hCtx.rotate(a);
    tCtx.save();
    tCtx.rotate(a);

    const drawLobe = (c) => {
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(lobeW * 0.65, -lobeLen * 0.25, lobeW * 0.85, -lobeLen * 0.72, 0, -lobeLen);
      c.bezierCurveTo(-lobeW * 0.85, -lobeLen * 0.72, -lobeW * 0.65, -lobeLen * 0.25, 0, 0);
      c.closePath();
    };

    const g = ctx.createLinearGradient(0, 0, 0, -lobeLen);
    g.addColorStop(0.0, '#1e3521');
    g.addColorStop(0.55, '#3b5c34');
    g.addColorStop(1.0, '#62844b'); // Distinct silvery-olive Embaúba canopy tint!
    drawLobe(ctx);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,24,14,0.5)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Pale central lobe vein
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -lobeLen * 0.92);
    ctx.strokeStyle = 'rgba(148,176,112,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const hv = Math.floor(135 + rand() * 85);
    drawLobe(hCtx);
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.fill();

    drawLobe(tCtx);
    tCtx.fillStyle = 'rgb(220,220,220)';
    tCtx.fill();

    ctx.restore();
    hCtx.restore();
    tCtx.restore();
  }

  ctx.restore();
  hCtx.restore();
  tCtx.restore();
}

function finalizeBotanicalPair(colorCanvas, heightCanvas, transCanvas, sizeW, sizeH, normalStrength) {
  const hPixels = heightCanvas.getContext('2d').getImageData(0, 0, sizeW, sizeH).data;
  const tPixels = transCanvas.getContext('2d').getImageData(0, 0, sizeW, sizeH).data;
  const hFloat = new Float32Array(sizeW * sizeH);
  const tFloat = new Float32Array(sizeW * sizeH);
  for (let i = 0; i < sizeW * sizeH; i++) {
    hFloat[i] = hPixels[i * 4] / 255.0;
    tFloat[i] = tPixels[i * 4] / 255.0;
  }

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 8;
  colorTex.needsUpdate = true;

  const normalMap = buildBotanicalNormalTransTexture(hFloat, tFloat, sizeW, sizeH, normalStrength);
  return { map: colorTex, normalMap };
}

// 1. Primary 1024x1024 Mata Atlântica Broadleaf Canopy Branch Cluster (Ficus / Jequitibá / Guanandi)
export function createRainforestFoliageTextures() {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hCtx = heightCanvas.getContext('2d');
  hCtx.fillStyle = 'rgb(55,55,55)';
  hCtx.fillRect(0, 0, size, size);

  const transCanvas = document.createElement('canvas');
  transCanvas.width = size;
  transCanvas.height = size;
  const tCtx = transCanvas.getContext('2d');
  tCtx.fillStyle = 'rgb(30,30,30)';
  tCtx.fillRect(0, 0, size, size);

  const rand = createRng(43092254);

  const palettes = [
    { base: '#142a18', mid: '#234726', tip: '#3c6b34', edge: 'rgba(8,20,10,0.58)', vein: 'rgba(92,136,68,0.62)', subvein: 'rgba(72,112,56,0.40)' },
    { base: '#19311b', mid: '#2c542a', tip: '#4d7c3a', edge: 'rgba(10,24,12,0.55)', vein: 'rgba(112,154,76,0.60)', subvein: 'rgba(84,126,60,0.36)' },
    { base: '#102416', mid: '#1c3d22', tip: '#315b2f', edge: 'rgba(6,16,9,0.62)', vein: 'rgba(76,116,60,0.52)', subvein: 'rgba(58,94,46,0.34)' },
    { base: '#20371a', mid: '#375b2b', tip: '#5c843e', edge: 'rgba(14,26,10,0.52)', vein: 'rgba(128,166,80,0.64)', subvein: 'rgba(96,134,64,0.36)' },
  ];

  // Woody inner twigs radiating outward
  const cx = size * 0.5;
  const cy = size * 0.52;
  ctx.lineCap = 'round';
  for (let b = 0; b < 11; b++) {
    const a = (b / 11) * Math.PI * 2 + (rand() - 0.5) * 0.42;
    const len = size * (0.22 + rand() * 0.22);
    ctx.beginPath();
    ctx.moveTo(cx + (rand() - 0.5) * 28, cy + (rand() - 0.5) * 28);
    ctx.quadraticCurveTo(
      cx + Math.cos(a + 0.24) * len * 0.55,
      cy + Math.sin(a + 0.24) * len * 0.55,
      cx + Math.cos(a) * len,
      cy + Math.sin(a) * len
    );
    ctx.strokeStyle = '#2a2017';
    ctx.lineWidth = 6 + rand() * 5;
    ctx.stroke();
  }

  // Layer 1: Inner shaded dense core (eliminates see-through gaps)
  for (let i = 0; i < 175; i++) {
    const r = Math.pow(rand(), 0.64) * size * 0.34;
    const theta = rand() * Math.PI * 2;
    const lx = cx + Math.cos(theta) * r;
    const ly = cy + Math.sin(theta) * r;
    const ang = theta + Math.PI * 0.5 + (rand() - 0.5) * 1.1;
    const len = 68 + rand() * 74;
    const wid = len * (0.36 + rand() * 0.24);
    const pal = palettes[rand() < 0.62 ? 2 : 0];
    drawTropicalLeaf(ctx, hCtx, tCtx, lx, ly, len, wid, ang, pal, Math.floor(rand() * 3), rand);
  }

  // Layer 2: Mid-crown lush overlapping leaves
  for (let i = 0; i < 185; i++) {
    const r = (0.1 + Math.pow(rand(), 0.72) * 0.34) * size;
    const theta = rand() * Math.PI * 2;
    const lx = cx + Math.cos(theta) * r;
    const ly = cy + Math.sin(theta) * r;
    const ang = theta + Math.PI * 0.5 + (rand() - 0.5) * 0.9;
    const len = 60 + rand() * 64;
    const wid = len * (0.34 + rand() * 0.24);
    const pal = palettes[Math.floor(rand() * palettes.length)];
    drawTropicalLeaf(ctx, hCtx, tCtx, lx, ly, len, wid, ang, pal, Math.floor(rand() * 3), rand);
  }

  // Layer 3: Outer crisp silhouetted botanical perimeter leaves
  for (let i = 0; i < 120; i++) {
    const r = (0.28 + rand() * 0.14) * size;
    const theta = rand() * Math.PI * 2;
    const lx = cx + Math.cos(theta) * r;
    const ly = cy + Math.sin(theta) * r;
    const ang = theta + Math.PI * 0.5 + (rand() - 0.5) * 0.58;
    const len = 48 + rand() * 54;
    const wid = len * (0.32 + rand() * 0.22);
    const pal = palettes[rand() < 0.5 ? 1 : 3];
    drawTropicalLeaf(ctx, hCtx, tCtx, lx, ly, len, wid, ang, pal, rand() < 0.65 ? 0 : 1, rand);
  }

  return finalizeBotanicalPair(colorCanvas, heightCanvas, transCanvas, size, size, 3.4);
}

// 2. Secondary 1024x1024 Brazilian Embaúba (Cecropia) + Subtle Quaresmeira Blossom Canopy Cluster
export function createCecropiaFoliageTextures() {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d');

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = size;
  heightCanvas.height = size;
  const hCtx = heightCanvas.getContext('2d');
  hCtx.fillStyle = 'rgb(55,55,55)';
  hCtx.fillRect(0, 0, size, size);

  const transCanvas = document.createElement('canvas');
  transCanvas.width = size;
  transCanvas.height = size;
  const tCtx = transCanvas.getContext('2d');
  tCtx.fillStyle = 'rgb(30,30,30)';
  tCtx.fillRect(0, 0, size, size);

  const rand = createRng(824119);
  const cx = size * 0.5;
  const cy = size * 0.5;

  // Inner dark foliage backing
  const darkPal = { base: '#142617', mid: '#244225', tip: '#3a5e34', edge: 'rgba(10,18,10,0.55)', vein: 'rgba(105,138,76,0.55)', subvein: 'rgba(72,102,52,0.34)' };
  for (let i = 0; i < 85; i++) {
    const r = Math.pow(rand(), 0.7) * size * 0.30;
    const theta = rand() * Math.PI * 2;
    drawTropicalLeaf(ctx, hCtx, tCtx, cx + Math.cos(theta) * r, cy + Math.sin(theta) * r, 72 + rand() * 55, 32 + rand() * 20, theta + Math.PI * 0.5, darkPal, 0, rand);
  }

  // Iconic radiating palmate Embaúba (Cecropia) umbrella-star leaves!
  for (let i = 0; i < 38; i++) {
    const r = Math.pow(rand(), 0.65) * size * 0.33;
    const theta = rand() * Math.PI * 2;
    const lx = cx + Math.cos(theta) * r;
    const ly = cy + Math.sin(theta) * r;
    const rad = 74 + rand() * 68;
    drawCecropiaLeaf(ctx, hCtx, tCtx, lx, ly, rad, rand() * Math.PI * 2, rand);
  }

  return finalizeBotanicalPair(colorCanvas, heightCanvas, transCanvas, size, size, 3.2);
}

// 3. 512x1024 Detailed Pinnate Jerivá / Imperial Palm Frond (54 arched serrated leaflets)
export function createPalmFrondTextures() {
  const w = 512;
  const h = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const ctx = colorCanvas.getContext('2d');

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = w;
  heightCanvas.height = h;
  const hCtx = heightCanvas.getContext('2d');
  hCtx.fillStyle = 'rgb(55,55,55)';
  hCtx.fillRect(0, 0, w, h);

  const transCanvas = document.createElement('canvas');
  transCanvas.width = w;
  transCanvas.height = h;
  const tCtx = transCanvas.getContext('2d');
  tCtx.fillStyle = 'rgb(20,20,20)';
  tCtx.fillRect(0, 0, w, h);

  const rand = createRng(994123);
  const midX = w * 0.5;

  // Central rachis stem
  const stemGrad = ctx.createLinearGradient(midX, h, midX, 20);
  stemGrad.addColorStop(0, '#3e5226');
  stemGrad.addColorStop(1, '#688642');
  ctx.strokeStyle = stemGrad;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(midX, h - 8);
  ctx.lineTo(midX, 24);
  ctx.stroke();

  hCtx.strokeStyle = 'rgb(245,245,245)';
  hCtx.lineWidth = 12;
  hCtx.beginPath();
  hCtx.moveTo(midX, h - 8);
  hCtx.lineTo(midX, 24);
  hCtx.stroke();

  const pairs = 54;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const y = h - 48 - t * (h - 80);
    const env = Math.sin(Math.pow(t, 0.72) * Math.PI);
    const leafletLen = (44 + env * 204) * (0.92 + rand() * 0.16);
    const leafletW = 6.8 + env * 6.8;

    for (const side of [-1, 1]) {
      const droop = (1.0 - t) * 0.24 + (rand() - 0.5) * 0.08;
      const tipX = midX + side * leafletLen * 0.94;
      const tipY = y - leafletLen * (0.28 + t * 0.48) + droop * 34;
      const ctrlX = midX + side * leafletLen * 0.52;
      const ctrlY = y - leafletLen * (0.26 + t * 0.24);

      const g = ctx.createLinearGradient(midX, y, tipX, tipY);
      const shade = rand() * 14 - 7;
      g.addColorStop(0, `rgb(${Math.round(30 + shade)},${Math.round(62 + shade)},${Math.round(26 + shade)})`);
      g.addColorStop(0.6, `rgb(${Math.round(46 + shade)},${Math.round(90 + shade)},${Math.round(36 + shade)})`);
      g.addColorStop(1, `rgb(${Math.round(74 + shade)},${Math.round(122 + shade)},${Math.round(48 + shade)})`);

      const drawBlade = (c) => {
        c.beginPath();
        c.moveTo(midX, y + leafletW * 0.4);
        c.quadraticCurveTo(ctrlX, ctrlY - leafletW * 0.45, tipX, tipY);
        c.quadraticCurveTo(ctrlX, ctrlY + leafletW * 0.65, midX, y - leafletW * 0.4);
        c.closePath();
      };

      drawBlade(ctx);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.strokeStyle = 'rgba(132,172,88,0.45)';
      ctx.lineWidth = 1.1;
      ctx.stroke();

      const hv = Math.round(140 + rand() * 88);
      drawBlade(hCtx);
      hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hCtx.fill();

      drawBlade(tCtx);
      tCtx.fillStyle = 'rgb(228,228,228)';
      tCtx.fill();
    }
  }

  return finalizeBotanicalPair(colorCanvas, heightCanvas, transCanvas, w, h, 3.0);
}

// 4. 512x1024 Foreground Hero Tropical Understory: Giant Tree Fern (Samambaia) & Ribbed Heliconia/Banana Blade!
export function createUnderstoryFrondTextures() {
  const w = 512;
  const h = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const ctx = colorCanvas.getContext('2d');

  const heightCanvas = document.createElement('canvas');
  heightCanvas.width = w;
  heightCanvas.height = h;
  const hCtx = heightCanvas.getContext('2d');
  hCtx.fillStyle = 'rgb(50,50,50)';
  hCtx.fillRect(0, 0, w, h);

  const transCanvas = document.createElement('canvas');
  transCanvas.width = w;
  transCanvas.height = h;
  const tCtx = transCanvas.getContext('2d');
  tCtx.fillStyle = 'rgb(20,20,20)';
  tCtx.fillRect(0, 0, w, h);

  const rand = createRng(651923);
  const midX = w * 0.5;

  // Giant ribbed tropical Banana / Heliconia / Philodendron blade (left half? No — full centered lush fern-heliconia hybrid frond!)
  // Let's draw a super detailed Mata Atlântica Giant Tree Fern (Samambaia-açu) frond with lacy serrated pinnae!
  ctx.strokeStyle = '#3c5626';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(midX, h - 10);
  ctx.lineTo(midX, 34);
  ctx.stroke();

  hCtx.strokeStyle = 'rgb(245,245,245)';
  hCtx.lineWidth = 10;
  hCtx.beginPath();
  hCtx.moveTo(midX, h - 10);
  hCtx.lineTo(midX, 34);
  hCtx.stroke();

  const pinnaePairs = 34;
  for (let i = 0; i < pinnaePairs; i++) {
    const t = i / (pinnaePairs - 1);
    const y = h - 70 - t * (h - 115);
    const env = Math.sin(Math.pow(t, 0.68) * Math.PI);
    const len = 32 + env * 208;
    const baseW = 14 + env * 14;

    for (const side of [-1, 1]) {
      const tipX = midX + side * len;
      const tipY = y - len * (0.20 + t * 0.36);

      // Serrated pinna with sub-leaflets!
      const subSteps = 7 + Math.floor(env * 7);
      for (let s = 0; s < subSteps; s++) {
        const u = (s + 0.35) / subSteps;
        const px = midX + (tipX - midX) * u;
        const py = y + (tipY - y) * u;
        const subLen = baseW * (1.0 - u * 0.72) * (0.85 + rand() * 0.3);
        const subAng = Math.atan2(tipY - y, tipX - midX) + side * 0.75;

        const drawSub = (c) => {
          c.beginPath();
          c.ellipse(
            px + Math.cos(subAng) * subLen * 0.38,
            py + Math.sin(subAng) * subLen * 0.38,
            subLen * 0.65,
            subLen * 0.28,
            subAng,
            0,
            Math.PI * 2
          );
        };

        const shade = Math.round(rand() * 16 - 8);
        ctx.fillStyle = `rgb(${36 + shade + Math.round(u * 26)},${78 + shade + Math.round(u * 38)},${28 + shade + Math.round(u * 14)})`;
        drawSub(ctx);
        ctx.fill();

        const hv = Math.round(145 + rand() * 80);
        hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
        drawSub(hCtx);
        hCtx.fill();

        tCtx.fillStyle = 'rgb(235,235,235)';
        drawSub(tCtx);
        tCtx.fill();
      }
      // Pinna central vein
      ctx.strokeStyle = 'rgba(122,164,74,0.52)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
  }

  return finalizeBotanicalPair(colorCanvas, heightCanvas, transCanvas, w, h, 3.2);
}

// 5. 512x512 Fibrous Mossy Tropical Bark (Albedo + Sobel Normal Map)
export function createBarkTextures() {
  const w = 512;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const hc = document.createElement('canvas');
  hc.width = w;
  hc.height = h;
  const hCtx = hc.getContext('2d');
  hCtx.fillStyle = 'rgb(128,128,128)';
  hCtx.fillRect(0, 0, w, h);

  const rand = createRng(77123);
  ctx.fillStyle = '#382f27';
  ctx.fillRect(0, 0, w, h);

  // Horizontal palm rings + deep vertical tropical bark fissures
  for (let y = 0; y < h; y += 16) {
    ctx.fillStyle = `rgba(18, 14, 10, ${0.30 + rand() * 0.24})`;
    ctx.fillRect(0, y, w, 3 + rand() * 3);
    hCtx.fillStyle = 'rgb(70,70,70)';
    hCtx.fillRect(0, y, w, 3);

    ctx.fillStyle = `rgba(108, 94, 78, ${0.14 + rand() * 0.14})`;
    ctx.fillRect(0, y + 4, w, 2);
    hCtx.fillStyle = 'rgb(190,190,190)';
    hCtx.fillRect(0, y + 4, w, 2);
  }
  for (let i = 0; i < 680; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const bw = 2 + rand() * 4;
    const bh = 18 + rand() * 52;
    const dark = rand() > 0.48;
    ctx.fillStyle = dark ? 'rgba(18,14,10,0.36)' : 'rgba(92,80,64,0.24)';
    ctx.fillRect(x, y, bw, bh);
    hCtx.fillStyle = dark ? 'rgb(65,65,65)' : 'rgb(198,198,198)';
    hCtx.fillRect(x, y, bw, bh);
  }
  // Organic Atlantic Forest moss & pale lichen patches on bark!
  for (let i = 0; i < 72; i++) {
    const isLichen = rand() < 0.25;
    ctx.fillStyle = isLichen
      ? `rgba(110, 128, 104, ${0.18 + rand() * 0.18})`
      : `rgba(36, 68, 28, ${0.22 + rand() * 0.26})`;
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, 10 + rand() * 24, 6 + rand() * 18, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  map.needsUpdate = true;

  const hp = hCtx.getImageData(0, 0, w, h).data;
  const hFloat = new Float32Array(w * h);
  const tDummy = new Float32Array(w * h).fill(1.0);
  for (let i = 0; i < w * h; i++) hFloat[i] = hp[i * 4] / 255.0;
  const normalMap = buildBotanicalNormalTransTexture(hFloat, tDummy, w, h, 3.6);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;

  return { map, normalMap };
}
