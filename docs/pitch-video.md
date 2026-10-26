# Keystone — Script de la vidéo de pitch (3 minutes)

> **Document de production, autonome.** Il est écrit pour être lu par l'équipe **et par un autre agent Claude** qui a accès au dépôt `https://github.com/Lagouze/keystone` (branche `main`). Il contient : le texte à dire, mot à mot et minuté ; les schémas animés à produire (décrits à la seconde près) ; le déroulé exact de la démo sur la vraie plateforme ; la préparation, le montage, les plans de secours.
>
> **Mise à jour (fin de vidéo) :** à partir de **1:25**, le minutage et le texte de `docs/pitch-handoff.md` §4 **remplacent** ceux de ce document, et une scène **S7 « accès jury »** est ajoutée (`docs/pitch-handoff.md` §5). Lire d'abord `docs/pitch-handoff.md`.
>
> Narration en **anglais** (jury HackMeridian international, README en anglais). Chaque bloc a une *ligne d'aide en français* pour que l'équipe sache ce qu'elle dit. Les instructions de production sont en français.

---

## 0. À lire d'abord (2 minutes)

### 0.1 Le temps
- La clôture officielle du hackathon est à **12:00 (heure de Lisbonne)** d'après `docs/plan.md` §10. **Vérifier l'heure exacte sur le portail de soumission.**
- Ce document a été écrit à **09:35**. Il reste environ **2 h 25**. Le plan de production du §9 tient en **1 h 30** avec 30 minutes de marge. **Ne rien ajouter qui le fasse déborder.**
- Priorité absolue : **une vidéo finie à 11:30 vaut mieux qu'une vidéo parfaite à 12:10.**

### 0.2 L'idée en une phrase
> *« Post tokens, not cash. »* Un fonds met en garantie des jetons qu'il détient déjà (fonds monétaire, obligation) au lieu de garder du cash inutilisé, et un coffre Soroban sur Stellar applique les règles de marge, d'appel et de défaut, sans que personne ne puisse bouger plus que prévu.

### 0.3 Le fil rouge de la vidéo
La landing du produit raconte déjà **Lock → Call → Settle**. La vidéo reprend exactement ce fil, en trois temps : *le problème* (0:00–0:50), *la solution* (0:50–1:25), *la démo* (1:25–2:50), puis une clôture (2:50–3:00). La démo joue **le scénario du défaut** (Lock → Call → Settle) parce qu'il montre les trois temps en 85 secondes et se termine sur le coup de théâtre : le coffre envoie le collatéral à la banque, **on-chain**.

### 0.4 Qui fait quoi
| Qui | Quoi |
| --- | --- |
| **Humain (Grégoire ou Nathan)** | Piloter la démo dans le navigateur (Freighter demande un mot de passe : **Claude ne doit jamais le saisir**), dire le texte, lancer l'enregistrement. |
| **Claude Code / autre agent** | Construire les schémas animés (§5), préparer la liste de contrôle, monter la vidéo (§8), ajouter le lien final au README. |
| **Interdits à l'agent** | Saisir un mot de passe ou une clé, signer ou envoyer une transaction sans « GO » écrit d'un humain, publier un secret, modifier `main` hors PR. |

---

## 1. Ce que le jury doit retenir (3 messages, dans cet ordre)

1. **Le problème est réel et coûteux** : du cash dormant pour couvrir des appels de marge.
2. **La solution est simple et vérifiable** : des règles dans un coffre Soroban, pas dans un classeur.
3. **Ça marche vraiment sur Stellar** : chaque étape est une transaction Testnet, avec son hash, visible sur stellar.expert.

Critères du hackathon à servir explicitement (`docs/decisions.md`, « Exigences officielles ») : utilisation **significative** de Stellar, MVP fonctionnel (pas une maquette), preuve on-chain, problème / utilisateur / valeur clairs.

---

## 2. Vue d'ensemble minutée

| Temps | Partie | À l'écran | Mots |
| --- | --- | --- | --- |
| 0:00 – 0:12 | **1 · Le problème** (accroche) | Schéma **S1** « L'appel de marge » | 33 |
| 0:12 – 0:30 | 1 · Le problème | Schéma **S2** « Cash dormant » | 34 |
| 0:30 – 0:50 | 1 · Le problème | Schéma **S3** « Des jetons enfermés dehors » | 36 |
| 0:50 – 1:25 | **2 · La solution** | Schéma **S4** « Comment Keystone fonctionne » (Lock → Call → Settle), puis **S5** « Pourquoi Stellar » | 85 |
| 1:25 – 2:50 | **3 · La démo** | **Le vrai produit**, enregistrement d'écran, annotations | 155 |
| 2:50 – 3:00 | Clôture | Schéma **S6** logo + adresse du site et du dépôt | 12 |
| | | **Total** | **≈ 355 mots** (≈ 118 mots/minute : confortable, avec des respirations) |

Facecam : visage en **coin bas-droit** (cercle ou rectangle arrondi, 18 % de la largeur), **sur toute la durée**, y compris pendant les schémas et la démo.

---

## 3. Le texte à dire (script complet)

