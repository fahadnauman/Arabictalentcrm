const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

conn.on('ready', () => {
  const script = `
# 1. Delete instance if it already exists
echo "=== DELETING OLD INSTANCE ==="
curl -s -X DELETE 'http://localhost:8080/instance/delete/arabic-talent-prod' \\
  --header 'apikey: arabictalent-api-key-2024'
echo ""

# 2. Create instance with webhook configuration
echo "=== CREATING INSTANCE ==="
curl -s -X POST 'http://localhost:8080/instance/create' \\
  --header 'Content-Type: application/json' \\
  --header 'apikey: arabictalent-api-key-2024' \\
  --data-raw '{
    "instanceName": "arabic-talent-prod",
    "token": "",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS",
    "webhook": {
      "enabled": true,
      "url": "https://arabic-talent-crm.vercel.app/api/whatsapp/webhook",
      "byEvents": false,
      "base64": false,
      "events": [
        "APPLICATION_STARTUP",
        "QRCODE_UPDATED",
        "MESSAGES_SET",
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "MESSAGES_DELETE",
        "SEND_MESSAGE",
        "CONNECTION_UPDATE"
      ]
    }
  }' > /tmp/evo_create_res.json
cat /tmp/evo_create_res.json
echo ""

# 3. Explicitly set and lock the webhook
echo "=== SETTING WEBHOOK ==="
curl -s -X POST 'http://localhost:8080/webhook/set/arabic-talent-prod' \\
  --header 'Content-Type: application/json' \\
  --header 'apikey: arabictalent-api-key-2024' \\
  --data-raw '{
    "webhook": {
      "enabled": true,
      "url": "https://arabic-talent-crm.vercel.app/api/whatsapp/webhook",
      "webhookByEvents": false,
      "events": [
        "APPLICATION_STARTUP",
        "QRCODE_UPDATED",
        "MESSAGES_SET",
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "MESSAGES_DELETE",
        "SEND_MESSAGE",
        "CONNECTION_UPDATE"
      ]
    }
  }'
echo ""

# Also set using flat structure if needed by the version
curl -s -X POST 'http://localhost:8080/webhook/set/arabic-talent-prod' \\
  --header 'Content-Type: application/json' \\
  --header 'apikey: arabictalent-api-key-2024' \\
  --data-raw '{
    "enabled": true,
    "url": "https://arabic-talent-crm.vercel.app/api/whatsapp/webhook",
    "webhookByEvents": false,
    "events": [
      "APPLICATION_STARTUP",
      "QRCODE_UPDATED",
      "MESSAGES_SET",
      "MESSAGES_UPSERT",
      "MESSAGES_UPDATE",
      "MESSAGES_DELETE",
      "SEND_MESSAGE",
      "CONNECTION_UPDATE"
    ]
  }'
echo ""

# 4. Check webhook status
echo "=== CHECKING WEBHOOK CONFIG ==="
curl -s -X GET 'http://localhost:8080/webhook/find/arabic-talent-prod' \\
  --header 'apikey: arabictalent-api-key-2024'
echo ""

# 5. Fetch connect/QR code
echo "=== FETCHING QR / CONNECT ==="
curl -s -X GET 'http://localhost:8080/instance/connect/arabic-talent-prod' \\
  --header 'apikey: arabictalent-api-key-2024' > /tmp/evo_connect_res.json
cat /tmp/evo_connect_res.json
echo ""
  `;

  conn.exec(script, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('Stream closed with code:', code);

      // Extract create response
      try {
        const createPart = out.split('=== CREATING INSTANCE ===')[1]?.split('=== SETTING WEBHOOK ===')[0]?.trim();
        const connectPart = out.split('=== FETCHING QR / CONNECT ===')[1]?.trim();
        
        let base64 = null;
        if (createPart) {
          try {
            const parsedCreate = JSON.parse(createPart);
            if (parsedCreate.qrcode && parsedCreate.qrcode.base64) {
              base64 = parsedCreate.qrcode.base64;
            }
          } catch (_) {}
        }
        
        if (!base64 && connectPart) {
          try {
            const parsedConnect = JSON.parse(connectPart);
            if (parsedConnect.base64) {
              base64 = parsedConnect.base64;
            }
          } catch (_) {}
        }

        if (base64) {
          const html = `
            <html>
              <body style="display:flex; justify-content:center; align-items:center; height:100vh; background-color:#f0f0f0;">
                <div style="text-align:center; background:white; padding:40px; border-radius:10px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                  <h2>Scan QR Code to Connect WhatsApp</h2>
                  <img src="${base64}" style="width:300px; height:300px; border:1px solid #ccc; padding:10px; border-radius:5px;" />
                  <p style="margin-top:20px; color:#555;">Open WhatsApp -> Linked Devices -> Link a Device</p>
                </div>
              </body>
            </html>
          `;
          fs.writeFileSync('C:\\\\Users\\\\fahad\\\\Downloads\\\\AT\\\\qr.html', html);
          fs.writeFileSync('C:\\\\Users\\\\fahad\\\\Downloads\\\\AT\\\\qr.txt', base64);
          console.log('[SUCCESS] QR Code saved to qr.html and qr.txt');
        } else {
          console.log('[INFO] No base64 QR code in output (instance might already be connected or pairing in progress)');
        }
      } catch (e) {
        console.error('Error processing responses:', e);
      }
      conn.end();
    }).on('data', (data) => {
      out += data.toString();
      process.stdout.write(data);
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
