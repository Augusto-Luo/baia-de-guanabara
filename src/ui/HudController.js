import * as THREE from 'three';
import { CAMERA_PRESETS, LANDMARK_PINS } from '../config/landmarksData.js';

export class HudController {
  constructor({
    onSelectPreset,
    onSelectMood,
    onWindChange,
    onReflectionCrispnessChange,
    onBloomChange,
    onQualityChange,
  }) {
    this.onSelectPreset = onSelectPreset;
    this.onSelectMood = onSelectMood;
    this.onWindChange = onWindChange;
    this.onReflectionCrispnessChange = onReflectionCrispnessChange;
    this.onBloomChange = onBloomChange;
    this.onQualityChange = onQualityChange;

    this.hudEl = document.getElementById('hud');
    this.viewLabelEl = document.getElementById('current-view-label');
    this.dockEl = document.getElementById('camera-dock');
    this.drawerEl = document.getElementById('settings-drawer');
    this.labelsLayerEl = document.getElementById('landmark-labels');
    this.restoreHudBtn = document.getElementById('btn-restore-hud');
    this.fpsEl = document.getElementById('fps-readout');

    this.btnLabels = document.getElementById('btn-labels');
    this.btnSettings = document.getElementById('btn-settings');
    this.btnCinema = document.getElementById('btn-cinema');

    this.labelsVisible = false;
    this.hudHidden = false;
    this.pinElements = [];
    this._projVec = new THREE.Vector3();

    this._buildCameraDock();
    this._buildLandmarkPins();
    this._bindControls();
  }