> Règle d'or : **chaque phrase est calée sur une image**. Les repères `▶` indiquent l'instant exact où l'image doit changer. Si l'on parle un peu plus vite ou plus lentement, ajuster la **vitesse de lecture des schémas**, pas le texte.

### PARTIE 1 — Le problème (0:00 → 0:50)

**0:00 · S1 · accroche** (12 s)
> « Imagine you run a fund. You've swapped interest-rate risk with a bank — ten million euros, five years. ▶ Then rates move… and the bank calls: *post more collateral. Today.* »

*Aide FR : « Imaginez que vous gérez un fonds. Vous avez échangé votre risque de taux avec une banque : 10 millions d'euros, 5 ans. Puis les taux bougent, et la banque appelle : déposez plus de garantie, aujourd'hui. »*
`▶` sur « Then rates move » : la courbe de taux s'effondre. `▶` sur « calls » : l'étiquette **MARGIN CALL** apparaît côté banque.

**0:12 · S2 · cash dormant** (10 s)
> « To be ready, funds keep cash on the side. ▶ Cash that earns nothing. Cash that isn't invested. A quiet cost, every single day. »

*Aide FR : « Pour être prêts, les fonds gardent du cash de côté. Du cash qui ne rapporte rien, qui n'est pas investi. Un coût silencieux, chaque jour. »*
`▶` sur « Cash that earns nothing » : la tranche grise « cash de côté » pulse et son compteur reste à 0 € pendant que la partie investie monte.

**0:22 · S2 (suite)** (8 s)
> « And collateral is heavy: valuations, notices, custody, disputes. »

*Aide FR : « Et la garantie est lourde : valorisations, notifications, conservation, litiges. »*
Quatre pastilles apparaissent l'une après l'autre : *Valuations · Notices · Custody · Disputes*.

**0:30 · S3 · jetons enfermés dehors** (14 s)
> « Meanwhile, funds already hold tokenized money-market shares and bonds — assets that keep earning. ▶ But there's no simple, enforceable way to post them as collateral. »

*Aide FR : « Pendant ce temps, les fonds détiennent déjà des parts de fonds monétaires et des obligations tokenisées, qui continuent de rapporter. Mais il n'existe pas de moyen simple et applicable de les donner en garantie. »*
`▶` sur « But there's no… » : un mur en pointillés se dresse entre les jetons et le coffre de la banque, avec un « ? ».

**0:46 · transition** (4 s)
> « What if the rules lived in code? »

*Aide FR : « Et si les règles vivaient dans du code ? »*
Le mur se dissout. **Silence de 1 seconde.** Le logo Keystone se dessine (trait par trait).

### PARTIE 2 — Comment on le résout (0:50 → 1:25)

**0:50 · S4a · le logo** (4 s)
> « Meet Keystone. ▶ Post tokens, not cash. »

*Aide FR : « Voici Keystone. Des jetons, pas du cash. »*
`▶` : le slogan s'écrit sous le logo.

**0:54 · S4b · LOCK** (9 s)
> « The fund deposits tokens it already holds into a Soroban vault on Stellar. The vault locks only what the swap requires — nothing more. »

*Aide FR : « Le fonds dépose, dans un coffre Soroban sur Stellar, des jetons qu'il détient déjà. Le coffre bloque seulement ce que le swap exige. Rien de plus. »*
Des jetons volent du Fonds vers le Coffre ; la barre du coffre montre « Free » puis « Locked ».

**1:03 · S4c · CALL** (11 s)
> « A keeper reads the real Euribor, recomputes the exposure, and posts the requirement. If rates move against the fund, a margin call opens — with a ninety-second deadline. »

*Aide FR : « Un keeper lit le vrai Euribor, recalcule l'exposition et publie l'exigence. Si les taux jouent contre le fonds, un appel de marge s'ouvre, avec 90 secondes de délai. »*
Le keeper (ECB) envoie un chiffre au coffre ; la barre passe au rouge « Missing » ; un anneau de 90 s se met à tourner.

**1:14 · S4d · SETTLE** (8 s)
> « Not covered in time? The vault sends exactly the locked tokens to the bank. No admin. No one can move more. »

*Aide FR : « Pas couvert à temps ? Le coffre envoie exactement les jetons bloqués à la banque. Pas d'administrateur. Personne ne peut déplacer plus. »*
Les jetons bloqués volent du Coffre vers la Banque ; un cadenas se ferme sur le reste.

**1:22 · S5 · pourquoi Stellar** (3 s)
> « Seconds to finality. Fractions of a cent. Real transactions. »

*Aide FR : « Finalité en quelques secondes. Frais de l'ordre de la fraction de centime. De vraies transactions. »*
Trois pastilles : *Soroban smart contract · Stellar Asset Contracts · Freighter wallet*.

### PARTIE 3 — La démo (1:25 → 2:50)

> **C'est le vrai produit, en direct sur Stellar Testnet.** Les numéros D1…D7 correspondent aux plans du §6.

**1:25 · D1 · choisir la garantie** (11 s)
> « This is live on Stellar Testnet. First, the fund checks the market — real ECB and market data. Today, the bond looks better. We pick KBOND, and start. »

