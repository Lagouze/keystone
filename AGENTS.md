# AGENTS.md — Règles de travail des agents Keystone

Ce fichier s'applique à tous les agents (Claude Code sur les Mac, Codex sur le Windows) et à leurs opérateurs humains. Il fait foi pour la manière de travailler. Les interfaces font l'objet de `docs/interfaces.md`, les tâches de `docs/plan.md`.

## 1. Avant d'agir

À chaque nouvelle session, et avant chaque tâche, relis dans cet ordre :

1. ce fichier ;
2. `docs/interfaces.md`, dans sa version présente sur `staging` ;
3. la section de `docs/plan.md` qui concerne ton pôle ;
4. les Issues portant ton label et les PR ouvertes vers `staging` :
   ```bash
   gh issue list --label pole:<pôle>
   gh pr list --base staging
   ```

Ne te fie pas à une copie locale ancienne : fais `git fetch` et lis la version de `staging`.

Ne lis que les sections utiles à ta tâche. Ne relis jamais `docs/brief.md` en entier : `docs/plan.md`, `docs/interfaces.md` et `docs/decisions.md` font foi (décision A9).

## 2. Pôles et périmètres

| Pôle | Opérateur | Branche | Tu écris dans |
| --- | --- | --- | --- |
| `contract` | Liel (Windows, Codex) | `contract/collateral` | `contracts/`, `packages/vault-client/`, section Contrat du README |
| `keeper` | Grégoire (Mac, Claude Code) | `back/keeper` | `keeper/`, `scripts/`, `packages/shared/`, `deployments/`, `.env.example`, et les documents partagés en tant que coordinateur documentaire |
| `front` | Nathan (Mac, Claude Code) | `front/dashboard` | `app/`, section Front du README, `docs/demo-script.md` (avec le keeper) |

Pour modifier un fichier d'un autre pôle, ouvre une Issue ou propose la modification dans une PR que le pôle propriétaire relit.

**Coordinateur documentaire :** le pôle keeper. Il tient la cohérence entre `README.md`, `AGENTS.md` et `docs/interfaces.md`, et consolide les conflits sur ces fichiers. Chaque pôle reste responsable de documenter ses propres changements.

## 3. Interdits

- Écrire du code applicatif avant un message `GO` écrit par un humain dans l'Issue de kickoff. Publier `READY` n'autorise pas à coder.
- Committer directement sur `main` ou `staging`.
- Fusionner une PR. Ce sont les humains qui fusionnent.
- Écrire hors des dossiers de ton pôle sans accord du pôle propriétaire.
- Mettre un secret (clé Stellar `S...`, clé API, recovery phrase) dans un fichier versionné, un message GitHub ou un log collé dans une PR.
- Toute action sur Stellar Mainnet.
- Modifier une interface partagée hors de la procédure de la section 6.
- Déclarer « fonctionne » ce qui n'a pas été exécuté. Ce qui n'est pas vérifié s'écrit « non testé ».
- Modifier à la main les bindings générés de `packages/vault-client/` : on les régénère.

## 4. Messages GitHub

Les agents publient avec le compte GitHub de leur opérateur. Chaque message commence donc par :

- `[agent:contract]`, `[agent:keeper]` ou `[agent:front]` pour un agent ;
- `[human:<prénom>]` pour un humain.

**Labels :** `pole:contract`, `pole:keeper`, `pole:front`, `interface-change`, `blocked`, `needs-human`, `kickoff`.

**Commits :** préfixe du pôle, puis une phrase à l'impératif. Exemples : `contract: add settle_default`, `keeper: compute margin requirement`, `front: show activity feed`, `docs: update README progress`.

**Cadence de lecture :** GitHub ne réveille pas les agents. Un agent lit les Issues et PR qui le concernent au début de chaque tâche, avant d'ouvrir une PR, et à chaque relance par son opérateur.

## 5. Kickoff, READY, BLOCKED et GO

Le kickoff se déroule dans une seule Issue, labellisée `kickoff`. Chaque opérateur relance son agent au début de chaque tour.

