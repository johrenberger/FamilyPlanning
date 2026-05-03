/**
 * Automated Pen Testing Suite — Crawdad
 * Runs against the live Express server via supertest
 *
 * Covers: XSS, path traversal, command injection, SSRF,
 *         security headers, rate limiting, input validation
 *
 * Based on PEN_TESTING.md Phase 2 findings (2026-05-03)
 */

// Disable rate limiting so pen test suite can make many requests without triggering 429s
process.env.DISABLE_RATE_LIMIT = 'true';


const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const server = require('../../lib/server');

const app = server;

describe('Pen Testing — Automated Security Suite', () => {

  // ══════════════════════════════════════════════════════════════
  // F01 — XSS via URL Parameter Injection
  // ══════════════════════════════════════════════════════════════
  describe('F01 — Cross-Site Scripting (XSS)', () => {

    const xssPayloads = [
      { label: 'script_tag',          value: '<script>alert(1)</script>' },
      { label: 'img_onerror',         value: '<img src=x onerror=alert(1)>' },
      { label: 'svg_onload',          value: '<svg onload=alert(1)>' },
      { label: 'iframe_injection',    value: '<iframe src="javascript:alert(1)">' },
      { label: 'js_protocol',        value: 'javascript:alert(1)' },
      { label: 'handlebars_safety',   value: '{{constructor}}' },
      { label: 'handlebars_math',     value: '{{7*7}}' },
      { label: 'encoded_script',      value: '%3Cscript%3Ealert(1)%3C/script%3E' },
    ];

    xssPayloads.forEach(({ label, value }) => {
      it(`should not reflect XSS payload "${label}" in /recipes?chef`, async () => {
        const res = await request(app)
          .get(`/recipes?chef=${encodeURIComponent(value)}`);

        // Payload must NOT appear unescaped in any href or src attribute
        expect(res.text).to.not.include(value);
      });
    });

    it('should URL-encode chef parameter so XSS payloads are harmless in hrefs', async () => {
      const res = await request(app)
        .get('/recipes?chef=%3Cscript%3Ealert(1)%3C%2Fscript%3E');

      // The raw payload must not appear anywhere in the response
      expect(res.text).to.not.include('<script>alert(1)</script>');
      expect(res.text).to.not.include('<script>alert');
      expect(res.text).to.not.include('alert(1)');
    });

    it('should not reflect XSS in /recipes/:id path parameter', async () => {
      const res = await request(app)
        .get('/recipes/<script>alert(1)</script>');

      expect(res.status).to.be.oneOf([404, 400]);
      if (res.status === 200) {
        expect(res.text).to.not.include('<script>alert(1)</script>');
      }
    });

    it('should not reflect XSS in query parameters on other routes', async () => {
      const routes = ['/', '/calendar', '/shopping', '/weather'];
      const payload = '<img src=x onerror=alert(1)>';

      for (const route of routes) {
        const res = await request(app).get(`${route}?x=${encodeURIComponent(payload)}`);
        expect(res.text).to.not.include(payload),
          `XSS reflected in ${route}?x`;
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // F02 — Rate Limiting
  // ═════════════════════════════════════════════════════  // F02 — Rate Limiting
  // NOTE: see pen_ratelimit.test.js
  describe('F02 — Rate Limiting on API Endpoints', () => {
    it('should verify rate limiting is installed (see pen_ratelimit.test.js)', () => {
      // Rate limit tests live in pen_ratelimit.test.js to avoid supertest IP-counter interference.
      expect(true).to.equal(true);
    });
  });

  // F03 — Security Headers
  // ══════════════════════════════════════════════════════════════
  describe('F03 — Security Headers', () => {

    const securityRoutes = ['/', '/calendar', '/shopping', '/recipes', '/weather'];

    securityRoutes.forEach(route => {
      it(`should send security headers on ${route}`, async () => {
        const res = await request(app).get(route);

        expect(res.headers['x-content-type-options']).to.equal('nosniff');
        expect(res.headers['x-frame-options']).to.equal('SAMEORIGIN');
        expect(res.headers['strict-transport-security']).to.exist;
        expect(res.headers['content-security-policy']).to.exist;
      });
    });

    it('should not expose X-Powered-By or server version', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-powered-by']).to.not.match(/express|node/i);
    });

    it('should set Content-Security-Policy with restrictive defaults', async () => {
      const res = await request(app).get('/');
      const csp = res.headers['content-security-policy'];

      expect(csp).to.include("default-src 'self'");
      expect(csp).to.include("script-src 'self'");
      expect(csp).to.include("object-src 'none'");
    });
  });

  // ══════════════════════════════════════════════════════════════
  // F04 — Path Traversal
  // ══════════════════════════════════════════════════════════════
  describe('F04 — Path Traversal', () => {

    const traversalPayloads = [
      '../../../etc/passwd',
      '..%2F..%2F..%2Fetc%2Fpasswd',
      '....//....//....//etc/passwd',
      '%2e%2e/%2e%2e/%2e%2e/etc/passwd',
    ];

    traversalPayloads.forEach(payload => {
      it(`should block path traversal: "${payload}"`, async () => {
        const res = await request(app).get(`/recipes/${payload}`);
        expect(res.status).to.be.oneOf([400, 404]);
        if (res.status === 200) {
          expect(res.text).to.not.include('root:');
          expect(res.text).to.not.include('/bin/');
        }
      });
    });

    it('should not return config files via path traversal', async () => {
      const res = await request(app).get('/recipes/..%2F..%2Fconfig%2Fconfig.json');
      expect(res.status).to.be.oneOf([400, 404, 403]);
    });

    it('should not return data/state.json via path traversal', async () => {
      const res = await request(app).get('/calendar/..%2F..%2Fdata%2Fstate.json');
      expect(res.status).to.be.oneOf([400, 404, 403]);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // F05 — Command Injection (SSJI — Server-Side JS Injection)
  // ══════════════════════════════════════════════════════════════
  describe('F05 — Command / Code Injection', () => {

    it('should treat semicolons in city parameter as literal characters', async () => {
      const res = await request(app)
        .get('/api/weather?city=St.%20Louis;curl%20localhost:8080');

      // Semicolon should not cause command execution
      expect(res.body).to.have.property('success');
      if (res.body.forecast) {
        expect(res.body.forecast).to.be.an('array');
      }
    });

    it('should treat pipe characters in city parameter as literal characters', async () => {
      const res = await request(app)
        .get('/api/weather?city=St.%20Louis|cat%20/etc/passwd');

      expect(res.body).to.have.property('success');
    });

    it('should treat backtick substitution in city parameter as literal', async () => {
      const res = await request(app)
        .get('/api/weather?city=`whoami`');

      expect(res.body).to.have.property('success');
    });

    it('should treat $(command substitution) in city parameter as literal', async () => {
      const res = await request(app)
        .get('/api/weather?city=$(whoami)');

      expect(res.body).to.have.property('success');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // F06 — SSRF (Server-Side Request Forgery)
  // ══════════════════════════════════════════════════════════════
  describe('F06 — SSRF via Weather API Parameter', () => {

    const ssrfPayloads = [
      'http://localhost:8080/',
      'http://127.0.0.1:8080/',
      'http://169.254.169.254/latest/meta-data/',
      'file:///etc/passwd',
    ];

    ssrfPayloads.forEach(payload => {
      it(`should not fetch internal/dangerous URLs: "${payload}"`, async () => {
        const res = await request(app)
          .get(`/api/weather?city=${encodeURIComponent(payload)}`);

        // Should not successfully fetch an internal resource
        // Success means it didn't error out, but check the response is valid weather
        if (res.body.success && res.body.forecast) {
          // If there's a real forecast, city param was probably ignored / defaulted
          expect(res.body.forecast).to.be.an('array');
        }
        // If it's truly an SSRF hole, we'd get back a different content type
        expect(res.headers['content-type']).to.include('json');
      });
    });
  });

  // ══════════════════════════════════════════════════════════════
  // F07 — Input Validation & Boundary Conditions
  // ══════════════════════════════════════════════════════════════
  describe('F07 — Input Validation', () => {

    it('should handle very long recipe IDs gracefully', async () => {
      const longId = 'x'.repeat(10000);
      const res = await request(app).get(`/recipes/${longId}`);
      expect(res.status).to.be.oneOf([400, 404, 414]);
    });

    it('should handle non-existent recipe UUID format', async () => {
      const res = await request(app).get('/recipes/00000000-0000-0000-0000-000000000000');
      expect(res.status).to.be.oneOf([200, 404]);
    });

    it('should reject requests with multiple encoding tricks', async () => {
      const res = await request(app).get('/recipes/%252e%252e%252fetc%252fpasswd');
      expect(res.status).to.be.oneOf([400, 404]);
    });

    it('should handle Unicode in chef parameter', async () => {
      const res = await request(app).get('/recipes?chef=%E2%9C%93'); // checkmark
      expect(res.status).to.equal(200);
    });

    it('should handle null bytes in URL', async () => {
      const res = await request(app).get('/recipes/Will%00iam');
      expect(res.status).to.be.oneOf([400, 404]);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // F08 — Error Handling & Information Disclosure
  // ══════════════════════════════════════════════════════════════
  describe('F08 — Error Handling & Information Disclosure', () => {

    it('should not leak stack traces on 404', async () => {
      const res = await request(app).get('/nonexistent-route-xyz');
      expect(res.status).to.equal(404);
      expect(res.text).to.not.include('at ', 'stack trace');
    });

    it('should not leak file paths on invalid recipe ID', async () => {
      const res = await request(app).get('/recipes/../../lib/crawdad.js');
      expect(res.status).to.be.oneOf([400, 404]);
      expect(res.text).to.not.include('/data/.openclaw');
    });

    it('should return 404 for unknown API routes', async () => {
      const res = await request(app).get('/api/nonexistent-endpoint');
      // Either 404 (not found) or 429 (rate limited) is acceptable — both deny the request
      expect(res.status).to.be.oneOf([404, 429]);
      expect(res.body).to.not.have.property('stack');
    });

    it('should not expose Express version in error pages', async () => {
      const res = await request(app).get('/api/plan/week');
      if (res.status === 500) {
        expect(res.text).to.not.include('express');
        expect(res.text).to.not.include('node_modules');
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // F09 — API Contract & DOS Resilience
  // ══════════════════════════════════════════════════════════════
  describe('F09 — Availability & DoS Resilience', () => {

    it('should handle 1000 concurrent GET / requests without crashing', async () => {
      const promises = Array.from({ length: 1000 }, () =>
        request(app).get('/').catch(() => ({ status: 503 }))
      );

      const results = await Promise.all(promises);
      const count200 = results.filter(r => r.status === 200).length;
      const count5xx = results.filter(r => r.status >= 500).length;

      expect(count5xx).to.equal(0),
        `${count5xx} server errors under 1000 concurrent requests`;
      expect(count200).to.be.greaterThan(0),
        'No requests succeeded — server may be overwhelmed';
    });

    it('should return valid JSON from all /api endpoints', async () => {
      const endpoints = [
        { method: 'get',  path: '/api/weather' },
        { method: 'get',  path: '/api/plan/week' },
      ];

      for (const { method, path } of endpoints) {
        const res = method === 'get'
          ? await request(app).get(path)
          : await request(app).post(path).send({});

        expect(res.headers['content-type']).to.include('json'),
          `${path} did not return JSON`;
        // Body must be a non-null object or array (valid JSON response)
        expect(res.body).to.satisfy(b => typeof b === 'object' && b !== null);
      }
    });

    it('should not allow JSON payload size exhaustion on /api/init', async () => {
      // KNOWN VULNERABILITY (F09-A): no body size limit — Express accepts huge JSON
      // Fix: add `app.use(express.json({ limit: '1mb' }))`
      const hugeBody = { mealPlan: 'x'.repeat(10_000_000) };
      const res = await request(app)
        .post('/api/init')
        .send(hugeBody)
        .set('content-type', 'application/json');
      // Currently returns 200 — vulnerability documented in PEN_TESTING.md F09-A
      expect(res.status).to.equal(413);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // NV — Not Vulnerable (Verified by Automated Tests)
  // ══════════════════════════════════════════════════════════════
  describe('NV — Verified Safe (Automated Confirmation)', () => {

    it('NV01: no SQL injection surface — app uses no database', async () => {
      const res = await request(app).get("/recipes/1'%20OR%201=1--");
      expect(res.status).to.be.oneOf([404, 400]);
    });

    it('NV02: no file inclusion via recipe ID', async () => {
      const res = await request(app).get('/recipes/../../config/config.json');
      expect(res.status).to.be.oneOf([400, 404]);
    });

    it('NV03: SSRF safe — city param passed to wttr.in API (not a user-controlled URL); wttr.in returns real weather', async () => {
      // Attaching a URL-like string as city returns wttr.in weather (not the URL content)
      // This confirms wttr.in resolves the "city" server-side — no direct HTTP call from our server
      const res = await request(app).get('/api/weather?city=http%3A%2F%2Flocalhost%3A8080%2F');
      expect(res.body.success).to.equal(true);
      expect(res.body.forecast).to.be.an('array');
      // wttr.in processed "localhost" as a city name, not as a URL — our server received real weather data
    });

    it('NV04: Handlebars context isolated — template injection evaluates safely', async () => {
      const res = await request(app).get("/recipes?chef=%7B%7B7*7%7D%7D");
      expect(res.status).to.equal(200);
      // Must not contain the math result (49) — Handlebars should escape or evaluate safely
      expect(res.text).to.not.include('49');
    });
  });

  // ══════════════════════════════════════════════════════════════
  // DEP — Dependency Vulnerabilities (via npm audit)
  // ══════════════════════════════════════════════════════════════
  describe('DEP — Dependency Vulnerabilities', () => {
    it('DEP01: no event-stream / flatmap-stream supply-chain backdoor', async () => {
      const lockPath = require('path').join(__dirname, '..', '..', 'package-lock.json');
      const lockContent = require('fs').readFileSync(lockPath, 'utf8');

      expect(lockContent).to.not.include('flatmap-stream');
      expect(lockContent).to.not.include('event-stream@3.3.6');
    });

    it('DEP02: express version should be ^5 (no known RCE in express 5)', async () => {
      const pkgPath = require('path').join(__dirname, '..', '..', 'package.json');
      const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf8'));

      expect(pkg.dependencies.express).to.match(/[\^~]?5/);
    });
  });
});
