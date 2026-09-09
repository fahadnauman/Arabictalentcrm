const http = require('http');

const options = {
  hostname: '143.198.182.24',
  port: 8080,
  path: '/webhook/find/arabic-talent-instance',
  method: 'GET',
  headers: {
    'apikey': 'arabictalent-api-key-2024'
  }
};

const req = http.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.end();
