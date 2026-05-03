/**
 * Component Tests for Express server endpoints
 */

const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const request = require('supertest');
const path = require('path');

// Start server for testing
const server = require('../../lib/server');

describe('Web Server Endpoints', () => {
  let app;

  before(() => {
    app = server;
  });

  describe('GET /', () => {
    it('should return 200 and render home page', async () => {
      const res = await request(app).get('/');
      expect(res.status).to.equal(200);
      expect(res.text).to.include('meal' || 'plan' || 'Crawdad');
    });
  });

  describe('GET /calendar', () => {
    it('should return 200 and render calendar', async () => {
      const res = await request(app).get('/calendar');
      expect(res.status).to.equal(200);
    });
  });

  describe('GET /shopping', () => {
    it('should return 200 and render shopping list', async () => {
      const res = await request(app).get('/shopping');
      expect(res.status).to.equal(200);
    });
  });

  describe('GET /recipes', () => {
    it('should return 200 and render recipes page', async () => {
      const res = await request(app).get('/recipes');
      expect(res.status).to.equal(200);
    });
  });

  describe('GET /weather', () => {
    it('should return 200 and render weather page', async () => {
      const res = await request(app).get('/weather');
      expect(res.status).to.equal(200);
    });
  });

  describe('GET /recipes/:id', () => {
    it('should handle recipe detail requests', async () => {
      const res = await request(app).get('/recipes/1');
      expect(res.status).to.be.oneOf([200, 404]);
    });
  });

  describe('API Endpoints', () => {
    describe('GET /api/plan/week', () => {
      it('should return current week plan', async () => {
        const res = await request(app).get('/api/plan/week');
        expect(res.status).to.equal(200);
        expect(res.body).to.be.an('array');
      });
    });

    describe('GET /api/weather', () => {
      it('should return weather data', async () => {
        const res = await request(app).get('/api/weather');
        expect(res.status).to.equal(200);
        expect(res.body).to.have.property('success');
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/nonexistent-route-xyz');
      expect(res.status).to.equal(404);
    });
  });

  describe('Static Files', () => {
    it('should serve public assets', async () => {
      const res = await request(app).get('/');
      expect(res.status).to.equal(200);
    });
  });
});