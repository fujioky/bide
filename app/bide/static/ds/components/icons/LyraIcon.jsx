import React from "react";

/* Thin wrapper over the Lucide UMD build (loaded from CDN by the host page).
   Lyra ships no icon binaries of its own; Lucide's 1.75px stroke matches the
   hairline feel of the shell. Falls back to nothing if the CDN is absent. */
export function LyraIcon({ name, size = 16, strokeWidth = 1.75, color = "currentColor", style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = "";
    const i = document.createElement("i");
    i.setAttribute("data-lucide", name);
    i.setAttribute("width", size); i.setAttribute("height", size);
    i.setAttribute("stroke-width", strokeWidth); i.setAttribute("stroke", color);
    host.appendChild(i);
    if (window.lucide) window.lucide.createIcons({ nameAttr: "data-lucide" });
  }, [name, size, strokeWidth, color]);
  return <span ref={ref} aria-hidden="true" style={{ display: "inline-flex", width: size, height: size, flex: "0 0 auto", ...style }} />;
}
