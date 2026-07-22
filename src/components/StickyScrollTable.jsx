import { useEffect, useRef } from 'react';

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  cssInjected = true;
  const s = document.createElement('style');
  s.textContent = '.sst-wrap{overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}.sst-wrap::-webkit-scrollbar{display:none}';
  document.head.appendChild(s);
}

export default function StickyScrollTable({ children, deps = [] }) {
  const wrapperRef = useRef(null);
  const mirrorRef = useRef(null);
  const spacerRef = useRef(null);
  const syncing = useRef(false);

  useEffect(() => { injectCSS(); }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const mirror = mirrorRef.current;
    const spacer = spacerRef.current;
    if (!wrapper || !mirror || !spacer) return;

    let alive = true;

    function update() {
      if (!alive) return;
      const table = wrapper.querySelector('table');
      const contentW = table ? table.scrollWidth : wrapper.scrollWidth;
      const clientW = wrapper.clientWidth;
      spacer.style.width = contentW + 'px';

      const rect = wrapper.getBoundingClientRect();
      const vh = window.innerHeight;
      const inView = rect.top < vh && rect.bottom > 0;
      const hasOverflow = contentW > clientW + 2;

      if (inView && hasOverflow) {
        mirror.style.display = 'block';
        mirror.style.left = rect.left + 'px';
        mirror.style.width = clientW + 'px';
      } else {
        mirror.style.display = 'none';
      }
    }

    function onWrapper() {
      if (syncing.current) return;
      syncing.current = true;
      mirror.scrollLeft = wrapper.scrollLeft;
      syncing.current = false;
    }

    function onMirror() {
      if (syncing.current) return;
      syncing.current = true;
      wrapper.scrollLeft = mirror.scrollLeft;
      syncing.current = false;
    }

    const ro = new ResizeObserver(update);
    ro.observe(wrapper);

    // capture:true captura scroll de QUALQUER elemento (main, window, etc.)
    document.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update, { passive: true });
    wrapper.addEventListener('scroll', onWrapper, { passive: true });
    mirror.addEventListener('scroll', onMirror, { passive: true });
    update();

    return () => {
      alive = false;
      ro.disconnect();
      document.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
      wrapper.removeEventListener('scroll', onWrapper);
      mirror.removeEventListener('scroll', onMirror);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (
    <>
      <div ref={wrapperRef} className="sst-wrap">
        {children}
      </div>
      <div
        ref={mirrorRef}
        style={{
          position: 'fixed',
          bottom: 0,
          height: 14,
          overflowX: 'auto',
          overflowY: 'hidden',
          zIndex: 50,
          display: 'none',
        }}
      >
        <div ref={spacerRef} style={{ height: 1 }} />
      </div>
    </>
  );
}
