import { Client } from 'ssh2';

const conn = new Client();

const script = `
set -e
echo "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt-get install -y docker-compose-plugin

echo "Creating directories..."
mkdir -p /opt/evolution-api
cd /opt/evolution-api

echo "Creating docker-compose.yml..."
cat << 'EOF' > docker-compose.yml
version: '3.3'
services:
  evolution-api:
    image: evoapicloud/evolution-api:latest
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=http://143.198.182.24:8080
      - DOCKER_ENV=true
      - LOG_LEVEL=ERROR
      - SERVER_PORT=8080
      - AUTH_TYPE=apikey
      - AUTH_API_KEY=arabictalent-api-key-2024
      # Redis
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      # Postgres
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://postgres:postgres@postgres:5432/evolution?schema=public
      - DATABASE_CONNECTION_CLIENT_NAME=evolution_api
      # Webhooks
      - WEBHOOK_GLOBAL_URL=https://arabic-talent-crm.vercel.app/api/whatsapp/webhook
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=false
      - WEBHOOK_EVENTS_MESSAGES_UPSERT=true
      - WEBHOOK_EVENTS_CONNECTION_UPDATE=true
      - WEBHOOK_EVENTS_QRCODE_UPDATED=true
    depends_on:
      - redis
      - postgres

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=evolution
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
EOF

echo "Starting Docker Compose..."
docker compose up -d
echo "Deployment successful."
`;

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(script, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });
  });
}).connect({
  host: '143.198.182.24',
  port: 22,
  username: 'root',
  password: 'QPwoeiruty649#Q',
  readyTimeout: 60000
});
