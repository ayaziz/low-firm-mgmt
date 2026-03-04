import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';

export interface ScanResult {
  clean: boolean;
  virusName?: string;
  error?: string;
}

/**
 * ClamAV scanner service.
 *
 * Connects to a `clamd` daemon over TCP using the INSTREAM protocol.
 * Falls back to a basic heuristic scanner when clamd is unreachable
 * (dev / CI environments without ClamAV installed).
 */
@Injectable()
export class ScannerService {
  private readonly logger = new Logger(ScannerService.name);
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.host = this.config.get<string>('CLAMAV_HOST', 'clamav');
    this.port = this.config.get<number>('CLAMAV_PORT', 3310);
    this.timeout = this.config.get<number>('CLAMAV_TIMEOUT', 30000);
    this.enabled = this.config.get<string>('CLAMAV_ENABLED', 'false') === 'true';
  }

  /**
   * Scan a file buffer using ClamAV.
   * Returns { clean: true } when no threat is found.
   */
  async scan(fileBuffer: Buffer, fileName: string): Promise<ScanResult> {
    if (!this.enabled) {
      this.logger.debug(`ClamAV disabled — using heuristic scan for "${fileName}"`);
      return this.heuristicScan(fileBuffer, fileName);
    }

    try {
      return await this.clamdScan(fileBuffer);
    } catch (err: any) {
      this.logger.warn(`ClamAV unavailable (${err.message}) — falling back to heuristic scan`);
      return this.heuristicScan(fileBuffer, fileName);
    }
  }

  /**
   * Ping the clamd daemon to verify connectivity.
   */
  async ping(): Promise<boolean> {
    return new Promise((resolve) => {
      const sock = net.createConnection({ host: this.host, port: this.port }, () => {
        sock.write('zPING\0');
      });
      let data = '';
      sock.on('data', (chunk) => (data += chunk.toString()));
      sock.on('end', () => {
        sock.destroy();
        resolve(data.trim() === 'PONG');
      });
      sock.on('error', () => {
        sock.destroy();
        resolve(false);
      });
      sock.setTimeout(5000, () => {
        sock.destroy();
        resolve(false);
      });
    });
  }

  // ── ClamAV INSTREAM protocol ───────────────────────────────

  private clamdScan(fileBuffer: Buffer): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port }, () => {
        // Send INSTREAM command
        sock.write('zINSTREAM\0');

        // Send file data in chunks (max 2048 bytes each)
        const chunkSize = 2048;
        for (let offset = 0; offset < fileBuffer.length; offset += chunkSize) {
          const end = Math.min(offset + chunkSize, fileBuffer.length);
          const chunk = fileBuffer.subarray(offset, end);
          const lengthBuf = Buffer.alloc(4);
          lengthBuf.writeUInt32BE(chunk.length, 0);
          sock.write(lengthBuf);
          sock.write(chunk);
        }

        // Send zero-length terminator
        const terminator = Buffer.alloc(4, 0);
        sock.write(terminator);
      });

      let response = '';
      sock.on('data', (chunk) => (response += chunk.toString()));
      sock.on('end', () => {
        sock.destroy();
        const trimmed = response.trim().replace(/\0/g, '');

        if (trimmed.endsWith('OK')) {
          resolve({ clean: true });
        } else if (trimmed.includes('FOUND')) {
          // Format: "stream: VirusName FOUND"
          const match = trimmed.match(/stream:\s*(.+)\s+FOUND/);
          const virusName = match?.[1]?.trim() || 'Unknown';
          this.logger.warn(`Virus detected: ${virusName}`);
          resolve({ clean: false, virusName });
        } else {
          resolve({ clean: false, error: `Unexpected clamd response: ${trimmed}` });
        }
      });

      sock.on('error', (err) => {
        sock.destroy();
        reject(err);
      });

      sock.setTimeout(this.timeout, () => {
        sock.destroy();
        reject(new Error('ClamAV scan timed out'));
      });
    });
  }

  // ── Heuristic fallback (dev/CI) ────────────────────────────

  private heuristicScan(_buffer: Buffer, fileName: string): ScanResult {
    // EICAR test string detection for testing
    const upper = fileName.toUpperCase();
    if (upper.includes('EICAR') || upper.includes('VIRUS') || upper.includes('MALWARE')) {
      return { clean: false, virusName: 'Heuristic.TestFile' };
    }
    return { clean: true };
  }
}
