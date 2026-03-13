# Trivia Night — Deployment Guide

## What you need
- A server that can run Node.js (Railway, Render, DigitalOcean, any VPS)
- Your media files (images, audio) in the right folders

---

## Quick Deploy to Railway (recommended, free tier)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "trivia night"
git remote add origin https://github.com/YOUR_USERNAME/trivia-night.git
git push -u origin main
```

### 2. Go to [railway.app](https://railway.app)
- Sign in with GitHub
- Click **"New Project"** → **"Deploy from GitHub Repo"**
- Select your `trivia-night` repo

### 3. Configure on Railway
| Setting | Value |
|---------|-------|
| **Root Directory** | `/` (leave empty, use root) |
| **Build Command** | `cd client && npm install && npm run build` |
| **Start Command** | `cd server && npm install && node src/index.js` |

Railway auto-assigns a PORT — your server already reads `process.env.PORT`.

### 4. Add a domain
- In Railway project settings → **Networking** → **Generate Domain**
- You'll get something like `trivia-night-production.up.railway.app`

### 5. Open in browser
| URL | Who |
|-----|-----|
| `https://YOUR-DOMAIN.up.railway.app/` | Players join here |
| `https://YOUR-DOMAIN.up.railway.app/display` | Big screen / projector |
| `https://YOUR-DOMAIN.up.railway.app/display?test=1` | Game master test mode |
| `https://YOUR-DOMAIN.up.railway.app/host` | Host controls |

---

## Deploy to any VPS (DigitalOcean, AWS, etc.)

```bash
# 1. SSH into your server
ssh user@your-server

# 2. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Clone and build
git clone https://github.com/YOUR_USERNAME/trivia-night.git
cd trivia-night
cd client && npm install && npm run build && cd ..
cd server && npm install && cd ..

# 4. Run with pm2 (keeps it alive)
sudo npm install -g pm2
cd server && pm2 start src/index.js --name trivia
pm2 save
pm2 startup  # follow the instructions it prints

# 5. (Optional) NGINX reverse proxy for HTTPS
sudo apt install nginx certbot python3-certbot-nginx
```

NGINX config (`/etc/nginx/sites-available/trivia`):
```nginx
server {
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/trivia /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
sudo systemctl restart nginx
```

---

## Media files — what goes where

Place your files in `client/public/`:

```
client/public/
├── audio/
│   ├── lobby.mp3          # Lobby background music
│   ├── board.mp3          # Question board music
│   ├── bidding.mp3        # Bidding phase music
│   ├── question.mp3       # Question phase music
│   ├── estimation.mp3     # Estimation challenge background
│   ├── correct.mp3        # Correct answer SFX
│   ├── wrong.mp3          # Wrong answer SFX
│   ├── reveal_bid.mp3     # Bid reveal SFX
│   ├── slam.mp3           # Team handoff SFX
│   ├── times_up.mp3       # Timer expired SFX
│   ├── ticker.mp3         # Estimation slider tick (2s, loopable)
│   ├── chime.mp3          # Score update chime
│   └── winner.mp3         # Final results celebration
├── avatars/
│   ├── fawaz.png          # Player avatar images
│   ├── gannas.png         # (named to match AVATAR_KEYS in server)
│   └── ...
├── media/
│   ├── questions/
│   │   ├── images/        # Question images (goat_eye.png, kiwi.png, etc.)
│   │   ├── audio/         # Question audio (nudge.mp3, wolf.mp3, etc.)
│   │   └── video/         # Question videos
│   └── answers/
│       ├── images/        # Answer images (goat_face.jpg, rhino.png, etc.)
│       ├── audio/         # Answer audio
│       └── video/         # Answer videos
```

### Media files referenced by your questions:

**Question images (put in `client/public/media/questions/images/`):**
- are_we_alone.jpg, clock.png, compass.jpg, dharma.png, glasses_puzzle.png
- goat_eye.png, grid.png, holes.png, jarrah.png, jurassic_park.gif
- kiwi.png, marwan.png, new_mexico.png, number_pattern.png, perimeter1.png
- pinky_teddy.png, rectangle.png, rocket.png, seychelles.png
- spot1.jpg, spot2.jpg, spot3.jpg, spot4.jpg, spot6.jpg
- stereogram2.jpg, stereogram3.jpg, sticks.png, totti.jpg
- tower.png, waldo1.jpg, waldo2.jpg, waldo3.jpg, wes.png

**Question audio (put in `client/public/media/questions/audio/`):**
- nudge.mp3, wolf.mp3

**Answer images (put in `client/public/media/answers/images/`):**
- are_we_alone.jpg, clock.png, compass.jpg, crab.jpg, dharma.png
- glasses_puzzle.png, goat_face.jpg, greenland_shark.png, grid.png, holes.png
- kiwi.png, marwan.png, msn.jpg, new_mexico.png, number_pattern.png
- perimeter1.png, pink_teddy_reveal.png, platypus.png, rectangle.png
- rhino.png, rocket.png, seychelles.png, shawshank.png
- spot1.jpg, spot2.jpg, spot3.jpg, spot4.jpg, spot6.jpg
- stereogram2.png, stereogram3.png, sticks.png, totti.jpg
- tower.png, waldo1_key.jpg, waldo2_key.jpg, waldo3_key.jpg, wes.png, wolf.png

**Answer audio (put in `client/public/media/answers/audio/`):**
- jarrah.mp4

**Activity images (put in `client/public/media/questions/images/`):**
- `scale.png` — Scale Challenge activity image
- `math_final.png` — Math Final activity image

---

## Game night checklist

- [ ] All audio files in `/audio/` folder
- [ ] All media files in `/media/` folders  
- [ ] Avatar images in `/avatars/` folder
- [ ] Server deployed and running
- [ ] Open `/display` on the big screen, click to unlock audio
- [ ] Open `/host` on your phone/laptop
- [ ] Players join via `/` on their phones
- [ ] Test with `/display?test=1` to review all questions