  _buildCameraDock() {
    this.dockEl.innerHTML = '';
    this.presetButtons = new Map();
    CAMERA_PRESETS.forEach((p, idx) => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn' + (idx === 0 ? ' active' : '');
      btn.textContent = p.label;
      btn.dataset.preset = p.id;
      btn.addEventListener('click', () => {
        this.setActivePreset(p.id);
        this.onSelectPreset(p);
      });
      this.dockEl.appendChild(btn);
      this.presetButtons.set(p.id, btn);
    });
  }

  _buildLandmarkPins() {
    this.labelsLayerEl.innerHTML = '';
    this.pinElements = LANDMARK_PINS.map((pin) => {
      const el = document.createElement('div');
      el.className = 'landmark-pin';
      el.innerHTML = `
        <div class="landmark-pin-tag">${pin.name}</div>
        <div class="landmark-pin-stem"></div>
        <div class="landmark-pin-dot"></div>
      `;
      el.addEventListener('click', () => {
        const preset = CAMERA_PRESETS.find((c) => c.id === pin.presetId);
        if (preset) {
          this.setActivePreset(preset.id);
          this.onSelectPreset(preset);
        }
      });
      this.labelsLayerEl.appendChild(el);
      return {
        el,
        worldPos: new THREE.Vector3(...pin.position),
      };
    });
  }

  _bindControls() {
    // Toggle 3D Landmark Labels
    this.btnLabels.addEventListener('click', () => this.toggleLabels());

    // Toggle Atmosphere Drawer
    this.btnSettings.addEventListener('click', () => {
      const isCollapsed = this.drawerEl.classList.toggle('collapsed');
      this.btnSettings.classList.toggle('active', !isCollapsed);
    });

    // Cinema Mode (Hide HUD)
    this.btnCinema.addEventListener('click', () => this.setHudHidden(true));
    this.restoreHudBtn.addEventListener('click', () => this.setHudHidden(false));

    // Lighting Mood Buttons
    const moodBtns = document.querySelectorAll('#mood-buttons .mood-btn');
    moodBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        moodBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.onSelectMood(btn.dataset.mood);
      });
    });

    // Quality Buttons
    const qBtns = document.querySelectorAll('#quality-buttons .q-btn');
    qBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        qBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.onQualityChange(btn.dataset.quality);
      });
    });

    // Sliders
    const windSlider = document.getElementById('slider-wind');
    const windVal = document.getElementById('val-wind');
    windSlider.addEventListener('input', () => {
      windVal.textContent = `${windSlider.value}%`;
      this.onWindChange(Number(windSlider.value) / 100);
    });

    const reflSlider = document.getElementById('slider-refl');
    const reflVal = document.getElementById('val-refl');
    reflSlider.addEventListener('input', () => {
      reflVal.textContent = `${reflSlider.value}%`;
      this.onReflectionCrispnessChange(Number(reflSlider.value) / 100);
    });

    const bloomSlider = document.getElementById('slider-bloom');
    const bloomVal = document.getElementById('val-bloom');
    bloomSlider.addEventListener('input', () => {
      bloomVal.textContent = `${bloomSlider.value}%`;
      this.onBloomChange((Number(bloomSlider.value) / 100) * 0.88);
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'h') {
        this.setHudHidden(!this.hudHidden);
      } else if (k === 'l') {
        this.toggleLabels();
      } else if (k >= '1' && k <= '9') {
        const idx = Number(k) - 1;
        if (CAMERA_PRESETS[idx]) {
          this.setActivePreset(CAMERA_PRESETS[idx].id);
          this.onSelectPreset(CAMERA_PRESETS[idx]);
        }
      }
    });
  }

  setActivePreset(id) {
    for (const [key, btn] of this.presetButtons.entries()) {
      btn.classList.toggle('active', key === id);
    }
    const preset = CAMERA_PRESETS.find((p) => p.id === id);
    if (preset) {
      this.viewLabelEl.textContent = preset.subtitle;
    }
  }

  setActiveMood(moodKey) {
    const moodBtns = document.querySelectorAll('#mood-buttons .mood-btn');
    moodBtns.forEach((b) => b.classList.toggle('active', b.dataset.mood === moodKey));
  }

  toggleLabels(forceState) {
    this.labelsVisible = forceState !== undefined ? forceState : !this.labelsVisible;
    this.labelsLayerEl.classList.toggle('hidden', !this.labelsVisible);
    this.btnLabels.classList.toggle('active', this.labelsVisible);
  }

  setHudHidden(hidden) {
    this.hudHidden = hidden;
    this.hudEl.classList.toggle('hidden-hud', hidden);
    this.restoreHudBtn.classList.toggle('hidden', !hidden);
    if (hidden) {
      this.labelsLayerEl.classList.add('hidden');
    } else if (this.labelsVisible) {
      this.labelsLayerEl.classList.remove('hidden');
    }
  }

  updateLandmarkPins(camera, width, height) {
    if (!this.labelsVisible || this.hudHidden) return;
    const placed = [];
    for (const pin of this.pinElements) {
      this._projVec.copy(pin.worldPos).project(camera);
      const inFront = this._projVec.z < 1.0 && this._projVec.z > -1.0;
      const sx = (this._projVec.x * 0.5 + 0.5) * width;
      let sy = (-this._projVec.y * 0.5 + 0.5) * height;
      const inBounds = sx > -60 && sx < width + 60 && sy > 20 && sy < height - 20;

      if (inFront && inBounds) {
        // Simple screen-space de-overlap so clustered mountain pins never collide!
        for (let pass = 0; pass < 3; pass++) {
          for (const prev of placed) {
            if (Math.abs(sx - prev.x) < 126 && Math.abs(sy - prev.y) < 34) {
              sy = prev.y - 36;
            }
          }
        }
        placed.push({ x: sx, y: sy });
        pin.el.style.opacity = '1';
        pin.el.style.left = `${sx.toFixed(1)}px`;
        pin.el.style.top = `${sy.toFixed(1)}px`;
      } else {
        pin.el.style.opacity = '0';
      }
    }
  }

  updateFps(fps) {
    this.fpsEl.textContent = `${Math.round(fps)} FPS`;
  }
}
