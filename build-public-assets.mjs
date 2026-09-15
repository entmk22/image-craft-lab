import fs from 'node:fs';
import path from 'node:path';

const publicRoot = path.dirname(new URL(import.meta.url).pathname);
const sourceRoot = path.resolve(publicRoot, '..');
const distRoot = path.join(publicRoot, 'dist');

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
for (const experiment of experiments.experiments) {
  if (experiment.image && !previewImages.has(experiment.image)) delete experiment.image;
  if (experiment.finalImage && !previewImages.has(experiment.finalImage)) delete experiment.finalImage;
}

fs.mkdirSync(path.join(distRoot, 'data'), { recursive: true });
fs.writeFileSync(path.join(distRoot, 'data/prompts.json'), `${JSON.stringify(prompts, null, 2)}\n`);
fs.writeFileSync(path.join(distRoot, 'data/experiments.json'), `${JSON.stringify(experiments, null, 2)}\n`);

console.log(`Prepared ${prompts.prompts.length} public prompts and ${previewImages.size} preview images.`);
