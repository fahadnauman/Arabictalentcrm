import { Client } from 'ssh2';
const conn = new Client();
conn.on('ready', () => {
  const curlCmd = `curl -s -X POST 'http://localhost:8080/instance/create' \\
--header 'Content-Type: application/json' \\
--header 'apikey: arabictalent-api-key-2024' \\
--data-raw '{
    "instanceName": "arabic-talent-instance",
    "token": "",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
}'`;

  conn.exec(curlCmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('close', (code, signal) => {
      console.log('STDOUT: ' + out);
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
