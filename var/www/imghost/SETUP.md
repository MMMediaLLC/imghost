# imghost // Setup & Deployment Guide

This guide details the complete instructions to deploy the minimal image hosting application to your **Hetzner CX33 (Ubuntu) server**.

---

## 1. Project Directory Structure

Verify the files are in their correct positions on your server:

```text
/var/www/imghost/
├── package.json
├── server.js
├── nginx-snippet.conf
├── SETUP.md
├── public/
│   └── index.html
└── uploads/             # (Automatically created by server.js or mkdir)
```

---

## 2. Server Installation Steps

Run these commands inside `/var/www/imghost/` to install dependencies:

```bash
cd /var/www/imghost/
npm install --production
```

Make sure that the `www-data` system account has correct owner permissions over the directory to allow image writing:

```bash
sudo chown -R www-data:www-data /var/www/imghost
```

---

## 3. Configure the systemd Service

Copy the systemd configuration file to your system configuration folder:

```bash
sudo cp /var/www/imghost/nginx-snippet.conf /etc/nginx/sites-available/imghost
# (Or configure /etc/systemd/system/imghost.service)
```

Ensure the contents of `/etc/systemd/system/imghost.service` are correct:

```ini
[Unit]
Description=imghost daemon - minimal personal image hosting service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/imghost
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production PORT=3001 IMGHOST_PASSWORD=set_your_strong_password_here

[Install]
WantedBy=multi-user.target
```

Remember to replace `set_your_strong_password_here` with your required password!

Enable and launch the systemd daemon:

```bash
# Reload systemd manager configuration
sudo systemctl daemon-reload

# Enable service to run automatically on server reboot
sudo systemctl enable imghost.service

# Start the service immediately
sudo systemctl start imghost.service

# Verify the service status
sudo systemctl status imghost.service
```

---

## 4. Nginx Reverse Proxy Setup

Create a symlink from sites-available to sites-enabled:

```bash
sudo ln -s /etc/nginx/sites-available/imghost /etc/nginx/sites-enabled/
```

Test the Nginx configuration for any typos or syntax errors:

```bash
sudo nginx -t
```

If it shows `syntax is ok`, reload or restart Nginx to activate changes:

```bash
sudo systemctl reload nginx
```

---

## 5. Enable SSL using Let's Encrypt (Certbot)

Run Certbot to request an SSL certificate:

```bash
sudo certbot --nginx -d imghost.yourdomain.com
```

Certbot will automatically obtain certificates, configure HTTPS redirections, and update Nginx configurations automatically!

---

## 6. Logs & Maintenance

To watch server operation logs or troubleshoot image uploads, use `journalctl`:

```bash
sudo journalctl -u imghost.service -f
```
