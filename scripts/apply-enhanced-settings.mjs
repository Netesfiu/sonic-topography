import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mainPath = path.join(root, 'wallpaper', 'main.tsx');
const projectPath = path.join(root, 'wallpaper', 'project.json');

if (!fs.existsSync(mainPath) || !fs.existsSync(projectPath)) {
  throw new Error('Run this script from the sonic-topography repository root.');
}

let main = fs.readFileSync(mainPath, 'utf8');

const enhancedHandlerMarker = 'properties.rhythmSyncEnabled?.value';
if (!main.includes(enhancedHandlerMarker)) {
  const anchor = `    if (properties.themeCycleInterval?.value !== undefined) {\n      setThemeCycleInterval(properties.themeCycleInterval.value as number);\n    }\n`;

  if (!main.includes(anchor)) {
    throw new Error('Could not locate the Wallpaper Engine property-handler insertion point.');
  }

  const enhancedHandlers = `${anchor}    // Enhanced v2 audio controls\n    if (properties.rhythmSyncEnabled?.value !== undefined) {\n      engine.rhythmSyncEnabled = properties.rhythmSyncEnabled.value as boolean;\n    }\n    if (properties.beatTriggerStrength?.value !== undefined) {\n      engine.beatTriggerStrength = Math.max(0, Number(properties.beatTriggerStrength.value));\n    }\n    if (properties.sparkleIntensity?.value !== undefined) {\n      engine.sparkleIntensity = Math.max(0, Math.min(1, Number(properties.sparkleIntensity.value)));\n    }\n    if (properties.visualAttackMs?.value !== undefined) {\n      engine.visualAttack = Math.max(0.005, Number(properties.visualAttackMs.value) / 1000);\n    }\n    if (properties.visualReleaseMs?.value !== undefined) {\n      engine.visualRelease = Math.max(0.01, Number(properties.visualReleaseMs.value) / 1000);\n    }\n`;

  main = main.replace(anchor, enhancedHandlers);
  fs.writeFileSync(mainPath, main, 'utf8');
  console.log('[enhanced-v2] Wired enhanced settings into wallpaper/main.tsx');
} else {
  console.log('[enhanced-v2] main.tsx already contains enhanced settings handlers');
}

const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
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
    text: '===增强音频 / Enhanced Audio v2===',
    type: 'text',
    value: '',
  },
  rhythmSyncEnabled: {
    index: 0,
    order: 350,
    text: '节奏同步 / Rhythm Sync',
    type: 'bool',
    value: true,
  },
  beatTriggerStrength: {
    index: 1,
    order: 351,
    text: '节拍触发强度 / Beat Trigger Strength',
    type: 'slider',
    value: 1.0,
    min: 0.25,
    max: 2.0,
    step: 0.05,
  },
  sparkleIntensity: {
    index: 2,
    order: 352,
    text: '高频闪烁 / Sparkle Intensity',
    type: 'slider',
    value: 0.12,
    min: 0,
    max: 1,
    step: 0.05,
  },
  visualAttackMs: {
    index: 3,
    order: 353,
    text: '响应上升 (ms) / Visual Attack (ms)',
    type: 'slider',
    value: 45,
    min: 10,
    max: 150,
    step: 5,
  },
  visualReleaseMs: {
    index: 4,
    order: 354,
    text: '响应衰减 (ms) / Visual Release (ms)',
    type: 'slider',
    value: 160,
    min: 50,
    max: 500,
    step: 10,
  },
});

// A local fork should not impersonate the upstream Workshop item. Keeping the
// upstream Workshop ID can make Wallpaper Engine reuse metadata/property state.
project.name = 'Sonic Topography Enhanced v2';
project.title = 'Sonic Topography Enhanced v2';
project.version = 2;
delete project.workshopid;
delete project.workshopurl;

fs.writeFileSync(projectPath, `${JSON.stringify(project, null, '\t')}\n`, 'utf8');
console.log('[enhanced-v2] Added Enhanced Audio v2 controls to wallpaper/project.json');
console.log('[enhanced-v2] Removed upstream Workshop identity from the local build metadata');
