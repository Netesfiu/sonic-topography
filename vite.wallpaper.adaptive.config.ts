import baseConfig from './vite.wallpaper.config';
import type { Plugin, UserConfig } from 'vite';
import { mkdirSync } from 'fs';

/**
 * Keeps the music-lamp effect visually consistent across render resolutions.
 *
 * 120x120 is the reference look. Higher grid resolutions contain physically
 * smaller pillars, so the logical lamp grouping grows gradually above 120.
 * Successive musical events receive a fresh deterministic seed, moving the lamp
 * pattern between flashes without introducing frame-to-frame noise. The bass-heavy
 * center is radially suppressed so the central mound stays visually coherent.
 *
 * This changes only shader selection logic; it adds no geometry, faces, meshes,
 * or draw calls.
 */
const adaptiveLampResolutionPlugin: Plugin = {
  name: 'adaptive-lamp-resolution',
  // Run after the base transforms so this layer can refine the generated code,
  // and after the base clean-dist buildStart hook so we can recreate the output
  // directory even when Rollup aborts before writing its normal bundle output.
  enforce: 'post',
  buildStart() {
    mkdirSync('dist-wallpaper', { recursive: true });
  },
  transform(code, id) {
    const normalizedId = id.replace(/\\/g, '/').split('?')[0];

    if (normalizedId.endsWith('/wallpaper/main.tsx')) {
      // Match the UI range. The old runtime clamp made the lower part of the
      // Accent Density slider a dead zone (everything below 0.005 became 0.005).
      const oldClamp =
        'engine.topAccentDensity = Math.max(0.005, Math.min(0.25, Number(properties.topAccentDensity.value)));';
      const newClamp =
        'engine.topAccentDensity = Math.max(0.0005, Math.min(0.05, Number(properties.topAccentDensity.value)));';

      if (code.includes(oldClamp)) {
        return { code: code.replace(oldClamp, newClamp), map: null };
      }

      // If the base transform changes later, fail loudly rather than silently
      // reintroducing a broken density slider.
      if (
        code.includes('properties.topAccentDensity?.value') &&
        !code.includes(newClamp)
      ) {
        throw new Error('Could not normalize the Accent Density runtime clamp.');
      }
      return null;
    }

    if (normalizedId.endsWith('/src/lib/AudioEngine.ts')) {
      if (code.includes('public topAccentDensity = 0.055;')) {
        return {
          code: code.replace(
            'public topAccentDensity = 0.055;',
            'public topAccentDensity = 0.006;',
          ),
          map: null,
        };
      }
      return null;
    }

    if (normalizedId.endsWith('/src/components/AudioVisualizer/CustomShaderMaterial.ts')) {
      let next = code;

      if (!next.includes('uGridSize: 160,')) {
        const defaultsAnchor = '    uHalfExtent: 84,\n';
        if (!next.includes(defaultsAnchor)) {
          throw new Error('Could not locate shader grid-size default insertion point.');
        }
        next = next.replace(
          defaultsAnchor,
          `${defaultsAnchor}    uGridSize: 160,\n    uTopAccentSeed: 0,\n`,
        );
      } else if (!next.includes('uTopAccentSeed: 0,')) {
        next = next.replace(
          '    uGridSize: 160,\n',
          '    uGridSize: 160,\n    uTopAccentSeed: 0,\n',
        );
      }

      if (!next.includes('uniform float uGridSize;')) {
        const fragmentAnchor = '    uniform float uTopAccentColorMode;\n';
        if (!next.includes(fragmentAnchor)) {
          throw new Error('Could not locate shader grid-size uniform insertion point.');
        }
        next = next.replace(
          fragmentAnchor,
          `${fragmentAnchor}    uniform float uGridSize;\n    uniform float uTopAccentSeed;\n    uniform float uHalfExtent;\n    uniform float uResponseRange;\n`,
        );
      } else {
        if (!next.includes('uniform float uTopAccentSeed;')) {
          next = next.replace(
            '    uniform float uGridSize;\n',
            '    uniform float uGridSize;\n    uniform float uTopAccentSeed;\n',
          );
        }
        // These uniforms already exist in the vertex shader, but the fragment
        // shader must declare them independently to use the bass-region mask.
        const fragmentSectionStart = next.indexOf('// fragment shader');
        const fragmentSection = fragmentSectionStart >= 0
          ? next.slice(fragmentSectionStart)
          : '';
        if (!fragmentSection.includes('uniform float uHalfExtent;')) {
          next = next.replace(
            '    uniform float uTopAccentSeed;\n',
            '    uniform float uTopAccentSeed;\n    uniform float uHalfExtent;\n    uniform float uResponseRange;\n',
          );
        }
      }

      next = next.replace('uTopAccentDensity: 0.055,', 'uTopAccentDensity: 0.006,');

      const fixedGrouping = `         // The base grid is 168 world units wide. At the default 160-cell
         // resolution each pillar step is 1.05 units, so a 2.10-unit hash cell
         // groups four neighboring pillars into one larger visual lamp. This only
         // changes the accent-selection hash: no geometry or extra faces are added.
         vec2 lampCell = floor((vInstancePos + vec2(1.05)) / 2.10);
         rnd = random(lampCell);`;

      const oldAdaptiveGrouping = `         // 120x120 is the calibrated reference appearance. Above that resolution
         // individual pillar tops become progressively smaller on screen, so grow
         // the logical lamp grouping smoothly. sqrt() keeps the scaling moderate:
         // 120 -> 1.00x, 160 -> 1.15x, 200 -> 1.29x, 240 -> 1.41x.
         // Only the selection hash changes; geometry and triangle count are unchanged.
         float lampResolutionScale = max(1.0, sqrt(max(uGridSize, 1.0) / 120.0));
         float lampCellSize = 2.10 * lampResolutionScale;
         vec2 lampCell = floor(
           (vInstancePos + vec2(lampCellSize * 0.5)) / lampCellSize
         );
         rnd = random(lampCell);`;

      const adaptiveGrouping = `         // 120x120 is the calibrated reference appearance. Above that resolution
         // individual pillar tops become progressively smaller on screen, so grow
         // the logical lamp grouping smoothly. The event seed is constant during
         // one flash, then changes on the next distinct musical event. This moves
         // the lamp layout between flashes without frame-to-frame sparkling.
         float lampResolutionScale = max(1.0, sqrt(max(uGridSize, 1.0) / 120.0));
         float lampCellSize = 2.10 * lampResolutionScale;
         vec2 lampCell = floor(
           (vInstancePos + vec2(lampCellSize * 0.5)) / lampCellSize
         );
         vec2 lampSeedOffset = vec2(
           uTopAccentSeed * 0.754877666,
           uTopAccentSeed * 1.324717957
         );
         rnd = random(lampCell + lampSeedOffset);`;

      if (next.includes(fixedGrouping)) {
        next = next.replace(fixedGrouping, adaptiveGrouping);
      } else if (next.includes(oldAdaptiveGrouping)) {
        next = next.replace(oldAdaptiveGrouping, adaptiveGrouping);
      } else if (!next.includes('vec2 lampSeedOffset =')) {
        throw new Error('Could not locate music-lamp grouping block.');
      }

      // Make density linear and predictable. The previous second hash operation
      // made low density settings difficult to tune. Also suppress the bass-heavy
      // center: no lamps in the inner core, then smoothly restore them through the
      // outer bass region. responseRange keeps the exclusion aligned with terrain.
      const oldAccentMask = `         float accentMask = step(
           1.0 - clamp(uTopAccentDensity, 0.0, 0.25),
           fract(rnd * 31.731 + 0.173)
         );`;
      const newAccentMask = `         float bassRange = max(uResponseRange, 0.25);
         float bassRadiusNorm = centerDist / max(uHalfExtent * bassRange, 0.001);
         float bassCoreAvailability = smoothstep(0.24, 0.44, bassRadiusNorm);
         float effectiveAccentDensity =
           clamp(uTopAccentDensity, 0.0, 0.05) * bassCoreAvailability;
         float accentMask = step(1.0 - effectiveAccentDensity, rnd);`;

      if (next.includes(oldAccentMask)) {
        next = next.replace(oldAccentMask, newAccentMask);
      } else if (!next.includes('float bassCoreAvailability =')) {
        throw new Error('Could not locate music-lamp density mask.');
      }

      return next === code ? null : { code: next, map: null };
    }

    if (normalizedId.endsWith('/src/components/AudioVisualizer/MapScene.tsx')) {
      let next = code;

      if (!next.includes('const topAccentEventSeedRef = useRef(')) {
        const seedRefAnchor = '  const topAccentPrevRawRef = useRef(0);\n';
        if (!next.includes(seedRefAnchor)) {
          throw new Error('Could not locate top-accent event seed insertion point.');
        }
        next = next.replace(
          seedRefAnchor,
          `${seedRefAnchor}  const topAccentEventSeedRef = useRef(Math.random() * 4096);\n`,
        );
      }

      // Re-seed both lamp positions and (when selected) random color at the same
      // rising edge. The seed stays fixed during the release tail, so there is no
      // shimmering while a flash fades out.
      const oldEventBlock = `    if (
      topAccentRaw >= randomEventThreshold &&
      topAccentPrevRawRef.current < randomEventThreshold
    ) {
      topAccentRandomTargetRef.current.setHSL(Math.random(), 0.82, 0.58);
    }
    topAccentPrevRawRef.current = topAccentRaw;`;
      const newEventBlock = `    if (
      topAccentRaw >= randomEventThreshold &&
      topAccentPrevRawRef.current < randomEventThreshold
    ) {
      topAccentEventSeedRef.current = Math.random() * 4096;
      topAccentRandomTargetRef.current.setHSL(Math.random(), 0.82, 0.58);
    }
    topAccentPrevRawRef.current = topAccentRaw;`;

      if (next.includes(oldEventBlock)) {
        next = next.replace(oldEventBlock, newEventBlock);
      } else if (!next.includes('topAccentEventSeedRef.current = Math.random() * 4096;')) {
        throw new Error('Could not locate top-accent event re-seed block.');
      }

      if (!next.includes('mat.uGridSize = gridSize;')) {
        const gridAnchor = '    mat.uHalfExtent = halfExtent;\n';
        if (!next.includes(gridAnchor)) {
          throw new Error('Could not locate MapScene grid-size uniform assignment point.');
        }
        next = next.replace(gridAnchor, `${gridAnchor}    mat.uGridSize = gridSize;\n`);
      }

      if (!next.includes('mat.uTopAccentSeed = topAccentEventSeedRef.current;')) {
        const accentUniformAnchor =
          '    mat.uTopAccentLevel = topAccentEnvelopeRef.current;\n';
        if (!next.includes(accentUniformAnchor)) {
          throw new Error('Could not locate top-accent seed uniform assignment point.');
        }
        next = next.replace(
          accentUniformAnchor,
          `${accentUniformAnchor}    mat.uTopAccentSeed = topAccentEventSeedRef.current;\n`,
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
  plugins: [...(base.plugins ?? []), adaptiveLampResolutionPlugin],
} satisfies UserConfig;
