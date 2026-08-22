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