*Aide FR : « C'est en direct sur Stellar Testnet. D'abord, le fonds regarde le marché : vraies données BCE et marché. Aujourd'hui, l'obligation est préférable. On choisit KBOND et on démarre. »*

**1:36 · D2 · déploiement du coffre** (8 s)
> « A fresh vault is deployed on-chain. »

*Aide FR : « Un nouveau coffre est déployé sur la chaîne. »*

**1:44 · D3 · dépôt signé dans Freighter** (14 s)
> « The fund deposits fifty tokens. It signs in Freighter — only the fund can move its tokens. ▶ Confirmed. There's the hash. »

*Aide FR : « Le fonds dépose cinquante jetons. Il signe dans Freighter : seul le fonds peut bouger ses jetons. Confirmé. Voici le hash. »*

**1:58 · D4 · choc de taux et appel de marge** (16 s)
> « Now we move rates: minus one hundred basis points. ▶ The swap turns against the fund. The keeper posts the new requirement: about four hundred ninety tokens. The vault holds fifty. ▶ Margin call — ninety seconds on the clock. »

*Aide FR : « Maintenant on bouge les taux : moins 100 points de base. Le swap tourne contre le fonds. Le keeper publie la nouvelle exigence : environ 490 jetons. Le coffre en tient 50. Appel de marge, 90 secondes. »*

**2:14 · D5 · l'horloge tourne** (10 s, accéléré)
> « Nobody tops up. We let the clock run. »

*Aide FR : « Personne ne complète. On laisse tourner l'horloge. »*
Accéléré ×9 (90 s en 10 s). Le compte à rebours reste lisible. **Après la phrase : 2 secondes de silence avec un son discret.**

**2:24 · D6 · règlement** (14 s)
> « Deadline passed. Anyone can settle. ▶ And the vault does exactly what its rules say: fifty tokens, straight to the bank. »

*Aide FR : « Délai dépassé. N'importe qui peut régler. Et le coffre fait exactement ce que disent ses règles : cinquante jetons, directement à la banque. »*
`▶` sur « And the vault » : le geste de maintien « Hold to settle default » se termine (1,2 s) et l'animation du jeton traverse de « Vault » à « Bank ».

**2:38 · D7 · la preuve on-chain** (12 s)
> « And this is not a mock-up: every step is a Stellar transaction. Here is the settlement, on-chain. »

*Aide FR : « Et ce n'est pas une maquette : chaque étape est une transaction Stellar. Voici le règlement, sur la chaîne. »*

### Clôture (2:50 → 3:00)

**2:50 · S6** (10 s)
> « Keystone. Post tokens, not cash. Try it live — the code is public. »

*Aide FR : « Keystone. Des jetons, pas du cash. Essayez-le en ligne : le code est public. »*

---

## 4. Faits à vérifier avant d'enregistrer (ne pas dire ce qui n'est pas sûr)

| Affirmation dans le texte | Source | Statut |
| --- | --- | --- |
| Swap de 10 M€ sur 5 ans | Fenêtre *Details* du produit (`Swap €10,000,000 · 5 years`) | **Vérifié** dans le code |
| Délai de grâce de 90 secondes | `docs/interfaces.md`, README §1 | **Vérifié** |
| Le coffre envoie « exactement les jetons bloqués », « pas d'admin » | README §5 (« no admin, no upgrade function »), `docs/interfaces.md` §3 | **Vérifié** |
| Le keeper lit le vrai Euribor (BCE) | README §3, `keeper/src/euribor.ts` | **Vérifié** |
| Données de marché réelles dans le comparateur | `GET /api/market-advisor` (5 sources en direct) | **Vérifié** le 26/10 |
| « Seconds to finality », « fractions of a cent » | Connaissance générale sur Stellar | **À vérifier / adoucir** : si un doute, dire « fast and cheap ». |
| Ordre de grandeur « about four hundred ninety tokens » | Le produit affiche `491.39` (exigence) et `441.39 KBOND missing` (manque) pour −100 bp et 50 déposés | **Vérifié** (README §6, scénario 2) ; **relire la valeur à l'écran avant de la dire** |
| « Cinquante jetons à la banque » | Animation du jeton « 50 KBOND » ; README §6 | **Vérifié** |

> Ne pas citer d'entreprises ni de chiffres de marché non présents dans le dépôt, sauf vérification faite.

---

## 5. Schémas animés (S1 à S6) — cahier des charges

> **Déjà construits et vérifiés dans un navigateur** (les six scènes jouent, rien ne chevauche la zone de la facecam). L'agent de montage doit les **enregistrer tels quels** ; il peut les améliorer, mais **sans changer leur durée ni leurs repères temporels**, qui sont calés sur la voix. Les chiffres du compteur de S2 sont **illustratifs** (étiquette « Illustrative figures » affichée).

**Un fichier fourni :** `docs/pitch/scenes.html` (s'il est présent dans le dépôt, c'est la **base à améliorer**, pas à refaire). Il se lance en ouvrant le fichier dans un navigateur :

