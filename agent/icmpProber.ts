// agent/icmpProber.ts
import { spawn } from 'child_process';
import os from 'os';

const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

export interface ProbeOptions {
  targetIp: string;
  packetCount?: number;
  timeoutSeconds?: number;
}

export interface ProbeOutcome {
  result: 'SUCCESS' | 'TIMEOUT' | 'UNREACHABLE' | 'ERROR' | 'UNSUPPORTED';
  packetsSent: number;
  packetsReceived: number;
  packetLossPercent: number;
  averageLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  errorCode?: string | null;
  rawOutput?: string;
}

export class IcmpProber {
  /**
   * Safely probes a target IP using native OS ping utility without shell interpolation
   */
  public static async ping(options: ProbeOptions): Promise<ProbeOutcome> {
    const { targetIp, packetCount = 3, timeoutSeconds = 2 } = options;

    // Strict IP validation before execution
    const trimmedIp = targetIp.trim();
    if (!IPV4_REGEX.test(trimmedIp) && !IPV6_REGEX.test(trimmedIp)) {
      return {
        result: 'ERROR',
        packetsSent: packetCount,
        packetsReceived: 0,
        packetLossPercent: 100,
        averageLatencyMs: null,
        minLatencyMs: null,
        maxLatencyMs: null,
        errorCode: 'INVALID_IP_ADDRESS',
      };
    }

    const platform = os.platform();
    const timeoutMs = timeoutSeconds * 1000;

    let cmd: string;
    let args: string[];

    if (platform === 'win32') {
      cmd = 'ping.exe';
      // -n count, -w timeout in ms
      args = ['-n', String(packetCount), '-w', String(timeoutMs), trimmedIp];
    } else if (platform === 'linux') {
      cmd = 'ping';
      // -c count, -W timeout in seconds
      args = ['-c', String(packetCount), '-W', String(timeoutSeconds), trimmedIp];
    } else if (platform === 'darwin') {
      cmd = 'ping';
      args = ['-c', String(packetCount), '-t', String(timeoutSeconds), trimmedIp];
    } else {
      return {
        result: 'UNSUPPORTED',
        packetsSent: packetCount,
        packetsReceived: 0,
        packetLossPercent: 100,
        averageLatencyMs: null,
        minLatencyMs: null,
        maxLatencyMs: null,
        errorCode: 'UNSUPPORTED_PLATFORM',
      };
    }

    return new Promise<ProbeOutcome>((resolve) => {
      let stdout = '';
      let stderr = '';

      const child = spawn(cmd, args, {
        windowsHide: true,
        shell: false, // Prevents any shell metacharacter expansion
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        resolve({
          result: 'ERROR',
          packetsSent: packetCount,
          packetsReceived: 0,
          packetLossPercent: 100,
          averageLatencyMs: null,
          minLatencyMs: null,
          maxLatencyMs: null,
          errorCode: err.message,
        });
      });

      child.on('close', (code) => {
        resolve(this.parsePingOutput(stdout, stderr, code, packetCount, platform));
      });
    });
  }

  private static parsePingOutput(
    stdout: string,
    stderr: string,
    exitCode: number | null,
    expectedSent: number,
    platform: string
  ): ProbeOutcome {
    if (stdout.includes('Destination host unreachable') || stdout.includes('Destination unreachable')) {
      return {
        result: 'UNREACHABLE',
        packetsSent: expectedSent,
        packetsReceived: 0,
        packetLossPercent: 100,
        averageLatencyMs: null,
        minLatencyMs: null,
        maxLatencyMs: null,
        errorCode: 'DESTINATION_HOST_UNREACHABLE',
        rawOutput: stdout,
      };
    }

    if (platform === 'win32') {
      return this.parseWindowsOutput(stdout, expectedSent);
    } else {
      return this.parseUnixOutput(stdout, expectedSent);
    }
  }

