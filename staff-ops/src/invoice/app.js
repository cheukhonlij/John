// 開單台（只限老闆）— 由 invoice.html 載入。
// 資料喺 Firestore（見 ./store.js），保安由 firestore.rules 嘅 isOwner() 把關。
import {
  cloudEnabled, watchOwner, subscribeAll, putRecord, removeRecord,
  putSettings as cloudPutSettings, nextSequence, importBackup, exportBackup,
  syncDeliveryCustomer, removeDeliveryCustomer, syncAllDeliveryCustomers, loadDeliveryCustomers,
  loadStockItems, loadDeliveryNotesFor, markDeliveryNotes, unmarkDeliveryNotes, flushWrites,
} from './store.js';

(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = p => (p||"") + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const money = n => "HK$" + (Math.round((Number(n)||0)*100)/100).toLocaleString("en-HK",{minimumFractionDigits:2,maximumFractionDigits:2});
const money0 = n => "HK$" + Math.round(Number(n)||0).toLocaleString("en-HK");
const todayISO = () => { const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const addDays = (iso,n) => { const d=new Date(iso+"T00:00:00"); d.setDate(d.getDate()+n); return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const addMonths = (iso,n) => { const d=new Date(iso+"T00:00:00"); d.setMonth(d.getMonth()+n); return new Date(d.getTime()-d.getTimezoneOffset()*6e4).toISOString().slice(0,10); };
const daysBetween = (a,b) => Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/864e5);
const monthOf = iso => (iso||"").slice(0,7);
const fmtHK = iso => { if(!iso) return "—"; const p=iso.split("-"); return (+p[2])+"/"+(+p[1])+"/"+p[0]; };

const TYPES = {corp:"公司客戶", retail:"個人客戶", wholesale:"批發／零售商", event:"到會／活動"};
const TERMS = {"0":"即期付款","7":"7 日","14":"14 日","30":"30 日","60":"60 日"};
const METHODS = ["FPS 轉數快","銀行轉帳","現金","PayMe","支票","平台代收"];

/* ---------------- state ---------------- */
let dbReady = false;
const state = {
  tab:"new", customers:[], items:[], invoices:[], tickets:[],
  // 公司資料喺 Firestore（設定／匯入），唔寫入程式碼
  settings:{ name:"", brand:"Today's Food Lab", addrEn:"", addrZh:"", phone:"", email:"", web:"", br:"",
    bank:"", fps:"", forLine:"Instant Food (frozen)", terms:"7", note:"" },
  draft:null, invFilter:{q:"",status:"all",month:"all"}, reportMonth:monthOf(todayISO()),
  picker:null, toast:null, modal:null, gate:"loading", netChecked:false,
  // 員工系統嗰邊：倉存貨品（產品配對用）、送貨客戶、匯入送貨單視窗
  stockItems:[], deliveryCustomers:[], dnImport:null
};

/* ---------------- persistence：Firestore（只限老闆帳戶） ---------------- */
let pendingRefresh = false, unsubData = null, gotFirstData = false;
const DEFAULT_SETTINGS = JSON.parse(JSON.stringify(state.settings));
function setOnline(v){
  dbReady = v; state.netChecked = true;
  const dot = $("#dbdot");
  if(dot){ dot.classList.toggle("off", !v); dot.lastElementChild.textContent = v ? "已連上・自動同步" : "離線中・返到網絡自動同步"; }
}
window.addEventListener("online", ()=>{ setOnline(true); render(); });
window.addEventListener("offline", ()=>{ setOnline(false); render(); });
function localSet(col,id,data){
  const arr = state[col]; const i = arr.findIndex(x=>x.id===id);
  const rec = Object.assign({},data,{id});
  if(i>=0) arr[i]=rec; else arr.push(rec);
}
function saveFail(e){
  console.warn(e);
  toast(/permission/i.test(String((e && (e.code || e.message)) || "")) ? "冇權限儲存：只限老闆帳戶" : "儲存唔到，請檢查網絡再試");
}
// 唔等伺服器回覆：Firestore 會即刻喺畫面更新，冇網絡都會排隊，返到網絡自動同步。
async function put(col,id,data){
  const clean = JSON.parse(JSON.stringify(data)); delete clean.id;
  localSet(col,id,clean);
  putRecord(col, id, clean).catch(saveFail);
  render();
}
async function remove(col,id){
  state[col] = state[col].filter(x=>x.id!==id);
  removeRecord(col, id).catch(saveFail);
  render();
}
async function putSettings(s){
  state.settings = Object.assign({},state.settings,s);
  cloudPutSettings(state.settings).catch(saveFail);
  render();
}
function busyEditing(){
  const a = document.activeElement;
  return !!(state.modal || state.picker != null || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
}
document.addEventListener("focusout", ()=>{ if(pendingRefresh) setTimeout(()=>{ if(pendingRefresh && !busyEditing()) render(); }, 80); });
function applyData(d){
  ["customers","items","invoices","tickets"].forEach(c=>{ state[c] = d[c] || []; });
  state.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
  if(!state.netChecked) setOnline(navigator.onLine);
  if(!gotFirstData){ gotFirstData = true; loadDeliverySide(); render(); return; }
  if(busyEditing()) pendingRefresh = true; else render();
}
/* 送貨單（員工系統）：讀倉存貨品；將客戶名稱、電話、地址抄過去（冇價錢）。 */
let deliverySynced = false;
function loadDeliverySide(){
  loadStockItems().then(list=>{ state.stockItems = list; }).catch(e=>console.warn(e));
  const sync = deliverySynced ? Promise.resolve(0) : syncAllDeliveryCustomers(state.customers);
  deliverySynced = true;
  sync.then(()=>loadDeliveryCustomers()).then(list=>{ state.deliveryCustomers = list; }).catch(e=>console.warn(e));
}
function connect(){
  if(!cloudEnabled){ state.gate = "no-cloud"; render(); return; }
  watchOwner(({state: st})=>{
    if(unsubData){ unsubData(); unsubData = null; }
    gotFirstData = false;
    state.gate = st;
    if(st === "owner"){
      unsubData = subscribeAll(applyData, (e)=>{
        console.warn(e);
        if(/permission/i.test(String((e && (e.code || e.message)) || ""))){ state.gate = "not-owner"; render(); }
      });
    }
    render();
  });
}

/* ---------------- invoice numbering ---------------- */
/* 單號格式：YYYY + DD + MM + 三位流水號，跟返舊有做法。7/3/2026 第一張 → 20260703001
   用 Firestore transaction 派號，電腦同手機同時開單都唔會撞號；冇網絡就暫時用本機計。 */
function noBase(iso){ const p=(iso||todayISO()).split("-"); return p[0]+p[2]+p[1]; }
async function nextNo(iso){
  const date = iso || todayISO(), base = noBase(date);
  const localMax = parseInt(localNextNo(date, null).slice(8), 10) - 1;
  try{
    const seq = await Promise.race([
      nextSequence(base, localMax),
      new Promise((_, rej)=>setTimeout(()=>rej(new Error("timeout")), 6000))
    ]);
    return base + String(seq).padStart(3,"0");
  }catch(e){ return localNextNo(date, null); }
}
/* 同一日下一個可用單號（唔碰資料庫，純粹畀畫面預覽用） */
function localNextNo(iso, excludeId){
  const base = noBase(iso);
  const used = state.invoices.filter(v=>v.id!==excludeId).map(v=>String(v.no||""))
    .filter(n=>n.length===11 && n.slice(0,8)===base).map(n=>parseInt(n.slice(8),10)||0);
  return base + String((used.length?Math.max.apply(null,used):0)+1).padStart(3,"0");
}
/* 客戶專屬價：有就用客戶價，冇就用標準價 */
function priceFor(itemId, customerId, fallback){
  const c = customerById(customerId);
  if(c && c.prices && c.prices[itemId] != null && c.prices[itemId] !== "") return Number(c.prices[itemId]);
  return Number(fallback)||0;
}

/* ---------------- computed ---------------- */
function lineTotal(l){ return (Number(l.qty)||0) * (Number(l.price)||0); }
function calc(inv){
  const sub = (inv.lines||[]).reduce((a,l)=>a+lineTotal(l),0);
  let disc = 0;
  if(inv.discType==="pct") disc = sub * (Number(inv.discVal)||0)/100;
  else if(inv.discType==="amt") disc = Number(inv.discVal)||0;
  disc = Math.min(disc, sub);
  const del = Number(inv.delivery)||0;
  const total = Math.round((sub - disc + del)*100)/100;
  const paid = Math.min(Number(inv.paid)||0, total);
  const units = (inv.lines||[]).reduce((a,l)=>a+(Number(l.qty)||0),0);
  return { sub, disc, del, total, paid, units, due: Math.round((total-paid)*100)/100 };
}
function discLabelOf(inv){ return inv.discLabel || (inv.discType==="pct" ? "折扣／佣金 "+(inv.discVal||0)+"%" : "折扣／佣金"); }
function statusOf(inv){
  const c = calc(inv);
  if(inv.status==="draft") return "draft";
  if(c.total<=0.004) return inv.ticketId ? "paid" : "unpaid";
  if(c.due<=0.004) return "paid";
  if(c.paid>0.004) return "partial";
  if(inv.dueDate && inv.dueDate < todayISO()) return "overdue";
  return "unpaid";
}
const STATUS_META = {
  draft:{t:"草稿",c:"mute"}, unpaid:{t:"未收",c:"due"}, partial:{t:"部分收款",c:"due"},
  paid:{t:"已收",c:"ok"}, overdue:{t:"逾期",c:"bad"}
};
function customerById(id){ return state.customers.find(c=>c.id===id) || null; }
function ticketStats(t){
  const used = (t.redemptions||[]).reduce((a,r)=>a+(Number(r.qty)||0),0);
  const total = (Number(t.qtyPaid)||0)+(Number(t.qtyBonus)||0);
  const left = total-used;
  const days = t.expiry ? daysBetween(todayISO(), t.expiry) : null;
  let st = "live";
  if(left<=0) st="done"; else if(days!==null && days<0) st="expired"; else if(days!==null && days<=7) st="soon";
  return {used,total,left,days,st, unit: total? (Number(t.amount)||0)/total : 0};
}
function outstandingFor(cid){
  return state.invoices.filter(v=>v.customerId===cid && v.status!=="draft")
    .reduce((a,v)=>a+calc(v).due,0);
}

/* ---------------- toast ---------------- */
let toastTimer=null;
function toast(msg){
  state.toast = msg; render();
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>{ state.toast=null; render(); }, 2600);
}

/* ---------------- render ---------------- */
function render(){
  document.querySelectorAll(".navbtn").forEach(b=>b.setAttribute("aria-current", String(b.dataset.tab===state.tab)));
  const m = $("#main"); if(!m) return;
  pendingRefresh = false;
  document.body.classList.toggle("gated", state.gate !== "owner");
  if(state.gate !== "owner"){
    m.innerHTML = gateView();
    $("#modalhost").innerHTML = "";
    return;
  }
  const scroll = window.scrollY;
  m.innerHTML = ({
    new:viewNew, invoices:viewInvoices, customers:viewCustomers,
    items:viewItems, tickets:viewTickets, report:viewReport
  }[state.tab] || viewNew)();
  $("#modalhost").innerHTML = (state.modal ? state.modal() : "") + (state.toast ? '<div class="bar-toast">'+esc(state.toast)+'</div>' : "");
  if(state.tab==="report") drawChart();
  window.scrollTo(0,scroll);
}
function head(title,sub,actions){
  return '<div class="page-head"><div><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div><div class="spacer"></div>'+(actions||"")+'</div>'
    + ((dbReady || !state.netChecked) ? "" : '<div class="notice">而家離線：改動會先存喺呢部機，返到網絡就會自動同步。開新單嘅單號會喺返到網絡後再核對。</div>');
}
function gateView(){
  const box = (title, body, btn) => '<div class="card" style="max-width:440px;margin:10vh auto 0"><header><h2>'+title+'</h2></header>'
    + '<div class="body" style="display:flex;flex-direction:column;gap:14px"><p style="margin:0;color:var(--ink-2)">'+body+'</p>'+(btn||"")+'</div></div>';
  const g = state.gate;
  if(g === "loading") return '<div class="empty" style="margin-top:12vh"><b>載入緊…</b></div>';
  if(g === "no-cloud") return box("開單台要用雲端模式", "呢個版本未連上 Firebase，開單台用唔到。", '<a class="btn" href="/">返去員工系統</a>');
  if(g === "signed-out") return box("請先登入", "開單台只限老闆帳戶使用。請先喺員工系統登入，再撳「開單台」入嚟。", '<a class="btn pri" href="/">去員工系統登入</a>');
  return box("冇權限", "開單台只限老闆帳戶使用，你而家登入嘅帳戶睇唔到呢頁。", '<a class="btn" href="/">返去員工系統</a>');
}

/* ================= 開單 ================= */
function newDraft(){
  return { id:uid("inv"), no:"", date:todayISO(), dueDate:addDays(todayISO(),7), terms:state.settings.terms||"7",
    customerId:"", lines:[{id:uid("l"),name:"",spec:"",qty:1,price:0}], discType:"none", discVal:0, discLabel:"",
    delivery:0, paid:0, paidDate:"", method:"FPS 轉數快", status:"unpaid", notes:"", poRef:"",
    forLine:state.settings.forLine||"", noteOnly:false, ticketId:"", ticketQty:0, deliveryNoteIds:[] };
}
function viewNew(){
  const d = state.draft || (state.draft = newDraft());
  const c = calc(d);
  const cust = customerById(d.customerId);
  const editing = state.invoices.some(v=>v.id===d.id);
  const custTickets = state.tickets.filter(t=>t.customerId===d.customerId && ticketStats(t).left>0);
  return head(editing?"修改單據":"開單",
      editing ? ("正在改 "+(d.no||"草稿")+" ・ 覆蓋原單就㩒「儲存修改」；想留返原單、另出一張就㩒「另存為新單」")
              : "揀客戶、加產品，右邊即刻見到張單點樣印出嚟。",
      '<button class="btn ghost" data-act="draft-reset">清空</button>'
    + (editing ? '<button class="btn" data-act="save-as-new">另存為新單</button>' : '<button class="btn" data-act="save-draft">存做草稿</button>')
    + '<button class="btn pri" data-act="save-invoice">'+(editing?"儲存修改":"出單")+'</button>')
  + '<datalist id="itemlist">'+state.items.map(it=>'<option value="'+esc(it.name)+'">').join("")+'</datalist>'
  + '<div class="editor">'
  +   '<div style="display:flex;flex-direction:column;gap:16px">'

  +   '<section class="card"><header><h2>客戶同日期</h2>'
  +     '<div class="spacer"></div><button class="btn sm" data-act="cust-new">＋ 新客戶</button></header>'
  +     '<div class="body" style="display:flex;flex-direction:column;gap:14px">'
  +       '<div class="grid2">'
  +         '<label class="fld"><span class="lbl">單號</span><input type="text" data-f="no" value="'+esc(d.no||"")+'" placeholder="出單時自動編（'+esc(localNextNo(d.date,d.id))+'）"></label>'
  +         '<label class="fld"><span class="lbl">客戶</span><select data-f="customerId">'
  +           '<option value="">— 未揀 —</option>'
  +           state.customers.map(x=>'<option value="'+x.id+'"'+(x.id===d.customerId?" selected":"")+'>'+esc(x.name)+(x.company?" ／ "+esc(x.company):"")+'</option>').join("")
  +         '</select></label>'
  +         '<label class="fld"><span class="lbl">單據日期</span><input type="date" data-f="date" value="'+esc(d.date)+'"></label>'
  +         '<label class="fld"><span class="lbl">付款期限</span><select data-f="terms">'
  +           Object.keys(TERMS).map(k=>'<option value="'+k+'"'+(String(d.terms)===k?" selected":"")+'>'+TERMS[k]+'</option>').join("")
  +         '</select></label>'
  +         '<label class="fld"><span class="lbl">到期日</span><input type="date" data-f="dueDate" value="'+esc(d.dueDate)+'"></label>'
  +         '<label class="fld"><span class="lbl">FOR（單據用途）</span><input type="text" data-f="forLine" value="'+esc(d.forLine||"")+'" placeholder="Instant Food (frozen)"></label>'
  +         '<label class="fld"><span class="lbl">客戶採購編號（選填）</span><input type="text" data-f="poRef" value="'+esc(d.poRef)+'" placeholder="PO / 參考編號"></label>'
  +       '</div>'
  +       (d.no && d.no.length===11 && d.no.slice(0,8)!==noBase(d.date)
        ? '<div class="notice" style="margin:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
          + '<span>單號 <b style="font-family:var(--mono)">'+esc(d.no)+'</b> 入面嘅日期係 <b>'+esc(d.no.slice(4,6)+"/"+d.no.slice(6,8)+"/"+d.no.slice(0,4))+'</b>，同單據日期 <b>'+esc(fmtHK(d.date))+'</b> 唔夾。</span>'
          + '<button class="btn sm pri" data-act="renumber">改做 '+esc(localNextNo(d.date,d.id))+'</button></div>'
        : "")
  +       (d.no && state.invoices.some(v=>v.id!==d.id && v.no===d.no)
        ? '<div class="hint" style="color:var(--warn)">留意：已經有另一張單用緊 '+esc(d.no)+'。</div>' : "")
  +       (cust ? '<div class="hint">'+esc(TYPES[cust.type]||"")+(cust.contact?" ・ 聯絡："+esc(cust.contact):"")+(cust.phone?" ・ "+esc(cust.phone):"")+ (outstandingFor(cust.id)>0.004? ' ・ <b style="color:var(--warn)">尚欠 '+money(outstandingFor(cust.id))+'</b>':"") +'</div>' : "")
  +     '</div></section>'

  +   '<section class="card"><header><h2>單據內容</h2><div class="spacer"></div>'
  +     '<span class="hint">香港無銷售稅，張單唔會有稅項行</span></header>'
  +     '<div class="tbl-wrap"><table class="lines"><thead><tr>'
  +       '<th>產品／服務</th><th style="width:92px">數量</th><th style="width:110px">單價</th><th style="width:110px" class="num">小計</th><th style="width:34px"></th>'
  +     '</tr></thead><tbody>'
  +     d.lines.map((l,i)=>lineRow(l,i)).join("")
  +     '</tbody></table></div>'
  +     '<div class="body" style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line)">'
  +       '<button class="btn sm" data-act="line-add">＋ 加一行</button>'
  +       '<button class="btn sm pri" data-act="pick-open" data-i="'+(d.lines.length-1)+'">從產品表揀（可多選）</button>'
  +       '<button class="btn sm" data-act="dn-open">匯入送貨單（月結）</button>'
  +       ((d.deliveryNoteIds||[]).length ? '<span class="hint" style="align-self:center">已匯入 '+d.deliveryNoteIds.length+' 張送貨單</span>' : "")
  +     '</div>'
  +   '</section>'

  +   '<section class="card"><header><h2>折扣、送遞同收款</h2></header><div class="body" style="display:flex;flex-direction:column;gap:14px">'
  +     '<div class="grid2">'
  +       '<label class="fld"><span class="lbl">折扣方式</span><select data-f="discType">'
  +         ['none:唔用折扣','pct:百分比 %','amt:減指定金額'].map(o=>{const [v,t]=o.split(":");return '<option value="'+v+'"'+(d.discType===v?" selected":"")+'>'+t+'</option>';}).join("")
  +       '</select></label>'
  +       '<label class="fld"><span class="lbl">'+(d.discType==="pct"?"折扣／佣金 %":"折扣／佣金金額")+'</span><input type="number" step="0.01" class="num" data-f="discVal" value="'+(d.discVal||0)+'"'+(d.discType==="none"?" disabled":"")+'></label>'
  +       '<label class="fld"><span class="lbl">呢一行印咩字</span><input type="text" data-f="discLabel" value="'+esc(d.discLabel||"")+'" placeholder="'+(d.discType==="pct"?"Discount "+(d.discVal||0)+"%":"Discount")+'"'+(d.discType==="none"?" disabled":"")+'></label>'
  +       '<label class="fld"><span class="lbl">送遞／附加費</span><input type="number" step="0.01" class="num" data-f="delivery" value="'+(d.delivery||0)+'"></label>'
  +       '<label class="fld"><span class="lbl">已收金額</span><input type="number" step="0.01" class="num" data-f="paid" value="'+(d.paid||0)+'"></label>'
  +       '<label class="fld"><span class="lbl">收款方式</span><select data-f="method">'
  +         METHODS.map(x=>'<option'+(d.method===x?" selected":"")+'>'+esc(x)+'</option>').join("")
  +       '</select></label>'
  +       '<label class="fld"><span class="lbl">收款日期</span><input type="date" data-f="paidDate" value="'+esc(d.paidDate)+'"></label>'
  +     '</div>'
  +     '<div class="row"><button class="btn sm" data-act="mark-full">標記全數收齊</button>'
  +       (custTickets.length ? '<button class="btn sm" data-act="use-ticket">用飯票扣數</button>' : "")
  +     '</div>'
  +     '<label class="fld"><span class="lbl">單據備註</span><textarea data-f="notes" placeholder="例如：星期一至五辦公時間自取；攞之前一晚 9 點前 WhatsApp 落單。">'+esc(d.notes)+'</textarea></label>'
  +     '<label class="row" style="gap:7px;font-size:13px"><input type="checkbox" data-f="noteOnly"'+(d.noteOnly?" checked":"")+' style="width:auto"> 只印呢張單嘅備註，唔加設定入面嗰段預設備註（例如飯票便當係冷藏、唔係急凍）</label>'
  +   '</div></section>'

  +   '</div>'

  +   '<aside style="position:sticky;top:20px;display:flex;flex-direction:column;gap:14px">'
  +     '<div class="card"><div class="body"><div class="totals">'
  +       '<div><span class="g">小計</span><span class="n">'+money(c.sub)+'</span></div>'
  +       (c.disc? '<div><span class="g">'+esc(discLabelOf(d))+'</span><span class="n">−'+money(c.disc)+'</span></div>':"")
  +       (c.del? '<div><span class="g">送遞／附加費</span><span class="n">'+money(c.del)+'</span></div>':"")
  +       '<div class="final"><span>應收總額</span><span>'+money(c.total)+'</span></div>'
  +       (c.paid? '<div><span class="g">已收</span><span class="n">−'+money(c.paid)+'</span></div>':"")
  +       (c.due>0.004? '<div><span class="g" style="color:var(--warn)">尚欠</span><span class="n" style="color:var(--warn)">'+money(c.due)+'</span></div>' : c.total>0.004? '<div><span class="g" style="color:var(--ok)">已收齊</span><span class="n" style="color:var(--ok)">✓</span></div>' : '')
  +     '</div></div></div>'
  +     '<div class="row" style="justify-content:space-between"><span class="lbl" style="margin:0">單據預覽</span>'
  +       '<button class="btn sm" data-act="draft-pdf">下載 PDF</button></div>'
  +     docHTML(Object.assign({},d,{no:d.no||"（出單時自動編號）"}))
  +   '</aside>'
  + '</div>'
  + (state.picker!=null ? pickerHTML() : "");
}
function lineRow(l,i){
  return '<tr data-line="'+i+'">'
  + '<td><input type="text" data-l="name" data-i="'+i+'" value="'+esc(l.name)+'" placeholder="產品名稱" list="itemlist">'
  +   '<input type="text" data-l="spec" data-i="'+i+'" value="'+esc(l.spec||"")+'" placeholder="規格／備註（選填）" style="font-size:12px;color:var(--ink-3);margin-top:2px"></td>'
  + '<td><input type="number" step="0.01" class="num" data-l="qty" data-i="'+i+'" value="'+(l.qty)+'"></td>'
  + '<td><input type="number" step="0.01" class="num" data-l="price" data-i="'+i+'" value="'+(l.price)+'"></td>'
  + '<td class="num" style="font-family:var(--mono);font-variant-numeric:tabular-nums">'+money(lineTotal(l))+'</td>'
  + '<td><button class="btn sm ghost" data-act="line-del" data-i="'+i+'" aria-label="刪除呢一行">✕</button></td>'
  + '</tr>';
}
function pickerHTML(){
  const d = state.draft || {};
  const groups = {};
  state.items.forEach(it=>{ const g = it.cat||"其他"; (groups[g]=groups[g]||[]).push(it); });
  const keys = Object.keys(groups).sort();
  const cu = customerById(d.customerId);
  return '<div class="scrim" data-act="picker-close"><div class="modal" style="max-width:580px" data-stop>'
  + '<header><h2>揀產品</h2><span class="hint" style="margin-left:10px">剔晒要嘅，再一次過加入'+(cu?'・價錢跟 '+esc(cu.name):'')+'</span><div class="spacer"></div><button class="btn sm ghost" data-act="picker-close" aria-label="關閉">✕</button></header>'
  + '<div class="body" style="padding:0;gap:0">'
  + '<div style="padding:12px 16px;border-bottom:1px solid var(--line)"><input type="text" id="pickq" placeholder="搵產品名…（剔咗嘅會保留）" autocomplete="off"></div>'
  + (state.items.length
    ? '<div class="plist" id="picklist">' + keys.map(g=>
        '<div class="pgroup">'
        + '<label class="grp"><input type="checkbox" class="pgrp" aria-label="全選'+esc(g)+'"><span>'+esc(g)+'</span><span class="gc">'+groups[g].length+' 項・全選</span></label>'
        + groups[g].sort((a,b)=>(a.name||"").localeCompare(b.name||"","zh-Hant")).map(it=>{
            const pr = priceFor(it.id, d.customerId, it.price);
            const special = Math.abs(pr - (Number(it.price)||0)) > 0.0001;
            return '<label class="pi" data-name="'+esc((it.name+" "+g).toLowerCase())+'">'
              + '<input type="checkbox" class="pchk" data-id="'+it.id+'">'
              + '<span class="pn">'+esc(it.name)+(it.unit?' <span class="hint">/'+esc(it.unit)+'</span>':"")+'</span>'
              + '<span class="pp">'+money(pr)+(special?'<span class="chip acc">客戶價</span>':"")+'</span>'
              + '<input type="number" class="num pq" data-id="'+it.id+'" min="0" step="1" placeholder="數量" aria-label="'+esc(it.name)+' 數量">'
              + '</label>';
          }).join("")
        + '</div>').join("") + '</div>'
    : '<div class="empty"><b>產品表仲係空</b>去「產品」頁加返啲貨品，開單就唔使逐次打字。</div>')
  + '</div>'
  + '<footer class="pickfoot"><span class="hint" id="pickcount">未揀任何產品・打數量會自動剔埋</span>'
  +   '<div class="row"><button class="btn" data-act="picker-clear">全部取消</button><button class="btn pri" id="pickadd" data-act="picker-add" disabled>加入</button></div></footer>'
  + '</div></div>';
}
function syncPick(){
  const list = $("#picklist"); if(!list) return;
  const checked = Array.from(list.querySelectorAll(".pchk:checked"));
  let units = 0;
  checked.forEach(c=>{ const q = c.closest(".pi").querySelector(".pq"); units += (Number(q && q.value) || 1); });
  const cnt = $("#pickcount"), add = $("#pickadd");
  if(cnt) cnt.textContent = checked.length ? ("已揀 "+checked.length+" 項・共 "+units+" 件") : "未揀任何產品・打數量會自動剔埋";
  if(add){ add.disabled = !checked.length; add.textContent = checked.length ? ("加入 "+checked.length+" 項") : "加入"; }
  list.querySelectorAll(".pgroup").forEach(gp=>{
    const vis = Array.from(gp.querySelectorAll(".pi")).filter(r=>r.style.display!=="none").map(r=>r.querySelector(".pchk"));
    const on = vis.filter(c=>c.checked).length;
    const g = gp.querySelector(".pgrp");
    g.checked = vis.length>0 && on===vis.length;
    g.indeterminate = on>0 && on<vis.length;
  });
}

/* ================= 單據 ================= */
function viewInvoices(){
  const f = state.invFilter;
  let list = state.invoices.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||"") || (b.no||"").localeCompare(a.no||""));
  const months = Array.from(new Set(state.invoices.map(v=>monthOf(v.date)).filter(Boolean))).sort().reverse();
  if(f.status!=="all") list = list.filter(v=>statusOf(v)===f.status);
  if(f.month!=="all") list = list.filter(v=>monthOf(v.date)===f.month);
  if(f.q){ const q=f.q.toLowerCase(); list = list.filter(v=>{
    const c = customerById(v.customerId);
    return (v.no||"").toLowerCase().includes(q) || (c&&(c.name+" "+(c.company||"")).toLowerCase().includes(q)) || (v.lines||[]).some(l=>(l.name||"").toLowerCase().includes(q));
  }); }
  const totDue = list.reduce((a,v)=>a+(statusOf(v)==="draft"?0:calc(v).due),0);
  const totAll = list.reduce((a,v)=>a+(statusOf(v)==="draft"?0:calc(v).total),0);

  return head("單據", state.invoices.length+" 張單據 ・ 篩選後合共 "+money0(totAll)+"，尚欠 "+money0(totDue),
      '<button class="btn pri" data-act="goto-new">＋ 開新單</button>')
  + '<div class="card"><header style="gap:8px;flex-wrap:wrap">'
  +   '<input type="text" id="invq" value="'+esc(f.q)+'" placeholder="搵單號、客戶或產品…" style="max-width:230px">'
  +   '<select data-fi="status" style="width:auto">'+['all:全部狀態','unpaid:未收','overdue:逾期','partial:部分收款','paid:已收','draft:草稿'].map(o=>{const[v,t]=o.split(":");return '<option value="'+v+'"'+(f.status===v?" selected":"")+'>'+t+'</option>';}).join("")+'</select>'
  +   '<select data-fi="month" style="width:auto"><option value="all">全部月份</option>'+months.map(m=>'<option value="'+m+'"'+(f.month===m?" selected":"")+'>'+m+'</option>').join("")+'</select>'
  +   '<div class="spacer"></div><button class="btn sm" data-act="export-invoices">匯出 CSV</button>'
  + '</header>'
  + (list.length? '<div class="tbl-wrap"><table class="inv-table"><thead><tr><th>單號</th><th>日期</th><th>客戶</th><th>內容</th><th class="num">總額</th><th class="num">尚欠</th><th>狀態</th><th></th></tr></thead><tbody>'
    + list.map(v=>{
        const c = calc(v), s = statusOf(v), cu = customerById(v.customerId);
        const first = (v.lines||[])[0];
        return '<tr><td class="c-no" style="font-family:var(--mono);white-space:nowrap">'+esc(v.no||"—")+'</td>'
        + '<td class="c-dt" style="font-family:var(--mono);white-space:nowrap">'+esc(v.date||"")+'</td>'
        + '<td class="c-cu">'+esc(cu?cu.name:"（未指定）")+(cu&&cu.company?'<br><span class="hint">'+esc(cu.company)+'</span>':"")+'</td>'
        + '<td class="c-ct hint">'+esc(first?first.name:"")+((v.lines||[]).length>1?" 等 "+v.lines.length+" 項":"")+'</td>'
        + '<td class="c-tot num" style="font-family:var(--mono);font-variant-numeric:tabular-nums">'+money(c.total)+'</td>'
        + '<td class="c-due num" style="font-family:var(--mono);font-variant-numeric:tabular-nums;color:'+(c.due>0.004?"var(--warn)":"var(--ink-3)")+'">'+(c.due>0.004?money(c.due):"—")+'</td>'
        + '<td class="c-st"><span class="chip '+STATUS_META[s].c+'">'+STATUS_META[s].t+'</span></td>'
        + '<td class="c-act" style="white-space:nowrap"><button class="btn sm" data-act="inv-pdf" data-id="'+v.id+'">PDF</button>'
        + '<button class="btn sm ghost" data-act="inv-print" data-id="'+v.id+'">列印</button>'
        + '<button class="btn sm ghost" data-act="inv-edit" data-id="'+v.id+'">修改</button>'
        + '<button class="btn sm ghost" data-act="inv-copy" data-id="'+v.id+'">複製</button>'
        + (s!=="paid"&&s!=="draft"?'<button class="btn sm ghost" data-act="inv-paid" data-id="'+v.id+'">收齊</button>':"")
        + '<button class="btn sm ghost" data-act="inv-del" data-id="'+v.id+'">刪除</button></td></tr>';
      }).join("")
    + '</tbody></table></div>'
    : '<div class="empty"><b>'+(state.invoices.length?"呢個篩選冇單據":"仲未開過單")+'</b>'+(state.invoices.length?"試下換個狀態或者月份。":"㩒右上角「開新單」出第一張。")+'</div>')
  + '</div>';
}

