# 1. Utiliser l'image Node.js 20
FROM node:20-slim

# 2. Définir le dossier de travail
WORKDIR /app

# 3. Installer les dépendances système nécessaires pour Baileys
RUN apt-get update && apt-get install -y \
    git \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

# 4. Copier package.json et package-lock.json
COPY package*.json ./

# 5. Installer les dépendances npm
RUN npm ci --only=production

# 6. Copier le reste du code source
COPY . .

# 7. Créer le dossier pour les données d'authentification
RUN mkdir -p /app/auth_info_baileys

# 8. Exposer le port (Heroku utilise $PORT)
EXPOSE 3000

# 9. Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000

# 10. Commande de démarrage
CMD ["node", "server.js"]
