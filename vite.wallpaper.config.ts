import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'fs';

const enhancedPropertyHandlers = `    // Enhanced audio controls
    if (properties.rhythmSyncEnabled?.value !== undefined) {
      engine.rhythmSyncEnabled = properties.rhythmSyncEnabled.value as boolean;
    }
    if (properties.beatTriggerStrength?.value !== undefined) {
      engine.beatTriggerStrength = Math.max(0, Number(properties.beatTriggerStrength.value));
    }
    if (properties.visualAttackMs?.value !== undefined) {
      engine.visualAttack = Math.max(0.005, Number(properties.visualAttackMs.value) / 1000);
    }
    if (properties.visualReleaseMs?.value !== undefined) {
      engine.visualRelease = Math.max(0.01, Number(properties.visualReleaseMs.value) / 1000);
    }
    if (properties.spectralMemoryEnabled?.value !== undefined) {
      engine.spectralMemoryEnabled = properties.spectralMemoryEnabled.value as boolean;
    }
    if (properties.spectralMemoryStrength?.value !== undefined) {
      engine.spectralMemoryStrength = Math.max(0, Math.min(1.5, Number(properties.spectralMemoryStrength.value)));
    }
    if (properties.stereoSpatialEnabled?.value !== undefined) {
      engine.stereoSpatialEnabled = properties.stereoSpatialEnabled.value as boolean;
    }
    if (properties.stereoSpatialStrength?.value !== undefined) {
      engine.stereoSpatialStrength = Math.max(0, Math.min(1.5, Number(properties.stereoSpatialStrength.value)));
    }
    if (properties.terrainCoherenceEnabled?.value !== undefined) {
      engine.terrainCoherenceEnabled = properties.terrainCoherenceEnabled.value as boolean;
    }
    if (properties.terrainCoherenceStrength?.value !== undefined) {
      engine.terrainCoherenceStrength = Math.max(0, Math.min(1.5, Number(properties.terrainCoherenceStrength.value)));
    }
    if (properties.topAccentEnabled?.value !== undefined) {
      engine.topAccentEnabled = properties.topAccentEnabled.value as boolean;
    }
    if (properties.topAccentTrigger?.value !== undefined) {
      engine.topAccentTrigger = String(properties.topAccentTrigger.value);
    }
    if (properties.topAccentColorMode?.value !== undefined) {
      engine.topAccentColorMode = String(properties.topAccentColorMode.value);
    }
    if (properties.topAccentCustomColor?.value !== undefined) {
      engine.topAccentCustomColor = String(properties.topAccentCustomColor.value);
    }
    if (properties.topAccentDensity?.value !== undefined) {
      engine.topAccentDensity = Math.max(0.005, Math.min(0.25, Number(properties.topAccentDensity.value)));
    }
    if (properties.topAccentIntensity?.value !== undefined) {
      engine.topAccentIntensity = Math.max(0, Math.min(1.5, Number(properties.topAccentIntensity.value)));
    }
`;

const chineseRegex = /[\u3400-\u9fff]/;

