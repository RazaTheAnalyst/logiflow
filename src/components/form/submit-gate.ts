"use client";

import { useRef, type FormEvent, type KeyboardEvent } from "react";

/**
 * Blocks implicit form submission (Enter in a text control) so a document or
 * settings form can never save before the user clicked the submit button.
 *
 * Two layers, because the keydown layer alone has gaps: native <select>
 * controls are not inputs, and a child can stopPropagation before React's
 * delegated keydown ever reaches the form.
 *
 * 1. `onKeyDown` — refuses Enter in inputs/selects (textareas keep newlines,
 *    IME composition is ignored, buttons are untouched so keyboard users can
 *    still activate Save).
 * 2. `arm()` + `onSubmitCapture` — the form only submits when a real click on
 *    the submit button happened first. Implicit submission fires `submit`
 *    without a click, so it is always rejected. Keyboard activation of the
 *    focused button (Enter/Space) synthesises `click` before `submit`, so it
 *    passes. (`event.submitter` cannot be used: browsers set it to the
 *    default button on implicit submission too.)
 *
 * For `<form onSubmit>` forms call `consume()` inside the handler instead of
 * relying on `preventDefault`, because React runs `onSubmit` regardless.
 */
export function useSubmitGate() {
  const armed = useRef(false);

  const arm = () => {
    armed.current = true;
  };

  const consume = () => {
    const ok = armed.current;
    armed.current = false;
    return ok;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement
    ) {
      event.preventDefault();
    }
  };

  const onSubmitCapture = (event: FormEvent<HTMLFormElement>) => {
    const ok = armed.current;
    armed.current = false;
    if (!ok && !event.defaultPrevented) {
      event.preventDefault();
    }
  };

  return { arm, consume, onKeyDown, onSubmitCapture };
}
