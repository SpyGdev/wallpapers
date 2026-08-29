const previewSelect = document.querySelector('#preview-select');
const fileInput = document.querySelector('#file-input');
const dropzone = document.querySelector('#dropzone');
const video = document.querySelector('#video');
const sourceStatus = document.querySelector('#source-status');
const metadata = document.querySelector('#metadata');
const startInput = document.querySelector('#start');
const endInput = document.querySelector('#end');
const widthInput = document.querySelector('#width');
const fpsInput = document.querySelector('#fps');
const qualityInput = document.querySelector('#quality');
const loopInput = document.querySelector('#loop');
const estimate = document.querySelector('#estimate');
const convertButton = document.querySelector('#convert');
const cancelButton = document.querySelector('#cancel');
const progress = document.querySelector('#progress');
const conversionStatus = document.querySelector('#conversion-status');
const result = document.querySelector('#result');
const gifPreview = document.querySelector('#gif-preview');
const resultDetails = document.querySelector('#result-details');
const download = document.querySelector('#download');

let sourceUrl = '';
let sourceName = 'preview';
let outputUrl = '';
let generation = 0;
let activeConversion = null;

const setStatus = (message, error = false) => {
  sourceStatus.textContent = message;
  sourceStatus.classList.toggle('error', error);
};

function clearOutput() {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = '';
  result.hidden = true;
  gifPreview.removeAttribute('src');
  download.removeAttribute('href');
}

function setSource(url, name) {
  activeConversion?.abort();
  generation += 1;
  clearOutput();
  if (sourceUrl.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
  sourceUrl = url;
  sourceName = name.replace(/\.[^.]+$/, '') || 'preview';
  video.pause();
  video.src = url;
  video.load();
  metadata.hidden = true;
  convertButton.disabled = true;
  setStatus(`Loading ${name}…`);
}

function updateEstimate() {
  const duration = Number(video.duration);
  const start = Number(startInput.value);
  const end = Number(endInput.value);
  const fps = Number(fpsInput.value);
  if (!Number.isFinite(duration) || !duration) return;
  const frames = Math.ceil(Math.max(0, end - start) * fps);
  estimate.textContent = `${frames} frames · ${Math.max(0, end - start).toFixed(1)} seconds · GIFs work best under 300 frames.`;
}

function validateSettings() {
  const duration = Number(video.duration);
  const start = Number(startInput.value);
  const end = Number(endInput.value);
  const width = Number(widthInput.value);
  const frames = Math.ceil((end - start) * Number(fpsInput.value));
  const valid = Number.isFinite(duration) && start >= 0 && end > start && end <= duration + 0.05 && width >= 64 && width <= 480 && frames <= 300;
  convertButton.disabled = !valid;
  updateEstimate();
  return valid;
}

async function loadManifest() {
  try {
    const response = await fetch('manifest.json');
    if (!response.ok) throw new Error('manifest request failed');
    const manifest = await response.json();
    previewSelect.replaceChildren(new Option('Select a repository preview…', ''));
    for (const file of manifest.previews) {
      const option = new Option(file.replace(/\.[^.]+$/, '').replaceAll('_', ' '), file);
      previewSelect.append(option);
    }
  } catch {
    previewSelect.replaceChildren(new Option('Could not load previews', ''));
    setStatus('The preview catalog could not be loaded.', true);
  }
}

video.addEventListener('loadedmetadata', () => {
  const duration = video.duration;
  startInput.value = '0';
  endInput.value = duration.toFixed(2);
  metadata.textContent = `${video.videoWidth} × ${video.videoHeight} · ${duration.toFixed(2)} seconds`;
  metadata.hidden = false;
  setStatus(`${sourceName} is ready.`);
  validateSettings();
});
video.addEventListener('canplay', validateSettings);
video.addEventListener('error', () => {
  convertButton.disabled = true;
  setStatus('This browser cannot decode this video. Try Safari or upload an H.264 MP4/WebM copy.', true);
});
[ startInput, endInput, widthInput, fpsInput ].forEach((input) => input.addEventListener('input', validateSettings));

previewSelect.addEventListener('change', () => {
  if (!previewSelect.value) return;
  setSource(`previews/${encodeURIComponent(previewSelect.value)}`, previewSelect.value);
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) setSource(URL.createObjectURL(file), file.name);
});
dropzone.addEventListener('click', (event) => { if (event.target.tagName !== 'LABEL') fileInput.click(); });
dropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') fileInput.click(); });
dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('dragging'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  const file = event.dataTransfer.files?.[0];
  if (file?.type.startsWith('video/') || /\.(mov|mp4|webm)$/i.test(file?.name || '')) setSource(URL.createObjectURL(file), file.name);
  else setStatus('Please drop a MOV, MP4, or WebM video.', true);
});

