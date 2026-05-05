# Frontend - QimProject

Application frontend React 19 + Vite 8 + Tailwind CSS 4.

## Prerequis

- Node.js 20+
- npm 10+

## Lancer en local

```bash
npm install
npm run dev
```

Par defaut, Vite est disponible sur http://localhost:5173.

## Build production

```bash
npm run build
```

Le build est genere dans dist/.

## Deploiement

- Plateforme cible: Vercel
- Configuration: vercel.json

## Notes

- Le frontend consomme l'API FastAPI via proxy Vite en local.
- Les routes applicatives sont gerees par React Router.