1. **Tour 1 — présentation (10 min).** Publie, en 15 lignes maximum, au format ci-dessous.
2. **Tour 2 — questions (10 min).** Lis les deux autres présentations. Pose tes questions au pôle concerné. Vérifie la compatibilité des noms, types, unités et codes d'erreur entre ce que tu fournis et ce que les autres attendent. Propose les modifications de `docs/interfaces.md` sous forme de diff ou de phrase précise, sans éditer le fichier.
3. **Tour 3 — réponses (10 min).** Réponds aux questions qui te visent. Un désaccord persistant reçoit le label `needs-human`, et un humain tranche. L'agent keeper, seul, intègre les modifications acceptées dans `docs/interfaces.md` et `packages/shared/src/types.ts` sur la branche `docs/phase-zero`, passe la version à v1.0, pousse, puis publie le SHA du commit.
4. **Tour 4 — handshake (5 min).** Relis `docs/interfaces.md` à ce SHA. Publie `READY` ou `BLOCKED`. Si la spécification change ensuite, les trois `READY` sont à refaire sur le nouveau SHA.
5. **GO.** Les humains vérifient les trois `READY`, fusionnent la PR `docs/phase-zero` dans `staging`, mettent à jour les branches de pôle depuis `staging`, puis postent `GO`.

**Formats :**

```markdown
[agent:<pôle>] TOUR 1 — PRÉSENTATION (spec @ <sha court>)
Je réalise : …
Je fournis aux autres pôles : …
J'attends des autres pôles : …
Hors de mon périmètre : …
Points à confirmer ou risques : …
```

```markdown
[agent:<pôle>] TOUR 2 — QUESTIONS
→ <pôle> : Q1 …
→ <pôle> : Q2 …
Modification proposée de docs/interfaces.md : §…, … parce que …
```

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

```markdown
[human:<prénom>] GO — spec v1.0 @ <sha>, PR #<n> fusionnée dans staging.
Mettez à jour votre branche depuis staging, puis exécutez votre prompt de lancement.
```

Un `READY` sans SHA, ou publié avant le tour 4, ne compte pas.

## 6. Changement d'interface après le GO

1. Ouvre une Issue `interface-change` : ce qui change, pourquoi, compatible ou cassant, pôles consommateurs.
2. Ne modifie pas encore le code qui en dépend.
3. Le pôle consommateur répond `[agent:<pôle>] interface-change #<n> OK` ou propose autre chose. Un changement cassant demande aussi l'OK d'un humain.
4. La PR qui implémente le changement met à jour `docs/interfaces.md` (version incrémentée, ligne dans le changelog), `packages/shared/src/types.ts` et les mocks si besoin, et cite l'Issue.
5. Les autres pôles ne s'appuient sur la nouvelle version qu'une fois cette PR fusionnée.

Un ajout compatible (champ optionnel, nouvel événement) peut se faire directement dans la PR qui en a besoin, à condition d'y mentionner le pôle consommateur.

## 7. Revue des PR

Claudex n'est plus utilisé (décision A9). Chaque machine a un seul agent : Claude Code sur les Mac de Grégoire et de Nathan, Codex sur le Windows de Liel.

Chaque changement est revu avant d'ouvrir la PR par un **sous-agent Claude neuf**, lancé sur la machine de l'auteur. Ce sous-agent ne voit pas la conversation de l'agent auteur : il reçoit seulement la commande qui donne le diff (`git diff origin/staging...HEAD`), cette section et les sections utiles de `docs/interfaces.md`. L'auteur corrige ce qu'il relève et résume la revue dans la PR. L'intensité dépend du risque.

| Niveau | Concerne | Revue exigée |
| --- | --- | --- |
| Léger | Style, textes, animations, documentation seule | Un passage du sous-agent sur le diff, résumé d'une ligne dans la PR |
| Standard | Logique du keeper, API, état du front, scripts | Passage complet du sous-agent et tests du pôle verts |
| Renforcé | Contrat, calcul de marge, autorisations, toute modification d'interface | Passage du sous-agent avec la grille ci-dessous, correction par l'auteur, second passage par un nouveau sous-agent, tests négatifs, et un humain lit le diff du contrat |