function seek(videoElement, time, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Cancelled', 'AbortError'));
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Video seek timed out.')); }, 10000);
    const cleanup = () => { clearTimeout(timeout); videoElement.removeEventListener('seeked', onSeeked); signal.removeEventListener('abort', onAbort); };
    const onSeeked = () => { cleanup(); resolve(); };
    const onAbort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    videoElement.addEventListener('seeked', onSeeked, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
    videoElement.currentTime = time;
  });
}

async function convert() {
  if (!validateSettings() || !window.GIF) return;
  const run = ++generation;
  const controller = new AbortController();
  activeConversion = controller;
  cancelButton.hidden = false;
  convertButton.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  conversionStatus.textContent = 'Preparing frames…';
  clearOutput();
  const fps = Number(fpsInput.value);
  const start = Number(startInput.value);
  const end = Number(endInput.value);
  const width = Number(widthInput.value);
  const height = Math.max(1, Math.round(width * video.videoHeight / video.videoWidth));
  const frames = Math.ceil((end - start) * fps);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  const gif = new GIF({ workers: 2, quality: Number(qualityInput.value), width, height, repeat: loopInput.checked ? 0 : -1, workerScript: new URL('../vendor/gif.worker.js', import.meta.url).href });
  cancelButton.onclick = () => controller.abort();
  try {
    for (let index = 0; index < frames; index += 1) {
      if (controller.signal.aborted || run !== generation) throw new DOMException('Cancelled', 'AbortError');
      await seek(video, Math.min(end, start + index / fps), controller.signal);
      context.drawImage(video, 0, 0, width, height);
      gif.addFrame(canvas, { copy: true, delay: Math.round(1000 / fps) });
      progress.value = Math.round((index + 1) / frames * 60);
      conversionStatus.textContent = `Capturing frame ${index + 1} of ${frames}…`;
    }
    gif.on('progress', (value) => { progress.value = 60 + Math.round(value * 40); conversionStatus.textContent = `Encoding GIF… ${Math.round(value * 100)}%`; });
    const blob = await new Promise((resolve, reject) => { gif.on('finished', resolve); gif.on('error', reject); gif.render(); });
    if (controller.signal.aborted || run !== generation) throw new DOMException('Cancelled', 'AbortError');
    outputUrl = URL.createObjectURL(blob);
    gifPreview.src = outputUrl;
    download.href = outputUrl;
    download.download = `${sourceName.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'preview'}.gif`;
    resultDetails.textContent = `${width} × ${height} · ${frames} frames · ${(blob.size / 1024 / 1024).toFixed(2)} MB`;
    result.hidden = false;
    progress.value = 100;
    conversionStatus.textContent = 'GIF ready.';
  } catch (error) {
    conversionStatus.textContent = error.name === 'AbortError' ? 'Conversion cancelled.' : `Conversion failed: ${error.message}`;
  } finally {
    if (activeConversion === controller) activeConversion = null;
    cancelButton.hidden = true;
    convertButton.disabled = false;
    validateSettings();
  }
}
convertButton.addEventListener('click', convert);
loadManifest();