/* ================= 客戶 ================= */
function viewCustomers(){
  const list = state.customers.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"","zh-Hant"));
  return head("客戶", state.customers.length+" 個客戶 ・ 開單時揀名就會自動帶入地址同付款期",
      '<button class="btn pri" data-act="cust-new">＋ 新增客戶</button>')
  + '<div class="card">'
  + (list.length? '<div class="tbl-wrap"><table><thead><tr><th>客戶</th><th>類型</th><th>聯絡</th><th>付款期</th><th class="num">尚欠</th><th class="num">飯票餘額</th><th></th></tr></thead><tbody>'
    + list.map(c=>{
        const owed = outstandingFor(c.id);
        const tk = state.tickets.filter(t=>t.customerId===c.id).reduce((a,t)=>a+Math.max(0,ticketStats(t).left),0);
        return '<tr><td><b>'+esc(c.name)+'</b>'+(c.company?'<br><span class="hint">'+esc(c.company)+'</span>':"")+'</td>'
        + '<td><span class="chip mute">'+esc(TYPES[c.type]||"—")+'</span></td>'
        + '<td class="hint">'+esc([c.contact,c.phone,c.email].filter(Boolean).join(" ・ "))+'</td>'
        + '<td class="hint">'+esc(TERMS[String(c.terms)]||"—")+(c.prices&&Object.keys(c.prices).length?' <span class="chip acc">專屬價 '+Object.keys(c.prices).length+'</span>':"")+'</td>'
        + '<td class="num" style="font-family:var(--mono);color:'+(owed>0.004?"var(--warn)":"var(--ink-3)")+'">'+(owed>0.004?money(owed):"—")+'</td>'
        + '<td class="num" style="font-family:var(--mono)">'+(tk?tk+" 張":"—")+'</td>'
        + '<td style="white-space:nowrap"><button class="btn sm ghost" data-act="cust-invoice" data-id="'+c.id+'">開單</button>'
        + '<button class="btn sm ghost" data-act="cust-edit" data-id="'+c.id+'">修改</button>'
        + '<button class="btn sm ghost" data-act="cust-del" data-id="'+c.id+'">刪除</button></td></tr>';
      }).join("")
    + '</tbody></table></div>'
    : '<div class="empty"><b>仲未有客戶</b>加返公司、個人、批發同到會客戶，開單就快好多。</div>')
  + '</div>';
}

