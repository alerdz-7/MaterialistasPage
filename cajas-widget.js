// cajas-widget.js — Panel (desktop) + FAB + modal (móvil)
import { db } from "./firebase-config.js";
import {
  doc, setDoc, onSnapshot, addDoc, collection,
  serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const qs = (s, r=document) => r.querySelector(s);

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const getParams = () => {
  const p = new URLSearchParams(location.search);
  return { kb:(p.get("kb")||"HA").trim(), line:(p.get("line")||"L17").trim() };
};

const SID_KEY = "materialistas.sessionId";
let sessionId = localStorage.getItem(SID_KEY);
if (!sessionId){ sessionId = Math.random().toString(36).slice(2); localStorage.setItem(SID_KEY, sessionId); }

/* ===== Estilos ===== */
const style = document.createElement("style");
style.textContent = `
  .boxes-fab { position:fixed; left:16px; bottom:16px; z-index:900; }

  /* Panel desktop/laptop */
  .boxes-card{
    width: 260px; background:#0f2533; color:#fff; border-radius:14px; padding:12px;
    box-shadow:0 10px 26px rgba(0,0,0,.28); border:2px solid rgba(255,255,255,.9);
    overflow: hidden;
  }
  .boxes-title{ margin:0 0 8px; font-weight:800; color:#25b7a7; font-size:14px; }
  .boxes-row{ display:grid; grid-template-columns: 1fr max-content; column-gap:8px; align-items:center; min-width:0; }
  .boxes-in{
    min-width:0; height:44px; background:#0b1d2a; color:#fff; border:none; outline:none;
    border-radius:10px; padding:0 12px; font-weight:700; text-align:center;
  }
  .boxes-btn{ background:#0d8e8a; border:none; color:#fff; border-radius:10px; padding:10px 12px; font-weight:700; cursor:pointer }
  .boxes-today{ margin-top:8px; font-size:12px; color:#bde7e5 }

  /* FAB móvil + modal */
  .boxes-fab-btn{
    display:none;
    width:56px; height:56px; border-radius:50%;
    align-items:center; justify-content:center;
    background:#0d8e8a; color:#fff; border:2px solid rgba(255,255,255,.9);
    box-shadow:0 10px 26px rgba(0,0,0,.28); font-size:26px; line-height:1; cursor:pointer;
  }
  .boxes-modal{ position:fixed; inset:0; background:rgba(0,0,0,.45); display:none; align-items:center; justify-content:center; z-index:1100; }
  .boxes-sheet{
    width:min(360px,92vw); background:#0f2533; color:#fff; border-radius:14px; padding:14px;
    box-shadow:0 10px 30px rgba(0,0,0,.35); border:2px solid rgba(255,255,255,.12);
  }
  .boxes-close{ background:#213444; color:#fff; border:none; border-radius:10px; padding:8px 10px; cursor:pointer; }

  .boxes-sheet .boxes-row{ grid-template-columns: 1fr max-content; }
  .boxes-sheet .boxes-in{ height:40px; }
  .boxes-sheet .boxes-btn{ height:40px; padding:0 12px; }

  /* En móvil ocultamos panel y mostramos FAB */
  @media (max-width: 840px){
    .boxes-card{ display:none; }
    .boxes-fab-btn{ display:flex; }
  }
`;
document.head.appendChild(style);

/* ===== UI ===== */
const mount = document.createElement("div");
mount.className = "boxes-fab";
mount.innerHTML = `
  <!-- Panel (desktop/laptop) -->
  <div class="boxes-card" id="boxesPanel">
    <p class="boxes-title">CAJAS RECICLADAS (HOY)</p>
    <div class="boxes-row">
      <input id="boxesQty" class="boxes-in" type="number" min="0" step="1" placeholder="Cantidad" inputmode="numeric">
      <button id="boxesSave" class="boxes-btn">Guardar</button>
    </div>
    <div class="boxes-today"><span>Total hoy:</span> <b id="boxesTotal">0</b></div>
  </div>

  <!-- FAB (móvil) -->
  <button class="boxes-fab-btn" id="boxesFabBtn" title="Cajas recicladas">📦</button>
`;
document.body.appendChild(mount);

/* Modal móvil */
const modal = document.createElement("div");
modal.className = "boxes-modal";
modal.innerHTML = `
  <div class="boxes-sheet" role="dialog" aria-modal="true" aria-label="Cajas recicladas">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">
      <p class="boxes-title" style="margin:0">CAJAS RECICLADAS (HOY)</p>
      <button class="boxes-close" id="boxesClose">Cerrar</button>
    </div>
    <div class="boxes-row">
      <input id="boxesQtyM" class="boxes-in" type="number" min="0" step="1" placeholder="Cantidad" inputmode="numeric">
      <button id="boxesSaveM" class="boxes-btn">Guardar</button>
    </div>
    <div class="boxes-today"><span>Total hoy:</span> <b id="boxesTotalM">0</b></div>
  </div>
`;
document.body.appendChild(modal);

/* ===== Altura para separar el 💬 (desktop y móvil) ===== */
function publishHeight(){
  const h = mount.getBoundingClientRect().height || 140;
  window.dispatchEvent(new CustomEvent("boxes:ready",  { detail:{ height:h } }));
  window.dispatchEvent(new CustomEvent("boxes:resize", { detail:{ height:h } }));
}
publishHeight();
const ro = new ResizeObserver(publishHeight);
ro.observe(mount);

/* ===== Firestore ===== */
const { kb, line } = getParams();
const dayId   = todayKey();
const dayRef  = doc(db, "KB", kb, "lines", line, "boxes_days", dayId);
const entries = collection(dayRef, "entries");

onSnapshot(dayRef, snap=>{
  const data  = snap.data() || {};
  const total = Number(data.total || 0).toLocaleString("es-MX");
  qs("#boxesTotal").textContent  = total;
  qs("#boxesTotalM").textContent = total;
});

async function saveQty(qty){
  const val = Math.trunc(Number(qty));
  if (!Number.isFinite(val) || val <= 0) return; // sin alertas molestas
  await setDoc(dayRef, { kb, line, dateKey:dayId, total: increment(val), updatedAt: serverTimestamp() }, { merge:true });
  await addDoc(entries, { qty: val, by: sessionId, createdAt: serverTimestamp() });
}

/* Guardar (panel) */
qs("#boxesSave").onclick = async ()=>{
  const v = qs("#boxesQty").value;
  await saveQty(v);
  qs("#boxesQty").value = "";
  publishHeight();
};
/* Guardar (modal) */
qs("#boxesSaveM").onclick = async ()=>{
  const v = qs("#boxesQtyM").value;
  await saveQty(v);
  qs("#boxesQtyM").value = "";
};

/* FAB / Modal (móvil) */
qs("#boxesFabBtn").onclick = ()=>{ modal.style.display="flex"; setTimeout(()=>qs("#boxesQtyM").focus(),0); };
qs("#boxesClose").onclick   = ()=>{ modal.style.display="none"; };
modal.addEventListener("click", e=>{ if(e.target===modal) modal.style.display="none"; });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") modal.style.display="none"; });
