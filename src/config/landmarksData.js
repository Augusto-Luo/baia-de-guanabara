// Camera presets and 3D landmark metadata for Baía de Guanabara

export const CAMERA_PRESETS = [
  {
    id: 'parque',
    label: 'Parque da Cidade',
    subtitle: 'Parque da Cidade · Classic Twilight Panorama',
    position: [0, 42.5, 224],
    target: [-6, 1.2, -52],
    fov: 53,
  },
  {
    id: 'sugarloaf',
    label: 'Pão de Açúcar',
    subtitle: 'Pão de Açúcar, Morro da Urca & Bondinho Cable Car',
    position: [-168, 28, -124],
    target: [-258, 25, -184],
    fov: 42,
  },
  {
    id: 'cristo',
    label: 'Cristo Redentor',
    subtitle: 'Corcovado & Cristo Redentor Overlooking Guanabara',
    position: [-222, 74.5, -288],
    target: [-262, 71.0, -328],
    fov: 35,
  },
  {
    id: 'mac',
    label: 'MAC Niterói',
    subtitle: 'Museu de Arte Contemporânea (Oscar Niemeyer) & Ilha da Boa Viagem',
    position: [64, 15.5, -4],
    target: [104, 8.8, -35],
    fov: 40,
  },
  {
    id: 'bridge',
    label: 'Ponte Rio-Niterói',
    subtitle: 'Ponte Presidente Costa e Silva · Vão Central Reflections',
    position: [148, 16.5, -188],
    target: [176, 5.5, -332],
    fov: 44,
  },
  {
    id: 'beach',
    label: 'São Francisco',
    subtitle: 'Praia de São Francisco, Charitas Ferry Pier & Bay Reflections',
    position: [48, 10.5, 118],
    target: [-68, 4.5, 26],
    fov: 48,
  },
  {
    id: 'forest',
    label: 'Mata Atlântica',
    subtitle: 'Atlantic Rainforest Canopy, Cecropia, Palms & Giant Ferns',
    position: [-52, 36.5, 194],
    target: [-88, 17.5, 128],
    fov: 46,
  },
];

// 3D world-space anchor points for toggleable landmark pins
export const LANDMARK_PINS = [
  {
    id: 'pin-sugarloaf',
    presetId: 'sugarloaf',
    name: 'Pão de Açúcar',
    position: [-252, 56.5, -188],
  },
  {
    id: 'pin-cristo',
    presetId: 'cristo',
    name: 'Cristo Redentor',
    position: [-262, 80.0, -328],
  },
  {
    id: 'pin-gavea',
    presetId: 'parque',
    name: 'Pedra da Gávea',
    position: [-408, 63, -338],
  },
  {
    id: 'pin-dois-irmaos',
    presetId: 'parque',
    name: 'Morro Dois Irmãos',
    position: [-346, 54, -304],
  },
  {
    id: 'pin-morcego',
    presetId: 'beach',
    name: 'Morro do Morcego · Fortaleza',
    position: [-90, 31.5, -14],
  },
  {
    id: 'pin-ilha-fiscal',
    presetId: 'bridge',
    name: 'Ilha Fiscal',
    position: [-34, 8.5, -278],
  },
  {
    id: 'pin-mac',
    presetId: 'mac',
    name: 'MAC Niterói',
    position: [105, 16.0, -34],
  },
  {
    id: 'pin-bridge',
    presetId: 'bridge',
    name: 'Ponte Rio-Niterói',
    position: [178, 16.5, -330],
  },
  {
    id: 'pin-charitas',
    presetId: 'beach',
    name: 'Estação Charitas',
    position: [-84, 5.2, 110],
  },
  {
    id: 'pin-sao-francisco',
    presetId: 'beach',
    name: 'Praia de São Francisco',
    position: [10, 4.5, 138],
  },
];
