import * as THREE from 'three';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 1. Brazilian Modernist Beachfront Apartment Facade Atlas (São Francisco, Icaraí, Botafogo, Flamengo)
// Authentic off-white/sand weathered concrete slabs, deep recessed balconies, realistic sparse warm apartment clusters!
export function createModernistApartmentTextures() {
  const w = 512;
  const h = 512;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const dCtx = diffCanvas.getContext('2d');

  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = w;
  emisCanvas.height = h;
  const eCtx = emisCanvas.getContext('2d');

  const rand = createRng(20261128);

  // Light warm Brazilian coastal concrete/stucco base (reads authentically under twilight sky & streetlamp bounce!)
  dCtx.fillStyle = '#5c5b62';
  dCtx.fillRect(0, 0, w, h);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  const cols = 10;
  const rows = 18;
  const cellW = w / cols;
  const cellH = h / rows;

  // Vertical concrete pilasters & bay tonal variation
  for (let c = 0; c < cols; c++) {
    const shade = 78 + Math.floor(rand() * 24);
    dCtx.fillStyle = `rgb(${shade + 4}, ${shade + 2}, ${shade})`;
    dCtx.fillRect(c * cellW, 0, cellW, h);
    dCtx.fillStyle = 'rgba(28, 30, 38, 0.72)';
    dCtx.fillRect(c * cellW, 0, 3, h);
  }

  const warmColors = ['#ffbe68', '#ffa342', '#ffdfa8', '#ffb358', '#fff2da', '#d4e4fa'];

  for (let r = 0; r < rows; r++) {
    const y = r * cellH;
    // Projecting horizontal concrete balcony parapet + deep shadow soffit underneath!
    dCtx.fillStyle = '#7f7d84';
    dCtx.fillRect(0, y + cellH - 7, w, 5);
    dCtx.fillStyle = 'rgba(14, 16, 22, 0.92)';
    dCtx.fillRect(0, y, w, 4);

    const isGround = r >= rows - 2;
    let unitLit = false;

    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      const padX = cellW * 0.14;
      const padTop = 5;
      const winW = cellW - padX * 2;
      const winH = cellH - 12;

      // Dark recessed twilight balcony / glass sliding door
      dCtx.fillStyle = '#151a26';
      dCtx.fillRect(x + padX, y + padTop, winW, winH);

      // Cohesive apartment-level lighting (pairs of bays light together, sparse overall ~22% — ZERO polka-dot confetti!)
      if (c % 2 === 0) {
        unitLit = rand() < (isGround ? 0.50 : 0.21);
      }
      const lit = unitLit ? rand() < 0.72 : rand() < (isGround ? 0.28 : 0.08);

      if (lit) {
        const pick = rand();
        let col;
        if (pick < 0.65) col = warmColors[Math.floor(rand() * 4)];
        else if (pick < 0.88) col = warmColors[4];
        else col = warmColors[5];

        const brightness = isGround ? 0.58 + rand() * 0.32 : 0.34 + rand() * 0.48;
        // Soft warm interior glow gradient (brighter ceiling lamp fading gently downward across the room!)
        const grad = eCtx.createLinearGradient(0, y + padTop, 0, y + padTop + winH);
        grad.addColorStop(0.0, col);
        grad.addColorStop(1.0, 'rgba(180, 100, 35, 0.35)');
        eCtx.globalAlpha = brightness;
        eCtx.fillStyle = grad;
        eCtx.fillRect(x + padX + 1, y + padTop + 1, winW - 2, winH - 2);

        // Balcony railing / curtain mullion shadow
        eCtx.fillStyle = 'rgba(16, 12, 10, 0.55)';
        eCtx.fillRect(x + padX + winW * 0.48, y + padTop, 2, winH);

        dCtx.globalAlpha = 0.28;
        dCtx.fillStyle = col;
        dCtx.fillRect(x + padX, y + padTop, winW, winH);
        dCtx.globalAlpha = 1.0;
      }
    }
  }
  eCtx.globalAlpha = 1.0;

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const emissiveMap = new THREE.CanvasTexture(emisCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = 8;

  return { map, emissiveMap };
}