/* ================= 產品 ================= */
function viewItems(){
  const groups = {};
  state.items.forEach(it=>{ const g=it.cat||"其他"; (groups[g]=groups[g]||[]).push(it); });
  const keys = Object.keys(groups).sort();
  return head("產品", state.items.length+" 項 ・ 價目改咗之後開嘅新單先會用新價，舊單據價錢唔會變",
      '<button class="btn pri" data-act="item-new">＋ 新增產品</button>')
  + (state.items.length? keys.map(g=>
      '<section class="card" style="margin-bottom:16px"><header><h2>'+esc(g)+'</h2><div class="spacer"></div><span class="hint">'+groups[g].length+' 項</span></header>'
      + '<div class="tbl-wrap"><table><thead><tr><th>名稱</th><th>單位</th><th class="num">單價</th><th></th></tr></thead><tbody>'
      + groups[g].sort((a,b)=>(a.name||"").localeCompare(b.name||"","zh-Hant")).map(it=>
          '<tr><td>'+esc(it.name)+(it.spec?'<br><span class="hint">'+esc(it.spec)+'</span>':"")+'</td>'
          + '<td class="hint">'+esc(it.unit||"件")+'</td>'
          + '<td class="num" style="font-family:var(--mono);font-variant-numeric:tabular-nums">'+money(it.price)+'</td>'
          + '<td style="white-space:nowrap"><button class="btn sm ghost" data-act="item-edit" data-id="'+it.id+'">修改</button>'
          + '<button class="btn sm ghost" data-act="item-del" data-id="'+it.id+'">刪除</button></td></tr>').join("")
      + '</tbody></table></div></section>').join("")
    : '<div class="card"><div class="empty"><b>產品表係空</b>加返貨品同價錢，開單就唔使逐次打。</div></div>');
}

