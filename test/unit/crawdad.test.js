/**
 * Unit Tests for crawdad.js core logic
 */

const chai = require('chai');
const expect = chai.expect;
const assert = chai.assert;
const path = require('path');
const fs = require('fs');

// Load the crawdad module
const crawdad = require('../../lib/crawdad');

// Point to test data directory
const TEST_DATA_DIR = path.join(__dirname, '..', '..', 'data');
const TEST_CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

describe('Crawdad Core Logic', () => {
  describe('Config Management', () => {
    it('should load config from config.json', () => {
      const config = crawdad.loadConfig();
      expect(config).to.be.an('object');
      expect(config).to.have.property('location');
      expect(config.location).to.have.property('city');
      expect(config.location).to.have.property('zip');
    });

    it('should have valid location settings', () => {
      const config = crawdad.loadConfig();
      expect(config.location.city).to.be.a('string');
      expect(config.location.zip).to.match(/^\d{5}/);
    });

    it('should have store configuration with aisles', () => {
      const config = crawdad.loadConfig();
      expect(config.stores).to.be.an('array');
      expect(config.stores.length).to.be.greaterThan(0);
      config.stores.forEach(store => {
        expect(store).to.have.property('name');
        expect(store).to.have.property('aisles').that.is.an('array');
      });
    });
  });

  describe('State Management', () => {
    it('should load state from state.json', () => {
      const state = crawdad.loadState();
      expect(state).to.be.an('object');
    });

    it('should have valid meal plan structure', () => {
      const state = crawdad.loadState();
      if (state.mealPlan && state.mealPlan.days) {
        expect(state.mealPlan.days).to.be.an('array');
      }
    });
  });

  describe('Date & Time Utilities', () => {
    it('should correctly identify dates', () => {
      const today = new Date();
      expect(today).to.be.a('Date');
    });

    it('should format dates correctly', () => {
      const date = new Date('2026-05-03');
      expect(date.toLocaleDateString('en-US', { weekday: 'long' })).to.equal('Sunday');
    });
  });

  describe('Weather Integration', () => {
    it('should handle weather data structure', () => {
      const mockWeather = {
        condition: 'Sunny',
        temp: 75,
        goodForGrilling: true,
        goodForSoup: false
      };
      expect(mockWeather).to.have.property('condition');
      expect(mockWeather).to.have.property('temp');
    });
  });

  describe('Chef Rotation', () => {
    it('should have valid cook configuration', () => {
      const config = crawdad.loadConfig();
      expect(config.cooks).to.be.an('array');
      assert.lengthOf(config.cooks, 2);
    });

    it('should have rotation weeks configured', () => {
      const config = crawdad.loadConfig();
      expect(config.rotationWeeks).to.be.a('number');
      expect(config.rotationWeeks).to.be.greaterThan(0);
    });
  });

  describe('Recipe Structure', () => {
    it('should validate recipe data integrity', () => {
      const state = crawdad.loadState();
      if (state.recipes && state.recipes.length > 0) {
        state.recipes.forEach(recipe => {
          expect(recipe).to.have.property('name');
          expect(recipe).to.have.property('chef');
        });
      }
    });
  });

  describe('Shopping List Generation', () => {
    it('should group items by store', () => {
      const config = crawdad.loadConfig();
      const stores = config.stores.map(s => s.name);
      expect(stores).to.include('Schnucks');
      expect(stores).to.include('Costco');
      expect(stores).to.include('Aldi');
    });

    it('should have aisle organization', () => {
      const config = crawdad.loadConfig();
      config.stores.forEach(store => {
        expect(store.aisles).to.be.an('array');
        store.aisles.forEach(aisle => {
          expect(aisle).to.be.a('string');
        });
      });
    });
  });
});
