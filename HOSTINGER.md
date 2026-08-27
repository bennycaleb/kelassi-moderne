# Déploiement Hostinger (VPS) via GitHub

Kelassi a besoin de **Node.js 20+** qui reste allumé. Prenez un **VPS Hostinger**, pas l’hébergement mutualisé PHP.

## 1. Sur GitHub
1. Créez un dépôt privé.
2. Envoyez ce projet (`git init`, `git add`, `git commit`, `git push`).
3. Dans Settings → Secrets and variables → Actions, ajoutez :
   - `HOSTINGER_HOST` : IP du VPS
   - `HOSTINGER_USER` : souvent `root`
   - `HOSTINGER_SSH_KEY` : clé privée SSH
   - `HOSTINGER_PATH` : ex. `/var/www/kelassi`

## 2. Sur le VPS (une fois)
```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2

sudo mkdir -p /var/www/kelassi
sudo git clone git@github.com:VOTRE_COMPTE/kelassi_moderne.git /var/www/kelassi
cd /var/www/kelassi
cp .env.example .env
nano .env   # PORT=3000, FRONTEND_URL=https://votredomaine.com
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 3. Domaine + HTTPS (hPanel Hostinger)
Pointez le domaine vers l’IP du VPS. Activez le SSL. Faites passer le trafic 80/443 vers le `PORT` de l’app (nginx ou le proxy Hostinger).

## 4. Mises à jour
Chaque `git push` sur `main` relance le workflow, ou sur le VPS : `bash scripts/deploy.sh`.

Sauvegardez `database/kelassi.json` avant un déploiement : c’est là que sont les écoles et les notes.
