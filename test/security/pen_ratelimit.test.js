/**
 * F02 Rate Limiting — Dedicated Test Suite
 *
 * Runs against a SEPARATE server instance with rate limiting ENABLED.
 * This is in a separate file because supertest shares the Express app across
 * all describe() blocks, and the rate limiter's IP counter persists across tests.
 *
 * CRITICAL: We must bust the require cache so server.js re-reads DISABLE_RATE_LIMIT
 * from the CURRENT value (false), not the value that was set when pen.test.js first
 * loaded the module (true). Node.js caches module exports at require() time.
 *
 * Based on PEN_TESTING.md Phase 2 findings (2026-05-03)
 */

process.env.DISABLE_RATE_LIMIT = 'false';

// Bust the require cache so server.js re-evaluates DISABLE_RATE_LIMIT
const serverPath = require.resolve('../../lib/server');
delete require.cache[serverPath];

const chai = require('chai');
const expect = chai.expect;
const http = require('http');

const app = require('../../lib/server');

let server;
let baseUrl;

before(() => {
  server = http.createServer(app).listen(0);
  const addr = server.address();
  baseUrl = `http://localhost:${addr.port}`;
});

after(() => {
  server.close();
});

describe('F02 — Rate Limiting on API Endpoints', () => {

  it('should return 429 after 100 requests to /api in a 15-minute window', function (done) {
    this.timeout(20000);
    let count429 = 0;
    let remaining = 110;
    const checks = [];

    for (let i = 0; i < 110; i++) {
      http.get(`${baseUrl}/api/weather`, (res) => {
        if (res.statusCode === 429) count429++;
        checks.push(res.statusCode);
        if (checks.length === remaining) {
          expect(count429).to.be.greaterThan(0);
          done();
        }
      }).on('error', () => {
        checks.push('error');
        if (checks.length === remaining) done();
      });
    }
  });

  it('should include RateLimit headers on responses after threshold', (done) => {
    // Make one request to check headers are present
    http.get(`${baseUrl}/api/weather`, (res) => {
      expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).to.exist;
      done();
    }).on('error', done);
  });

  it('should apply rate limiting to POST /api/daily', function (done) {
    this.timeout(20000);
    let count429 = 0;
    const payload = JSON.stringify({});
    let remaining = 110;
    const checks = [];

    for (let i = 0; i < 110; i++) {
      const req = http.request(`${baseUrl}/api/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }
      }, (res) => {
        if (res.statusCode === 429) count429++;
        checks.push(res.statusCode);
        if (checks.length === remaining) {
          expect(count429).to.be.greaterThan(0);
          done();
        }
      });
      req.write(payload);
      req.end();
      req.on('error', () => {
        checks.push('error');
        if (checks.length === remaining) done();
      });
    }
  });
});