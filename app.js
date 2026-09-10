const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const STORAGE_KEY = 'juwai-saved-v1';
const state = { tone: '克制', input: '', image: null, results: [], currentCardText: '' };

// Shared vocabulary for the local demo and the future RAG/LLM service.
// Keep these labels stable: they are persisted with saved sentences and used by API filters.
const CONTENT_TAXONOMY = Object.freeze({
  contentTypes: Object.freeze(['电影', '文学', '诗歌', '歌词', '网络表达', 'AI 原创']),
  emotions: Object.freeze(['治愈', '浪漫', '孤独', '自由', '悲伤', '松弛', '热烈', '克制', '幽默']),
  scenes: Object.freeze(['旅行', '生日', '毕业', '恋爱', '失恋', '朋友', '工作', '日常', '节日'])
});

const resultSets = {
  travel: [
    ['把风装进口袋，剩下的路，慢慢走。', 'AI 原创', '给一段刚刚好的出发'],
    ['海风经过的时候，城市暂时与我无关。', 'AI 原创', '轻盈 · 松弛'],
    ['去看没有看过的天，也把自己还给自己。', 'AI 原创', '自由 · 旅行'],
    ['这一页没有目的地，只有抵达时的风。', 'AI 原创', '克制 · 远方'],
    ['日落不问赶路人，黄昏自会留下答案。', 'AI 原创', '温柔 · 风景'],
    ['我在陌生的地方，练习成为熟悉的自己。', 'AI 原创', '成长 · 旅行']
  ],
  graduation: [
    ['我们把告别说得轻一点，好让未来听见。', 'AI 原创', '给毕业后的我们'],
    ['这一站先到这里，故事还会在别处继续。', 'AI 原创', '克制 · 告别'],
    ['青春不是答案，是我们一起走过的提问。', 'AI 原创', '成长 · 纪念'],
    ['愿你带着今天的光，去往更远的地方。', 'AI 原创', '祝福 · 远方'],
    ['原来所谓毕业，是把并肩写成了各自的明天。', 'AI 原创', '温柔 · 离开'],
    ['我们不说再见，因为每一次出发都在相遇。', 'AI 原创', '热烈 · 期待']
  ],
  like: [
    ['我把喜欢放在句尾，等你自己读懂。', 'AI 原创', '克制 · 心动'],
    ['有一点靠近，有一点不说破，刚好。', 'AI 原创', '暧昧 · 轻盈'],
    ['见到你的时候，普通的日子忽然有了回声。', 'AI 原创', '温柔 · 心动'],
    ['我没有在等谁，只是刚好希望那个人是你。', 'AI 原创', '克制 · 喜欢'],
    ['风很轻，话也很轻，喜欢却不是。', 'AI 原创', '浪漫 · 留白'],
    ['如果你也听见了，就把沉默留给我。', 'AI 原创', '含蓄 · 期待']
  ],
  hard: [
    ['今天先不必成为更好的人，做回自己就很好。', 'AI 原创', '给有点累的你'],
    ['你已经走了很远，允许自己停在这里。', 'AI 原创', '治愈 · 松弛'],
    ['情绪没有迟到，它只是需要一点时间抵达。', 'AI 原创', '温柔 · 自我'],
    ['先把今天过完，答案会在明天长出来。', 'AI 原创', '克制 · 安心'],
    ['生活没有催促你，只有钟表在自言自语。', 'AI 原创', '松弛 · 日常'],
    ['你不必解释风的方向，走自己的路就好。', 'AI 原创', '自由 · 坚定']
  ]
};

function getSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function setSaved(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); updateSavedView(); }
function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200); }

function navigate(view) {
  $$('.view').forEach(section => section.classList.toggle('active-view', section.id === `view-${view}`));
  $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'saved') updateSavedView();
}

