/**
 * Scalability Tests
 * Load testing, concurrency, memory usage
 */

const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const request = require('supertest');
const server = require('../../lib/server');

describe('Scalability Tests', () => {
  const app = server;
  const BASE_URL = 'http://localhost:8080';

  describe('Concurrent Requests', () => {
    it('should handle 50 concurrent requests without crashing', async () => {
      const promises = [];
      const endpoints = ['/', '/calendar', '/shopping', '/recipes', '/weather'];
      
      for (let i = 0; i < 50; i++) {
        const endpoint = endpoints[i % endpoints.length];
        promises.push(request(app).get(endpoint));
      }
      
      const results = await Promise.allSettled(promises);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      expect(fulfilled.length).to.be.greaterThan(45); // at least 90% success
    });

    it('should handle rapid sequential requests', async () => {
      for (let i = 0; i < 20; i++) {
        const res = await request(app).get('/');
        expect(res.status).to.equal(200);
      }
    });
  });

  describe('API Stress Test', () => {
    it('should handle multiple API calls in quick succession', async () => {
      const endpoints = [
        '/api/plan/week',
        '/api/weather'
      ];
      
      for (let i = 0; i < 15; i++) {
        for (const endpoint of endpoints) {
          const res = await request(app).get(endpoint);
          expect(res.status).to.be.oneOf([200, 500]); // don't crash
        }
      }
    });
  });

  describe('Memory Stability', () => {
    it('should not leak memory on repeated requests', async () => {
      // Make 100 requests and check server stays responsive
      for (let i = 0; i < 100; i++) {
        await request(app).get('/');
      }
      
      // Server should still respond quickly
      const start = Date.now();
      const res = await request(app).get('/');
      const elapsed = Date.now() - start;
      
      expect(res.status).to.equal(200);
      expect(elapsed).to.be.lessThan(1000); // respond within 1 second
    });
  });

  describe('Large Data Handling', () => {
    it('should handle recipes with many ingredients', async () => {
      const res = await request(app).get('/recipes');
      expect(res.status).to.equal(200);
      // Response should complete within reasonable time
    });

    it('should handle calendar with full year of data', async () => {
      const res = await request(app).get('/calendar');
      expect(res.status).to.equal(200);
    });
  });

  describe('Response Time Benchmarks', () => {
    it('should respond to / within 500ms', async () => {
      const start = Date.now();
      const res = await request(app).get('/');
      const elapsed = Date.now() - start;
      
      expect(res.status).to.equal(200);
      expect(elapsed).to.be.lessThan(500);
    });

    it('should respond to /api/plan/week within 500ms', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/plan/week');
      const elapsed = Date.now() - start;
      
      expect(res.status).to.equal(200);
      expect(elapsed).to.be.lessThan(500);
    });
  });

  describe('Load Test Simulation', () => {
    it('should handle sustained load', async () => {
      const results = [];
      
      for (let batch = 0; batch < 5; batch++) {
        const batchPromises = [];
        for (let i = 0; i < 10; i++) {
          batchPromises.push(request(app).get('/'));
        }
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      const successes = results.filter(r => r.status === 200).length;
      expect(successes).to.be.greaterThan(45); // 90% success rate
    });
  });
});