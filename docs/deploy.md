# Keystone — Déploiement (Vercel + Railway ou Render)

Ce document est le mode d'emploi du déploiement en ligne. Le site (statique) va sur Vercel, le keeper (processus Node permanent) sur Railway ou sur Render (voir l'état de Railway au §4 et la variante Render au §5bis). Tout reste sur Stellar **Testnet**. Aucun contrat n'est redéployé : le keeper lit les adresses et le hash WASM de `deployments/testnet.json`.

## 1. Architecture

```text
Navigateur ── HTTPS ──> Vercel (app/dist, fichiers statiques, PGlite local au navigateur)
     │
     └──── HTTPS (REST + SSE) ──> Railway : keeper Fastify ──> RPC Stellar Testnet
                                        │                      ECB, Yahoo Finance (lecture)
                                        └── volume /data : session.json, caches
Freighter (extension du navigateur) signe les dépôts et retraits du fonds.
```

Pourquoi le keeper n'est pas sur Vercel : il garde des connexions SSE ouvertes, une session en mémoire et des fichiers de cache. Des fonctions serverless n'offrent rien de cela.

## 2. Ce qui protège le keeper public

| Risque | Protection | Où |
| --- | --- | --- |
| Un visiteur déploie des vaults, poste une marge, règle un défaut | Chaque route `POST` exige `Authorization: Bearer <code>`; les codes sont dans `KEEPER_ACCESS_TOKENS` (côté serveur, 32 caractères minimum, comparaison à temps constant) | `keeper/src/access.ts`, `server.ts` |
| Le code fuit dans le site | Le code n'est jamais une variable `VITE_*` : chaque personne le saisit dans la page, il reste dans son navigateur | `app/src/api/access.ts` |
| Le keeper signe pour le fonds | Au démarrage hébergé, `SIGNER=keeper` et `FUND_SECRET` sont refusés : tout dépôt ou retrait passe par Freighter | `keeper/src/hosted.ts` |
| Page tierce qui appelle l'API | Origines (`KEEPER_ALLOWED_ORIGINS`), hôtes exacts (`KEEPER_PUBLIC_HOSTS`), `localhost` refusé en mode hébergé. Ce n'est **pas** une authentification. Le joker `*` des origines (previews Vercel) accepte aussi des noms d'autres équipes qui se terminent pareil : préférer des origines exactes quand c'est possible | `server.ts` |
| Trop de flux SSE | 100 flux ouverts au plus, 10 par adresse | `server.ts` |

Les routes `GET` (`/health`, `/config`, `/session`, `/events`, `/market-advisor`) restent ouvertes : elles ne montrent que des données publiques de Testnet.

Limites assumées : un seul code partagé par personne (pas de comptes), pas de limitation de débit au-delà de la longueur du code (32 caractères aléatoires), et quiconque a un code peut dépenser les frais du compte keeper et les jetons de démonstration du fonds (le fonds ne signe que dans Freighter).

## 3. Persistance et transactions incertaines

