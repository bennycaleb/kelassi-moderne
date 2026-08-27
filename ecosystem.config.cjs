module.exports = {
  apps: [
    {
      name: 'kelassi',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
        HOST: '0.0.0.0'
      }
    }
  ]
};
