/**
 * Server Deployment, Custom Port, Domain and Let's Encrypt SSL Generator
 * Generates ready-to-run configurations and commands for Linux VPS, Nginx, Docker, and Systemd.
 */

export interface DeploymentOptions {
  port: number;
  domain: string;
  enableSsl: boolean;
  sslEmail: string;
  redirectHttps?: boolean;
}

/**
 * Generate complete Nginx reverse proxy configuration
 */
export function generateNginxConfig(options: DeploymentOptions): string {
  const { port, domain, enableSsl, redirectHttps } = options;
  const cleanDomain = domain.trim() || "panel.example.com";
  const proxyPort = port || 3000;

  if (!enableSsl) {
    return `# ==============================================================================
# Nginx Reverse Proxy Configuration (HTTP Only)
# Domain: ${cleanDomain} -> Internal Port: ${proxyPort}
# File Location: /etc/nginx/sites-available/${cleanDomain}
# ==============================================================================

server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain};

    # Client upload limits for backups and multimedia
    client_max_body_size 50M;

    # Gzip Compression for fast panel loading
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:${proxyPort};
        proxy_http_version 1.1;

        # WebSocket headers for Vite / HMR / Realtime updates
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forward real client IP and host
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for background tasks and backup uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
`;
  }

  // With SSL (Let's Encrypt / Certbot)
  return `# ==============================================================================
# Nginx Reverse Proxy Configuration with Free Let's Encrypt SSL
# Domain: ${cleanDomain} -> Internal Port: ${proxyPort}
# File Location: /etc/nginx/sites-available/${cleanDomain}
# ==============================================================================

# HTTP Server: ACME Challenge + Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name ${cleanDomain};

    # Let's Encrypt ACME challenge directory
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    ${redirectHttps !== false ? `location / {
        return 301 https://$host$request_uri;
    }` : `# HTTP access allowed without redirect
    location / {
        proxy_pass http://127.0.0.1:${proxyPort};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }`}
}

# HTTPS Server: SSL Termination + Reverse Proxy to Port ${proxyPort}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${cleanDomain};

    # SSL Certificates managed by Certbot
    ssl_certificate /etc/letsencrypt/live/${cleanDomain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${cleanDomain}/privkey.pem;

    # Modern SSL Security Parameters
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Client limits for backups
    client_max_body_size 50M;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location / {
        proxy_pass http://127.0.0.1:${proxyPort};
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forward real headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;

        # Proxy timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
`;
}

/**
 * Generate Docker Compose file configured with the user's custom port and domain
 */
export function generateDockerCompose(options: DeploymentOptions): string {
  const { port } = options;
  const proxyPort = port || 3000;

  return `# ==============================================================================
# Docker Compose for Accounting Bot Platform
# Run: docker compose up -d --build
# ==============================================================================
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: accounting-bot-platform
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=${proxyPort}
    ports:
      - "${proxyPort}:${proxyPort}"
    env_file:
      - .env
    volumes:
      - ./backups:/app/backups
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${proxyPort}/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
`;
}

/**
 * Generate Systemd service file
 */
export function generateSystemdService(port: number, appDir = "/opt/accountinglearn"): string {
  return `[Unit]
Description=Accounting Bot Platform for Telegram & Bale (Iran)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${appDir}
ExecStart=/usr/bin/node ${appDir}/dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${port || 3000}

[Install]
WantedBy=multi-user.target
`;
}

/**
 * Generate one-liner bash command with CLI flags
 */
export function generateInstallOneLiner(options: DeploymentOptions): string {
  const { port, domain, enableSsl, sslEmail } = options;
  let cmd = "bash <(curl -Ls https://raw.githubusercontent.com/meh732/-accountinglearn/master/install.sh)";

  const flags: string[] = [];
  if (port && port !== 3000) {
    flags.push(`--port ${port}`);
  }
  if (domain && domain.trim()) {
    flags.push(`--domain ${domain.trim()}`);
  }
  if (enableSsl) {
    flags.push("--ssl");
    if (sslEmail && sslEmail.trim()) {
      flags.push(`--email ${sslEmail.trim()}`);
    }
  }

  if (flags.length > 0) {
    cmd += ` ${flags.join(" ")}`;
  }
  return cmd;
}

/**
 * Generate standalone bash setup script for custom deployment
 */
export function generateStandAloneScript(options: DeploymentOptions): string {
  const { port, domain, enableSsl, sslEmail } = options;
  const cleanDomain = domain.trim() || "";
  const proxyPort = port || 3000;

  return `#!/usr/bin/env bash
# ==============================================================================
# Auto Server Setup Script with Custom Port (${proxyPort})${cleanDomain ? ` & Domain (${cleanDomain})` : ""}${enableSsl ? " & Let's Encrypt SSL" : ""}
# ==============================================================================
set -e

echo "=== 🚀 Installing Accounting Bot Platform on Port ${proxyPort} ==="

# 1. Update OS packages
apt-get update -y
apt-get install -y curl git ufw nginx ${enableSsl ? "certbot python3-certbot-nginx" : ""}

# 2. Install Node.js 20 LTS
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 3. Clone / Setup Project
INSTALL_DIR="/opt/accountinglearn"
mkdir -p "$INSTALL_DIR"
if [ ! -d "$INSTALL_DIR/.git" ]; then
    git clone https://github.com/meh732/-accountinglearn.git "$INSTALL_DIR"
else
    cd "$INSTALL_DIR" && git pull
fi
cd "$INSTALL_DIR"

# 4. Install npm & build
npm install
npm run build

# 5. Configure Systemd Service
cat << 'EOF' > /etc/systemd/system/accountinglearn.service
[Unit]
Description=Accounting Bot Platform
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/accountinglearn
ExecStart=$(command -v node) /opt/accountinglearn/dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=${proxyPort}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable accountinglearn
systemctl restart accountinglearn

${cleanDomain ? `# 6. Setup Nginx Reverse Proxy for ${cleanDomain}
cat << 'EOF' > /etc/nginx/sites-available/${cleanDomain}
server {
    listen 80;
    server_name ${cleanDomain};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${proxyPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/${cleanDomain} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

${enableSsl ? `# 7. Acquire Let's Encrypt SSL Certificate
certbot --nginx -d ${cleanDomain} --non-interactive --agree-tos ${sslEmail ? `-m ${sslEmail}` : "--register-unsafely-without-email"} --redirect
systemctl reload nginx
echo "=== ✅ Free SSL Certificate Configured for https://${cleanDomain} ==="
` : ""}
` : ""}

# 8. Firewall Configuration
ufw allow 22/tcp || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
${proxyPort !== 80 && proxyPort !== 443 ? `ufw allow ${proxyPort}/tcp || true` : ""}

echo "=== 🎉 Setup Complete! ==="
echo "Port: ${proxyPort}"
${cleanDomain ? `echo "Domain: ${enableSsl ? "https" : "http"}://${cleanDomain}"` : `echo "URL: http://$(curl -s icanhazip.com):${proxyPort}"`}
`;
}
