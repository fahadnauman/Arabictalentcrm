const { Client } = require('ssh2');

const nginxMainConfig = `user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log;
include /etc/nginx/modules-enabled/*.conf;

events {
	worker_connections 768;
	# multi_accept on;
}

http {

	##
	# Basic Settings
	##

	sendfile on;
	tcp_nopush on;
	types_hash_max_size 2048;
	# server_tokens off;

	# server_names_hash_bucket_size 64;
	# server_name_in_redirect off;

	include /etc/nginx/mime.types;
	default_type application/octet-stream;

	# Global Max Upload & Buffer Settings (100MB)
	client_max_body_size 100M;
	client_body_buffer_size 128k;

	# Global Proxy Timeouts for Baileys media encryption
	proxy_connect_timeout 600;
	proxy_send_timeout 600;
	proxy_read_timeout 600;

	##
	# SSL Settings
	##

	ssl_protocols TLSv1.2 TLSv1.3;
	ssl_prefer_server_ciphers on;

	##
	# Logging Settings
	##

	access_log /var/log/nginx/access.log;

	##
	# Gzip Settings
	##

	gzip on;

	##
	# Virtual Host Configs
	##

	include /etc/nginx/conf.d/*.conf;
	include /etc/nginx/sites-enabled/*;
}
`;

const nginxSiteConfig = `# Map allowed CORS origins
map $http_origin $cors_origin {
    default "";
    "https://arabic-talent-crm.vercel.app" "https://arabic-talent-crm.vercel.app";
    "~^https://arabic-talent-[a-z0-9]+-nauman-labs\\.vercel\\.app$" "$http_origin";
    "http://localhost:3000" "$http_origin";
}

# HTTP - Redirect to HTTPS
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name 143.198.182.24.sslip.io 143.198.182.24 _;

    client_max_body_size 100M;
    client_body_buffer_size 128k;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS Server
server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name 143.198.182.24.sslip.io 143.198.182.24 _;

    ssl_certificate /etc/letsencrypt/live/143.198.182.24.sslip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/143.198.182.24.sslip.io/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Maximum upload size for media (up to 100MB)
    client_max_body_size 100M;
    client_body_buffer_size 128k;

    # Proxy Timeouts for Baileys media encryption
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;

    # Direct Upload Endpoint -> Evolution API sendMedia
    location /direct-upload {
        # Preflight OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'POST, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,apikey' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400 always;
            add_header 'Content-Type' 'text/plain; charset=utf-8' always;
            add_header 'Content-Length' 0 always;
            return 204;
        }

        # CORS Headers on actual POST
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,apikey' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        client_max_body_size 100M;
        client_body_buffer_size 128k;

        # Stream directly without buffering
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_http_version 1.1;
        proxy_read_timeout 600;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;

        # Prevent duplicate CORS headers from upstream
        proxy_hide_header 'Access-Control-Allow-Origin';
        proxy_hide_header 'Access-Control-Allow-Methods';
        proxy_hide_header 'Access-Control-Allow-Headers';
        proxy_hide_header 'Access-Control-Allow-Credentials';

        # Forward to Evolution API sendMedia for arabic-talent-prod instance
        proxy_pass http://127.0.0.1:8080/message/sendMedia/arabic-talent-prod;

        # Automatically inject apikey header so frontend never exposes it
        proxy_set_header apikey "arabictalent-api-key-2024";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Direct Audio Upload Endpoint -> Evolution API sendWhatsAppAudio
    location /direct-upload-audio {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' $cors_origin always;
            add_header 'Access-Control-Allow-Methods' 'POST, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,apikey' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400 always;
            add_header 'Content-Type' 'text/plain; charset=utf-8' always;
            add_header 'Content-Length' 0 always;
            return 204;
        }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' 'POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,apikey' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        client_max_body_size 100M;
        client_body_buffer_size 128k;

        proxy_buffering off;
        proxy_request_buffering off;
        proxy_http_version 1.1;
        proxy_read_timeout 600;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;

        proxy_hide_header 'Access-Control-Allow-Origin';
        proxy_hide_header 'Access-Control-Allow-Methods';
        proxy_hide_header 'Access-Control-Allow-Headers';
        proxy_hide_header 'Access-Control-Allow-Credentials';

        proxy_pass http://127.0.0.1:8080/message/sendWhatsAppAudio/arabic-talent-prod;
        proxy_set_header apikey "arabictalent-api-key-2024";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # General fallback proxy to Evolution API
    location / {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
    }
}
`;

const conn = new Client();
conn.on('ready', () => {
  const b64Main = Buffer.from(nginxMainConfig, 'utf8').toString('base64');
  const b64Site = Buffer.from(nginxSiteConfig, 'utf8').toString('base64');
  const remoteCmd = `
    echo "${b64Main}" | base64 -d > /etc/nginx/nginx.conf
    echo "${b64Site}" | base64 -d > /etc/nginx/sites-available/default
    echo "=== Running nginx -t ==="
    nginx -t
    echo "=== Restarting Nginx service ==="
    systemctl restart nginx
    echo "=== Nginx status ==="
    systemctl is-active nginx
  `;
  conn.exec(remoteCmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      process.exit(1);
    }
    stream.on('close', (code) => {
      console.log('Script execution finished with exit code:', code);
      conn.end();
      process.exit(code);
    }).on('data', (d) => process.stdout.write(d))
      .stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({
  host: '143.198.182.24',
  port: 22,
  username: 'root',
  password: 'QPwoeiruty649#Q'
});
