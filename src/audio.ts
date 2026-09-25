/** Original procedural pentatonic ambience and feedback. No remote audio required. */
export class Sound {
  enabled = false;
  private context: AudioContext | null = null;
  private ambience: number | undefined;
  private step = 0;
  private lastHit = 0;
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      void this.context.resume();
      this.ambience = window.setInterval(() => this.note(), 2400);
      this.note();
    } else {
      clearInterval(this.ambience);
      void this.context?.suspend();
    }
    return this.enabled;
  }
  private tone(
    freq: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
  ) {
    if (!this.enabled || !this.context || document.hidden) return;
    const ctx = this.context,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + duration);
  }
  private note() {
    const notes = [261.63, 293.66, 329.63, 392, 440, 392, 329.63, 293.66];
    this.tone(notes[this.step++ % notes.length] / 2, 2.3, 0.025);
    this.tone(notes[this.step % notes.length], 1.8, 0.012);
  }
  play(type: string) {
    if (type === "hit") {
      if (performance.now() - this.lastHit < 130) return;
      this.lastHit = performance.now();
      this.tone(180, 0.07, 0.015, "triangle");
    } else if (type === "skill") {
      this.tone(523.25, 0.5, 0.028);
      this.tone(783.99, 0.6, 0.016);
    } else if (type === "win") {
      [261.63, 329.63, 392, 523.25].forEach((f, i) =>
        setTimeout(() => this.tone(f, 0.6, 0.04), i * 100),
      );
    } else this.tone(type === "buy" ? 440 : 330, 0.15, 0.025);
  }
}
