/**
 * Rate limiter simples para chamadas a APIs externas.
 * Previne spam de requests e protege quotas.
 */

interface RateLimiterConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(config: RateLimiterConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  /**
   * Verifica se pode fazer request. Se não puder, espera automaticamente.
   * Retorna o tempo que esperou (0 se não esperou).
   */
  async waitForSlot(): Promise<number> {
    const now = Date.now();
    // Limpar timestamps fora da janela
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestInWindow) + 50; // +50ms margem
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Limpar de novo após espera
        const afterWait = Date.now();
        this.timestamps = this.timestamps.filter(t => afterWait - t < this.windowMs);
      }
      this.timestamps.push(Date.now());
      return waitTime;
    }

    this.timestamps.push(now);
    return 0;
  }

  /** Verifica se pode fazer request sem bloquear */
  canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    return this.timestamps.length < this.maxRequests;
  }
}

// Gemini Tier 2: 1000+ RPM, mas no frontend nao precisas de tanto - 60/min e muito confortavel
export const geminiLimiter = new RateLimiter({ maxRequests: 60, windowMs: 60_000 });

// Google Drive: 12000 queries/min na quota padrao, 100/min e mais que suficiente
export const driveLimiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });

// Google Sheets: 300 requests/min na quota padrao, 100/min da folga
export const sheetsLimiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });
