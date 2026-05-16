import { eventBus, gameEvents } from "../../core/eventBus.js";

export function bindUiEventLogging({ bus = eventBus } = {}) {
  return bus.on("*", ({ eventName, payload }) => {
    if (eventName === gameEvents.SECURITY_VIOLATION) {
      console.warn("[ui-event]", eventName, payload);
    }
  });
}
