/** Request-local timings. Only fixed stage names and durations leave the server. */
export class ServerTiming {
  private readonly stages: Array<{ name: string; duration: number }> = [];

  constructor(private readonly now: () => number = () => performance.now()) {}

  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = this.now();
    try {
      return await operation();
    } finally {
      this.stages.push({ name, duration: this.now() - start });
    }
  }

  toHeader(): string {
    return this.stages
      .map(({ name, duration }) => `${name};dur=${duration.toFixed(1)}`)
      .join(', ');
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(
      this.stages.map(({ name, duration }) => [
        name,
        Math.round(duration * 10) / 10,
      ])
    );
  }
}
