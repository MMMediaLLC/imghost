# imghost

Minimal self-hosted image hosting. Dark terminal UI, password-protected, UUID filenames.

## Stack

- Node.js + Express + Multer
- Single-file frontend (`public/index.html`)
- Cloudflare Tunnel for HTTPS (no Nginx needed)

---

## Deployment on Hetzner Ubuntu (with AzuraCast/Docker already on 80/443)

### 1. Clone and install

```bash
git clone https://github.com/MMMediaLLC/imghost.git /opt/imghost
cd /opt/imghost
npm install
mkdir -p uploads
```

### 2. Create environment file

```bash
sudo nano /etc/imghost.env
```

```env
PORT=3001
IMGHOST_PASSWORD=your-strong-password-here
PUBLIC_BASE_URL=https://img.yourdomain.com
```

```bash
sudo chmod 600 /etc/imghost.env
```

### 3. Create systemd service

```bash
sudo nano /etc/systemd/system/imghost.service
```

```ini
[Unit]
Description=imghost image server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/imghost
EnvironmentFile=/etc/imghost.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /opt/imghost
sudo systemctl daemon-reload
sudo systemctl enable --now imghost
sudo systemctl status imghost
```

### 4. Test locally

```bash
# Check auth
curl -s -X POST http://127.0.0.1:3001/auth \
  -H 'Content-Type: application/json' \
  -d '{"password":"your-strong-password-here"}'
# → {"ok":true}

# Upload a test image
curl -s -X POST http://127.0.0.1:3001/upload \
  -H 'x-auth-token: your-strong-password-here' \
  -F 'file=@/path/to/test.jpg'
# → {"url":"https://img.yourdomain.com/i/uuid.jpg","filename":"uuid.jpg"}
```

### 5. Cloudflare Tunnel

Install `cloudflared` if not already present:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
```

Authenticate and create a tunnel:

```bash
cloudflared tunnel login
cloudflared tunnel create imghost
```

Create the config file (`~/.cloudflared/config.yml` or `/etc/cloudflared/config.yml`):

```yaml
tunnel: <YOUR_TUNNEL_ID>
credentials-file: /root/.cloudflared/<YOUR_TUNNEL_ID>.json

ingress:
  - hostname: img.yourdomain.com
    service: http://127.0.0.1:3001
  - service: http_status:404
```

Add the DNS record:

```bash
cloudflared tunnel route dns imghost img.yourdomain.com
```

Install and start as a system service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

imghost is now live at `https://img.yourdomain.com`.

---

## Environment variables

| Variable           | Default                  | Description                        |
|--------------------|--------------------------|------------------------------------|
| `PORT`             | `3001`                   | Port to listen on                  |
| `IMGHOST_PASSWORD` | *(required)*             | Auth password                      |
| `PUBLIC_BASE_URL`  | `http://localhost:3001`  | Public URL prefix for image links  |

## Endpoints

| Method | Path                  | Auth | Description                     |
|--------|-----------------------|------|---------------------------------|
| POST   | `/auth`               | No   | Verify password                 |
| POST   | `/upload`             | Yes  | Upload image (multipart/form-data, field: `file`) |
| GET    | `/images`             | Yes  | List last 40 uploads            |
| DELETE | `/images/:filename`   | Yes  | Delete an image                 |
| GET    | `/i/:filename`        | No   | Serve image (short URL)         |

Allowed types: jpg, jpeg, png, gif, webp, svg — max 20 MB.
