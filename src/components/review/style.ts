/* Styles for the client's design-review page. Scoped under .rv. Same family as the questionnaire:
   white surfaces, deep indigo ink, pill controls, a soft grey stage for the site. */
export const REVIEW_CSS = `
.rv{--ink:#1f164f;--text:#3f3f46;--mut:#74737f;--soft:#9b9aa6;--line:#e8e6ee;--tint:#f6f5f9;--tint2:#eeecf3;
  --stage:#ebe9f2;--accent:#5b4bdb;--red:#e5484d;--green:#2e9d5a;
  position:fixed;inset:0;display:flex;flex-direction:column;background:var(--stage);color:var(--text);
  font-family:'Heebo','Assistant',system-ui,sans-serif;font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;overflow:hidden}
.rv *{box-sizing:border-box}
:where(.rv) button{font:inherit;cursor:pointer;color:inherit;border:0;background:none;padding:0}
.rv :focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* top bar */
.rv-top{flex:none;display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fff;border-bottom:1px solid var(--line);min-height:56px;z-index:5}
.rv-brand{min-width:0;flex:1;display:flex;align-items:center;gap:10px}
.rv-brand img{width:34px;height:34px;flex:none}
.rv-brand b{display:block;color:var(--ink);font-weight:800;font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv-brand span{display:block;font-size:12.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rv-seg{flex:none;display:inline-flex;background:var(--tint2);border-radius:99px;padding:3px}
.rv-seg button{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:99px;font-size:14px;font-weight:600;color:var(--mut);transition:background .15s,color .15s}
.rv-seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(31,22,79,.14)}
.rv-seg svg{width:17px;height:17px}
.rv-count{flex:none;display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 12px;border-radius:99px;background:var(--ink);color:#fff!important;font-weight:700;font-size:14px}
.rv-count i{font-style:normal;background:#fff;color:var(--ink);border-radius:99px;min-width:22px;height:22px;line-height:22px;text-align:center;font-size:12.5px;padding:0 6px}
@media (max-width:560px){.rv-brand span{display:none}.rv-seg button{padding:7px 10px}.rv-seg button em{display:none}.rv-brand img{display:none}}
@media (min-width:1000px){.rv-count{display:none}}

/* body: stage + panel */
.rv-body{flex:1;min-height:0;display:flex}
.rv-stage{position:relative;flex:1;min-width:0;display:flex;align-items:flex-start;justify-content:center;overflow:hidden;padding:16px}
.rv-stage.zoom{overflow:auto;justify-content:flex-start}
@media (max-width:560px){.rv-stage{padding:10px 8px 0}}

/* desktop: a browser window */
.rv-win{position:relative;flex:none;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(31,22,79,.16),0 0 0 1px rgba(31,22,79,.06);transform-origin:top center}
.rv-stage.zoom .rv-win{transform-origin:top right}
.rv-bar{height:38px;display:flex;align-items:center;gap:7px;padding:0 14px;background:#f3f2f7;border-bottom:1px solid var(--line)}
.rv-bar i{width:11px;height:11px;border-radius:50%;background:#d9d6e4;flex:none}
.rv-url{flex:1;margin:0 10px;height:24px;border-radius:7px;background:#fff;border:1px solid var(--line);font-size:12.5px;color:var(--mut);display:flex;align-items:center;justify-content:center;direction:ltr;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 10px}
/* mobile: a phone */
.rv-phone{position:relative;flex:none;background:#111;border-radius:46px;padding:12px;box-shadow:0 18px 50px rgba(31,22,79,.25);transform-origin:top center}
.rv-phone .rv-screen{border-radius:34px;overflow:hidden;background:#fff;position:relative}
.rv-phone.flat{padding:0;border-radius:14px;background:#fff;box-shadow:0 6px 24px rgba(31,22,79,.14),0 0 0 1px rgba(31,22,79,.08)}
.rv-phone.flat .rv-screen{border-radius:14px}
.rv-frame{display:block;border:0;background:#fff}
.rv-cover{position:absolute;inset:0;z-index:2;cursor:crosshair;background:rgba(91,75,219,.04)}
.rv-mark{position:absolute;z-index:3;width:30px;height:30px;margin:-30px 0 0 -4px;border-radius:15px 15px 15px 3px;background:var(--accent);color:#fff;
  font-weight:700;font-size:13px;line-height:30px;text-align:center;box-shadow:0 3px 10px rgba(20,10,60,.35),0 0 0 2px #fff;transform-origin:4px 30px}
.rv-mark.new{background:var(--red);animation:rv-pop .35s cubic-bezier(.3,1.6,.5,1)}
.rv-mark.done{background:var(--green)}
.rv-mark.old{background:#8f8aa8}
button.rv-mark{cursor:pointer}
@keyframes rv-pop{from{transform:scale(.2)}to{transform:scale(1)}}
.rv-loading{position:absolute;inset:0;display:grid;place-items:center;background:#fff;color:var(--mut);font-size:14px;z-index:1}
.rv-spin{width:26px;height:26px;border-radius:50%;border:3px solid var(--tint2);border-top-color:var(--accent);animation:rv-spin .8s linear infinite;margin:0 auto 10px}
@keyframes rv-spin{to{transform:rotate(360deg)}}

/* page screenshot (fallback) */
.rv-shotwrap{position:relative;flex:none;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(31,22,79,.16)}
.rv-shotwrap img{display:block;width:100%;height:auto;user-select:none;-webkit-user-drag:none}
.rv-shotscroll{position:absolute;inset:0;overflow:auto;padding:16px;display:flex;justify-content:center}

/* banners over the stage */
.rv-hint{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:6;background:var(--ink);color:#fff;border-radius:99px;padding:9px 16px;font-size:14px;font-weight:600;
  box-shadow:0 8px 24px rgba(31,22,79,.3);white-space:nowrap;display:flex;align-items:center;gap:8px;animation:rv-down .25s ease-out;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis}
.rv-hint::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--red);flex:none;animation:rv-blink 1.2s infinite}
@keyframes rv-blink{50%{opacity:.25}}
@keyframes rv-down{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
.rv-note{position:absolute;bottom:92px;left:50%;transform:translateX(-50%);z-index:6;width:min(560px,calc(100% - 24px));background:#fff;border-radius:18px;padding:14px 16px;
  box-shadow:0 10px 30px rgba(31,22,79,.18);font-size:14px;color:var(--text);animation:rv-up .25s ease-out}
.rv-note b{color:var(--ink)}
.rv-note .rv-row{margin-top:10px}
@keyframes rv-up{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}

/* the big add button */
.rv-fab{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);z-index:7;display:inline-flex;align-items:center;gap:9px;height:54px;padding:0 24px;border-radius:99px;
  background:var(--accent)!important;color:#fff!important;font-weight:700!important;font-size:16px!important;box-shadow:0 10px 28px rgba(91,75,219,.45);transition:transform .15s,background .15s;white-space:nowrap}
.rv-fab:hover{transform:translateX(-50%) translateY(-1px)}
.rv-fab.on{background:var(--ink)!important;box-shadow:0 10px 28px rgba(31,22,79,.4)}
.rv-fab svg{width:20px;height:20px}
.rv-zoom{position:absolute;bottom:30px;inset-inline-end:18px;z-index:7;height:38px;padding:0 12px;border-radius:99px;background:#fff!important;color:var(--ink)!important;font-size:13px!important;font-weight:600!important;
  box-shadow:0 4px 14px rgba(31,22,79,.15)}
@media (max-width:560px){.rv-zoom{bottom:96px}}

/* side panel / bottom sheet */
.rv-panel{flex:none;width:370px;background:#fff;border-inline-start:1px solid var(--line);display:flex;flex-direction:column;min-height:0}
.rv-ph{padding:16px 18px 10px;border-bottom:1px solid var(--line)}
.rv-ph h2{margin:0;color:var(--ink);font-size:18px;font-weight:800}
.rv-ph p{margin:2px 0 0;color:var(--mut);font-size:13px}
.rv-list{flex:1;overflow:auto;padding:8px 10px 12px}
.rv-empty{padding:28px 16px;text-align:center;color:var(--mut)}
.rv-empty img{width:96px;margin:0 auto 8px;display:block}
.rv-item{display:flex;gap:10px;align-items:flex-start;width:100%;text-align:right;padding:10px 8px;border-radius:14px;transition:background .12s}
.rv-item:hover,.rv-item.on{background:var(--tint)}
.rv-num{flex:none;width:26px;height:26px;border-radius:13px 13px 13px 3px;background:var(--accent);color:#fff;font-size:12.5px;font-weight:700;display:grid;place-items:center;margin-top:2px}
.rv-num.done{background:var(--green)}
.rv-num.old{background:#8f8aa8}
.rv-item-b{flex:1;min-width:0}
.rv-item-t{color:var(--ink);font-size:14.5px;white-space:pre-wrap;word-break:break-word}
.rv-item-w{font-size:12.5px;color:var(--mut);margin-top:3px;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}
.rv-chip{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:99px;background:var(--tint2);color:var(--mut)}
.rv-chip.ok{background:#e3f4ea;color:#1f7a45}
.rv-item img.rv-th{width:64px;height:48px;object-fit:cover;border-radius:8px;flex:none;border:1px solid var(--line);background:var(--tint)}
.rv-acts{display:flex;gap:2px;margin-top:4px}
.rv-acts button{font-size:12.5px;color:var(--mut);padding:2px 6px;border-radius:6px}
.rv-acts button:hover{background:var(--tint2);color:var(--ink)}
.rv-sec{margin:14px 8px 4px;font-size:12.5px;font-weight:700;color:var(--soft);display:flex;align-items:center;gap:8px}
.rv-sec button{margin-inline-start:auto;font-weight:600;color:var(--accent)}
.rv-pf{padding:12px 14px 14px;border-top:1px solid var(--line);display:grid;gap:8px}
.rv-btn{height:46px;border-radius:99px;font-weight:700!important;font-size:15px!important;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px}
.rv-btn.pri{background:var(--ink)!important;color:#fff!important}
.rv-btn.pri:disabled{opacity:.4;cursor:default}
.rv-btn.ok{background:#e3f4ea!important;color:#1f7a45!important}
.rv-btn.ghost{background:var(--tint)!important;color:var(--ink)!important}
.rv-btn.red{background:#fdeceb!important;color:#b42318!important}
.rv-btn svg{width:18px;height:18px}
.rv-done{margin:8px 10px;padding:12px 14px;border-radius:16px;background:#e3f4ea;color:#1f7a45;font-size:14px;font-weight:600}
.rv-sent{margin:8px 10px;padding:12px 14px;border-radius:16px;background:var(--tint);color:var(--ink);font-size:14px}

@media (max-width:999px){
  .rv-panel{position:fixed;inset:auto 0 0 0;width:auto;height:min(78vh,620px);border:0;border-radius:24px 24px 0 0;box-shadow:0 -10px 40px rgba(31,22,79,.22);z-index:20;
    transform:translateY(105%);transition:transform .28s cubic-bezier(.2,.8,.2,1)}
  .rv-panel.open{transform:none}
  .rv-ph{position:relative;padding-top:22px}
  .rv-ph::before{content:"";position:absolute;top:8px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:4px;background:var(--line)}
}
.rv-scrim{position:fixed;inset:0;background:rgba(20,14,50,.38);z-index:19;animation:rv-fade .2s}
@keyframes rv-fade{from{opacity:0}}

/* composer + dialogs */
.rv-dlg{position:fixed;z-index:30;left:50%;bottom:24px;transform:translateX(-50%);width:min(460px,calc(100% - 20px));max-height:calc(100dvh - 40px);overflow:auto;background:#fff;border-radius:24px;
  box-shadow:0 20px 60px rgba(20,14,50,.35);padding:16px;animation:rv-up .25s ease-out}
@media (max-width:560px){.rv-dlg{bottom:0;width:100%;border-radius:24px 24px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom))}}
.rv-dlg h3{margin:0 0 4px;color:var(--ink);font-size:17px;font-weight:800}
.rv-where{font-size:13px;color:var(--mut);margin:0 0 10px;display:flex;gap:6px;align-items:flex-start}
.rv-where svg{width:15px;height:15px;flex:none;margin-top:2px;color:var(--accent)}
.rv-shot{width:100%;max-height:200px;object-fit:contain;object-position:center;border-radius:12px;background:var(--tint);border:1px solid var(--line);display:block;margin:0 0 10px}
.rv-shot.wait{height:110px;display:grid;place-items:center;color:var(--soft);font-size:13px}
.rv-ta-w{position:relative}
.rv-ta{width:100%;min-height:96px;resize:none;border:1.5px solid var(--line);border-radius:16px;padding:12px 14px 12px 52px;font:inherit;font-size:16px;color:var(--ink);background:#fff;outline:none}
.rv-ta:focus{border-color:var(--accent)}
.rv-mic{position:absolute;left:8px;bottom:10px;width:38px;height:38px;border-radius:50%;background:var(--tint)!important;color:var(--ink)!important;display:grid;place-items:center}
.rv-mic.on{background:var(--red)!important;color:#fff!important;animation:rv-blink 1.2s infinite}
.rv-in{width:100%;height:44px;border:1.5px solid var(--line);border-radius:14px;padding:0 14px;font:inherit;font-size:16px;color:var(--ink);outline:none;background:#fff}
.rv-in:focus{border-color:var(--accent)}
.rv-lbl{display:block;font-size:13px;font-weight:600;color:var(--mut);margin:10px 0 5px}
.rv-row{display:flex;gap:8px;margin-top:12px}
.rv-row .rv-btn{flex:1}
.rv-err{color:#b42318;font-size:13.5px;margin:8px 0 0}
.rv-quick{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.rv-quick button{font-size:13px;padding:5px 11px;border-radius:99px;background:var(--tint)!important;color:var(--ink)!important}
.rv-quick button:hover{background:var(--tint2)!important}

/* welcome */
.rv-welcome{position:fixed;inset:0;z-index:40;display:grid;place-items:center;background:rgba(20,14,50,.5);padding:16px;animation:rv-fade .2s}
.rv-wcard{width:min(440px,100%);background:#fff;border-radius:28px;padding:22px 20px 18px;box-shadow:0 30px 80px rgba(20,14,50,.4);position:relative}
.rv-wcard img{width:92px;position:absolute;top:-58px;left:18px}
.rv-wcard h2{margin:0 0 6px;color:var(--ink);font-size:23px;font-weight:800;line-height:1.2}
.rv-wcard p{margin:0 0 14px;color:var(--mut)}
.rv-steps{list-style:none;margin:0 0 16px;padding:0;display:grid;gap:10px}
.rv-steps li{display:flex;gap:10px;align-items:flex-start;color:var(--ink);font-size:15px}
.rv-steps li span{flex:none;width:26px;height:26px;border-radius:50%;background:var(--tint2);display:grid;place-items:center;font-weight:800;font-size:13px}
.rv-toast{position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:50;background:var(--ink);color:#fff;padding:10px 18px;border-radius:99px;font-size:14px;font-weight:600;
  box-shadow:0 10px 30px rgba(20,14,50,.3);animation:rv-fade .25s ease-out;max-width:calc(100% - 24px);white-space:nowrap}
.rv-toast.bad{background:#b42318}
.rv-full{position:fixed;inset:0;display:grid;place-items:center;background:#fff;font-family:'Heebo',system-ui,sans-serif;color:#1f164f;text-align:center;padding:24px}
@media (prefers-reduced-motion:reduce){.rv *{animation:none!important;transition:none!important}}
`;
