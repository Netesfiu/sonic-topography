import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const buildDir = path.resolve(process.argv[2] || 'dist-wallpaper');
const projectPath = path.join(buildDir, 'project.json');
const htmlPath = path.join(buildDir, 'index.html');

if (!fs.existsSync(projectPath)) {
  throw new Error(`Generated project.json was not found: ${projectPath}`);
}

const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
const properties = project?.general?.properties;

if (!properties) {
  throw new Error('Generated project.json has no general.properties object.');
}

// Keep the original Wallpaper Engine section layout. Remove temporary Enhanced-v2
// headings, the superseded white-sparkle control and the discarded membrane feature.
for (const name of [
  'sep_enhanced_audio',
  'sep_enhanced_audio_title',
  'sep_top_accent',
  'sep_top_accent_title',
  'sparkleIntensity',
  'membraneEnabled',
  'membraneStrength',
]) {
  delete properties[name];
}

function configure(name, config) {
  const property = properties[name];
  if (!property) {
    throw new Error(`Expected generated property is missing: ${name}`);
  }
  Object.assign(property, config);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
configure('sep_render', { order: 98, text: ' ' });
configure('sep_render_title', { order: 99, text: '=== Render ===' });
configure('gridSize', { index: 0, order: 100, text: 'Render Resolution' });

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------
configure('sep_appearance', { order: 198, text: ' ' });
configure('sep_appearance_title', { order: 199, text: '=== Appearance ===' });
configure('theme', { index: 0, order: 200, text: 'Color Theme' });
configure('themeCycleInterval', { index: 1, order: 201, text: 'Cycle Interval (s)' });
configure('peakColorEnabled', { index: 2, order: 202, text: 'Peak Color' });
configure('peakColorIntensity', { index: 3, order: 203, text: 'Peak Color Intensity' });

configure('topAccentEnabled', {
  index: 4,
  order: 204,
  text: 'Music Top Accents',
});

configure('topAccentTrigger', {
  index: 5,
  order: 205,
  text: 'Top Accent Trigger',
  options: [
    { label: 'Percussion', value: 'percussion' },
    { label: 'Beat', value: 'beat' },
    { label: 'Bass', value: 'bass' },
    { label: 'Drop', value: 'drop' },
    { label: 'Vocal-like (estimated)', value: 'vocal' },
    { label: 'High Frequencies', value: 'highs' },
    { label: 'Overall Energy', value: 'energy' },
  ],
});

configure('topAccentColorMode', {
  index: 6,
  order: 206,
  text: 'Top Accent Color',
  options: [
    { label: 'Theme Highlight', value: 'theme' },
    { label: 'Theme Peak Color', value: 'peak' },
    { label: 'Random', value: 'random' },
    { label: 'Custom', value: 'custom' },
  ],
});

configure('topAccentCustomColor', {
  index: 7,
  order: 207,
  text: 'Custom Accent Color',
});

configure('topAccentDensity', {
  index: 8,
  order: 208,
  text: 'Accent Density',
  min: 0.01,
  max: 0.20,
  step: 0.005,
});

configure('topAccentIntensity', {
  index: 9,
  order: 209,
  text: 'Accent Strength',
  min: 0,
  max: 1.5,
  step: 0.05,
});

// ---------------------------------------------------------------------------
// Audio Response
// ---------------------------------------------------------------------------
configure('sep_audio', { order: 298, text: ' ' });
configure('sep_audio_title', { order: 299, text: '=== Audio Response ===' });
configure('audioIntensity', { index: 0, order: 300, text: 'Audio Intensity' });
configure('responseRange', { index: 1, order: 301, text: 'Response Range' });

configure('visualAttackMs', {
  index: 2,
  order: 302,
  text: 'Visual Attack (ms)',
});

configure('visualReleaseMs', {
  index: 3,
  order: 303,
  text: 'Visual Release (ms)',
});

configure('stereoSpatialEnabled', {
  index: 4,
  order: 304,
  text: 'Stereo Spatialization',
});

configure('stereoSpatialStrength', {
  index: 5,
  order: 305,
  text: 'Stereo Strength',
  min: 0,
  max: 1.5,
  step: 0.05,
});

configure('spectralMemoryEnabled', {
  index: 6,
  order: 306,
  text: 'Spectral Memory',
});

configure('spectralMemoryStrength', {
  index: 7,
  order: 307,
  text: 'Spectral Memory Strength',
  min: 0,
  max: 1.5,
  step: 0.05,
});

configure('terrainCoherenceEnabled', {
  index: 8,
  order: 308,
  text: 'Terrain Coherence',
});

configure('terrainCoherenceStrength', {
  index: 9,
  order: 309,
  text: 'Terrain Coherence Strength',
  min: 0,
  max: 1.5,
  step: 0.05,
});

// ---------------------------------------------------------------------------
// Effect-Ripple
// ---------------------------------------------------------------------------
configure('sep_ripple', { order: 398, text: ' ' });
configure('sep_ripple_title', { order: 399, text: '=== Effect-Ripple ===' });
configure('pulseEnabled', { index: 0, order: 400, text: 'Enable Ripple' });
configure('pulseSensitivity', { index: 1, order: 401, text: 'Ripple Sensitivity' });
configure('pulseCooldown', { index: 2, order: 402, text: 'Ripple Cooldown (frames)' });

configure('rhythmSyncEnabled', {
  index: 3,
  order: 403,
  text: 'Beat-synced Ripples',
});

configure('beatTriggerStrength', {
  index: 4,
  order: 404,
  text: 'Beat Trigger Strength',
  min: 0.25,
  max: 2.0,
  step: 0.05,
});

// Normalize the remaining original section headings to English while keeping
// their original order and grouping.
const originalSections = [
  ['sep_meteor', 498, ' '],
  ['sep_meteor_title', 499, '=== Effect-Meteor ==='],
  ['sep_idle', 598, ' '],
  ['sep_idle_title', 599, '=== Effect-Idle Wave ==='],
  ['sep_camera', 698, ' '],
  ['sep_camera_title', 699, '=== Camera ==='],
  ['sep_player', 798, ' '],
  ['sep_player_title', 799, '=== Player ==='],
];

for (const [name, order, text] of originalSections) {
  if (properties[name]) configure(name, { order, text });
}

// Physically sort the JSON properties as well as assigning order numbers. This
// avoids odd heading placement in Wallpaper Engine builds that preserve insertion
// order for some text properties.
const sortedProperties = Object.fromEntries(
  Object.entries(properties).sort(([, a], [, b]) => {
    const aOrder = Number(a?.order ?? Number.MAX_SAFE_INTEGER);
    const bOrder = Number(b?.order ?? Number.MAX_SAFE_INTEGER);
    return aOrder - bOrder;
  }),
);
project.general.properties = sortedProperties;

project.name = 'Sonic Topography';
project.title = 'Sonic Topography';
project.description =
  '3D audio-reactive topography with rhythm analysis, stereo spatialization, spectral memory, terrain dynamics, ripples, meteors and music-reactive top accents.';
project.version = 2;
delete project.workshopid;
delete project.workshopurl;

fs.writeFileSync(projectPath, `${JSON.stringify(project, null, '\t')}\n`, 'utf8');

if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    '<title>Sonic Topography</title>',
  );
  fs.writeFileSync(htmlPath, html, 'utf8');
}

console.log('Finalized fine-grained Wallpaper Engine settings in original sections.');
