const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const script = `
cd /opt/evolution-api
docker compose down
docker volume rm evolution-api_postgres_data || true
docker compose up -d
sleep 15
curl -s -X POST 'http://localhost:8080/instance/create' \\
--header 'Content-Type: application/json' \\
--header 'apikey: arabictalent-api-key-2024' \\
--data-raw '{
    "instanceName": "arabic-talent-instance",
    "token": "",
    "qrcode": false,
    "integration": "WHATSAPP-BAILEYS"
}'
  `;

  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data.toString());
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
