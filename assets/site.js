const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const toggle = document.querySelector(".nav-toggle");
const navigation = document.querySelector(".primary-nav");

if (toggle instanceof HTMLButtonElement && navigation instanceof HTMLElement) {
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    navigation.classList.toggle("open", open);
  });

  navigation.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("a")) {
      toggle.setAttribute("aria-expanded", "false");
      navigation.classList.remove("open");
    }
  });
}

/**
 * @typedef {Object} SpherePoint
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @param {HTMLCanvasElement} canvas
 */
function mountSphere(canvas) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const drawing = context;

  const count = Math.max(
    240,
    Number.parseInt(canvas.dataset.dots ?? "900", 10),
  );
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  /** @type {SpherePoint[]} */
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * index;
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    });
  }

  let width = 0;
  let height = 0;
  let dpr = 1;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let visible = true;

  function size() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  /**
   * @param {number} now
   */
  function draw(now) {
    if (!visible) {
      frame = requestAnimationFrame(draw);
      return;
    }

    size();
    drawing.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const sphereRadius = Math.min(width, height) * 0.31;
    const rotation = reducedMotion ? 0.52 : now * 0.000055;
    const tilt = -0.2 + pointerY * 0.08;
    const turn = rotation + pointerX * 0.12;
    const cosTurn = Math.cos(turn);
    const sinTurn = Math.sin(turn);
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);

    const halo = drawing.createRadialGradient(
      centerX,
      centerY,
      sphereRadius * 0.18,
      centerX,
      centerY,
      sphereRadius * 1.7,
    );
    halo.addColorStop(0, "rgba(116,178,240,0.07)");
    halo.addColorStop(0.48, "rgba(116,178,240,0.025)");
    halo.addColorStop(1, "rgba(116,178,240,0)");
    drawing.fillStyle = halo;
    drawing.fillRect(0, 0, width, height);

    for (const point of points) {
      const x1 = point.x * cosTurn + point.z * sinTurn;
      const z1 = -point.x * sinTurn + point.z * cosTurn;
      const y2 = point.y * cosTilt - z1 * sinTilt;
      const z2 = point.y * sinTilt + z1 * cosTilt;
      const depth = (z2 + 1) / 2;
      const breathing = reducedMotion
        ? 1
        : 1 + Math.sin(now * 0.0007 + point.y * 2.4) * 0.006;
      const px = centerX + x1 * sphereRadius * breathing;
      const py = centerY + y2 * sphereRadius * breathing;
      const dotSize = (0.35 + Math.pow(depth, 1.65) * 1.25) * dpr;
      const keyLight = Math.max(0.15, 0.58 + x1 * -0.18 + y2 * -0.24);
      const alpha = Math.min(
        0.95,
        (0.05 + Math.pow(depth, 2) * 0.88) * keyLight,
      );
      drawing.globalAlpha = alpha;
      drawing.fillStyle = depth > 0.72 ? "#f2f6fc" : "#b9c9dd";
      drawing.beginPath();
      drawing.arc(px, py, dotSize, 0, Math.PI * 2);
      drawing.fill();
    }
    drawing.globalAlpha = 1;

    if (!reducedMotion) frame = requestAnimationFrame(draw);
  }

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - 0.5;
    pointerY = (event.clientY - rect.top) / rect.height - 0.5;
  });
  canvas.addEventListener("pointerleave", () => {
    pointerX = 0;
    pointerY = 0;
  });

  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
  });
  observer.observe(canvas);

  const resize = new ResizeObserver(() => {
    size();
    if (reducedMotion) draw(0);
  });
  resize.observe(canvas);

  size();
  if (reducedMotion) draw(0);
  else frame = requestAnimationFrame(draw);

  window.addEventListener(
    "pagehide",
    () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
    },
    { once: true },
  );
}

for (const element of document.querySelectorAll("[data-sphere]")) {
  if (element instanceof HTMLCanvasElement) mountSphere(element);
}