/* ================= 飯票 ================= */
function viewTickets(){
  const list = state.tickets.slice().sort((a,b)=>(b.start||"").localeCompare(a.start||""));
  const live = list.filter(t=>{const s=ticketStats(t);return s.st==="live"||s.st==="soon";});
  const outstandingMeals = live.reduce((a,t)=>a+ticketStats(t).left,0);
  return head("飯票", "預付券套票：客人一次過買，之後逐次扣。"+(live.length? " 現時 "+live.length+" 個生效套票、尚餘 "+outstandingMeals+" 個便當未攞。":""),
      '<button class="btn pri" data-act="tk-new">＋ 開新飯票套票</button>')
  + (list.length? '<div class="grid3">'+list.map(t=>{
      const s = ticketStats(t), cu = customerById(t.customerId);
      const pct = s.total? Math.max(0,Math.min(100, s.used/s.total*100)) : 0;
      const chip = s.st==="expired"? '<span class="chip bad">已過期</span>' : s.st==="done"? '<span class="chip mute">已用完</span>'
        : s.st==="soon"? '<span class="chip due">仲有 '+s.days+' 日到期</span>' : '<span class="chip ok">生效中</span>';
      return '<section class="card"><header><h2>'+esc(cu?cu.name:"（未指定客戶）")+'</h2><div class="spacer"></div>'+chip+'</header>'
      + '<div class="body" style="display:flex;flex-direction:column;gap:12px">'
      + '<div class="hint">'+esc(t.plan||"飯票套票")+'</div>'
      + '<div style="display:flex;align-items:baseline;gap:8px"><span style="font-family:var(--mono);font-size:28px;font-variant-numeric:tabular-nums;letter-spacing:-.02em">'+s.left+'</span><span class="hint">／ '+s.total+' 張未用</span></div>'
      + '<div style="height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--accent)"></div></div>'
      + '<div class="totals" style="font-size:12.5px">'
      +   '<div><span class="g">套票金額</span><span class="n">'+money(t.amount)+'</span></div>'
      +   '<div><span class="g">平均每個便當</span><span class="n">'+money(s.unit)+'</span></div>'
      +   '<div><span class="g">有效期</span><span class="n">'+esc(t.start||"—")+' → '+esc(t.expiry||"—")+'</span></div>'
      + '</div>'
      + ((t.redemptions||[]).length? '<details><summary class="hint" style="cursor:pointer">攞貨紀錄（'+t.redemptions.length+' 次）</summary>'
          + '<table style="margin-top:8px"><tbody>'+t.redemptions.slice().reverse().map(r=>
              '<tr><td style="font-family:var(--mono);padding:5px 0">'+esc(r.date)+'</td><td style="padding:5px 0">'+esc(r.note||"")+'</td><td class="num" style="font-family:var(--mono);padding:5px 0">−'+r.qty+'</td>'
              + '<td style="padding:5px 0;width:26px"><button class="btn sm ghost" data-act="tk-undo" data-id="'+t.id+'" data-rid="'+r.id+'" aria-label="取消呢次扣數">✕</button></td></tr>').join("")
          + '</tbody></table></details>' : '<div class="hint">仲未有攞貨紀錄</div>')
      + '<div class="row"><button class="btn sm pri" data-act="tk-redeem" data-id="'+t.id+'"'+(s.left<=0?" disabled":"")+'>記一次攞貨</button>'
      +   '<button class="btn sm ghost" data-act="tk-edit" data-id="'+t.id+'">修改</button>'
      +   '<button class="btn sm ghost" data-act="tk-del" data-id="'+t.id+'">刪除</button></div>'
      + '</div></section>';
    }).join("")+'</div>'
    : '<div class="card"><div class="empty"><b>仲未有飯票套票</b>例如：$2,610 買 45 張送 5 張，共 50 個便當，過數當日起計一個月有效。</div></div>');
}

