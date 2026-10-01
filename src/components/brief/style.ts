/* Styles for the client questionnaire — a quiet, product-style form. Scoped under .bf */
export const BRIEF_CSS = `
.bf{--bg:#fff;--ink:#101114;--mut:#62666f;--soft:#8b8f98;--line:#e5e6ea;--field:#f4f5f7;--hover:#ecedf0;--ok:#16794a;--bad:#c4321c;
  min-height:100vh;background:var(--bg);color:var(--ink);
  font-family:'IBM Plex Sans Hebrew','Assistant',system-ui,sans-serif;font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
.bf *{box-sizing:border-box}
.bf button{font:inherit;cursor:pointer}
:where(.bf) button{color:inherit}
.bf :focus-visible{outline:2px solid var(--ink);outline-offset:2px}

/* header */
.bf-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(8px)}
.bf-top-in{max-width:620px;margin:0 auto;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px}
.bf-brand{font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bf-count{color:var(--mut);flex:none;font-variant-numeric:tabular-nums}
.bf-bar{height:2px;background:var(--line)}
.bf-bar i{display:block;height:100%;background:var(--ink);transition:width .35s ease}

/* page */
.bf-main{max-width:620px;margin:0 auto;padding:40px 20px 140px}
@media (min-width:720px){.bf-main{padding-top:56px;padding-bottom:80px}}
.bf-h1{font-size:30px;line-height:1.2;font-weight:600;letter-spacing:-.01em;margin:0 0 12px}
@media (min-width:720px){.bf-h1{font-size:34px}}
.bf-h2{font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-.01em;margin:0 0 6px}
.bf-lead{font-size:17px;color:#3c4048;margin:0 0 14px;max-width:34em}
.bf-hint{color:var(--mut);margin:0 0 32px}
.bf-small{font-size:14px;color:var(--mut);margin:6px 0 0}
.bf-ok{color:var(--ok)}
.bf-err{color:var(--bad);font-size:14px;margin:12px 0 0}
.bf-step{animation:bf-in .25s ease-out}
@keyframes bf-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.bf-step{animation:none}.bf *{transition:none!important}}

/* intro */
.bf-intro-meta{display:flex;flex-wrap:wrap;gap:8px 20px;margin:24px 0 36px;padding:16px 0;border-block:1px solid var(--line);font-size:14px;color:var(--mut)}
.bf-intro-meta b{color:var(--ink);font-weight:600}

/* questions */
.bf-q{margin:0 0 24px}
.bf-q-l{display:block;margin:0 0 8px;font-weight:500;font-size:15px}
.bf-q-l small{display:block;font-weight:400;font-size:13.5px;color:var(--mut);margin-top:1px}
.bf-q-l em{font-style:normal;color:var(--soft);font-size:13px;font-weight:400;margin-inline-start:6px}
.bf-in{width:100%;background:var(--field);border:1px solid transparent;border-radius:10px;padding:12px 14px;font:inherit;color:var(--ink);
  transition:border-color .12s,background .12s,box-shadow .12s;appearance:none}
.bf-in::placeholder{color:#9b9fa7}
.bf-in:hover{background:var(--hover)}
.bf-in:focus{outline:none;background:#fff;border-color:var(--ink);box-shadow:0 0 0 3px rgba(16,17,20,.08)}
.bf-area{resize:none;min-height:52px;line-height:1.6;overflow:hidden}
.bf-two{display:grid;grid-template-columns:1fr;gap:0 14px}
@media (min-width:560px){.bf-two{grid-template-columns:1fr 1fr}}

.bf-opts{display:flex;flex-wrap:wrap;gap:8px}
.bf-opt{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:#fff;border-radius:10px;padding:9px 14px;font-size:15px;transition:border-color .12s,background .12s}
.bf-opt:hover{border-color:#c9cbd1}
.bf-opt .bx{width:16px;height:16px;border-radius:4px;border:1.5px solid #b8bbc2;display:grid;place-items:center;flex:none;transition:all .12s}
.bf-opt.on{border-color:var(--ink);background:var(--field)}
.bf-opt.on .bx{background:var(--ink);border-color:var(--ink)}
.bf-opt.on .bx::after{content:"";width:8px;height:4px;border:2px solid #fff;border-top:0;border-right:0;transform:rotate(-45deg) translate(1px,-1px)}

/* repeating groups */
.bf-group{border:1px solid var(--line);border-radius:12px;margin:0 0 12px}
.bf-item{position:relative;display:grid;gap:8px;padding:14px}
.bf-item+.bf-item{border-top:1px solid var(--line)}
.bf-item .bf-in{padding-inline-end:44px}
.bf-item .bf-in+.bf-in{padding-inline-end:14px}
.bf-x{position:absolute;top:20px;inset-inline-end:20px;width:28px;height:28px;border-radius:7px;border:0;background:transparent;color:var(--soft);font-size:20px;line-height:1;display:grid;place-items:center}
.bf-x:hover{background:var(--hover);color:var(--ink)}
.bf-add{border:0;background:transparent;padding:8px 2px;color:var(--ink);font-weight:500;font-size:15px;margin:0 0 28px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:#c9cbd1}
.bf-add:hover{text-decoration-color:var(--ink)}

/* uploads */
.bf-drop{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;padding:28px 18px;border:1.5px dashed #cdd0d6;border-radius:12px;
  background:#fff;cursor:pointer;transition:border-color .12s,background .12s;color:var(--mut);font-size:14px}
.bf-drop svg{margin-bottom:6px;color:var(--ink)}
.bf-drop b{color:var(--ink);font-size:15px;font-weight:500}
.bf-drop:hover,.bf-drop.over{border-color:var(--ink);background:var(--field)}
.bf-logo{display:flex;gap:16px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:12px}
.bf-logo-img{width:132px;height:84px;flex:none;display:grid;place-items:center;border-radius:8px;
  background:repeating-conic-gradient(#f0f1f3 0 25%,#fff 0 50%) 0 0/14px 14px}
.bf-logo-img img{max-width:86%;max-height:78%;object-fit:contain}
.bf-logo-side{display:grid;gap:4px;justify-items:start;min-width:0;font-size:14px}
.bf-logo-name{font-weight:500;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bf-link{background:none;border:0;padding:0;color:var(--ink);font-weight:500;font-size:14px;text-decoration:underline;text-underline-offset:3px;text-decoration-color:#c9cbd1;cursor:pointer}
.bf-link:hover{text-decoration-color:var(--ink)}

.bf-seg{display:flex;background:var(--field);border-radius:10px;padding:3px;gap:2px;margin:0 0 14px}
.bf-seg button{flex:1;border:0;background:transparent;border-radius:8px;padding:8px 10px;font-size:14.5px;color:var(--mut)}
.bf-seg button.on{background:#fff;color:var(--ink);font-weight:500;box-shadow:0 1px 2px rgba(16,17,20,.1),0 0 0 1px rgba(16,17,20,.04)}
.bf-sws{display:flex;flex-wrap:wrap;gap:12px}
.bf-sw{display:grid;gap:6px;justify-items:center;border:0;background:none;padding:0;font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}
.bf-sw-c{position:relative;width:48px;height:48px;border-radius:10px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);transition:opacity .15s}
.bf-sw[aria-pressed=false] .bf-sw-c{opacity:.25}
.bf-sw[aria-pressed=false] span{text-decoration:line-through}
.bf-sw-c input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.bf-sw-x{border:0;background:none;padding:0;color:var(--soft);font-size:12px;text-decoration:underline}
.bf-sw-add{width:48px;height:48px;border-radius:10px;border:1.5px dashed #cdd0d6;background:#fff;font-size:22px;color:var(--mut)}

.bf-styles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.bf-style{display:grid;gap:8px;text-align:start;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;transition:border-color .12s}
.bf-style:hover{border-color:#c9cbd1}
.bf-style-sw{display:flex;height:28px;border-radius:6px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.bf-style-sw i{flex:1}
.bf-style b{font-size:14.5px;font-weight:500;display:block}
.bf-style small{font-size:12.5px;color:var(--mut);line-height:1.35;display:block}
.bf-style.on{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}

.bf-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin:12px 0 0}
.bf-thumb{position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--field)}
.bf-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.bf-thumb.up img{opacity:.5}
.bf-thumb-n{position:absolute;inset:8px;font-size:11px;color:var(--mut);word-break:break-all}
.bf-thumb-bar{position:absolute;inset-inline:8px;bottom:8px;height:3px;border-radius:3px;background:rgba(255,255,255,.75)}
.bf-thumb-bar i{display:block;height:100%;border-radius:3px;background:var(--ink);transition:width .2s}
.bf-thumb-err{position:absolute;inset:auto 6px 6px;border:0;border-radius:6px;background:var(--bad);color:#fff;font-size:11px;padding:4px}
.bf-thumb .bf-x{top:4px;inset-inline-end:4px;width:24px;height:24px;font-size:16px;background:rgba(16,17,20,.55);color:#fff}
.bf-thumb .bf-x:hover{background:var(--ink);color:#fff}
.bf-check-row{display:flex;gap:10px;align-items:flex-start;margin:18px 0 26px;cursor:pointer;font-size:15px}
.bf-check-row input{width:18px;height:18px;margin-top:3px;accent-color:var(--ink);flex:none}

/* navigation */
.bf-nav{display:flex;gap:8px;margin-top:36px;align-items:center}
@media (max-width:719px){.bf-nav{position:fixed;inset-inline:0;bottom:0;z-index:30;margin:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));
  background:rgba(255,255,255,.96);border-top:1px solid var(--line)}}
.bf-btn{border:0;background:var(--ink);color:#fff;border-radius:10px;padding:13px 28px;font-size:16px;font-weight:500;transition:background .12s,opacity .15s}
.bf-btn:hover{background:#2a2c31}
.bf-btn:disabled{opacity:.35;cursor:not-allowed}
@media (max-width:719px){.bf-btn{flex:1}}
.bf-back{border:0;background:transparent;color:var(--mut);padding:13px 16px;border-radius:10px;font-size:15px}
.bf-back:hover{background:var(--field);color:var(--ink)}

/* status screens */
.bf-center{min-height:100vh;display:grid;place-content:center;justify-items:center;text-align:center;padding:24px;max-width:460px;margin:0 auto}
.bf-spin{width:28px;height:28px;border-radius:50%;border:2.5px solid var(--line);border-top-color:var(--ink);animation:bf-rot .8s linear infinite}
@keyframes bf-rot{to{transform:rotate(360deg)}}
.bf-done-ic{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--ink);color:#fff;margin:0 0 24px}
.bf-sum{border-top:1px solid var(--line);margin-top:28px;padding-top:20px;display:grid;gap:6px;font-size:14px;color:var(--mut)}
.bf-sum b{color:var(--ink);font-weight:500}
`;
