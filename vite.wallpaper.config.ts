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

const enhancedPropertyHandlers = `    // Enhanced v2 audio controls
    if (properties.rhythmSyncEnabled?.value !== undefined) {
      engine.rhythmSyncEnabled = properties.rhythmSyncEnabled.value as boolean;
    }
    if (properties.beatTriggerStrength?.value !== undefined) {
      engine.beatTriggerStrength = Math.max(0, Number(properties.beatTriggerStrength.value));
    }
    if (properties.sparkleIntensity?.value !== undefined) {
      engine.sparkleIntensity = Math.max(0, Math.min(1, Number(properties.sparkleIntensity.value)));
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
    if (properties.membraneEnabled?.value !== undefined) {
      engine.membraneEnabled = properties.membraneEnabled.value as boolean;
    }
    if (properties.membraneStrength?.value !== undefined) {
      engine.membraneStrength = Math.max(0, Math.min(1.5, Number(properties.membraneStrength.value)));
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
    sparkleIntensity: {
      index: 2,
      order: 352,
      text: 'Sparkle Intensity',
      type: 'slider',
      value: 0.12,
      min: 0,
      max: 1,
      step: 0.05,
    },
    visualAttackMs: {
      index: 3,
      order: 353,
      text: 'Visual Attack (ms)',
      type: 'slider',
      value: 45,
      min: 10,
      max: 150,
      step: 5,
    },
    visualReleaseMs: {
      index: 4,
      order: 354,
      text: 'Visual Release (ms)',
      type: 'slider',
      value: 160,
      min: 50,
      max: 500,
      step: 10,
    },
    spectralMemoryEnabled: {
      index: 5,
      order: 355,
      text: 'Spectral Memory',
      type: 'bool',
      value: true,
    },
    spectralMemoryStrength: {
      index: 6,
      order: 356,
      text: 'Spectral Memory Strength',
      type: 'slider',
      value: 0.45,
      min: 0,
      max: 1.5,
      step: 0.05,
    },
    stereoSpatialEnabled: {
      index: 7,
      order: 357,
      text: 'Stereo Spatialization',
      type: 'bool',
      value: true,
    },
    stereoSpatialStrength: {
      index: 8,
      order: 358,
      text: 'Stereo Spatial Strength',
      type: 'slider',
      value: 0.55,
      min: 0,
      max: 1.5,
      step: 0.05,
    },
    terrainCoherenceEnabled: {
      index: 9,
      order: 359,
      text: 'Music-driven Terrain Coherence',
      type: 'bool',
      value: true,
    },
    terrainCoherenceStrength: {
      index: 10,
      order: 360,
      text: 'Terrain Coherence Strength',
      type: 'slider',
      value: 0.65,
      min: 0,
      max: 1.5,
      step: 0.05,
    },
    membraneEnabled: {
      index: 11,
      order: 361,
      text: 'Rubber Membrane Center',
      type: 'bool',
      value: false,
    },
    membraneStrength: {
      index: 12,
      order: 362,
      text: 'Membrane Bounce Strength',
      type: 'slider',
      value: 0.75,
      min: 0,
      max: 1.5,
      step: 0.05,
    },
  });

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
    'Enhanced 3D audio-reactive topography with rhythm analysis, spectral memory, stereo spatialization, terrain coherence, optional membrane dynamics, ripples and meteors.';
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

        // Accept both LF and CRLF checkouts. This is deliberately a build-time
        // transform so the source tree is never mutated while Vite is running.
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

          const tuningAnchor = /(  public visualAttack = 0\.045;\r?\n  public visualRelease = 0\.16;\r?\n)/;
          if (!tuningAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine tuning insertion point.');
          }
          next = next.replace(
            tuningAnchor,
            `$1\n  // Slow, continuous visual dynamics. These intentionally avoid beat-rate flashing.\n  public spectralMemoryEnabled = true;\n  public spectralMemoryStrength = 0.45;\n  public stereoSpatialEnabled = true;\n  public stereoSpatialStrength = 0.55;\n  public terrainCoherenceEnabled = true;\n  public terrainCoherenceStrength = 0.65;\n  public membraneEnabled = false;\n  public membraneStrength = 0.75;\n`,
          );

          const spectrumAnchor = /(  private readonly prevSpectrum = new Float32Array\(64\);\r?\n)/;
          if (!spectrumAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine spectrum state insertion point.');
          }
          next = next.replace(
            spectrumAnchor,
            `$1\n  // Six smooth spectral-memory layers (low/mid/high). Inner terrain uses the\n  // fast layers; outer terrain uses progressively slower layers up to ~3.2 s.\n  private readonly spectralMemory = new Float32Array(18);\n  private membranePosition = 0;\n  private membraneVelocity = 0;\n  private membraneOffset = 0;\n`,
          );

          const targetAnchor = /(    this\.targetData = \{[\s\S]*?      spectralCentroid,\r?\n    \};\r?\n)/;
          if (!targetAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine targetData block for spectral memory.');
          }
          const memoryUpdate = `\n    // Multi-timescale spectral memory: no discrete history shifts, therefore no\n    // temporal stepping. The outer visual layers simply remember audio longer.\n    if (this.spectralMemoryEnabled) {\n      const memoryTargets = [\n        clamp01((subBass + bass) * 0.5),\n        clamp01((lowMid + mid + highMid) / 3),\n        clamp01((presence + brilliance + air) / 3),\n      ];\n      const memoryTaus = [0.18, 0.38, 0.72, 1.2, 2.0, 3.2];\n      for (let layer = 0; layer < 6; layer++) {\n        const alpha = emaAlpha(dt, memoryTaus[layer]);\n        for (let band = 0; band < 3; band++) {\n          const idx = layer * 3 + band;\n          this.spectralMemory[idx] +=\n            (memoryTargets[band] - this.spectralMemory[idx]) * alpha;\n        }\n      }\n    }\n`;
          next = next.replace(targetAnchor, `$1${memoryUpdate}`);

          const dtAnchor = /(    const dt = Math\.max\(0\.00025, Math\.min\(0\.1, deltaTime \|\| 0\.016\)\);\r?\n)/;
          if (!dtAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine render dt for membrane physics.');
          }
          const membraneUpdate = `\n    // Optional under-damped central membrane. It follows raw sub-bass targets,\n    // so a sudden stop can carry momentum through neutral into a brief negative dip.\n    if (this.membraneEnabled) {\n      const target = clamp01(this.targetData.subBass);\n      const stiffness = 160.0;\n      const damping = 14.0;\n      const acceleration =\n        (target - this.membranePosition) * stiffness -\n        this.membraneVelocity * damping;\n      this.membraneVelocity += acceleration * dt;\n      this.membranePosition += this.membraneVelocity * dt;\n      this.membraneOffset = Math.max(\n        -0.38,\n        Math.min(0.45, (this.membranePosition - target) * this.membraneStrength),\n      );\n    } else {\n      this.membranePosition = clamp01(this.targetData.subBass);\n      this.membraneVelocity = 0;\n      this.membraneOffset = 0;\n    }\n`;
          next = next.replace(dtAnchor, `$1${membraneUpdate}`);

          const idleAnchor = /(  public getIdleWaveIntensity\(deltaTime: number = 0\.016\): number \{)/;
          if (!idleAnchor.test(next)) {
            throw new Error('Could not locate AudioEngine public getter insertion point.');
          }
          const getters = `  public getSpectralMemory(): Float32Array {\n    return this.spectralMemory;\n  }\n\n  public getMembraneOffset(): number {\n    return this.membraneEnabled ? this.membraneOffset : 0;\n  }\n\n`;
          next = next.replace(idleAnchor, `${getters}$1`);

          if (
            !next.includes('public spectralMemoryEnabled = true;') ||
            !next.includes('private readonly spectralMemory') ||
            !next.includes('getMembraneOffset()')
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
            `$1    uStereoPan: 0,\n    uStereoWidth: 0,\n    uStereoSpatialStrength: 0,\n    uTerrainCoherenceStrength: 0,\n    uSpectralMemoryStrength: 0,\n    uMembraneOffset: 0,\n    uMemory0: new THREE.Vector3(),\n    uMemory1: new THREE.Vector3(),\n    uMemory2: new THREE.Vector3(),\n    uMemory3: new THREE.Vector3(),\n    uMemory4: new THREE.Vector3(),\n    uMemory5: new THREE.Vector3(),\n`,
          );

          const declarationsAnchor = /(    uniform float uHalfExtent;\r?\n)/;
          if (!declarationsAnchor.test(next)) {
            throw new Error('Could not locate shader uniform declaration insertion point.');
          }
          next = next.replace(
            declarationsAnchor,
            `$1    uniform float uStereoPan;\n    uniform float uStereoWidth;\n    uniform float uStereoSpatialStrength;\n    uniform float uTerrainCoherenceStrength;\n    uniform float uSpectralMemoryStrength;\n    uniform float uMembraneOffset;\n    uniform vec3 uMemory0;\n    uniform vec3 uMemory1;\n    uniform vec3 uMemory2;\n    uniform vec3 uMemory3;\n    uniform vec3 uMemory4;\n    uniform vec3 uMemory5;\n`,
          );

          const randomAnchor = /(      float rnd = random\(pos2D\);\r?\n)/;
          if (!randomAnchor.test(next)) {
            throw new Error('Could not locate shader spatial-dynamics insertion point.');
          }
          const spatialSetup = `\n      // Overall pan smoothly biases mid/high terrain left or right. Stereo width\n      // increases the spatial reach without moving the sub-bass core away from center.\n      float stereoX = clamp(pos2D.x / max(uHalfExtent, 0.001), -1.0, 1.0);\n      float stereoSpatial = 1.0 +\n        stereoX * uStereoPan * uStereoSpatialStrength * (0.35 + uStereoWidth * 0.35);\n      float coherence = clamp(\n        (uSmoothness * 0.72 + (1.0 - uDensity) * 0.28) * uTerrainCoherenceStrength,\n        0.0,\n        1.0\n      );\n`;
          next = next.replace(randomAnchor, `$1${spatialSetup}`);

          const combineAnchor = /(      \/\/ Combine and apply intensity multiplier\r?\n      float audioElevation = \(subLift \+ bassLift \+ lowMidLift \+ midLift \+ highMidLift\) \* uAudioIntensity;\r?\n)/;
          if (!combineAnchor.test(next)) {
            throw new Error('Could not locate shader audio-elevation block.');
          }
          const continuousTerrain = `\n      // Stereo is intentionally strongest in the mid/high structures.\n      lowMidLift *= mix(1.0, stereoSpatial, 0.35);\n      midLift *= mix(1.0, stereoSpatial, 0.65);\n      highMidLift *= mix(1.0, stereoSpatial, 0.90);\n\n      // Coherent music produces broad geological forms; dense/rough music keeps\n      // more of the fragmented original topology. All transitions are continuous.\n      float coherenceField = (snoise(\n        pos2D * mix(0.085, 0.032, coherence) +\n        vec2(uTime * mix(0.10, 0.025, coherence), 0.0)\n      ) + 1.0) * 0.5;\n      float coherentBass = easeLift(uBass, 5.0) * bassRegion *\n        (0.68 + coherenceField * 0.32);\n      bassLift = mix(bassLift, coherentBass, coherence * 0.72);\n      midLift = mix(\n        midLift,\n        flowLift(uMid, 4.0) * (0.35 + coherenceField * 0.65) *\n          mix(1.0, stereoSpatial, 0.55),\n        coherence * 0.42\n      );\n      highMidLift *= mix(1.0, 0.58, coherence);\n\n      // Six smooth temporal memory layers are mapped from center (recent) to\n      // perimeter (long memory). This leaves slowly fading spectral contours.\n      float memoryCoord = clamp(\n        centerDist / max(uHalfExtent * 0.72 * range, 0.001),\n        0.0,\n        0.999\n      ) * 5.0;\n      vec3 memoryBands;\n      if (memoryCoord < 1.0) memoryBands = mix(uMemory0, uMemory1, memoryCoord);\n      else if (memoryCoord < 2.0) memoryBands = mix(uMemory1, uMemory2, memoryCoord - 1.0);\n      else if (memoryCoord < 3.0) memoryBands = mix(uMemory2, uMemory3, memoryCoord - 2.0);\n      else if (memoryCoord < 4.0) memoryBands = mix(uMemory3, uMemory4, memoryCoord - 3.0);\n      else memoryBands = mix(uMemory4, uMemory5, memoryCoord - 4.0);\n\n      float radialNorm = clamp(centerDist / max(uHalfExtent * 0.72 * range, 0.001), 0.0, 1.0);\n      float memoryLowWeight = 1.0 - smoothstep(0.18, 0.62, radialNorm);\n      float memoryHighWeight = smoothstep(0.42, 0.92, radialNorm);\n      float memoryMidWeight = clamp(1.0 - abs(radialNorm - 0.5) * 2.0, 0.0, 1.0);\n      float memoryWeightSum = max(0.001, memoryLowWeight + memoryMidWeight + memoryHighWeight);\n      float memoryValue = (\n        memoryBands.x * memoryLowWeight +\n        memoryBands.y * memoryMidWeight +\n        memoryBands.z * memoryHighWeight\n      ) / memoryWeightSum;\n      float memoryTexture = 0.72 +\n        ((snoise(pos2D * 0.045 + vec2(uTime * 0.018, 0.0)) + 1.0) * 0.5) * 0.28;\n      audioElevation += memoryValue * memoryTexture * uSpectralMemoryStrength * 1.35;\n\n      // Optional center membrane displacement may become negative after a sharp\n      // bass stop, creating a rubber-sheet undershoot rather than a flash.\n      audioElevation += uMembraneOffset * subRegion * 4.2 * uAudioIntensity;\n`;
          next = next.replace(combineAnchor, `$1${continuousTerrain}`);

          const heightAnchor = /(      float totalHeight = 1\.0 \+ elevation;\r?\n)/;
          if (!heightAnchor.test(next)) {
            throw new Error('Could not locate shader total-height safety clamp.');
          }
          next = next.replace(
            heightAnchor,
            `      float totalHeight = max(0.12, 1.0 + elevation);\n`,
          );

          if (
            !next.includes('uSpectralMemoryStrength: 0') ||
            !next.includes('memoryCoord') ||
            !next.includes('uMembraneOffset * subRegion')
          ) {
            throw new Error('Enhanced shader terrain transform did not apply completely.');
          }

          return { code: next, map: null };
        }

        if (normalizedId.endsWith('/src/components/AudioVisualizer/MapScene.tsx')) {
          if (code.includes('mat.uSpectralMemoryStrength =')) return null;

          let next = code;

          const dataAnchor = /(    const data = buf\.audioData \|\| engine\.getAudioData\(0\.016\);\r?\n)/;
          if (!dataAnchor.test(next)) {
            throw new Error('Could not locate MapScene audio-data insertion point.');
          }
          next = next.replace(
            dataAnchor,
            `$1    const music = engine.getMusicState();\n    const spectralMemory = engine.getSpectralMemory();\n`,
          );

          const uniformAnchor = /(    mat\.uHalfExtent = halfExtent;\r?\n)/;
          if (!uniformAnchor.test(next)) {
            throw new Error('Could not locate MapScene terrain uniform insertion point.');
          }
          const visualUniforms = `    mat.uStereoPan = engine.stereoSpatialEnabled ? music.stereoPan : 0.0;\n    mat.uStereoWidth = engine.stereoSpatialEnabled ? music.stereoWidth : 0.0;\n    mat.uStereoSpatialStrength = engine.stereoSpatialEnabled\n      ? engine.stereoSpatialStrength\n      : 0.0;\n    mat.uTerrainCoherenceStrength = engine.terrainCoherenceEnabled\n      ? engine.terrainCoherenceStrength\n      : 0.0;\n    mat.uSpectralMemoryStrength = engine.spectralMemoryEnabled\n      ? engine.spectralMemoryStrength\n      : 0.0;\n    mat.uMembraneOffset = engine.getMembraneOffset();\n    mat.uMemory0.set(spectralMemory[0], spectralMemory[1], spectralMemory[2]);\n    mat.uMemory1.set(spectralMemory[3], spectralMemory[4], spectralMemory[5]);\n    mat.uMemory2.set(spectralMemory[6], spectralMemory[7], spectralMemory[8]);\n    mat.uMemory3.set(spectralMemory[9], spectralMemory[10], spectralMemory[11]);\n    mat.uMemory4.set(spectralMemory[12], spectralMemory[13], spectralMemory[14]);\n    mat.uMemory5.set(spectralMemory[15], spectralMemory[16], spectralMemory[17]);\n`;
          next = next.replace(uniformAnchor, `$1${visualUniforms}`);

          if (
            !next.includes('const spectralMemory = engine.getSpectralMemory();') ||
            !next.includes('mat.uSpectralMemoryStrength =') ||
            !next.includes('mat.uMembraneOffset = engine.getMembraneOffset();')
          ) {
            throw new Error('Enhanced MapScene terrain transform did not apply completely.');
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