/* ================= 月結 ================= */
function monthKeys(n){
  const out=[]; const d=new Date(); d.setDate(1);
  for(let i=n-1;i>=0;i--){ const x=new Date(d.getFullYear(),d.getMonth()-i,1); out.push(x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")); }
  return out;
}
function monthAgg(m){
  const inv = state.invoices.filter(v=>monthOf(v.date)===m && statusOf(v)!=="draft");
  let total=0,paid=0;
  inv.forEach(v=>{ const c=calc(v); total+=c.total; paid+=c.paid; });
  return {inv, total, paid, due: Math.round((total-paid)*100)/100, count:inv.length};
}
function viewReport(){
  const m = state.reportMonth, a = monthAgg(m);
  const byType = {};
  a.inv.forEach(v=>{ const cu=customerById(v.customerId); const k=cu?cu.type:"other"; byType[k]=(byType[k]||0)+calc(v).total; });
  const byCust = {};
  a.inv.forEach(v=>{ const cu=customerById(v.customerId); const k=cu?cu.name:"（未指定）"; byCust[k]=(byCust[k]||0)+calc(v).total; });
  const topCust = Object.entries(byCust).sort((x,y)=>y[1]-x[1]).slice(0,8);
  const months = monthKeys(12);
  const allMonths = Array.from(new Set(state.invoices.map(v=>monthOf(v.date)).filter(Boolean).concat([m]))).sort().reverse();

  return head("月結", "睇單月生意額、收咗幾多同追緊幾多。",
      '<select id="rmonth" style="width:auto">'+allMonths.map(x=>'<option value="'+x+'"'+(x===m?" selected":"")+'>'+x+'</option>').join("")+'</select>'
    + '<button class="btn sm" data-act="export-month">匯出當月 CSV</button>')
  + '<div class="grid3" style="margin-bottom:18px">'
  +   '<div class="stat"><span class="lbl">'+m+' 開單總額</span><div class="v">'+money0(a.total)+'</div><div class="sub">'+a.count+' 張單據</div></div>'
  +   '<div class="stat"><span class="lbl">已收</span><div class="v" style="color:var(--ok)">'+money0(a.paid)+'</div><div class="sub">'+(a.total? Math.round(a.paid/a.total*100):0)+'% 已入數</div></div>'
  +   '<div class="stat"><span class="lbl">尚欠</span><div class="v" style="color:'+(a.due>0.004?"var(--warn)":"var(--ink-3)")+'">'+money0(a.due)+'</div><div class="sub">'+a.inv.filter(v=>calc(v).due>0.004).length+' 張未收齊</div></div>'
  +   '<div class="stat"><span class="lbl">平均每張單</span><div class="v">'+money0(a.count?a.total/a.count:0)+'</div><div class="sub">全部客戶類型計</div></div>'
  + '</div>'

  + '<section class="card" style="margin-bottom:18px"><header><h2>過去 12 個月</h2><div class="spacer"></div><span class="hint">單位：港元</span></header>'
  +   '<div class="body">'
  +   '<div class="legend"><span><i style="background:var(--c-paid)"></i>已收</span><span><i style="background:var(--c-due)"></i>未收</span></div>'
  +   '<div class="chartbox" id="chartbox" data-months=\''+JSON.stringify(months)+'\'></div>'
  +   '</div></section>'

  + '<div class="grid2" style="align-items:start;gap:18px">'
  + '<section class="card"><header><h2>按客戶類型</h2></header>'
  + (Object.keys(byType).length? '<div class="tbl-wrap"><table><tbody>'
      + Object.entries(byType).sort((x,y)=>y[1]-x[1]).map(([k,v])=>
        '<tr><td>'+esc(TYPES[k]||"未分類")+'</td><td class="num" style="font-family:var(--mono);font-variant-numeric:tabular-nums">'+money(v)+'</td>'
        + '<td class="hint num" style="width:56px">'+(a.total?Math.round(v/a.total*100):0)+'%</td></tr>').join("")
      + '</tbody></table></div>' : '<div class="empty">呢個月未有單據</div>')
  + '</section>'
  + '<section class="card"><header><h2>當月客戶排行</h2></header>'
  + (topCust.length? '<div class="tbl-wrap"><table><tbody>'
      + topCust.map(([k,v])=>'<tr><td>'+esc(k)+'</td><td class="num" style="font-family:var(--mono);font-variant-numeric:tabular-nums">'+money(v)+'</td></tr>').join("")
      + '</tbody></table></div>' : '<div class="empty">呢個月未有單據</div>')
  + '</section></div>';
}
function fmtK(v){
  if(v>=10000) return Math.round(v/1000)+"k";
  if(v>=1000) return (v/1000).toFixed(1).replace(/\.0$/,"")+"k";
  return String(Math.round(v));
}
function drawChart(){
  const box = document.getElementById("chartbox"); if(!box) return;
  const months = JSON.parse(box.dataset.months);
  const data = months.map(m=>{ const a=monthAgg(m); return {m, paid:a.paid, due:a.due, total:a.total}; });
  const max = Math.max(200, ...data.map(d=>d.total));
  const W=760, H=236, padL=54, padR=10, padT=18, padB=36;
  const iw = W-padL-padR, ih = H-padT-padB;
  const step = iw/data.length, bw = Math.min(32, step*0.58);
  const ticks = 4, niceMax = niceCeil(max);
  const y = v => padT + ih - (v/niceMax)*ih;
  let g = "";
  for(let i=0;i<=ticks;i++){
    const v = niceMax*i/ticks, yy = y(v);
    g += '<line class="gl" x1="'+padL+'" y1="'+yy.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+yy.toFixed(1)+'"/>'
       + '<text class="ax" x="'+(padL-8)+'" y="'+(yy+3.5).toFixed(1)+'" text-anchor="end">'+fmtK(v)+'</text>';
  }
  let hits="", bars = "", labels = "";
  data.forEach((d,i)=>{
    const cx = padL + step*i + step/2, x = cx - bw/2;
    const yPaid = y(d.paid), yTop = y(d.total);
    const hPaid = Math.max(0, padT+ih-yPaid), hDue = Math.max(0, yPaid-yTop);
    if(hPaid>0.5) bars += '<rect class="bp" x="'+x.toFixed(1)+'" y="'+yPaid.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+hPaid.toFixed(1)+'"/>';
    if(hDue>2.5) bars += '<rect class="bd" x="'+x.toFixed(1)+'" y="'+yTop.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+(hDue-2).toFixed(1)+'"/>';
    if(d.total>0) labels += '<text class="vl" x="'+cx.toFixed(1)+'" y="'+(yTop-6).toFixed(1)+'" text-anchor="middle">'+fmtK(d.total)+'</text>';
    labels += '<text class="ax" x="'+cx.toFixed(1)+'" y="'+(padT+ih+17)+'" text-anchor="middle">'+d.m.slice(5)+'</text>';
    hits += '<rect class="hit" x="'+(padL+step*i).toFixed(1)+'" y="'+padT+'" width="'+step.toFixed(1)+'" height="'+ih+'"><title>'+d.m+'　總額 '+money0(d.total)+'　已收 '+money0(d.paid)+'　未收 '+money0(d.due)+'</title></rect>';
  });
  labels += '<text class="ax" x="'+padL+'" y="'+(padT+ih+31)+'">'+data[0].m.slice(0,4)+' → '+data[data.length-1].m.slice(0,4)+'</text>';
  box.innerHTML = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="過去 12 個月每月開單總額，分已收同未收">'
    + g + '<line class="base" x1="'+padL+'" y1="'+(padT+ih)+'" x2="'+(W-padR)+'" y2="'+(padT+ih)+'"/>'
    + hits + bars + labels + '</svg>';
}
function niceCeil(v){
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v/e;
  const m = n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10;
  return m*e;
}

/* ================= invoice document ================= */
function docHTML(inv){
  const s = state.settings, c = calc(inv), cu = customerById(inv.customerId), st = statusOf(inv);
  const stamp = st==="paid"? '<span class="stamp p">Paid 已收</span>' : st==="overdue"? '<span class="stamp o">Overdue 逾期</span>' : st==="draft"? "" : '<span class="stamp u">Unpaid 未收</span>';
  const bizLines = [s.addrEn, s.addrZh, s.phone && ("Tel: "+s.phone), s.web].filter(Boolean);
  const custLines = cu ? [cu.company, cu.addr, cu.contact && (cu.phone? "Phone: "+cu.contact+" "+cu.phone : "Phone: "+cu.contact), (!cu.contact && cu.phone)?("Phone: "+cu.phone):"", cu.deliverTo && ("Deliver to : "+cu.deliverTo)].filter(Boolean) : [];
  const dl = inv.discLabel || (inv.discType==="pct" ? "Discount "+(inv.discVal||0)+"%" : "Discount");
  return '<div class="doc">'
  + '<div class="dh"><div class="biz"><b>'+esc(s.brand||s.name||"Today\'s Food Lab")+'</b><small>'+bizLines.map(esc).join("<br>").replace(/\n/g,"<br>")+'</small></div>'
  +   '<div class="dt"><b>Invoice</b><span class="no">'+esc(inv.no||"—")+'</span>'
  +     '<small>DATE　'+esc(fmtHK(inv.date))+(inv.forLine?'<br>FOR　'+esc(inv.forLine):"")
  +     '<br>TERMS　'+esc(TERMS[String(inv.terms)]||"—")+'<br>DUE　'+esc(fmtHK(inv.dueDate))+(inv.poRef?'<br>REF　'+esc(inv.poRef):"")+'</small></div></div>'
  + '<div class="parties"><div><em>Bill to</em><strong>'+esc(cu?cu.name:"（未揀客戶）")+'</strong>'+(custLines.length?'<p>'+esc(custLines.join("\n"))+'</p>':"")+'</div>'
  +   '<div style="flex:none;text-align:right">'+stamp+'</div></div>'
  + '<table><thead><tr><th>DESCRIPTION</th><th class="r" style="width:56px">UNITS</th><th class="r" style="width:80px">RATE</th><th class="r" style="width:92px">AMOUNT</th></tr></thead><tbody>'
  + (inv.lines||[]).filter(l=>l.name||lineTotal(l)).map(l=>
      '<tr><td>'+esc(l.name||"—")+(l.spec?'<small>'+esc(l.spec)+'</small>':"")+'</td>'
      + '<td class="r">'+(Number(l.qty)||0)+'</td><td class="r">'+money(l.price)+'</td><td class="r">'+money(lineTotal(l))+'</td></tr>').join("")
  + '</tbody></table>'
  + '<div class="sum"><table><tbody>'
  +   '<tr><td>TOTAL UNITS</td><td class="r">'+(Math.round(c.units*100)/100)+'</td></tr>'
  +   '<tr><td>SUBTOTAL</td><td class="r">'+money(c.sub)+'</td></tr>'
  +   (c.disc? '<tr><td>'+esc(dl)+'</td><td class="r">−'+money(c.disc)+'</td></tr>':"")
  +   (c.del? '<tr><td>DELIVERY</td><td class="r">'+money(c.del)+'</td></tr>':"")
  +   '<tr class="tot"><td>TOTAL HKD</td><td class="r">'+money(c.total)+'</td></tr>'
  +   (c.paid? '<tr><td>PAID'+(inv.paidDate?" ("+esc(fmtHK(inv.paidDate))+")":"")+'</td><td class="r">−'+money(c.paid)+'</td></tr>':"")
  +   '<tr><td><b>OUTSTANDING</b></td><td class="r"><b>'+(c.due>0.004?money(c.due):"–")+'</b></td></tr>'
  + '</tbody></table></div>'
  + '<div class="foot">'
  +   '<div><em>Payment</em><p>'+esc(["Please make payment to "+(s.bank||""), s.fps && ("FPS: "+s.fps)].filter(Boolean).join("\n"))+'</p></div>'
  +   '<div><em>Notes</em><p>'+esc((inv.noteOnly ? [inv.notes] : [inv.notes, s.note]).filter(Boolean).join("\n"))+'</p></div>'
  + '</div></div>';
}

/* ================= modals ================= */
function modalWrap(title, body, footer, wide){
  return '<div class="scrim" data-act="modal-close"><div class="modal"'+(wide?' style="max-width:660px"':"")+' data-stop>'
  + '<header><h2>'+esc(title)+'</h2><div class="spacer"></div><button class="btn sm ghost" data-act="modal-close">✕</button></header>'
  + '<div class="body">'+body+'</div><footer>'+footer+'</footer></div></div>';
}
function customerModal(c){
  const isNew = !c.id;
  return () => modalWrap(isNew?"新增客戶":"修改客戶",
      '<input type="hidden" id="c_id" value="'+esc(c.id||"")+'">'
    + '<div class="grid2">'
    + '<label class="fld"><span class="lbl">客戶名稱 *</span><input type="text" id="c_name" value="'+esc(c.name||"")+'" placeholder="例如：陳先生 / ABC 有限公司"></label>'
    + '<label class="fld"><span class="lbl">公司（選填）</span><input type="text" id="c_company" value="'+esc(c.company||"")+'"></label>'
    + '<label class="fld"><span class="lbl">類型</span><select id="c_type">'+Object.keys(TYPES).map(k=>'<option value="'+k+'"'+(c.type===k?" selected":"")+'>'+TYPES[k]+'</option>').join("")+'</select></label>'
    + '<label class="fld"><span class="lbl">預設付款期</span><select id="c_terms">'+Object.keys(TERMS).map(k=>'<option value="'+k+'"'+(String(c.terms||"7")===k?" selected":"")+'>'+TERMS[k]+'</option>').join("")+'</select></label>'
    + '<label class="fld"><span class="lbl">聯絡人</span><input type="text" id="c_contact" value="'+esc(c.contact||"")+'"></label>'
    + '<label class="fld"><span class="lbl">電話 / WhatsApp</span><input type="text" id="c_phone" value="'+esc(c.phone||"")+'"></label>'
    + '<label class="fld"><span class="lbl">電郵</span><input type="text" id="c_email" value="'+esc(c.email||"")+'"></label>'
    + '</div>'
    + '<label class="fld"><span class="lbl">送貨／收單地址</span><textarea id="c_addr">'+esc(c.addr||"")+'</textarea></label>'
    + '<label class="fld"><span class="lbl">Deliver to（送去邊，會印喺單上）</span><input type="text" id="c_deliverto" value="'+esc(c.deliverTo||"")+'"></label>'
    + '<div><div class="lbl">客戶專屬價（留空即用標準價）</div>'
    +   '<input type="text" id="c_pq" placeholder="搵產品…" autocomplete="off" style="margin-bottom:6px">'
    +   '<div id="c_plist" style="max-height:230px;overflow:auto;border:1px solid var(--line);border-radius:var(--r)">'
    +   state.items.slice().sort((a,b)=>(a.cat||"").localeCompare(b.cat||"","zh-Hant")||(a.name||"").localeCompare(b.name||"","zh-Hant")).map(it=>
        '<label class="prow" data-name="'+esc((it.name+" "+(it.cat||"")).toLowerCase())+'" style="display:flex;gap:10px;align-items:center;padding:5px 10px;border-bottom:1px solid var(--line)">'
        + '<span style="flex:1;font-size:12.5px">'+esc(it.name)+'</span>'
        + '<span class="hint" style="font-family:var(--mono)">'+money(it.price)+'</span>'
        + '<input type="number" step="0.01" class="num cprice" data-item="'+it.id+'" value="'+((c.prices&&c.prices[it.id]!=null)?c.prices[it.id]:"")+'" placeholder="—" style="width:82px">'
        + '</label>').join("")
    +   '</div></div>',
    '<button class="btn" data-act="modal-close">取消</button><button class="btn pri" data-act="cust-save">儲存</button>', true);
}
function itemModal(it){
  const cats = Array.from(new Set(state.items.map(x=>x.cat).filter(Boolean)));
  return () => modalWrap(it.id?"修改產品":"新增產品",
      '<input type="hidden" id="i_id" value="'+esc(it.id||"")+'">'
    + '<div class="grid2">'
    + '<label class="fld"><span class="lbl">產品名稱 *</span><input type="text" id="i_name" value="'+esc(it.name||"")+'"></label>'
    + '<label class="fld"><span class="lbl">分類</span><input type="text" id="i_cat" value="'+esc(it.cat||"")+'" list="catlist" placeholder="例如：即食雞胸"><datalist id="catlist">'+cats.map(c=>'<option value="'+esc(c)+'">').join("")+'</datalist></label>'
    + '<label class="fld"><span class="lbl">單位</span><input type="text" id="i_unit" value="'+esc(it.unit||"件")+'"></label>'
    + '<label class="fld"><span class="lbl">單價 HKD *</span><input type="number" step="0.01" class="num" id="i_price" value="'+(it.price||0)+'"></label>'
    + '</div>'
    + '<label class="fld"><span class="lbl">規格／備註</span><input type="text" id="i_spec" value="'+esc(it.spec||"")+'" placeholder="例如：100g／包"></label>'
    + '<label class="fld"><span class="lbl">對應倉存貨品（送貨單月結用）</span><select id="i_stock"><option value="">— 未配對（名稱一樣就自動對）—</option>'
    +   state.stockItems.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"","zh-Hant")).map(s=>'<option value="'+esc(s.id)+'"'+(it.stockItemId===s.id?" selected":"")+'>'+esc(s.name)+(s.unit?"（"+esc(s.unit)+"）":"")+'</option>').join("")
    + '</select></label>',
    '<button class="btn" data-act="modal-close">取消</button><button class="btn pri" data-act="item-save">儲存</button>');
}
function ticketModal(t){
  const start = t.start || todayISO();
  return () => modalWrap(t.id?"修改飯票套票":"開新飯票套票",
      '<input type="hidden" id="t_id" value="'+esc(t.id||"")+'">'
    + '<div class="grid2">'
    + '<label class="fld"><span class="lbl">客戶 *</span><select id="t_cust"><option value="">— 揀客戶 —</option>'
      + state.customers.map(c=>'<option value="'+c.id+'"'+(t.customerId===c.id?" selected":"")+'>'+esc(c.name)+'</option>').join("")+'</select></label>'
    + '<label class="fld"><span class="lbl">套票名稱</span><input type="text" id="t_plan" value="'+esc(t.plan||"慢煮雞胸蕃薯便當（100g）")+'"></label>'
    + '<label class="fld"><span class="lbl">買幾多張 *</span><input type="number" class="num" id="t_paid" value="'+(t.qtyPaid!=null?t.qtyPaid:45)+'"></label>'
    + '<label class="fld"><span class="lbl">送幾多張</span><input type="number" class="num" id="t_bonus" value="'+(t.qtyBonus!=null?t.qtyBonus:5)+'"></label>'
    + '<label class="fld"><span class="lbl">套票總金額 HKD *</span><input type="number" step="0.01" class="num" id="t_amount" value="'+(t.amount!=null?t.amount:2610)+'"></label>'
    + '<label class="fld"><span class="lbl">生效日（過數當日）</span><input type="date" id="t_start" value="'+esc(start)+'"></label>'
    + '<label class="fld"><span class="lbl">到期日</span><input type="date" id="t_expiry" value="'+esc(t.expiry||addMonths(start,1))+'"></label>'
    + '</div>'
    + '<label class="fld"><span class="lbl">條款備註</span><textarea id="t_notes">'+esc(t.notes||"便當以 0–4°C 冷藏出貨（非急凍）。\n只限自取、不設送貨；星期一至五辦公時間內任攞；攞之前一晚 9 點前 WhatsApp 落單；落咗單就扣票。")+'</textarea></label>'
    + (t.id?"":'<label class="row" style="gap:7px;font-size:13px"><input type="checkbox" id="t_mkinv" checked style="width:auto"> 同時開一張單據記低呢筆收入</label>'),
    '<button class="btn" data-act="modal-close">取消</button><button class="btn pri" data-act="tk-save">儲存</button>');
}
function redeemModal(t){
  const s = ticketStats(t);
  return () => modalWrap("記一次攞貨 ・ "+((customerById(t.customerId)||{}).name||""),
      '<input type="hidden" id="r_id" value="'+esc(t.id)+'">'
    + '<div class="hint">尚餘 '+s.left+' 張，到期日 '+esc(t.expiry||"—")+'</div>'
    + '<div class="grid2">'
    + '<label class="fld"><span class="lbl">日期</span><input type="date" id="r_date" value="'+todayISO()+'"></label>'
    + '<label class="fld"><span class="lbl">扣幾多張 *</span><input type="number" class="num" id="r_qty" value="4" min="1" max="'+s.left+'"></label>'
    + '</div>'
    + '<label class="fld"><span class="lbl">備註</span><input type="text" id="r_note" placeholder="例如：自取 4 個，日式照燒"></label>',
    '<button class="btn" data-act="modal-close">取消</button><button class="btn pri" data-act="tk-redeem-save">扣數</button>');
}
function useTicketModal(){
  const d = state.draft;
  const list = state.tickets.filter(t=>t.customerId===d.customerId && ticketStats(t).left>0);
  return () => modalWrap("用飯票扣數",
      '<div class="hint">扣飯票唔會收錢：張單會標記為飯票支付，金額做 0，同時喺套票度扣返張數。</div>'
    + '<label class="fld"><span class="lbl">套票</span><select id="u_tk">'+list.map(t=>{const s=ticketStats(t);return '<option value="'+t.id+'">'+esc((customerById(t.customerId)||{}).name||"")+' ・ 尚餘 '+s.left+' 張 ・ 到期 '+esc(t.expiry||"—")+'</option>';}).join("")+'</select></label>'
    + '<label class="fld"><span class="lbl">扣幾多張</span><input type="number" class="num" id="u_qty" value="'+Math.max(1,Math.round(d.lines.reduce((a,l)=>a+(Number(l.qty)||0),0)))+'" min="1"></label>',
    '<button class="btn" data-act="modal-close">取消</button><button class="btn pri" data-act="use-ticket-save">確認扣數</button>');
}
function settingsModal(){
  const s = state.settings;
  return () => modalWrap("公司資料設定",
      '<div class="hint">單號自動用返你一直用嘅格式：<b style="font-family:var(--mono)">YYYY + DD + MM + 三位流水號</b>，例如 7/3/2026 當日第一張 = 20260703001。</div>'
    + '<div class="grid2">'
    + '<label class="fld"><span class="lbl">單頭顯示名稱</span><input type="text" id="s_brand" value="'+esc(s.brand||"")+'"></label>'
    + '<label class="fld"><span class="lbl">法人名稱</span><input type="text" id="s_name" value="'+esc(s.name)+'"></label>'
    + '<label class="fld"><span class="lbl">電話</span><input type="text" id="s_phone" value="'+esc(s.phone)+'"></label>'
    + '<label class="fld"><span class="lbl">電郵</span><input type="text" id="s_email" value="'+esc(s.email)+'"></label>'
    + '<label class="fld"><span class="lbl">網址</span><input type="text" id="s_web" value="'+esc(s.web)+'"></label>'
    + '<label class="fld"><span class="lbl">商業登記號碼</span><input type="text" id="s_br" value="'+esc(s.br)+'"></label>'
    + '<label class="fld"><span class="lbl">預設付款期</span><select id="s_terms">'+Object.keys(TERMS).map(k=>'<option value="'+k+'"'+(String(s.terms)===k?" selected":"")+'>'+TERMS[k]+'</option>').join("")+'</select></label>'
    + '<label class="fld"><span class="lbl">FPS 轉數快號碼</span><input type="text" id="s_fps" value="'+esc(s.fps)+'"></label>'
    + '</div>'
    + '<label class="fld"><span class="lbl">英文地址</span><textarea id="s_addren" style="min-height:48px">'+esc(s.addrEn||"")+'</textarea></label>'
    + '<label class="fld"><span class="lbl">中文地址</span><input type="text" id="s_addrzh" value="'+esc(s.addrZh||"")+'"></label>'
    + '<label class="fld"><span class="lbl">FOR 預設值</span><input type="text" id="s_for" value="'+esc(s.forLine||"")+'"></label>'
    + '<label class="fld"><span class="lbl">收款戶口（印喺單尾）</span><textarea id="s_bank" style="min-height:48px">'+esc(s.bank)+'</textarea></label>'
    + '<label class="fld"><span class="lbl">單據預設備註</span><textarea id="s_note">'+esc(s.note)+'</textarea></label>'
    + '<div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:10px">'
    +   '<span class="lbl" style="margin:0">備份同匯入</span>'
    +   '<p class="hint" style="margin:0">匯入只會新增或者覆蓋同一個編號嘅資料，唔會刪除任何嘢。本機版（Mac）同 Claude 版匯出嘅 .json 都用得。</p>'
    +   '<div class="row">'
    +     '<button class="btn sm" data-act="backup-download">下載備份檔（.json）</button>'
    +     '<button class="btn sm" data-act="backup-restore">匯入開單台備份…</button>'
    +     '<input type="file" id="restorefile" accept=".json,application/json" style="display:none">'
    +   '</div>'
    + '</div>',
    '<button class="btn" data-act="modal-close">取消</button><button class="btn pri" data-act="settings-save">儲存</button>', true);
}
/* ---------------- 匯入送貨單（月結） ---------------- */
function dnQty(n, k){ const r = n.receivedQty; return (r && r[k] != null) ? Number(r[k]) || 0 : Number(n.lines[k].qty) || 0; }
function dnSummary(n){ return (n.lines||[]).map((l,k)=>l.itemName+" × "+(Math.round(dnQty(n,k)*1000)/1000)+" "+(l.unit||"")).join("、"); }
function openDeliveryImport(customerId){
  const t = todayISO();
  // 月頭十日內開單，通常係計上個月
  const month = state.dnImport ? state.dnImport.month : monthOf(Number(t.slice(8)) <= 10 ? addMonths(t, -1) : t);
  state.dnImport = { customerId, month, notes:null };
  state.modal = deliveryImportModal; render();
  loadDeliveryNotesFor(customerId).then(list=>{
    if(state.dnImport && state.dnImport.customerId===customerId){ state.dnImport.notes = list; render(); }
  }).catch(e=>{ saveFail(e); if(state.dnImport){ state.dnImport.notes = []; render(); } });
}
function deliveryImportModal(){
  const imp = state.dnImport, d = state.draft || {};
  const custs = state.deliveryCustomers.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"","zh-Hant"));
  if(!custs.some(c=>c.id===imp.customerId)) custs.unshift({id:imp.customerId, name:(customerById(imp.customerId)||{}).name||"（呢個客戶）"});
  let body = '<div class="hint">揀咗嘅送貨單會按產品將實收數量加埋，用呢個客戶嘅價錢計。出單之後送貨單會標記「已開單」，唔會重複匯入。</div>'
    + '<div class="grid2">'
    + '<label class="fld"><span class="lbl">送貨單上嘅客戶</span><select id="dn_cust">'+custs.map(c=>'<option value="'+esc(c.id)+'"'+(c.id===imp.customerId?" selected":"")+'>'+esc(c.name)+(c.company?" ／ "+esc(c.company):"")+'</option>').join("")+'</select></label>'
    + '<label class="fld"><span class="lbl">月份</span><input type="month" id="dn_month" value="'+esc(imp.month)+'"></label>'
    + '</div>';
  if(!imp.notes){
    body += '<div class="empty"><b>載入緊…</b></div>';
  } else {
    const inMonth = imp.notes.filter(n=>monthOf(n.date)===imp.month).sort((a,b)=>(a.date+a.no).localeCompare(b.date+b.no));
    const here = new Set(d.deliveryNoteIds||[]);
    const ready = inMonth.filter(n=>n.status==="signed" && !n.invoiceId && !here.has(n.id));
    const done = inMonth.filter(n=>n.status==="signed" && (n.invoiceId || here.has(n.id)));
    const waiting = inMonth.filter(n=>n.status!=="signed");
    body += ready.length
      ? '<div style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:var(--r)">'
        + ready.map(n=>'<label style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-bottom:1px solid var(--line)">'
          + '<input type="checkbox" class="dnchk" data-id="'+esc(n.id)+'" checked style="width:auto;margin-top:3px">'
          + '<span style="flex:1;font-size:12.5px"><b style="font-family:var(--mono)">'+esc(n.no)+'</b> ・ '+esc(fmtHK(n.date))+' ・ 收貨人：'+esc(n.receiverName||"")
          + '<br><span class="hint">'+esc(dnSummary(n))+'</span></span></label>').join("")
        + '</div>'
      : '<div class="empty"><b>呢個月冇未開單嘅已簽收送貨單</b></div>';
    if(done.length) body += '<div class="hint">已開單：'+done.map(n=>esc(n.no)+(n.invoiceNo?"（"+esc(n.invoiceNo)+"）":"")).join("、")+'</div>';
    if(waiting.length) body += '<div class="hint" style="color:var(--warn)">未簽收，唔會計入：'+waiting.map(n=>esc(n.no)).join("、")+'</div>';
  }
  return modalWrap("匯入送貨單", body,
    '<button class="btn" data-act="modal-close">取消</button><button class="btn pri" data-act="dn-import">匯入</button>', true);
}
function confirmModal(msg, act, id, rid){
  return () => modalWrap("確認",'<p style="margin:0">'+esc(msg)+'</p>',
    '<button class="btn" data-act="modal-close">取消</button><button class="btn pri" data-act="'+act+'" data-id="'+esc(id||"")+'" data-rid="'+esc(rid||"")+'">確認</button>');
}

