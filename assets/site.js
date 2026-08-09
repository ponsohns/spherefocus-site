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
  // Ink mode: dark dots on a light page, no halo — a printed figure rather
  // than a glowing object. Opted into per canvas; release pages never set it.
  const ink = canvas.dataset.ink ?? "";
  // Drift mode: a rare, slow swell that briefly deforms the sphere — the
  // product's core gesture, hinted. Also opt-in per canvas.
  const driftCycle = canvas.dataset.drift !== undefined;
  // Spin mode: drag to rotate, with a little inertia on release. Opt-in per
  // canvas; release pages keep their non-interactive spheres.
  const spinnable = canvas.dataset.spin !== undefined;
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
  let spinOffset = 0;
  let spinVelocity = 0;
  let dragging = false;
  let lastDragX = 0;
  let lastDragTime = 0;

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
    if (!dragging && spinVelocity !== 0) {
      spinOffset += spinVelocity;
      spinVelocity *= 0.96;
      if (Math.abs(spinVelocity) < 0.00002) spinVelocity = 0;
    }
    const rotation = reducedMotion ? 0.52 : now * 0.000055;
    const tilt = -0.2 + pointerY * 0.08;
    const turn = rotation + spinOffset + pointerX * 0.12;
    const cosTurn = Math.cos(turn);
    const sinTurn = Math.sin(turn);
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);

    if (!ink) {
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
    }

    let sway = 0;
    if (driftCycle && !reducedMotion) {
      const wave = Math.sin(now * 0.00024);
      sway = wave > 0 ? Math.pow(wave, 6) : 0;
    }

    for (const point of points) {
      const x1 = point.x * cosTurn + point.z * sinTurn;
      const z1 = -point.x * sinTurn + point.z * cosTurn;
      const y2 = point.y * cosTilt - z1 * sinTilt;
      const z2 = point.y * sinTilt + z1 * cosTilt;
      const depth = (z2 + 1) / 2;
      const breathing = reducedMotion
        ? 1
        : 1 + Math.sin(now * 0.0007 + point.y * 2.4) * 0.006;
      let px = centerX + x1 * sphereRadius * breathing;
      let py = centerY + y2 * sphereRadius * breathing;
      if (sway > 0) {
        px +=
          Math.sin(point.y * 5.3 + now * 0.0011) * sway * sphereRadius * 0.05;
        py +=
          Math.sin(point.x * 4.1 + point.z * 3.7 + now * 0.0009) *
          sway *
          sphereRadius *
          0.04;
      }
      const dotSize = (0.35 + Math.pow(depth, 1.65) * 1.25) * dpr;
      const keyLight = Math.max(0.15, 0.58 + x1 * -0.18 + y2 * -0.24);
      const alpha = ink
        ? Math.min(0.95, 0.1 + Math.pow(depth, 1.75) * 0.85)
        : Math.min(0.95, (0.05 + Math.pow(depth, 2) * 0.88) * keyLight);
      drawing.globalAlpha = alpha;
      drawing.fillStyle = ink || (depth > 0.72 ? "#f2f6fc" : "#b9c9dd");
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

  if (spinnable) {
    canvas.addEventListener("pointerdown", (event) => {
      dragging = true;
      spinVelocity = 0;
      lastDragX = event.clientX;
      lastDragTime = event.timeStamp;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // A pointer that vanished between the event and the capture still
        // spins; it just loses tracking outside the canvas.
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const deltaX = event.clientX - lastDragX;
      const elapsed = Math.max(1, event.timeStamp - lastDragTime);
      const step = deltaX * 0.005;
      spinOffset += step;
      spinVelocity = step / (elapsed / 16.7);
      lastDragX = event.clientX;
      lastDragTime = event.timeStamp;
      // Without the animation loop, direct manipulation still redraws.
      if (reducedMotion) draw(0);
    });
    /** @param {PointerEvent} event */
    const release = (event) => {
      if (!dragging) return;
      dragging = false;
      try {
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Releasing a vanished pointer is a no-op.
      }
      if (reducedMotion) spinVelocity = 0;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
  }

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