- `scenes.html?scene=1` … `?scene=6` : une scène seule, qui joue sa propre animation (`&nofade` : sans le fondu au noir final de S6, pour une capture d'image fixe) ;
- `scenes.html?auto` : joue **S1 → S2 → S3** en continu (0:00 → 0:50), puis s'arrête sur un écran vide ; `?auto=2` joue **S4 → S5** (0:50 → 1:25) ; `?scene=6` pour la clôture ;
- touches : **Espace** ou **→** scène suivante, **R** redémarre la scène, **F** plein écran.

**Cahier des charges commun**
- Format **1920 × 1080**, fond clair type « aura » du produit : `#eef0f5` avec trois taches floues lentes (lavande, menthe, bleu très pâle). Cohérent avec l'interface (« Liquid Glass »).
- Police **Helvetica Neue** (repli Arial). Texte encre `#1c1c1e`, secondaire `#48484d`.
- Couleurs de sens, **identiques au produit** : **bleu on-chain** `#0a5cc2`, **rouge appel/défaut** `#a92b21`, **vert libération/gain** `#1a7a37`, gris simulation `#55555a`.
- Cartes en « verre » : fond blanc 30–45 %, coins très arrondis (32 px), ombre diffuse. Pas de bordures dures.
- **Peu de texte** : un titre court par scène (≤ 8 mots), des étiquettes de 1 à 3 mots. Le jury **écoute**, il ne lit pas.
- Mouvements : ressorts doux (`cubic-bezier(0.16, 1, 0.3, 1)`), 0,5 à 0,8 s, une seule animation « forte » à la fois. **Laisser la place à la facecam en bas à droite (≈ 18 % de la largeur) : ne rien y mettre d'important.**
- Aucune dépendance externe (fonctionne hors ligne, enregistrable tel quel).

### S1 · « L'appel de marge » (0:00 → 0:12)
- **Titre** (haut, apparaît à 0:00) : *A fund. A bank. A €10M swap.*
- **Composition** : à gauche une carte verre **FUND**, à droite une carte **BANK**. Entre elles, deux flèches opposées : vers la banque « pays fixed rate », vers le fonds « pays Euribor 3M ». Sous les flèches, la mention *€10M · 5 years*.
- **0:00 → 0:05** : les cartes entrent (glissement + léger flou qui se dissipe), les flèches se dessinent.
- **0:05 → 0:08** : une **courbe de taux** (ligne fine encre) se trace au centre bas puis **chute** de 2,6 % à 1,6 %, avec l'étiquette **−100 bp**. La carte FUND vire légèrement au rouge.
- **0:08 → 0:12** : à droite, une pastille **rouge « MARGIN CALL »** apparaît sur la carte BANK avec une onde concentrique (une seule, 1 s). Sous-titre : *« Post more collateral. Today. »*

### S2 · « Cash dormant » (0:12 → 0:30)
- **Titre** : *Cash set aside = cash not invested.*
- **Composition** : une **barre horizontale** large (le portefeuille du fonds) : à gauche une grande part **verte** « Invested », à droite une part **grise hachurée** « Cash set aside for margin calls ».
- **0:12 → 0:16** : la barre se remplit de gauche à droite.
- **0:16 → 0:22** : au-dessus de la part verte, un compteur **« + € yield »** monte en continu (animation de nombres). Au-dessus de la part grise, un compteur **« € earned » reste à 0** et la part grise **pulse** doucement.
- **0:22 → 0:30** : quatre pastilles verre apparaissent sous la barre, l'une après l'autre (toutes les 1,5 s) : **Valuations · Notices · Custody · Disputes**.

### S3 · « Des jetons enfermés dehors » (0:30 → 0:50)
- **Titre** : *The assets are on-chain. The rules are not.*
- **Composition** : à gauche, deux **puces de jetons** brillantes : **KMMF** (« tokenized money-market fund ») et **KBOND** (« tokenized sovereign bond »), avec de petites étincelles vertes « earning yield ». À droite, un **coffre de la banque** (carte verre avec cadenas). Entre eux, un **mur en pointillés** avec un grand **« ? »**.
- **0:30 → 0:38** : les puces entrent, les étincelles montent ; les puces essaient d'aller vers le coffre et **rebondissent** sur le mur (2 essais).
- **0:38 → 0:46** : sous-titre *« No simple, enforceable way to post them. »*
- **0:46 → 0:50** : le mur **se dissout** en particules (rapide), le fond s'éclaircit. **Silence 1 s.**

### S4 · « Comment Keystone fonctionne » (0:50 → 1:22)
- **0:50 → 0:54, logo** : le logo Keystone (voir `app/src/ui/Logo.tsx`, tracé SVG : une arche en deux lignes, une clé de voûte à facettes) se **dessine trait par trait** (stroke-dashoffset), puis le mot **KEYSTONE** en capitales espacées, puis *Post tokens, not cash.* s'écrit dessous.
- **Composition** (apparaît après le logo, qui remonte en petit en haut à gauche) : quatre éléments en ligne : **FUND** (icône Freighter simplifiée) → **VAULT** (carte centrale large, la vedette, étiquette *Soroban · Stellar Testnet*) ← **KEEPER** (au-dessus, avec sous-étiquette *ECB Euribor*) ; **BANK** à droite. Un fil de légende en bas : **LOCK · CALL · SETTLE** (trois points, le point actif est plein, comme dans la landing du produit).
- **0:54 → 1:03, LOCK** : 6 petits jetons partent de FUND vers VAULT. Dans VAULT, une **barre** à trois segments : *Free* (gris), *Locked* (bleu on-chain). La part « Locked » s'élargit puis s'arrête. Étiquette : *locks only what the swap requires*.
- **1:03 → 1:14, CALL** : KEEPER envoie un chiffre à VAULT (« requirement ↑ »). La barre gagne un segment **rouge « Missing »**. Un **anneau de 90 secondes** se dessine autour de l'icône horloge, avec *90 s*. Étiquette : *margin call*.
- **1:14 → 1:22, SETTLE** : l'anneau se termine ; les jetons *Locked* quittent VAULT vers BANK en arc (700 ms, ressort), une étiquette *« exactly what was locked »*. Les jetons restants (« Free ») **restent**. Un cadenas se ferme sur VAULT : *no admin key*.

### S5 · « Pourquoi Stellar » (1:22 → 1:25)
- Trois pastilles verre qui montent en cascade (150 ms d'écart) sur le bas de l'écran : **Soroban smart contract** · **Stellar Asset Contracts (KMMF, KBOND)** · **Freighter wallet**. Sous-titre : *Real transactions on Stellar Testnet.* Reste à l'écran jusqu'à 1:25, puis fondu vers la démo.

### S6 · Clôture (2:50 → 3:00)
- Fond identique. Le **logo** au centre, **KEYSTONE** en dessous, puis *Post tokens, not cash.*
- En bas, en deux lignes bien lisibles : **keystone-eta-ebon.vercel.app** et **github.com/Lagouze/keystone**. Étiquette discrète : *Live on Stellar Testnet · open source*.
- Optionnel : un **QR code** vers le site (générer avec n'importe quel outil local, ne rien envoyer en ligne).
- Dernière image tenue **2 s** puis fondu au noir.

---

## 6. La démo, plan par plan (le vrai produit)

### 6.1 Avant de commencer — liste de contrôle (10 minutes, **obligatoire**)

Tout se vérifie **sans transaction**.

1. **Le choix de la pile** (décider une fois pour toutes) :
   - **Plan A — site public** `https://keystone-eta-ebon.vercel.app` + keeper Render. Il faut le **code d'accès** de l'équipe et **Freighter** (réseau **Testnet**, compte actif `GDQ6AW…MQOY`). **Le Freighter depuis le site hébergé n'a pas encore été testé** : faire **une répétition complète avant de filmer** (« GO essai Freighter »).
   - **Plan B — en local** (déjà éprouvé) : `npm run keeper` puis `npm run dev -w @keystone/app`, sur le **même Mac**, avec le `.env` du dépôt (README §9, ligne « The real setup »). Ouvrir `http://localhost:5173`. C'est la solution de repli si le Plan A pose problème.
   - Règle : **ne montrer à l'écran que ce qui a été vérifié à la répétition.**
2. Keeper éveillé : `curl -s https://keystone-keeper.onrender.com/api/health` doit répondre `{"ok":true,"network":"testnet"}` (la première réponse après une veille peut prendre une minute). Dans Render : **Settings → Build & Deploy → Auto-Deploy : No** pendant la prise.
3. Le keeper n'a **aucune session** en cours (`curl -s …/api/session` → `NoSession`) : la page d'accueil s'affichera. Si une session est en cours, relancer le service (Render → Manual Deploy → Restart).
4. **Soldes** : le fonds doit avoir au moins ~100 KBOND (il en avait 650 après les tests). Vérifier sur `https://stellar.expert/explorer/testnet/account/GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY`. Chaque prise consomme **50 KBOND** (envoyés à la banque).
5. **Freighter** déverrouillé, réseau Testnet, compte `GDQ6AW…MQOY` actif.
6. **Navigateur** : fenêtre propre, plein écran, **zoom 100 %**, barre de favoris masquée, **aucun onglet personnel**, notifications coupées (mode « Ne pas déranger » macOS). Un second onglet **stellar.expert** déjà connecté pour le plan D7 (ou le lien du hash dans le fil d'activité).
7. Un compte local est connecté sur le site (écran de verrouillage passé). **Créer ce compte avant**, il persiste dans le navigateur.
8. Faire **une prise de répétition complète** (§6.2), sans enregistrer, pour vérifier les durées réelles.

### 6.2 Les plans, avec ce qui s'affiche à l'écran (textes exacts du produit)

| # | Temps | Action humaine | Ce que l'écran doit montrer | Notes de tournage |
| --- | --- | --- | --- | --- |
| **D1** | 1:25 → 1:36 | Être déjà sur l'écran **« What will the fund post? »** (utiliser le bouton « Skip to start ↓ » de la landing). Cliquer **Compare market conditions**. Laisser 4 s la fenêtre *Collateral Market Advisor* (cinq indicateurs, avis « KBOND potentially preferable »). Fermer (**Back to manual selection**). Cliquer **KBOND**. Cliquer **Start**. | Titre *What will the fund post?*, sélecteur KMMF/KBOND, ligne *« … · €1,000.00 (simulated) · haircut 2.00% »*, la fenêtre du comparateur, puis le bouton **Start** qui passe à *« Deploying the vault… »* | Le comparateur affiche aujourd'hui KBOND ; **vérifier l'avis du jour**. Si l'avis change, adapter la phrase (« Today, the bond looks better »). |
| **D2** | 1:36 → 1:44 | Attendre. | Indicateur *« Deploying the vault »* (animation du registre). 10 à 30 s en réel → **couper** (saut) à l'arrivée du tableau de bord : cartes qui entrent l'une après l'autre, titre **No margin required**, *« Deposit collateral, then move rates. »* | Couper l'attente au montage. |
| **D3** | 1:44 → 1:58 | Panneau **Controls**, onglet **Deposit** : champ à **50** (le champ affiche **300** par défaut : le **remplacer** par `50`). Cliquer **Deposit**. Dans la fenêtre **Freighter**, vérifier le réseau et la fonction `deposit`, puis **Sign**. | Les étapes **Prepare → Sign → Submit → Confirmed**, le texte *« Confirm in Freighter… »* (scintillant), puis le **fil Activity** : une ligne **On-chain** *« Deposit of 50 KBOND »* avec le hash qui se « déchiffre », puis **Vault · KBOND : Free 50**. | **Zoomer en montage sur la fenêtre Freighter** (c'est une fenêtre séparée : capturer **tout l'écran**). Couper l'attente de confirmation (5 à 15 s). **Ne jamais filmer la saisie du mot de passe Freighter** : déverrouiller avant. |
| **D4** | 1:58 → 2:14 | Cliquer la tuile **−100 bp** (carte *Controls*, ligne *« Move rates · simulated Euribor shock »*). | Le point de passage est **séquencé** par le produit : étiquette **MARGIN CALL** (clignotement de lettres), carte teintée, halo, titre **« 441.39 KBOND missing »**, texte *« Cover before HH:MM:SS UTC, or the 50 locked KBOND go to the bank. »*, **compte à rebours** (≈ 1:30), carte **Market** : **Fund P&L** en rouge (courbe), **Euribor 3M** avec *« −100 bp vs fixed »*. Bouton **Deposit 441.3927 KBOND** et **Settle after deadline** (grisé). | La séquence dure ~1,6 s après la confirmation : laisser respirer. **Pointer** (halo, curseur) le chiffre *missing*. |
| **D5** | 2:14 → 2:24 | **Ne rien faire.** | Le **compte à rebours** descend jusqu'à zéro. | **Accélérer ×9** au montage (90 s → 10 s), en gardant le chiffre lisible. Ajouter l'étiquette *« Time-lapse ×9 »*. |
| **D6** | 2:24 → 2:38 | Quand le compte à rebours atteint **0:00**, attendre **3 à 5 s** (le temps du registre), puis **maintenir** le bouton **Hold to settle default** (1,2 s, jauge qui se remplit). | Le bouton passe à *« Settling… »*, puis l'animation : le jeton **« 50 KBOND »** traverse **Vault → Bank** (700 ms), la carte devient **rouge**, titre **« Collateral sent to the bank »**, *« The bank now holds … KBOND. Enforced by the vault. »* | ⚠ Le solde de la banque **inclut les démonstrations précédentes** (par exemple 350) : **ne pas lire ce chiffre**, dire « fifty tokens ». Si le bouton répond *GracePeriodRunning*, attendre 3 s et recommencer (le temps du registre n'est pas celui du navigateur). |
| **D7** | 2:38 → 2:50 | Dans **Activity**, cliquer le hash de la ligne **« Default settled… »** (↗). | **stellar.expert** s'ouvre sur la transaction : *Success*, appel de contrat `settle_default`, événement `defaulted`, le contrat du coffre. | Préférer **ouvrir l'onglet à l'avance** sur ce hash lors de la répétition ; au montage, zoomer sur *« Success »* et le nom de la fonction. |

> **Si on veut montrer la libération (optionnel, pas dans les 3 minutes)** : dépôt de 100 KMMF → −50 bp → −30 bp (appel) → dépôt de 100 → « cured » → +60 bp → libération. C'est le **scénario 1** de la section 6 du README : à garder pour une version longue, **pas dans cette vidéo**.

### 6.3 Annotations à ajouter au montage (petites pastilles verre, 2 s chacune)
- D1 : *« Real ECB & market data »*
- D2 : *« Soroban vault · deployed on Stellar Testnet »*
- D3 : *« Signed in Freighter »* puis *« On-chain · real transaction »* (au moment du hash)
- D4 : *« Rates −100 bp »* puis *« Margin call · 90 s »*
- D5 : *« Time-lapse ×9 »*
- D6 : *« No admin · exactly the locked tokens »*
- D7 : *« stellar.expert · Testnet »*

---

## 7. Son, voix, image

- **Voix** : énergique, posée, **sans réciter**. Pauses courtes à chaque `▶`. Sourire sur l'accroche et sur la clôture. Enregistrer **par partie** (3 fichiers) pour pouvoir refaire un passage.
- **Musique** : un fond **instrumental discret** (électro doux ou piano rythmé), niveau **−24 dB** sous la voix, **sans droits** (bibliothèque libre ou musique générée par l'outil de montage). **Ne pas utiliser de morceau protégé.** Baisser à −32 dB pendant la démo.
- **Sons d'accompagnement** (très discrets, optionnels) : un « clic » sec sur les boutons, un souffle sur le compte à rebours accéléré, un son sourd quand le jeton arrive à la banque.
- **Facecam** : bas-droite, **18 % de la largeur**, coins arrondis, léger liseré blanc ; lumière de face, fond simple. Regarder l'objectif sur l'accroche et la clôture.
- **Sous-titres anglais** incrustés (grands, bas de l'écran, **au-dessus** de la facecam) : utile si le jury regarde sans le son.

---

## 8. Montage (pour l'agent qui monte la vidéo)

**Entrées** (dans un dossier `pitch-media/`, à ne jamais committer) :
1. `slides_part1.mov` : enregistrement d'écran de `scenes.html?auto` (0:00 → 0:50).
2. `slides_part2.mov` : `scenes.html?auto=2` (0:50 → 1:25).
3. `demo_raw.mov` : la prise de démo complète, en **temps réel**, plein écran (inclut Freighter et stellar.expert).
4. `slides_close.mov` : `scenes.html?scene=6`.
5. `face_voice.mov` : facecam **et voix**, enregistrée **en regardant le montage muet** pour caler la parole (méthode recommandée).
6. `music.mp3` : musique libre de droits.

**Chronologie cible** (1920×1080, 30 i/s, durée totale **≤ 3:00 exactement**) :

| Début | Fin | Source | Traitement |
| --- | --- | --- | --- |
| 0:00 | 0:50 | `slides_part1` | plein cadre |
| 0:50 | 1:25 | `slides_part2` | plein cadre |
| 1:25 | 1:36 | `demo_raw` (D1) | plein cadre, zoom léger sur le comparateur |
| 1:36 | 1:44 | `demo_raw` (D2) | **saut** sur l'attente du déploiement |
| 1:44 | 1:58 | `demo_raw` (D3) | **zoom** sur Freighter, saut sur l'attente |
| 1:58 | 2:14 | `demo_raw` (D4) | plein cadre, halo sur *missing* |
| 2:14 | 2:24 | `demo_raw` (D5) | **accéléré ×9** |
| 2:24 | 2:38 | `demo_raw` (D6) | plein cadre, ralenti ×0,6 sur le trajet du jeton |
| 2:38 | 2:50 | `demo_raw` (D7) | zoom sur *Success* / `settle_default` |
| 2:50 | 3:00 | `slides_close` | fondu enchaîné, fondu au noir final |

**Calque facecam** : `face_voice` en bas-droite sur **toute** la durée, masque arrondi. **Voix** : piste de `face_voice`. **Musique** : −24 dB, −32 dB pendant la démo. **Annotations** : voir §6.3. **Sous-titres** : généré depuis le texte du §3.

**Exports** : `keystone-pitch.mp4`, H.264, 1920×1080, 30 i/s, AAC 192 kb/s, **moins de 100 Mo**. Si un outil en ligne de commande est utilisé : `ffmpeg` convient pour les sauts, accélérations (`setpts=PTS/9`), incrustation (`overlay`) et le mixage.

**Contrôle qualité avant export** : durée ≤ 3:00 ; la voix suit chaque image ; aucune donnée personnelle ni mot de passe visible ; **aucun onglet privé**, aucun e-mail visible ; la facecam ne masque rien d'important ; l'adresse du site et du dépôt sont lisibles à la fin.

---

## 9. Plan de production (≈ 1 h 30)

| Durée | Étape | Qui |
| --- | --- | --- |
| 0:00 – 0:10 | Lire ce document ; choisir **Plan A ou B** ; liste de contrôle du §6.1 | Humain |
| 0:00 – 0:25 | Améliorer / valider `scenes.html` (§5) et l'enregistrer en 4 clips | **Agent** |
| 0:10 – 0:30 | **Répétition complète** de la démo (§6.2), sans enregistrer. Corriger les durées | Humain |
| 0:30 – 0:45 | **Prise de démo** `demo_raw` (temps réel). Faire 2 prises, garder la meilleure | Humain |
| 0:45 – 1:05 | Montage **muet** de la chronologie du §8 | **Agent** |
| 1:05 – 1:20 | Enregistrement **facecam + voix** en regardant le montage muet | Humain |
| 1:20 – 1:35 | Mixage, sous-titres, export | **Agent** |
| 1:35 – 1:45 | Mise en ligne (YouTube « non répertoriée » ou Loom) ; **ajouter le lien au README** (section 4, ligne *Demo video*) par PR ; soumission sur le portail | Humain + agent |
| 1:45 – 2:25 | **Marge de sécurité** | — |

**Si l'on a moins de 90 minutes** (méthode rapide) : ne pas faire de schémas animés séparés ; utiliser les **sections de la landing** du produit comme images de la partie 1 et 2 (hero « Post tokens, not cash. » avec les mots *Lock / Call / Settle*, la frise « Here is what a margin call looks like on Stellar. », « How it works »), défilées à la souris, avec la même voix. La démo (partie 3) reste la même.

---

## 10. Plans de secours

| Problème | Réponse |
| --- | --- |
| Le keeper hébergé dort ou répond lentement | Dans le §6.1, étape 2 ; sinon **Plan B local**. |
| Freighter refuse (mauvais réseau / compte) | Message du produit : *« Freighter is not on Testnet »* ou *« not the demo fund account »* : corriger dans Freighter. Ne **pas** signer deux fois après un délai : attendre jusqu'à 3 minutes l'état du fil d'activité. |
| La prise de démo échoue au milieu | Ne pas chercher à « rattraper » : **nouvelle session** (bouton *New session*) et reprendre à D1. Le fond de 650 KBOND permet plusieurs prises à 50. |
| Le délai de 90 s se termine mais *Hold to settle* est refusé | Attendre 3 à 5 s (temps du registre) puis recommencer. |
| Plus de KBOND dans le fonds | Relancer `npm run bootstrap` **sur la machine de Grégoire** (il réémet jusqu'à 1 000 jetons, README §9). |
| Un doute sur l'état réel de la plateforme | Utiliser le **mode démo simulé** (`/?demo`) **en le disant à l'écran** : l'étiquette « Demo data · nothing sent to Stellar » est visible. Dans ce cas la phrase D7 doit être remplacée par : *« And here are the real transactions we ran earlier. »*, en montrant le hash du README §6. |

---

## 11. Ce que le jury doit voir de ses yeux (check-list d'impact)

- [ ] Le slogan **Post tokens, not cash.** (S4a, S6, et la landing en arrière-plan)
- [ ] Le **chiffre du manque** (« 441.39 KBOND missing ») et le **compte à rebours**
- [ ] La **fenêtre Freighter** (le vrai portefeuille)
- [ ] Le **hash** qui se déchiffre, avec le lien ↗
- [ ] Le **jeton qui traverse** Vault → Bank
- [ ] La page **stellar.expert** avec `settle_default` et *Success*
- [ ] L'adresse du **site public** et du **dépôt** à la fin

---

## 12. Annexe — textes exacts du produit (pour ne pas se tromper à l'écran)

Landing : `Post tokens, not cash.` · `Lock / Call / Settle` · `Margin calls, covered by the assets a fund already holds. On Stellar.` · bouton `Skip to start ↓` · `Here is what a margin call looks like on Stellar.` · `How it works` (Choose the collateral · Deposit · Move the rates · Cover or settle) · `Choose the collateral` / `What will the fund post?` / `Fictitious tokens, issued on Stellar Testnet.` · `Compare market conditions` · `Start` / `Deploying the vault…`.

Tableau de bord : en-tête `Stellar Testnet` + `Keeper connected` · cartes **Status**, **Vault · KBOND** (`Free` `Locked` `Missing`, `Fund`, `Bank owes the fund` ou `Bank received`), **Controls** (`Move rates · simulated Euribor shock`, tuiles `−50 bp` `−30 bp` `+60 bp` `−100 bp`, `Deposit` / `Withdraw`, `Signed in Freighter.`), **Market** (`Fund P&L`, `Euribor 3M`, `Cash kept invested`), **Activity** (`On-chain` / `Sim` / `Demo tx`).

États : `No margin required` → `MARGIN CALL` (`… KBOND missing`, `Cover before … UTC, or the … locked KBOND go to the bank.`) → bouton `Hold to settle default` (`Settling…`) → `Collateral sent to the bank` / `DEFAULTED`.

Boutons de la barre du haut : `Market` (le comparateur reste accessible en cours de session) · `Details` · `New session`.

---

## 13. Pour l'autre agent Claude (démarrage rapide)

1. Cloner `https://github.com/Lagouze/keystone` (public) et lire, dans cet ordre : `README.md` §4 (Live demo), §6 (preuves), §10 (démo) ; `docs/pitch-video.md` (ce fichier) ; `app/src/dashboard/Landing.tsx`, `StatusCard.tsx`, `VaultCard.tsx`, `ActionsCard.tsx`, `MarketCard.tsx`, `ActivityFeed.tsx` pour les textes et durées exacts.
2. Construire / valider `docs/pitch/scenes.html` (§5), l'enregistrer en 4 clips.
3. Après la prise de démo, produire le montage du §8.
4. **Ne jamais** envoyer de transaction, saisir un mot de passe ou une clé, ni publier un secret. Toute action sur Stellar se fait par l'humain.
5. À la fin, ouvrir une PR vers `staging` qui remplace *« link added at submission »* par le lien de la vidéo dans `README.md` §4, puis la PR `staging → main` (règle du dépôt).
