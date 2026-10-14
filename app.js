(function(){
  const data = Array.isArray(window.AXEL_PUBLICATIONS) ? window.AXEL_PUBLICATIONS : [];
  const downloads = window.AXEL_DOWNLOADS || {};
  const $ = id => document.getElementById(id);
  const state = {search:"",category:"",nosology:"",year:"",author:"",message:"",sort:"new",limit:12};
  const esc = value => String(value || "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const normal = value => String(value || "").toLocaleLowerCase("ru-RU").replace(/ё/g,"е");
  const uniqueNormalized = values => [...new Map(values.map(value=>String(value || "").trim()).filter(Boolean).map(value=>[normal(value),value])).values()];
  const unique = key => [...new Set(data.map(x=>x[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"ru"));
  const plural = (n,forms) => forms[(n%10===1&&n%100!==11)?0:(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))?1:2];
  const shortCategory = value => value.replace(/^\s+/,"").replace(/\s*\([^)]*\)/g,"").replace("ОБЩИЕ / ОБЗОРНЫЕ / ЭКСПЕРИМЕНТАЛЬНЫЕ","Общие и обзорные").replace("ТЕРМОИНГАЛЯЦИОННАЯ ТРАВМА / ОЖОГИ","Термоингаляционная травма").replace("Прочее (тезисы, формуляры и пр.)","Прочее").replace("ОНКОЛОГИЧЕСКИЕ ПАЦИЕНТЫ/ХИРУРГИЯ","Онкологические пациенты").replace("ОНКОЛОГИЯ/ХИРУРГИЯ","Онкологические пациенты").replace("КАРДИОЛОГИЯ/ХИРУРГИЯ","Кардиология и хирургия").replace("КАРДИОХИРУРГИЯ","Кардиохирургия").replace("АКУШЕРСТВО И ГИНЕКОЛОГИЯ","Акушерство").replace("ПУЛЬМОНОЛОГИЯ","Пульмонология").replace("НЕОНАТОЛОГИЯ","Неонатология");
  const isHiddenCategory = value => shortCategory(String(value || "")) === "Общие и обзорные";
  const cleanSummary = item => item.abstract || item.conclusions || "Подробная информация представлена в карточке материала.";
  const cleanLongText = value => String(value || "")
    .replace(/([A-Za-zА-Яа-яЁё])-\s*[\r\n]+\s*([A-Za-zА-Яа-яЁё])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
  const keyMessage = item => String(item.keyMessages || "").replace(/^\s*КЛЮЧЕВАЯ\s*:\s*/i, "").trim();
  const normalizeAuthor = value => String(value || "")
    .replace(/\s+и\s+(?:др\.?|соавт\.?)\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^([A-ZА-ЯЁ])\s*\.\s*([A-ZА-ЯЁ])\s*\.\s*/i, "$1.$2. ")
    .trim();
  const itemAuthors = item => String(item.authors || "").split(/[,;\n]+/).map(normalizeAuthor).filter(value => value && /[A-Za-zА-Яа-яЁё]/.test(value));
  const authorValues = () => [...new Set(data.flatMap(itemAuthors))].sort((a,b)=>a.localeCompare(b,"ru"));
  const messageValues = () => uniqueNormalized(data.flatMap(item=>String(keyMessage(item) || "").split(/[,;]+/))).sort((a,b)=>a.localeCompare(b,"ru"));
  const searchSuggestionValues = () => uniqueNormalized(data.flatMap(item=>[
    item.nosology,
    ...String(keyMessage(item) || "").split(/[,;]+/)
  ])).filter(value=>value.length>=2).sort((a,b)=>a.localeCompare(b,"ru"));
  const addOptions = (id, values, label = value => value) => values.forEach(value=>{const option=document.createElement("option");option.value=value;option.textContent=label(value);$(id).append(option);});
  const keyMessageHtml = item => {
    const message = keyMessage(item);
    if (!message) return "";
    const warning = /не используем|не использовать/i.test(message) ? " warning" : "";
    return `<div class="key-message${warning}"><span>Ключевое сообщение</span><p>${esc(message)}</p></div>`;
  };
  const safeUrl = value => { const raw=String(value||"").trim(); if(!raw)return ""; const url=/^https?:\/\//i.test(raw)?raw:`https://${raw}`; return /^https?:\/\//i.test(url)?url:""; };
  const pdfUrl = id => downloads[id] ? new URL(`assets/pdfs/${String(downloads[id]).replace(/^\//,"")}`, document.baseURI).href : "";

  function populateSelect(id,key){ unique(key).filter(v=>key!=="category"||!isHiddenCategory(v)).forEach(v=>{const o=document.createElement("option");o.value=v;o.textContent=key==="category"?shortCategory(v):v;$(id).append(o);}); }
  function init(){
    populateSelect("categoryFilter","category");populateSelect("nosologyFilter","nosology");populateSelect("yearFilter","year");
    addOptions("authorFilter",authorValues());
    addOptions("messageFilter",messageValues(),value=>value.length>90?`${value.slice(0,87)}…`:value);
    addOptions("searchSuggestions",searchSuggestionValues());
    renderChips();bind();render();setupGate();setupPwa();openFromHash();
  }
  function filtered(){
    const q=normal(state.search);
    const fields=["title","authors","journal","category","nosology","workType","design","abstract","conclusions","keyMessages","audience","citation"];
    const items=data.filter(x=>(!q||fields.some(k=>normal(x[k]).includes(q)))&&(!state.category||x.category===state.category)&&(!state.nosology||x.nosology===state.nosology)&&(!state.year||String(x.year)===state.year)&&(!state.author||itemAuthors(x).some(author=>normal(author)===normal(state.author)))&&(!state.message||normal(keyMessage(x)).includes(normal(state.message))));
    return items.sort((a,b)=>state.sort==="title"?a.title.localeCompare(b.title,"ru"):state.sort==="old"?(Number(a.year)||0)-(Number(b.year)||0):(Number(b.year)||0)-(Number(a.year)||0));
  }
  function render(){
    const items=filtered(),shown=items.slice(0,state.limit);$("cards").innerHTML=shown.map(card).join("");$("emptyState").hidden=items.length>0;$("showMore").hidden=shown.length>=items.length;
    const active=[state.category,state.nosology,state.year,state.author,state.message].filter(Boolean).length;$("filterBadge").hidden=!active;$("filterBadge").textContent=active;document.querySelectorAll(".category-chips button").forEach(b=>b.classList.toggle("active",b.dataset.value===state.category));
    document.querySelectorAll(".open-details").forEach(b=>b.addEventListener("click",()=>openDetails(Number(b.dataset.id))));
    document.querySelectorAll(".share-publication").forEach(b=>b.addEventListener("click",()=>sharePublication(Number(b.dataset.id),b)));
    document.querySelectorAll(".share-pdf").forEach(b=>b.addEventListener("click",()=>sharePdfPublication(Number(b.dataset.id),b)));
    document.querySelectorAll(".download-publication").forEach(b=>b.addEventListener("click",()=>downloadPublication(Number(b.dataset.id),b)));
  }
  function card(x){const href=safeUrl(x.url);const url=href?`<a href="${esc(href)}" target="_blank" rel="noopener">Источник ↗</a>`:"";const download=downloads[x.id]?`<button class="download-publication" data-id="${x.id}">Скачать PDF ↓</button><button class="share-pdf" data-id="${x.id}">↗ Поделиться PDF</button>`:"";return `<article class="publication-card"><div class="card-top"><span class="card-year">${esc(x.year||"Год не указан")}</span><span class="card-type">${esc(x.workType||"Научный материал")}</span></div><h3>${esc(x.title)}</h3><p class="journal">${esc(x.journal)}</p>${x.authors?`<p class="card-authors"><span>Авторы:</span> ${esc(x.authors)}</p>`:""}<button class="open-details card-details" data-id="${x.id}">Подробнее</button><p class="card-summary">${esc(cleanSummary(x))}</p><div class="card-meta">${x.nosology?`<span>${esc(x.nosology)}</span>`:""}${x.patients?`<span>${esc(x.patients)}</span>`:""}</div><div class="card-actions">${url}${download}<button class="share-publication" data-id="${x.id}">↗ Поделиться источником</button></div></article>`}
  function renderChips(){const cats=unique("category").filter(category=>!isHiddenCategory(category));$("categoryChips").innerHTML=`<button class="active" data-value="">Все</button>`+cats.map(c=>`<button data-value="${esc(c)}">${esc(shortCategory(c))}</button>`).join("");$("categoryChips").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;state.category=b.dataset.value;$("categoryFilter").value=state.category;state.limit=12;render();});}
  function detailBlock(title,text,wide=false){const cleaned=cleanLongText(text);return cleaned?`<section class="detail-block${wide?" wide":""}"><h3>${title}</h3><p>${esc(cleaned)}</p></section>`:"";}
  function publicationUrl(id){const url=new URL(location.href);url.search="";url.hash=`publication-${id}`;return url.href;}
  async function sharePublication(id,button){const x=data.find(item=>item.id===id);if(!x)return;const sourceUrl=safeUrl(x.url)||publicationUrl(id);const payload={title:x.title,text:`${x.title} — ${x.journal || "Библиотека данных Сурфактант-БЛ"}`,url:sourceUrl};try{if(navigator.share){await navigator.share(payload);return;}await navigator.clipboard.writeText(payload.url);const old=button.textContent;button.textContent="Ссылка скопирована ✓";setTimeout(()=>button.textContent=old,2200);}catch(error){if(error && error.name!=="AbortError")button.textContent="Не удалось";}}
  async function sharePdfPublication(id,button){const x=data.find(item=>item.id===id),url=pdfUrl(id);if(!x||!url)return;const payload={title:`PDF: ${x.title}`,text:x.title,url};try{if(navigator.share){await navigator.share(payload);return;}await navigator.clipboard.writeText(url);const old=button.textContent;button.textContent="Ссылка на PDF скопирована ✓";setTimeout(()=>button.textContent=old,2400);}catch(error){if(error&&error.name!=="AbortError")button.textContent="Не удалось";}}
  function downloadPublication(id,button){const url=pdfUrl(id);if(!url)return;const anchor=document.createElement("a");anchor.href=url;anchor.download=String(downloads[id]).replace(/^\//,"");anchor.rel="noopener";document.body.append(anchor);anchor.click();anchor.remove();const old=button.textContent;button.textContent="Скачивание началось ✓";setTimeout(()=>button.textContent=old,2200);}
  function openDetails(id){const x=data.find(i=>i.id===id);if(!x)return;const href=safeUrl(x.url);const link=href?`<a href="${esc(href)}" target="_blank" rel="noopener">Открыть источник ↗</a>`:"";const download=downloads[x.id]?`<button class="detail-download" type="button">Скачать PDF ↓</button><button class="detail-share-pdf" type="button">↗ Поделиться PDF</button>`:"";$("detailsContent").innerHTML=`<p class="detail-kicker">${esc(shortCategory(x.category))} · ${esc(x.year)}</p><h2 id="detailsTitle">${esc(x.title)}</h2><p class="detail-journal">${esc(x.journal)}${x.authors?`<br>${esc(x.authors)}`:""}</p><div class="detail-tags">${[x.workType,x.nosology,x.patients,x.audience].filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join("")}</div><div class="detail-grid">${detailBlock("Резюме",x.abstract,true)}${detailBlock("Дизайн",x.design)}${detailBlock("Способ введения",x.administration)}${detailBlock("Основные выводы",x.conclusions,true)}${detailBlock("Как цитировать",x.citation,true)}</div><div class="detail-footer">${link}${download}${x.citation?`<button class="copy-citation" type="button">Скопировать цитату</button>`:""}<button class="detail-share" type="button">↗ Поделиться источником</button></div>`;$("detailsModal").hidden=false;document.body.classList.add("locked");const copy=document.querySelector(".copy-citation");if(copy)copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(x.citation);copy.textContent="Скопировано ✓";}catch{copy.textContent="Не удалось скопировать";}});const downloadButton=document.querySelector(".detail-download");if(downloadButton)downloadButton.addEventListener("click",()=>downloadPublication(x.id,downloadButton));const sharePdf=document.querySelector(".detail-share-pdf");if(sharePdf)sharePdf.addEventListener("click",()=>sharePdfPublication(x.id,sharePdf));const share=document.querySelector(".detail-share");if(share)share.addEventListener("click",()=>sharePublication(x.id,share));$("detailsClose").focus();}
  function openFromHash(){const match=location.hash.match(/^#publication-(\d+)$/);if(match)openDetails(Number(match[1]));}
  function closeDetails(){$("detailsModal").hidden=true;document.body.classList.remove("locked");}
  function bind(){
    $("searchInput").addEventListener("input",e=>{state.search=e.target.value;state.limit=12;render();});
    $("searchButton").addEventListener("click",()=>{state.search=$("searchInput").value.trim();state.limit=12;render();$("cards").scrollIntoView({behavior:"smooth",block:"start"});});
    $("searchInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("searchButton").click();}});
    [["categoryFilter","category"],["nosologyFilter","nosology"],["yearFilter","year"],["authorFilter","author"],["messageFilter","message"],["sortSelect","sort"]].forEach(([id,key])=>$(id).addEventListener("change",e=>{state[key]=e.target.value;state.limit=12;render();}));
    $("filterToggle").addEventListener("click",()=>{const hidden=!$("filters").hidden;$("filters").hidden=hidden;$("filterToggle").setAttribute("aria-expanded",String(!hidden));});
    $("clearButton").addEventListener("click",()=>{Object.assign(state,{search:"",category:"",nosology:"",year:"",author:"",message:"",sort:"new",limit:12});["searchInput","categoryFilter","nosologyFilter","yearFilter","authorFilter","messageFilter"].forEach(id=>$(id).value="");$("sortSelect").value="new";render();});
    $("showMore").addEventListener("click",()=>{state.limit+=12;render();});$("detailsClose").addEventListener("click",closeDetails);$("detailsModal").addEventListener("click",e=>{if(e.target===$("detailsModal"))closeDetails();});
    document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("searchInput").focus();}if(e.key==="Escape"&&!$("detailsModal").hidden)closeDetails();});
    window.addEventListener("hashchange",openFromHash);
  }
  function setupGate(){const exit=()=>location.href="https://axelpharm.ru/";if(sessionStorage.getItem("axel-med-worker")==="yes"){$("medGate").hidden=true;document.body.classList.remove("locked");return;}$("gateYes").addEventListener("click",()=>{sessionStorage.setItem("axel-med-worker","yes");$("medGate").hidden=true;document.body.classList.remove("locked");});$("gateNo").addEventListener("click",exit);$("gateClose").addEventListener("click",exit);}
  function setupPwa(){let prompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();prompt=e;$("installButton").hidden=false;});$("installButton").addEventListener("click",async()=>{if(!prompt)return;prompt.prompt();await prompt.userChoice;prompt=null;$("installButton").hidden=true;});if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));}
  init();
})();
