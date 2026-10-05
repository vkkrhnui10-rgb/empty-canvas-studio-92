/*!
 * FOCUS design feedback — the one line a site owner adds to a client's site:
 *   <script src="https://<focus>/feedback.js" async></script>
 *
 * It does nothing for ordinary visitors. Only when the site is shown inside a FOCUS review page
 * (/r/<id>) and that page says hello, it lets the client click any element to leave a note,
 * reports where the note points (element, section, text), takes a picture of what the client
 * saw, and draws the numbered pins on the live page so they stay on their element while the
 * page scrolls and animates.
 */
(function () {
  "use strict";
  if (window.__focusFeedback) return;
  window.__focusFeedback = true;
  if (window.top === window.self) return; // only inside a review page

  var me = document.currentScript && document.currentScript.src;
  var ORIGIN;
  try {
    ORIGIN = new URL(me || "", location.href).origin;
  } catch (e) {
    return;
  }
  var SRC = "focus-fb";
  var parentWin = window.parent;
  var active = false;
  var commenting = false;
  var pins = [];
  var host, root, layer, hover, tip, temp;

  function post(msg) {
    msg.src = SRC;
    try {
      parentWin.postMessage(msg, ORIGIN);
    } catch (e) {
      /* parent gone */
    }
  }

  /* ---------------- where am I ---------------- */
  function pagePath() {
    return location.pathname + (location.hash && location.hash.length > 2 && location.hash.indexOf("#/") === 0 ? location.hash : "");
  }
  function announce(type) {
    post({
      type: type,
      path: pagePath(),
      title: document.title,
      vw: window.innerWidth,
    });
  }
  // single-page sites change the address without a reload
  ["pushState", "replaceState"].forEach(function (k) {
    var orig = history[k];
    if (!orig) return;
    history[k] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(function () {
        if (active) announce("nav");
      }, 30);
      return r;
    };
  });
  window.addEventListener("popstate", function () {
    if (active) announce("nav");
  });
  window.addEventListener("hashchange", function () {
    if (active) announce("nav");
  });

  /* ---------------- element → anchor ---------------- */
  function cssEsc(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
  function goodId(id) {
    // skip generated ids (React useId ":r1:", long hashes, numbers)
    return id && id.length < 40 && !/^[:\d]|:|\d{3,}|[a-f0-9]{8,}/i.test(id);
  }
  function selectorOf(el) {
    var parts = [];
    var n = el;
    while (n && n.nodeType === 1 && n !== document.documentElement) {
      if (goodId(n.id) && document.querySelectorAll("#" + cssEsc(n.id)).length === 1) {
        parts.unshift("#" + cssEsc(n.id));
        break;
      }
      var tag = n.tagName.toLowerCase();
      if (tag === "body") {
        parts.unshift("body");
        break;
      }
      var i = 1;
      var sib = n;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === n.tagName) i++;
      var same = 0;
      if (n.parentElement)
        for (var k = 0; k < n.parentElement.children.length; k++)
          if (n.parentElement.children[k].tagName === n.tagName) same++;
      parts.unshift(same > 1 ? tag + ":nth-of-type(" + i + ")" : tag);
      n = n.parentElement;
    }
    return parts.join(" > ");
  }
  function clean(s, n) {
    return (s || "").replace(/\s+/g, " ").trim().slice(0, n);
  }
  function ownText(el) {
    var t = el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("title") || "";
    if (!t) t = el.innerText || el.textContent || "";
    if (!t && el.tagName === "INPUT") t = el.getAttribute("placeholder") || el.value || "";
    return clean(t, 150);
  }
  function sectionOf(el) {
    var n = el;
    while (n && n !== document.body) {
      var tag = n.tagName.toLowerCase();
      if (/^(section|header|footer|nav|article|aside|main)$/.test(tag) || n.getAttribute("role") === "region") {
        if (tag === "header") return "הכותרת העליונה";
        if (tag === "footer") return "הפוטר";
        if (tag === "nav") return "התפריט";
        var h = n.querySelector("h1,h2,h3,h4");
        var name = (h && clean(h.innerText || h.textContent, 80)) || n.getAttribute("aria-label") || "";
        if (name) return clean(name, 80);
      }
      n = n.parentElement;
    }
    // no semantic wrapper: the closest heading above the element
    var heads = document.querySelectorAll("h1,h2,h3");
    var best = "";
    var y = el.getBoundingClientRect().top;
    for (var i = 0; i < heads.length; i++) {
      var r = heads[i].getBoundingClientRect();
      if (r.top <= y + 4 && r.height > 0) best = clean(heads[i].innerText || heads[i].textContent, 80);
    }
    return best;
  }
  function meaningful(el) {
    // a click on a tiny inline piece inside a button/link counts for the button/link
    var n = el;
    for (var d = 0; n && d < 4; d++, n = n.parentElement) {
      var t = n.tagName;
      if (t === "A" || t === "BUTTON" || t === "LABEL" || n.getAttribute("role") === "button") return n;
    }
    if (el.tagName === "path" || el.tagName === "use" || el.tagName === "g") {
      var svg = el.closest && el.closest("svg");
      if (svg) return svg;
    }
    return el;
  }
  function anchorFor(el, x, y) {
    var r = el.getBoundingClientRect();
    return {
      sel: selectorOf(el),
      tag: el.tagName.toLowerCase(),
      text: ownText(el),
      section: sectionOf(el),
      ox: r.width ? Math.min(1, Math.max(0, (x - r.left) / r.width)) : 0.5,
      oy: r.height ? Math.min(1, Math.max(0, (y - r.top) / r.height)) : 0.5,
      px: Math.round(x + window.scrollX),
      py: Math.round(y + window.scrollY),
      ph: Math.round(document.documentElement.scrollHeight),
      vw: window.innerWidth,
    };
  }
  function resolve(a) {
    var el = null;
    try {
      el = document.querySelector(a.sel);
    } catch (e) {
      el = null;
    }
    if (el && a.text && ownText(el).slice(0, 40) !== a.text.slice(0, 40)) {
      // the page changed: look for the same kind of element with the same text
      var list = document.getElementsByTagName(a.tag || "*");
      var hit = null;
      for (var i = 0; i < list.length && !hit; i++) if (ownText(list[i]).slice(0, 40) === a.text.slice(0, 40)) hit = list[i];
      if (hit) el = hit;
    }
    return el;
  }

  /* ---------------- the layer (shadow DOM, so the site's CSS can't touch it) ---------------- */
  function build() {
    if (host) return;
    host = document.createElement("focus-feedback");
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var css = document.createElement("style");
    css.textContent =
      ":host{all:initial}" +
      ".pin{position:fixed;width:30px;height:30px;margin:-30px 0 0 -4px;border-radius:15px 15px 15px 3px;" +
      "background:#5b4bdb;color:#fff;font:700 13px/30px system-ui,Arial,sans-serif;text-align:center;" +
      "box-shadow:0 3px 10px rgba(20,10,60,.35),0 0 0 2px #fff;pointer-events:auto;cursor:pointer;" +
      "transform-origin:4px 30px;transition:transform .15s}" +
      ".pin:hover{transform:scale(1.12)}" +
      ".pin.done{background:#2e9d5a}" +
      ".pin.old{background:#8f8aa8}" +
      ".pin.new{background:#e5484d;animation:pop .35s cubic-bezier(.3,1.6,.5,1)}" +
      ".pin.focus{transform:scale(1.25)}" +
      "@keyframes pop{from{transform:scale(.2)}to{transform:scale(1)}}" +
      ".hover{position:fixed;border:2px solid #5b4bdb;background:rgba(91,75,219,.08);border-radius:6px;" +
      "pointer-events:none;display:none;transition:all .08s}" +
      ".tip{position:fixed;background:#1f164f;color:#fff;font:500 12px/1.4 system-ui,Arial,sans-serif;" +
      "padding:4px 8px;border-radius:6px;pointer-events:none;display:none;white-space:nowrap;direction:rtl;max-width:260px;overflow:hidden;text-overflow:ellipsis}";
    root.appendChild(css);
    layer = document.createElement("div");
    hover = document.createElement("div");
    hover.className = "hover";
    tip = document.createElement("div");
    tip.className = "tip";
    root.appendChild(layer);
    root.appendChild(hover);
    root.appendChild(tip);
    document.documentElement.appendChild(host);
  }

  function ours(t) {
    return t === host || (t && t.closest && t.closest("focus-feedback"));
  }

  var TAGS = { a: "קישור", button: "כפתור", img: "תמונה", svg: "אייקון", h1: "כותרת", h2: "כותרת", h3: "כותרת", h4: "כותרת", p: "פסקה", input: "שדה", textarea: "שדה", video: "סרטון", li: "פריט" };

  function onMove(e) {
    if (!commenting) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || ours(el)) return;
    el = meaningful(el);
    var r = el.getBoundingClientRect();
    hover.style.display = "block";
    hover.style.left = r.left - 3 + "px";
    hover.style.top = r.top - 3 + "px";
    hover.style.width = r.width + 6 + "px";
    hover.style.height = r.height + 6 + "px";
    var label = (TAGS[el.tagName.toLowerCase()] || "") + (ownText(el) ? " · " + ownText(el).slice(0, 40) : "");
    if (label) {
      tip.textContent = label.replace(/^ · /, "");
      tip.style.display = "block";
      tip.style.left = Math.min(window.innerWidth - 200, Math.max(4, r.left)) + "px";
      tip.style.top = (r.top > 30 ? r.top - 28 : r.bottom + 6) + "px";
    } else tip.style.display = "none";
  }
  function hideHover() {
    if (hover) hover.style.display = "none";
    if (tip) tip.style.display = "none";
  }

  function swallow(e) {
    if (!commenting || ours(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  var pickN = 0;
  function onClick(e) {
    if (!commenting || ours(e.target)) return;
    swallow(e);
    var x = e.clientX;
    var y = e.clientY;
    var el = document.elementFromPoint(x, y);
    if (!el || ours(el)) return;
    el = meaningful(el);
    var a = anchorFor(el, x, y);
    var pickId = "p" + Date.now().toString(36) + pickN++;
    showTemp(x, y);
    post({ type: "pick", pickId: pickId, anchor: a, path: pagePath(), vw: window.innerWidth });
    snap(el, x, y, pickId);
  }

  function showTemp(x, y) {
    if (temp) temp.remove();
    temp = document.createElement("div");
    temp.className = "pin new";
    temp.textContent = "+";
    temp.style.left = x + "px";
    temp.style.top = y + "px";
    layer.appendChild(temp);
  }

  /* ---------------- pins that follow their element ---------------- */
  function place() {
    for (var i = 0; i < pins.length; i++) {
      var p = pins[i];
      var el = p.el && p.el.isConnected ? p.el : (p.el = resolve(p.anchor));
      var x, y;
      if (el) {
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) {
          p.node.style.display = "none";
          continue;
        }
        x = r.left + p.anchor.ox * r.width;
        y = r.top + p.anchor.oy * r.height;
      } else {
        x = p.anchor.px - window.scrollX;
        y = p.anchor.py - window.scrollY;
      }
      p.node.style.display = "block";
      p.node.style.left = x + "px";
      p.node.style.top = y + "px";
    }
  }
  var raf = 0;
  function loop() {
    raf = 0;
    if (!pins.length && !temp) return;
    place();
    raf = requestAnimationFrame(loop);
  }
  function setPins(list) {
    build();
    layer.innerHTML = "";
    pins = [];
    if (temp) layer.appendChild(temp);
    (list || []).forEach(function (p) {
      if (!p.anchor) return;
      var node = document.createElement("div");
      node.className = "pin" + (p.done ? " done" : p.old ? " old" : "");
      node.textContent = p.done ? "✓" : String(p.n);
      node.title = p.text || "";
      node.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        post({ type: "pin-click", id: p.id });
      });
      layer.appendChild(node);
      pins.push({ id: p.id, anchor: p.anchor, node: node, el: null });
    });
    place();
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function focusPin(id) {
    for (var i = 0; i < pins.length; i++) {
      var p = pins[i];
      p.node.classList.toggle("focus", p.id === id);
      if (p.id === id) {
        var el = p.el || resolve(p.anchor);
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "center" });
        else window.scrollTo({ top: Math.max(0, p.anchor.py - window.innerHeight / 2), behavior: "smooth" });
      }
    }
  }

  /* ---------------- a picture of what the client saw ---------------- */
  var libP = null;
  function lib() {
    if (window.modernScreenshot) return Promise.resolve(window.modernScreenshot);
    if (libP) return libP;
    libP = new Promise(function (ok, bad) {
      var s = document.createElement("script");
      // the library is UMD: hide an AMD loader (some WordPress themes have one) so it lands on window
      var d = window.define;
      window.define = undefined;
      s.src = ORIGIN + "/feedback-shot.js";
      s.async = true;
      s.onload = function () {
        window.define = d;
        window.modernScreenshot ? ok(window.modernScreenshot) : bad(new Error("no lib"));
      };
      s.onerror = function () {
        window.define = d;
        bad(new Error("load"));
      };
      document.head.appendChild(s);
    });
    return libP;
  }
  /** the block the click is in: a section-sized ancestor, so the picture has context */
  function frameOf(el) {
    var vh = window.innerHeight;
    var n = el;
    var best = el;
    while (n && n !== document.body && n !== document.documentElement) {
      var r = n.getBoundingClientRect();
      if (r.height > vh * 1.6 || r.width > window.innerWidth * 1.05) break;
      best = n;
      if (r.height >= Math.min(260, vh * 0.4) && r.width >= window.innerWidth * 0.6) break;
      n = n.parentElement;
    }
    return best;
  }
  function bg() {
    var c = getComputedStyle(document.body).backgroundColor;
    if (!c || c === "transparent" || c === "rgba(0, 0, 0, 0)") c = getComputedStyle(document.documentElement).backgroundColor;
    return !c || c === "transparent" || c === "rgba(0, 0, 0, 0)" ? "#ffffff" : c;
  }
  function snap(el, x, y, pickId) {
    var box = frameOf(el);
    var r = box.getBoundingClientRect();
    var cx = x - r.left;
    var cy = y - r.top;
    var scale = Math.min(2, Math.max(0.5, 1100 / Math.max(1, r.width)));
    lib()
      .then(function (ms) {
        return ms.domToCanvas(box, {
          scale: scale,
          backgroundColor: bg(),
          filter: function (n) {
            return !(n && n.tagName === "FOCUS-FEEDBACK");
          },
          timeout: 8000,
          fetch: { requestInit: { mode: "cors" } },
        });
      })
      .then(function (cv) {
        var k = cv.width / Math.max(1, r.width);
        var g = cv.getContext("2d");
        var px = cx * k;
        var py = cy * k;
        var rad = 16 * Math.max(1, k * 0.8);
        // a ring, so what's under the click stays readable
        g.beginPath();
        g.arc(px, py, rad * 1.6, 0, Math.PI * 2);
        g.lineWidth = Math.max(5, rad / 2.2);
        g.strokeStyle = "rgba(255,255,255,.85)";
        g.stroke();
        g.lineWidth = Math.max(3, rad / 3.5);
        g.strokeStyle = "#e5484d";
        g.stroke();
        // keep a readable window around the click (a tall hero would come out as a thin strip)
        var maxH = Math.round(cv.width * (r.width < 600 ? 1.15 : 0.62));
        if (cv.height > maxH) {
          var top = Math.max(0, Math.min(cv.height - maxH, Math.round(py - maxH / 2)));
          var out = document.createElement("canvas");
          out.width = cv.width;
          out.height = maxH;
          out.getContext("2d").drawImage(cv, 0, top, cv.width, maxH, 0, 0, cv.width, maxH);
          cv = out;
        }
        post({ type: "shot", pickId: pickId, data: cv.toDataURL("image/jpeg", 0.82) });
      })
      .catch(function () {
        post({ type: "shot", pickId: pickId, data: null });
      });
  }

  /* ---------------- talk to the review page ---------------- */
  function setCommenting(on) {
    commenting = !!on;
    build();
    if (!commenting) {
      hideHover();
      if (temp) {
        temp.remove();
        temp = null;
      }
    }
    var st = document.getElementById("focus-fb-cursor");
    if (commenting && !st) {
      st = document.createElement("style");
      st.id = "focus-fb-cursor";
      st.textContent = "html,body,body *{cursor:crosshair!important}";
      (document.head || document.documentElement).appendChild(st);
    } else if (!commenting && st) st.remove();
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN || e.source !== parentWin) return;
    var m = e.data;
    if (!m || m.src !== SRC) return;
    if (m.type === "hello") {
      active = true;
      build();
      announce("ready");
    } else if (!active) {
      return;
    } else if (m.type === "mode") setCommenting(m.on);
    else if (m.type === "pins") {
      if (m.clearTemp && temp) {
        temp.remove();
        temp = null;
      }
      setPins(m.pins);
    } else if (m.type === "focus") focusPin(m.id);
    else if (m.type === "scroll") window.scrollBy({ top: m.dy || 0, behavior: "smooth" });
  });

  // capture phase, so the site's own handlers don't run while the client is marking
  document.addEventListener("click", onClick, true);
  ["mousedown", "mouseup", "pointerup", "dblclick", "auxclick", "submit"].forEach(function (t) {
    document.addEventListener(t, swallow, true);
  });
  // menus that open on pointerdown (Radix etc.) — stop them, but keep touch scrolling
  document.addEventListener(
    "pointerdown",
    function (e) {
      if (commenting && !ours(e.target)) e.stopPropagation();
    },
    true,
  );
  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("mouseleave", hideHover, true);
  window.addEventListener("scroll", hideHover, true);

  // tell the review page we're here (it says hello back)
  function here() {
    post({ type: "here", path: pagePath() });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", here);
  else here();
})();
