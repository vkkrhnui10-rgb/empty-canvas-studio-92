/* Styles for the client questionnaire. White page, deep indigo-plum, pill controls, soft rounded cards. Scoped under .bf */
export const BRIEF_CSS = `
.bf{--bg:#fff;--ink:#1f164f;--text:#3f3f46;--mut:#74737f;--soft:#9b9aa6;--line:#e8e6ee;--tint:#f6f5f9;--tint2:#eeecf3;
  --green:#78b45a;--bad:#c4321c;--r-card:28px;
  min-height:100vh;background:var(--bg);color:var(--text);
  font-family:'Heebo','Assistant',system-ui,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
.bf *{box-sizing:border-box}
.bf button{font:inherit;cursor:pointer}
:where(.bf) button{color:inherit}
.bf :focus-visible{outline:2px solid var(--ink);outline-offset:2px}

/* header */
.bf-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.bf-top-in{max-width:640px;margin:0 auto;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.bf-brand{font-weight:800;color:var(--ink);font-size:17px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bf-saved{flex:none;font-size:13px;color:var(--soft);display:inline-flex;align-items:center;gap:6px}
.bf-saved::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--green)}
.bf-saved.saving::before{background:var(--soft);animation:bf-blink 1s infinite}
@keyframes bf-blink{50%{opacity:.2}}
.bf-steps{max-width:640px;margin:0 auto;padding:0 20px 12px;display:flex;gap:4px}
.bf-steps button{flex:1;height:22px;border:0;padding:0;background:none;position:relative}
.bf-steps button::after{content:"";position:absolute;inset:8px 0;border-radius:99px;background:var(--tint2);transition:background .2s}
.bf-steps button.past::after{background:#a6a1c4}
.bf-steps button.on::after{background:var(--ink)}
.bf-kicker{margin:0 0 4px;font-size:13px;font-weight:600;color:var(--soft);letter-spacing:.02em}

/* page */
.bf-main{max-width:640px;margin:0 auto;padding:36px 20px 140px}
@media (min-width:720px){.bf-main{padding-top:52px;padding-bottom:80px}}
.bf-h1{font-size:34px;line-height:1.12;font-weight:800;letter-spacing:-.02em;color:var(--ink);margin:0 0 16px}
@media (min-width:720px){.bf-h1{font-size:44px}}
.bf-h2{font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-.015em;color:var(--ink);margin:0 0 6px}
.bf-lead{font-size:18px;color:var(--mut);margin:0 0 12px;max-width:32em}
.bf-hint{color:var(--mut);margin:0 0 22px;font-size:16px}
.bf-small{font-size:14px;color:var(--mut);margin:8px 0 0}
.bf-ok{color:#3f8a2b}
.bf-err{color:var(--bad);font-size:14px;margin:12px 0 0}
.bf-step{animation:bf-in .25s ease-out}
@keyframes bf-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.bf-step{animation:none}.bf *{transition:none!important}}

.bf-card{border:1px solid var(--line);border-radius:var(--r-card);padding:22px 18px 4px;background:#fff}
@media (min-width:560px){.bf-card{padding:28px 26px 8px}}

/* intro: Hillel (the pomegranate) introduces the questionnaire */
.bf-hero{position:relative;background:var(--ink);color:#fff;border-radius:32px;padding:26px 20px 24px;margin:0 0 48px;
  background-image:radial-gradient(120% 90% at 0% 100%,rgba(120,180,90,.16),transparent 55%)}
.bf-hero .bf-h1{color:#fff;margin-bottom:18px;font-size:30px}
.bf-bubble{position:relative;background:#fff;color:var(--ink);border-radius:24px 24px 24px 6px;padding:14px 18px;font-size:16.5px;line-height:1.55;font-weight:500;max-width:30em;margin:0 0 14px}
.bf-hero-p{color:rgba(255,255,255,.72);margin:0;font-size:15.5px;max-width:30em}
.bf-hero .bf-intro-meta{padding-left:108px;margin-bottom:0}
.bf-hero .bf-intro-meta span{border-color:rgba(255,255,255,.2);color:#fff;font-size:14px;padding:7px 14px}
.bf-mascot{position:absolute;left:-6px;bottom:-34px;width:124px;height:auto;filter:drop-shadow(0 14px 18px rgba(0,0,0,.3));
  animation:bf-pop .7s cubic-bezier(.2,1.4,.4,1) .15s both;transform-origin:50% 100%}
@media (min-width:720px){
  .bf-hero{padding:40px 40px 36px;padding-left:250px;min-height:330px}
  .bf-hero .bf-h1{font-size:40px}
  .bf-hero .bf-intro-meta{padding-left:0}
  .bf-mascot{left:18px;bottom:-40px;width:220px}
}
@keyframes bf-pop{from{opacity:0;transform:translateY(24px) scale(.9)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.bf-mascot{animation:none}}
.bf-cheer{display:flex;align-items:flex-end;gap:10px;margin:-6px 0 18px}
.bf-cheer img{width:84px;height:auto;flex:none;order:2;animation:bf-pop .6s cubic-bezier(.2,1.4,.4,1) both;transform-origin:50% 100%}
.bf-cheer .bf-bubble{margin:0 0 18px;background:var(--tint);border-radius:22px 22px 6px 22px;font-size:15.5px;padding:12px 16px}
.bf-err-mascot{width:130px;height:auto;margin-bottom:18px}
.bf-intro-meta{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 8px}
.bf-intro-meta span{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:99px;padding:8px 16px;font-size:15px;color:var(--text)}
.bf-intro-meta span::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--green)}

/* questions */
.bf-q{margin:0 0 22px}
.bf-q-l{display:block;margin:0 0 9px;font-weight:700;font-size:16px;color:var(--ink)}
.bf-q-l small{display:block;font-weight:400;font-size:14px;color:var(--mut);margin-top:1px}
.bf-q-l em{font-style:normal;color:var(--soft);font-size:13px;font-weight:400;margin-inline-start:8px}
.bf-in{width:100%;background:#fff;border:1px solid var(--line);border-radius:99px;padding:13px 20px;font:inherit;color:var(--text);
  transition:border-color .12s,box-shadow .12s;appearance:none;box-shadow:0 1px 2px rgba(31,22,79,.04)}
.bf-in::placeholder{color:#a9a8b3}
.bf-in:hover{border-color:#d6d3df}
.bf-in:focus{outline:none;border-color:var(--ink);box-shadow:0 0 0 4px rgba(31,22,79,.08)}
.bf-area{border-radius:22px;resize:none;min-height:52px;line-height:1.65;overflow:hidden;padding:13px 20px;display:block}
.bf-area-w{position:relative}
.bf-area-w.has-mic .bf-area{padding-inline-end:56px}
.bf-mic{position:absolute;top:7px;inset-inline-end:7px;width:38px;height:38px;border-radius:50%;border:0;background:var(--tint);color:var(--ink);display:grid;place-items:center;transition:background .15s}
.bf-mic:hover{background:var(--tint2)}
.bf-mic.on{background:#e5484d;color:#fff;animation:bf-pulse 1.4s infinite}
@keyframes bf-pulse{0%{box-shadow:0 0 0 0 rgba(229,72,77,.45)}70%{box-shadow:0 0 0 10px rgba(229,72,77,0)}100%{box-shadow:0 0 0 0 rgba(229,72,77,0)}}
.bf-mic-tip{display:block;font-size:13px;color:#c4321c;margin-top:6px}
.bf-two{display:grid;grid-template-columns:1fr;gap:0 14px}
@media (min-width:560px){.bf-two{grid-template-columns:1fr 1fr}}

/* chips: tap to choose */
.bf-chips{display:flex;flex-wrap:wrap;gap:8px}
.bf-chip{border:1px solid var(--line);background:#fff;border-radius:99px;padding:9px 16px;font-size:15px;line-height:1.3;color:var(--text);
  transition:border-color .12s,background .12s,color .12s;min-height:42px;-webkit-tap-highlight-color:transparent}
.bf-chip:hover{border-color:#d6d3df}
.bf-chip.on{background:var(--ink);border-color:var(--ink);color:#fff;font-weight:600}
.bf-chip.on::before{content:"✓";margin-inline-end:6px;font-size:13px}

/* repeating groups */
.bf-group{display:grid;gap:12px;margin:0 0 12px}
.bf-item{position:relative;display:grid;gap:10px;padding:16px;border-radius:24px;background:var(--tint)}
.bf-item .bf-in{box-shadow:none}
.bf-x{position:absolute;top:-9px;inset-inline-end:-6px;width:30px;height:30px;border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--mut);font-size:18px;line-height:1;display:grid;place-items:center}
.bf-x:hover{border-color:var(--ink);color:var(--ink)}
.bf-row{display:flex;gap:8px}
.bf-row>.bf-in:first-child{flex:1;min-width:0}
.bf-price{width:110px;flex:none}
.bf-short{max-width:160px}
.bf-add{display:inline-flex;align-items:center;gap:8px;border:1px dashed #cfccd9;background:#fff;border-radius:99px;padding:10px 20px;color:var(--ink);font-weight:600;font-size:15px;margin:0 0 24px}
.bf-add::before{content:"+";font-size:18px;line-height:1}
.bf-add:hover{border-color:var(--ink);border-style:solid}

/* uploads */
.bf-drop{display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;padding:28px 18px;border:1.5px dashed #d3d0dc;border-radius:24px;
  background:#fff;cursor:pointer;transition:border-color .12s,background .12s;color:var(--mut);font-size:14px}
.bf-drop svg{margin-bottom:8px;color:var(--ink);width:44px;height:44px;padding:11px;border-radius:50%;background:var(--tint)}
.bf-drop b{color:var(--ink);font-size:16px;font-weight:700}
.bf-drop:hover,.bf-drop.over{border-color:var(--ink);background:var(--tint)}
.bf-alt{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;border:1px solid var(--line);background:#fff;border-radius:99px;
  padding:12px 16px;font-size:15px;font-weight:600;color:var(--ink);cursor:pointer}
.bf-alt:hover{border-color:var(--ink)}
.bf-drive{margin-top:10px;border:1px solid var(--line);border-radius:24px;padding:16px;background:var(--tint)}
.bf-drive-head{display:flex;align-items:center;gap:8px;color:var(--ink);margin-bottom:6px}
.bf-drive-row{display:flex;gap:8px}
.bf-drive-row .bf-in{flex:1;min-width:0;box-shadow:none}
.bf-btn-sm{flex:none!important;padding:12px 20px!important;font-size:15px!important;box-shadow:none!important}
.bf-logo{display:flex;gap:16px;align-items:center;border:1px solid var(--line);border-radius:24px;padding:12px}
.bf-logo-img{width:132px;height:88px;flex:none;display:grid;place-items:center;border-radius:16px;
  background:repeating-conic-gradient(#f2f1f5 0 25%,#fff 0 50%) 0 0/14px 14px}
.bf-logo-img img{max-width:86%;max-height:78%;object-fit:contain}
.bf-logo-side{display:grid;gap:4px;justify-items:start;min-width:0;font-size:14px}
.bf-logo-name{font-weight:600;color:var(--ink);max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bf-link{background:none;border:0;padding:0;color:var(--ink);font-weight:600;font-size:14px;text-decoration:underline;text-underline-offset:3px;text-decoration-color:#cfccd9;cursor:pointer}
.bf-link:hover{text-decoration-color:var(--ink)}

.bf-seg{display:flex;background:var(--tint2);border-radius:99px;padding:4px;gap:2px;margin:0 0 16px}
.bf-seg button{flex:1;border:0;background:transparent;border-radius:99px;padding:9px 10px;font-size:15px;color:var(--mut)}
.bf-seg button.on{background:#fff;color:var(--ink);font-weight:700;box-shadow:0 1px 3px rgba(31,22,79,.12)}
.bf-sws{display:flex;flex-wrap:wrap;gap:14px}
.bf-sw{display:grid;gap:6px;justify-items:center;border:0;background:none;padding:0;font-size:12px;color:var(--mut)}
.bf-sw-c{position:relative;width:52px;height:52px;border-radius:50%;box-shadow:0 0 0 3px #fff,0 0 0 4px var(--line);transition:opacity .15s,box-shadow .15s}
.bf-sw[aria-pressed=true] .bf-sw-c{box-shadow:0 0 0 3px #fff,0 0 0 5px var(--ink)}
.bf-sw[aria-pressed=false] .bf-sw-c{opacity:.25}
.bf-sw[aria-pressed=false] span{text-decoration:line-through}
.bf-sw-c input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border-radius:50%}
.bf-sw-x{border:0;background:none;padding:0;color:var(--soft);font-size:12px;text-decoration:underline}
.bf-sw-add{width:52px;height:52px;border-radius:50%;border:1.5px dashed #cfccd9;background:#fff;font-size:22px;color:var(--mut)}

.bf-styles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.bf-style{display:grid;gap:10px;text-align:start;background:#fff;border:1px solid var(--line);border-radius:22px;padding:10px 10px 12px;transition:border-color .12s,background .12s}
.bf-style:hover{border-color:#d6d3df}
.bf-style-sw{display:flex;height:34px;border-radius:14px;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}
.bf-style-sw i{flex:1}
.bf-style>span:last-child{padding:0 4px}
.bf-style b{font-size:15px;font-weight:700;color:var(--ink);display:block}
.bf-style small{font-size:13px;color:var(--mut);line-height:1.35;display:block}
.bf-style.on{border-color:var(--ink);background:var(--tint);box-shadow:0 0 0 1px var(--ink)}
.bf-tone{padding:14px 12px}

.bf-missing{margin-top:18px;border-radius:24px;background:#fff8e6;border:1px solid #f3e2b3;padding:14px 16px;font-size:14px;color:#6b5418;display:grid;gap:4px}
.bf-missing b{color:#4d3b0c;font-size:15px}
.bf-missing div{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.bf-missing button{border:1px solid #e8d49c;background:#fff;border-radius:99px;padding:6px 12px;font-size:14px;color:#4d3b0c}

.bf-thumbs-head{margin-top:16px}
.bf-thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px;margin:8px 0 0}
.bf-thumb{position:relative;aspect-ratio:1;border-radius:18px;overflow:hidden;background:var(--tint)}
.bf-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.bf-thumb.up img{opacity:.5}
.bf-thumb-n{position:absolute;inset:10px;font-size:11px;color:var(--mut);word-break:break-all}
.bf-thumb-bar{position:absolute;inset-inline:10px;bottom:10px;height:5px;border-radius:99px;background:rgba(255,255,255,.8)}
.bf-thumb-bar i{display:block;height:100%;border-radius:99px;background:var(--ink);transition:width .2s}
.bf-thumb-err{position:absolute;inset:auto 6px 6px;border:0;border-radius:99px;background:var(--bad);color:#fff;font-size:11px;padding:4px}
.bf-thumb .bf-x{top:6px;inset-inline-end:6px;width:26px;height:26px;font-size:16px;background:rgba(31,22,79,.6);color:#fff}
.bf-thumb .bf-x:hover{background:var(--ink);color:#fff}
.bf-check-row{display:flex;gap:12px;align-items:center;margin:16px 0 22px;cursor:pointer;font-size:15px;border:1px solid var(--line);border-radius:99px;padding:12px 18px}
.bf-check-tight{margin:-8px 0 22px}
.bf-check-row input{width:20px;height:20px;accent-color:var(--ink);flex:none;margin:0}

/* navigation */
.bf-nav{display:flex;gap:10px;margin-top:28px;align-items:center}
@media (max-width:719px){.bf-nav{position:fixed;inset-inline:0;bottom:0;z-index:30;margin:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));
  background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-top:1px solid var(--line)}}
.bf-btn{border:0;background:var(--ink);color:#fff;border-radius:99px;padding:15px 34px;font-size:16.5px;font-weight:600;transition:background .12s,opacity .15s,transform .1s;
  box-shadow:0 6px 16px -6px rgba(31,22,79,.45)}
.bf-btn:hover{background:#2c2168}
.bf-btn:active{transform:scale(.98)}
.bf-btn:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}
@media (max-width:719px){.bf-btn{flex:1}.bf.kb .bf-nav{display:none}}
.bf-back{border:1px solid var(--line);background:#fff;color:var(--ink);padding:14px 22px;border-radius:99px;font-size:15.5px;font-weight:500}
.bf-back:hover{border-color:var(--ink)}

/* status screens */
.bf-center{min-height:100vh;display:grid;place-content:center;justify-items:center;text-align:center;padding:24px;max-width:460px;margin:0 auto}
.bf-spin{width:30px;height:30px;border-radius:50%;border:3px solid var(--tint2);border-top-color:var(--ink);animation:bf-rot .8s linear infinite}
@keyframes bf-rot{to{transform:rotate(360deg)}}
.bf-done-top{position:relative;width:132px;margin:0 0 18px}
.bf-done-mascot{display:block;width:132px;height:auto;animation:bf-pop .7s cubic-bezier(.2,1.4,.4,1) both;transform-origin:50% 100%}
.bf-done-ic{position:absolute;top:6px;left:-6px;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--green);color:#fff;box-shadow:0 0 0 4px #fff}
.bf-sum{border:1px solid var(--line);border-radius:var(--r-card);margin-top:28px;padding:18px 22px;display:grid;gap:8px;font-size:15px;color:var(--mut)}
.bf-sum span{display:flex;align-items:center;gap:10px}
.bf-sum span::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--green);flex:none}
.bf-sum b{color:var(--ink);font-weight:700}
`;
