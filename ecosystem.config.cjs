module.exports = {
  apps: [
    {
      name: 'seedance2-wan27-dashboard',
      cwd: '/root/seedance2.0-wan2.7-AIGC-Dashboard',
      script: '/root/.nvm/versions/node/v20.20.2/bin/node',
      args: './node_modules/next/dist/bin/next start -p 8080',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
