import fs from 'node:fs';
import path from 'node:path';

const publicRoot = path.dirname(new URL(import.meta.url).pathname);
const sourceRoot = path.resolve(publicRoot, '..');
const distRoot = path.join(publicRoot, 'dist');

const hiddenExperimentPromptIds = new Set([
  'carepod-jp-square-to-4x5-base-v1',
  'carepod-jp-family-night-4x5-v1',
  'carepod-jp-bedtime-night-v1',
  'carepod-jp-bedtime-blue-v1',
  'carepod-jp-bedtime-night-1-91-v1',
  'carepod-jp-bedtime-night-9x16-v1',
  'carepod-jp-bedtime-night-3x2-color-match',
  'carepod-jp-bedtime-night-4x5-color-match',
  'fricy-fruit-rollup-snack-base-v1',
  'fricy-spicy-fruit-bowl-green-grape-v1',
  'jinro-spicy-fruit-overhead-hero-base-v1',
  'the-saem-primer-copy-vertical-base-v1',
  'the-saem-triple-pot-video-copy-final-v1',
  'the-saem-silicone-zero-primer-promo-final-v1',
  'the-saem-summer-cover-promo-final-v1',
  'jp-family-humidifier-lifestyle-clean-final-v1',
]);

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(distRoot, { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js']) {
  fs.copyFileSync(path.join(sourceRoot, file), path.join(distRoot, file));
}
fs.writeFileSync(path.join(distRoot, '.nojekyll'), '');

const prompts = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'data/prompts.json'), 'utf8'));
const previewImages = new Set();

for (const prompt of prompts.prompts) {
  if (prompt.source?.url?.startsWith('file:///')) delete prompt.source.url;
  if (!prompt.previewImage) continue;
  previewImages.add(prompt.previewImage);
  const source = path.join(sourceRoot, prompt.previewImage);
  const destination = path.join(distRoot, prompt.previewImage);
  if (!fs.existsSync(source)) throw new Error(`Missing preview image: ${prompt.previewImage}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

const experiments = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'data/experiments.json'), 'utf8'));
const publicExperiments = {
  ...experiments,
  experiments: experiments.experiments.filter(
    (experiment) =>
      experiment.publishToSite !== false &&
      !hiddenExperimentPromptIds.has(experiment.promptId),
  ),
};
for (const experiment of publicExperiments.experiments) {
  if (experiment.image && !previewImages.has(experiment.image)) delete experiment.image;
  if (experiment.finalImage && !previewImages.has(experiment.finalImage)) delete experiment.finalImage;
}

fs.mkdirSync(path.join(distRoot, 'data'), { recursive: true });
fs.writeFileSync(path.join(distRoot, 'data/prompts.json'), `${JSON.stringify(prompts, null, 2)}\n`);
fs.writeFileSync(path.join(distRoot, 'data/experiments.json'), `${JSON.stringify(publicExperiments, null, 2)}\n`);

console.log(`Prepared ${prompts.prompts.length} public prompts and ${previewImages.size} preview images.`);