- Le keeper écrit `session.json` dans `KEEPER_DATA_DIR` (volume Railway monté sur `/data`) à chaque changement, de façon atomique. Au redémarrage il recharge la session et relit le coffre sur la chaîne. Si le coffre n'existe plus (remise à zéro de Testnet), une copie `session.json.dropped-….bak` est gardée et le keeper repart sans session.
- **Sans volume, un redéploiement efface la session** : le coffre garde ses jetons sur la chaîne mais le keeper n'en connaît plus l'adresse. Le volume est donc obligatoire pour un usage au-delà d'un essai.
- Le hash d'une transaction signée par le keeper est enregistré **avant** son envoi (et celui d'une transaction signée dans Freighter dès sa réception), puis sauvegardé. Un redémarrage pendant l'attente de confirmation garde donc la garde. Une entrée `pending` retrouvée au redémarrage sans hash bloque les écritures jusqu'à la fin de la fenêtre de 200 s.
- Une transaction dont la confirmation n'arrive pas (délai RPC, coupure réseau) reste `pending` avec son hash. Tant qu'elle n'est pas tranchée, **toute écriture et toute préparation de signature sont refusées** (`PendingTransaction`). Toutes les 15 s, et avant chaque écriture, le keeper interroge `getTransaction(hash)` : `SUCCESS` confirme l'entrée, `FAILED` la rejette, et un hash introuvable 200 s après l'enregistrement est déclaré non inclus (aucune transaction construite par le keeper n'est valable plus longtemps). Une transaction refusée par le réseau, ou qui n'a jamais été signée, est marquée `failed` tout de suite. La garde de 200 s du front reste, mais elle n'est qu'un confort.
- Après un arrêt, le keeper ne jette la session que si la chaîne dit que le coffre n'existe plus ; une panne réseau au démarrage la conserve.
- Sur SIGTERM (redéploiement), le keeper cesse d'accepter des requêtes et laisse finir l'écriture en cours avant de s'arrêter (25 s au plus). Railway ne laisse ce délai que si la variable `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30` est définie sur le service : à ajouter.
- Au démarrage hébergé, le keeper vérifie qu'il peut écrire dans `KEEPER_DATA_DIR` et refuse de démarrer sinon.
- Un fichier de session qui ne peut pas être écrit empêche d'envoyer la transaction (rien ne part sans trace durable). Une transaction d'un fonds signée dans Freighter doit expirer dans les 200 s qui suivent sa soumission, sinon elle est refusée (`BadRequest`).
- Limites connues : la fenêtre de 200 s se mesure à l'horloge du serveur ; un hash introuvable après un très long arrêt (au-delà de la mémoire du RPC) est lu comme non inclus, d'où le message qui renvoie à l'état du coffre lu sur la chaîne. Une confirmation tardive met à jour l'entrée et l'état, mais ne recrée pas les entrées `margin_call`, `cured` et `released` de cette transaction. Un déploiement confirmé après un redémarrage sans adresse de coffre enregistrée n'est pas adopté : lancer une nouvelle session.

## 4. Coûts et limites (vérifiés dans la documentation des hébergeurs le 26 octobre 2026)