/* ================= CSV ================= */
async function saveCSV(name, rows){
  const csv = "﻿" + rows.map(r=>r.map(v=>{
    const s = String(v==null?"":v);
    return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  }).join(",")).join("\n");
  downloadFile(name, csv, "text/csv;charset=utf-8");
  toast("已下載 "+name);
}
function invoiceRows(list){
  const rows = [["單號","日期","到期日","客戶","客戶類型","項目","總額 HKD","已收 HKD","尚欠 HKD","狀態","收款方式","備註"]];
  list.forEach(v=>{
    const c = calc(v), cu = customerById(v.customerId);
    rows.push([v.no||"", v.date||"", v.dueDate||"", cu?cu.name:"", cu?(TYPES[cu.type]||""):"",
      (v.lines||[]).map(l=>l.name+" ×"+l.qty).join(" / "),
      c.total.toFixed(2), c.paid.toFixed(2), c.due.toFixed(2), STATUS_META[statusOf(v)].t, v.method||"", v.notes||""]);
  });
  return rows;
}

/* ================= download helper ================= */
function downloadFile(filename, data, type){
  const blob = (data instanceof Blob) ? data : new Blob([data], {type: type || "application/octet-stream"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener"; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 15000);
}

/* ================= print / PDF ================= */
function printInvoice(id){
  const inv = state.invoices.find(v=>v.id===id) || state.draft; if(!inv) return;
  $("#printhost").innerHTML = docHTML(inv);
  const old = document.title;
  document.title = pdfFilename(inv,"pdf").slice(0,-4);   // 「另存為 PDF」時預設檔名
  const restore = ()=>{ document.title = old; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  setTimeout(restore, 60000);
  window.print();
}
/* 檔名跟返舊做法：TFL Invoice DDMMYYYYNNN_客戶.pdf */
function pdfFilename(inv, ext){
  const cu = customerById(inv.customerId);
  const n = String(inv.no||"");
  const stem = (n.length===11) ? (n.slice(4,6)+n.slice(6,8)+n.slice(0,4)+n.slice(8)) : (n || (inv.date||"").replace(/-/g,""));
  const cust = (cu?cu.name:"").replace(/[\s\/\\:*?"<>|]+/g,"");
  return "TFL Invoice "+stem+(cust?"_"+cust:"")+"."+(ext||"pdf");
}
const DOC_CSS = ".doc{background:#fff;color:#141a1e;padding:0;font-size:12px;font-family:'IBM Plex Sans','PingFang HK','PingFang TC','Microsoft JhengHei',sans-serif}"
 + ".doc *{border-color:#dfe4e7;box-sizing:border-box}"
 + ".doc .dh{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:2px solid #141a1e;padding-bottom:14px}"
 + ".doc .biz b{display:block;font-size:15px}.doc .biz small{display:block;color:#5a666e;font-size:10.5px;line-height:1.65;margin-top:4px}"
 + ".doc .dt{text-align:right;flex:none}.doc .dt b{font-family:monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;display:block}"
 + ".doc .dt .no{font-family:monospace;font-size:15px;margin-top:6px;display:block}.doc .dt small{display:block;color:#5a666e;font-size:10.5px;margin-top:5px;line-height:1.6}"
 + ".doc .parties{display:flex;gap:26px;padding:14px 0;border-bottom:1px solid #dfe4e7}.doc .parties>div{flex:1}"
 + ".doc .parties em{font-style:normal;font-family:monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#7b868d;display:block;margin-bottom:4px}"
 + ".doc .parties strong{font-size:13px;display:block}.doc .parties p{margin:3px 0 0;color:#5a666e;font-size:11px;line-height:1.6;white-space:pre-line}"
 + ".doc table{width:100%;border-collapse:collapse;font-size:11.5px}.doc th{text-align:left;color:#7b868d;border-bottom:1px solid #141a1e;padding:8px 0;font-family:monospace;font-size:10px;letter-spacing:.08em;font-weight:500}"
 + ".doc td{padding:7px 0;border-bottom:1px solid #eceff1;vertical-align:top}.doc th.r,.doc td.r{text-align:right}"
 + ".doc td small{display:block;color:#7b868d;font-size:10px}"
 + ".doc .sum{display:flex;justify-content:flex-end;padding-top:12px}.doc .sum table{width:270px}.doc .sum td{border:0;padding:3px 0}"
 + ".doc .sum td.r{font-family:monospace}.doc .sum tr.tot td{border-top:1px solid #141a1e;padding-top:8px;font-size:15px;font-weight:600}"
 + ".doc .foot{margin-top:18px;padding-top:12px;border-top:1px solid #dfe4e7;display:flex;gap:24px}.doc .foot>div{flex:1}"
 + ".doc .foot em{font-style:normal;font-family:monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:#7b868d;display:block;margin-bottom:4px}"
 + ".doc .foot p{margin:0;color:#3e4a52;font-size:10.5px;line-height:1.7;white-space:pre-line}"
 + ".doc .stamp{float:right;font-family:monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;border:1.5px solid;padding:4px 10px;border-radius:2px}"
 + ".doc .stamp.p{color:#1b6d49}.doc .stamp.u{color:#8d5510}.doc .stamp.o{color:#9c2b21}";

function standaloneHTML(inv){
  return '<!doctype html><html lang="zh-HK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(pdfFilename(inv,"pdf").slice(0,-4))+'</title>'
    + '<style>@page{size:A4;margin:14mm}body{margin:0;background:#fff}'+DOC_CSS+'</style></head><body>'
    + docHTML(inv) + '<script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script></body></html>';
}
async function exportPDF(id){
  const inv = (id ? state.invoices.find(v=>v.id===id) : state.draft); if(!inv) return;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff;padding:38px;z-index:-1";
  host.innerHTML = docHTML(inv);
  const card = host.firstElementChild;
  card.style.border="0"; card.style.boxShadow="none"; card.style.borderRadius="0"; card.style.padding="0";
  document.body.appendChild(host);
  const hasLibs = !!(window.html2canvas && window.jspdf);
  toast(hasLibs ? "整緊 PDF…" : "整緊檔案…");
  let done = false;
  try{
    if(!hasLibs) throw new Error("no-lib");
    const canvas = await window.html2canvas(host, {scale:2, backgroundColor:"#ffffff", logging:false});
    const img = canvas.toDataURL("image/jpeg", 0.95);
    const jsPDF = window.jspdf.jsPDF;
    const pdf = new jsPDF({unit:"mm", format:"a4", orientation:"portrait"});
    const pw = 210, ph = 297;
    const ih = canvas.height * pw / canvas.width;
    let y = 0, page = 0;
    while(y < ih - 0.5 && page < 12){
      if(page) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, -y, pw, ih);
      y += ph; page++;
    }
    downloadFile(pdfFilename(inv,"pdf"), pdf.output("blob"));
    done = true; toast("PDF 已下載：" + pdfFilename(inv,"pdf"));
  }catch(e){
    if(e && e.code === "declined"){ host.remove(); return; }
    // 冇網絡攞唔到 PDF 工具 → 開一個列印頁，揀「另存為 PDF」
    const w = window.open("", "_blank");
    if(w){ w.document.open(); w.document.write(standaloneHTML(inv)); w.document.close(); done = true; toast("已開列印頁 — 揀「另存為 PDF」就得"); }
    else { downloadFile(pdfFilename(inv,"html"), standaloneHTML(inv), "text/html;charset=utf-8"); done = true; toast("已下載列印檔，打開佢再揀「另存為 PDF」"); }
  }
  host.remove();
  if(!done) return;
}

/* ================= events ================= */
document.addEventListener("click", async e=>{
  const back = e.target.closest("a.backlink");
  if(back && cloudEnabled && state.gate === "owner"){
    e.preventDefault();
    await flushWrites().catch(()=>{});
    location.href = back.href; return;
  }
  const nav = e.target.closest(".navbtn");
  if(nav){ state.tab = nav.dataset.tab; state.picker=null; render(); return; }
  const btn = e.target.closest("[data-act]");
  if(!btn) return;
  if(btn.classList.contains("scrim") && e.target !== btn) return;
  const act = btn.dataset.act;
  const id = btn && btn.dataset.id, i = btn && btn.dataset.i;
  const d = state.draft;

  switch(act){
    case "modal-close": case "picker-close":
      state.modal=null; state.picker=null; render(); return;
    case "settings": state.modal = settingsModal(); render(); return;
    case "backup-download": {
      try{
        toast("整緊備份…");
        const data = await exportBackup();
        downloadFile("TodaysInvoice-backup-"+todayISO()+".json", JSON.stringify(data, null, 1), "application/json");
        toast("已下載備份檔");
      }catch(e){ console.warn(e); toast("下載唔到備份，請檢查網絡再試"); }
      return; }
    case "backup-restore": { const f = $("#restorefile"); if(f) f.click(); return; }
    case "settings-save": {
      await putSettings({ name:$("#s_name").value.trim(), brand:$("#s_brand").value.trim(), phone:$("#s_phone").value.trim(),
        email:$("#s_email").value.trim(), web:$("#s_web").value.trim(), br:$("#s_br").value.trim(), terms:$("#s_terms").value,
        fps:$("#s_fps").value.trim(), addrEn:$("#s_addren").value, addrZh:$("#s_addrzh").value.trim(),
        forLine:$("#s_for").value.trim(), bank:$("#s_bank").value, note:$("#s_note").value });
      state.modal=null; toast("已儲存公司資料"); render(); return; }

    /* --- draft --- */
    case "goto-new": state.tab="new"; state.draft=newDraft(); render(); return;
    case "draft-reset": state.draft=newDraft(); render(); return;
    case "renumber": { const old=d.no; d.no = await nextNo(d.date); toast("單號由 "+old+" 改做 "+d.no); render(); return; }
    case "line-add": d.lines.push({id:uid("l"),name:"",spec:"",qty:1,price:0}); render(); return;
    case "line-del": if(d.lines.length>1) d.lines.splice(+i,1); else d.lines=[{id:uid("l"),name:"",spec:"",qty:1,price:0}]; render(); return;
    case "pick-open": state.picker = +i; render(); setTimeout(()=>{const q=$("#pickq"); if(q) q.focus();},30); return;
    case "picker-add": {
      const list = $("#picklist"); if(!list) return;
      const rows = Array.from(list.querySelectorAll(".pchk:checked"));
      if(!rows.length) return;
      let added = 0;
      rows.forEach(chk=>{
        const it = state.items.find(x=>x.id===chk.dataset.id); if(!it) return;
        const q = chk.closest(".pi").querySelector(".pq");
        const qty = Number(q && q.value) > 0 ? Number(q.value) : 1;
        const line = {id:uid("l"), itemId:it.id, name:it.name, spec:it.spec||"", qty:qty, price:priceFor(it.id, d.customerId, it.price)};
        const slot = d.lines.findIndex(l=>!l.name && !lineTotal(l));
        if(slot>=0) d.lines[slot] = line; else d.lines.push(line);
        added++;
      });
      state.picker=null; render(); toast("已加入 "+added+" 項"); return; }
    case "picker-clear": {
      document.querySelectorAll("#picklist .pchk, #picklist .pgrp").forEach(c=>{ c.checked=false; c.indeterminate=false; });
      document.querySelectorAll("#picklist .pq").forEach(q=>{ q.value=""; });
      syncPick(); return; }
    case "dn-open":
      if(!d.customerId){ toast("請先揀客戶"); return; }
      openDeliveryImport(d.customerId); return;
    case "dn-import": {
      const imp = state.dnImport; if(!imp || !imp.notes) return;
      const chosen = new Set(Array.from(document.querySelectorAll(".dnchk:checked")).map(c=>c.dataset.id));
      const notes = imp.notes.filter(n=>chosen.has(n.id));
      if(!notes.length){ toast("未揀送貨單"); return; }
      // 按倉存貨品加埋實收數量，再對返開單台嘅產品同客戶價
      const sums = new Map();
      notes.forEach(n=>(n.lines||[]).forEach((l,k)=>{
        const s = sums.get(l.itemId) || {name:l.itemName, qty:0};
        s.qty += dnQty(n,k); sums.set(l.itemId, s);
      }));
      let unmatched = 0;
      const lines = [];
      sums.forEach((s, stockId)=>{
        if(!s.qty) return;
        const qty = Math.round(s.qty*1000)/1000;
        const it = state.items.find(x=>x.stockItemId===stockId) || state.items.find(x=>x.name===s.name);
        if(it) lines.push({id:uid("l"), itemId:it.id, name:it.name, spec:it.spec||"", qty, price:priceFor(it.id, d.customerId, it.price)});
        else { unmatched++; lines.push({id:uid("l"), name:s.name, spec:"未配對產品，請填單價", qty, price:0}); }
      });
      d.lines = d.lines.filter(l=>l.name || lineTotal(l)).concat(lines);
      if(!d.lines.length) d.lines = [{id:uid("l"),name:"",spec:"",qty:1,price:0}];
      d.deliveryNoteIds = Array.from(new Set((d.deliveryNoteIds||[]).concat(notes.map(n=>n.id))));
      const ref = "送貨單：" + notes.map(n=>n.no).sort().join("、");
      d.notes = d.notes ? d.notes + "\n" + ref : ref;
      state.modal = null; state.dnImport = null; render();
      toast("已匯入 "+notes.length+" 張送貨單"+(unmatched ? "；有 "+unmatched+" 項未配對產品，請填單價" : ""));
      return; }
    case "mark-full": { const c=calc(d); d.paid=c.total; d.paidDate = d.paidDate||todayISO(); render(); return; }
    case "use-ticket": state.modal = useTicketModal(); render(); return;
    case "use-ticket-save": {
      const tid = $("#u_tk").value, qty = Math.max(1, Math.round(Number($("#u_qty").value)||1));
      const t = state.tickets.find(x=>x.id===tid); if(!t){ state.modal=null; render(); return; }
      const s = ticketStats(t);
      if(qty > s.left){ toast("最多只可以扣 "+s.left+" 張"); return; }
      d.lines = [{id:uid("l"), name:(t.plan||"飯票")+"（飯票扣減）", spec:"扣 "+qty+" 張，扣後尚餘 "+(s.left-qty)+" 張", qty:qty, price:0}];
      d.discType="none"; d.discVal=0; d.delivery=0; d.paid=0; d.ticketId=t.id; d.ticketQty=qty;
      d.notes = d.notes || "以飯票支付，不另收費。";
      state.modal=null; toast("已set好飯票扣數，出單時會扣返張數"); render(); return; }
    case "save-draft": case "save-invoice": {
      if(!d.customerId){ toast("請先揀客戶"); return; }
      if(!d.lines.some(l=>l.name)){ toast("最少要有一行有名嘅項目"); return; }
      const isDraft = act==="save-draft";
      if(!d.no) d.no = await nextNo(d.date);
      d.status = isDraft ? "draft" : "issued";
      d.lines = d.lines.filter(l=>l.name || lineTotal(l));
      if(d.ticketId && d.ticketQty>0 && !d.ticketApplied){
        const t = state.tickets.find(x=>x.id===d.ticketId);
        if(t){
          const reds = (t.redemptions||[]).concat([{id:uid("r"), date:d.date, qty:d.ticketQty, note:"單據 "+d.no}]);
          await put("tickets", t.id, Object.assign({}, t, {redemptions:reds}));
          d.ticketApplied = true;
        }
      }
      await put("invoices", d.id, d);
      if((d.deliveryNoteIds||[]).length) markDeliveryNotes(d.deliveryNoteIds, d.id, d.no).catch(saveFail);
      toast(isDraft? "已存做草稿 "+d.no : "已出單 "+d.no);
      state.draft = newDraft(); state.tab = "invoices"; render(); return; }

    /* --- invoices --- */
    case "inv-print": printInvoice(id); return;
    case "inv-pdf": await exportPDF(id); return;
    case "draft-pdf": await exportPDF(null); return;
    case "inv-edit": { const v = state.invoices.find(x=>x.id===id); if(v){ state.draft = JSON.parse(JSON.stringify(v)); state.tab="new"; render(); } return; }
    case "inv-copy": {
      const v = state.invoices.find(x=>x.id===id); if(!v) return;
      const c = JSON.parse(JSON.stringify(v));
      c.id = uid("inv"); c.no = ""; c.date = todayISO();
      c.dueDate = addDays(c.date, Number(c.terms)||0);
      c.paid = 0; c.paidDate = ""; c.status = "unpaid";
      c.ticketId = ""; c.ticketQty = 0; c.ticketApplied = false; c.deliveryNoteIds = [];
      c.lines = (c.lines||[]).map(l=>Object.assign({}, l, {id:uid("l")}));
      state.draft = c; state.tab = "new"; render();
      toast("已複製 "+(v.no||"")+" 嘅內容，出單時會攞新單號"); return; }
    case "save-as-new": {
      if(!d.customerId){ toast("請先揀客戶"); return; }
      if(!d.lines.some(l=>l.name)){ toast("最少要有一行有名嘅項目"); return; }
      const src = state.invoices.find(x=>x.id===d.id);
      const c = JSON.parse(JSON.stringify(d));
      c.id = uid("inv");
      if(!c.no || (src && src.no === c.no)) c.no = await nextNo(c.date);
      c.status = "issued";
      c.ticketId = ""; c.ticketQty = 0; c.ticketApplied = false; c.deliveryNoteIds = [];
      c.lines = c.lines.filter(l=>l.name || lineTotal(l)).map(l=>Object.assign({}, l, {id:uid("l")}));
      await put("invoices", c.id, c);
      toast("已另存為新單 "+c.no+"，原單 "+((src&&src.no)||"")+" 冇改動");
      state.draft = newDraft(); state.tab = "invoices"; render(); return; }
    case "inv-paid": { const v = state.invoices.find(x=>x.id===id); if(v){ const c=calc(v); await put("invoices", v.id, Object.assign({},v,{paid:c.total, paidDate:v.paidDate||todayISO()})); toast("已標記收齊"); } return; }
    case "inv-del": state.modal = confirmModal("刪除呢張單據？刪咗就冇得復原。","inv-del-yes",id); render(); return;
    case "inv-del-yes": state.modal=null; await remove("invoices", id); unmarkDeliveryNotes(id).catch(saveFail); toast("已刪除"); return;
    case "export-invoices": {
      let list = state.invoices.slice().sort((a,b)=>(a.date||"").localeCompare(b.date||""));
      await saveCSV("todays-invoices-"+todayISO()+".csv", invoiceRows(list)); return; }
    case "export-month": {
      const a = monthAgg(state.reportMonth);
      const rows = invoiceRows(a.inv);
      rows.push([]); rows.push(["合計","","","","","", a.total.toFixed(2), a.paid.toFixed(2), a.due.toFixed(2)]);
      await saveCSV("todays-"+state.reportMonth+".csv", rows); return; }

    /* --- customers --- */
    case "cust-new": state.modal = customerModal({type:"corp",terms:state.settings.terms||"7"}); render(); return;
    case "cust-edit": state.modal = customerModal(customerById(id)||{}); render(); return;
    case "cust-save": {
      const name = $("#c_name").value.trim();
      if(!name){ toast("請填客戶名稱"); return; }
      const cid = $("#c_id").value || uid("c");
      const prices = {};
      document.querySelectorAll(".cprice").forEach(el=>{ if(el.value!=="" && !isNaN(Number(el.value))) prices[el.dataset.item] = Number(el.value); });
      await put("customers", cid, { name, company:$("#c_company").value.trim(), type:$("#c_type").value,
        terms:$("#c_terms").value, contact:$("#c_contact").value.trim(), phone:$("#c_phone").value.trim(),
        email:$("#c_email").value.trim(), addr:$("#c_addr").value.trim(),
        deliverTo:$("#c_deliverto").value.trim(), prices });
      syncDeliveryCustomer(cid, customerById(cid)).then(loadDeliveryCustomers).then(list=>{ state.deliveryCustomers = list; }).catch(saveFail);
      if(state.tab==="new" && state.draft && !state.draft.customerId){ state.draft.customerId = cid; applyCustomerDefaults(); }
      state.modal=null; toast("已儲存客戶"); render(); return; }
    case "cust-del": state.modal = confirmModal("刪除呢個客戶？佢過往嘅單據會保留，但單上會顯示「未指定」。","cust-del-yes",id); render(); return;
    case "cust-del-yes":
      state.modal=null; await remove("customers", id);
      removeDeliveryCustomer(id).catch(saveFail);
      state.deliveryCustomers = state.deliveryCustomers.filter(x=>x.id!==id); return;
    case "cust-invoice": state.draft = newDraft(); state.draft.customerId = id; applyCustomerDefaults(); state.tab="new"; render(); return;

    /* --- items --- */
    case "item-new": state.modal = itemModal({}); render(); return;
    case "item-edit": state.modal = itemModal(state.items.find(x=>x.id===id)||{}); render(); return;
    case "item-save": {
      const name = $("#i_name").value.trim();
      if(!name){ toast("請填產品名稱"); return; }
      await put("items", $("#i_id").value || uid("p"), { name, cat:$("#i_cat").value.trim()||"其他",
        unit:$("#i_unit").value.trim()||"件", price:Number($("#i_price").value)||0, spec:$("#i_spec").value.trim(),
        stockItemId:$("#i_stock").value });
      state.modal=null; toast("已儲存產品"); render(); return; }
    case "item-del": state.modal = confirmModal("刪除呢個產品？舊單據上嘅價錢唔會受影響。","item-del-yes",id); render(); return;
    case "item-del-yes": state.modal=null; await remove("items", id); return;

    /* --- tickets --- */
    case "tk-new": state.modal = ticketModal({}); render(); return;
    case "tk-edit": state.modal = ticketModal(state.tickets.find(x=>x.id===id)||{}); render(); return;
    case "tk-save": {
      const cid = $("#t_cust").value;
      if(!cid){ toast("請揀客戶"); return; }
      const old = state.tickets.find(x=>x.id===$("#t_id").value);
      const tid = $("#t_id").value || uid("t");
      const rec = { customerId:cid, plan:$("#t_plan").value.trim(), qtyPaid:Number($("#t_paid").value)||0,
        qtyBonus:Number($("#t_bonus").value)||0, amount:Number($("#t_amount").value)||0,
        start:$("#t_start").value, expiry:$("#t_expiry").value, notes:$("#t_notes").value,
        redemptions: old? (old.redemptions||[]) : [] };
      await put("tickets", tid, rec);
      const mk = $("#t_mkinv");
      if(mk && mk.checked){
        const inv = newDraft();
        inv.customerId = cid; inv.date = rec.start; inv.dueDate = rec.start; inv.terms="0";
        inv.lines = [{id:uid("l"), name:"飯票套票 ・ "+(rec.plan||""), spec:"買 "+rec.qtyPaid+" 張送 "+rec.qtyBonus+" 張，共 "+(rec.qtyPaid+rec.qtyBonus)+" 個便當；有效期至 "+rec.expiry, qty:1, price:rec.amount}];
        inv.paid = rec.amount; inv.paidDate = rec.start; inv.status="issued"; inv.notes = rec.notes; inv.noteOnly = true;
        inv.no = await nextNo(inv.date);
        await put("invoices", inv.id, inv);
        toast("已開飯票套票，同時出咗單 "+inv.no);
      } else toast("已儲存飯票套票");
      state.modal=null; render(); return; }
    case "tk-del": state.modal = confirmModal("刪除呢個飯票套票？攞貨紀錄一齊冇埋。","tk-del-yes",id); render(); return;
    case "tk-del-yes": state.modal=null; await remove("tickets", id); return;
    case "tk-redeem": state.modal = redeemModal(state.tickets.find(x=>x.id===id)); render(); return;
    case "tk-redeem-save": {
      const t = state.tickets.find(x=>x.id===$("#r_id").value); if(!t) return;
      const qty = Math.max(1, Math.round(Number($("#r_qty").value)||1));
      const s = ticketStats(t);
      if(qty>s.left){ toast("最多只可以扣 "+s.left+" 張"); return; }
      const reds = (t.redemptions||[]).concat([{id:uid("r"), date:$("#r_date").value||todayISO(), qty, note:$("#r_note").value.trim()}]);
      await put("tickets", t.id, Object.assign({},t,{redemptions:reds}));
      state.modal=null; toast("已扣 "+qty+" 張，尚餘 "+(s.left-qty)); render(); return; }
    case "tk-undo": {
      const t = state.tickets.find(x=>x.id===id); if(!t) return;
      await put("tickets", t.id, Object.assign({},t,{redemptions:(t.redemptions||[]).filter(r=>r.id!==btn.dataset.rid)}));
      toast("已取消嗰次扣數"); return; }
  }
});

document.addEventListener("change", async e=>{
  if(!e.target || e.target.id !== "restorefile") return;
  const file = e.target.files && e.target.files[0]; if(!file) return;
  let payload;
  try{ payload = JSON.parse(await file.text()); }catch(x){ toast("呢個唔係開單台嘅備份檔"); return; }
  const n = payload && payload.invoices ? Object.keys(payload.invoices).length : 0;
  const nc = payload && payload.customers ? Object.keys(payload.customers).length : 0;
  const ni = payload && payload.items ? Object.keys(payload.items).length : 0;
  e.target.value = "";
  if(!window.confirm("匯入「"+file.name+"」？\n入面有 "+nc+" 個客戶、"+ni+" 樣產品、"+n+" 張單據。\n同一個編號嘅資料會被覆蓋，其他資料唔會刪除。")) return;
  try{
    await importBackup(payload, (done, total)=>toast("匯入緊… "+done+"/"+total));
    state.modal = null; render(); toast("已匯入："+nc+" 個客戶、"+ni+" 樣產品、"+n+" 張單據");
  }catch(x){ console.warn(x); toast(/permission/i.test(String(x && (x.code||x.message))) ? "冇權限匯入：只限老闆帳戶" : "匯入唔到，請檢查網絡再試"); }
});

function applyCustomerDefaults(){
  const d = state.draft, c = customerById(d.customerId);
  if(!c) return;
  d.terms = String(c.terms||state.settings.terms||"7");
  d.dueDate = addDays(d.date, Number(d.terms)||0);
  d.lines.forEach(l=>{
    const it = l.itemId ? state.items.find(x=>x.id===l.itemId) : state.items.find(x=>x.name===l.name);
    if(it){ l.itemId = it.id; l.price = priceFor(it.id, d.customerId, it.price); }
  });
}

document.addEventListener("input", e=>{
  const t = e.target;
  if(t.id==="invq"){ state.invFilter.q = t.value; render(); const n=$("#invq"); if(n){n.focus(); n.setSelectionRange(n.value.length,n.value.length);} return; }
  if(t.id==="c_pq"){
    const q = t.value.trim().toLowerCase();
    document.querySelectorAll("#c_plist .prow").forEach(r=>{ r.style.display = (!q || r.dataset.name.includes(q)) ? "flex" : "none"; });
    return;
  }
  if(t.id==="pickq"){
    const q = t.value.trim().toLowerCase();
    document.querySelectorAll("#picklist .pi").forEach(r=>{ r.style.display = (!q || r.dataset.name.includes(q)) ? "" : "none"; });
    document.querySelectorAll("#picklist .pgroup").forEach(gp=>{
      const any = Array.from(gp.querySelectorAll(".pi")).some(r=>r.style.display!=="none");
      gp.style.display = any ? "" : "none";
    });
    syncPick(); return;
  }
  if(t.classList && t.classList.contains("pq")){
    const chk = t.closest(".pi").querySelector(".pchk");
    if(Number(t.value) > 0) chk.checked = true;
    syncPick(); return;
  }
  const d = state.draft;
  if(t.dataset.f && d){
    const f = t.dataset.f;
    d[f] = (t.type==="checkbox") ? t.checked : (t.type==="number") ? (t.value===""?0:Number(t.value)) : t.value;
    if(f==="noteOnly"){ rerenderTotals(); return; }
    if(f==="terms") d.dueDate = addDays(d.date, Number(d.terms)||0);
    if(f==="date") d.dueDate = addDays(d.date, Number(d.terms)||0);
    if(f==="customerId") applyCustomerDefaults();
    if(f==="discType"||f==="terms"||f==="customerId"||f==="date") { render(); return; }
    rerenderTotals(); return;
  }
  if(t.dataset.l && d){
    const idx = +t.dataset.i, k = t.dataset.l;
    d.lines[idx][k] = (t.type==="number") ? (t.value===""?0:Number(t.value)) : t.value;
    const cell = t.closest("tr").children[3];
    if(cell) cell.textContent = money(lineTotal(d.lines[idx]));
    rerenderTotals(); return;
  }
});
document.addEventListener("change", e=>{
  const t = e.target;
  if(t.classList && t.classList.contains("pgrp")){
    t.closest(".pgroup").querySelectorAll(".pi").forEach(r=>{ if(r.style.display!=="none") r.querySelector(".pchk").checked = t.checked; });
    syncPick(); return;
  }
  if(t.classList && t.classList.contains("pchk")){ syncPick(); return; }
  if(t.dataset.f==="no"){ render(); return; }
  if(t.dataset.fi){ state.invFilter[t.dataset.fi] = t.value; render(); return; }
  if(t.id==="rmonth"){ state.reportMonth = t.value; render(); return; }
  if(t.id==="dn_month" && state.dnImport){ state.dnImport.month = t.value; render(); return; }
  if(t.id==="dn_cust" && state.dnImport){ openDeliveryImport(t.value); return; }
  if(t.dataset.l==="name" && state.draft){
    const l = state.draft.lines[+t.dataset.i]; if(!l) return;
    const it = state.items.find(x=>x.name===t.value);
    if(it && !Number(l.price)){ l.itemId = it.id; l.price = priceFor(it.id, state.draft.customerId, it.price); if(!l.spec) l.spec = it.spec||""; render(); }
  }
});
function rerenderTotals(){
  const d = state.draft; if(!d) return;
  const c = calc(d);
  const box = document.querySelector("aside .totals");
  if(box){
    box.innerHTML = '<div><span class="g">小計</span><span class="n">'+money(c.sub)+'</span></div>'
      + (c.disc? '<div><span class="g">'+esc(discLabelOf(d))+'</span><span class="n">−'+money(c.disc)+'</span></div>':"")
      + (c.del? '<div><span class="g">送遞／附加費</span><span class="n">'+money(c.del)+'</span></div>':"")
      + '<div class="final"><span>應收總額</span><span>'+money(c.total)+'</span></div>'
      + (c.paid? '<div><span class="g">已收</span><span class="n">−'+money(c.paid)+'</span></div>':"")
      + (c.due>0.004? '<div><span class="g" style="color:var(--warn)">尚欠</span><span class="n" style="color:var(--warn)">'+money(c.due)+'</span></div>' : c.total>0.004? '<div><span class="g" style="color:var(--ok)">已收齊</span><span class="n" style="color:var(--ok)">✓</span></div>' : '');
  }
  const doc = document.querySelector("aside .doc");
  if(doc){ const tmp = document.createElement("div"); tmp.innerHTML = docHTML(Object.assign({},d,{no:d.no||"（出單時自動編號）"})); doc.replaceWith(tmp.firstElementChild); }
}
document.addEventListener("keydown", e=>{
  if(e.key==="Escape" && (state.modal||state.picker!=null)){ state.modal=null; state.picker=null; render(); }
  if(e.altKey||e.ctrlKey||e.metaKey||state.gate!=="owner") return;
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
  const map = {n:"new",i:"invoices",c:"customers",p:"items",t:"tickets",r:"report"};
  const k = map[e.key.toLowerCase()];
  if(k){ state.tab=k; render(); }
});

render();
connect();
})();
