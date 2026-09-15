const isHiddenCustomPrompt = prompt => /일본 가족용 가습기 라이프스타일 광고.*기반.*확정.*2026-09-03/.test(prompt.title || '');
const state = { prompts: [], seedPrompts: [], customPrompts: JSON.parse(localStorage.getItem('image-craft-custom-prompts') || '[]').filter(prompt=>!isHiddenCustomPrompt(prompt)), category: '전체', query: '', activeExperimentPromptId: null, experiments: JSON.parse(localStorage.getItem('image-craft-experiments') || '[]') };
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
  'the-saem-summer-cover-promo-final-v1'
]);
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value='') => value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function init() {
  const [response, experimentResponse] = await Promise.all([fetch('./data/prompts.json'), fetch('./data/experiments.json')]);
  const [data, experimentData] = await Promise.all([response.json(), experimentResponse.json()]);
  state.seedPrompts = data.prompts.filter(prompt=>!prompt.archived);
  const visibleFileExperiments=experimentData.experiments.filter(item=>!hiddenExperimentPromptIds.has(item.promptId));
  const fileById=new Map(visibleFileExperiments.map(item=>[item.id,item]));
  const localOnly=state.experiments.filter(item=>!fileById.has(item.id)&&item.source!=='codex-thread');
  const mergedFileExperiments=visibleFileExperiments.map(fileItem=>{
    const localItem=state.experiments.find(item=>item.id===fileItem.id);
    const merged={...(localItem||{}),...fileItem};
    if(fileItem.outcome==='failed') { delete merged.promotedPromptId; delete merged.promotedAt; }
    return merged;
  });
  state.experiments=[...mergedFileExperiments,...localOnly];
  const failedExperimentIds=new Set(state.experiments.filter(item=>item.outcome==='failed').map(item=>item.id));
  state.customPrompts=state.customPrompts.filter(prompt=>!failedExperimentIds.has(prompt.sourceExperimentId));
  state.prompts = [...state.seedPrompts, ...state.customPrompts];
  localStorage.setItem('image-craft-custom-prompts',JSON.stringify(state.customPrompts));
  localStorage.setItem('image-craft-experiments',JSON.stringify(state.experiments));
  renderFilters(); renderPrompts(); renderLibraryStatuses(); renderConfirmedPrompts(); renderExperiments(); updateStats(); bindEvents();
}

