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
configure('themeCycleInterval', {
  index: 1,
  order: 201,
  text: 'Cycle Interval (s)',
  step: 5,
});
configure('peakColorEnabled', { index: 2, order: 202, text: 'Peak Color' });
configure('peakColorIntensity', {
  index: 3,
  order: 203,
  text: 'Peak Color Intensity',
  step: 0.05,
});

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
  value: 0.006,
  min: 0.0005,
  max: 0.05,
  step: 0.0005,
});

configure('topAccentIntensity', {
  index: 9,
  order: 209,
  text: 'Accent Strength',
  min: 0,
  max: 1.5,
  step: 0.025,
});

// ---------------------------------------------------------------------------
// Audio Response
// ---------------------------------------------------------------------------
configure('sep_audio', { order: 298, text: ' ' });
configure('sep_audio_title', { order: 299, text: '=== Audio Response ===' });
configure('audioIntensity', {
  index: 0,
  order: 300,
  text: 'Audio Intensity',
  step: 0.05,
});
configure('responseRange', {
  index: 1,
  order: 301,
  text: 'Response Range',
  step: 0.05,
});

configure('visualAttackMs', {
  index: 2,
  order: 302,
  text: 'Visual Attack (ms)',
  step: 2,
});

configure('visualReleaseMs', {
  index: 3,
  order: 303,
  text: 'Visual Release (ms)',
  step: 5,
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
  step: 0.025,
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
  step: 0.025,
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
  step: 0.025,
});

// ---------------------------------------------------------------------------
// Effect-Ripple
// ---------------------------------------------------------------------------
configure('sep_ripple', { order: 398, text: ' ' });
configure('sep_ripple_title', { order: 399, text: '=== Effect-Ripple ===' });
configure('pulseEnabled', { index: 0, order: 400, text: 'Enable Ripple' });
configure('pulseSensitivity', {
  index: 1,
  order: 401,
  text: 'Ripple Sensitivity',
  step: 0.005,
});
configure('pulseCooldown', {
  index: 2,
  order: 402,
  text: 'Ripple Cooldown (frames)',
  step: 1,
});

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
  step: 0.025,
});

// ---------------------------------------------------------------------------
// Effect-Meteor
// ---------------------------------------------------------------------------
configure('sep_meteor', { order: 498, text: ' ' });
configure('sep_meteor_title', { order: 499, text: '=== Effect-Meteor ===' });
if (properties.meteorEnabled) {
  configure('meteorEnabled', { index: 0, order: 500, text: 'Enable Meteor' });
}
if (properties.meteorSensitivity) {
  configure('meteorSensitivity', {
    index: 1,
    order: 501,
    text: 'Meteor Sensitivity',
    step: 0.01,
  });
}
if (properties.meteorCooldown) {
  configure('meteorCooldown', {
    index: 2,
    order: 502,
    text: 'Meteor Cooldown (frames)',
    step: 1,
  });
}
if (properties.meteorClickEnabled) {
  configure('meteorClickEnabled', { index: 3, order: 503, text: 'Click Meteor' });
}

// ---------------------------------------------------------------------------
// Effect-Idle Wave
// ---------------------------------------------------------------------------
configure('sep_idle', { order: 598, text: ' ' });
configure('sep_idle_title', { order: 599, text: '=== Effect-Idle Wave ===' });
if (properties.idleWaveEnabled) {
  configure('idleWaveEnabled', { index: 0, order: 600, text: 'Idle Wave' });
}
if (properties.idleWaveDebounce) {
  configure('idleWaveDebounce', {
    index: 1,
    order: 601,
    text: 'Idle Debounce (s)',
    step: 0.1,
  });
}
if (properties.idleWaveFadeDuration) {
  configure('idleWaveFadeDuration', {
    index: 2,
    order: 602,
    text: 'Idle Fade (s)',
    step: 0.1,
  });
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
configure('sep_camera', { order: 698, text: ' ' });
configure('sep_camera_title', { order: 699, text: '=== Camera ===' });
if (properties.cameraDistance) {
  configure('cameraDistance', {
    index: 0,
    order: 700,
    text: 'Camera Distance',
    step: 1,
  });
}
if (properties.cameraAngleX) {
  configure('cameraAngleX', {
    index: 1,
    order: 701,
    text: 'Horizontal Angle',
    step: 1,
  });
}
if (properties.cameraAngleY) {
  configure('cameraAngleY', {
    index: 2,
    order: 702,
    text: 'Vertical Angle',
    step: 1,
  });
}
if (properties.autoRotateEnabled) {
  configure('autoRotateEnabled', { index: 3, order: 703, text: 'Auto Rotate' });
}
if (properties.autoRotateSpeed) {
  configure('autoRotateSpeed', {
    index: 4,
    order: 704,
    text: 'Rotate Speed',
    step: 0.5,
  });
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
configure('sep_player', { order: 798, text: ' ' });
configure('sep_player_title', { order: 799, text: '=== Player ===' });
if (properties.showPlayerController) {
  configure('showPlayerController', { index: 0, order: 800, text: 'Show Player' });
}
if (properties.showAlbumCover) {
  configure('showAlbumCover', { index: 1, order: 801, text: 'Show Album Cover' });
}
if (properties.controllerSize) {
  configure('controllerSize', { index: 2, order: 802, text: 'Controller Size' });
}
if (properties.controllerX) {
  configure('controllerX', {
    index: 3,
    order: 803,
    text: 'Controller X (%)',
    step: 0.5,
  });
}
if (properties.controllerY) {
  configure('controllerY', {
    index: 4,
    order: 804,
    text: 'Controller Y (%)',
    step: 0.5,
  });
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

console.log('Finalized fine-grained Wallpaper Engine settings with refined slider steps.');