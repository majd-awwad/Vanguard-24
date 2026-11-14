import { makePlan, bandEvidence, tone } from "../../audio/gedi-plan.js";

export function createSession(data, transport) {
  const listeners = new Set();
  const shotAt = (id) => data.footprints.find((row) => row.id === id);
  let selection = { axis: "horizontal", shotId: data.guide.low, bandM: data.guide.band };
  let plan = makePlan(data, selection);
  let inspected = null;
  let revealed = false;
  let exploration = false;
  let transportState;

  function snapshot() {
    const event = plan.events.find((item) => item.id === transportState.activeEventId) ?? plan.events[0];
    const observation = shotAt(event.evidence.observationId);
    const inTrackGap = plan.axis === "horizontal" && transportState.status === "playing"
      && event !== plan.events.at(-1) && transportState.positionS >= event.onsetS + tone.durationS;
    return { selection, plan, transport: transportState, event, observation, inspected, revealed, exploration, inTrackGap };
  }

  function emit() {
    const state = snapshot();
    for (const listener of listeners) listener(state);
  }

  transport.subscribe((state) => {
    transportState = state;
    emit();
  });
  transport.load(plan, plan.events.find((event) => event.evidence.observationId === selection.shotId).onsetS);

  function select(next, positionFor = () => 0) {
    selection = next;
    plan = makePlan(data, next);
    transport.load(plan, positionFor(plan));
  }

  const startOfShot = (id) => (next) =>
    next.events.find((event) => event.evidence.observationId === id)?.onsetS ?? 0;

  function dispatch(intent) {
    const current = snapshot();
    const preview = () => intent.preview ? transport.play(current.transport.playback, tone.durationS) : undefined;
    switch (intent.type) {
      case "axis": {
        if (selection.axis === intent.axis) return;
        const shotId = current.observation.id;
        select({ ...selection, axis: intent.axis, shotId }, startOfShot(shotId));
        return;
      }
      case "footprint": {
        if (!shotAt(intent.shotId)) return;
        if (selection.axis === "vertical") {
          select({ ...selection, shotId: intent.shotId });
        } else {
          transport.seek(startOfShot(intent.shotId)(plan));
        }
        return preview();
      }
      case "band":
        if (selection.axis !== "horizontal") return;
        select({ ...selection, bandM: intent.band, shotId: current.observation.id }, startOfShot(current.observation.id));
        return preview();
      case "height":
        if (selection.axis === "vertical" && plan.events[intent.index]) {
          transport.seek(plan.events[intent.index].onsetS);
          return preview();
        }
        return;
      case "compare": {
        if (![data.guide.low, data.guide.high].includes(intent.shotId)) return;
        select({ axis: "horizontal", shotId: intent.shotId, bandM: data.guide.band }, startOfShot(intent.shotId));
        return preview();
      }
      case "step": {
        const index = plan.events.indexOf(current.event);
        const next = Math.max(0, Math.min(plan.events.length - 1, index + intent.direction));
        transport.seek(plan.events[next].onsetS);
        return preview();
      }
      case "inspect": {
        const event = intent.shotId === undefined ? current.event : comparison.find(
          (entry) => entry.observation.id === intent.shotId,
        );
        if (!event) return;
        transport.pause();
        inspected = { ...event.evidence, observation: shotAt(event.evidence.observationId) };
        emit();
        return;
      }
      case "guide-vertical":
        if (intent.restart) {
          revealed = false;
          exploration = false;
        }
        select({ axis: "vertical", shotId: data.guide.high, bandM: data.guide.band });
        if (intent.prepare) return;
        return transport.play(intent.mode ?? current.transport.playback);
      case "reveal":
        revealed = true;
        emit();
        return;
      case "explore":
        exploration = true;
        emit();
        return;
      case "play":
        if (intent.fromStart) return transport.replay(intent.mode);
        return transport.play(intent.mode);
      case "pause": return transport.pause();
      case "replay": return transport.replay(intent.mode);
      case "speed": return transport.setSpeed(intent.value);
      case "volume": return transport.setVolume(intent.value);
      case "mute": return transport.setMuted(intent.value);
    }
  }

  const comparison = [data.guide.low, data.guide.high].map((id) => {
    const observation = shotAt(id);
    return { observation, evidence: bandEvidence(data, observation, data.guide.band) };
  });

  return {
    data, snapshot, dispatch, comparison,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
  };
}
