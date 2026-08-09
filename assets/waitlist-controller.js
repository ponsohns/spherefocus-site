export const WAITLIST_MESSAGES = Object.freeze({
  success: "You're on the list. We'll email you when Sphere is ready.",
  rateLimited: "Too many attempts. Please wait a minute and try again.",
  unconfirmed:
    "We couldn't confirm your signup. You may already be on the list. Wait a moment, then try again.",
  error: "We couldn't add you right now. Please try again.",
});

/**
 * @typedef {Object} Submission
 * @property {string} endpoint
 * @property {string} email
 * @property {string} mailingListId
 *
 * @typedef {Object} WaitlistView
 * @property {() => Submission} readSubmission
 * @property {(submitting: boolean) => void} setSubmitting
 * @property {(message: string) => void} showSuccess
 * @property {(message: string) => void} showError
 * @property {() => void} clearStatus
 * @property {() => void} focusStatus
 *
 * @typedef {Object} WaitlistResult
 * @property {"success" | "rate-limited" | "unconfirmed" | "error"} kind
 */

/**
 * Submit one email/list pair to the public Loops form endpoint.
 * Every effect is injected so the contract stays testable without a browser.
 *
 * @param {Object} options
 * @param {string} options.endpoint
 * @param {string} options.email
 * @param {string} options.mailingListId
 * @param {(input: string, init: RequestInit) => Promise<Response>} options.request
 * @param {() => AbortController} options.createAbortController
 * @param {(callback: () => void, delay: number) => unknown} options.setTimer
 * @param {(timer: unknown) => void} options.clearTimer
 * @param {number} [options.timeoutMs]
 * @returns {Promise<WaitlistResult>}
 */
export async function postWaitlist({
  endpoint,
  email,
  mailingListId,
  request,
  createAbortController,
  setTimer,
  clearTimer,
  timeoutMs = 10_000,
}) {
  const abortController = createAbortController();
  const timer = setTimer(() => abortController.abort(), timeoutMs);

  try {
    const body = new URLSearchParams({
      email,
      mailingLists: mailingListId,
    }).toString();
    const response = await request(endpoint, {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: abortController.signal,
    });

    if (response.status === 429) return { kind: "rate-limited" };
    if (response.status !== 200) return { kind: "error" };

    try {
      const payload = await response.json();
      return payload && payload.success === true
        ? { kind: "success" }
        : { kind: "error" };
    } catch {
      return { kind: "error" };
    }
  } catch {
    return { kind: "unconfirmed" };
  } finally {
    clearTimer(timer);
  }
}

/**
 * Coordinate the two visible form placements as one waitlist interaction.
 *
 * @param {Object} options
 * @param {WaitlistView[]} options.views
 * @param {(submission: Submission) => Promise<WaitlistResult>} options.submitRequest
 */
export function createWaitlistCoordinator({ views, submitRequest }) {
  let inFlight = false;

  return Object.freeze({
    /** @param {WaitlistView} sourceView */
    async submit(sourceView) {
      if (inFlight) return false;
      inFlight = true;
      for (const view of views) {
        view.clearStatus();
        view.setSubmitting(true);
      }

      /** @type {WaitlistResult} */
      let result;
      try {
        result = await submitRequest(sourceView.readSubmission());
      } catch {
        result = { kind: "unconfirmed" };
      }

      for (const view of views) view.setSubmitting(false);
      inFlight = false;

      if (result.kind === "success") {
        for (const view of views) {
          view.showSuccess(WAITLIST_MESSAGES.success);
        }
        return true;
      }

      const message =
        result.kind === "rate-limited"
          ? WAITLIST_MESSAGES.rateLimited
          : result.kind === "unconfirmed"
            ? WAITLIST_MESSAGES.unconfirmed
            : WAITLIST_MESSAGES.error;
      sourceView.showError(message);
      sourceView.focusStatus();
      return true;
    },
  });
}
