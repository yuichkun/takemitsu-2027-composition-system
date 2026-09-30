import type { ChannelState } from "../audio/mixer.ts";

/** Linked M/S applies the touched channel's new state; it never changes selection or visibility. */
export function linkedMuteSolo(
  all: string[],
  targets: string[],
  source: ChannelState,
  control: "mute" | "solo",
  exclusive = false,
): [string, Partial<ChannelState>][] {
  if (control === "solo" && exclusive) {
    const own = new Set(targets);
    return all.map((id) => [id, { solo: own.has(id) }]);
  }
  return targets.map((id) => [id, { [control]: !source[control] }]);
}
