export class MotionService {
  private callback: (intensity: number) => void;
  private isActive: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;
  private lastZ: number = 0;
  private speed: number = 0;
  private intensity: number = 0; // 0 to 100

  constructor(onIntensityChange: (val: number) => void) {
    this.callback = onIntensityChange;
  }

  public async requestPermission(): Promise<boolean> {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        return response === 'granted';
      } catch (e) {
        console.error(e);
        return false;
      }
    }
    return true; // Non-iOS devices usually don't need explicit permission prompt if https
  }

  public start() {
    if (this.isActive) return;
    this.isActive = true;
    window.addEventListener('devicemotion', this.handleMotion);
    
    // Decay loop (intensity drops if user stops moving)
    setInterval(() => {
      if (this.intensity > 0) {
        this.intensity = Math.max(0, this.intensity - 5); // Decay speed
        this.callback(this.intensity);
      }
    }, 500);
  }

  public stop() {
    this.isActive = false;
    window.removeEventListener('devicemotion', this.handleMotion);
    this.intensity = 0;
    this.callback(0);
  }

  private handleMotion = (event: DeviceMotionEvent) => {
    if (!event.accelerationIncludingGravity) return;

    const { x, y, z } = event.accelerationIncludingGravity;
    
    // Simple shake/stroke detection algorithm
    // We calculate the delta between frames to detect rapid changes (rhythm)
    const deltaX = Math.abs((x || 0) - this.lastX);
    const deltaY = Math.abs((y || 0) - this.lastY);
    const deltaZ = Math.abs((z || 0) - this.lastZ);

    // Sensitivity threshold
    if (deltaX + deltaY + deltaZ > 3) {
      // Increase intensity based on movement speed
      this.intensity = Math.min(100, this.intensity + 2);
      this.callback(this.intensity);
    }

    this.lastX = x || 0;
    this.lastY = y || 0;
    this.lastZ = z || 0;
  };
}