import {
  createWaitlistCoordinator,
  postWaitlist,
} from "./waitlist-controller.js";

/** @param {HTMLFormElement} form */
function formView(form) {
  const email = form.querySelector("[data-waitlist-email]");
  const mailingList = form.querySelector("[data-waitlist-list]");
  const fields = form.querySelector("[data-waitlist-fields]");
  const details = form.querySelector("[data-waitlist-details]");
  const button = form.querySelector("[data-waitlist-submit]");
  const status = form.querySelector("[data-waitlist-status]");
  if (
    !(email instanceof HTMLInputElement) ||
    !(mailingList instanceof HTMLInputElement) ||
    !(fields instanceof HTMLElement) ||
    !(details instanceof HTMLElement) ||
    !(button instanceof HTMLButtonElement) ||
    !(status instanceof HTMLElement)
  ) {
    return null;
  }

  const idleButtonText = button.textContent ?? "Join the waitlist";
  return {
    form,
    readSubmission: () => ({
      endpoint: form.action,
      email: email.value,
      mailingListId: mailingList.value,
    }),
    /** @param {boolean} submitting */
    setSubmitting(submitting) {
      form.setAttribute("aria-busy", String(submitting));
      button.disabled = submitting;
      button.textContent = submitting ? "Joining…" : idleButtonText;
    },
    /** @param {string} message */
    showSuccess(message) {
      form.dataset.state = "success";
      fields.hidden = true;
      details.hidden = true;
      status.className = "waitlist-status success";
      status.textContent = message;
    },
    /** @param {string} message */
    showError(message) {
      form.dataset.state = "error";
      status.className = "waitlist-status error";
      status.textContent = message;
    },
    clearStatus() {
      if (form.dataset.state === "success") return;
      delete form.dataset.state;
      status.className = "waitlist-status";
      status.textContent = "";
    },
    focusStatus() {
      status.focus();
    },
  };
}

const views = [...document.querySelectorAll("[data-waitlist-form]")]
  .filter((form) => form instanceof HTMLFormElement)
  .map((form) => formView(form))
  .filter((view) => view !== null);

if (views.length > 0) {
  const coordinator = createWaitlistCoordinator({
    views,
    submitRequest: (submission) =>
      postWaitlist({
        ...submission,
        request: (input, init) => fetch(input, init),
        createAbortController: () => new AbortController(),
        setTimer: (callback, delay) => setTimeout(callback, delay),
        clearTimer: (timer) => clearTimeout(/** @type {number} */ (timer)),
      }),
  });

  for (const view of views) {
    view.form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!view.form.reportValidity()) return;
      void coordinator.submit(view);
    });
  }
}
