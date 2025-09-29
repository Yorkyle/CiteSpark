(function(){
  const $ = (id) => document.getElementById(id);

  // Prefill accessed with today
  const today = new Date().toISOString().slice(0,10);
  if ($("accessed")) $("accessed").value = today;

  // Read query params for bookmarklet handoff (web pages)
  const params = new URLSearchParams(location.search);
  if (params.get('t') && $("title")) $("title").value = decodeURIComponent(params.get('t'));
  if (params.get('u') && $("url")) $("url").value = decodeURIComponent(params.get('u'));
  if (params.get('s') && $("site")) $("site").value = decodeURIComponent(params.get('s'));
  if (params.get('a') && $("author")) $("author").value = decodeURIComponent(params.get('a'));
  if (params.get('d') && $("date")) $("date").value = decodeURIComponent(params.get('d'));

  // ==== Date helpers
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

  // ==== Author name helpers
  function splitAuthors(raw) {
    if (!raw) return [];
    const s = raw.replace(/\s+&\s+/g, " and ");
    let parts = s.split(/\s+and\s+|;|\s*\|\s*/i);
    if (parts.length === 1 && /,/.test(raw) && !/,\s*Jr\.?$/i.test(raw)) {
      parts = raw.split(/\s+and\s+/i);
    }
    return parts.map(p => p.trim()).filter(Boolean);
  }

  function toLastFirst(name) {
    if (/,/.test(name)) return name.trim(); // already Last, First
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const last = parts.pop();
    const firstMiddle = parts.join(" ");
    return `${last}, ${firstMiddle}`;
  }

  function initials(str) {
    return str
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0].toUpperCase() + ".")
      .join(" ");
  }

  function formatAuthorsByStyle(raw, style) {
    const authors = splitAuthors(raw);
    if (authors.length === 0) return "";

    if (style === "APA") {
      // Last, F. M., Last, F. M., & Last, F. M.
      const formatted = authors.map(a => {
        if (/,/.test(a)) {
          const [last, rest=""] = a.split(",").map(x=>x.trim());
          return `${last}, ${initials(rest)}`;
        } else {
          const parts = a.split(/\s+/);
          const last = parts.pop();
          const firstMiddle = parts.join(" ");
          return `${last}, ${initials(firstMiddle)}`;
        }
      });
      if (formatted.length === 1) return formatted[0];
      if (formatted.length === 2) return `${formatted[0]} & ${formatted[1]}`;
      return formatted.slice(0, -1).join(", ") + ", & " + formatted.slice(-1);
    }

    // MLA & Chicago: Last, First Middle; commas, "and" before last
    const formatted = authors.map(a => toLastFirst(a));
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`;
    return formatted.slice(0, -1).join(", ") + ", and " + formatted.slice(-1);
  }

  // ==== Title casing helpers
  function titleCase(str=""){
    const small = new Set(["a","an","and","as","at","but","by","for","in","nor","of","on","or","per","the","to","vs","via","with","over","under","into","onto","from","up","down","so","yet"]);
    return String(str)
      .toLowerCase()
      .split(/\s+/)
      .map((w,i,arr)=>{
        // hyphenated words
        const cap = (s)=> s ? s[0].toUpperCase()+s.slice(1) : s;
        if (w.includes("-")){
          return w.split("-").map(p => cap(p)).join("-");
        }
        if (i===0 || i===arr.length-1 || !small.has(w)) return cap(w);
        return w;
      })
      .join(" ");
  }
  function sentenceCase(str=""){
    const s = String(str).trim();
    if (!s) return s;
    const lower = s.toLowerCase();
    return lower[0].toUpperCase() + lower.slice(1);
  }

  // ==== ISBN Lookup (Open Library) + normalization
  async function lookupISBN(isbn13){
    try {
      const clean = isbn13.replace(/[^0-9X]/gi,'');
      const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&jscmd=data&format=json`;
      const res = await fetch(url);
      const data = await res.json();
      const book = data[`ISBN:${clean}`];
      if (book){
        if (book.title) $("bookTitle").value = book.title;
        if (book.publish_date) $("year").value = book.publish_date.replace(/\D/g,'');
        if (book.publishers && book.publishers.length) $("publisher").value = book.publishers[0].name;
        if (book.authors && book.authors.length) $("bookAuthor").value = book.authors.map(a=>a.name).join(", ");
        render();
      } else {
        alert("No book found for that ISBN.");
      }
    } catch(err){
      console.error(err);
      alert("Error fetching ISBN data.");
    }
  }
  function toISBN13(isbn10) {
    const clean10 = isbn10.replace(/[^0-9X]/gi, "");
    if (clean10.length !== 10) return null;
    const base = "978" + clean10.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    return base + check;
  }
  function normalizeISBN(val) {
    const clean = val.replace(/[^0-9X]/gi, "");
    if (clean.length === 10) return toISBN13(clean);
    if (clean.length === 13) return clean;
    return null;
  }

  // ==== Gather inputs
  function collect(){
    return {
      // web/article
      author: $("author")?.value.trim() || "",
      title: $("title")?.value.trim() || "",
      site: $("site")?.value.trim() || "",
      date: $("date")?.value.trim() || "",
      url: $("url")?.value.trim() || "",
      accessed: $("accessed")?.value.trim() || "",

      // book
      bookAuthor: $("bookAuthor")?.value.trim() || "",
      bookTitle: $("bookTitle")?.value.trim() || "",
      publisher: $("publisher")?.value.trim() || "",
      year: $("year")?.value.trim() || "",
      edition: $("edition")?.value.trim() || "",
      city: $("city")?.value.trim() || "",
      chapterTitle: $("chapterTitle")?.value.trim() || "",
      pages: $("pages")?.value.trim() || "",
      isbn: $("isbn")?.value.trim() || ""
    };
  }

  // ==== Formatters
  function formatBook(d){
    const style = $("style").value;
    const authorOut = formatAuthorsByStyle(d.bookAuthor, style);

    const hasChapter = !!d.chapterTitle || !!d.pages;
    const edMLAChicago = d.edition ? `${d.edition}. ` : "";
    const edAPA = d.edition ? ` (${d.edition})` : "";
    const city = d.city ? `${d.city}: ` : "";
    const pagesMLA = d.pages ? `pp. ${d.pages}.` : "";
    const pagesChicago = d.pages ? `pp. ${d.pages}.` : "";
    const pagesAPA = d.pages ? `(pp. ${d.pages})` : "";

    const bookTitleOut = style === "APA" ? sentenceCase(d.bookTitle) : titleCase(d.bookTitle);
    const chapterOut   = style === "APA" ? sentenceCase(d.chapterTitle) : titleCase(d.chapterTitle);

    if (style === "APA"){
      if (hasChapter){
        // Author. (Year). Chapter. In Book (ed) (pp. xx–yy). Publisher.
        return `${authorOut ? authorOut + ". " : ""}`
             + `${d.year ? `(${d.year}). ` : ""}`
             + `${chapterOut ? chapterOut + ". " : ""}`
             + `In ${bookTitleOut || ""}${edAPA}${d.pages ? ` ${pagesAPA}` : ""}. `
             + `${d.publisher ? d.publisher + "." : ""}`
             .replace(/\s+/g,' ').trim();
      }
      return `${authorOut ? authorOut + ". " : ""}`
           + `${d.year ? `(${d.year}). ` : ""}`
           + `${bookTitleOut || ""}${edAPA}. `
           + `${d.publisher ? d.publisher + "." : ""}`
           .replace(/\s+/g,' ').trim();
    }

    if (style === "Chicago"){
      if (hasChapter){
        // Author. "Chapter." In Book, pp. xx–yy. City: Publisher, Year.
        return `${authorOut ? authorOut + ". " : ""}`
             + `${chapterOut ? `"${chapterOut}." ` : ""}`
             + `In ${bookTitleOut ? bookTitleOut + ", " : ""}`
             + `${d.pages ? pagesChicago + " " : ""}`
             + `${city}${d.publisher ? d.publisher + ", " : ""}${d.year ? d.year + "." : ""}`
             .replace(/\s+/g,' ').trim();
      }
      return `${authorOut ? authorOut + ". " : ""}`
           + `${bookTitleOut ? bookTitleOut + ". " : ""}`
           + `${d.edition ? d.edition + ". " : ""}`
           + `${city}${d.publisher ? d.publisher + ", " : ""}${d.year ? d.year + "." : ""}`
           .replace(/\s+/g,' ').trim();
    }

    // MLA
    if (hasChapter){
      // Author. "Chapter." Book Title. Publisher, Year, pp. xx–yy.
      return `${authorOut ? authorOut + ". " : ""}`
           + `${chapterOut ? `"${chapterOut}." ` : ""}`
           + `${bookTitleOut ? bookTitleOut + ". " : ""}`
           + `${d.publisher ? d.publisher + ", " : ""}${d.year ? d.year + ", " : ""}`
           + `${pagesMLA}`
           .replace(/\s+/g,' ').trim();
    }
    // Whole book
    return `${authorOut ? authorOut + ". " : ""}`
         + `${bookTitleOut ? bookTitleOut + ". " : ""}`
         + `${d.edition ? d.edition + ". " : ""}`
         + `${d.publisher ? d.publisher + ", " : ""}${d.year ? d.year + "." : ""}`
         .replace(/\s+/g,' ').trim();
  }

  function formatWeb(d){
    const style = $("style").value;
    const authorOut = formatAuthorsByStyle(d.author, style);
    const titleOut = style === "APA" ? sentenceCase(d.title) : titleCase(d.title);

    if (style === "APA"){
      const author = authorOut ? `${authorOut}. ` : "";
      const date = d.date ? `(${formatDateAPA(d.date)}). ` : "";
      const title = titleOut ? `${titleOut}. ` : "";
      const site = d.site ? `${d.site}. ` : "";
      return `${author}${date}${title}${site}${d.url}`.replace(/\s+/g,' ').trim();
    }
    if (style === "Chicago"){
      const author = authorOut ? `${authorOut}. ` : "";
      const title = titleOut ? `"${titleOut}." ` : "";
      const site = d.site ? `${d.site}. ` : "";
      const date = d.date ? `${formatDateAPA(d.date)}. ` : "";
      return `${author}${title}${site}${date}${d.url || ""}`.replace(/\s+/g,' ').trim();
    }
    // MLA
    const author = authorOut ? `${authorOut}. ` : "";
    const title = titleOut ? `"${titleOut}." ` : "";
    const site = d.site ? `${d.site}, ` : "";
    const date = d.date ? `${formatDateMLA(d.date)}, ` : "";
    const access = d.accessed ? `Accessed ${formatDateMLA(d.accessed)}.` : "";
    return `${author}${title}${site}${date}${d.url ? d.url + ". " : ""}${access}`.replace(/\s+/g,' ').trim();
  }

  function isBookData(d){
    return !!d.bookTitle || !!d.bookAuthor || !!d.publisher || !!d.year || !!d.chapterTitle || !!d.pages;
  }

  function formatByStyle(d){
    return isBookData(d) ? formatBook(d) : formatWeb(d);
  }

  // ==== Hints (context-aware)
  function coachHints(d){
    const issues=[];
    if (isBookData(d)){
      if (!d.bookAuthor) issues.push("Book: missing author.");
      if (!d.bookTitle) issues.push("Book: missing title.");
      if (!d.publisher) issues.push("Book: missing publisher.");
      if (!d.year) issues.push("Book: missing year.");
    } else {
      if (!d.author) issues.push("Web: missing author (use organization if no person listed).");
      if (!d.title) issues.push("Web: missing article/page title.");
      if (!d.site) issues.push("Web: missing site/publisher name.");
      if (!d.date) issues.push("Web: missing publish date (try to find posted/updated date).");
      if (d.url && !/^https?:\/\//i.test(d.url)) issues.push("URL should start with https://");
    }
    return issues.length ? "• " + issues.join("\n• ") : "Looks complete. Nice!";
  }

  // ==== Render
  function render(){
    const d = collect();
    $("preview").textContent = formatByStyle(d);
    $("hints").textContent = coachHints(d);
  }

  ["author","title","site","date","url","accessed","style","bookAuthor","bookTitle","publisher","year","edition","city","chapterTitle","pages","isbn"]
    .forEach(id => { if($(id)) $(id).addEventListener("input", render); });
  render();

  // ==== Actions
  $("copy").onclick = () => navigator.clipboard.writeText($("preview").textContent);

  $("copyInText").onclick = () => {
    const d = collect();
    const style = $("style").value;
    const src = isBookData(d) ? d.bookAuthor : d.author;
    const formatted = formatAuthorsByStyle(src, style);
    // First author's last name for MLA in-text
    let last = "";
    if (formatted) {
      const firstAuthor = formatted.split(/, and | and |, & | & |, /)[0];
      if (/,/.test(firstAuthor)) last = firstAuthor.split(",")[0];
      else {
        const parts = firstAuthor.trim().split(/\s+/);
        last = parts.length ? parts[parts.length-1] : "";
      }
    } else {
      last = '"Title"';
    }
    const firstPageFromRange = d.pages ? (d.pages.match(/\d+/)?.[0] || "") : "";
    const page = $("page").value.trim() || firstPageFromRange;
    const text = page ? `(${last} ${page})` : `(${last})`;
    navigator.clipboard.writeText(text);
  };

  // Works Cited storage
  const BIB_KEY = "cspk-web-bib";
  const loadBib = () => { try{ return JSON.parse(localStorage.getItem(BIB_KEY) || "[]"); }catch{ return [];} };
  const saveBib = (arr) => localStorage.setItem(BIB_KEY, JSON.stringify(arr.slice(0,500)));
  function renderBib(){
    const list = loadBib();
    $("bib").innerHTML = list.length ? list.map(x=>`<div class="chip">${x.text}</div>`).join("") : "<small>No entries yet.</small>";
  }
  renderBib();

  $("add").onclick = () => {
    const d = collect();
    const text = formatByStyle(d);
    const list = loadBib();
    list.unshift({text, ts: Date.now(), style: $("style").value});
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

  // PWA install prompt
  let deferred;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferred = e; $("installBtn").style.display = "inline-block";
  });
  $("installBtn").onclick = async () => { if(deferred){ deferred.prompt(); deferred=null; $("installBtn").style.display="none"; } };

  // Bookmarklet (prefills web fields, not book fields)
  $("bookmarkletBtn").onclick = () => {
    const code = `javascript:(function(){var m=document.querySelector.bind(document);var t=document.title;var u=location.href;var s=(m('meta[property=\\"og:site_name\\"]')||{}).content||(location.hostname||'');var a=(m('meta[name=\\"author\\"]')||m('meta[property=\\"article:author\\"]')||{}).content||'';var d=(m('meta[property=\\"article:published_time\\"]')||m('meta[name=\\"date\\"]')||{}).content||'';var app='${location.origin+location.pathname}';var q='?t='+encodeURIComponent(t)+'&u='+encodeURIComponent(u)+'&s='+encodeURIComponent(s)+'&a='+encodeURIComponent(a)+'&d='+encodeURIComponent(d);location.href=app+q;})();`;
    const ta = document.createElement("textarea"); ta.value = code; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    alert('Bookmarklet code copied! Create a bookmark, paste this as the URL. While on an article, tap it to send metadata here.');
  };

  // ==== ISBN input listener (debounced + Enter + 10→13 conversion)
  if ($("isbn")) {
    let t;
    $("isbn").addEventListener("input", () => {
      clearTimeout(t);
      const raw = $("isbn").value.trim();
      const normalized = normalizeISBN(raw);
      if (normalized) {
        t = setTimeout(() => lookupISBN(normalized), 400);
      }
    });
    $("isbn").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const raw = $("isbn").value.trim();
        const normalized = normalizeISBN(raw);
        if (normalized) lookupISBN(normalized);
        else alert("Please enter a valid ISBN-10 or ISBN-13.");
      }
    });
  }
})();
