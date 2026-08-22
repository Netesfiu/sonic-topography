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
    'Enhanced 3D audio-reactive topography with rhythm analysis, ripples, meteors, configurable smoothing and clean high-frequency rendering.';
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
      name: 'enhanced-beat-perimeter-ring',
      enforce: 'pre',
      transform(code, id) {
        const normalizedId = id.replace(/\\/g, '/').split('?')[0];

        if (normalizedId.endsWith('/src/components/AudioVisualizer/CustomShaderMaterial.ts')) {
          if (code.includes('uBeatPulse: 0')) return null;

          let next = code;

          next = next.replace(
            /(    uHalfExtent: 84,\r?\n)/,
            `$1    uBeatPulse: 0,\n    uBeatDownbeat: 0,\n`,
          );

          next = next.replace(
            /(    uniform float uHalfExtent;\r?\n)/,
            `$1    uniform float uBeatPulse;\n    uniform float uBeatDownbeat;\n`,
          );

          const elevationAnchor = /(      float elevation = idleElevation \+ audioElevation \+ idleBlockWave;\r?\n)/;
          if (!elevationAnchor.test(next)) {
            throw new Error('Could not locate the shader elevation insertion point for the beat ring.');
          }

          const beatRingShader = `\n      // Beat-synced perimeter ridge. This is a stationary annular mound: the\n      // entire circumference rises together instead of propagating like a ripple.\n      // A broad Gaussian cross-section produces the smooth hill profile requested.\n      float beatRingRadius = uHalfExtent * 0.64;\n      float beatRingWidth = uHalfExtent * 0.11;\n      float beatRingDistance = (centerDist - beatRingRadius) / max(beatRingWidth, 0.001);\n      float beatRingShape = exp(-beatRingDistance * beatRingDistance * 2.0);\n      float beatRingPulse = pow(clamp(uBeatPulse, 0.0, 1.0), 0.45);\n      float beatRingDownbeatBoost = mix(1.0, 1.25, clamp(uBeatDownbeat, 0.0, 1.0));\n      float beatRingLift = beatRingShape * beatRingPulse * 4.5 * beatRingDownbeatBoost * uAudioIntensity;\n      elevation += beatRingLift;\n`;

          next = next.replace(elevationAnchor, `$1${beatRingShader}`);

          if (!next.includes('uBeatPulse: 0') || !next.includes('beatRingLift')) {
            throw new Error('Beat-ring shader transform did not apply completely.');
          }

          return { code: next, map: null };
        }

        if (normalizedId.endsWith('/src/components/AudioVisualizer/MapScene.tsx')) {
          if (code.includes('mat.uBeatPulse =')) return null;

          let next = code;

          const dataAnchor = /(    const data = buf\.audioData \|\| engine\.getAudioData\(0\.016\);\r?\n)/;
          if (!dataAnchor.test(next)) {
            throw new Error('Could not locate MapScene audio-data insertion point for the beat ring.');
          }
          next = next.replace(dataAnchor, `$1    const music = engine.getMusicState();\n`);

          const uniformAnchor = /(    mat\.uHalfExtent = halfExtent;\r?\n)/;
          if (!uniformAnchor.test(next)) {
            throw new Error('Could not locate MapScene uniform insertion point for the beat ring.');
          }
          next = next.replace(
            uniformAnchor,
            `$1    // Predicted beat pulse drives the perimeter; low-onset is a fallback\n    // while the tempo tracker is still locking onto the song.\n    mat.uBeatPulse = Math.max(music.beatPulse, music.lowOnset * 0.8);\n    mat.uBeatDownbeat = music.isDownbeat ? 1.0 : 0.0;\n`,
          );

          if (!next.includes('const music = engine.getMusicState();') || !next.includes('mat.uBeatPulse =')) {
            throw new Error('Beat-ring MapScene transform did not apply completely.');
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