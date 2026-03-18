# AgentSociety — Hetzner Server Setup

## Existing Server (RoleRadar)

| Detail | Value |
|--------|-------|
| Plan | CX33 (2 vCPU, 4GB RAM, 80GB SSD) |
| IP | `89.167.2.64` |
| OS | Ubuntu (Debian-based) |
| Running | PostgreSQL 16, Typesense 0.25 |
| Used by | RoleRadar (job aggregator) |

> **Recommendation:** Spin up a **separate Hetzner server** for AgentSociety. The CX33 is already running RoleRadar's DB + search. AI agents are resource-intensive (LLM calls, BullMQ workers, pgvector embeddings). Sharing risks both projects.

---

## 1. Connect to Existing Server

```bash
# SSH in
ssh root@89.167.2.64

# Check resources
htop
df -h
```

---

## 2. Provision a New Server for AgentSociety

### Via Hetzner Cloud Console

1. Go to [console.hetzner.cloud](https://console.hetzner.cloud)
2. Create new project: `AgentSociety`
3. Add server:

| Setting | Recommended |
|---------|-------------|
| Location | Falkenstein (fsn1) or Nuremberg (nbg1) — cheapest EU |
| Image | Ubuntu 24.04 |
| Type | **CPX31** (4 vCPU AMD, 8GB RAM, 160GB) — good starting point |
| SSH Key | Add your public key (`cat ~/.ssh/id_rsa.pub`) |
| Firewall | Create one (see section 4) |
| Name | `agentsociety-1` |

**Cost:** ~$12/month for CPX31. Scale to CPX41 (8 vCPU, 16GB) if running many agents.

### Via CLI (hcloud)

```bash
# Install hcloud CLI
brew install hcloud

# Configure with API token from Hetzner Cloud Console > Security > API Tokens
hcloud context create agentsociety

# Add your SSH key
hcloud ssh-key create --name macbook --public-key-from-file ~/.ssh/id_rsa.pub

# Create server
hcloud server create \
  --name agentsociety-1 \
  --type cpx31 \
  --image ubuntu-24.04 \
  --location fsn1 \
  --ssh-key macbook

# Get the IP
hcloud server ip agentsociety-1
```

---

## 3. Initial Server Setup

```bash
# SSH into new server (replace with your server IP)
ssh root@<SERVER_IP>

# Update system
apt update && apt upgrade -y

# Set timezone
timedatectl set-timezone UTC

# Create non-root user
adduser manish
usermod -aG sudo manish

# Copy SSH key to new user
rsync --archive --chown=manish:manish ~/.ssh /home/manish

# Disable root SSH login (edit sshd_config)
sed -i 's/^PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

From now on, connect as:
```bash
ssh manish@<SERVER_IP>
```

---

## 4. Firewall Rules

```bash
# Via hcloud CLI
hcloud firewall create --name agentsociety-fw

# Allow SSH
hcloud firewall add-rule agentsociety-fw --direction in --protocol tcp --port 22 --source-ips 0.0.0.0/0 --source-ips ::/0

# Allow HTTP/HTTPS (for Next.js / API gateway)
hcloud firewall add-rule agentsociety-fw --direction in --protocol tcp --port 80 --source-ips 0.0.0.0/0 --source-ips ::/0
hcloud firewall add-rule agentsociety-fw --direction in --protocol tcp --port 443 --source-ips 0.0.0.0/0 --source-ips ::/0

# Allow PostgreSQL (restrict to your IP only)
hcloud firewall add-rule agentsociety-fw --direction in --protocol tcp --port 5432 --source-ips <YOUR_IP>/32

# Apply to server
hcloud firewall apply-to-resource agentsociety-fw --type server --server agentsociety-1
```

---

## 5. Install AgentSociety Stack

### PostgreSQL 16 + pgvector

```bash
# Install PostgreSQL
sudo apt install -y postgresql-16 postgresql-16-pgvector

# Enable and start
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and enable pgvector
sudo -u postgres psql <<SQL
CREATE USER agentsociety WITH PASSWORD '<strong-password>';
CREATE DATABASE agentsociety OWNER agentsociety;
\c agentsociety
CREATE EXTENSION vector;
SQL
```

### Redis (for BullMQ job queue)

```bash
sudo apt install -y redis-server

# Set password
sudo sed -i 's/^# requirepass.*/requirepass <redis-password>/' /etc/redis/redis.conf

# Bind to localhost only
sudo sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf

sudo systemctl restart redis
sudo systemctl enable redis
```

### Node.js 22 (for Next.js + Agent Gateway)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v  # v22.x
npm -v

# Install pnpm (or npm, your choice)
npm install -g pnpm
```

### Ollama (optional — local LLM inference)

```bash
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:8b

# Test
ollama run llama3.1:8b "Hello, what are you?"

# Ollama runs on port 11434 by default
# Keep it bound to localhost — agents call it internally
```

> For Claude/GPT: just set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` in `.env`. No local install needed.

---

## 6. Deploy AgentSociety

```bash
# Clone the repo
cd /home/manish
git clone <your-repo-url> agentsociety
cd agentsociety

# Install dependencies
pnpm install

# Create environment file
cat > .env <<'EOF'
# Database
DATABASE_URL=postgresql://agentsociety:<password>@localhost:5432/agentsociety

# Redis
REDIS_URL=redis://:<redis-password>@localhost:6379

# LLM APIs (set whichever you use)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
OLLAMA_BASE_URL=http://localhost:11434

# App
NODE_ENV=production
PORT=3000
EOF

# Build and start
pnpm build
pnpm start
```

### Run with PM2 (process manager)

```bash
npm install -g pm2

# Start Next.js app
pm2 start pnpm --name "agentsociety-web" -- start

# Start BullMQ worker (if separate process)
pm2 start pnpm --name "agentsociety-worker" -- run worker

# Auto-restart on reboot
pm2 save
pm2 startup
```

---

## 7. Reverse Proxy with Caddy (auto HTTPS)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Edit `/etc/caddy/Caddyfile`:
```
agentsociety.yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

Point your domain's A record to the server IP. Caddy handles SSL automatically.

---

## 8. Monitoring

```bash
# Install fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban

# Basic monitoring with htop
sudo apt install -y htop

# Check logs
journalctl -u postgresql -f
journalctl -u redis -f
pm2 logs
```

---

## 9. Quick Reference

### SSH Connection
```bash
ssh manish@<SERVER_IP>
```

### From Your Mac (local dev → remote DB)

```bash
# Port forward PostgreSQL to localhost
ssh -L 5432:localhost:5432 manish@<SERVER_IP>

# Then connect locally
psql postgresql://agentsociety:<password>@localhost:5432/agentsociety
```

### Service Management
```bash
pm2 status                    # Check app status
pm2 restart all               # Restart everything
sudo systemctl status postgresql
sudo systemctl status redis
sudo systemctl status caddy
```

### Server Sizing Guide

| Agents | Recommended | RAM | Cost |
|--------|-------------|-----|------|
| 1-10 | CPX21 (3 vCPU, 4GB) | Enough for PG + Redis + app | ~$8/mo |
| 10-50 | CPX31 (4 vCPU, 8GB) | Comfortable headroom | ~$12/mo |
| 50-200 | CPX41 (8 vCPU, 16GB) | Run Ollama locally too | ~$22/mo |
| 200+ | Dedicated AX42 | 64GB RAM, NVMe | ~$50/mo |

> If running Ollama for local inference, add at least 8GB RAM on top of the app requirements. Cloud API calls (Claude/GPT) don't need extra RAM.
