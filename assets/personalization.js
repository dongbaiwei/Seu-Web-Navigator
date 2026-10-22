(function () {
  'use strict';
  const key='seubme_personalization_v1';
  const defaults={college:'11',title:'',categories:[{id:'academic',name:'学术',visible:true},{id:'life',name:'生活',visible:true},{id:'service',name:'服务',visible:true},{id:'resource',name:'资源',visible:true}],assignments:{},categoryRedirects:{},display:{clock:true,kicker:true,motto:true,footer:true,projects:true},cards:{density:'standard',columns:4,radius:8,opacity:24,blur:16,numbers:false},background:{brightness:100,emblemOpacity:16,motifOpacity:30,motif:true}};
  const copy=value=>JSON.parse(JSON.stringify(value));
  const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
  let state=copy(defaults),prepared=false,mounted=false,lastCollegeLabel='';
  try{lastCollegeLabel=localStorage.getItem('seubme_college_label_v1')||'';}catch{}
  function normalize(value) {
    if(!value||typeof value!=='object')return copy(defaults);
    const next=copy(defaults);
    if(BmeColleges.profiles.some(p=>p.id===value.college))next.college=value.college;
    if(typeof value.title==='string')next.title=value.title.trim().slice(0,32);
    if(Array.isArray(value.categories)){
      const seen=new Set();
      const categories=value.categories.filter(c=>c&&typeof c.id==='string'&&/^(academic|life|service|resource|cat-[a-z0-9-]+)$/.test(c.id)&&typeof c.name==='string'&&c.name.trim()&&!seen.has(c.id)&&seen.add(c.id)).slice(0,20).map(c=>({id:c.id,name:c.name.trim().slice(0,16),visible:c.visible!==false}));
      if(categories.length)next.categories=categories;
    }
    if(value.assignments&&typeof value.assignments==='object')Object.entries(value.assignments).slice(0,2000).forEach(([id,cat])=>{if(typeof cat==='string'&&next.categories.some(c=>c.id===cat))Object.defineProperty(next.assignments,id,{value:cat,enumerable:true,writable:true,configurable:true});});
    if(value.categoryRedirects&&typeof value.categoryRedirects==='object')Object.entries(value.categoryRedirects).slice(0,100).forEach(([id,cat])=>{if(/^(academic|life|service|resource|cat-[a-z0-9-]+)$/.test(id)&&next.categories.some(c=>c.id===cat))next.categoryRedirects[id]=cat;});
    for(const field of Object.keys(next.display))if(typeof value.display?.[field]==='boolean')next.display[field]=value.display[field];
    if(['compact','standard','spacious'].includes(value.cards?.density))next.cards.density=value.cards.density;
    for(const [field,min,max]of [['columns',2,5],['radius',0,24],['opacity',0,80],['blur',0,30]])next.cards[field]=clamp(value.cards?.[field]??next.cards[field],min,max,next.cards[field]);
    next.cards.columns=Math.round(next.cards.columns);
    if(typeof value.cards?.numbers==='boolean')next.cards.numbers=value.cards.numbers;
    for(const [field,min,max]of [['brightness',50,130],['emblemOpacity',0,40],['motifOpacity',0,80]])next.background[field]=clamp(value.background?.[field]??next.background[field],min,max,next.background[field]);
    if(typeof value.background?.motif==='boolean')next.background.motif=value.background.motif;
    return next;
  }
  try{state=normalize(JSON.parse(localStorage.getItem(key)||'null'));}catch{/* Keep a usable default. */}
  const nodes=()=>Array.from(document.querySelectorAll('#links-container .link-card:not([data-shared-project])'));
  const getCategories=()=>copy(state.categories);
  const categoryName=id=>state.categories.find(c=>c.id===id)?.name||id;
  const isCategoryVisible=id=>state.categories.some(c=>c.id===id&&c.visible);
  const resolveCategory=(id,original)=>state.assignments[id]||(state.categories.some(c=>c.id===original)?original:state.categoryRedirects[original]||state.categories[0].id);
  function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
  function status(message){const node=document.getElementById('personalStatus');if(node)node.textContent=message;}
  function commit(next){
    try{localStorage.setItem(key,JSON.stringify(next));}catch{status('浏览器未能保存设置，请检查存储空间后重试。');if(typeof showToast==='function')showToast('设置未保存，请检查浏览器存储空间');return false;}
    state=next;applyIdentity();refresh();applyVisuals();status('已保存，下次打开仍会保留。');return true;
  }
  function customNames(){let saved=[];try{const raw=JSON.parse(localStorage.getItem('seubme_custom_sites_v1')||'[]');if(Array.isArray(raw))saved=raw.filter(s=>s&&typeof s.name==='string').map(s=>s.name);}catch{}return new Set([...saved,...nodes().filter(c=>c.dataset.customSiteId).map(c=>c.querySelector('.link-title').textContent)]);}
  function remapCollegeState(name){
    const personalNames=customNames();
    const names=new Set([...BmeColleges.profiles.map(p=>p.linkName),lastCollegeLabel].filter(n=>n&&!personalNames.has(n)));
    const remap=x=>names.has(x)?name:x;
    favorites=Array.from(new Set(favorites.map(remap)));
    customOrder=Array.from(new Set(customOrder.map(remap)));
    const seen=new Set();recentVisits=recentVisits.map(x=>({...x,title:remap(x.title)})).filter(x=>!seen.has(x.title)&&seen.add(x.title));
    try{
      localStorage.setItem('favorites',JSON.stringify(favorites));localStorage.setItem('customOrder',JSON.stringify(customOrder));localStorage.setItem('recentVisits',JSON.stringify(recentVisits));
      const visits=JSON.parse(localStorage.getItem('visitCounts')||'{}');let total=0;for(const old of names){if(Number.isFinite(visits[old]))total+=visits[old];delete visits[old];}if(total)visits[name]=total;localStorage.setItem('visitCounts',JSON.stringify(visits));
    }catch{/* Identity remains usable when secondary preference storage is unavailable. */}
  }
  function applyIdentity(){
    const profile=BmeColleges.get(state.college), title=state.title||profile.title;
    const personalNames=customNames();let collegeName=profile.linkName;
    if(personalNames.has(collegeName))collegeName=profile.name;
    if(personalNames.has(collegeName))collegeName=profile.name+'官网';
    let suffix=2;while(personalNames.has(collegeName))collegeName=profile.name+'官网 '+suffix++;
    document.querySelector('.mast-title').textContent=title;
    document.querySelector('.mast-kicker').textContent='东南大学 · '+profile.name;
    document.title=title+' · 东南大学';
    document.querySelector('meta[name="description"]').content='东南大学'+profile.name+'常用网址导航，支持个人定制。';
    const card=document.querySelector('[data-nav-id="college-official"]');
    remapCollegeState(collegeName);
    lastCollegeLabel=collegeName;try{localStorage.setItem('seubme_college_label_v1',collegeName);}catch{}
    if(card){
      card.querySelector('.link-title').textContent=collegeName;
      card.querySelector('.link-desc').textContent=profile.name+'官网';
      card.querySelector('a').href=profile.url;
      card.querySelector('.row-domain').textContent=new URL(profile.url).hostname;
      card.querySelector('.favorite-btn').setAttribute('aria-label','收藏 '+collegeName);
      const remove=card.querySelector('.site-manage-remove');if(remove){remove.title='删除“'+collegeName+'”';remove.setAttribute('aria-label','删除网站 '+collegeName);}
    }
    document.documentElement.dataset.college=profile.id;
    const motif=document.getElementById('collegeMotif');if(motif&&motif.getAttribute('src')!=='assets/college-art/'+profile.id+'.png')motif.src='assets/college-art/'+profile.id+'.png';
    const swatch=document.querySelector('.wallpaper-molecular');if(swatch){let preview=swatch.querySelector('img');if(!preview){preview=el('img');preview.alt='';swatch.append(preview);}preview.src='assets/college-art/'+profile.id+'.png';}
    const open=document.getElementById('collegeButton');if(open)open.textContent='学院：'+profile.short;
    if(window.BmeCustomSites)BmeCustomSites.refreshCollegeCatalog();
  }
  function applyVisuals(){
    const root=document.documentElement;root.dataset.collegeReady='true';root.dataset.cardDensity=state.cards.density;root.dataset.cardColumns=String(state.cards.columns);root.dataset.cardNumbers=String(state.cards.numbers);
    for(const [name,value]of Object.entries({'--personal-radius':state.cards.radius+'px','--personal-card-alpha':state.cards.opacity/100,'--personal-blur':state.cards.blur+'px','--college-emblem-opacity':state.background.emblemOpacity/100,'--college-motif-opacity':state.background.motifOpacity/100,'--college-brightness':state.background.brightness/100}))root.style.setProperty(name,value);
    root.dataset.showCollegeMotif=String(state.background.motif);
    for(const [field,selector]of Object.entries({clock:'#mastClock',kicker:'.mast-kicker',motto:'.mast-scroll',footer:'.footer-band, .footer',projects:'#project-links'}))document.querySelectorAll(selector).forEach(node=>{node.classList.toggle('personal-hidden',!state.display[field]);});
    document.querySelectorAll('[data-personal-input]').forEach(input=>{
      const [group,field]=input.dataset.personalInput.split('.');const value=state[group][field];
      if(input.type==='checkbox')input.checked=value;else input.value=String(value);
      const output=input.parentElement.querySelector('output');if(output)output.textContent=value+(input.dataset.unit||'');
    });
    const title=document.getElementById('personalTitle');if(title){title.placeholder=BmeColleges.get(state.college).title;if(document.activeElement!==title)title.value=state.title;}
    if(window.initializeFavorites)initializeFavorites();if(window.renderVisitBadges)renderVisitBadges();
  }
  function makeSection(category){
    const section=el('section','index-section');section.id='sec-'+category.id;section.dataset.section=category.id;
    const head=el('header','sec-head');head.append(el('span','sec-no'),el('h2','sec-title',category.name),el('span','sec-en','Custom'),el('span','sec-count','0 sites'));
    const rows=el('div','sec-rows');const empty=el('p','category-empty','这个分类还没有网站，可以点击“添加网站”加入。');section.append(head,rows,empty);return section;
  }
  function refresh(){
    const main=document.getElementById('links-container');if(!main)return;
    BmeSiteModel.setCategories(state.categories.map(c=>c.id));
    const projects=document.getElementById('project-links');if(projects&&projects.parentElement!==main)main.append(projects);
    const allCards=nodes();
    state.categories.forEach((category,index)=>{
      let section=document.getElementById('sec-'+category.id);if(!section)section=makeSection(category);
      section.querySelector('.sec-title').textContent=category.name;section.querySelector('.sec-no').textContent=String(index+1).padStart(2,'0');
      section.querySelector('.sec-en').hidden=!defaults.categories.some(c=>c.id===category.id&&c.name===category.name);
      let empty=section.querySelector('.category-empty');if(!empty){empty=el('p','category-empty','这个分类还没有网站，可以点击“添加网站”加入。');section.append(empty);}
      main.insertBefore(section,projects||null);
    });
    allCards.forEach(card=>{const cat=resolveCategory(card.dataset.navId,card.dataset.category);card.dataset.category=cat;const rows=document.querySelector('#sec-'+cat+' > .sec-rows');if(card.parentElement!==rows)rows.append(card);});
    main.querySelectorAll('.index-section').forEach(sec=>{if(!state.categories.some(c=>c.id===sec.dataset.section))sec.remove();else{const empty=sec.querySelector('.category-empty');if(empty)empty.hidden=sec.querySelectorAll('.link-card').length>0;}});
    const tabs=document.getElementById('catTabs');tabs.querySelectorAll('[data-personal-category], [data-tab="academic"], [data-tab="life"], [data-tab="service"], [data-tab="resource"]').forEach(n=>n.remove());
    const anchor=tabs.querySelector('.tab-sep');
    for(const category of state.categories.filter(c=>c.visible)){
      const tab=el('button','cat-tab',category.name);tab.type='button';tab.dataset.tab=category.id;tab.dataset.personalCategory='true';tab.append(el('span','n','0'));tab.addEventListener('click',()=>switchCat(category.id));tabs.insertBefore(tab,anchor);
    }
    const select=document.getElementById('customSiteCategory');const original=select.value;select.replaceChildren();state.categories.forEach(c=>{const option=el('option','',c.name+(c.visible?'':'（已隐藏）'));option.value=c.id;select.append(option);});if(state.categories.some(c=>c.id===original))select.value=original;
    if(!['all','favorite','recent'].includes(currentCategory)&&!isCategoryVisible(currentCategory))currentCategory='all';
    tabs.querySelectorAll('[data-tab]').forEach(t=>t.classList.toggle('active',t.dataset.tab===currentCategory));
    if(window.BmeCustomSites)BmeCustomSites.updateCounts();if(window.performSearch)performSearch();
    let layout='grid';try{layout=localStorage.getItem('seucseweb_layout')||'grid';}catch{}if(window.applyLayout)applyLayout(layout);
    if(mounted)renderCategories();
  }
  function prepare(){
    if(prepared)return;prepared=true;
    nodes().forEach(card=>{const url=card.querySelector('a').href;card.dataset.navId=url==='https://bme.seu.edu.cn/'?'college-official':'builtin:'+url;});
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.position='absolute';
    svg.innerHTML='<defs><filter id="college-tint" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" result="density"/><feComposite in="density" in2="SourceAlpha" operator="in" result="alpha"/><feFlood style="flood-color:var(--college-decoration)" result="color"/><feComposite in="color" in2="alpha" operator="in"/></filter></defs>';
    document.body.prepend(svg);
    const motif=el('img','college-background-motif');motif.id='collegeMotif';motif.alt='';motif.setAttribute('aria-hidden','true');document.querySelector('.bme-background').append(motif);
    refresh();applyIdentity();applyVisuals();
  }
  function selectCollege(id){if(!BmeColleges.profiles.some(c=>c.id===id))return false;const previous=state.college;const saved=commit({...copy(state),college:id});if(saved&&id!==previous)window.BmeAnalytics?.collegeChanged(id);return saved;}
  function setTitle(value){const text=String(value).trim();if(text.length>32){status('标题最多32个字。');return false;}return commit({...copy(state),title:text});}
  function updateGroup(group,values){const next=copy(state);Object.assign(next[group],values);return commit(normalize(next));}
  function addCategory(name){name=String(name).trim();if(!name||name.length>16){status('分类名称需为1—16个字。');return false;}if(state.categories.length>=20){status('最多支持20个分类。');return false;}if(state.categories.some(c=>c.name===name)){status('这个分类名称已存在。');return false;}const id='cat-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);return commit({...copy(state),categories:[...state.categories,{id,name,visible:true}]})?id:false;}
  function renameCategory(id,name){name=String(name).trim();if(!name||name.length>16||state.categories.some(c=>c.id!==id&&c.name===name)){status('分类名称需为1—16个字，且不能重复。');return false;}const next=copy(state);const cat=next.categories.find(c=>c.id===id);if(!cat)return false;cat.name=name;return commit(next);}
  function reorderCategory(id,offset){const next=copy(state),index=next.categories.findIndex(c=>c.id===id),target=index+offset;if(index<0||target<0||target>=next.categories.length)return false;[next.categories[index],next.categories[target]]=[next.categories[target],next.categories[index]];return commit(next);}
  function moveSite(id,category){if(!state.categories.some(c=>c.id===category))return false;const next=copy(state);next.assignments[id]=category;return commit(next);}
  function removeCategory(id,target){
    if(state.categories.length<=1){status('至少保留一个分类。');return false;}
    if(id===target||!state.categories.some(c=>c.id===target)||!state.categories.some(c=>c.id===id))return false;
    const next=copy(state);next.categories=next.categories.filter(c=>c.id!==id);
    for(const source of Object.keys(next.categoryRedirects))if(next.categoryRedirects[source]===id)next.categoryRedirects[source]=target;
    next.categoryRedirects[id]=target;
    for(const [site,cat]of Object.entries(next.assignments))if(cat===id)next.assignments[site]=target;
    nodes().filter(c=>c.dataset.category===id).forEach(c=>{next.assignments[c.dataset.navId]=target;});
    return commit(next);
  }
  function renderCategories(){
    const list=document.getElementById('personalCategories');if(!list)return;list.replaceChildren();
    state.categories.forEach((cat,index)=>{
      const row=el('div','personal-category-row');row.dataset.categoryId=cat.id;
      const name=el('input');name.value=cat.name;name.maxLength=16;name.setAttribute('aria-label','分类名称：'+cat.name);name.addEventListener('change',()=>{if(!renameCategory(cat.id,name.value))name.value=cat.name;});
      const visible=el('input');visible.type='checkbox';visible.checked=cat.visible;visible.setAttribute('aria-label','显示分类 '+cat.name);visible.addEventListener('change',()=>{const next=copy(state);next.categories.find(c=>c.id===cat.id).visible=visible.checked;commit(next);});const label=el('label','personal-check');label.append(visible,document.createTextNode('显示'));
      const up=el('button','','↑');up.type='button';up.disabled=index===0;up.setAttribute('aria-label','上移 '+cat.name);up.addEventListener('click',()=>reorderCategory(cat.id,-1));
      const down=el('button','','↓');down.type='button';down.disabled=index===state.categories.length-1;down.setAttribute('aria-label','下移 '+cat.name);down.addEventListener('click',()=>reorderCategory(cat.id,1));
      const remove=el('button','personal-danger','删除');remove.type='button';remove.disabled=state.categories.length===1;remove.addEventListener('click',()=>{
        const box=document.getElementById('categoryDelete');box.hidden=false;box.dataset.id=cat.id;document.getElementById('categoryDeleteTitle').textContent='删除“'+cat.name+'”，将其中的网站移至：';const select=document.getElementById('categoryDeleteTarget');select.replaceChildren();state.categories.filter(c=>c.id!==cat.id).forEach(c=>{const option=el('option','',c.name);option.value=c.id;select.append(option);});box.scrollIntoView?.({block:'nearest'});
      });row.append(name,label,up,down,remove);list.append(row);
    });
    const moves=document.getElementById('personalSiteMoves');moves.replaceChildren();nodes().forEach(card=>{
      const label=el('label','personal-site-move');label.append(el('span','',card.querySelector('.link-title').textContent));const select=el('select');select.setAttribute('aria-label','移动 '+card.querySelector('.link-title').textContent+' 到分类');state.categories.forEach(c=>{const option=el('option','',c.name);option.value=c.id;select.append(option);});select.value=card.dataset.category;select.addEventListener('change',()=>moveSite(card.dataset.navId,select.value));label.append(select);moves.append(label);
    });
  }
  function init(){
    if(mounted)return;mounted=true;
    const buttons=document.querySelector('.custom-site-buttons');const college=el('button','appearance-open');college.id='collegeButton';college.type='button';const personal=el('button','appearance-open','个人设置');personal.id='personalButton';personal.type='button';buttons.prepend(college,personal);
    const collegeDialog=el('dialog','personal-dialog college-dialog');collegeDialog.id='collegeDialog';collegeDialog.setAttribute('aria-labelledby','collegeHeading');collegeDialog.innerHTML='<div class="personal-heading"><h2 id="collegeHeading">选择学院</h2><button type="button" data-close aria-label="关闭学院选择">×</button></div><p class="personal-note">选择后更新学院标题、官网和背景，下次打开自动恢复。</p><input id="collegeSearch" type="search" placeholder="搜索全称、简称、拼音或首字母，如 生医 / BME / JSJ" aria-label="搜索学院"><p id="collegeResultCount" class="personal-note" role="status"></p><div id="collegeResults" class="college-results"></div><p class="personal-note">个人标题和上传壁纸会继续保留，可在个人设置中恢复学院默认。</p>';
    const settings=el('dialog','personal-dialog personal-settings-dialog');settings.id='personalDialog';settings.setAttribute('aria-labelledby','personalHeading');settings.innerHTML='<div class="personal-heading"><div><h2 id="personalHeading">个人设置</h2><p class="personal-heading-note">设置保存在当前浏览器，调整后立即生效。</p></div><button type="button" id="backgroundPreviewToggle" hidden aria-expanded="true">收起面板</button><button type="button" data-close aria-label="关闭个人设置">×</button></div><div class="personal-settings-layout"><nav class="personal-tabs" aria-label="个人设置分类"></nav><div class="personal-content"><div id="personalPanels"></div><p id="personalStatus" class="personal-status" role="status" aria-live="polite"></p></div></div>';
    document.body.append(collegeDialog,settings);
    for(const dialog of[collegeDialog,settings]){dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});}
    function renderColleges(){const query=document.getElementById('collegeSearch').value;const result=BmeColleges.search(query),list=document.getElementById('collegeResults');list.replaceChildren();document.getElementById('collegeResultCount').textContent=result.length?'匹配 '+result.length+' 个学院':'没有匹配的学院，请尝试全称或其他关键词';result.forEach(p=>{const button=el('button','college-choice');button.type='button';button.dataset.collegeId=p.id;button.setAttribute('aria-pressed',String(p.id===state.college));button.append(el('strong','',p.name),el('span','',p.short+' · '+new URL(p.url).hostname));button.addEventListener('click',()=>{if(selectCollege(p.id)){collegeDialog.close();showToast('已切换为'+p.short+'导航');}});list.append(button);});}
    college.addEventListener('click',()=>{document.getElementById('collegeSearch').value='';renderColleges();collegeDialog.showModal();document.getElementById('collegeSearch').focus();});document.getElementById('collegeSearch').addEventListener('input',renderColleges);
    const panelDefinitions=[['categories','分类管理'],['title','页面标题'],['display','显示设置'],['cards','卡片外观'],['background','背景设置']];
    function activatePanel(button,panel){const preview=panel.id==='personal-background';settings.querySelectorAll('[data-personal-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));settings.querySelectorAll('.personal-panel').forEach(p=>p.hidden=p!==panel);settings.classList.toggle('background-preview',preview);settings.classList.remove('preview-collapsed');const toggle=document.getElementById('backgroundPreviewToggle');toggle.hidden=!preview;toggle.textContent='收起面板';toggle.setAttribute('aria-expanded','true');document.getElementById('personalHeading').textContent=preview?'背景实时预览':'个人设置';status('');}
    for(const[id,name]of panelDefinitions){const button=el('button','',name);button.type='button';button.dataset.personalTab=id;button.setAttribute('aria-controls','personal-'+id);const panel=el('section','personal-panel');panel.id='personal-'+id;panel.hidden=id!=='categories';button.setAttribute('aria-pressed',String(!panel.hidden));button.addEventListener('click',()=>activatePanel(button,panel));settings.querySelector('.personal-tabs').append(button);document.getElementById('personalPanels').append(panel);}
    document.getElementById('personal-categories').innerHTML='<div class="personal-panel-intro"><h3>分类管理</h3><p>调整分类名称、显示状态与排列顺序。</p></div><div class="personal-setting-card"><div id="personalCategories"></div><form id="categoryAddForm" class="personal-inline"><input id="categoryNewName" maxlength="16" placeholder="新分类名称" aria-label="新分类名称" required><button type="submit">新增分类</button></form><div id="categoryDelete" class="category-delete" hidden><p id="categoryDeleteTitle"></p><select id="categoryDeleteTarget" aria-label="接收网站的分类"></select><button id="categoryConfirmDelete" type="button" class="personal-danger">迁移网站并删除</button><button id="categoryCancelDelete" type="button">取消</button></div></div><section class="personal-action-card"><div><h4>管理导航网站</h4><p>开启管理模式后，可从卡片右下角删除网站；默认网站之后仍可恢复。</p></div><div id="personalManageSlot"></div></section><details class="personal-setting-card"><summary>移动网站到其他分类</summary><div id="personalSiteMoves"></div></details>';
    document.getElementById('categoryAddForm').addEventListener('submit',event=>{event.preventDefault();const input=document.getElementById('categoryNewName');if(addCategory(input.value))input.value='';});document.getElementById('categoryCancelDelete').addEventListener('click',()=>document.getElementById('categoryDelete').hidden=true);document.getElementById('categoryConfirmDelete').addEventListener('click',()=>{const box=document.getElementById('categoryDelete');if(removeCategory(box.dataset.id,document.getElementById('categoryDeleteTarget').value))box.hidden=true;});
    const management=document.getElementById('siteManagementControls');if(management){document.getElementById('personalManageSlot').append(management);management.querySelector('#manageSitesButton')?.addEventListener('click',()=>settings.close());management.querySelector('#restoreSitesButton')?.addEventListener('click',()=>settings.close());}
    document.getElementById('personal-title').innerHTML='<div class="personal-panel-intro"><h3>页面标题</h3><p>创建适合自己的导航名称，留空时跟随学院切换。</p></div><div class="personal-setting-card"><label class="personal-field" for="personalTitle">自定义页面标题<input id="personalTitle" maxlength="32" placeholder="使用学院默认标题"></label><div class="personal-inline"><button type="button" id="personalSaveTitle" class="personal-primary">保存标题</button><button type="button" id="personalResetTitle">恢复学院默认</button></div></div>';
    document.getElementById('personalSaveTitle').addEventListener('click',()=>setTitle(document.getElementById('personalTitle').value));document.getElementById('personalResetTitle').addEventListener('click',()=>{document.getElementById('personalTitle').value='';setTitle('');});document.getElementById('personalTitle').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();setTitle(event.target.value);}});
    function check(panel,group,field,label){const row=el('label','personal-check personal-toggle');const input=el('input');input.type='checkbox';input.dataset.personalInput=group+'.'+field;input.addEventListener('change',()=>updateGroup(group,{[field]:input.checked}));row.append(input,document.createTextNode(label));panel.append(row);}
    function range(panel,group,field,label,min,max,unit){const row=el('label','personal-field personal-range');row.append(document.createTextNode(label));const output=el('output');const input=el('input');input.type='range';input.min=min;input.max=max;input.dataset.unit=unit;input.dataset.personalInput=group+'.'+field;input.addEventListener('input',()=>{output.textContent=input.value+unit;});input.addEventListener('change',()=>updateGroup(group,{[field]:Number(input.value)}));row.append(output,input);panel.append(row);}
    function select(panel,group,field,label,choices){const row=el('label','personal-field',label);const input=el('select');input.dataset.personalInput=group+'.'+field;for(const[value,text]of choices){const option=el('option','',text);option.value=value;input.append(option);}input.addEventListener('change',()=>updateGroup(group,{[field]:field==='columns'?Number(input.value):input.value}));row.append(input);panel.append(row);}
    const display=document.getElementById('personal-display');display.innerHTML='<div class="personal-panel-intro"><h3>显示设置</h3><p>控制页面上辅助信息和推荐内容的显示。</p></div><div class="personal-setting-card personal-toggle-grid" id="personalDisplayControls"></div>';const displayControls=document.getElementById('personalDisplayControls');for(const[field,label]of [['clock','显示实时时钟'],['kicker','显示学院说明'],['motto','显示右上校训'],['footer','显示底部装饰'],['projects','显示实用项目与脚本']])check(displayControls,'display',field,label);
    const cardPanel=document.getElementById('personal-cards');cardPanel.innerHTML='<div class="personal-panel-intro"><h3>卡片外观</h3><p>调整导航卡片的大小、列数和毛玻璃效果。</p></div><div class="personal-setting-card personal-control-grid" id="personalCardControls"></div>';const cardControls=document.getElementById('personalCardControls');select(cardControls,'cards','density','卡片密度',[['compact','紧凑'],['standard','标准'],['spacious','宽松']]);select(cardControls,'cards','columns','桌面每行卡片数',[[2,'2列'],[3,'3列'],[4,'4列'],[5,'5列']]);range(cardControls,'cards','radius','圆角',0,24,'px');range(cardControls,'cards','opacity','卡片底色浓度',0,80,'%');range(cardControls,'cards','blur','毛玻璃模糊',0,30,'px');check(cardControls,'cards','numbers','显示网站序号');cardPanel.append(el('p','personal-note','平板和手机会自动减少列数，保持卡片可读。'));
    const bg=document.getElementById('personal-background');bg.innerHTML='<div class="personal-panel-intro personal-preview-intro"><div><h3>背景设置</h3><p>页面保持可见，调整时可直接观察实际效果。</p></div><div class="personal-preview-actions"><button type="button" id="backgroundPreviewReset">恢复默认</button><button type="button" id="backgroundPreviewBack">返回个人设置</button></div></div><div id="personalAppearanceControls"></div><div class="personal-setting-card personal-control-grid" id="personalBackgroundControls"></div>';document.getElementById('personalAppearanceControls').append(document.getElementById('appearanceControls'));const backgroundControls=document.getElementById('personalBackgroundControls');range(backgroundControls,'background','brightness','背景明暗',50,130,'%');range(backgroundControls,'background','emblemOpacity','中间校徽浓度',0,40,'%');range(backgroundControls,'background','motifOpacity','右侧学院图案浓度',0,80,'%');check(backgroundControls,'background','motif','显示右侧学院图案');bg.append(el('p','personal-note','校徽与学院图案使用当前主题的装饰色；右侧图案默认30%。'));
    const previewToggle=document.getElementById('backgroundPreviewToggle');previewToggle.addEventListener('click',()=>{const collapsed=settings.classList.toggle('preview-collapsed');previewToggle.textContent=collapsed?'展开背景设置':'收起面板';previewToggle.setAttribute('aria-expanded',String(!collapsed));});document.getElementById('backgroundPreviewBack').addEventListener('click',()=>settings.querySelector('[data-personal-tab="categories"]').click());document.getElementById('backgroundPreviewReset').addEventListener('click',()=>{document.querySelector('[data-theme-choice="white"]')?.click();document.querySelector('[data-wallpaper-choice="molecular"]')?.click();updateGroup('background',copy(defaults.background));showToast('背景已恢复默认');});
    personal.addEventListener('click',()=>{renderCategories();applyVisuals();status('');settings.classList.remove('preview-collapsed');if(settings.classList.contains('background-preview')){previewToggle.textContent='收起面板';previewToggle.setAttribute('aria-expanded','true');}settings.showModal();});refresh();applyIdentity();applyVisuals();
  }
  window.BmePersonalization={prepare,init,refresh,getCategories,categoryName,isCategoryVisible,isProjectsVisible:()=>state.display.projects,resolveCategory,getState:()=>copy(state),selectCollege,setTitle,updateCards:values=>updateGroup('cards',values),updateDisplay:values=>updateGroup('display',values),updateBackground:values=>updateGroup('background',values),addCategory,renameCategory,reorderCategory,moveSite,removeCategory};
})();