// 2. Modern Glass & Aluminum Commercial Tower Atlas (Centro Rio, Centro Niterói, São Francisco waterfront!)
export function createGlassTowerTextures() {
  const w = 512;
  const h = 512;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const dCtx = diffCanvas.getContext('2d');

  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = w;
  emisCanvas.height = h;
  const eCtx = emisCanvas.getContext('2d');

  const rand = createRng(941827);

  // Sleek reflective twilight steel-blue curtain wall base
  dCtx.fillStyle = '#243144';
  dCtx.fillRect(0, 0, w, h);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  const cols = 12;
  const rows = 20;
  const cellW = w / cols;
  const cellH = h / rows;

  for (let r = 0; r < rows; r++) {
    const y = r * cellH;
    // Whole floor bands lit together (signature look of modern office towers at twilight!)
    const floorLit = rand() < 0.28;
    const isWarm = rand() < 0.55;
    const floorCol = isWarm
      ? (rand() < 0.5 ? '#ffe4b4' : '#ffbe72')
      : (rand() < 0.7 ? '#d6ecff' : '#c8ffe0');

    // Spandrel aluminum floor beam
    dCtx.fillStyle = '#374458';
    dCtx.fillRect(0, y, w, 5);

    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      const paneX = x + 3;
      const paneY = y + 6;
      const paneW = cellW - 6;
      const paneH = cellH - 8;

      // Sky-tinted reflective glass variation
      const gTint = 24 + Math.floor(rand() * 14);
      dCtx.fillStyle = `rgb(${gTint}, ${gTint + 14}, ${gTint + 30})`;
      dCtx.fillRect(paneX, paneY, paneW, paneH);

      const lit = floorLit ? rand() < 0.82 : rand() < 0.06;
      if (lit) {
        const b = 0.36 + rand() * 0.44;
        eCtx.globalAlpha = b;
        eCtx.fillStyle = floorCol;
        eCtx.fillRect(paneX + 1, paneY + 1, paneW - 2, paneH - 2);
      }
    }
  }
  eCtx.globalAlpha = 1.0;

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const emissiveMap = new THREE.CanvasTexture(emisCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = 8;

  return { map, emissiveMap };
}

// 3. Cozy Brazilian Coastal Residential Villa Facade Atlas (São Francisco, Charitas & Jurujuba houses)
export function createResidentialVillaTextures() {
  const w = 256;
  const h = 256;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = w;
  diffCanvas.height = h;
  const dCtx = diffCanvas.getContext('2d');

  const emisCanvas = document.createElement('canvas');
  emisCanvas.width = w;
  emisCanvas.height = h;
  const eCtx = emisCanvas.getContext('2d');

  const rand = createRng(558811);

  // Warm cream/ochre Brazilian plaster walls
  dCtx.fillStyle = '#8b8074';
  dCtx.fillRect(0, 0, w, h);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, w, h);

  // Subtle stucco mottling
  for (let i = 0; i < 400; i++) {
    dCtx.fillStyle = rand() > 0.5 ? 'rgba(255,244,230,0.06)' : 'rgba(30,22,16,0.08)';
    dCtx.fillRect(rand() * w, rand() * h, 6 + rand() * 14, 6 + rand() * 14);
  }

  const cols = 6;
  const rows = 4;
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = c * cw + cw * 0.24;
      const wy = r * ch + ch * 0.24;
      const ww = cw * 0.52;
      const wh = ch * 0.52;

      dCtx.fillStyle = '#242022';
      dCtx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      dCtx.fillStyle = '#181a24';
      dCtx.fillRect(wx, wy, ww, wh);

      if (rand() < 0.34) {
        eCtx.globalAlpha = 0.45 + rand() * 0.45;
        eCtx.fillStyle = rand() < 0.72 ? '#ffb85c' : '#ffe2ad';
        eCtx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      }
    }
  }
  eCtx.globalAlpha = 1.0;

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const emissiveMap = new THREE.CanvasTexture(emisCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = 4;

  return { map, emissiveMap };
}

