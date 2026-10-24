// agent/__tests__/icmpProber.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IcmpProber } from '../icmpProber';

describe('FixFlow AI - Local Agent ICMP Prober', () => {
  it('1. rejects invalid IP formats and shell injection characters', async () => {
    const maliciousIps = [
      '127.0.0.1; rm -rf /',
      '192.168.1.1 && whoami',
      '$(reboot)',
      '10.0.0.999',
      'not-an-ip',
      '127.0.0.1 | dir',
    ];

    for (const ip of maliciousIps) {
      const outcome = await IcmpProber.ping({ targetIp: ip, packetCount: 1, timeoutSeconds: 1 });
      assert.equal(outcome.result, 'ERROR');
      assert.equal(outcome.errorCode, 'INVALID_IP_ADDRESS');
      assert.equal(outcome.packetsReceived, 0);
    }
  });

  it('2. successfully pings loopback IP 127.0.0.1 with valid latency metrics', async () => {
    const outcome = await IcmpProber.ping({ targetIp: '127.0.0.1', packetCount: 2, timeoutSeconds: 2 });
    assert.equal(outcome.result, 'SUCCESS');
    assert.equal(outcome.packetsSent, 2);
    assert.equal(outcome.packetsReceived, 2);
    assert.equal(outcome.packetLossPercent, 0);
    assert.ok(outcome.averageLatencyMs != null);
    assert.ok(outcome.averageLatencyMs >= 0);
  });

  it('3. handles unroutable or unreachable target safely without throwing', async () => {
    // 192.0.2.1 is reserved by RFC 5737 for documentation/testing and typically times out
    const outcome = await IcmpProber.ping({ targetIp: '192.0.2.1', packetCount: 1, timeoutSeconds: 1 });
    assert.ok(['TIMEOUT', 'UNREACHABLE'].includes(outcome.result));
    assert.equal(outcome.packetsReceived, 0);
    assert.equal(outcome.packetLossPercent, 100);
  });
});