function renderFilters(){
  const cats=['전체',...new Set(state.prompts.filter(p=>p.isConfirmed).map(p=>p.category))];
  $('#filterChips').innerHTML=cats.map(c=>`<button class="chip ${c===state.category?'active':''}" data-category="${c}">${c}</button>`).join('');
}
function renderPrompts(){
  const q=state.query.toLowerCase();
  const items=state.prompts.filter(p=>p.isConfirmed&&(state.category==='전체'||p.category===state.category)&&JSON.stringify(p).toLowerCase().includes(q));
  $('#promptGrid').innerHTML=items.length?items.map((p,i)=>`<article class="prompt-card" data-id="${p.id}" tabindex="0"><span class="card-number">${String(i+1).padStart(2,'0')} / ${p.category}</span><h3>${p.title}</h3><p>${p.summary}</p><div class="tags">${p.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div><div class="card-foot"><span>${p.product} · ${p.aspectRatio}</span><span class="arrow">↗</span></div></article>`).join(''):'<p class="empty">조건에 맞는 프롬프트가 없습니다.</p>';
}
function renderLibraryStatuses(){
  const successful=state.prompts.filter(prompt=>prompt.isConfirmed);
  const failed=[...state.experiments].filter(item=>item.outcome==='failed').reverse();
  $('#librarySuccessCount').textContent=successful.length;
  $('#libraryFailedCount').textContent=failed.length;
  $('#librarySuccessGrid').innerHTML=successful.length?successful.map((p,i)=>`<article class="prompt-card" data-library-prompt-id="${p.id}" tabindex="0"><span class="status-label success">✓ 성공 프롬프트</span><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.summary||'확정된 성공 프롬프트')}</p><div class="card-foot"><span>${escapeHtml(p.version||'confirmed')} · ${escapeHtml(p.aspectRatio||'')}</span><span class="arrow">↗</span></div></article>`).join(''):'<p class="empty">아직 확정된 성공 프롬프트가 없습니다.</p>';
  $('#libraryFailedGrid').innerHTML=failed.length?failed.map(e=>`<article class="prompt-card" data-library-experiment-id="${e.id}" tabindex="0"><span class="status-label failed">✕ 실패 프롬프트</span><h3>${escapeHtml(e.title||e.promptTitle)}</h3><p>${escapeHtml(e.failed||'실패 원인 미기록')}</p><div class="card-foot"><span>${escapeHtml(e.promptTitle||'실험 기록')} · ${e.rating==null?'미평가':`${e.rating}/5`}</span><span class="arrow">↗</span></div></article>`).join(''):'<p class="empty">아직 실패로 판정된 프롬프트가 없습니다.</p>';
}
function renderExperiments(){
  const root=$('#experimentList');
  if(!state.experiments.length){root.innerHTML='<div class="empty">아직 기록된 실험이 없습니다. 첫 결과가 완벽하지 않아도 좋습니다.</div>';return}
  const groups=new Map();
  state.experiments.forEach(item=>{const key=item.promptId||item.promptTitle;const group=groups.get(key)||{id:key,title:item.promptTitle||'이름 없는 프롬프트',items:[]};group.items.push(item);groups.set(key,group)});
  root.innerHTML=[...groups.values()].reverse().map(group=>{
    const records=[...group.items].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
    const failedCount=records.filter(item=>item.outcome==='failed').length;
    const confirmedCount=records.filter(item=>item.promotedPromptId).length;
    const expanded=state.activeExperimentPromptId===group.id;
    const recordList=records.map((e,index)=>`<article class="experiment-record ${e.outcome==='failed'?'experiment-record-failed':''}"><div class="record-heading"><div><span class="card-number">${escapeHtml(e.title||`프롬프트 ${index+1} 기록`)}</span><h4>${new Date(e.createdAt).toLocaleString('ko-KR')}</h4></div>${e.outcome==='failed'?'<span class="failed-badge">✕ 실패</span>':e.promotedPromptId?'<span class="confirmed-badge">✓ 성공 확정</span>':''}</div>${e.image?`<button class="record-image-button" data-show-experiment="${e.id}">경과 이미지·상세 보기</button>`:''}<p class="record-change"><b>변경 요소</b>${escapeHtml(e.change||'—')}</p><div class="record-prompt"><div class="record-prompt-head"><b>실제 프롬프트</b><button class="button record-copy" data-copy-experiment="${e.id}">텍스트 복사</button></div><pre class="prompt-full">${escapeHtml(e.actualPrompt||'프롬프트 전문 없음')}</pre></div><div class="record-actions">${e.outcome==='failed'||e.promotedPromptId?'':`<button class="promote-button" data-promote="${e.id}">성공 프롬프트로 확정</button>`}</div></article>`).join('');
    return `<section class="experiment-group ${expanded?'expanded':''}"><article class="prompt-card experiment-group-card" data-experiment-group="${escapeHtml(group.id)}" tabindex="0"><span class="card-number">${records.length} EXPERIMENTS</span><h3>${escapeHtml(group.title)}</h3><p>성공 확정 ${confirmedCount} · 실패 ${failedCount} · 미확정 ${records.length-confirmedCount-failedCount}</p><div class="tags"><span class="tag">프롬프트 기록 ${records.length}개</span>${failedCount?`<span class="status-label failed">실패 ${failedCount}</span>`:''}${confirmedCount?`<span class="status-label success">성공 ${confirmedCount}</span>`:''}</div><div class="card-foot"><span>${expanded?'기록 접기':'기록 펼쳐보기'}</span><span class="arrow">${expanded?'↑':'↓'}</span></div></article>${expanded?`<div class="experiment-record-stream">${recordList}</div>`:''}</section>`;
  }).join('');
}
function renderConfirmedPrompts(){
  const items=state.prompts.filter(prompt=>prompt.isConfirmed);
  $('#confirmedCount').textContent=items.length;
  $('#confirmedPromptGrid').innerHTML=items.length?items.map((p,i)=>`<article class="prompt-card" data-confirmed-id="${p.id}" tabindex="0"><span class="card-number">FINAL ${String(i+1).padStart(2,'0')}</span><h3>${p.title}</h3><p>${p.summary}</p><div class="tags">${p.tags.slice(0,4).map(t=>`<span class="tag">${t}</span>`).join('')}</div><div class="card-foot"><span>${p.version} · ${p.aspectRatio}</span><span class="arrow">↗</span></div></article>`).join(''):'<p class="empty">아직 확정된 성공 프롬프트가 없습니다.</p>';
}
function getStructuredPrompt(prompt){
  return {
    id:prompt.id,
    title:prompt.title,
    category:prompt.category,
    product:prompt.product,
    aspectRatio:prompt.aspectRatio,
    version:prompt.version,
    status:prompt.isConfirmed?'confirmed':'library',
    derivedFrom:prompt.derivedFrom||undefined,
    sourceExperimentId:prompt.sourceExperimentId||undefined,
    previewImage:prompt.previewImage||undefined,
    tags:prompt.tags,
    prompt:prompt.spec
  };
}
function showPrompt(id){
  const p=state.prompts.find(x=>x.id===id); if(!p)return;
  const textPrompt=p.promptText||p.composedPrompt;
  const jsonPrompt=JSON.stringify(getStructuredPrompt(p),null,2);
  $('#promptDetail').innerHTML=`<p class="eyebrow">${p.category} / ${p.product}</p><h2>${p.title}</h2><p>${p.summary}</p>${p.previewImage?`<img class="prompt-detail-image" src="./${p.previewImage}" alt="${escapeHtml(p.title)} 최종 결과 이미지" />`:''}<div class="detail-meta">${p.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div><div class="format-tabs"><button class="format-tab active" data-format="text">텍스트 프롬프트</button><button class="format-tab" data-format="json">구조화 JSON</button></div><div class="format-panel" data-panel="text"><pre class="prompt-full">${escapeHtml(textPrompt)}</pre><div class="format-actions"><button class="button primary" data-copy-format="text" data-prompt-id="${p.id}">텍스트 복사</button></div></div><div class="format-panel hidden" data-panel="json"><pre class="prompt-full">${escapeHtml(jsonPrompt)}</pre><div class="format-actions"><button class="button primary" data-copy-format="json" data-prompt-id="${p.id}">JSON 복사</button></div></div>`;
  $('#promptDialog').showModal();
}
function showExperiment(id){
  const e=state.experiments.find(item=>item.id===id); if(!e)return;
  $('#experimentDetail').innerHTML=`<p class="eyebrow">${escapeHtml(e.title||'EXPERIMENT')}</p><h2>${escapeHtml(e.title||e.promptTitle)}</h2><p>${new Date(e.createdAt).toLocaleString('ko-KR')} · ${escapeHtml(e.model||'모델 미기록')}</p>${e.image?`<img class="experiment-image" src="./${e.image}" alt="${escapeHtml(e.title||e.promptTitle)} 결과 이미지" />`:''}<div class="detail-section"><h3>변경한 요소</h3><p>${escapeHtml(e.change||'—')}</p></div><div class="detail-section"><h3>잘 된 점</h3><p>${escapeHtml(e.worked||'—')}</p></div><div class="detail-section"><h3>문제와 다음 단계</h3><p>${escapeHtml(e.failed||'—')}\n\n${escapeHtml(e.next||'—')}</p></div><div class="detail-section"><h3>실제 사용한 프롬프트</h3><pre class="prompt-full">${escapeHtml(e.actualPrompt||'프롬프트 전문 없음')}</pre></div>`;
  $('#experimentDetailDialog').showModal();
}
function updateStats(){
  $('#promptCount').textContent=state.prompts.filter(prompt=>prompt.isConfirmed).length; $('#experimentCount').textContent=state.experiments.length;
  $('#learningCount').textContent=state.experiments.filter(e=>e.worked||e.failed).length;
  const current=$('#promptSelect').value;
  $('#promptSelect').innerHTML=`<option value="__new__">＋ 새 기본 프롬프트 만들기</option>`+state.prompts.map(p=>`<option value="${p.id}">${p.title}${p.isCustom?' · 사용자':''}</option>`).join('');
  $('#promptSelect').value=state.prompts.some(p=>p.id===current)?current:(state.prompts[0]?.id||'__new__');
}
function openExperiment(id){ if(id)$('#promptSelect').value=id; toggleNewPromptFields(); $('#experimentDialog').showModal(); }
function toggleNewPromptFields(){
  const isNew=$('#promptSelect').value==='__new__';
  $('#newPromptFields').classList.toggle('hidden',!isNew);
  for(const name of ['newPromptTitle','newPromptCategory','newPromptBody']) $('#experimentForm').elements[name].required=isNew;
}
function slugify(value){
  const safe=value.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g,'-').replace(/^-|-$/g,'');
  return `custom-${safe||'prompt'}-${Date.now().toString(36)}`;
}
function createCustomPrompt(values){
  const prompt={id:slugify(values.newPromptTitle),title:values.newPromptTitle.trim(),category:values.newPromptCategory.trim(),product:(values.newPromptProduct||'미지정').trim(),aspectRatio:(values.newPromptRatio||'1:1').trim(),version:'v1',logoSpace:'미지정',tags:['사용자 프롬프트','실험에서 생성'],summary:`${values.newPromptTitle.trim()} 실험을 위해 추가된 사용자 기본 프롬프트.`,composedPrompt:values.newPromptBody.trim(),spec:{raw_prompt:values.newPromptBody.trim()},isCustom:true,createdAt:new Date().toISOString()};
  state.customPrompts.push(prompt); state.prompts.push(prompt);
  localStorage.setItem('image-craft-custom-prompts',JSON.stringify(state.customPrompts));
  return prompt;
}
function promoteExperiment(experimentId){
  const experiment=state.experiments.find(item=>item.id===experimentId); if(!experiment||!experiment.actualPrompt||experiment.promotedPromptId||experiment.outcome==='failed')return;
  const base=state.prompts.find(item=>item.id===experiment.promptId);
  const date=new Date(experiment.createdAt).toISOString().slice(0,10);
  const title=`${experiment.promptTitle} · 확정 ${date}`;
  const prompt={id:slugify(title),title,category:base?.category||'확정 자산',product:base?.product||'미지정',aspectRatio:base?.aspectRatio||'1:1',version:`confirmed-${date}`,logoSpace:base?.logoSpace||'미지정',tags:['성공 프롬프트','실험 확정',...(base?.tags||[]).slice(0,2)],summary:experiment.worked?`검증된 성공 요소: ${experiment.worked}`:`평가 ${experiment.rating}/5 실험에서 확정된 프롬프트.`,composedPrompt:experiment.actualPrompt,spec:{raw_prompt:experiment.actualPrompt},isCustom:true,isConfirmed:true,derivedFrom:experiment.promptId,sourceExperimentId:experiment.id,createdAt:new Date().toISOString()};
  state.customPrompts.push(prompt); state.prompts.push(prompt); experiment.promotedPromptId=prompt.id; experiment.promotedAt=new Date().toISOString();
  localStorage.setItem('image-craft-custom-prompts',JSON.stringify(state.customPrompts)); localStorage.setItem('image-craft-experiments',JSON.stringify(state.experiments));
  renderFilters(); renderPrompts(); renderLibraryStatuses(); renderConfirmedPrompts(); renderExperiments(); updateStats(); toast('성공 프롬프트를 라이브러리 자산으로 확정했습니다');
}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
function bindEvents(){
  $('#searchInput').addEventListener('input',e=>{state.query=e.target.value;renderPrompts()});
  $('#filterChips').addEventListener('click',e=>{if(!e.target.dataset.category)return;state.category=e.target.dataset.category;renderFilters();renderPrompts()});
  $('#promptGrid').addEventListener('click',e=>{const card=e.target.closest('.prompt-card');if(card)showPrompt(card.dataset.id)});
  $('#librarySuccessGrid').addEventListener('click',e=>{const card=e.target.closest('[data-library-prompt-id]');if(card)showPrompt(card.dataset.libraryPromptId)});
  $('#libraryFailedGrid').addEventListener('click',e=>{const card=e.target.closest('[data-library-experiment-id]');if(card)showExperiment(card.dataset.libraryExperimentId)});
  $('#confirmedPromptGrid').addEventListener('click',e=>{const card=e.target.closest('[data-confirmed-id]');if(card)showPrompt(card.dataset.confirmedId)});
  $('#experimentList').addEventListener('click',async e=>{
    if(e.target.dataset.copyExperiment){const item=state.experiments.find(x=>x.id===e.target.dataset.copyExperiment);if(item){await navigator.clipboard.writeText(item.actualPrompt||'');toast('실험 프롬프트 텍스트를 복사했습니다')}return}
    if(e.target.dataset.showExperiment){showExperiment(e.target.dataset.showExperiment);return}
    if(e.target.dataset.promote){promoteExperiment(e.target.dataset.promote);return}
    const card=e.target.closest('[data-experiment-group]');if(card){state.activeExperimentPromptId=state.activeExperimentPromptId===card.dataset.experimentGroup?null:card.dataset.experimentGroup;renderExperiments()}
  });
  document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;if(e.target.dataset.id)showPrompt(e.target.dataset.id);if(e.target.dataset.confirmedId)showPrompt(e.target.dataset.confirmedId);if(e.target.dataset.experimentId)showExperiment(e.target.dataset.experimentId);if(e.target.dataset.libraryPromptId)showPrompt(e.target.dataset.libraryPromptId);if(e.target.dataset.libraryExperimentId)showExperiment(e.target.dataset.libraryExperimentId)});
  document.querySelectorAll('.dialog-close').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  document.querySelectorAll('.open-experiment').forEach(b=>b.addEventListener('click',()=>openExperiment())); $('#newExperimentButton').addEventListener('click',()=>openExperiment());
  $('#promptSelect').addEventListener('change',toggleNewPromptFields);
  document.querySelectorAll('.nav-link').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.nav-link').forEach(x=>x.classList.toggle('active',x===b));$('#libraryView').classList.toggle('hidden',b.dataset.view!=='library');$('#experimentsView').classList.toggle('hidden',b.dataset.view!=='experiments')}));
  $('#promptDetail').addEventListener('click',async e=>{
    if(e.target.dataset.format){const format=e.target.dataset.format;document.querySelectorAll('.format-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.format===format));document.querySelectorAll('.format-panel').forEach(panel=>panel.classList.toggle('hidden',panel.dataset.panel!==format));return}
    if(!e.target.dataset.copyFormat)return;
    const p=state.prompts.find(x=>x.id===e.target.dataset.promptId);const value=e.target.dataset.copyFormat==='json'?JSON.stringify(getStructuredPrompt(p),null,2):(p.promptText||p.composedPrompt);await navigator.clipboard.writeText(value);toast(e.target.dataset.copyFormat==='json'?'구조화 JSON을 복사했습니다':'텍스트 프롬프트를 복사했습니다')
  });
  $('#experimentForm').addEventListener('submit',e=>{e.preventDefault();const values=Object.fromEntries(new FormData(e.target));const isNew=values.promptId==='__new__';const p=isNew?createCustomPrompt(values):state.prompts.find(x=>x.id===values.promptId);state.experiments.push({...values,promptId:p.id,promptTitle:p.title,createdAt:new Date().toISOString(),id:crypto.randomUUID()});localStorage.setItem('image-craft-experiments',JSON.stringify(state.experiments));e.target.reset();$('#newPromptFields').classList.add('hidden');$('#experimentDialog').close();renderFilters();renderPrompts();renderLibraryStatuses();renderConfirmedPrompts();renderExperiments();updateStats();toast(isNew?'새 프롬프트와 실험을 함께 저장했습니다':'실험을 학습 자산으로 저장했습니다')});
  $('#exportButton').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:2,exportedAt:new Date().toISOString(),customPrompts:state.customPrompts,experiments:state.experiments},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`image-craft-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)});
}
init().catch(error=>{$('#promptGrid').innerHTML=`<p class="empty">데이터를 불러오지 못했습니다: ${escapeHtml(error.message)}</p>`});