**Grille de la revue renforcée :**

- Une fonction du contrat peut-elle faire sortir des tokens hors de `withdraw` et `settle_default` ?
- Chaque fonction qui modifie l'état appelle-t-elle le bon `require_auth` ?
- `available + locked` reste-t-il égal au solde du vault dans le SAC après chaque opération ?
- Les arrondis de conversion euros → unités vont-ils dans le sens prudent (au supérieur pour l'exigence) ?
- Les types envoyés correspondent-ils exactement à `docs/interfaces.md` ?
- Une entrée `chain` peut-elle s'afficher sans transaction confirmée ?

**Organisation des machines :**

- **Mac de Grégoire et de Nathan** : Claude Code écrit ; un sous-agent Claude neuf relit le diff.
- **Windows de Liel** : Codex écrit. Le Windows n'ayant pas Claude, la première relecture y est faite par une session Codex neuve, dans les mêmes conditions que le sous-agent (diff seul, sans la conversation de l'auteur).
- **PR du pôle contrat** : Liel relit lui-même le diff avec la grille renforcée, et Codex fait une passe de relecture en fin de tâche. Plus de relecture depuis le Mac de Grégoire.

## 8. Tests

| Pôle | Minimum avant PR |
| --- | --- |
| Contrat | `cargo test` vert (cas positifs et refus listés dans `docs/plan.md`), build avec `stellar contract build`, et pour un déploiement : hash de transaction Testnet collé dans la PR |
| Keeper | Vitest vert (modèle de marge avec valeurs de référence), typecheck, et `scripts/e2e-testnet.ts` dès qu'il existe |
| Front | typecheck et build sans erreur, parcours vérifié sur les mocks puis sur le keeper réel |

Après chaque fusion dans `staging`, la machine du keeper lance le script e2e. S'il échoue, sa réparation passe avant toute autre fusion.

## 9. Documentation

- Chaque PR vérifie le README et les documents liés. Si le comportement, une commande, un prérequis, une interface, un ID on-chain ou l'avancement change, la documentation est mise à jour **dans la même PR**. Sinon, la PR dit pourquoi rien n'est à changer.
- Une ligne du tableau d'avancement du README ne passe à « verified » qu'avec un lien de preuve : hash Testnet, sortie de test ou capture.
- Une commande n'apparaît dans le README sans la mention « not tested » qu'après avoir été exécutée avec succès.
- Le README est en anglais (lu par le jury). Les documents internes (`AGENTS.md`, `docs/decisions.md`, `docs/plan.md`) sont en français.

## 10. Pull requests

Une PR correspond à une tâche du plan, reste petite et vise `staging`. Elle suit le modèle `.github/pull_request_template.md`.

**Avant toute fusion, l'humain vérifie :**

- la revue au niveau requis (section 7), résumée dans la PR, et pour le contrat la revue renforcée faite par Liel avec la grille, plus la passe Codex de fin de tâche ;
- les tests lancés, avec leur résultat collé, ou la limite signalée ;
- le README, `AGENTS.md` et `docs/interfaces.md`, consultés et mis à jour si nécessaire ;
- l'impact sur les autres pôles, nul ou approuvé via `interface-change` ;
- l'absence de tout secret dans le diff.

## 11. Blocages et escalade

- Une question pour un autre pôle se pose dans une Issue (ou la PR concernée), avec le label du pôle.
- Un blocage se signale par une Issue `blocked`, qui décrit le problème, ce qui a été essayé et ce qu'il faudrait.
- Une décision qui dépasse un pôle (interface cassante, changement de périmètre, arbitrage de produit ou d'UX) reçoit le label `needs-human`. Les humains tranchent et consignent la décision dans `docs/decisions.md`.