function infer(input) {
  const text = input.toLowerCase();
  if (/毕业|离开|学校|论文|同学/.test(text)) return { key: 'graduation', scene: '毕业 / 告别', mood: '舍不得里带着期待', tags: ['告别', '成长'], emotionTags: ['悲伤', '自由'], sceneTags: ['毕业'], state: '一段正在告别、也准备出发的时刻' };
  if (/喜欢|心动|暧昧|暗恋|想他|想她/.test(text)) return { key: 'like', scene: '关系 / 心动', mood: '含蓄而明亮', tags: ['心动', '克制'], emotionTags: ['浪漫', '克制'], sceneTags: ['恋爱'], state: '一段想靠近、又想保留余地的心情' };
  if (/海|旅行|旅行|日落|照片|风景|山|夏天|出发|远方/.test(text)) return { key: 'travel', scene: '旅行 / 风景', mood: '轻盈、想被看见', tags: ['松弛', '远方'], emotionTags: ['自由', '松弛'], sceneTags: ['旅行'], state: '一段轻盈、想被看见的时刻' };
  if (/累|难过|失望|焦虑|压力|崩溃|孤独|迷茫/.test(text)) return { key: 'hard', scene: '日常 / 自我', mood: '需要一点安静的安慰', tags: ['治愈', '松弛'], emotionTags: ['治愈', '孤独'], sceneTags: ['日常'], state: '一段需要被轻轻接住的时刻' };
  return { key: 'hard', scene: '日常 / 此刻', mood: state.tone === '热烈' ? '明亮而有力量' : '克制、留有余地', tags: [state.tone, '原创'], emotionTags: [state.tone], sceneTags: ['日常'], state: '一段还没有被命名、但值得被说出的心情' };
}

function createResults() {
  const context = infer(state.input);
  const source = resultSets[context.key];
  state.results = source.map((item, index) => ({
    id: `${Date.now()}-${index}`,
    text: item[0],
    type: item[1],
    contentType: item[1],
    source: item[2],
    featured: index === 1,
    scene: context.scene,
    emotionTags: context.emotionTags,
    sceneTags: context.sceneTags,
    copyrightStatus: item[1] === 'AI 原创' ? 'AI Generated' : 'Unverified'
  }));
  $('#results-title').textContent = `给这段心情，六种说法。`;
  $('#results-summary').textContent = `${context.scene} · ${context.mood} · 已为你保留一点余地`;
  $('#understood-text').textContent = context.state;
  $('#understood-tags').innerHTML = context.tags.map(tag => `<span>${tag}</span>`).join('');
  $('#results-grid').innerHTML = state.results.map((item, index) => `<article class="result-card ${item.featured ? 'featured' : ''}" data-id="${item.id}"><div class="result-meta"><span>0${index + 1} / ${item.scene}</span><span class="result-type">${item.type}</span></div><blockquote>${item.text}</blockquote><footer><span class="result-source">${item.source}</span><div class="card-actions"><button class="copy-result" data-id="${item.id}" aria-label="复制句子" title="复制句子">↗</button><button class="save-result" data-id="${item.id}" aria-label="收藏句子" title="收藏句子">☆</button><button class="make-card" data-id="${item.id}" aria-label="生成卡片" title="生成卡片">▧</button></div></footer></article>`).join('');
  navigate('results');
}

function copyText(text) { if (navigator.clipboard) navigator.clipboard.writeText(text); else { const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); } showToast('已复制到剪贴板'); }
function findResult(id) { return state.results.find(item => item.id === id); }
function saveResult(id) { const item = findResult(id); if (!item) return; const saved = getSaved(); if (saved.some(entry => entry.text === item.text)) { showToast('这句话已经在收藏里'); return; } saved.unshift({ ...item, savedAt: new Date().toISOString() }); setSaved(saved); showToast('已收藏到本机'); const button = $(`.save-result[data-id="${id}"]`); if (button) button.classList.add('active'); }
function openCard(text) { state.currentCardText = text; $('#preview-text').textContent = text; $('#card-modal').classList.add('open'); $('#card-modal').setAttribute('aria-hidden', 'false'); }
function updateSavedView() { const saved = getSaved(); $('#nav-count').textContent = saved.length; if ($('#saved-count-label')) $('#saved-count-label').textContent = `已收藏 ${saved.length} 句`; $('#saved-empty').hidden = saved.length > 0; $('#saved-list').hidden = saved.length === 0; $('#saved-list').innerHTML = saved.map(item => `<article class="saved-card"><blockquote>${item.text}</blockquote><footer><span>${item.source}</span><div><button class="saved-card-btn" data-action="card" data-id="${item.id}" title="生成卡片">▧</button><button class="saved-card-btn" data-action="remove" data-id="${item.id}" title="取消收藏">×</button></div></footer></article>`).join(''); }

