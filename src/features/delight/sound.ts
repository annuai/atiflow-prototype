let ctx: AudioContext | null = null;

/** A short robot "beep boop": a few square-wave notes. Only ever played after a person's own action (typing a word, clicking the robot), so browsers allow it. */
export function beep(notes: number[] = [660, 880]) {
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    void ctx.resume();
    const start = ctx.currentTime;
    notes.forEach((hz, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'square';
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, start + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.08, start + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.16 + 0.14);
      o.connect(g).connect(ctx!.destination);
      o.start(start + i * 0.16);
      o.stop(start + i * 0.16 + 0.15);
    });
  } catch {
    /* no sound is fine */
  }
}
