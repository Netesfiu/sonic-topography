import baseConfig from './vite.wallpaper.config';
import path from 'path';
import { mkdirSync } from 'fs';
import type { Plugin, UserConfig } from 'vite';

/**
 * Stable post-processing layer for the music-lamp system.
 *
 * The base wallpaper config injects the enhanced audio system. This plugin then
 * refines only the lamp-related generated code using structural regex anchors,
 * so formatting changes from React/Vite do not break the build.
 *
 * 120x120 is the calibrated reference appearance. Higher render resolutions use
 * larger logical lamp cells, but no additional geometry, faces, meshes or draw
 * calls are created.
 */
const lampVisualPlugin: Plugin = {
  name: 'stable-music-lamps',
  enforce: 'post',

  buildStart() {
    // The base config cleans this directory in buildStart. Recreate it after the
    // clean hook so closeBundle asset writers never mask an earlier build error.
    mkdirSync(path.resolve(process.cwd(), 'dist-wallpaper'), { recursive: true });
  },

  transform(code, id) {
    const normalizedId = id.replace(/\\/g, '/').split('?')[0];

    if (normalizedId.endsWith('/wallpaper/main.tsx')) {
      const densityAssignment =
        /^(\s*)engine\.topAccentDensity\s*=\s*.*properties\.topAccentDensity\.value.*;\s*$/m;
      const match = code.match(densityAssignment);

      if (!match) return null;

      const indent = match[1] ?? '';
      const replacement =
        `${indent}engine.topAccentDensity = Math.max(0.0005, Math.min(0.05, Number(properties.topAccentDensity.value)));`;

      return {
        code: code.replace(densityAssignment, replacement),
        map: null,
      };
    }

    if (normalizedId.endsWith('/src/lib/AudioEngine.ts')) {
      const densityDefault = /public\s+topAccentDensity\s*=\s*0\.055\s*;/;
      if (!densityDefault.test(code)) return null;

      return {
        code: code.replace(densityDefault, 'public topAccentDensity = 0.006;'),
        map: null,
      };
    }

    if (normalizedId.endsWith('/src/components/AudioVisualizer/CustomShaderMaterial.ts')) {
      let next = code;

      // Material defaults used by the fragment shader.
      if (!/\buGridSize\s*:\s*160\s*,/.test(next)) {
        const halfExtentDefault = /(\s*uHalfExtent\s*:\s*84\s*,\s*\r?\n)/;
        if (!halfExtentDefault.test(next)) {
          throw new Error('Lamp build: shader uHalfExtent default was not found.');
        }
        next = next.replace(
          halfExtentDefault,
          `$1    uGridSize: 160,\n    uTopAccentSeed: 0,\n`,
        );
      } else if (!/\buTopAccentSeed\s*:\s*0\s*,/.test(next)) {
        next = next.replace(
          /(\s*uGridSize\s*:\s*160\s*,\s*\r?\n)/,
          `$1    uTopAccentSeed: 0,\n`,
        );
      }

      next = next.replace(
        /uTopAccentDensity\s*:\s*0\.055\s*,/,
        'uTopAccentDensity: 0.006,',
      );

      // Fragment-only declarations. The same uHalfExtent/uResponseRange names in
      // the vertex shader do not make them visible to the fragment shader.
      const fragmentIndex = next.indexOf('// fragment shader');
      if (fragmentIndex < 0) {
        throw new Error('Lamp build: fragment shader section was not found.');
      }

      const beforeFragment = next.slice(0, fragmentIndex);
      let fragment = next.slice(fragmentIndex);

      if (!/uniform\s+float\s+uGridSize\s*;/.test(fragment)) {
        const colorModeUniform = /(\s*uniform\s+float\s+uTopAccentColorMode\s*;\s*\r?\n)/;
        if (!colorModeUniform.test(fragment)) {
          throw new Error('Lamp build: top-accent fragment uniforms were not found.');
        }
        fragment = fragment.replace(
          colorModeUniform,
          `$1    uniform float uGridSize;\n    uniform float uTopAccentSeed;\n    uniform float uHalfExtent;\n    uniform float uResponseRange;\n`,
        );
      } else {
        if (!/uniform\s+float\s+uTopAccentSeed\s*;/.test(fragment)) {
          fragment = fragment.replace(
            /(\s*uniform\s+float\s+uGridSize\s*;\s*\r?\n)/,
            `$1    uniform float uTopAccentSeed;\n`,
          );
        }
        if (!/uniform\s+float\s+uHalfExtent\s*;/.test(fragment)) {
          fragment = fragment.replace(
            /(\s*uniform\s+float\s+uTopAccentSeed\s*;\s*\r?\n)/,
            `$1    uniform float uHalfExtent;\n    uniform float uResponseRange;\n`,
          );
        }
      }

      next = beforeFragment + fragment;

      // Replace the fixed 2x2-ish selector with a resolution-aware selector and a
      // seed that changes only at the start of a new musical event.
      if (!next.includes('lampSeedOffset')) {
        const fixedLampSelector =
          /vec2\s+lampCell\s*=\s*floor\(\s*\(vInstancePos\s*\+\s*vec2\(1\.05\)\)\s*\/\s*2\.10\s*\)\s*;\s*rnd\s*=\s*random\(lampCell\)\s*;/m;

        if (!fixedLampSelector.test(next)) {
          throw new Error('Lamp build: fixed lamp selector was not found.');
        }

        next = next.replace(
          fixedLampSelector,
          `float lampResolutionScale = max(1.0, sqrt(max(uGridSize, 1.0) / 120.0));
         float lampCellSize = 2.10 * lampResolutionScale;
         vec2 lampCell = floor(
           (vInstancePos + vec2(lampCellSize * 0.5)) / lampCellSize
         );
         vec2 lampSeedOffset = vec2(
           uTopAccentSeed * 0.754877666,
           uTopAccentSeed * 1.324717957
         );
         rnd = random(lampCell + lampSeedOffset);`,
        );
      }

      // Density is a direct probability now. Suppress lamps entirely in the inner
      // bass core and smoothly restore availability through the outer bass zone.
      if (!next.includes('bassCoreAvailability')) {
        const oldAccentMask =
          /float\s+accentMask\s*=\s*step\(\s*1\.0\s*-\s*clamp\(uTopAccentDensity\s*,\s*0\.0\s*,\s*0\.25\)\s*,\s*fract\(rnd\s*\*\s*31\.731\s*\+\s*0\.173\)\s*\)\s*;/m;

        if (!oldAccentMask.test(next)) {
          throw new Error('Lamp build: legacy accent-density mask was not found.');
        }

        next = next.replace(
          oldAccentMask,
          `float bassRange = max(uResponseRange, 0.25);
         float bassRadiusNorm = centerDist / max(uHalfExtent * bassRange, 0.001);
         float bassCoreAvailability = smoothstep(0.24, 0.44, bassRadiusNorm);
         float effectiveAccentDensity =
           clamp(uTopAccentDensity, 0.0, 0.05) * bassCoreAvailability;
         float accentMask = step(1.0 - effectiveAccentDensity, rnd);`,
        );
      }

      return next === code ? null : { code: next, map: null };
    }

    if (normalizedId.endsWith('/src/components/AudioVisualizer/MapScene.tsx')) {
      let next = code;

      if (!next.includes('topAccentEventSeedRef')) {
        const prevRef = /(const\s+topAccentPrevRawRef\s*=\s*useRef\(0\)\s*;)/;
        if (!prevRef.test(next)) {
          throw new Error('Lamp build: top-accent previous-value ref was not found.');
        }
        next = next.replace(
          prevRef,
          `$1\n  const topAccentEventSeedRef = useRef(Math.random() * 4096);`,
        );
      }

      // The random-color target update already occurs exactly once on the rising
      // edge of a distinct event. Use that same edge to re-seed lamp positions.
      if (!next.includes('topAccentEventSeedRef.current = Math.random() * 4096;')) {
        const colorRetarget =
          /^(\s*)topAccentRandomTargetRef\.current\.setHSL\(\s*Math\.random\(\)\s*,\s*0\.82\s*,\s*0\.58\s*\)\s*;\s*$/m;
        const match = next.match(colorRetarget);
        if (!match) {
          throw new Error('Lamp build: top-accent event edge was not found.');
        }
        const indent = match[1] ?? '';
        next = next.replace(
          colorRetarget,
          `${indent}topAccentEventSeedRef.current = Math.random() * 4096;\n${indent}topAccentRandomTargetRef.current.setHSL(Math.random(), 0.82, 0.58);`,
        );
      }

      if (!/mat\.uGridSize\s*=\s*gridSize\s*;/.test(next)) {
        const halfExtentAssignment = /(^(\s*)mat\.uHalfExtent\s*=\s*halfExtent\s*;\s*$)/m;
        const match = next.match(halfExtentAssignment);
        if (!match) {
          throw new Error('Lamp build: uHalfExtent assignment was not found.');
        }
        const indent = match[2] ?? '';
        next = next.replace(
          halfExtentAssignment,
          `$1\n${indent}mat.uGridSize = gridSize;`,
        );
      }

      if (!/mat\.uTopAccentSeed\s*=\s*topAccentEventSeedRef\.current\s*;/.test(next)) {
        const accentLevelAssignment =
          /(^(\s*)mat\.uTopAccentLevel\s*=\s*topAccentEnvelopeRef\.current\s*;\s*$)/m;
        const match = next.match(accentLevelAssignment);
        if (!match) {
          throw new Error('Lamp build: uTopAccentLevel assignment was not found.');
        }
        const indent = match[2] ?? '';
        next = next.replace(
          accentLevelAssignment,
          `$1\n${indent}mat.uTopAccentSeed = topAccentEventSeedRef.current;`,
        );
      }

      return next === code ? null : { code: next, map: null };
    }

    return null;
  },
};

const base = baseConfig as UserConfig;

export default {
  ...base,
  plugins: [...(base.plugins ?? []), lampVisualPlugin],
} satisfies UserConfig;