function generateCardImage() { const preview = $('#card-preview'); const canvas = document.createElement('canvas'); const width = 1200; const ratio = parseFloat(preview.dataset.ratio || '1'); canvas.width = width; canvas.height = Math.round(width / ratio); const ctx = canvas.getContext('2d'); ctx.fillStyle = getComputedStyle(preview).backgroundColor; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = getComputedStyle(preview).color; ctx.textAlign = 'left'; ctx.font = '500 56px "Noto Serif SC"'; const lines = state.currentCardText.match(/.{1,11}/g) || [state.currentCardText]; const lineHeight = 92; const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2; lines.forEach((line, i) => ctx.fillText(line, 110, startY + i * lineHeight)); ctx.font = '20px "DM Mono"'; ctx.globalAlpha = .6; ctx.fillText('JUWAI / ORIGINAL', 110, 90); ctx.fillText('句外', canvas.width - 180, canvas.height - 80); const link = document.createElement('a'); link.download = 'juwai-card.png'; link.href = canvas.toDataURL('image/png'); link.click(); showToast('卡片已下载'); }

document.addEventListener('click', event => { const viewButton = event.target.closest('[data-view]'); if (viewButton) navigate(viewButton.dataset.view); const prompt = event.target.closest('.chip[data-prompt]'); if (prompt) { $('#context-input').value = prompt.dataset.prompt; $('#context-input').dispatchEvent(new Event('input')); navigate('input'); } const copyButton = event.target.closest('[data-copy]'); if (copyButton) copyText(copyButton.dataset.copy); const copyResult = event.target.closest('.copy-result'); if (copyResult) copyText(findResult(copyResult.dataset.id).text); const saveButton = event.target.closest('.save-result'); if (saveButton) saveResult(saveButton.dataset.id); const cardButton = event.target.closest('.make-card'); if (cardButton) openCard(findResult(cardButton.dataset.id).text); const savedButton = event.target.closest('.saved-card-btn'); if (savedButton) { const saved = getSaved(); const item = saved.find(entry => entry.id === savedButton.dataset.id); if (savedButton.dataset.action === 'remove') { setSaved(saved.filter(entry => entry.id !== savedButton.dataset.id)); showToast('已取消收藏'); } else if (item) openCard(item.text); } if (event.target.closest('[data-close-modal]')) { $('#card-modal').classList.remove('open'); $('#card-modal').setAttribute('aria-hidden', 'true'); } });
$('#context-input').addEventListener('input', event => { state.input = event.target.value; $('#char-count').textContent = `${event.target.value.length} / 240`; });
$$('.tone-chip').forEach(button => button.addEventListener('click', () => { $$('.tone-chip').forEach(item => item.classList.remove('selected')); button.classList.add('selected'); state.tone = button.dataset.tone; }));
$('#image-input').addEventListener('change', event => { const file = event.target.files[0]; if (!file) return; if (file.size > 8 * 1024 * 1024) { showToast('图片不能超过 8MB'); return; } state.image = file; const preview = $('#image-preview'); preview.src = URL.createObjectURL(file); $('#upload-zone').classList.add('has-image'); $('#upload-status').textContent = `已读取图片 · ${file.name}`; });
$('#generate-btn').addEventListener('click', () => { if (!state.input.trim() && !state.image) { showToast('先写一句处境，或上传一张照片'); $('#context-input').focus(); return; } const button = $('#generate-btn'); button.disabled = true; button.querySelector('span').textContent = '句外正在理解…'; setTimeout(() => { if (!state.input.trim() && state.image) state.input = `一张${state.image.name}里的画面`; createResults(); button.disabled = false; button.querySelector('span').textContent = '让句外听见'; }, 650); });
$('#new-search-btn').addEventListener('click', () => navigate('input'));
const dailyQuotes = ['风会记住每一朵花的香，<br>我们也会记住，<br>那个认真生活的自己。','愿你眼里有光，<br>心中有暖，<br>脚下有路。','把烦恼放一放，<br>让时间替你过滤掉<br>不必要的重量。'];
let dailyIndex = 0;
$('#daily-refresh').addEventListener('click', () => { dailyIndex = (dailyIndex + 1) % dailyQuotes.length; $('#daily-quote').innerHTML = dailyQuotes[dailyIndex]; });
$$('.swatch').forEach(button => button.addEventListener('click', () => { $$('.swatch').forEach(item => item.classList.remove('active')); button.classList.add('active'); $('#card-preview').style.background = button.dataset.color; }));
$('#font-size').addEventListener('input', event => { $('#preview-text').style.fontSize = `${event.target.value}px`; });
$$('.ratio-btn').forEach(button => button.addEventListener('click', () => { $$('.ratio-btn').forEach(item => item.classList.remove('active')); button.classList.add('active'); $('#card-preview').style.aspectRatio = button.dataset.ratio; $('#card-preview').dataset.ratio = button.dataset.ratio; }));
$('#download-card').addEventListener('click', generateCardImage);
updateSavedView();
