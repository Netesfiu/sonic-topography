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

// Keep the enhanced processing internally, but expose only controls that make a
// clear visual difference. This keeps the panel close to the upstream layout.
const hiddenTechnicalProperties = [
  'sep_enhanced_audio',
  'sep_enhanced_audio_title',
  'sep_top_accent',
  'sep_top_accent_title',
  'beatTriggerStrength',
  'topAccentDensity',
  'topAccentIntensity',
  'visualAttackMs',
  'visualReleaseMs',
  'spectralMemoryEnabled',
  'spectralMemoryStrength',
  'stereoSpatialStrength',
  'terrainCoherenceEnabled',
  'terrainCoherenceStrength',
  'membraneStrength',
  'sparkleIntensity',
];

for (const name of hiddenTechnicalProperties) {
  delete properties[name];
}

function configure(name, config) {
  const property = properties[name];
  if (!property) {
    throw new Error(`Expected generated property is missing: ${name}`);
  }
  Object.assign(property, config);
}

// Appearance: extend the original theme/peak-color controls instead of adding a
// separate "enhanced" section.
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

// Audio Response: only the two large-scale spatial/physical choices remain.
configure('stereoSpatialEnabled', {
  index: 2,
  order: 302,
  text: 'Stereo Spatialization',
});

configure('membraneEnabled', {
  index: 3,
  order: 303,
  text: 'Rubber Membrane Center',
});

// Ripple: beat synchronization belongs beside the original ripple controls.
configure('rhythmSyncEnabled', {
  index: 3,
  order: 403,
  text: 'Beat-synced Ripples',
});

// User-facing identity should stay close to the upstream project. Keep the
// Workshop identity removed so this local build cannot impersonate the original.
project.name = 'Sonic Topography';
project.title = 'Sonic Topography';
project.description =
  '3D audio-reactive topography with synchronized rhythm response, stereo spatialization, ripples, meteors and music-reactive color accents.';
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

console.log('Finalized Wallpaper Engine settings panel.');
