# Scantrition

> Open source, AI-powered nutrition tracker. Text, photo, or barcode — get instant macro breakdown.

Une alternative open source et gratuite à Foodvisor / MyFitnessPal. Trois façons d'ajouter un repas : décrire ce qu'on mange en texte, prendre une photo, ou scanner un code-barres. Un modèle IA analyse et retourne les macronutriments estimés. Tout est self-hostable, privacy-first, et extensible.

---

## Stack

| Couche | Choix |
|--------|-------|
| Framework | **Nuxt 4** (Vue 3 + Nitro) |
| Base de données | **PostgreSQL** + **Drizzle ORM** |
| Auth | **nuxt-auth-utils** (session-based) |
| PWA | **@vite-pwa/nuxt** |
| Styling | **Nuxt UI v4** + Tailwind v4 |
| Barcode | **BarcodeDetector API** (natif, ZXing en fallback) |
| Food data | **OpenFoodFacts API** |
| Containerisation | **Docker** + **Docker Compose** |

---

## AI Providers

L'utilisateur choisit son provider dans les settings et fournit sa propre clé API (BYOK). Les clés d'environnement servent de fallback.

| Provider | Modèle par défaut | Free tier |
|----------|--------------------|-----------|
| **Google Gemini** (défaut) | gemini-2.0-flash | ✅ 250 req/jour |
| **OpenRouter** | Au choix | ✅ Certains modèles gratuits |
| **OpenAI** | gpt-4o | ❌ Payant |
| **Anthropic** | claude-sonnet-4-6 | ❌ Payant |

---

## Modes d'ajout de repas

**Texte → IA** — décrire son repas en langage naturel, l'IA parse et retourne les macros.

**Photo → IA** — prendre ou uploader une photo, l'IA vision identifie les aliments et estime les portions.

**Code-barres → OpenFoodFacts** — scanner un produit, récupérer les données nutritionnelles exactes. Aucune IA nécessaire.

---

## Fonctionnalités

### MVP (v0.1)

- [x] **Message texte → Macros**
- [x] **Photo → Macros**
- [x] **Code-barres → Macros** via OpenFoodFacts
- [x] **Dashboard journalier** — totaux calories/protéines/glucides/lipides
- [x] **Objectifs personnalisables** — cibles quotidiennes
- [x] **Historique** — vue des jours passés
- [x] **Multi-provider AI** — Gemini / OpenRouter / OpenAI / Anthropic
- [x] **Auth email/password**
- [ ] **OAuth** — Google, GitHub (nuxt-auth-utils installé)
- [x] **PWA** — installable sur mobile, accès caméra natif
- [x] **Docker Compose** — one-command self-hosting
- [x] **Mode sombre** — natif via Nuxt UI

### v0.2

- [x] Repas favoris — sauvegarder et réutiliser des repas fréquents
- [x] Corrections utilisateur — modifier les macros estimés par l'IA
- [x] Recherche d'aliments — chercher dans OpenFoodFacts sans scanner
- [x] Export CSV

### v0.3

- [x] MCP Server — endpoint Model Context Protocol pour intégration Claude/autres assistants
- [x] Tendances & graphiques — évolution calories/macros sur le temps
- [x] Suggestions de repas — basées sur les objectifs restants de la journée
- [x] API REST publique — clés API générables depuis les settings
- [ ] Plan SaaS hosted — clé API managée, sans config pour l'utilisateur

---

## Démarrage rapide

### Avec Docker (recommandé)

```bash
cp .env.example .env
# Remplir les variables dans .env
docker compose up -d
```

L'app est disponible sur `http://localhost:3000`.

### En développement

```bash
pnpm install
cp .env.example .env
# Remplir les variables dans .env
pnpm db:migrate
pnpm dev
```

---

## Variables d'environnement

```bash
# App URL (requis en production pour les emails de reset)
APP_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://scantrition:scantrition@db:5432/scantrition

# Auth — générer avec : openssl rand -base64 32
NUXT_SESSION_PASSWORD=change-me-to-a-random-32-char-string-minimum

# Email (requis pour la réinitialisation de mot de passe)
RESEND_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# AI Providers (les utilisateurs peuvent aussi configurer leurs clés via l'UI)
GEMINI_API_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

---

## Commandes

```bash
pnpm dev              # Lancer en développement
pnpm build            # Build production
pnpm db:generate      # Générer les migrations Drizzle
pnpm db:migrate       # Appliquer les migrations
pnpm db:studio        # Drizzle Studio (GUI)

docker compose up -d          # Lancer en production
docker compose up -d --build  # Rebuild après changements
```

---

## Licence

MIT
