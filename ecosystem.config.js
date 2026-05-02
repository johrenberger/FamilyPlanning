module.exports = {
  apps: [{
    name: 'crawdad',
    script: 'lib/server.js',
    cwd: '/data/.openclaw/workspace/FamilyPlanning',
    env: {
      PORT: 8080
    }
  }]
};