| | Plan | Prix | À retenir |
| --- | --- | --- | --- |
| Vercel | Hobby | 0 $ | Usage personnel et non commercial seulement (règle d'usage équitable). 100 déploiements par jour. « Vercel Authentication » (accès réservé aux membres du compte) est activée par défaut sur les previews : **elle est désactivée sur ce projet** (Settings → Deployment Protection) pour que le site soit public ; le keeper reste protégé par ses codes. Un projet d'équipe ou à usage commercial demande Pro (20 $ par personne et par mois) |
| Railway | Free | 0 $, 1 $ de crédit par mois | 0,5 Go de RAM, 0,5 Go de volume : à peine suffisant, et le service s'arrête quand le crédit est épuisé |
| Railway | Hobby | 5 $ par mois, 5 $ d'usage inclus | 5 Go de volume. **Recommandé** : le keeper consomme peu (un processus Node, ~150 Mo) |
| Render | Free | 0 $ | Le service s'endort après 15 min sans requête entrante ; **pas de disque persistant** (la session est perdue à chaque redémarrage ou redéploiement). Convient à un essai ou à une démo courte, avec un moniteur qui l'interroge toutes les 5 min (§5bis) |
| Render | Payant | non vérifié | Seul le payant permet un disque persistant (montage `/data`) ; un disque interdit les déploiements sans coupure et la duplication du service |
| UptimeRobot | Free | 0 $, sans carte | 50 moniteurs HTTP(s), intervalle minimal de 5 min |

**État de Railway au 26 octobre 2026 :** la création de nouveaux comptes est suspendue (page de statut de Railway, notice du 23 octobre). Tant qu'elle l'est, utiliser Render (§5bis).

Aucun plan payant n'est activé par ce dépôt : c'est une décision de l'équipe. Railway ne met pas un service à dormir de lui-même ; l'option « Serverless / App Sleeping » existe dans les réglages du service et doit rester **désactivée** (elle couperait les flux SSE et vider la mémoire).

## 5. Étapes (actions humaines marquées 👤)

### A. Générer les secrets (sur ta machine, ne rien coller dans le chat)

```bash
openssl rand -hex 24   # un code d'accès par personne : à donner à la personne, à mettre dans KEEPER_ACCESS_TOKENS
```

`KEEPER_SECRET` : la valeur déjà présente dans ton `.env` local (compte keeper de `deployments/testnet.json`).

### B. Keeper sur Railway

1. 👤 Créer le compte sur railway.com et se connecter avec GitHub. Choisir le plan Hobby (5 $) si l'équipe l'accepte.
2. 👤 *New Project → Deploy from GitHub repo → `Lagouze/keystone`*. Autoriser Railway sur ce seul dépôt. Branche : `deploy/vercel-railway` pour l'essai, puis la branche de production choisie. Railway lit `railway.json` et le `Dockerfile` à la racine.
3. 👤 *Settings → Networking → Generate Domain* : noter `xxx.up.railway.app`.
4. 👤 *Variables* (taper les valeurs dans l'interface de Railway, pas ailleurs) :

   | Variable | Valeur |
   | --- | --- |
   | `KEEPER_SECRET` | la clé du compte keeper (secret) |
   | `KEEPER_ACCESS_TOKENS` | les codes générés, séparés par des virgules (secret) |
   | `KEEPER_PUBLIC_HOSTS` | `xxx.up.railway.app` |
   | `KEEPER_ALLOWED_ORIGINS` | l'origine HTTPS exacte du site, par exemple `https://keystone-xxx.vercel.app`; pour les previews, `https://keystone-*-<équipe>.vercel.app` |
   | `KEEPER_DATA_DIR` | `/data` |
   | `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `30` |

   Déjà fixées par le `Dockerfile` : `KEEPER_HOST=0.0.0.0`, `KEEPER_BACKEND=testnet`, `SIGNER=freighter`. Railway fournit `PORT`. Ne **jamais** définir `FUND_SECRET`, `ISSUER_SECRET` ni `BANK_SECRET`.
5. 👤 *Settings → Volumes → New Volume*, point de montage `/data`. Le conteneur tourne en root (compatible avec les volumes de Railway) ; si le service ne peut pas écrire dans `/data`, le keeper refuse de démarrer, et ajouter `RAILWAY_RUN_UID=0` règle le cas.
6. Vérifier : `curl https://xxx.up.railway.app/api/config` doit répondre `"backend":"testnet"`, `"signerMode":"freighter"`, `"writeAuth":"token"` et le compte fonds `GDQ6AW…MQOY`.

### C. Site sur Vercel

1. 👤 Créer le compte sur vercel.com (« Continue with GitHub »). Autoriser **uniquement** `Lagouze/keystone` (*Only select repositories*).
2. 👤 *Add New → Project → Import `Lagouze/keystone`*, nom `keystone`. Les réglages viennent de `vercel.json` (Vite, `npm ci`, `npm run build -w @keystone/app`, sortie `app/dist`), Root Directory = racine du dépôt.
3. 👤 *Environment Variables* (Production **et** Preview) :
   - `VITE_USE_MOCKS` = `false`
   - `VITE_KEEPER_URL` = `https://xxx.up.railway.app/api`
   Ces valeurs sont publiques (elles finissent dans le JavaScript). Le build échoue volontairement si l'adresse n'est pas en HTTPS ou vise localhost.
4. 👤 *Settings → Git* : laisser la branche de production sur `main` tant que `main` n'est pas à jour. Le premier déploiement se fait sur la branche `deploy/vercel-railway` (un « Preview »).
5. Reporter l'URL du site dans `KEEPER_ALLOWED_ORIGINS` sur Railway.

### D. Vérifications sans transaction

```bash
curl -s https://xxx.up.railway.app/api/health
curl -s https://xxx.up.railway.app/api/config
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://xxx.up.railway.app/api/session -H 'content-type: application/json' -d '{"asset":"KMMF"}'   # 401
curl -s https://xxx.up.railway.app/api/market-advisor
curl -N -m 5 https://xxx.up.railway.app/api/events                                                                                           # : connected, puis ping
```

Dans le navigateur : site chargé, logo et animations, écran de verrouillage (**les comptes de localhost ne sont pas transférés** : en créer un sur le nouveau domaine), « Stellar Testnet · Keeper connected », fenêtre « Team access code », aucune erreur dans la console, aucun appel vers `localhost`, Market Advisor, mobile.

### E. Premier essai Freighter (après un GO écrit de l'équipe)

Même parcours que le test local : session KMMF (signée par le keeper, un vault déployé), dépôt de 1 KMMF, retrait de 1 KMMF, signés dans Freighter (Testnet, compte `GDQ6AW…MQOY`). Coller les hashes dans la PR.

## 5bis. Variante Render + UptimeRobot (offre gratuite pour un essai)

Les variables d'environnement, les codes d'accès, le `Dockerfile` et la partie Vercel (§5.C) sont identiques. Seul l'hébergeur du keeper change.

1. 👤 render.com → *Get Started* → se connecter avec GitHub.
2. 👤 *New +* → *Web Service* → *Build and deploy from a Git repository* → autoriser Render sur le seul dépôt `Lagouze/keystone` → le choisir.
3. 👤 Réglages : *Name* `keystone-keeper` ; *Language* **Docker** ; *Branch* `deploy/vercel-railway` ; *Region* proche (Frankfurt) ; *Instance Type* **Free** pour l'essai ; laisser *Root Directory* et *Dockerfile Path* par défaut.
4. 👤 *Environment Variables* (mêmes valeurs qu'au §5.B, sans `RAILWAY_*`) : `KEEPER_SECRET`, `KEEPER_ACCESS_TOKENS`, `KEEPER_DATA_DIR=/data`, `KEEPER_ALLOWED_ORIGINS` (provisoire), `KEEPER_PUBLIC_HOSTS` (provisoire : `keystone-keeper.onrender.com`). Render fournit `PORT` (10000 par défaut) : le keeper l'utilise.
5. 👤 *Advanced* → *Health Check Path* : `/api/health`.
6. 👤 *Create Web Service*. Le premier build prend quelques minutes. L'adresse est `https://<nom>.onrender.com` ; mettre à jour `KEEPER_PUBLIC_HOSTS` avec ce nom exact (sans `https://`).
7. Vérifier : `curl https://<nom>.onrender.com/api/config` (mêmes attendus qu'au §5.B.6).
8. 👤 UptimeRobot : uptimerobot.com → créer un compte → *Add New Monitor* → type **HTTP(s)**, URL `https://<nom>.onrender.com/api/health`, intervalle **5 minutes**.

Limites de cette variante (offre gratuite) : réveil lent après une veille, session perdue à chaque redémarrage ou redéploiement, garde « pas de double transaction » perdue avec elle. Pour garder une session ou montrer la démo au jury : passer le service à un plan payant et lui attacher un disque monté sur `/data` (*Disks* → *Add Disk*).

## 6. Exploitation

- **Changer ou révoquer un code** : modifier `KEEPER_ACCESS_TOKENS` sur Railway (redéploiement automatique). La session survit grâce au volume.
- **Retour arrière** : Railway et Vercel gardent les déploiements précédents (*Redeploy* / *Promote*).
- **Journaux** : Railway → *Deployments → View logs*. Les clés n'y sont jamais écrites.
- **Si Yahoo Finance bloque l'adresse du serveur** : `/api/market-advisor` marque le VIX comme indisponible (c'est le comportement prévu). À vérifier après le premier déploiement.
