const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const script = `
# Delete instance
curl -s -X DELETE 'http://localhost:8080/instance/delete/arabic-talent-instance' \\
--header 'apikey: arabictalent-api-key-2024'

# Create instance again
curl -s -X POST 'http://localhost:8080/instance/create' \\
--header 'Content-Type: application/json' \\
--header 'apikey: arabictalent-api-key-2024' \\
--data-raw '{
    "instanceName": "arabic-talent-instance",
    "token": "",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
}' > /tmp/evo_response.json

cat /tmp/evo_response.json
  `;

  conn.exec(script, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      // Parse output
      try {
        const parsed = JSON.parse(out);
        if (parsed.qrcode && parsed.qrcode.base64) {
          const html = `
            <html>
              <body style="display:flex; justify-content:center; align-items:center; height:100vh; background-color:#f0f0f0;">
                <div style="text-align:center; background:white; padding:40px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                  <h2>Scan QR Code to Connect WhatsApp</h2>
                  <img src="${parsed.qrcode.base64}" style="width:300px; height:300px; border:1px solid #ccc; padding:10px; border-radius:5px;" />
                  <p style="margin-top:20px; color:#555;">Open WhatsApp -> Linked Devices -> Link a Device</p>
                </div>
              </body>
            </html>
          `;
          const fs = require('fs');
          fs.writeFileSync('C:\\\\Users\\\\fahad\\\\Downloads\\\\AT\\\\qr.html', html);
          console.log('SUCCESS');
        } else {
          console.log('No base64 found in response:', parsed);
        }
      } catch (e) {
        console.log('Error parsing response:', e);
        console.log('Raw data:', out);
      }
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });
  });
}).connect({
  host: '143.198.182.24',
  port: 22,
  username: 'root',
  password: 'QPwoeiruty649#Q'
});