  private static parseWindowsOutput(stdout: string, defaultSent: number): ProbeOutcome {
    // Windows format:
    // Packets: Sent = 3, Received = 3, Lost = 0 (0% loss),
    // Minimum = 1ms, Maximum = 2ms, Average = 1ms
    let sent = defaultSent;
    let received = 0;
    let lossPercent = 100;
    let avg: number | null = null;
    let min: number | null = null;
    let max: number | null = null;

    const packetsMatch = stdout.match(/Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+)/i);
    if (packetsMatch) {
      sent = parseInt(packetsMatch[1], 10);
      received = parseInt(packetsMatch[2], 10);
      lossPercent = sent > 0 ? Number((((sent - received) / sent) * 100).toFixed(1)) : 100;
    }

    const timesMatch = stdout.match(/Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms,\s*Average\s*=\s*(\d+)ms/i);
    if (timesMatch) {
      min = parseFloat(timesMatch[1]);
      max = parseFloat(timesMatch[2]);
      avg = parseFloat(timesMatch[3]);
    } else {
      // Look for single reply times if summary is missing: "time=1ms" or "time<1ms"
      const singleReplies = [...stdout.matchAll(/time[=<](\d+)ms/gi)];
      if (singleReplies.length > 0) {
        const times = singleReplies.map((m) => parseFloat(m[1]));
        min = Math.min(...times);
        max = Math.max(...times);
        avg = Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1));
      }
    }

    if (received === 0) {
      return {
        result: 'TIMEOUT',
        packetsSent: sent,
        packetsReceived: 0,
        packetLossPercent: 100,
        averageLatencyMs: null,
        minLatencyMs: null,
        maxLatencyMs: null,
        errorCode: 'ICMP_ECHO_TIMEOUT',
        rawOutput: stdout,
      };
    }

    return {
      result: 'SUCCESS',
      packetsSent: sent,
      packetsReceived: received,
      packetLossPercent: lossPercent,
      averageLatencyMs: avg,
      minLatencyMs: min,
      maxLatencyMs: max,
      rawOutput: stdout,
    };
  }

  private static parseUnixOutput(stdout: string, defaultSent: number): ProbeOutcome {
    // Unix format:
    // 3 packets transmitted, 3 received, 0% packet loss, time 2003ms
    // rtt min/avg/max/mdev = 0.812/1.245/1.890/0.432 ms
    let sent = defaultSent;
    let received = 0;
    let lossPercent = 100;
    let avg: number | null = null;
    let min: number | null = null;
    let max: number | null = null;

    const packetsMatch = stdout.match(/(\d+)\s+(?:packets\s+)?transmitted,\s+(\d+)\s+(?:packets\s+)?received/i);
    if (packetsMatch) {
      sent = parseInt(packetsMatch[1], 10);
      received = parseInt(packetsMatch[2], 10);
      lossPercent = sent > 0 ? Number((((sent - received) / sent) * 100).toFixed(1)) : 100;
    }

    const rttMatch = stdout.match(/(?:rtt|round-trip)\s+min\/avg\/max\/(?:mdev|stddev)\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/i);
    if (rttMatch) {
      min = parseFloat(rttMatch[1]);
      avg = parseFloat(rttMatch[2]);
      max = parseFloat(rttMatch[3]);
    }

    if (received === 0) {
      return {
        result: 'TIMEOUT',
        packetsSent: sent,
        packetsReceived: 0,
        packetLossPercent: 100,
        averageLatencyMs: null,
        minLatencyMs: null,
        maxLatencyMs: null,
        errorCode: 'ICMP_ECHO_TIMEOUT',
        rawOutput: stdout,
      };
    }

    return {
      result: 'SUCCESS',
      packetsSent: sent,
      packetsReceived: received,
      packetLossPercent: lossPercent,
      averageLatencyMs: avg,
      minLatencyMs: min,
      maxLatencyMs: max,
      rawOutput: stdout,
    };
  }
}
