import { edgeFor, envelopeAt, slot, soundingSlot } from "./score.js";

/** Every visual position is derived from the same clock as the scheduled notes. */
export function createPlayer({
  onFrame,
  onStatus,
  onProgress = () => {},
  context = () => new (window.AudioContext || window.webkitAudioContext)(),
  now = () => performance.now() / 1000,
  frame = callback => requestAnimationFrame(callback),
  cancel = id => cancelAnimationFrame(id),
}) {
  let events = [], cursor = 0, origin = 0, fpsId = 0, generation = 0;
  let state = "ready", mode = "silent", speed = 1, volume = 0.65, muted = false, stereo = true;
  let audio, output, nodes = [], animated;
  let resumedAt = 0;
  const clock = () => audio && mode === "audio" ? audio.currentTime : now();
  const length = () => events.length * slot;
  const position = () => Math.min(length(), state === "playing" ? Math.max(0, (clock() - origin) * speed) : cursor);

  function mark(status) {
    state = status;
    onStatus(state, mode);
  }

  function draw(force) {
    const cursor = position();
    const index = Math.min(events.length - 1, Math.floor((cursor + 1e-9) / slot));
    if (index < 0) return;
    const event = events[index];
    if (force || animated !== event) {
      animated = event;
      onFrame(event);
    }
    const begin = Math.max(resumedAt, index * slot);
    const duration = (index * slot + soundingSlot - begin) / speed;
    const amplitude = state === "playing" ? envelopeAt((cursor - begin) / speed, duration) : 0;
    onProgress(event, amplitude);
  }

  function release() {
    if (fpsId) cancel(fpsId);
    fpsId = 0;
    for (const { notes, envelope } of nodes) {
      const end = audio.currentTime + 0.02;
      if (typeof envelope.gain.cancelAndHoldAtTime === "function") envelope.gain.cancelAndHoldAtTime(audio.currentTime);
      else envelope.gain.cancelScheduledValues(audio.currentTime);
      envelope.gain.setTargetAtTime(0, audio.currentTime, 0.004);
      for (const note of notes) {
        try { note.stop(end); } catch {}
      }
    }
    nodes = [];
  }

  function schedule(signal, start, end) {
    if (!signal.gain || end - start < 0.03) return;
    const envelope = audio.createGain();
    let pan;
    if (typeof audio.createStereoPanner === "function") {
      pan = audio.createStereoPanner();
      pan.pan.value = stereo ? signal.pan : 0;
      envelope.connect(pan);
      pan.connect(output);
    } else envelope.connect(output);
    const edge = edgeFor(end - start);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(signal.gain, start + edge);
    envelope.gain.linearRampToValueAtTime(signal.gain * 0.8, end - edge);
    envelope.gain.linearRampToValueAtTime(0, end);
    const notes = [], mixing = [];
    for (const [harmonic, gain] of [[1, 1 - signal.overtone], [2, signal.overtone]]) {
      const note = audio.createOscillator();
      const level = audio.createGain();
      note.frequency.value = signal.hz * harmonic;
      level.gain.value = gain;
      note.connect(level);
      level.connect(envelope);
      notes.push(note);
      mixing.push(level);
    }
    const voices = { notes, envelope, pan, position: signal.pan };
    nodes.push(voices);
    notes.at(-1).onended = () => {
      for (const node of [...notes, ...mixing, envelope]) node.disconnect();
      pan?.disconnect();
      nodes = nodes.filter(existing => existing !== voices);
    };
    for (const note of notes) {
      note.start(start);
      note.stop(end + 0.014);
    }
  }

  function tick() {
    fpsId = 0;
    draw(false);
    if (position() >= length()) {
      cursor = length();
      mark("complete");
      return;
    }
    fpsId = frame(tick);
  }

  function pause() {
    cursor = position();
    generation++;
    release();
    mark("paused");
    draw(false);
  }

  async function play(request = "audio") {
    if (!events.length || state === "starting" || state === "playing") return;
    const requestGeneration = ++generation;
    if (cursor >= length()) cursor = 0;
    mode = request;
    mark("starting");
    if (mode === "audio") {
      try {
        if (!audio) {
          audio = context();
          output = audio.createGain();
          output.gain.value = muted ? 0 : volume;
          output.connect(audio.destination);
        }
        if (audio.state !== "running") await audio.resume();
        if (audio.state !== "running") throw new Error("Audio output did not start.");
      } catch {
        if (requestGeneration !== generation) return;
        mode = "fallback";
      }
    }
    if (requestGeneration !== generation) return;
    const start = clock() + (mode === "audio" ? 0.04 : 0);
    resumedAt = cursor;
    origin = start - cursor / speed;
    if (mode === "audio") {
      for (const [index, event] of events.entries()) {
        const begin = index * slot;
        const end = begin + soundingSlot;
        if (end <= cursor) continue;
        for (const signal of Object.values(event.signals)) {
          schedule(signal, start + (Math.max(cursor, begin) - cursor) / speed, start + (end - cursor) / speed);
        }
      }
    }
    mark("playing");
    draw(true);
    fpsId = frame(tick);
  }

  const level = () => output?.gain.setTargetAtTime(muted ? 0 : volume, audio.currentTime, 0.02);
  return {
    pause, play,
    load(next, index = 0) {
      generation++;
      release();
      events = next;
      cursor = index * slot;
      mark("ready");
      draw(true);
    },
    seek(index) {
      pause();
      cursor = Math.max(0, Math.min(events.length - 1, index)) * slot;
      draw(true);
    },
    setVolume(value) { volume = value; level(); },
    setMuted(value) { muted = value; level(); },
    setStereo(value) {
      stereo = value;
      for (const node of nodes) node.pan?.pan.setTargetAtTime(stereo ? node.position : 0, audio.currentTime, 0.02);
    },
    setSpeed(value) {
      if (speed === value) return;
      const playback = state === "playing" || state === "starting";
      if (playback) pause();
      speed = value;
      if (playback) play(mode);
    },
  };
}
