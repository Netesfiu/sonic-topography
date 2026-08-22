import baseConfig from './vite.wallpaper.config';
import type { Plugin, UserConfig } from 'vite';

/**
 * Keeps the music-lamp effect visually consistent across render resolutions.
 *
 * 120x120 is the reference look. Higher grid resolutions contain physically
 * smaller pillars, so the logical lamp grouping grows gradually above 120.
 * This changes only which existing pillar tops share a lamp state; it adds no
 * geometry, faces, meshes, or draw calls.
 */
const adaptiveLampResolutionPlugin: Plugin = {
  name: 'adaptive-lamp-resolution',
  enforce: 'pre',
  transform(code, id) {
    const normalizedId = id.replace(/\\/g, '/').split('?')[0];

    if (normalizedId.endsWith('/wallpaper/main.tsx')) {
      // Match the UI range: the final settings schema allows densities below
      // 0.005, so do not silently clamp those values back up at runtime.
      const oldClamp =
        'engine.topAccentDensity = Math.max(0.005, Math.min(0.25, Number(properties.topAccentDensity.value)));';
      const newClamp =
        'engine.topAccentDensity = Math.max(0.0005, Math.min(0.25, Number(properties.topAccentDensity.value)));';

      if (code.includes(oldClamp)) {
        return { code: code.replace(oldClamp, newClamp), map: null };
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
        next = next.replace(defaultsAnchor, `${defaultsAnchor}    uGridSize: 160,\n`);
      }

      if (!next.includes('uniform float uGridSize;')) {
        const fragmentAnchor = '    uniform float uTopAccentColorMode;\n';
        if (!next.includes(fragmentAnchor)) {
          throw new Error('Could not locate shader grid-size uniform insertion point.');
        }
        next = next.replace(
          fragmentAnchor,
          `${fragmentAnchor}    uniform float uGridSize;\n`,
        );
      }

      next = next.replace('uTopAccentDensity: 0.055,', 'uTopAccentDensity: 0.006,');

      const fixedGrouping = `         // The base grid is 168 world units wide. At the default 160-cell
         // resolution each pillar step is 1.05 units, so a 2.10-unit hash cell
         // groups four neighboring pillars into one larger visual lamp. This only
         // changes the accent-selection hash: no geometry or extra faces are added.
         vec2 lampCell = floor((vInstancePos + vec2(1.05)) / 2.10);
         rnd = random(lampCell);`;

      const adaptiveGrouping = `         // 120x120 is the calibrated reference appearance. Above that resolution
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

      if (next.includes(fixedGrouping)) {
        next = next.replace(fixedGrouping, adaptiveGrouping);
      } else if (!next.includes('float lampResolutionScale =')) {
        throw new Error('Could not locate fixed music-lamp grouping block.');
      }

      return next === code ? null : { code: next, map: null };
    }

    if (normalizedId.endsWith('/src/components/AudioVisualizer/MapScene.tsx')) {
      if (code.includes('mat.uGridSize = gridSize;')) return null;

      const anchor = '    mat.uHalfExtent = halfExtent;\n';
      if (!code.includes(anchor)) {
        throw new Error('Could not locate MapScene grid-size uniform assignment point.');
      }

      return {
        code: code.replace(anchor, `${anchor}    mat.uGridSize = gridSize;\n`),
        map: null,
      };
    }

    return null;
  },
};

const base = baseConfig as UserConfig;

export default {
  ...base,
  plugins: [...(base.plugins ?? []), adaptiveLampResolutionPlugin],
} satisfies UserConfig;
