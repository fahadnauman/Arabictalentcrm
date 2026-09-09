const http = require('http');

const data = JSON.stringify({
  number: "14632170744",
  options: {
    delay: 0,
    presence: "composing"
  },
  mediaMessage: {
    mediatype: "document",
    caption: "",
    media: "SGVsbG8="
  }
});

const options = {
  hostname: '143.198.182.24',
  port: 8080,
  path: '/message/sendMedia/arabic-talent-instance',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'arabictalent-api-key-2024',
    'Content-Length': data.length
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

req.write(data);
req.end();
