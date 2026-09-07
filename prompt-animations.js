/** Refresh recommendations while keeping the unchanged analysis text in place. */
import { getAnimations } from "./animations.js";

const PROMPT_PARTS = ".match, .prompt-emoji, h3, p";
const EASE_OUT = "cubic-bezier(0.4, 0, 0.2, 1)";
const EASE_SPRING = "cubic-bezier(0.22, 1, 0.36, 1)";

export async function animatePromptRefresh(updateContent) {
  const cfg = getAnimations().promptRefresh || {};
  const cards = [...document.querySelectorAll(".prompt-slot")];
  const refreshBtn = document.getElementById("prompt-refresh-btn");
  const animations = [];
  const savedHeights = cards.map(card => card.style.minHeight);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const animateParts = (keyframes, entering) => Promise.all(cards.flatMap((card, cardIndex) =>
    [...card.querySelectorAll(PROMPT_PARTS)].map((element, partIndex) => {
      const animation = element.animate(keyframes, {
        duration: entering ? (cfg.enterDurationMs ?? 520) : (cfg.exitDurationMs ?? 340),
        delay: entering
          ? cardIndex * (cfg.cardEnterDelayMs ?? 90) + partIndex * (cfg.cardEnterPartStaggerMs ?? 45)
          : cardIndex * (cfg.cardStaggerMs ?? 55) + partIndex * (cfg.partStaggerMs ?? 35),
        easing: entering ? EASE_SPRING : EASE_OUT,
        // Hold the first frame during stagger delays and the final frame until cleanup.
        fill: "both",
      });
      animations.push(animation);
      return animation.finished.catch(() => {});
    })
  ));

  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-refreshing");
  }
  try {
    if (reducedMotion) {
      updateContent();
      return;
    }
    cards.forEach(card => {
      card.style.minHeight = `${card.getBoundingClientRect().height}px`;
      card.classList.add("prompt-animating");
    });
    await animateParts([
      { opacity: 1, filter: "blur(0px)", transform: "translateY(0) scale(1)" },
      { opacity: 0, filter: `blur(${cfg.blurExitPx ?? 10}px)`, transform: `translateY(-${cfg.translateExitPx ?? 14}px) scale(0.97)` },
    ], false);

    updateContent();

    await animateParts([
      { opacity: 0, filter: `blur(${cfg.blurEnterPx ?? 10}px)`, transform: `translateY(${cfg.translateEnterPx ?? 18}px) scale(0.98)` },
      { opacity: 0.55, filter: `blur(${cfg.blurEnterMidPx ?? 4}px)`, transform: "translateY(6px) scale(0.99)" },
      { opacity: 1, filter: "blur(0px)", transform: "translateY(0) scale(1)" },
    ], true);
  } finally {
    // Release only animations owned by this refresh, including on a rendering failure.
    animations.forEach(animation => animation.cancel());
    cards.forEach((card, index) => {
      card.style.minHeight = savedHeights[index];
      card.classList.remove("prompt-animating");
    });
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("is-refreshing");
    }
  }
}
