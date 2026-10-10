(() => {
  "use strict";

  // Hosts that only ever serve uploaded attachments; links there always point at the image itself.
  const ATTACHMENT_URL = /^https:\/\/(github\.com\/user-attachments\/assets\/|(private-)?user-images\.githubusercontent\.com\/)/;

  let overlay = null;
  let returnFocus = null;
  let previousOverflow = "";

  const withoutQuery = (url) => {
    try {
      const u = new URL(url, location.href);
      return u.origin + u.pathname;
    } catch {
      return null;
    }
  };

  // GitHub wraps every Markdown image in a link to the image itself (target=_blank).
  // Only those auto-links are intercepted; images deliberately linked elsewhere (badges etc.) keep working.
  function findImageLink(target) {
    const link = target.closest(".markdown-body a[href]");
    const img = link?.querySelector("img");
    if (!img || link.textContent.trim() !== "") return null;

    const sources = [img.currentSrc, img.src, img.getAttribute("data-canonical-src")]
      .filter(Boolean)
      .map(withoutQuery);
    const pointsAtImage = sources.includes(withoutQuery(link.href)) || ATTACHMENT_URL.test(link.href);
    return pointsAtImage ? { link, img } : null;
  }

  function onClick(event) {
    // Keep native behaviour for Ctrl/Cmd/Shift/Alt-click so "open in new tab" stays available.
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const match = findImageLink(event.target);
    if (!match) return;
    event.preventDefault();
    event.stopPropagation();
    open(match.img, match.link);
  }

  function button(label, title) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "ghil-button";
    el.textContent = label;
    el.title = title;
    el.setAttribute("aria-label", title);
    return el;
  }

  function open(img, link) {
    if (overlay) close();
    returnFocus = document.activeElement;

    overlay = document.createElement("div");
    overlay.className = "ghil-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", img.alt || "Image viewer");

    const view = document.createElement("img");
    view.className = "ghil-image";
    view.src = img.currentSrc || img.src;
    view.alt = img.alt;
    view.addEventListener("click", () => {
      const zoomable = view.naturalWidth > view.clientWidth || view.naturalHeight > view.clientHeight;
      if (zoomable || view.classList.contains("ghil-zoomed")) view.classList.toggle("ghil-zoomed");
    });

    const toolbar = document.createElement("div");
    toolbar.className = "ghil-toolbar";
    const original = document.createElement("a");
    original.className = "ghil-button";
    original.href = link.href;
    original.target = "_blank";
    original.rel = "noopener noreferrer";
    original.textContent = "↗";
    original.title = "Open original in new tab";
    original.setAttribute("aria-label", original.title);
    const closeButton = button("✕", "Close (Esc)");
    closeButton.addEventListener("click", close);
    toolbar.append(original, closeButton);

    overlay.append(view, toolbar);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.append(overlay);
    document.addEventListener("keydown", onKeydown, true);
    closeButton.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.documentElement.style.overflow = previousOverflow;
    document.removeEventListener("keydown", onKeydown, true);
    returnFocus?.focus?.();
    returnFocus = null;
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      // Keep focus inside the dialog.
      const focusable = [...overlay.querySelectorAll(".ghil-button")];
      const index = focusable.indexOf(document.activeElement);
      const next = (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      event.preventDefault();
      focusable[next].focus();
    }
  }

  document.addEventListener("click", onClick, true);
  window.addEventListener("popstate", close);
})();