function englishOnly(value: unknown) {
  if (typeof value !== 'string' || !chineseRegex.test(value)) return value;

  const trimmed = value.trim();
  const isHeading = trimmed.startsWith('===') && trimmed.endsWith('===');

  if (value.includes(' / ')) {
    let english = value.split(' / ').at(-1)?.trim() ?? value;
    if (isHeading) {
      english = english.replace(/^=+/, '').replace(/=+$/, '').trim();
      return `=== ${english} ===`;
    }
    return english;
  }

  return value
    .replace(/[\u3400-\u9fff]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildEnhancedProject() {
  const sourcePath = path.resolve(__dirname, 'wallpaper/project.json');
  const project = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const properties = project?.general?.properties;

  if (!properties) {
    throw new Error('wallpaper/project.json has no general.properties object.');
  }

  Object.assign(properties, {
    sep_enhanced_audio: {
      order: 348,
      text: ' ',
      type: 'text',
      value: '',
    },
    sep_enhanced_audio_title: {
      order: 349,
      text: '=== Enhanced Audio v2 ===',
      type: 'text',
      value: '',
    },
    rhythmSyncEnabled: {
      index: 0,
      order: 350,
      text: 'Rhythm Sync',
      type: 'bool',
      value: true,
    },
    beatTriggerStrength: {
      index: 1,
      order: 351,
      text: 'Beat Trigger Strength',
      type: 'slider',
      value: 1.0,
      min: 0.25,
      max: 2.0,
      step: 0.05,
    },

    sep_top_accent: {
      order: 352,
      text: ' ',
      type: 'text',
      value: '',
    },
    sep_top_accent_title: {
      order: 353,
      text: '--- Music Top Accents ---',
      type: 'text',
      value: '',
    },
    topAccentEnabled: {
      index: 2,
      order: 354,
      text: 'Music Top Accents',
      type: 'bool',
      value: true,
    },
    topAccentTrigger: {
      index: 3,
      order: 355,
      text: 'Accent Trigger',
      type: 'combo',
      value: 'percussion',
      options: [
        { label: 'Percussion / Transients', value: 'percussion' },
        { label: 'Beat', value: 'beat' },
        { label: 'Bass', value: 'bass' },
        { label: 'Drop', value: 'drop' },
        { label: 'Vocal-like (heuristic)', value: 'vocal' },
        { label: 'High Frequencies', value: 'highs' },
        { label: 'Overall Energy', value: 'energy' },
      ],
    },
    topAccentColorMode: {
      index: 4,
      order: 356,
      text: 'Accent Color Source',
      type: 'combo',
      value: 'theme',
      options: [
        { label: 'Theme Top-end Hue', value: 'theme' },
        { label: 'Theme Peak Color', value: 'peak' },
        { label: 'Random Color per Event', value: 'random' },
        { label: 'Custom Color', value: 'custom' },
      ],
    },
    topAccentCustomColor: {
      index: 5,
      order: 357,
      text: 'Custom Accent Color',
      type: 'color',
      value: '0.15 0.85 1.0',
    },
    topAccentDensity: {
      index: 6,
      order: 358,
      text: 'Accent Panel Density',
      type: 'slider',
      value: 0.055,
      min: 0.01,
      max: 0.2,
      step: 0.005,
    },
    topAccentIntensity: {
      index: 7,
      order: 359,
      text: 'Top Accent Intensity',
      type: 'slider',
      value: 0.8,
      min: 0,
      max: 1.5,
      step: 0.05,
    },

    visualAttackMs: {
      index: 8,
      order: 360,
      text: 'Visual Attack (ms)',
      type: 'slider',
      value: 45,
      min: 10,
      max: 150,
      step: 5,
    },
    visualReleaseMs: {
      index: 9,
      order: 361,
      text: 'Visual Release (ms)',
      type: 'slider',
      value: 160,
      min: 50,
      max: 500,
      step: 10,
    },
    spectralMemoryEnabled: {
      index: 10,
      order: 362,
      text: 'Spectral Memory',
      type: 'bool',
      value: true,
    },
    spectralMemoryStrength: {
      index: 11,
      order: 363,
      text: 'Spectral Memory Strength',
      type: 'slider',
      value: 0.45,
      min: 0,
      max: 1.5,
      step: 0.05,
    },
    stereoSpatialEnabled: {
      index: 12,
      order: 364,
      text: 'Stereo Spatialization',
      type: 'bool',
      value: true,
    },
    stereoSpatialStrength: {
      index: 13,
      order: 365,
      text: 'Stereo Spatial Strength',
      type: 'slider',
      value: 0.55,
      min: 0,
      max: 1.5,
      step: 0.05,
    },
    terrainCoherenceEnabled: {
      index: 14,
      order: 366,
      text: 'Music-driven Terrain Coherence',
      type: 'bool',
      value: true,
    },
    terrainCoherenceStrength: {
      index: 15,
      order: 367,
      text: 'Terrain Coherence Strength',
      type: 'slider',
      value: 0.65,
      min: 0,
      max: 1.5,
      step: 0.05,
    },
  });

  // Remove the old white sparkle control from generated builds. The new
  // top-surface accent system replaces it completely.
  delete properties.sparkleIntensity;

  for (const property of Object.values(properties) as any[]) {
    if (!property || typeof property !== 'object') continue;

    if (typeof property.text === 'string') {
      property.text = englishOnly(property.text);
    }

    if (Array.isArray(property.options)) {
      for (const option of property.options) {
        if (option && typeof option.label === 'string') {
          option.label = englishOnly(option.label);
        }
      }
    }
  }

  project.name = 'Sonic Topography Enhanced v2';
  project.title = 'Sonic Topography Enhanced v2';
  project.description =
    'Enhanced 3D audio-reactive topography with rhythm analysis, spectral memory, stereo spatialization, terrain coherence and music-selectable top-surface accents.';
  project.version = 2;
  delete project.workshopid;
  delete project.workshopurl;

  return project;
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'enhanced-audio-property-handlers',
      enforce: 'pre',
      transform(code, id) {
        const normalizedId = id.replace(/\\/g, '/').split('?')[0];
        if (!normalizedId.endsWith('/wallpaper/main.tsx')) return null;
        if (code.includes('properties.rhythmSyncEnabled?.value')) return null;

        const anchor = /(    if \(properties\.themeCycleInterval\?\.value !== undefined\) \{\r?\n      setThemeCycleInterval\(properties\.themeCycleInterval\.value as number\);\r?\n    \}\r?\n)/;
        if (!anchor.test(code)) {
          throw new Error('Could not locate the Wallpaper Engine property-handler insertion point.');
        }

        return {
          code: code.replace(anchor, `$1${enhancedPropertyHandlers}`),
          map: null,
        };
      },
    },
    {
      name: 'enhanced-continuous-terrain-dynamics',
      enforce: 'pre',
      transform(code, id) {
        const normalizedId = id.replace(/\\/g, '/').split('?')[0];

        if (normalizedId.endsWith('/src/lib/AudioEngine.ts')) {
          if (code.includes('public spectralMemoryEnabled = true;')) return null;

          let next = code;

          // Disable the original additive sparkle paths. The new accent system
          // changes top-face color instead of adding white light/noise.
          next = next.replace(
            '  public sparkleIntensity = 0.12;',
            '  public sparkleIntensity = 0.0;',
          );

          const tuningAnchor = /(  public visualAttack = 0\.045;\r?\n  public visualRelease = 0\.16;\r?\n)/;
          if (!tuningAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine tuning insertion point.');
          }
          next = next.replace(
            tuningAnchor,
            `$1
  // Slow, continuous visual dynamics. These intentionally avoid beat-rate flashing.
  public spectralMemoryEnabled = true;
  public spectralMemoryStrength = 0.45;
  public stereoSpatialEnabled = true;
  public stereoSpatialStrength = 0.55;
  public terrainCoherenceEnabled = true;
  public terrainCoherenceStrength = 0.65;

  // Music-selectable top-surface accents. "vocal" is a spectral heuristic,
  // not semantic source separation, because Wallpaper Engine exposes FFT magnitudes.
  public topAccentEnabled = true;
  public topAccentTrigger = 'percussion';
  public topAccentColorMode = 'theme';
  public topAccentCustomColor = '0.15 0.85 1.0';
  public topAccentDensity = 0.055;
  public topAccentIntensity = 0.8;
`,
          );

          const spectrumAnchor = /(  private readonly prevSpectrum = new Float32Array\(64\);\r?\n)/;
          if (!spectrumAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine spectrum state insertion point.');
          }
          next = next.replace(
            spectrumAnchor,
            `$1
  // Six smooth spectral-memory layers (low/mid/high). Inner terrain uses the
  // fast layers; outer terrain uses progressively slower layers up to ~3.2 s.
  private readonly spectralMemory = new Float32Array(18);
`,
          );

          const targetAnchor = /(    this\.targetData = \{[\s\S]*?      spectralCentroid,\r?\n    \};\r?\n)/;
          if (!targetAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine targetData block for spectral memory.');
          }
          const memoryUpdate = `
    // Multi-timescale spectral memory: no discrete history shifts, therefore no
    // temporal stepping. The outer visual layers simply remember audio longer.
    if (this.spectralMemoryEnabled) {
      const memoryTargets = [
        clamp01((subBass + bass) * 0.5),
        clamp01((lowMid + mid + highMid) / 3),
        clamp01((presence + brilliance + air) / 3),
      ];
      const memoryTaus = [0.18, 0.38, 0.72, 1.2, 2.0, 3.2];
      for (let layer = 0; layer < 6; layer++) {
        const alpha = emaAlpha(dt, memoryTaus[layer]);
        for (let band = 0; band < 3; band++) {
          const idx = layer * 3 + band;
          this.spectralMemory[idx] +=
            (memoryTargets[band] - this.spectralMemory[idx]) * alpha;
        }
      }
    }
`;
          next = next.replace(targetAnchor, `$1${memoryUpdate}`);

          const idleAnchor = /(  public getIdleWaveIntensity\(deltaTime: number = 0\.016\): number \{)/;
          if (!idleAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine public getter insertion point.');
          }
          const getters = `  public getSpectralMemory(): Float32Array {
    return this.spectralMemory;
  }

`;
          next = next.replace(idleAnchor, `${getters}$1`);

          if (
            !next.includes('public spectralMemoryEnabled = true;') ||
            !next.includes('public topAccentTrigger') ||
            !next.includes('private readonly spectralMemory') ||
            !next.includes('getSpectralMemory()')
          ) {
            throw new Error('Enhanced AudioEngine terrain transform did not apply completely.');
          }

          return { code: next, map: null };
        }

        if (normalizedId.endsWith('/src/components/AudioVisualizer/CustomShaderMaterial.ts')) {
          if (code.includes('uSpectralMemoryStrength: 0')) return null;

          let next = code;

          const defaultsAnchor = /(    uHalfExtent: 84,\r?\n)/;
          if (!defaultsAnchor.test(next)) {
            throw new Error('Could not locate shader uniform-default insertion point.');
          }
          next = next.replace(
            defaultsAnchor,
            `$1    uStereoPan: 0,
    uStereoWidth: 0,
    uStereoSpatialStrength: 0,
    uTerrainCoherenceStrength: 0,
    uSpectralMemoryStrength: 0,
    uMemory0: new THREE.Vector3(),
    uMemory1: new THREE.Vector3(),
    uMemory2: new THREE.Vector3(),
    uMemory3: new THREE.Vector3(),
    uMemory4: new THREE.Vector3(),
    uMemory5: new THREE.Vector3(),
    uTopAccentLevel: 0,
    uTopAccentDensity: 0.055,
    uTopAccentIntensity: 0.8,
    uTopAccentColorMode: 0,
    uTopAccentRandomColor: new THREE.Color(0.2, 0.8, 1.0),
    uTopAccentCustomColor: new THREE.Color(0.15, 0.85, 1.0),
`,
          );

          const declarationsAnchor = /(    uniform float uHalfExtent;\r?\n)/;
          if (!declarationsAnchor.test(next)) {
            throw new Error('Could not locate shader uniform declaration insertion point.');
          }
          next = next.replace(
            declarationsAnchor,
            `$1    uniform float uStereoPan;
    uniform float uStereoWidth;
    uniform float uStereoSpatialStrength;
    uniform float uTerrainCoherenceStrength;
    uniform float uSpectralMemoryStrength;
    uniform vec3 uMemory0;
    uniform vec3 uMemory1;
    uniform vec3 uMemory2;
    uniform vec3 uMemory3;
    uniform vec3 uMemory4;
    uniform vec3 uMemory5;
`,
          );

          const randomAnchor = /(      float rnd = random\(pos2D\);\r?\n)/;
          if (!randomAnchor.test(next)) {
            throw new Error('Could not locate shader spatial-dynamics insertion point.');
          }
          const spatialSetup = `
      // Overall pan smoothly biases mid/high terrain left or right. Stereo width
      // increases the spatial reach without moving the sub-bass core away from center.
      float stereoX = clamp(pos2D.x / max(uHalfExtent, 0.001), -1.0, 1.0);
      float stereoSpatial = 1.0 +
        stereoX * uStereoPan * uStereoSpatialStrength * (0.35 + uStereoWidth * 0.35);
      float coherence = clamp(
        (uSmoothness * 0.72 + (1.0 - uDensity) * 0.28) * uTerrainCoherenceStrength,
        0.0,
        1.0
      );
`;
          next = next.replace(randomAnchor, `$1${spatialSetup}`);

          const combineAnchor = /(      \/\/ Combine and apply intensity multiplier\r?\n      float audioElevation = \(subLift \+ bassLift \+ lowMidLift \+ midLift \+ highMidLift\) \* uAudioIntensity;\r?\n)/;
          if (!combineAnchor.test(next)) {
            throw new Error('Could not locate shader audio-elevation block.');
          }
          const continuousTerrain = `
      // Stereo is intentionally strongest in the mid/high structures.
      lowMidLift *= mix(1.0, stereoSpatial, 0.35);
      midLift *= mix(1.0, stereoSpatial, 0.65);
      highMidLift *= mix(1.0, stereoSpatial, 0.90);

      // Coherent music produces broad geological forms; dense/rough music keeps
      // more of the fragmented original topology. All transitions are continuous.
      float coherenceField = (snoise(
        pos2D * mix(0.085, 0.032, coherence) +
        vec2(uTime * mix(0.10, 0.025, coherence), 0.0)
      ) + 1.0) * 0.5;
      float coherentBass = easeLift(uBass, 5.0) * bassRegion *
        (0.68 + coherenceField * 0.32);
      bassLift = mix(bassLift, coherentBass, coherence * 0.72);
      midLift = mix(
        midLift,
        flowLift(uMid, 4.0) * (0.35 + coherenceField * 0.65) *
          mix(1.0, stereoSpatial, 0.55),
        coherence * 0.42
      );
      highMidLift *= mix(1.0, 0.58, coherence);

      // Recompose after the stereo/coherence shaping above.
      audioElevation = (subLift + bassLift + lowMidLift + midLift + highMidLift) *
        uAudioIntensity;

      // Six smooth temporal memory layers are mapped from center (recent) to
      // perimeter (long memory). This leaves slowly fading spectral contours.
      float memoryCoord = clamp(
        centerDist / max(uHalfExtent * 0.72 * range, 0.001),
        0.0,
        0.999
      ) * 5.0;
      vec3 memoryBands;
      if (memoryCoord < 1.0) memoryBands = mix(uMemory0, uMemory1, memoryCoord);
      else if (memoryCoord < 2.0) memoryBands = mix(uMemory1, uMemory2, memoryCoord - 1.0);
      else if (memoryCoord < 3.0) memoryBands = mix(uMemory2, uMemory3, memoryCoord - 2.0);
      else if (memoryCoord < 4.0) memoryBands = mix(uMemory3, uMemory4, memoryCoord - 3.0);
      else memoryBands = mix(uMemory4, uMemory5, memoryCoord - 4.0);

      float radialNorm = clamp(centerDist / max(uHalfExtent * 0.72 * range, 0.001), 0.0, 1.0);
      float memoryLowWeight = 1.0 - smoothstep(0.18, 0.62, radialNorm);
      float memoryHighWeight = smoothstep(0.42, 0.92, radialNorm);
      float memoryMidWeight = clamp(1.0 - abs(radialNorm - 0.5) * 2.0, 0.0, 1.0);
      float memoryWeightSum = max(0.001, memoryLowWeight + memoryMidWeight + memoryHighWeight);
      float memoryValue = (
        memoryBands.x * memoryLowWeight +
        memoryBands.y * memoryMidWeight +
        memoryBands.z * memoryHighWeight
      ) / memoryWeightSum;
      float memoryTexture = 0.72 +
        ((snoise(pos2D * 0.045 + vec2(uTime * 0.018, 0.0)) + 1.0) * 0.5) * 0.28;
      audioElevation += memoryValue * memoryTexture * uSpectralMemoryStrength * 1.35;
`;
          next = next.replace(combineAnchor, `$1${continuousTerrain}`);

          const heightAnchor = /(      float totalHeight = 1\.0 \+ elevation;\r?\n)/;
          if (!heightAnchor.test(next)) {
            throw new Error('Could not locate shader total-height safety clamp.');
          }
          next = next.replace(
            heightAnchor,
            `      float totalHeight = max(0.12, 1.0 + elevation);\n`,
          );

          // Fragment-only uniforms for top-surface music accents.
          const fragmentUniformAnchor = /(    uniform float uPeakIntensity;[^\n]*\r?\n)/;
          if (!fragmentUniformAnchor.test(next)) {
            throw new Error('Could not locate fragment uniform insertion point for top accents.');
          }
          next = next.replace(
            fragmentUniformAnchor,
            `$1    uniform float uTopAccentLevel;\n    uniform float uTopAccentDensity;\n    uniform float uTopAccentIntensity;\n    uniform float uTopAccentColorMode;\n    uniform vec3 uTopAccentRandomColor;\n    uniform vec3 uTopAccentCustomColor;\n`,
          );

          const topColorAnchor = /(         finalColor = mix\(cBase2, currentGlow, topIntensity\);\r?\n)/;
          if (!topColorAnchor.test(next)) {
            throw new Error('Could not locate top-face color insertion point for music accents.');
          }
          const topAccentShader = `
         // Replace the old white sparkle with a colored top-face accent. A stable
         // per-pillar mask chooses panels; the music envelope only changes color
         // strength, so geometry and brightness do not hard-toggle at audio rate.
         float accentMask = step(
           1.0 - clamp(uTopAccentDensity, 0.0, 0.25),
           fract(rnd * 31.731 + 0.173)
         );
         float accentEnvelope = smoothstep(0.02, 0.65, uTopAccentLevel);
         float accentAmount = accentMask * accentEnvelope *
           clamp(uTopAccentIntensity, 0.0, 1.5);

         vec3 themeTopColor = mix(
           mix(uCoolCore, uCoolEdge, 0.18),
           mix(uWarmCore, uWarmEdge, 0.18),
           clamp(uWarmth * 1.15 + 0.12, 0.0, 1.0)
         );
         themeTopColor = mix(themeTopColor, vec3(1.0), 0.08);

         vec3 accentColor = themeTopColor;
         if (uTopAccentColorMode > 0.5 && uTopAccentColorMode < 1.5) {
           accentColor = uPeakColor;
         } else if (uTopAccentColorMode >= 1.5 && uTopAccentColorMode < 2.5) {
           accentColor = uTopAccentRandomColor;
         } else if (uTopAccentColorMode >= 2.5) {
           accentColor = uTopAccentCustomColor;
         }

         finalColor = mix(finalColor, accentColor, clamp(accentAmount, 0.0, 1.0));
`;
          next = next.replace(topColorAnchor, `$1${topAccentShader}`);

          if (
            !next.includes('uSpectralMemoryStrength: 0') ||
            !next.includes('uTopAccentLevel: 0') ||
            !next.includes('memoryCoord') ||
            !next.includes('themeTopColor')
          ) {
            throw new Error('Enhanced shader terrain/accent transform did not apply completely.');
          }

          return { code: next, map: null };
        }

        if (normalizedId.endsWith('/src/components/AudioVisualizer/MapScene.tsx')) {
          if (code.includes('mat.uSpectralMemoryStrength =')) return null;

          let next = code;

          const colorRefsAnchor = /(  const _whiteColor = useMemo\(\(\) => new THREE\.Color\(0xffffff\), \[\]\);\r?\n)/;
          if (!colorRefsAnchor.test(next)) {
            throw new Error('Could not locate MapScene color-ref insertion point.');
          }
          next = next.replace(
            colorRefsAnchor,
            `$1
  // Smooth top-accent state. Random colors interpolate rather than snapping.
  const topAccentEnvelopeRef = useRef(0);
  const topAccentPrevRawRef = useRef(0);
  const topAccentRandomColorRef = useRef(new THREE.Color().setHSL(Math.random(), 0.78, 0.58));
  const topAccentRandomTargetRef = useRef(topAccentRandomColorRef.current.clone());
  const topAccentCustomColorRef = useRef({
    raw: '',
    color: new THREE.Color(0.15, 0.85, 1.0),
  });
`,
          );

          const dataAnchor = /(    const data = buf\.audioData \|\| engine\.getAudioData\(0\.016\);\r?\n)/;
          if (!dataAnchor.test(next)) {
            throw new Error('Could not locate MapScene audio-data insertion point.');
          }
          next = next.replace(
            dataAnchor,
            `$1    const music = engine.getMusicState();\n    const spectralMemory = engine.getSpectralMemory();\n`,
          );

          next = next.replace(
            '  useFrame((state) => {',
            '  useFrame((state, delta) => {',
          );

          const themeAnchor = /(    const t = getThemeColors\(\);\r?\n)/;
          if (!themeAnchor.test(next)) {
            throw new Error('Could not locate MapScene top-accent envelope insertion point.');
          }
          const accentLogic = `
    // Select a musical feature, then smooth it into a color envelope. Fast
    // transients therefore become a brief colored hold instead of a white strobe.
    let topAccentRaw = 0;
    switch (engine.topAccentTrigger) {
      case 'drop':
        topAccentRaw = music.drop;
        break;
      case 'vocal': {
        // Vocal-like heuristic only: favor sustained mid/high-mid harmonic energy,
        // suppress strong bass and very sharp high-frequency transients.
        const vocalBody =
          data.mid * 0.55 +
          data.highMid * 0.75 +
          data.brightness * 0.30;
        const nonVocalPenalty =
          data.subBass * 0.28 +
          data.bass * 0.20 +
          music.highOnset * 0.22;
        topAccentRaw = Math.max(0, Math.min(1, vocalBody - nonVocalPenalty));
        break;
      }
      case 'bass':
        topAccentRaw = Math.min(1, data.subBass * 0.78 + data.bass * 0.62);
        break;
      case 'beat':
        topAccentRaw =
          engine.rhythmSyncEnabled && music.tempoConfidence >= 0.20
            ? music.beatPulse
            : music.lowOnset;
        break;
      case 'highs':
        topAccentRaw = Math.min(
          1,
          data.brightness * 0.62 + music.highOnset * 0.72,
        );
        break;
      case 'energy':
        topAccentRaw = Math.min(
          1,
          data.energy * 1.7 + Math.max(0, music.shortEnergy - music.longEnergy) * 2.5,
        );
        break;
      case 'percussion':
      default:
        topAccentRaw = Math.min(
          1,
          Math.max(music.midOnset * 1.05, music.highOnset * 1.15),
        );
        break;
    }

    if (!engine.topAccentEnabled) topAccentRaw = 0;

    const accentDt = Math.max(0.00025, Math.min(0.1, delta || 0.016));
    const accentCurrent = topAccentEnvelopeRef.current;
    const accentAttack = 0.055;
    const accentRelease =
      engine.topAccentTrigger === 'drop' ? 0.65 :
      engine.topAccentTrigger === 'vocal' ? 0.42 :
      engine.topAccentTrigger === 'bass' ? 0.28 :
      0.32;
    const accentTau = topAccentRaw > accentCurrent ? accentAttack : accentRelease;
    const accentAlpha = 1 - Math.exp(-accentDt / accentTau);
    topAccentEnvelopeRef.current +=
      (topAccentRaw - topAccentEnvelopeRef.current) * accentAlpha;

    // Random mode chooses a fresh hue on each distinct event, but the visible
    // color itself eases toward that hue over ~140 ms.
    const randomEventThreshold = 0.20;
    if (
      topAccentRaw >= randomEventThreshold &&
      topAccentPrevRawRef.current < randomEventThreshold
    ) {
      topAccentRandomTargetRef.current.setHSL(Math.random(), 0.82, 0.58);
    }
    topAccentPrevRawRef.current = topAccentRaw;
    const randomColorAlpha = 1 - Math.exp(-accentDt / 0.14);
    topAccentRandomColorRef.current.lerp(
      topAccentRandomTargetRef.current,
      randomColorAlpha,
    );

    const customRaw = engine.topAccentCustomColor;
    if (customRaw !== topAccentCustomColorRef.current.raw) {
      const parts = customRaw.trim().split(/\s+/).map(Number);
      if (
        parts.length >= 3 &&
        parts.slice(0, 3).every((value) => Number.isFinite(value))
      ) {
        topAccentCustomColorRef.current.color.setRGB(
          Math.max(0, Math.min(1, parts[0])),
          Math.max(0, Math.min(1, parts[1])),
          Math.max(0, Math.min(1, parts[2])),
        );
      }
      topAccentCustomColorRef.current.raw = customRaw;
    }
`;
          next = next.replace(themeAnchor, `$1${accentLogic}`);

          const uniformAnchor = /(    mat\.uHalfExtent = halfExtent;\r?\n)/;
          if (!uniformAnchor.test(next)) {
            throw new Error('Could not locate MapScene terrain uniform insertion point.');
          }
          const visualUniforms = `    mat.uStereoPan = engine.stereoSpatialEnabled ? music.stereoPan : 0.0;
    mat.uStereoWidth = engine.stereoSpatialEnabled ? music.stereoWidth : 0.0;
    mat.uStereoSpatialStrength = engine.stereoSpatialEnabled
      ? engine.stereoSpatialStrength
      : 0.0;
    mat.uTerrainCoherenceStrength = engine.terrainCoherenceEnabled
      ? engine.terrainCoherenceStrength
      : 0.0;
    mat.uSpectralMemoryStrength = engine.spectralMemoryEnabled
      ? engine.spectralMemoryStrength
      : 0.0;
    mat.uMemory0.set(spectralMemory[0], spectralMemory[1], spectralMemory[2]);
    mat.uMemory1.set(spectralMemory[3], spectralMemory[4], spectralMemory[5]);
    mat.uMemory2.set(spectralMemory[6], spectralMemory[7], spectralMemory[8]);
    mat.uMemory3.set(spectralMemory[9], spectralMemory[10], spectralMemory[11]);
    mat.uMemory4.set(spectralMemory[12], spectralMemory[13], spectralMemory[14]);
    mat.uMemory5.set(spectralMemory[15], spectralMemory[16], spectralMemory[17]);

    mat.uTopAccentLevel = topAccentEnvelopeRef.current;
    mat.uTopAccentDensity = engine.topAccentDensity;
    mat.uTopAccentIntensity = engine.topAccentIntensity;
    mat.uTopAccentColorMode =
      engine.topAccentColorMode === 'peak' ? 1 :
      engine.topAccentColorMode === 'random' ? 2 :
      engine.topAccentColorMode === 'custom' ? 3 : 0;
    mat.uTopAccentRandomColor.copy(topAccentRandomColorRef.current);
    mat.uTopAccentCustomColor.copy(topAccentCustomColorRef.current.color);
`;
          next = next.replace(uniformAnchor, `$1${visualUniforms}`);

          if (
            !next.includes('const spectralMemory = engine.getSpectralMemory();') ||
            !next.includes('topAccentEnvelopeRef') ||
            !next.includes("case 'vocal'") ||
            !next.includes('mat.uTopAccentLevel =')
          ) {
            throw new Error('Enhanced MapScene terrain/accent transform did not apply completely.');
          }

          return { code: next, map: null };
        }

        return null;
      },
    },
    {
      name: 'clean-dist-wallpaper',
      buildStart() {
        const distDir = path.resolve(__dirname, 'dist-wallpaper');
        if (existsSync(distDir)) {
          rmSync(distDir, { recursive: true, force: true });
        }
      },
    },
    {
      name: 'write-wallpaper-assets',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist-wallpaper');
        const project = buildEnhancedProject();
        writeFileSync(
          path.join(distDir, 'project.json'),
          `${JSON.stringify(project, null, '\t')}\n`,
          'utf8',
        );
        copyFileSync(
          path.resolve(__dirname, 'wallpaper/preview.gif'),
          path.join(distDir, 'preview.gif'),
        );
      },
    },
    {
      name: 'flatten-wallpaper-output',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist-wallpaper');
        const nested = path.join(distDir, 'wallpaper');
        if (existsSync(nested)) {
          for (const file of readdirSync(nested)) {
            const src = path.join(nested, file);
            const dest = path.join(distDir, file);
            renameSync(src, dest);
          }
          rmdirSync(nested);
        }

        const htmlFile = path.join(distDir, 'index.html');
        if (existsSync(htmlFile)) {
          let html = readFileSync(htmlFile, 'utf8');
          html = html.replace(/\.\.\/(assets\/)/g, '$1');
          html = html.replace(
            /<title>[\s\S]*?<\/title>/i,
            '<title>Sonic Topography Enhanced v2</title>',
          );
          writeFileSync(htmlFile, html, 'utf8');
        }
      },
    },
  ],
  base: './',
  root: '.',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-wallpaper'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'wallpaper/index.html'),
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
