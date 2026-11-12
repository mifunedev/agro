export const CLIPBOARD_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark"><title>AGRO Clipboard</title>
<style>
:root{color-scheme:light;--paper:#f6f3ec;--raised:#eae6db;--ink:#0a0a0a;--muted:#5e5e5e;--rule:#d8d2c2;--border:#8a8375;--accent:#166534;--focus:#166534}
:root[data-theme=dark]{color-scheme:dark;--paper:#000;--raised:#0a0a0a;--ink:#f5f5f5;--muted:#a3a3a3;--rule:#262626;--border:#626262;--accent:#4ade80;--focus:#86efac}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 "Space Grotesk",system-ui,sans-serif}main{max-width:820px;margin:auto;padding:28px 24px 48px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid var(--rule);padding-bottom:16px}.brand{font:13px "JetBrains Mono",monospace;letter-spacing:.06em}h1{font:600 clamp(28px,5vw,38px)/1.2 Montserrat,system-ui,sans-serif;letter-spacing:-.035em;margin:32px 0 12px}h2{font-size:20px}p{margin:8px 0} .muted,small{color:var(--muted)}button,input,textarea{font:inherit}button{cursor:pointer;padding:10px 16px;background:var(--paper);color:var(--ink);border:1px solid var(--border);border-radius:5px;min-height:44px}button:hover:not(:disabled){border-color:var(--accent)}button:disabled{opacity:.5;cursor:not-allowed}:focus-visible{outline:3px solid var(--focus);outline-offset:3px}#drop{margin-top:24px;border:1px dashed var(--border);border-radius:8px;background:var(--raised);padding:28px 20px;text-align:center}#drop.active{outline:3px solid var(--focus)}#drop strong{display:block;font-size:20px}.actions{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin:18px 0 12px}#files{max-width:100%;margin-top:10px}#cards{padding:0;list-style:none;counter-reset:images} .card{counter-increment:images;display:grid;grid-template-columns:110px minmax(0,1fr);gap:16px;padding:18px 0;border-bottom:1px solid var(--rule)}.card img{width:110px;height:100px;object-fit:contain;background:var(--raised);border-radius:4px}.card-head{display:flex;justify-content:space-between;align-items:start;gap:12px}.name{overflow-wrap:anywhere;font-weight:600}.name:before{content:counter(images,decimal-leading-zero) " / ";font:12px "JetBrains Mono",monospace;color:var(--accent)}.remove{padding:4px 10px;font-size:14px}label{display:block;font-size:14px;margin:8px 0 5px}textarea{display:block;width:100%;resize:vertical;min-height:70px;padding:10px;border:1px solid var(--border);border-radius:4px;background:var(--paper);color:var(--ink)}.footer{display:flex;gap:20px;align-items:center;justify-content:space-between;margin-top:24px}#upload{background:#22c55e;color:#0a0a0a;font-weight:600;border-color:#22c55e}#status,#auth{overflow-wrap:anywhere;margin-top:16px}#auth:empty{display:none}progress{width:100%;accent-color:var(--accent);margin-top:12px}#result{border-top:1px solid var(--rule);margin-top:28px;padding-top:8px}#paths{padding-left:20px;overflow-wrap:anywhere;font:13px/1.6 "JetBrains Mono",monospace}#prompt{min-height:130px}#copy{margin-top:12px}.error{font-weight:600;color:var(--ink)}[hidden]{display:none!important}@media(max-width:520px){main{padding:20px 18px 36px}h1{margin-top:26px}#drop{padding:22px 12px}.card{grid-template-columns:70px minmax(0,1fr);gap:12px}.card img{width:70px;height:80px}.card-head{flex-wrap:wrap;gap:6px}.footer{align-items:start;gap:12px;flex-direction:column}#upload{width:100%}}
</style>
</head>
<body><main>
<header><span class="brand">AGRO / Mifune</span><button id="theme" type="button" aria-label="Switch to dark theme">Dark mode</button></header>
<h1>Upload from clipboard</h1><p class="muted">Add images, describe what matters, then hand them to your agent.</p>
<p id="auth" role="alert"></p>
<section id="drop" tabindex="0" aria-label="Image drop area" aria-describedby="limits"><strong>Paste or drop your images here</strong><p class="muted">Use Ctrl+V or Command+V anywhere on this page.</p><div class="actions"><button id="paste" type="button">Paste images</button><button id="choose" type="button">Choose files</button></div><label for="files">Or select image files</label><input id="files" type="file" accept="image/png,image/jpeg,image/webp" multiple><p id="limits"><small>PNG, JPEG, WebP · 10 images · 10 MiB each<br>50 MiB per batch · 2000 characters per caption</small></p></section>
<ol id="cards" aria-label="Images to upload"></ol>
<div class="footer"><span id="count" class="muted">No images selected</span><button id="upload" type="button" disabled>Upload images</button></div>
<progress id="progress" aria-label="Upload progress" hidden></progress><p id="status" role="status" aria-live="polite" aria-atomic="true">Ready for images.</p>
<section id="result" aria-labelledby="result-title" hidden><h2 id="result-title">Ready for your agent</h2><p class="muted">Files are saved in the sandbox. Your agent must open each image.</p><ul id="paths"></ul><label for="prompt">Agent prompt</label><textarea id="prompt" readonly spellcheck="false"></textarea><button id="copy" type="button">Copy agent prompt</button></section>
<noscript>Enable JavaScript to upload images.</noscript>
</main><script>
'use strict';
function validateFiles(files, existing) {
  if (existing + files.length > 10) return 'A batch can contain at most 10 images.';
  for (const file of files) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return 'Choose PNG, JPEG or WebP images only. PDF and SVG are not supported.';
    if (!file.size) return 'An image is empty. Choose a different file.';
    if (file.size > 10 * 1024 * 1024) return 'Each image must be 10 MiB or smaller.';
  }
  return '';
}
function validateCards(cards, json) {
  if (!cards.length || cards.length > 10) return 'Choose between 1 and 10 images.';
  if (cards.some(card => card.caption.length > 2000)) return 'Each caption must contain at most 2000 characters.';
  if (new TextEncoder().encode(json).byteLength > 50 * 1024 * 1024) return 'The encoded batch exceeds 50 MiB. Remove an image and retry.';
  return '';
}
function removeCard(cards, id, revoke) {
  return cards.filter(card => { if (card.id !== id) return true; revoke(card.url); return false; });
}
function readToken(location, history, storage) {
  const key = 'agro-clipboard-token:' + location.origin;
  const fragment = location.hash;
  if (fragment) history.replaceState(null, '', location.pathname + location.search);
  if (fragment) {
    const match = /^#token=([a-f0-9]{64})$/i.exec(fragment);
    const token = match ? match[1] : '';
    try { if (token) storage.setItem(key, token); else storage.removeItem(key); } catch {}
    return token;
  }
  try { const stored = storage.getItem(key) || ''; return /^[a-f0-9]{64}$/i.test(stored) ? stored : ''; } catch { return ''; }
}
function chooseTheme(stored, dark) { return stored === 'light' || stored === 'dark' ? stored : dark ? 'dark' : 'light'; }
function textElement(document, tag, value) { const node = document.createElement(tag); node.textContent = value; return node; }
if (typeof document !== 'undefined') initializeClipboard();
function initializeClipboard() {
  const $ = id => document.getElementById(id);
  let session;
  try { session = window.sessionStorage; } catch {}
  let token = readToken(location, history, session);
  let storedTheme;
  try { storedTheme = localStorage.getItem('agro-clipboard-theme'); } catch {}
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  let explicitTheme = storedTheme === 'light' || storedTheme === 'dark';
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    $('theme').textContent = next === 'dark' ? 'Dark mode' : 'Light mode';
    $('theme').setAttribute('aria-label', 'Switch to ' + next + ' theme');
  }
  applyTheme(chooseTheme(storedTheme, media.matches));
  media.addEventListener('change', event => { if (!explicitTheme) applyTheme(chooseTheme(null, event.matches)); });
  $('theme').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    explicitTheme = true;
    applyTheme(next);
    try { localStorage.setItem('agro-clipboard-theme', next); } catch {}
  };
  let cards = [];
  let busy = false;
  function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
  function update() {
    $('count').textContent = cards.length ? cards.length + ' / 10 images' : 'No images selected';
    $('upload').disabled = busy || !token || !cards.length;
    $('files').disabled = busy;
    $('paste').disabled = busy;
    $('choose').disabled = busy;
    for (const node of $('cards').querySelectorAll('button, textarea')) node.disabled = busy;
  }
  function showAuth() { $('auth').textContent = token ? '' : 'Access token missing or invalid. Run agro clipboard start in this project and open its full link in this tab. Upload is disabled.'; }
  showAuth();
  window.addEventListener('hashchange', () => { token = readToken(location, history, session); showAuth(); update(); status(token ? 'Access updated. Your images and captions are ready.' : 'Open the full link from agro clipboard start.', !token); });
  function render() {
    $('cards').replaceChildren();
    for (const card of cards) {
      const item = textElement(document, 'li', ''); item.className = 'card';
      const image = document.createElement('img'); image.src = card.url; image.alt = 'Preview of ' + card.file.name;
      const detail = document.createElement('div');
      const head = document.createElement('div'); head.className = 'card-head';
      const name = textElement(document, 'span', card.file.name); name.className = 'name';
      const remove = textElement(document, 'button', 'Remove'); remove.className = 'remove'; remove.type = 'button'; remove.setAttribute('aria-label', 'Remove ' + card.file.name);
      remove.onclick = () => { cards = removeCard(cards, card.id, url => URL.revokeObjectURL(url)); render(); status('Image removed.'); $('choose').focus(); };
      head.append(name, remove);
      const meta = textElement(document, 'small', card.file.type.replace('image/', '').toUpperCase() + ' · ' + (card.file.size / 1024).toFixed(1) + ' KiB');
      const label = textElement(document, 'label', 'Caption (optional)'); label.htmlFor = 'caption-' + card.id;
      const caption = document.createElement('textarea'); caption.id = label.htmlFor; caption.maxLength = 2000; caption.rows = 2; caption.value = card.caption; caption.placeholder = 'What should your agent notice?';
      caption.oninput = () => { card.caption = caption.value; };
      detail.append(head, meta, label, caption); item.append(image, detail); $('cards').append(item);
    }
    update();
  }
  function add(files) {
    if (busy) { status('Wait for this upload before adding images.'); return; }
    files = Array.from(files);
    if (!files.length) { status('No image found. Copy an image, then press Ctrl+V or Command+V, or choose a file.', true); return; }
    const error = validateFiles(files, cards.length);
    if (error) { status(error, true); return; }
    for (const file of files) cards.push({ id: crypto.randomUUID(), file, caption: '', url: URL.createObjectURL(file) });
    render(); status(files.length + ' image(s) added. Captions stay with each image.');
  }
  function transferFiles(transfer) {
    if (transfer.files && transfer.files.length) return Array.from(transfer.files);
    return Array.from(transfer.items || []).filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean);
  }
  document.addEventListener('paste', event => {
    const files = event.clipboardData ? transferFiles(event.clipboardData) : [];
    if (files.length) { event.preventDefault(); add(files); }
  });
  $('choose').onclick = () => $('files').click();
  $('files').onchange = () => { add($('files').files); $('files').value = ''; };
  for (const name of ['dragenter', 'dragover']) $('drop').addEventListener(name, event => { event.preventDefault(); $('drop').classList.add('active'); });
  $('drop').addEventListener('dragleave', () => $('drop').classList.remove('active'));
  document.addEventListener('dragover', event => event.preventDefault());
  document.addEventListener('drop', event => { event.preventDefault(); $('drop').classList.remove('active'); add(transferFiles(event.dataTransfer)); });
  $('paste').onclick = async () => {
    if (!navigator.clipboard || !navigator.clipboard.read) { status('Press Ctrl+V or Command+V to paste an image, or choose files.', true); return; }
    try {
      const files = [];
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find(type => ['image/png', 'image/jpeg', 'image/webp'].includes(type));
        if (type) files.push(new File([await item.getType(type)], 'clipboard-' + (files.length + 1) + '.' + type.split('/')[1], { type }));
      }
      add(files);
    } catch { status('Clipboard permission unavailable. Press Ctrl+V or Command+V to paste, or choose files.', true); }
  };
  function encode(file) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Unable to read an image. Choose the file again.')); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file); });
  }
  function send(json) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/batches'); xhr.setRequestHeader('Content-Type', 'application/json'); xhr.setRequestHeader('Authorization', 'Bearer ' + token); xhr.timeout = 120000;
      xhr.upload.onprogress = event => { if (event.lengthComputable) { $('progress').max = event.total; $('progress').value = event.loaded; status(event.loaded === event.total ? 'Upload sent. Saving images…' : 'Uploading ' + Math.floor(event.loaded / event.total * 100) + '% of request…'); } };
      xhr.upload.onload = () => { $('progress').removeAttribute('value'); status('Upload sent. Saving images…'); };
      xhr.onerror = () => reject(new Error('Network error. Your images and captions are preserved. Retry when connected.'));
      xhr.ontimeout = () => reject(new Error('Upload timed out. Your images and captions are preserved. Check the service before retrying.'));
      xhr.onload = () => {
        let result; try { result = JSON.parse(xhr.responseText); } catch { reject(new Error('Invalid service response. Your images and captions are preserved.')); return; }
        if (xhr.status === 401) reject(new Error('Access expired. Run agro clipboard start and open its full link in this same tab. Your images and captions are preserved.'));
        else if (xhr.status < 200 || xhr.status >= 300) reject(new Error(typeof result.error === 'string' ? result.error : 'Upload failed. Your images and captions are preserved.'));
        else resolve(result);
      };
      xhr.send(json);
    });
  }
  $('upload').onclick = async () => {
    if (busy || !token || !cards.length) return;
    busy = true; update(); $('progress').hidden = false; $('progress').removeAttribute('value'); status('Preparing images…');
    try {
      const images = [];
      for (const card of cards) images.push({ name: card.file.name, mimeType: card.file.type, data: await encode(card.file), caption: card.caption });
      const json = JSON.stringify({ images });
      const error = validateCards(cards, json); if (error) throw new Error(error);
      status('Uploading images…');
      const result = await send(json);
      if (typeof result.manifestPath !== 'string' || typeof result.prompt !== 'string' || !Array.isArray(result.images) || result.images.some(image => typeof image.path !== 'string')) throw new Error('Invalid service response. Your images and captions are preserved.');
      $('paths').replaceChildren(textElement(document, 'li', result.manifestPath));
      for (const image of result.images) $('paths').append(textElement(document, 'li', image.path));
      $('prompt').value = result.prompt; $('result').hidden = false;
      for (const card of cards) URL.revokeObjectURL(card.url);
      cards = []; render(); status('Upload complete. Copy the prompt to your image-capable agent.'); $('copy').focus();
    } catch (error) { status(error instanceof Error ? error.message : 'Upload failed. Retry with your images still selected.', true); }
    finally { busy = false; $('progress').hidden = true; update(); }
  };
  $('copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('prompt').value); status('Agent prompt copied.'); }
    catch { $('prompt').focus(); $('prompt').select(); status('Copy unavailable. The prompt is selected; press Ctrl+C or Command+C.'); }
  };
  update();
}
</script></body></html>`;