// 4. Brazilian Clay Barrel Tile Terracotta Roof Texture (Telha Cerâmica)
export function createTerracottaRoofTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = createRng(314159);

  ctx.fillStyle = '#6f3524';
  ctx.fillRect(0, 0, size, size);

  const cols = 16;
  const rows = 14;
  const cw = size / cols;
  const ch = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const shade = Math.round((rand() - 0.5) * 26);
      ctx.fillStyle = `rgb(${112 + shade}, ${54 + Math.round(shade * 0.6)}, ${36 + Math.round(shade * 0.4)})`;
      ctx.fillRect(k * cw, r * ch, cw - 1, ch - 1);
      ctx.fillStyle = 'rgba(22, 10, 6, 0.38)';
      ctx.fillRect(k * cw, r * ch + ch - 2, cw, 2);
      ctx.fillStyle = 'rgba(220, 140, 100, 0.14)';
      ctx.fillRect(k * cw + 1, r * ch, 2, ch);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// 5. Authentic Art Deco Soapstone (Pedra-Sabão) Mosaic Tessellation Texture for Cristo Redentor!
export function createSoapstoneTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const rand = createRng(19311012);

  ctx.fillStyle = '#dfd9cc';
  ctx.fillRect(0, 0, size, size);

  const step = 16;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const v1 = 208 + Math.floor((rand() - 0.5) * 26);
      const v2 = 204 + Math.floor((rand() - 0.5) * 26);
      // Iconic triangular soapstone mosaic tiles covering Cristo Redentor!
      ctx.fillStyle = `rgb(${v1}, ${v1 - 4}, ${v1 - 12})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + step, y);
      ctx.lineTo(x, y + step);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgb(${v2}, ${v2 - 4}, ${v2 - 12})`;
      ctx.beginPath();
      ctx.moveTo(x + step, y);
      ctx.lineTo(x + step, y + step);
      ctx.lineTo(x, y + step);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Subtle vertical Art Deco weathering patina
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(92, 86, 76, ${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * size, 0, 2 + rand() * 8, size);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// Keep legacy aggregate export for clean wiring
export function createCityFacadeTextures() {
  return {
    apartment: createModernistApartmentTextures(),
    glassTower: createGlassTowerTextures(),
    villa: createResidentialVillaTextures(),
    terracottaRoof: createTerracottaRoofTexture(),
    soapstone: createSoapstoneTexture(),
  };
}

// Crisp radial HDR light-glow texture for coastal streetlamps, bridge lamps & navigation beacons
export function createGlowSpriteTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const half = size * 0.5;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.09, 'rgba(255, 238, 198, 0.82)');
  grad.addColorStop(0.26, 'rgba(255, 166, 74, 0.24)');
  grad.addColorStop(0.60, 'rgba(255, 118, 38, 0.045)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Floodlit emerald football pitch texture (iconic foreground micro-landmark in São Francisco!)
export function createFootballPitchTexture() {
  const w = 256;
  const h = 160;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1f8a3d' : '#197533';
    ctx.fillRect((i * w) / 12, 0, w / 12 + 1, h);
  }

  ctx.strokeStyle = 'rgba(235, 255, 238, 0.88)';
  ctx.lineWidth = 2.6;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 10);
  ctx.lineTo(w * 0.5, h - 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(10, h * 0.25, 32, h * 0.5);
  ctx.strokeRect(w - 42, h * 0.25, 32, h * 0.5);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.58);
  glow.addColorStop(0, 'rgba(180, 255, 190, 0.20)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
