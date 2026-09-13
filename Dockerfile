FROM node:20-slim

# Chrome එකට ඕන system libraries install කරන්න
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    fonts-liberation \
    libappindicator3-1 \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Project folder එක
WORKDIR /app

# package.json copy කරලා dependencies install කරන්න
COPY package.json ./
RUN npm install

# Puppeteer Chrome install කරන්න
RUN npx puppeteer browsers install chrome

# ඉතුරු files copy කරන්න
COPY . .

# Port එක expose කරන්න
EXPOSE 3000

# Bot start කරන්න
CMD ["node", "index.js"]
