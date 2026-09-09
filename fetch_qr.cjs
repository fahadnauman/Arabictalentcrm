const http = require('http');
const fs = require('fs');

const options = {
  hostname: '143.198.182.24',
  port: 8080,
  path: '/instance/connect/arabic-talent-instance',
  method: 'GET',
  headers: {
    'apikey': 'arabictalent-api-key-2024'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.base64) {
        const html = `
          <html>
            <body style="display:flex; justify-content:center; align-items:center; height:100vh; background-color:#f0f0f0;">
              <div style="text-align:center; background:white; padding:40px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                <h2>Scan QR Code to Connect WhatsApp</h2>
                <img src="\${parsed.base64}" style="width:300px; height:300px; border:1px solid #ccc; padding:10px; border-radius:5px;" />
                <p style="margin-top:20px; color:#555;">Open WhatsApp -> Linked Devices -> Link a Device</p>
              </div>
            </body>
          </html>
        `;
        fs.writeFileSync('C:\\\\Users\\\\fahad\\\\Downloads\\\\AT\\\\qr.html', html);
        console.log('SUCCESS');
      } else {
        console.log('No base64 found in response:', parsed);
      }
    } catch (e) {
      console.log('Error parsing response:', e);
      console.log('Raw data:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: \${e.message}`);
});

req.end();
