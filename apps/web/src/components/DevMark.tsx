import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import badge from '../assets/dev-badge.png';
import badgeFull from '../assets/dev-badge-full.png';

/**
 * The developer's mark: a small badge at the end of the header that, tapped,
 * throws the full badge up over the whole screen for three seconds — the same
 * mark and the same flash as SandHarbor and CountRoster.
 *
 * The two PNGs are imported rather than served from public/, so the build
 * inlines them as data: URIs (vite.config.ts): the single-file page and the
 * Android app's copy of it carry them inside the document, and nothing is
 * fetched to show them.
 */

/** How long the flash stays up. Kept equal to the `dev-flash*` animation
 * durations in styles.css — the CSS fades out on its own clock, this
 * unmounts it. */
export const DEV_FLASH_MS = 3000;

export function DevMark() {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(false), DEV_FLASH_MS);
    // Nobody should be stuck waiting out an animation — Escape ends it early,
    // as does a tap anywhere on the overlay.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFlash(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [flash]);

  return (
    <>
      <button
        type="button"
        className="dev-mark"
        title="Built by CM Hegday · 0x434d"
        aria-label="Show the developer badge"
        onClick={() => setFlash(true)}
      >
        {/* The button carries the label; the image would only repeat it. */}
        <img className="dev-mark__logo" src={badge} alt="" aria-hidden="true" />
      </button>
      {/* Portalled to the body: the header's backdrop-filter makes it a
          containing block, which would trap a fixed overlay in its strip. */}
      {flash &&
        createPortal(
          <div className="dev-flash" role="presentation" onClick={() => setFlash(false)}>
            <div className="dev-flash__lockup">
              <img className="dev-flash__logo" src={badgeFull} alt="Built by CM Hegday — 0x434d" />
              <span className="dev-flash__handle">github.com/chinmay28</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
