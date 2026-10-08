/* Accesibilidad: navegación por teclado de las fichas y diálogos. */
(() => {
  const overlays = ["garmentSheet", "lookSheet"];
  let returnFocus = null;
  const visible = el => !el.classList.contains("hidden");
  const currentDialog = () => overlays.map(id => document.getElementById(id)).find(el => el && visible(el));
  const focusables = dialog => [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]')].filter(el => el.getClientRects().length);
  document.addEventListener("DOMContentLoaded", () => {
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const overlay = record.target;
        if (!overlays.includes(overlay.id) || record.attributeName !== "class") continue;
        if (visible(overlay)) {
          returnFocus = document.activeElement;
          (focusables(overlay)[0] || overlay.querySelector('[role="dialog"]'))?.focus();
        } else if (!currentDialog() && returnFocus?.isConnected) {
          returnFocus.focus();
          returnFocus = null;
        }
      }
    });
    overlays.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, {attributes:true, attributeFilter:["class"]});
    });
    document.addEventListener("keydown", event => {
      const overlay = currentDialog();
      if (!overlay) return;
      if (event.key === "Escape") {
        event.preventDefault();
        document.getElementById(overlay.id === "garmentSheet" ? "closeGarment" : "closeLook")?.click();
      } else if (event.key === "Tab") {
        const items = focusables(overlay);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    });
  });
})();
