// Web Audio API implementation for procedural ambient sound
// Generates:
// 1. Binaural Drone (Deep relaxation/Focus base)
// 2. Breath/Pulse (Pink noise shaped by ADSR envelope linked to BPM)

export class VelvetAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Drone Oscillators
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  // Noise/Breath Nodes
  private noiseBuffer: AudioBuffer | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private breathGain: GainNode | null = null;

  private isPlaying: boolean = false;

  constructor() {
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  private createPinkNoise() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.96652 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11; // (roughly) compensate for gain
      b6 = white * 0.115926;
    }
    return buffer;
  }

  public async start() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    
    this.isPlaying = true;

    // Master Volume
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.ctx.destination);

    // --- 1. DRONE LAYER (Deep Sine) ---
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.1;
    this.droneGain.connect(this.masterGain);

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc1.frequency.value = 55; // A1 (Deep)
    
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.value = 57; // 2Hz difference = Binaural beat
    
    this.osc1.connect(this.droneGain);
    this.osc2.connect(this.droneGain);
    
    this.osc1.start();
    this.osc2.start();

    // --- 2. BREATH LAYER (Pink Noise) ---
    this.noiseBuffer = this.createPinkNoise();
    this.breathGain = this.ctx.createGain();
    this.breathGain.gain.value = 0; // Starts silent, modulated by pulse
    
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 400; // Soft filter
    
    this.breathGain.connect(this.masterGain);
    this.filterNode.connect(this.breathGain);

    this.startNoiseLoop();
  }

  private startNoiseLoop() {
    if (!this.ctx || !this.noiseBuffer || !this.filterNode || !this.isPlaying) return;
    
    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = this.noiseBuffer;
    this.noiseNode.loop = true;
    this.noiseNode.connect(this.filterNode);
    this.noiseNode.start();
  }

  // Called every "beat" of the metronome
  public triggerPulse(intensity: number, duration: number) {
    if (!this.ctx || !this.breathGain || !this.filterNode || !this.droneGain || !this.osc1 || !this.osc2) return;

    const now = this.ctx.currentTime;
    
    // Calculate parameters based on Intensity (0-100)
    const breathVol = 0.2 + (intensity / 100) * 0.4;
    const filterFreq = 200 + (intensity * 8); // Opens up filter as intensity increases
    const droneFreq = 55 + (intensity * 0.5); // Slight pitch rise

    // 1. Modulate Breath (Swell)
    // Attack
    this.breathGain.gain.cancelScheduledValues(now);
    this.breathGain.gain.setValueAtTime(0.05, now);
    this.breathGain.gain.linearRampToValueAtTime(breathVol, now + (duration * 0.4)); // Inhale
    // Decay/Release
    this.breathGain.gain.linearRampToValueAtTime(0.05, now + duration); // Exhale

    // 2. Modulate Filter (Opening)
    this.filterNode.frequency.linearRampToValueAtTime(filterFreq, now + (duration * 0.5));
    this.filterNode.frequency.linearRampToValueAtTime(200, now + duration);

    // 3. Modulate Drone Pitch (Tension)
    this.osc1.frequency.linearRampToValueAtTime(droneFreq, now + duration);
    this.osc2.frequency.linearRampToValueAtTime(droneFreq + (2 + intensity/20), now + duration); // Widen binaural gap
    
    // 4. Drone Volume Swell (Subtle)
    this.droneGain.gain.setValueAtTime(0.1, now);
    this.droneGain.gain.linearRampToValueAtTime(0.1 + (intensity/500), now + (duration/2));
    this.droneGain.gain.linearRampToValueAtTime(0.1, now + duration);
  }

  public stop() {
    this.isPlaying = false;
    this.osc1?.stop();
    this.osc2?.stop();
    this.noiseNode?.stop();
    
    this.osc1?.disconnect();
    this.osc2?.disconnect();
    this.noiseNode?.disconnect();
    this.masterGain?.disconnect();

    this.ctx?.close();
    this.ctx = null;
  }
}