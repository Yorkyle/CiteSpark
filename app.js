(function(){
  const $ = (id) => document.getElementById(id);

  // Prefill accessed with today
  const today = new Date().toISOString().slice(0,10);
  $("accessed").value = today;

  // Read query params for bookmarklet handoff
  const params = new URLSearchParams(location.search);
  if (params.get('t')) $("title").value = decodeURIComponent(params.get('t'));
  if (params.get('u')) $("url").value = decodeURIComponent(params.get('u'));
  if (params.get('s')) $("site").value = decodeURIComponent(params.get('s'));
  if (params.get('a')) $("author").value = decodeURIComponent(params.get('a'));
  if (params.get('d')) $("date").value = decodeURIComponent(params.get('d'));

  function formatDateMLA(iso){
    if(!iso) return "";
    const d = new Date(iso); if (isNaN(d)) return iso;
    const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  function formatDateAPA(iso){
    if(!iso) return "";
    const d = new Date(iso); if (isNaN(d)) return iso;
    const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
    return `${d.getFullYear()}, ${months[d.getMonth()]} ${d.getDate()}`;
  }

  function formatByStyle(d){
    if ($("style").value === "APA"){
      const author = d.author ? `${d.author}. ` : "";
      const date = d.date ? `(${formatDateAPA(d.date)}). ` : "";
      const title = d.title ? `${d.title}. ` : "";
      const site = d.site ? `${d.site}. ` : "";
      return `${author}${date}${title}${site}${d.url}`.replace(/\s+/g,' ').trim();
    }
    if ($("style").value === "Chicago"){
      const author = d.author ? `${d.author}. ` : "";
      const title = d.title ? `"${d.title}." ` : "";
      const site = d.site ? `${d.site}. ` : "";
      const date = d.date ? `${formatDateAPA(d.date)}. ` : "";
      return `${author}${title}${site}${d.url ? d.url : ""}`.replace(/\s+/g,' ').trim();
    }
    // MLA
    const author = d.author ? `${d.author}. ` : "";
    const title = d.title ? `"${d.title}." ` : "";
    const site = d.site ? `${d.site}, ` : "";
    const date = d.date ? `${formatDateMLA(d.date)}, ` : "";
    const access = d.accessed ? `Accessed ${formatDateMLA(d.accessed)}.` : "";
    return `${author}${title}${site}${date}${d.url ? d.url + ". " : ""}${access}`.replace(/\s+/g,' ').trim();
  }

  function collect(){
    return {
      author:$("author").value.trim(),
      title:$("title").value.trim(),
      site:$("site").value.trim(),
      date:$("date").value.trim(),
      url:$("url").value.trim(),
      accessed:$("accessed").value.trim()
    };
  }

  function coachHints(d){
    const issues=[];
    if(!d.author) issues.push("Missing author (use organization if no person listed).");
    if(!d.title) issues.push("Missing title (use page/article title).");
    if(!d.site) issues.push("Missing site/publisher name.");
    if(!d.date) issues.push("Missing publish date (try to find posted/updated date).");
    if(d.url && !/^https?:\/\//i.test(d.url)) issues.push("URL should start with https://");
    return issues.length ? "• " + issues.join("\n• ") : "Looks complete. Nice!";
  }

  function render(){
    const d = collect();
    $("preview").textContent = formatByStyle(d);
    $("hints").textContent = coachHints(d);
  }

  ["author","title","site","date","url","accessed","style"].forEach(id => $(id).addEventListener("input", render));
  render();

  $("copy").onclick = () => navigator.clipboard.writeText($("preview").textContent);
  $("copyInText").onclick = () => {
    const d = collect();
    const last = d.author ? (d.author.split(',')[0] || d.author.split(' ').slice(-1)[0] || d.author) : '"Title"';
    const page = $("page").value.trim();
    const text = page ? `(${last} ${page})` : `(${last})`;
    navigator.clipboard.writeText(text);
  };

  const BIB_KEY = "cspk-web-bib";
  function loadBib(){ try{ return JSON.parse(localStorage.getItem(BIB_KEY) || "[]"); }catch{ return [];} }
  function saveBib(arr){ localStorage.setItem(BIB_KEY, JSON.stringify(arr.slice(0,500))); }
  function renderBib(){
    const list = loadBib();
    $("bib").innerHTML = list.length ? list.map(x=>`<div class="chip">${x.text}</div>`).join("") : "<small>No entries yet.</small>";
  }

  $("add").onclick = () => {
    const d = collect();
    const text = formatByStyle(d);
    const list = loadBib();
    list.unshift({text, ts: Date.now(), url: d.url, style: $("style").value});
    saveBib(list); renderBib();
  };

  $("copyList").onclick = () => {
    const txt = loadBib().map(x=>x.text).join("\n");
    navigator.clipboard.writeText(txt);
  };
  $("downloadList").onclick = () => {
    const txt = loadBib().map(x=>x.text).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], {type:"text/plain"}));
    a.download = "works_cited.txt"; a.click();
  };
  $("clearList").onclick = () => { saveBib([]); renderBib(); };

  renderBib();

  // PWA install prompt
  let deferred;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferred = e; $("installBtn").style.display = "inline-block";
  });
  $("installBtn").onclick = async () => { if(deferred){ deferred.prompt(); deferred=null; $("installBtn").style.display="none"; } };

  // Generate bookmarklet
  $("bookmarkletBtn").onclick = () => {
    const code = `javascript:(function(){var m=document.querySelector.bind(document);var t=document.title;var u=location.href;var s=(m('meta[property=\\"og:site_name\\"]')||{}).content||(location.hostname||'');var a=(m('meta[name=\\"author\\"]')||m('meta[property=\\"article:author\\"]')||{}).content||'';var d=(m('meta[property=\\"article:published_time\\"]')||m('meta[name=\\"date\\"]')||{}).content||'';var app='${location.origin+location.pathname}';var q='?t='+encodeURIComponent(t)+'&u='+encodeURIComponent(u)+'&s='+encodeURIComponent(s)+'&a='+encodeURIComponent(a)+'&d='+encodeURIComponent(d);location.href=app+q;})();`;
    const ta = document.createElement('textarea'); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    alert('Bookmarklet code copied! Create a bookmark, paste this as the URL. While on an article, tap it to send metadata here.');
  };
})();