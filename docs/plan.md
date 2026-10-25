# Keystone — Plan de construction du MVP

Ce plan décrit les décisions, l'architecture, le modèle financier, le travail de chaque pôle, le planning et les risques.

Pour les interfaces, `docs/interfaces.md` fait foi ; pour les règles de travail, `AGENTS.md` ; pour les décisions, `docs/decisions.md`.

## 0. Statut actuel et règles d'or

- **Nous sommes en phase zéro. Aucun code applicatif avant un message `GO` écrit par un humain dans l'Issue de kickoff.**
- Tu n'écris que dans les dossiers de ton pôle. Tu ne fusionnes aucune PR. Aucun commit direct sur `main` ou `staging`.
- Aucun secret (clé Stellar, clé API) dans un fichier versionné ni dans un message GitHub.
- Tout se passe sur Stellar **Testnet**. Jamais Mainnet.
- Tu ne déclares « fonctionne » que ce que tu as exécuté. Sinon, tu écris « non testé ».
- Quand une chose n'est pas claire, tu poses la question sur GitHub au lieu de supposer.

## 1. Le projet

Keystone est un moteur de gestion du collatéral pour un swap de taux OTC entre un fonds et une banque, avec un CSA supposé déjà signé. Au lieu de garder du cash pour ses appels de marge, le fonds immobilise des actifs tokenisés qu'il détient déjà : des parts de fonds monétaire (**KMMF**, token fictif émis par l'équipe) ou des obligations souveraines tokenisées (**KBOND**, token fictif émis par l'équipe). Etherfuse est abandonné : sa sandbox ne livre pas sur Stellar Testnet avant la deadline (décision A7).

**Utilisateur cible :** un fonds d'investissement qui gère ses appels de marge sur des swaps OTC, et sa banque contrepartie. **Proposition de valeur :** mobiliser comme garanties des actifs tokenisés que le fonds détient déjà, au lieu de garder autant de cash dédié, avec un processus de marge traçable et des règles appliquées on-chain.

Le MVP démontre sur Stellar Testnet le cycle suivant : dépôt autorisé → immobilisation selon l'exposition du swap → appel de marge → libération → défaut simulé → transfert du collatéral immobilisé à la banque.

L'utilisateur choisit **manuellement** une des deux classes d'actifs. Il n'y a ni optimisation ni allocation automatique.

Ce qui est simulé : le swap, le CSA, les prix, les rendements, les chocs de taux. Ce qui est réel : chaque transaction affichée comme « chain », avec son hash et son lien stellar.expert.

Deadline de soumission : **lundi 26 octobre, 12:00 heure de Lisbonne**. Gel du code à 08:30.

## 2. Décisions de l'équipe (25 octobre)

| # | Décision |
| --- | --- |
| A1 | Contrat : **Liel** (Windows, Codex seul). Keeper et coordination documentaire : **Grégoire** (Mac). Front : **Nathan** (Mac). |
| A2 | Le fonds signe ses dépôts et retraits dans **Freighter**. Le keeper prépare ces transactions et les soumet. Le keeper signe lui-même ses propres opérations (déploiement, `post_margin`, `settle_default`). |
| A3 | Défaut = appel de marge non couvert à l'expiration d'un délai de grâce fixé au déploiement. Le règlement est vérifié on-chain. |
| A4 | Notionnel de 10 M€. Les prix unitaires des tokens de test sont simulés et affichés comme tels. |
| A5 | Claudex est installé sur les trois machines. Le Windows n'a que Codex ; ses PR sont relues par Claude Code sur le Mac de Grégoire. Le compte ChatGPT Plus est commun aux trois machines : les Mac utilisent Claude Code en premier et gardent Codex pour la seconde relecture. |
| A6 | Paramètres financiers de la section 6 validés. |
| A7 | **Deux actifs fictifs émis par l'équipe : KMMF et KBOND. Etherfuse est abandonné.** Test du 25 octobre : un ordre CETES de la sandbox Etherfuse (API v2) a été financé mais n'a jamais été livré sur Stellar Testnet. L'équipe Etherfuse a confirmé que cette fonctionnalité de la v2 n'est pas terminée et devrait marcher fin de journée le 26 octobre, après la deadline. KBOND est émis par l'équipe en EUR (pas de décote de change). Etherfuse n'est plus une piste pour ce hackathon. |
| A8 | Hébergement de l'URL publique (front statique + keeper Node en `SIGNER=keeper`) : **à trancher** au jalon J2 (01:30), confié au pôle keeper. |
| A9 | **Claudex abandonné**, un seul agent par machine (Claude Code sur les Mac, Codex sur le Windows). Revue de chaque PR par un sous-agent Claude neuf sur la machine de l'auteur ; PR du contrat relues en plus par Claude Code sur le Mac de Grégoire (grille renforcée). Remplace A5 et toute mention de Claudex ou de seconde relecture Codex dans ce plan : voir `AGENTS.md` section 7. |

## 3. Architecture

```
Front (Vite/React + Freighter) --REST--> Keeper (Fastify/TS) --tx signées--> keystone_vault (Soroban, Testnet)
Front <--SSE (état + fil d'activité)-- Keeper                                  |  transferts via SAC
Keeper <-- API BCE (Euribor 3M)                                                v
Bootstrap (keeper) --émet KMMF et KBOND--> compte du fonds      Comptes fonds / banque (trustlines)
```

- **Contrat** (`contracts/`, branche `contract/collateral`) : un vault agnostique de l'actif, déployé une fois par session, sans fonction admin ni mise à jour du code.
- **Keeper** (`keeper/`, `scripts/`, `packages/shared/`, branche `back/keeper`) : modèle de marge, scénarios, préparation et soumission des transactions, API REST + SSE, bootstrap Testnet.
- **Front** (`app/`, branche `front/dashboard`) : dashboard, choix de l'actif, signature Freighter, fil d'activité avec preuves.

## 4. Interfaces

Les interfaces (contrat `keystone_vault`, API du keeper, types partagés, règles de changement) sont spécifiées dans **`docs/interfaces.md`**, seule source de vérité. Elles ne sont pas recopiées ici, pour éviter deux versions divergentes.

## 5. Réseau Stellar Testnet

- RPC : `https://soroban-testnet.stellar.org`
- Horizon : `https://horizon-testnet.stellar.org`
- Friendbot : `https://friendbot.stellar.org?addr=<G...>`
- Passphrase : `Test SDF Network ; September 2015`
- Explorateur : `https://stellar.expert/explorer/testnet/tx/<hash>`
- Aucun reset annoncé avant décembre 2026 (à reconfirmer sur status.stellar.org).

## 6. Modèle financier (validé)

| Paramètre | Valeur |
| --- | --- |
| Sens | Le fonds paie le fixe et reçoit l'Euribor 3 mois. Une baisse des taux le met en perte. |
| Notionnel | 10 000 000 EUR |
| Maturité restante | 5 ans, paiements trimestriels |
| Taux fixe K | Taux de départ, arrondi au point de base (le swap vaut 0 au départ) |
| Taux de départ | Dernière valeur mensuelle de la série BCE `FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA` ; en cache si l'API ne répond pas |
| Seuil | 0 EUR |
| Montant minimum de transfert (MTA) | 50 000 EUR |
| KMMF | VL simulée de 1 000 EUR par part, décote de 2 % |
| KBOND | Valeur unitaire simulée de 1 000 EUR, décote de 2 %, pas de décote de change (libellé en EUR) |
| Délai de grâce | 90 s en démo |

Calcul, sur une courbe plate au taux r :

```
A(r)     = Σ_{i=1..20} 0,25 / (1 + r/4)^i
MTM_fonds = N × (r − K) × A(r)
V        = max(0, −MTM_fonds − seuil)
Q        = ceil( V / (P × (1 − h)) )
```

P est le prix unitaire simulé de l'actif, h sa décote totale. Le keeper ne publie Q que si V a bougé d'au moins le MTA depuis la dernière publication.

**Scénario 1 — marge et libération (KMMF)**

1. Dépôt de 300 unités.
2. Choc de −50 pb : environ 240 unités immobilisées.
3. Nouveau choc de −30 pb : déficit et appel de marge. Le fonds complète, le statut passe à `cured`.
4. Remontée de +60 pb : une partie est libérée, et le fonds la retire.

**Scénario 2 — défaut (KBOND)**

1. Dépôt.
2. Choc de −100 pb : déficit, appel de marge.
3. Le fonds ne complète pas. Compte à rebours de 90 s.
4. `settle_default` : le collatéral immobilisé part chez la banque.

## 7. Dépôt GitHub

**Branches** : `main`, `staging`, `front/dashboard`, `back/keeper`, `contract/collateral`, plus `docs/phase-zero` (préparation documentaire). Chaque PR va de la branche de pôle vers `staging` ; elle est fusionnée en « Squash and merge » par un humain.

**Arborescence et propriétaires**

```
README.md, AGENTS.md, docs/*           coordination doc (Grégoire / agent keeper)
contracts/keystone_vault/              pôle contrat
packages/vault-client/                 pôle contrat (bindings TS générés, jamais modifiés à la main)
keeper/, scripts/, packages/shared/    pôle keeper
app/                                   pôle front
deployments/testnet.json               IDs publics (écrit par le keeper ; le contrat fournit le hash WASM et le vault de test)
.env.example                           variables attendues, sans valeur secrète
```

**Labels** : `pole:contract`, `pole:keeper`, `pole:front`, `interface-change`, `blocked`, `needs-human`, `kickoff`.

**Messages GitHub** : ils commencent par `[agent:contract]`, `[agent:keeper]` ou `[agent:front]`, puisque les agents publient avec le compte de leur opérateur. Les humains signent `[human:<prénom>]`.

**Commits** : `contract: …`, `keeper: …`, `front: …`, `docs: …`.

**Modèle de PR**

```markdown
## Ce qui change
## Revue                (sous-agent, points relevés, corrections)
## Tests                (commandes lancées et résultat ; preuve Testnet si applicable)
## Interfaces           (aucun impact / mineur / cassant + lien vers l'Issue interface-change)
## Documentation        (fichiers mis à jour, ou pourquoi rien n'est à mettre à jour)
```

## 8. Phase zéro et kickoff avant le GO

### 8.1 Phase zéro (environ 30 minutes, sur la branche `docs/phase-zero`)

Avant tout code applicatif, la branche `docs/phase-zero` reçoit :

- `README.md` restructuré selon le plan de la section 11 ;
- `AGENTS.md` : règles communes, périmètres, protocole READY / BLOCKED / GO, revue des PR (A9 : sous-agent Claude neuf), tests, documentation, escalade ;
- `docs/interfaces.md` v1.0-rc : la section 4 de ce document ;
- `docs/decisions.md` : décisions A1 à A8 ;
- `docs/plan.md` : tâches et critères de réussite des sections 12 à 14 ;
- `docs/brief.md` : le brief v2 ;
- `packages/shared/src/types.ts` (types seuls) ;
- le modèle de PR, les modèles d'Issue (`interface-change`, `blocked`), `.env.example`, `.gitignore`, les labels.

La PR `docs/phase-zero` → `staging` reste ouverte pendant le kickoff. Les amendements de la spécification y sont poussés par l'agent keeper, puis les humains la fusionnent juste avant le GO.

### 8.2 Kickoff (environ 35 minutes)

Le kickoff se déroule dans une seule Issue `kickoff`. Chaque opérateur relance son agent au début de chaque tour.

1. **Tour 1 — présentation (10 min).** Ce que je réalise, ce que je fournis, ce que j'attends, ce qui est hors de mon périmètre, les risques. Citer le SHA de `docs/interfaces.md` lu.
2. **Tour 2 — questions (10 min).** Lire les deux autres présentations et poser ses questions en les adressant au pôle concerné. Proposer des modifications d'interface sous forme de diff ou de phrase précise, sans éditer le fichier.
3. **Tour 3 — réponses (10 min).** Répondre aux questions reçues. L'agent keeper intègre les modifications acceptées dans `docs/interfaces.md` et les types, passe en v1.0, pousse et publie le SHA. Un désaccord persistant reçoit le label `needs-human`.
4. **Tour 4 — handshake (5 min).** Relire la spécification à ce SHA, puis publier `READY` ou `BLOCKED`. Si la spécification change ensuite, les trois READY sont à refaire.
5. **GO.** Les humains fusionnent `docs/phase-zero` dans `staging`, mettent à jour les branches et postent `GO`. **Publier READY n'autorise pas à coder.**

**Formats**

```markdown
[agent:<pôle>] READY — docs/interfaces.md v1.0 @ <sha>
Mission comprise : …
Interfaces consommées : … / fournies : …
Première tâche après le GO : … ; critère de réussite : …
J'accepte cette version de la spécification.
```

```markdown
[agent:<pôle>] BLOCKED — docs/interfaces.md @ <sha>
Point bloquant : …
Ce qu'il faudrait décider : … (label needs-human ajouté)
```

## 9. Pendant le développement

**Lecture de GitHub** : au début de chaque tâche, avant chaque PR et à chaque relance par l'opérateur, avec `gh issue list --label pole:<pôle>` et `gh pr list --base staging`.

**Changement d'interface**

1. Ouvrir une Issue `interface-change` : quoi, pourquoi, compatible ou cassant, pôles concernés.
2. Ne pas encore toucher au code qui en dépend.
3. Attendre l'accord du pôle consommateur (et d'un humain si c'est cassant).
4. Mettre à jour la spécification et les types dans la même PR que le changement.
5. Les autres pôles n'utilisent la nouvelle version qu'une fois cette PR fusionnée.

**Revue des PR** (A9 : sous-agent Claude neuf, détail dans `AGENTS.md` section 7)

| Niveau | Concerne | Revue |
| --- | --- | --- |
| Léger | Style, textes, documentation | Un passage sur le diff |
| Standard | Keeper, API, état du front, scripts | Passage complet + tests verts |
| Renforcé | Contrat, calcul de marge, autorisations, interfaces | Passage d'un sous-agent neuf avec la grille, correction, second passage par un nouveau sous-agent, tests négatifs, diff du contrat lu par un humain |

Grille de la revue renforcée :

- des tokens peuvent-ils sortir hors de `withdraw` et `settle_default` ?
- chaque fonction qui modifie l'état fait-elle le bon `require_auth` ?
- `available + locked` reste-t-il égal au solde du SAC ?
- les arrondis de conversion euros → unités vont-ils dans le sens prudent ?
- les types envoyés correspondent-ils exactement à la spécification ?
- une entrée `chain` peut-elle s'afficher sans transaction confirmée ?

**Avant chaque fusion (humain)**

- [ ] revue au niveau requis, résumée dans la PR ;
- [ ] tests lancés et résultat collé ;
- [ ] documentation vérifiée et mise à jour si besoin ;
- [ ] impact sur les autres pôles approuvé ;
- [ ] aucun secret dans le diff.

**Après chaque fusion dans `staging`**, la machine du keeper lance `scripts/e2e-testnet.ts`. Si le script échoue, sa réparation passe avant toute autre fusion.

## 10. Planning (heure de Lisbonne, recalé à 19:45)

| Heure | Étape |
| --- | --- |
| jusqu'à 19:45 | Vérification des machines ; test Etherfuse terminé (KBOND retenu) |
| 19:45 – 20:15 | Documents de phase zéro sur `docs/phase-zero` |
| 20:15 – 20:50 | Kickoff des agents, puis GO |
| 20:50 – 23:30 | C1 / K1-K2-K3 / F1-F2 |
| 23:30 | **J1** : une session KMMF démarrée depuis le dashboard, un dépôt réel sur Testnet, la preuve affichée. |
| 23:30 – 01:30 | C2 / K4 / F3 |
| 01:30 | **J2** : script e2e vert sur les deux scénarios. Sinon, réduction au noyau : dépôt, immobilisation, défaut. |
| 01:30 – 02:30 | Prise de sécurité de la vidéo |
| 02:30 – 06:30 | Sommeil (relèves possibles) |
| 06:30 – 08:30 | Finitions UX, pitch deck, mise en ligne de l'URL publique (front + keeper en `SIGNER=keeper`) |
| 08:30 | **Gel du code** |
| 08:30 – 11:30 | Vidéo, README final, `staging` vers `main`, **dépôt rendu public**, vérification de l'URL publique, soumission |
| 12:00 | Clôture officielle |

## 11. Exigences officielles de soumission (vérifiées le 25 octobre, 19:48)

Elles s'appliquent à tous les projets, plus celles du chemin Genesis. Le détail est dans le brief v2, section 8.5.

- **Dépôt GitHub public.** Le nôtre est privé : on le rend public juste avant la soumission.
- **Le README couvre obligatoirement :**
    - résumé, problème, utilisateur cible et proposition de valeur ;
    - setup, installation, variables d'environnement (renvoi à `.env.example`) ;
    - instructions pour jouer la démo ;
    - l'URL publique.
- **Architecture et usage de Stellar**, dans le README :
    - Soroban, SAC, actifs classiques avec trustlines, Freighter ;
    - codes et émetteurs de KMMF et KBOND, ID des SAC, hash du WASM, adresse d'un vault de démo, comptes de démo ;
    - API utilisées : Stellar RPC, Horizon, BCE.
- **URL publique explorable par le jury**, puisque Keystone a une interface utilisateur.
    - Front et keeper hébergés sur Testnet, en mode `SIGNER=keeper` : le jury n'a pas la clé du fonds pour signer dans Freighter.
    - L'écran indique que les signatures sont faites par le compte de démo.
    - Hébergement à arbitrer (décision A8).
- **Preuve de transactions Testnet** : liens stellar.expert dans le README et visibles dans la démo.
- **Travail antérieur déclaré.**
    - Avant l'événement : idée, brief, squelette vide du dépôt, contrat d'essai sur un projet séparé.
    - Pendant l'événement : tout le code applicatif (historique des commits et PR).
- **Genesis :** un MVP fonctionnel (une maquette interactive seule ne suffit pas), sur Testnet, utilisant au moins une primitive Stellar, avec un travail technique significatif réalisé pendant le hackathon.

**Plan du README** (14 rubriques, toutes exigées ou utiles au jury) :

1. Keystone en deux phrases.
2. Problème, utilisateur cible, proposition de valeur.
3. Ce que montre le MVP : tableau « simulé / réellement exécuté sur Testnet ».
4. URL publique de la démo.
5. Architecture et usage de Stellar :
    - les primitives utilisées ;
    - les actifs, avec code et émetteur ;
    - les ID des SAC, le hash du WASM, le vault de démo, les comptes de démo ;
    - Freighter ;
    - les API utilisées.
6. Preuves de transactions (liens stellar.expert).
7. Les trois pôles et l'arborescence.
8. Prérequis avec versions vérifiées, installation, variables d'environnement.
9. Commandes, chacune marquée « non testé » tant qu'elle ne l'est pas.
10. Instructions de démo.
11. Workflow GitHub et liens vers `AGENTS.md`, `docs/interfaces.md`, `docs/decisions.md`.
12. Tableau d'avancement P0, avec lien de preuve.
13. Travail antérieur et travail réalisé pendant l'événement.
14. Limites connues, dont le test Etherfuse abandonné.

Conséquence pour chaque pôle : chaque PR met à jour la section du README qui la concerne, avec les commandes vérifiées et les ID réels. Ces éléments ne s'écrivent pas à la fin.

## 12. Pôle contrat (Liel, Windows, Codex)

### Mission

Écrire, tester et déployer sur Stellar Testnet le contrat `keystone_vault` décrit dans `docs/interfaces.md`, section 3. C'est le seul endroit où vit le collatéral : chaque ligne qui fait sortir des tokens doit être justifiée et testée.

| | |
| --- | --- |
| Branche | `contract/collateral` |
| Tu écris dans | `contracts/`, `packages/vault-client/` (bindings générés). Le hash WASM et l'ID du vault de test sont transmis au keeper, qui les consigne dans `deployments/testnet.json` |
| Tu fournis | WASM uploadé, hash WASM, un vault de test déployé, bindings TypeScript, événements et erreurs conformes à la spécification |
| Tu attends | Rien de l'extérieur pour démarrer. Pour tes tests on-chain : deux comptes Testnet (fonds et banque) et un actif de test. Si le bootstrap du keeper n'est pas encore prêt, crée les tiens avec friendbot et un actif jetable. |
| Ton relecteur | Une session Codex neuve sur ton Windows (première relecture, diff seul), puis Claude Code sur le Mac de Grégoire (pôle keeper), grille renforcée, via commentaire de PR (A9) |

### Outillage

- Rust ≥ 1.84 avec la cible `wasm32v1-none`, stellar-cli ≥ 25.2.0, `soroban-sdk` dans la dernière version majeure disponible (28.x au 25 octobre ; à confirmer avec `cargo search soroban-sdk`).
- Build : `stellar contract build`. Ne pas utiliser `cargo build` pour produire le WASM.
- Tests : `cargo test`, avec la feature `testutils` en dev-dependency.
- Référence utile : le skill Soroban publié par la Stellar Development Foundation, https://skills.stellar.org/skills/soroban/SKILL.md

### Choix techniques déjà faits

- **Actifs** : le contrat manipule l'actif via le client token standard (`soroban_sdk::token::Client`) sur l'adresse du SAC passée au constructeur. KMMF et KBOND suivent le même chemin. Aucun contrat de token maison.
- **Constructeur** : `__constructor` fixe tout (fonds, banque, keeper, actif, `max_required`, `grace_period_secs`). Aucune fonction d'administration, aucune fonction de mise à jour du WASM : le contrat déployé est immuable.
- **Stockage** : instance storage. Étendre le TTL de l'instance à chaque appel modifiant l'état. Un vault neuf est déployé par session de démo.
- **Temps** : `env.ledger().timestamp()` pour `call_deadline`. Un ledger dure environ 5 s, donc 90 s représentent une vingtaine de ledgers.
- **Événements** : utiliser le mécanisme recommandé par la version installée du SDK (macro `#[contractevent]` si elle est disponible, sinon `env.events().publish`). Le premier topic porte le nom de l'événement.
- **Dépôt** : `fund.require_auth()`, puis `token.transfer(&fund, &env.current_contract_address(), &amount)`.
- **Retrait et règlement** : `token.transfer(&env.current_contract_address(), &dest, &amount)`. Aucune autorisation externe n'est nécessaire, puisque c'est le contrat qui envoie ses propres fonds.
- **Montants** : rejeter tout `amount <= 0` (`InvalidAmount`).
- **Rééquilibrage** : une fonction interne unique, appelée en fin de `deposit`, `withdraw` et `post_margin`. Elle gère les transitions `Active` ↔ `MarginCall`.

### Tâches

#### C1 — Vault de base (après le GO, objectif 21:30)

- `__constructor`, `deposit`, `withdraw`, `post_margin`, `get_state`, rééquilibrage, transitions `Active` ↔ `MarginCall`, événements, erreurs.
- Tests unitaires minimum :
    - dépôt refusé sans signature du fonds ;
    - retrait refusé au-delà du disponible ;
    - `post_margin` refusé sans signature du keeper, avec une époque non croissante, ou au-dessus du plafond ;
    - une hausse de `required` immobilise ;
    - une baisse libère ;
    - un déficit ouvre un appel de marge avec la bonne échéance ;
    - un dépôt complémentaire repasse en `Active` ;
    - invariant `available + locked` == solde du SAC après chaque opération.
- Déploiement Testnet :
    - `stellar contract upload` (note le hash WASM) ;
    - `stellar contract deploy --wasm-hash <hash> -- <arguments du constructeur>` pour un vault de test ;
    - un dépôt réel sur ce vault.
- Bindings : `stellar contract bindings typescript --network testnet --contract-id <id> --output-dir packages/vault-client`, puis vérifier qu'ils compilent.
- **Critère de réussite** : `cargo test` vert ; hash WASM et ID du vault de test transmis au keeper (PR ou Issue) et consignés dans `deployments/testnet.json` ; hash de la transaction de dépôt réel collé dans la PR ; bindings présents.
- Revue **renforcée**. PR vers `staging`, annoncée dans l'Issue de kickoff avec mention `[agent:keeper]`.

#### C2 — Défaut (objectif 23:30)

- `settle_default` et le statut `Defaulted`, qui bloque `deposit` et `post_margin` (erreur `Defaulted`) ; après le règlement, `locked = required = shortfall = call_deadline = 0` et plus aucun rééquilibrage.
- Tests :
    - refusé hors `MarginCall` ;
    - refusé avant l'échéance (avancer le temps avec les utilitaires de test du ledger) ;
    - refusé sans déficit ;
    - après l'échéance, la banque reçoit exactement `locked` et le fonds garde `available` ;
    - après le défaut, `deposit` et `post_margin` renvoient `Defaulted`, `locked`, `required`, `shortfall` et `call_deadline` valent 0, et `withdraw` au-delà du disponible (nul dans le parcours normal) renvoie `InsufficientAvailable` ;
    - personne d'autre que la banque ne reçoit de tokens.
- Nouveau upload du WASM. Transmettre le nouveau hash WASM au keeper, qui met à jour `deployments/testnet.json`, et régénérer les bindings si l'interface a bougé (elle ne devrait pas).
- **Critère de réussite** : tests verts et un défaut réel joué sur Testnet, hash collé dans la PR.

#### Ensuite

Correctifs demandés par le keeper ou le front via Issue, relecture des PR du keeper qui appellent le contrat, puis la section « Contrat » du README : fonctions, invariants, limites, commandes vérifiées.

### Pièges connus

- La banque doit avoir une trustline sur l'actif, sinon le transfert de `settle_default` échoue. C'est le bootstrap du keeper qui la crée ; pour tes propres tests on-chain, crée-la toi-même.
- KMMF et KBOND sont émis par l'équipe sans flag `auth_required` : le vault peut les détenir sans autorisation de l'émetteur. Le bootstrap ne doit pas activer ce flag.
- Les bindings générés ne se modifient jamais à la main : on les régénère.

## 13. Pôle keeper (Grégoire, Mac, Claude Code)

### Mission

Le keeper est au milieu du système. Il consomme le contrat, sert le front, calcule la marge, déroule les scénarios et soumet les transactions. Il porte aussi la **coordination documentaire** : la cohérence du README, d'`AGENTS.md` et de `docs/interfaces.md`, et les amendements de la spécification pendant le kickoff.

| | |
| --- | --- |
| Branche | `back/keeper` |
| Tu écris dans | `keeper/`, `scripts/`, `packages/shared/`, `deployments/testnet.json` (y compris le hash WASM et le vault de test fournis par le contrat), `.env.example`, et les documents partagés en tant que coordinateur |
| Tu fournis | Types et mocks partagés (en premier : le front en dépend), bootstrap Testnet, API REST + SSE, modèle de marge, scénarios, script e2e |
| Tu attends | Du pôle contrat : WASM uploadé, hash, bindings dans `packages/vault-client` (C1 vers 21:30). Du front : rien, sinon ses retours sur l'API. |
| Relecture | Sous-agent Claude neuf sur ton Mac (A9). Tu relis aussi **les PR du contrat** avec Claude Code (grille renforcée) et postes la revue en commentaire. |

### Outillage

Node 22 LTS, TypeScript, Fastify, `@stellar/stellar-sdk`, `tsx` pour exécuter les scripts (aucun script bash, pour que tout marche aussi sous Windows), Vitest. Workspaces npm à la racine : `app`, `keeper`, `packages/*`.

### Variables d'environnement

Le fichier `.env` est local, jamais commité. Seul `.env.example` est versionné, sans valeurs.

```
ISSUER_SECRET=        # émetteur de KMMF et KBOND
FUND_SECRET=          # compte du fonds (bootstrap, e2e et mode SIGNER=keeper ; c'est aussi lui qu'on importe dans Freighter)
BANK_SECRET=          # compte de la banque (bootstrap : trustlines)
KEEPER_SECRET=        # signe déploiement, post_margin, settle_default
SIGNER=freighter      # freighter | keeper
PORT=8787
```

Le compte du fonds est un compte Freighter dédié à la démo, financé par friendbot. L'opérateur colle lui-même sa clé secrète dans `FUND_SECRET` du `.env` local (jamais générée par un script, jamais affichée) ; le bootstrap en dérive l'adresse publique et l'écrit dans `deployments/testnet.json`, sans adresse codée en dur. Le compte Freighter du test Etherfuse n'est plus utilisé.

### Tâches

#### K1 — Types et mocks (premier, objectif GO + 30 min)

- `packages/shared/src/types.ts` : copie exacte de `docs/interfaces.md`, section 5.
- `packages/shared/src/mocks/` :
    - un `KeystoneConfig` ;
    - un `SessionState` pour chaque statut (`active`, `margin_call` avec échéance, `defaulted`) ;
    - une séquence d'`ActivityEvent` du scénario 1 (sim puis chain confirmed, avec de faux hash clairement marqués `MOCK`).
- **Critère de réussite** : le paquet compile ; PR rapide (revue standard) que le front peut utiliser immédiatement.

#### K2 — Bootstrap Testnet (objectif 21:30)

`scripts/bootstrap-testnet.ts`, idempotent (on peut le relancer sans rien casser) :

1. Créer les comptes émetteur, fonds, banque et keeper via friendbot s'ils n'existent pas.
2. Trustlines du fonds et de la banque pour KMMF et KBOND.
3. Émettre KMMF et KBOND vers le fonds (par exemple 1 000 unités chacun).
4. Déployer les SAC de ces actifs (`stellar contract asset deploy` ou l'équivalent dans le SDK ; si le SAC existe déjà, récupérer son ID).
5. Écrire `deployments/testnet.json` : adresses publiques, codes, émetteurs, ID des SAC.

**Critère de réussite** : relancé deux fois de suite sans erreur, avec des soldes visibles sur Horizon.

#### K3 — API réelle (objectif 23:00, avant J1)

- Serveur Fastify sur le port 8787, CORS ouvert vers le front en local.
- Routes :
    - `GET /health`, `GET /config` ;
    - `POST /session` : déploie un vault neuf avec le hash WASM de `deployments/testnet.json` et les arguments du constructeur (via les bindings s'ils exposent le déploiement, sinon via le SDK) ;
    - `GET /session` : lit `get_state` ;
    - `POST /session/deposit/prepare` : construit la transaction `deposit` avec le fonds comme source, la simule, et renvoie le XDR assemblé non signé ;
    - `POST /session/submit` : reçoit le XDR signé, le soumet au RPC, suit `getTransaction` jusqu'au succès ou à l'échec, met à jour l'état ;
    - `POST /session/deposit` en mode `SIGNER=keeper` ;
    - `GET /events` en SSE.
- Fil d'activité :
    - une entrée `chain` est créée en `pending` à la soumission, puis passe en `confirmed` (avec hash et lien stellar.expert) ou `failed` ;
    - les calculs sont des entrées `sim`.
- **Critère de réussite** : `POST /session` puis un dépôt (Freighter via le front, ou `SIGNER=keeper` en ligne de commande) donnent un `SessionState` cohérent avec `get_state` on-chain, et le flux SSE contient un événement `chain` confirmé dont le lien s'ouvre.

#### K4 — Marge, scénarios, e2e (objectif 01:30)

- `keeper/src/margin.ts` : formules de la section 6.
    - Tests Vitest avec des valeurs de référence calculées à la main, pour 0, −50 et −80 pb.
    - Arrondi au supérieur des unités (sens prudent).
    - Règle du MTA respectée.
- `keeper/scenarios/default.json` : paramètres de la section 6.
- Taux de départ : série BCE Euribor 3 mois (dataflow `FM`, clé `M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA`, API `https://data-api.ecb.europa.eu/service/data/...`, dernière observation). Cache dans `keeper/data/euribor-cache.json`, source affichée `ecb` ou `cache`.
- Pas de conversion de change : KMMF et KBOND sont tous deux en EUR.
- Routes `rate-shock`, `withdraw/prepare`, `settle-default`, et `withdraw` en mode keeper.
- `scripts/e2e-testnet.ts` en mode `SIGNER=keeper` :
    - joue le scénario 1 avec KMMF et le scénario 2 avec KBOND ;
    - vérifie les soldes on-chain à chaque étape ;
    - attend réellement le délai de grâce.
- **Critère de réussite** : e2e vert sur les deux scénarios = jalon J2.

#### Coordination documentaire (en continu)

- Pendant le kickoff : intégrer les modifications acceptées dans `docs/interfaces.md` et `types.ts` sur `docs/phase-zero`, passer en v1.0, publier le SHA.
- Après le GO : vérifier que chaque PR fusionnée laisse README, `AGENTS.md` et la spécification cohérents. Tenir le tableau d'avancement du README (« vérifié » seulement avec un lien de preuve).
- En cas de conflit sur un fichier partagé, c'est toi qui consolides.

### Pièges connus

- Les transactions Soroban doivent être simulées avant signature : sans simulation, il manque le footprint et les frais de ressources.
- Les bindings de `packages/vault-client` ne se modifient pas à la main. S'ils ne conviennent pas, demande au pôle contrat de les régénérer.
- La source d'une transaction préparée pour Freighter doit être le compte du fonds, avec un numéro de séquence frais. Prépare-la au moment du clic, pas à l'avance.
- `settle_default` échouera si la banque n'a pas de trustline sur l'actif : le bootstrap doit la créer.

## 14. Pôle front (Nathan, Mac, Claude Code)

### Mission

Construire le dashboard que le jury verra dans la vidéo. Il doit rendre évidents :

- le problème (le cash immobilisé) ;
- ce que fait le moteur à chaque étape ;
- la preuve que chaque mouvement de tokens est une vraie transaction Stellar Testnet.

La qualité visuelle compte, mais les grandes décisions UI/UX se prennent avec l'équipe.

| | |
| --- | --- |
| Branche | `front/dashboard` |
| Tu écris dans | `app/` uniquement |
| Tu fournis | Le dashboard, le parcours filmé, `docs/demo-script.md` (avec le keeper) |
| Tu attends | Les types et mocks de `packages/shared` (K1, environ 30 min après le GO), puis l'API réelle du keeper (K3, vers 23:00) |
| Relecture | Sous-agent Claude neuf sur ton Mac (A9) |

### Outillage

Vite, React, TypeScript, Tailwind CSS, Motion (ex-Framer Motion) pour les animations, `@stellar/freighter-api` pour la signature. La bibliothèque de graphiques est à choisir avec l'équipe. Pas de Next.js.

### Principes à respecter

- Le front ne parle qu'au keeper (`VITE_KEEPER_URL`, par défaut `http://localhost:8787/api`) et à Freighter. Il ne détient aucune clé et n'appelle pas le RPC Stellar directement.
- Un client API typé, unique, construit sur `packages/shared/src/types.ts`. Le même code tourne sur les mocks (`VITE_USE_MOCKS=true`) et sur le keeper réel.
- Le fil d'activité distingue visuellement deux types d'entrées :
    - **calcul / simulation** (`kind: "sim"`) : jamais de hash ;
    - **transaction Testnet** (`kind: "chain"`) : hash abrégé et lien stellar.expert seulement quand `status` vaut `confirmed`.
- Tout ce qui est simulé (taux choqués, prix unitaires, VL) est étiqueté comme tel à l'écran.

### Signature Freighter (dépôt et retrait)

1. `POST /session/deposit/prepare` avec `{ units }`, qui renvoie `{ txXdr }`.
2. Vérifier que Freighter est installé, sur Testnet, et que le compte actif est `config.accounts.fund`.
3. Faire signer le XDR par Freighter, avec la passphrase Testnet. Les noms exacts des fonctions dépendent de la version installée de `@stellar/freighter-api` (`isConnected`, accès / adresse, réseau, `signTransaction`) : lire sa documentation au moment du code.
4. `POST /session/submit` avec `{ signedTxXdr }`. L'entrée `chain` apparaît en `pending` dans le fil, puis en `confirmed`.

Prévoir un message clair pour chaque cas d'échec : extension absente, mauvais réseau, mauvais compte, signature refusée, transaction échouée. Si `config.signerMode` vaut `keeper`, appeler `POST /session/deposit` directement : c'est le repli prévu.

### Écrans et éléments attendus (structure à valider avec l'équipe)

- **Choix de l'actif** : KMMF (fonds monétaire tokenisé) ou KBOND (obligation souveraine tokenisée), tous deux fictifs, avec prix unitaire simulé et décote. Ne pas afficher de nom ni de logo Etherfuse sur KBOND.
- **Le swap** : notionnel, taux fixe, taux variable et sa source (BCE / cache / scénario), MTM du fonds.
- **La marge** : valeur exigée en euros, conversion en unités, MTA.
- **Le vault** : disponible / immobilisé / déficit. Statut `active`, `margin_call` (avec compte à rebours jusqu'à `callDeadline`) ou `defaulted`.
- **Actions du scénario** : démarrer la session, déposer, choc de taux (−50, −30, +60, −100 pb), retirer, déclencher le règlement du défaut (actif seulement après l'échéance).
- **Fil d'activité en direct (SSE)** avec preuves cliquables.
- **Soldes** du fonds et de la banque, pour voir le collatéral arriver chez la banque en cas de défaut.

### Tâches

#### F1 — Socle et directions visuelles (objectif GO + 55 min)

- Initialiser `app/` (Vite, React, TS, Tailwind, Motion), intégré aux workspaces npm.
- Proposer à Nathan **trois directions visuelles courtes** : palette, typographie, ambiance, une phrase de justification chacune, plus un écran statique d'exemple si c'est rapide. Inspiration : la sobriété d'Apple Wallet, Trade Republic et Robinhood, sans copier leurs écrans.
- **Ne pas avancer sur le style tant que l'équipe n'a pas choisi.**
- **Critère de réussite** : `npm run build` passe ; les trois directions sont présentées.

#### F2 — Écran principal sur mocks (objectif 23:00)

- Client API typé, mode mocks, connexion SSE (`EventSource`), tous les éléments ci-dessus avec les données des mocks, signature Freighter branchée (testable sur le keeper réel dès que K3 existe).
- **Critère de réussite** : le scénario 1 se joue entièrement sur les mocks, puis sur le keeper réel sans changer de code. C'est la contribution du front au jalon J1.

#### F3 — Parcours complet et finitions (objectif 01:30, puis 06:30–08:30)

- Scénario 2 (défaut) avec compte à rebours, transitions et animations, états de chargement et d'erreur, lisibilité pour un jury qui ne connaît pas les dérivés (une phrase d'explication par bloc).
- `docs/demo-script.md` avec le keeper : déroulé de la vidéo, minute par minute.
- **Critère de réussite** : les deux scénarios se jouent de bout en bout sur Testnet depuis le dashboard, sans console ouverte.

## 15. Risques et replis

Chaque repli a une heure de décision. Une fois cette heure passée, on bascule sans débat.

| Risque | Repli | Décision au plus tard |
| --- | --- | --- |
| La banque n'a pas de trustline sur l'actif, et `settle_default` échoue | Le bootstrap crée les trustlines de la banque pour KMMF et KBOND ; le script e2e teste le défaut | Dès J2 |
| Freighter absent, sur le mauvais réseau ou sur le mauvais compte pendant le tournage | Message clair dans le front ; mode `SIGNER=keeper` activable par variable d'environnement, sans changer de code | J2 (01:30) |
| Quotas des abonnements IA épuisés dans la nuit (compte ChatGPT Plus partagé) | Modèle le plus puissant réservé au contrat et aux revues renforcées ; routine sur un modèle plus léger ; petites corrections à la main | En continu |
| Quota d'un agent épuisé (cas de Codex sur les Mac, A9) | Un seul agent par machine ; revue par sous-agent Claude neuf ; Codex réservé au Windows | Fait (A9) |
| Le front attend le keeper | Le front avance sur les mocks de `packages/shared`, qui respectent la même interface | — |
| Parcours complet pas prêt | Réduction au noyau : dépôt, immobilisation, défaut. Retrait et libération passent en « prochaine étape » | 01:30 |
| RPC Testnet lent pendant le tournage | Nouvelles tentatives avec délai croissant ; prise de sécurité de la vidéo dès que le scénario 1 marche | Vers 02:00 |
| API BCE indisponible | Valeur en cache, affichée « cache » | — |
| Scripts qui marchent sur Mac mais pas sur Windows | Scripts en TypeScript exécutés par Node (`tsx`), aucun script bash | Dès l'écriture |
| Données du contrat archivées (TTL) | Stockage instance avec extension du TTL à chaque appel ; un vault neuf par session | Dès l'écriture |
| URL publique pas en ligne à temps | Hébergement tranché à J2 (A8), mise en ligne entre 06:30 et 08:30, vérifiée avant 10:30 | 01:30 |
| Dépôt encore privé à la soumission | Rendu public à 10:45, vérifié depuis un navigateur non connecté | 10:45 |
