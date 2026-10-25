# KEYSTONE — Brief complet actualisé pour Claude

**HackMeridian 2026 · Lisbonne · 25 octobre 2026**  
**Nature du document :** transfert de contexte, décisions collectives et contraintes pour préparer **ultérieurement** un plan de développement.  
**Équipe :** Liel, Grégoire et Nathan.  
**Statut :** brainstorming terminé ; plan directeur validé ; **aucun ordre de coder n'est donné par ce document**.  
**Mise à jour du 25 octobre, 19:45 :** l'obligation tokenisée du MVP est `KBOND` (voir l'encadré ci-dessous). Cette mise à jour prévaut sur toute mention contraire dans la suite du document.  
**Document de départ :** `KEYSTONE_BRIEF_COMPLET_POUR_CLAUDE.md`, complété et corrigé par les décisions d'équipe du 25 octobre 2026.

> **INSTRUCTION PRIORITAIRE À CLAUDE**  
> Ce brief est une **source de vérité sur ce que l'équipe a effectivement décidé**, pas une architecture technique définitive. Conserve les décisions explicites, ne convertis pas les exemples et suggestions passés en exigences obligatoires, distingue systématiquement **validé / à vérifier / à proposer**. L'objectif est de proposer ensuite un plan de construction **pragmatique, coordonné et réalisable** pour un MVP qui fonctionne sur Stellar Testnet. Ne commence ni code, ni modification du dépôt, ni déploiement sans demande explicite distincte.

> **MISE À JOUR DU 25 OCTOBRE, 19:45 — ETHERFUSE ABANDONNÉ, DEUX ACTIFS FICTIFS ÉMIS PAR L'ÉQUIPE**
>
> **Test réalisé** par Grégoire dans la sandbox Etherfuse (API v2) :
>
> - compte sandbox validé ;
> - wallet Stellar Testnet enregistré ;
> - compte bancaire fictif ajouté ;
> - ordre « Buy CETES » de 500 MXN créé, puis financé avec « Simulate Fiat Received » vers 18:57.
>
> L'ordre est resté bloqué en « Processing ». Aucune livraison et aucune claimable balance ne sont apparues sur Stellar Testnet.
>
> **Réponse de l'équipe Etherfuse** sur le groupe de support du hackathon : cette livraison fait partie des fonctionnalités encore incomplètes de la nouvelle API v2. Elle devrait fonctionner d'ici la fin de journée du 26 octobre, donc après la deadline de soumission (26 octobre, 12:00).
>
> **Décision :** Keystone garde ses deux classes d'actifs, toutes deux **fictives** et émises par l'équipe sur Stellar Testnet, en EUR :
>
> - `KMMF` : parts d'un fonds monétaire tokenisé ;
> - `KBOND` : obligation souveraine tokenisée (pas de décote de change).
>
> **Etherfuse est abandonné pour ce hackathon**, et n'est plus une piste P1. La tentative sera mentionnée honnêtement dans le README, sans la présenter comme réussie. Le vault reste agnostique de l'actif : un vrai actif tokenisé pourrait un jour remplacer `KBOND` sans modifier le contrat, mais ce n'est pas un objectif du hackathon.

---

## 0. Synthèse de la version actuelle — à lire en premier

**Keystone** est un **moteur de gestion programmable du collatéral pour une exposition sur un swap de taux d'intérêt OTC**, entre un fonds et une banque. Les deux parties sont supposées avoir **déjà signé** leur swap et un accord de collatéral **CSA (Credit Support Annex)** ; notre démonstration part de ce cadre contractuel simulé, sans bâtir un système de contractualisation.

**Intérêt économique central :** plutôt que d'immobiliser une part importante de ses ressources sous forme de cash disponible pour les appels de marge — argent qui, lorsqu'il est réservé à cet usage, n'est pas placé dans d'autres investissements —, un fonds pourrait **mobiliser comme garantie des actifs tokenisés qu'il détient déjà**, tels que des parts de fonds monétaires ou des obligations souveraines. Dans un cadre contractuel qui le permet, ces actifs **conservent leur exposition économique et peuvent continuer à produire les revenus ou variations de valeur attachés au sous-jacent**, même lorsqu'ils sont immobilisés comme collatéral. Keystone vise à rendre cette mobilisation opérationnelle et traçable, **sans promettre de rendement, de suppression totale du cash ni de gain garanti**. Dans notre démonstration, ces revenus et performances éventuels restent **simulés**.

Pour notre **MVP**, l'utilisateur choisit **manuellement UNE des deux catégories d'actifs admissibles** :

1. **KMMF** : des parts **fictives** d'un fonds monétaire tokenisé, créées par notre équipe sur **Stellar Testnet** ;
2. **KBOND** : obligation souveraine tokenisée **fictive**, émise par l'équipe sur **Stellar Testnet**. Elle remplace les Stablebonds Etherfuse, abandonnés car la sandbox v2 ne livre pas sur Stellar Testnet avant la deadline (voir l'encadré de mise à jour).

Keystone démontre le cycle **dépôt autorisé → collatéral disponible / immobilisé → mise à jour de l'exposition et calcul de marge → immobilisation ou libération → défaut simulé répondant à des règles simplifiées → transfert direct du collatéral concerné à la banque**, avec **transactions réellement exécutées et vérifiables sur Stellar Testnet**.

La valeur du MVP **n'est pas** un solveur d'optimisation financière sophistiqué. Elle est dans **l'orchestration fiable d'un même processus de collatéral pour deux types d'actifs**, les règles Soroban et une démonstration compréhensible de bout en bout.

L'interface doit être **premium, épurée, fluide, interactive et pédagogique**, inspirée de l'ADN UX d'Apple, Apple Wallet, Trade Republic et Robinhood, sans copier leurs fonctionnalités. Les **grands choix UI/UX seront décidés progressivement à trois**.

**Organisation validée : 3 ordinateurs + 3 pôles de développement + des agents IA qui échangent leurs informations via GitHub.** Chacun supervise ses agents, Claudex aide localement à faire collaborer Claude Code et Codex, et les pôles coordonnent interfaces, questions et PR via GitHub. **Avant tout codage, les trois agents de pôle doivent participer à un alignement commun via GitHub, valider ensemble une spécification technique partagée unique (interfaces entre pôles, responsabilités et règles de communication), puis annoncer chacun leur état « READY » ; le démarrage n’intervient qu’après un « GO » explicite des humains. Toute évolution ultérieure d'interface devra être répercutée dans cette spécification et signalée aux pôles concernés.** **Règle de qualité ajoutée : avant le codage, après validation du plan, le `README.md` existant doit être restructuré comme point d’entrée documentaire commun, cohérent avec `AGENTS.md` et la spécification partagée des interfaces ; ensuite, à chaque modification de code, les agents doivent vérifier et actualiser la documentation concernée et faire auditer/revoir le changement via Claudex avant son intégration.**

**Règle de priorité absolue :** d'abord une démonstration de bout en bout qui marche ; enrichissements **seulement ensuite**.

### Légende pour tout le brief

- **[VALIDÉ]** : décision explicitement prise par l'équipe.
- **[À TESTER]** : capacité annoncée ou raisonnablement attendue, mais non encore éprouvée dans notre prototype.
- **[À DÉCIDER]** : point à proposer et arbitrer, sans le tenir pour décidé.
- **[OPTION]** : enrichissement facultatif après achèvement du MVP.
- **[HORS PÉRIMÈTRE]** : ne pas développer pendant ce hackathon.

---

## 1. Pourquoi Keystone existe : problème économique et positionnement

### 1.1. Problème de départ [VALIDÉ]

Dans les relations de dérivés OTC, notamment les swaps de taux entre un fonds et une banque, les variations d'exposition peuvent entraîner des **appels de marge** et imposer la disponibilité de collatéral admissible. Pour se préparer à ces appels, un fonds peut garder du **cash disponible ou immobilisé**. Ce cash représente alors potentiellement un **coût d'opportunité** : la part réservée au collatéral ne peut pas, dans le même temps, être librement investie dans les autres opportunités du fonds. C'est l'intuition derrière l'expression **« cash qui dort »**.

**Notre opportunité :** utiliser, lorsque l'accord de collatéral et les règles d'éligibilité l'autorisent, des **parts de fonds monétaires tokenisées** ou des **obligations souveraines tokenisées** comme garanties à la place d'une partie de ce cash. Les actifs mobilisés **peuvent conserver leurs droits économiques sur les sous-jacents** pendant leur immobilisation, notamment un revenu ou une évolution de valeur éventuels, selon les conditions propres aux actifs et au CSA. Il s'agit de maintenir une exposition à des actifs investis plutôt que de devoir systématiquement réserver l'équivalent en espèces.

**Précision indispensable pour la crédibilité du projet :** le cash donné en collatéral n'est pas toujours non rémunéré, les fonds utilisent déjà parfois des garanties non monétaires, et un actif investi peut aussi perdre de la valeur. Keystone ne garantit donc ni performance positive, ni économie automatique, ni remplacement intégral du cash. Notre problématique ne porte pas sur « l'invention du collatéral non cash », mais sur la **mobilisation opérationnelle de garanties tokenisées** dans un processus de gestion de marge traçable et automatisable.

### 1.2. Proposition de valeur [VALIDÉ]

Keystone est la **couche d'orchestration** au-dessus d'actifs tokenisés existants ou représentés en Testnet. Notre rôle est de gérer **l'admissibilité prévue par le scénario, le suivi des montants, l'immobilisation et la libération des garanties, les conséquences d'une évolution de l'exposition et le règlement prévu en cas de défaut**.

**Bénéfice visé à mettre en avant dans la démonstration et le pitch :** le fonds peut affecter des actifs tokenisés déjà investis à ses obligations de collatéral, au lieu de devoir conserver autant de cash dédié à cet usage ; il peut ainsi **préserver, dans les limites contractuelles et financières applicables, l'exposition et les droits économiques attachés à ces actifs**. Pour le MVP Testnet, le bénéfice économique est **illustré par des hypothèses**, non réalisé ni quantifié comme une performance réelle.

**Nous ne réinventons pas la roue :** des acteurs comme Franklin Templeton, Etherfuse, Spiko ou WisdomTree travaillent déjà sur la tokenisation d'actifs. Nous voulons démontrer ce qu'un **moteur commun** peut faire avec plusieurs classes d'actifs, plutôt que créer des produits d'investissement ou un nouvel émetteur financier.

Au stade du MVP, **« sélection » veut dire choix manuel de la classe d'actifs par l'utilisateur**, puis orchestration du cycle de collatéral correspondant. La sélection ou combinaison optimale et automatique appartient seulement à une étape future éventuelle ; ne pas la présenter comme un élément acquis de la V1.

### 1.3. Ce que nous cherchons à prouver au jury

- Deux classes d'actifs fictifs peuvent traverser un **processus commun de gestion du collatéral** sur Stellar.
- Un scénario financier compréhensible peut déclencher des **opérations effectives sur Stellar Testnet**.
- Le vault exécute les règles de blocage, libération et transfert, et **n'accorde pas un droit arbitraire de retrait** au keeper, à la banque ou aux développeurs.
- L'interface permet de **voir clairement la cause, la décision du moteur et le résultat blockchain**, avec preuve consultable.

**Notre objectif compétitif est de gagner HackMeridian**, sans confondre ambition de concours et promesse de sécurité bancaire en production.

---

## 2. Le cadre financier retenu : swap OTC + CSA supposés déjà signés

### 2.1. Hypothèse structurante [VALIDÉ]

Le scénario commence **après** la conclusion d'un **swap de taux d'intérêt de gré à gré** entre :

- **Un fonds d'investissement** : exposé aux mouvements de marché, détenteur de garanties tokenisées disponibles ;
- **Une banque contrepartie** : bénéficiaire potentielle des garanties selon les conditions convenues.

Le swap est accompagné d'un **CSA** (*Credit Support Annex*) **supposé préexistant**. Les caractéristiques du swap et les conventions de marge sont **fixées au départ du scénario**. Nous les simulons de manière cohérente ; nous **ne créons pas** une plateforme de négociation, de conclusion ou de rédaction juridique des contrats.

**Avertissement explicite à conserver :** un CSA est ici une **hypothèse contractuelle de démonstration**. Keystone ne prétend pas encoder, garantir ou vérifier exhaustivement l'ensemble des clauses d'un CSA réel, ni établir la validité juridique d'une saisie.

### 2.2. Simulation financière visée [VALIDÉ dans le principe ; détails À DÉCIDER]

Le projet initial envisageait un swap **taux fixe contre taux variable**, susceptible de prendre un **taux Euribor réel** comme référence. L'équipe souhaite **si possible** s'appuyer sur une source fiable de taux réels, tout en conservant le swap, son exposition et ses flux **simulés**.

Claude devra proposer pour le MVP un modèle **simple mais défendable financièrement**, puis faire valider les paramètres importants :

- sens du swap et de l'exposition pour le fonds ;
- notionnel, taux fixe, taux de référence, maturité ou horizon simplifié ;
- méthode de calcul illustrant l'évolution de l'exposition ;
- valeur éligible du collatéral, valorisation, haircut et éventuel traitement des devises ;
- seuils de marge, délais et événements servant à déclencher les actions prévues ;
- nombre et déroulement des scénarios nécessaires à la démonstration.

**Aucun chiffre particulier, aucune formule définitive, aucun jeu de scénarios et aucune API financière spécifique n'ont été collectivement validés.** Les exemples chiffrés précédents étaient illustratifs, pas une spécification financière.

### 2.3. Simplifications expressément décidées [HORS PÉRIMÈTRE]

Ne pas construire :

- un système de négociation et de signature de swaps ;
- un moteur universel de contrats CSA ;
- une infrastructure juridique complète ;
- un calcul de risque bancaire de production ;
- une plateforme de trading ou de marché secondaire des actifs ;
- un système complexe de gestion de plusieurs banques et de tous types de dérivés.

Le sujet du prototype est **le parcours opérationnel du collatéral pour un swap déjà convenu**, pas la contractualisation des produits dérivés.

---

## 3. Réseau et niveau de réalité : 100 % Stellar Testnet

### 3.1. Règle absolue [VALIDÉ]

Tout le prototype est exécuté **exclusivement sur Stellar Testnet** : pas de fonds réels, pas de transactions Mainnet ni d'argent réel. Les tokens de test n'ont **aucune valeur réelle**.

À distinguer dans tous les écrans et dans la vidéo :

| Élément | Statut attendu |
|---|---|
| XLM pour frais de réseau | XLM fictifs de Testnet |
| KMMF | Token fictif créé par l'équipe sur Testnet |
| KBOND | Token fictif créé par l'équipe sur Testnet (remplace les Stablebonds Etherfuse dans le MVP) |
| Swap, CSA, notionnels, prix, rendements et événements de marché | **Simulation financière** cohérente, explicitement signalée |
| Dépôts, immobilisations/transferts exécutés par Soroban | **Opérations réellement confirmées sur Testnet**, lorsque le contrat les réalise |
| Preuve des mouvements on-chain | Transaction hash, événement et/ou lien vers explorateur du réseau de test |

Les mises à jour purement internes de la simulation ne doivent pas être affichées comme des transactions blockchain si aucune transaction n'a eu lieu.

### 3.2. Démonstration visible de bout en bout [VALIDÉ]

Le prototype devra permettre de constater, selon le parcours final retenu :

1. des portefeuilles de fonds et de banque de démonstration ;
2. la classe de collatéral choisie dans l'interface ;
3. l'existence ou la mise à disposition des tokens de test ;
4. leur **dépôt volontaire et autorisé** dans le vault ;
5. la distinction claire entre **garanties disponibles** et **garanties immobilisées** ;
6. l'évolution simulée de l'exposition du swap et du collatéral requis ;
7. l'action de marge, le signalement d'un déficit éventuel ou la libération de garanties selon les règles ;
8. un **scénario distinct de défaut simulé** appliquant les conditions simplifiées retenues et transférant directement le collatéral concerné **à l'adresse on-chain de la banque** ;
9. les preuves de transactions réelles Stellar Testnet visibles dans le tableau de bord ou accessibles en un clic.

**Nuance métier fondamentale :** un appel de marge **n'est pas** automatiquement un défaut. Le fonds ne perd pas son collatéral simplement parce que le marché évolue défavorablement.

---

## 4. Classes d'actifs : exactement deux dans le MVP

### 4.1. Actif A — KMMF, fonds monétaire tokenisé fictif [VALIDÉ]

- Classe : **parts de fonds monétaire tokenisées (FMT)**.
- Nom de travail utilisé par l'équipe : **`KMMF`**.
- Émission : **par l'équipe sur Stellar Testnet**.
- Nature : **actif totalement fictif**, sans parts véritables de fonds, autorisation réglementaire ni droits économiques réels.
- Rôle : **support de collatéral** pour illustrer Keystone ; sa création doit rester volontairement simple et ne pas détourner les ressources du cœur du projet.
- Valorisation, valeur liquidative (NAV), rendement et haircut : **valeurs / règles simulées et à définir**, sans rendement effectif distribué.
- Compatibilité Soroban : mécanisme d'actif Stellar / SAC ou autre moyen standard à décider techniquement. Ne pas inventer une architecture d'émission sophistiquée.

Les recherches antérieures sur **Franklin Templeton BENJI, WisdomTree WTGXX, Spiko, Circle USYC** servent au contexte de marché ; **elles ne sont pas des dépendances du MVP**. Aucune disponibilité libre, immédiate et transférable de parts fictives correspondant à ces émetteurs n'a été retenue pour notre prototype.

**Ne pas présenter KMMF comme émis par Franklin Templeton ou Spiko.** Ce sera explicitement un token de démonstration Keystone.

### 4.2. Actif B — KBOND [VALIDÉ le 25 octobre, 19:45] ; Etherfuse abandonné

**Décision actualisée :** l'actif B du MVP est `KBOND`, une obligation souveraine tokenisée fictive émise par l'équipe sur Stellar Testnet. Elle est libellée en EUR et son prix unitaire est simulé.

Le test Etherfuse a été mené jusqu'au financement simulé d'un ordre CETES. Mais la sandbox v2 ne livre pas encore sur Stellar Testnet : l'équipe Etherfuse l'a confirmé et attend une correction après la deadline.

Etherfuse est abandonné pour ce hackathon. Le texte ci-dessous est conservé pour l'historique uniquement.

- Classe : **obligations souveraines tokenisées**.
- Fournisseur ciblé : **Etherfuse**.
- Usage : **uniquement tokens fictifs de sandbox** sur **Stellar Testnet**.
- Liens déjà identifiés :
  - https://sandbox.etherfuse.com/dashboard
  - https://app.etherfuse.com/legal/dev-docs
  - https://docs.etherfuse.com/v2/test-environment
- Selon les échanges avec un mentor Etherfuse et les vérifications antérieures, **la sandbox API v2 offre un environnement compatible avec Stellar Testnet**. L'équipe est maintenant **raisonnablement confiante** sur la faisabilité.
- **Il ne faut donc pas traiter cette intégration comme un obstacle majeur démontré ni ralentir tout le développement à cause d'elle.**
- En revanche, il **n'a pas encore été confirmé par une démonstration dans notre vault** que l'équipe obtient les tokens de test, les reçoit dans le portefeuille, les dépose dans Soroban et les retransfère selon ses règles. Ne pas prétendre le contraire.
- La page dashboard peut présenter des références à des outils / identifiants Solana ; cela ne prouve pas à elle seule le réseau du flux API précis que nous utiliserons. **Établir sur quel réseau sont les tokens effectivement reçus**, et leurs permissions, par un test concret.
- L'instrument exact n'est pas fixé : CETES et d'autres Stablebonds ont été évoqués. Ne pas supposer que **EUROB**, **USTRY** ou un autre est disponible sur Testnet sans vérification.
- Les CETES étant libellés en **MXN**, leur usage avec un swap en **EUR** peut requérir une convention de change / un haircut adapté ou un scénario simplifié explicitant cette hypothèse ; **aucune méthode FX n'a encore été décidée**.

**Plan de repli conservé :** créer `KBOND`, obligation fictive Stellar Testnet émise par l'équipe, si les Stablebonds Etherfuse ne peuvent finalement pas suivre le cycle du vault dans les contraintes du concours. Ce fallback **n'est pas** la voie privilégiée et ne doit pas faire repartir l'équipe dans une longue recherche d'émetteurs.

### 4.3. Aucune autre classe d'actifs retenue [VALIDÉ]

**Seulement KMMF et une obligation souveraine tokenisée (`KBOND` dans le MVP)** pour la V1. Des stablecoins, actions, cryptos, obligations d'entreprises et autres actifs ont été mentionnés lors du brainstorming, **mais ne font pas partie du MVP**. `KBOND` ne constitue pas une troisième classe : c'est **le représentant fictif de la classe obligation**.

---

## 5. Simplification décisive : choix manuel du collatéral

### 5.1. Fonctionnement MVP [VALIDÉ]

L'utilisateur sélectionne dans Keystone une classe de collatéral :

- **Option A : KMMF** ; ou
- **Option B : obligation souveraine tokenisée**, représentée par `KBOND`, token fictif émis par l'équipe.

Le système déroule ensuite **le scénario de marge et le parcours on-chain** en utilisant **la classe choisie**. Cela démontre l'interopérabilité du moteur avec deux classes, sans exiger de mélange simultané au sein d'un même scénario.

**Le choix manuel est un choix produit explicite, pas une lacune à « corriger » automatiquement.** Ne pas présenter un algorithme de recommandation ou un portefeuille multi-actifs optimisé comme un prérequis à la valeur du projet.

### 5.2. Ce qui n'est PAS requis au MVP

- choisir automatiquement la « meilleure » garantie ;
- répartir la marge de façon optimale entre KMMF et obligations ;
- maintenir simultanément les deux actifs dans le même scénario ;
- optimiser une fonction mathématique de coût, de rendement, de volatilité ou de risque ;
- ajouter un profil de risque avancé et plusieurs curseurs pour justifier l'existence de deux actifs.

**Important sur le vocabulaire :** « multi-actifs » signifie ici **capacité du moteur à prendre en charge deux classes** ; ne pas le confondre avec « allocation simultanée optimale multi-actifs », réservée au futur éventuel.

### 5.3. Évolution facultative [OPTION seulement]

Si le MVP complet est fini, on **pourrait** faire suggérer un actif plutôt qu'un autre, selon des paramètres définis et justifiés (valorisation, rendement simulé, haircuts, conditions de marché, préférences). L'algorithme, la pertinence de la recommandation et les paramètres **ne sont pas décidés**. Il est interdit de promettre un gain économique chiffré ou une « optimisation intelligente » réellement démontrée sans méthode et justification.

---

## 6. Le vault Soroban : invariants à préserver sans sur-ingénierie

### 6.1. Ce qui est non négociable [VALIDÉ]

Le cœur on-chain est un **smart contract / escrow / vault Soroban** qui reçoit des actifs **volontairement déposés** et applique des **règles préprogrammées, cohérentes et déterministes** pour les opérations de collatéral.

- Le contrat **ne prélève pas des tokens dans un portefeuille externe sans autorisation** ; un dépôt, et si besoin un réapprovisionnement, doivent être autorisés par leur détenteur.
- Il existe une différence métier entre **montants déposés disponibles**, **montants immobilisés** et **montants transférés ou libérés** ; leur comptabilité doit être cohérente.
- **Ni la banque, ni le développeur, ni le keeper** ne disposent d'un pouvoir de **retrait ou de saisie arbitraire** des actifs.
- En cas de défaut dans le scénario de démonstration, si les **conditions simplifiées effectivement programmées** sont remplies, le collatéral concerné est **transféré directement à l'adresse blockchain de la banque**.
- **Ne pas confondre augmentation de marge / insuffisance de marge / défaut.** Les états et règles doivent les différencier.
- Le modèle doit pouvoir servir **KMMF ou KBOND** sans faire de chaque fournisseur un système entièrement indépendant.

L'objectif antérieur d'un vault **sans administrateur privilégié** est maintenu. Le mot **« immutable »** a été évoqué comme principe de confiance ; son sens exact (mise à jour du code, contrôles éventuels, déploiement) relève d'un **arbitrage technique**, pas d'une preuve acquise de sécurité totale.

### 6.2. Ce qu'on ne veut PAS construire [HORS PÉRIMÈTRE]

Ne pas faire de la gestion du keeper, des oracles, de l'authentification ou des cas de litige un programme complet de sécurité institutionnelle. Notre MVP ne requiert pas :

- une infrastructure oracle décentralisée hautement sécurisée ;
- un système bancaire de signatures multiples ou d'attestations juridiques exhaustives ;
- une vérification on-chain de l'intégralité du CSA ;
- des procédures réelles de close-out / recouvrement / litiges pour une banque.

**Mais il faut garder le minimum de contrôles crédibles**, sans renoncer aux invariants : permissions des opérations, limites des rôles, conditions déterministes du défaut, tests de refus des actions non autorisées et des retraits arbitraires.

### 6.3. Statut particulier des événements de défaut [VALIDÉ]

Pour la démonstration, les données et événements de défaut peuvent être **explicitement simulés dans un scénario prédéfini**. Le contrat applique les conditions simplifiées retenues ; il **ne prétend pas authentifier indépendamment tous les faits économiques ou juridiques extérieurs**.

La confiance accordée à un keeper ou à une donnée de démonstration n'est **pas** une garantie de sécurité de production. Claude devra décrire lucidement cette limite et les améliorations qu'exigerait une version industrielle, mais **sans gonfler le MVP à cause de ces contraintes**.

---

## 7. Keeper, calculs financiers et circulation de l'information

Le **keeper** est la composante externe qui **alimente le modèle** en données et **soumet les transactions autorisées**. Un smart contract Soroban ne va pas consulter directement une API Euribor ou de prix.

### Responsabilités logiques à prévoir [VALIDÉ dans le principe]

- Fournir / rafraîchir les données ou scénarios de taux pertinents.
- Calculer ou préparer l'exposition simplifiée et le collatéral requis conformément au swap et au CSA simulés.
- Appliquer les règles d'éligibilité, de valorisation et les haircuts retenus pour l'actif **choisi manuellement**.
- Proposer et déclencher les actions de marge **permises par le contrat**.
- Vérifier les résultats et rendre disponibles au frontend les états et preuves on-chain.

**Attention à ne pas reprendre l'ancien brief tel quel sur ce point :** le keeper ne doit **pas obligatoirement optimiser et combiner simultanément les deux actifs**. La V1 applique les règles à la **classe sélectionnée**.

### Choix de données et de modèle [À DÉCIDER]

- fournisseur des taux réels, si accessible pendant la démo, et comportement en cas d'indisponibilité ;
- conventions et formules minimales de calcul d'exposition ;
- valeurs/prix/haircuts des actifs et éventuel traitement FX ;
- contenu des événements, des états et des résultats renvoyés aux autres pôles ;
- déclenchement des actions manuellement par scénario, par keeper ou par combinaison des deux ;
- mécanismes minimaux de validation côté smart contract.

La précision d'un modèle de taux réel ne doit pas empêcher la **reproductibilité** d'une démonstration courte. Si une valeur est fixée ou rejouée pour la simulation, elle doit être **étiquetée comme scénario/hypothèse**, pas présentée à tort comme un flux « live ».

---

## 8. Interface utilisateur, UX premium et vidéo

### 8.1. Objectif produit [VALIDÉ]

L'équipe veut un **playground interactif réellement présentable**, pas un outil de développeur en ligne de commande déguisé. La qualité attendue s'inspire de **l'élégance visuelle et de la fluidité d'Apple, Apple Wallet, Trade Republic et Robinhood**, **sans reprendre les fonctionnalités de ces produits**.

Caractéristiques recherchées :

- **minimalisme** et hiérarchie claire des informations ;
- présentation compréhensible par un jury qui ne connaît pas toutes les conventions des dérivés ;
- animations, transitions et retours d'état fluides ;
- visualisation concrète de **ce que fait le moteur** ;
- lien direct entre **action utilisateur / évolution de marge / action du vault / résultat Stellar Testnet**.

Le MVP inclut un **choix manuel visible entre KMMF et KBOND**, puis un parcours permettant de démontrer chaque type de collatéral.

### 8.2. Observabilité sur la blockchain [VALIDÉ dans l'objectif]

L'équipe souhaite voir « en fond » ou dans un encart de l'interface les **actions blockchain** du prototype et leur évolution pendant la démonstration : dépôt, immobilisation quand elle émet une transaction, libération, règlement, état de confirmation et hash ou lien vers un explorateur **Testnet**.

Ne pas inventer de transactions ni appeler « on-chain » une simple animation interne. La solution technique (événements Soroban, interrogation RPC, actualisation, intégration d'un explorateur ou panneau natif) **n'a pas été arrêtée** ; Claude devra proposer une approche réaliste et fiable pour la vidéo.

### 8.3. Méthode de co-conception UX [VALIDÉ]

Les choix importants UI/UX seront **pris ensemble, progressivement**, par Liel, Grégoire et Nathan. L'équipe apportera ses idées de fonctionnalités et d'écrans ; Claude pourra proposer des alternatives et poser des questions **sur les décisions qui changent réellement l'expérience**.

**Aucun** design final, palette, mode clair/sombre, structure d'écrans, framework frontend, composants graphiques, maquette, slider, type exact de graphique ou storyboard vidéo n'est **encore validé**. Ne pas les choisir silencieusement dans ce brief.

Sur les **choix d'implémentation ordinaires** et les détails sans incidence majeure, l'équipe délègue à l'assistance technique la proposition et l'exécution ultérieure ; elle ne souhaite pas une interminable liste de questions mineures avant de développer.

### 8.4. La vidéo n'est pas le seul livrable [IMPORTANT — vérifié]

La **vidéo de démonstration** est une pièce majeure de l'évaluation et doit montrer un prototype fonctionnel. Elle **ne remplace pas** le reste du dossier : l'organisation du concours annonce aussi l'examen du **pitch deck**, du **dépôt GitHub** et des **réponses de soumission**.

Le **README** doit expliquer clairement le problème, le fonctionnement, la mise en route et les spécifications utiles. La durée/formats précis des pièces, le caractère public ou privé du dépôt et les champs exacts de la plateforme de soumission doivent être revérifiés dans l'interface organisateur, et ne sont pas affirmés ici.

**Pitch oral :** pas de pitch en direct à préparer pour la sélection initiale ; les **finalistes seulement** sont annoncés pour une présentation live le **28 octobre 2026**. Ne pas confondre « pas de pitch oral initial » avec « aucun pitch deck à soumettre ».

Sources officielles : https://www.hackmeridian.com/build et https://www.hackmeridian.com/schedule (consultées le 25/10/2026).

### 8.5. Exigences officielles de soumission [VÉRIFIÉ le 25 octobre, 19:48, sur la page de l'organisateur]

**Exigences communes à tous les projets :**

1. **Dépôt GitHub public** contenant le code source du projet. Notre dépôt est privé : il devra être rendu public avant la soumission.
2. **README** couvrant :
   - le résumé du projet ;
   - le problème ;
   - le setup et l'installation ;
   - les variables d'environnement, le cas échéant ;
   - les instructions pour jouer la démo.
3. **Vue d'ensemble de l'architecture** expliquant comment Stellar est utilisé : actifs concernés, **ID des contrats**, anchors, **wallets**, intégrations et API, le cas échéant.
4. **Démo live fonctionnelle ou vidéo** montrant les fonctionnalités principales et un usage significatif de Stellar. **Les applications destinées à un utilisateur doivent aussi fournir une URL publique que le jury peut explorer.** Les outils pour développeurs et l'infrastructure peuvent se contenter d'une démonstration technique adaptée ; un parcours financier grand public n'est pas exigé.
5. **Preuve d'au moins une transaction on-chain** sur Stellar Testnet (ou Mainnet), le cas échéant.
6. **Déclaration du travail antérieur** et démonstration de ce qui a été construit pendant l'événement. Les règles de l'événement (participation, intégrité de la soumission, conduite) sont à lire.

**Exigences du chemin Genesis** (nouvelle idée ou projet précoce → preuve de concept ou premier MVP) :

1. **Preuve de concept fonctionnelle ou MVP** à la fin du hackathon. **Une maquette interactive seule est insuffisante.**
2. Fonctionner sur **Stellar Testnet** et démontrer la fonctionnalité concernée. Mainnet non requis.
3. Intégrer **au moins une fonctionnalité, un standard, une primitive ou une intégration de l'écosystème Stellar**. Pour Keystone :
   - un contrat **Soroban** ;
   - les **Stellar Asset Contracts** (interface token standard) ;
   - des actifs Stellar classiques avec **trustlines** ;
   - le wallet **Freighter**.
4. Démontrer un **travail technique significatif réalisé pendant le hackathon** et expliquer le **problème**, l'**utilisateur cible** et la **proposition de valeur**.

**Conséquences pour le projet :**

- **URL publique.** Keystone a un dashboard : il est prudent de le traiter comme une application utilisateur et de fournir une URL publique, avec le front et le keeper hébergés et branchés sur Testnet.
  - Le jury ne pourra pas signer avec la clé du fonds dans Freighter. La démo publique doit donc tourner en mode `SIGNER=keeper` : le keeper signe pour le compte du fonds de démo, ce qui est clairement indiqué à l'écran.
  - La vidéo peut, elle, montrer la signature Freighter.
  - Le choix de l'hébergement est à arbitrer (par exemple un hébergeur statique pour le front et un service Node pour le keeper). L'URL doit rester en ligne pendant toute la période d'évaluation.
- **README.** Il doit contenir toutes les rubriques de l'exigence 2, plus une section « Architecture et usage de Stellar » qui liste :
  - les actifs (KMMF, KBOND, avec code et émetteur) ;
  - les ID des SAC et du WASM du vault ;
  - l'adresse d'un vault de démonstration ;
  - les comptes de démo (fonds, banque, keeper) ;
  - le wallet (Freighter) ;
  - les API utilisées (Stellar RPC, Horizon, API BCE) ;
  - des liens stellar.expert vers des transactions réelles.
- **Section « Travail antérieur et travail réalisé pendant l'événement ».** Elle est obligatoire et doit être honnête.
  - Avant l'événement : idée, brainstorming, brief, squelette vide du dépôt et contrat Soroban d'essai sur un projet séparé.
  - Pendant l'événement : tout le code applicatif, avec renvoi à l'historique des commits et des PR.
- **Exigence Genesis n°4.** Le README et le pitch deck expliquent explicitement le problème, l'utilisateur cible (un fonds qui gère ses appels de marge sur des swaps OTC, et sa banque contrepartie) et la proposition de valeur.

---

## 9. Équipe, agents IA, outils et collaboration validée

### 9.1. Ressources [VALIDÉ selon les déclarations de l'équipe]

- **3 participants :** Liel, Grégoire, Nathan.
- **3 ordinateurs :** deux **Mac** et un **Windows**.
- **Abonnements IA :** **2 Claude Pro** et **1 ChatGPT Plus**.
- **Agents/outils :** **Claude Code**, **Codex CLI**, le skill communautaire **Claudex / Claudex Loop**, Git, GitHub et les outils nécessaires à Stellar/Soroban, préparés sur leurs machines.
- Les trois membres comptent **superviser attentivement** les opérations des agents.

**État effectivement observé sur le Windows de Liel lors des vérifications précédentes :** dépôt Keystone accessible dans VS Code, `staging` à jour au moment du contrôle, Codex connecté au compte ChatGPT Plus, skill Claudex accessible/reconnu par Codex, Rust/Stellar CLI et un contrat Soroban de test déjà vérifiés sur un projet d'essai distinct. **La connexion de Claude Code au compte Claude et une boucle Claudex complète Claude↔Codex n'étaient pas encore vérifiées**, sauf mise à jour ultérieure par l'équipe.

Ne pas inventer les connexions actives, les capacités exactes des modèles, les quotas ou l'état courant de tous les agents sans vérification.

### 9.2. Organisation approuvée [VALIDÉ]

> **3 ordinateurs + 3 pôles de développement + des agents IA qui échangent leurs informations via GitHub.**

Les trois **pôles fonctionnels** sont :

1. **Frontend / Dashboard / UI/UX** ;
2. **Smart contracts Soroban / vault de collatéral** ;
3. **Backend / keeper / simulation financière / connexion aux actifs**.

**L'attribution nominative de ces pôles n'est pas fixée** : ne pas annoncer que Liel, Grégoire ou Nathan possède un pôle particulier avant validation collective.

L'architecture globale et les **contrats d'interface communs** doivent être clarifiés avant de lancer trois travaux indépendants. Il ne s'agit pas d'imposer une architecture industrielle figée ; il s'agit d'éviter trois composants incompatibles qui ne se rencontreraient qu'à la fin.

### 9.3. Rôle de Claudex et revue systématique du code [VALIDÉ]

Claudex sert à organiser la **collaboration locale Claude Code ↔ Codex**, notamment la planification, l'audit et la revue de code au sein d'un pôle. **Ce n'est pas une couche magique de communication simultanée entre les trois ordinateurs.**

**Nouvelle exigence explicite de l'équipe : chaque changement de code doit être audité et « claudexé » avant intégration**, c'est-à-dire soumis à une relecture croisée Claude Code ↔ Codex via Claudex, sous supervision humaine. Aucun agent ne doit considérer son code comme validé simplement parce qu'il fonctionne une fois ou qu'il a été généré par un modèle.

La revue doit notamment rechercher les **bugs, régressions, cas limites, incohérences d'interface entre pôles, erreurs de logique financière, permissions du vault et problèmes de sécurité pertinents pour le MVP**. Le changement doit aussi passer les **tests adaptés** (unitaires ou d'intégration selon le composant) ; Claudex ne remplace pas l'exécution de tests.

Pour tenir le délai du hackathon, **l'intensité de la revue peut être proportionnée au risque** : contrôle rapide et ciblé pour un ajustement mineur, vérification plus poussée pour smart contracts, calculs de marge, autorisations et interfaces communes. Mais **aucun changement de code ne doit échapper à une revue**. Claude devra prévoir cette boucle dans le workflow des trois pôles et vérifier que Claudex fonctionne réellement sur les machines avant d'en dépendre.

### 9.4. Communication inter-agents GitHub [VALIDÉ]

GitHub est le **canal de coordination inter-machines**. Les agents peuvent, sous supervision et dans les permissions accordées, échanger :

- des **Issues** pour signaler une question, un blocage ou un changement à coordonner ;
- des commentaires de questions/réponses et précisions d'interfaces ;
- des **Pull Requests** pour soumettre du code, faire relire et rendre visibles les changements ;
- de la **documentation commune** décrivant le fonctionnement attendu et les interfaces.

Le protocole évoqué comporte un document de règles tel que **`AGENTS.md`** et des **spécifications de contrat d'interface** entre pôles. **Leur présence effective dans le dépôt n'a pas été confirmée** : ce sont des moyens d'exécution à proposer/établir au moment du plan.

**Limite explicite :** une Issue GitHub ne réveille pas automatiquement les agents sur les autres machines. La communication prévue est **asynchrone**, via des consultations et publications encadrées par des instructions/périodes adaptées. **Aucun orchestrateur distribué autonome n'a été validé**.

- Les **humains** gardent les arbitrages sensibles et les merges.
- Pas de bot **Discord/Telegram**, ni serveur d'agents personnalisé : solutions évoquées puis écartées pour limiter le coût de configuration.
- Ne pas attribuer aux agents des droits illimités de modification ou d'exécution sans l'accord des personnes qui pilotent leur machine.

### 9.5. Phase de pré-lancement : alignement réel et spécification commune avant codage [VALIDÉ dans le principe ; mise en œuvre précise À DÉFINIR]

**Exigence explicite de l'équipe : avant d'écrire le code applicatif, les agents des trois pôles doivent avoir effectivement échangé entre eux et validé une seule spécification technique partagée, qui servira de référence à tous.** Il ne suffit pas que Claude produise un plan centralisé puis distribue trois prompts isolés : chaque agent doit avoir lu et compris les responsabilités, dépendances, interfaces et attentes des deux autres. **Le critère de réussite de cette phase n'est pas le volume de messages échangés, mais un accord technique vérifiable et exploitable.**

Claude devra organiser dans son plan une courte **phase zéro / réunion de lancement asynchrone via GitHub**, conduite sous la supervision de Liel, Grégoire et Nathan, suivant ce principe :

1. **Socle commun approuvé par l'équipe :** architecture MVP minimale, frontières des trois pôles et premier scénario end-to-end. Claude proposera une **spécification technique partagée unique** (par exemple `docs/interfaces.md` ou un autre emplacement convenu), distincte ou accompagnée des règles de travail (`AGENTS.md` ou équivalent). Elle décrira au minimum les **API et formats échangés**, noms et types des données, opérations du vault Soroban, paramètres et retours, événements et erreurs, règles d'autorisation utiles, adresses/configuration Stellar Testnet, responsabilités de chaque pôle et dépendances du premier parcours. Son format et son emplacement précis restent à proposer puis à confirmer ; ne pas prétendre que ces fichiers existent déjà.
2. **Présentation croisée :** chaque agent reçoit sa mission, la branche autorisée, ses livrables, dépendances, points de contact et contraintes ; il publie dans un espace GitHub commun proposé par Claude (par exemple une Issue de kickoff) un résumé concis de **ce qu'il va réaliser, ce qu'il attend des deux autres pôles et ce qu'il leur fournira**.
3. **Échange explicite et convergence vers une seule référence :** chaque agent lit les messages des deux autres, pose ses questions, répond aux demandes qui le concernent et confronte les **interfaces, noms/types de données, appels, événements, ordre d'intégration et responsabilités**. Les éventuels désaccords sont résolus et **la même spécification partagée est amendée**, plutôt que de conserver trois versions contradictoires. **Chaque agent doit confirmer explicitement son accord sur cette version commune avant d'annoncer READY.** Les choix structurants ou incompatibilités bloquantes sont arbitrés par les humains.
4. **Protocole de communication convenu :** ils savent où publier une question ou un blocage, comment mentionner le pôle concerné, quand relire les Issues/PR, comment signaler un changement d'interface, qui valide la modification, et comment faire remonter une décision aux humains. GitHub permet ces échanges **asynchrones** ; il ne réveille pas à lui seul les agents. Chaque opérateur devra effectivement relancer/diriger son agent pour lire et répondre au moment convenu. Le plan précisera aussi **qui tient à jour la spécification commune et comment éviter les modifications concurrentes** sur un même document.
5. **Handshake de départ à trois :** chaque agent publie un état explicite **`READY`** ou **`BLOCKED`**, avec un bref récapitulatif de sa mission, des interfaces et dépendances, **et une confirmation de lecture et d'acceptation de la version commune de la spécification**. Un « READY » n'est valable qu'après les échanges croisés et la résolution des incompatibilités structurantes. **Trois READY sur une même spécification sont nécessaires avant de demander le GO humain.**
6. **Top départ humain et par pôle :** Liel, Grégoire et Nathan valident collectivement l'alignement et donnent le **`GO` explicite** pour passer à la programmation. Le plan peut ensuite fournir à chaque machine un ordre de lancement spécifique à son pôle, avec sa première tâche et son critère de réussite. Des tâches indépendantes peuvent démarrer en parallèle après ce GO ; les tâches dépendantes respectent leur ordre d'intégration. **Aucun agent ne doit auto-déduire l'autorisation de coder du seul fait qu'il a publié READY.**

**Livrable de cette phase zéro :** **une unique spécification technique commune versionnée dans GitHub**, courte et exploitable (missions des trois pôles, interfaces, types et opérations échangés, protocole GitHub, dépendances, premier jalon), **un `README.md` initial restructuré et relié à cette spécification et aux règles des agents (`AGENTS.md`)**, ainsi que la trace des **trois confirmations READY sur la même version des interfaces** et du **GO humain**. Les décisions doivent être consignées dans le document commun, pas seulement dispersées dans les commentaires d'Issues. La phase doit rester **rapide et proportionnée aux 24 heures du hackathon** : pas de longue négociation théorique, de robot inter-machines ni de multiplication de réunions. Elle ne remplace pas les revues de code Claudex, les tests et la maintenance du README pendant le développement.

**Après le GO — gestion obligatoire des changements d'interface :** aucun agent ne doit modifier silencieusement une API, un format de donnée, une fonction du contrat ou un événement consommé par un autre pôle. Il doit **annoncer le changement via GitHub aux pôles concernés**, exposer l'impact et la compatibilité attendue, **mettre à jour la spécification partagée** dans le même travail/PR, puis obtenir leur confirmation avant de considérer la nouvelle interface comme adoptée. Un changement cassant ou structurant demande aussi l'arbitrage humain. Les autres travaux ne doivent pas dépendre d'une version modifiée non approuvée. **Ne pas réimposer un GO collectif pour chaque changement mineur compatible** : une revue ciblée suffit afin de préserver la rapidité du hackathon.

**Distinction de phases impérative :** la lecture de ce brief autorise seulement Claude à **planifier** cette phase zéro. La tenue effective des échanges sur GitHub et la préparation des documents partagés attendent la validation du plan et l'autorisation humaine correspondante ; l'écriture du code n'est permise qu'après le handshake et le GO définis ci-dessus.

### 9.6. README et documentation : création du socle dès la phase zéro, puis maintenance continue [VALIDÉ]

**Avant tout codage applicatif, après validation du plan et autorisation de préparer le dépôt**, Claude devra prévoir la **restructuration et l'enrichissement du `README.md` déjà présent dans GitHub**. Il ne s'agit pas de le laisser vide jusqu'à la fin : sa première version exploitable doit être préparée pendant la **phase zéro**, puis relue par les trois pôles avant le `GO`. Cette préparation documentaire est distincte de l'autorisation ultérieure de coder ; la simple lecture du brief n'autorise aucune modification du dépôt.

**Trois références complémentaires, avec une responsabilité claire pour chacune :**

- **`README.md` — point d'entrée du projet** pour l'équipe, les agents et le jury. Il doit couvrir **toutes les exigences officielles de la section 8.5** : résumé, problème, utilisateur cible et proposition de valeur, setup, installation, variables d'environnement, instructions de démo, URL publique, architecture et usage de Stellar (actifs, ID de contrats, wallet, API), preuves de transactions Testnet, travail antérieur et travail réalisé pendant l'événement. Il couvre aussi : problème économique et solution Keystone ; portée réelle du MVP et distinction entre simulation et Testnet ; architecture générale et rôles des trois pôles ; arborescence ; prérequis, installation et configuration ; commandes de lancement et de test **lorsqu'elles ont été vérifiées** ; workflow GitHub ; liens vers la spécification partagée et les consignes agents ; état d'avancement réel, limites connues et, progressivement, parcours de démonstration.
- **`AGENTS.md` — règles opérationnelles communes aux agents** : périmètres/branches autorisés, lecture préalable de la documentation, coordination via GitHub, protocole READY/BLOCKED/GO, revue Claudex, tests, mises à jour documentaires et gestion des blocages. Claude doit en proposer la création pendant la phase zéro, sous réserve de validation de l'équipe.
- **`docs/interfaces.md` (nom proposé, à confirmer) — source de vérité technique commune** : contrats d'interface versionnés, types et formats, opérations Soroban, événements et erreurs, responsabilités et dépendances entre pôles. **C'est ce document, et non une description approximative du README, qui fait foi pour les interfaces convenues.** Le README et `AGENTS.md` doivent y renvoyer et rester cohérents avec lui.

**Responsabilité et cohérence :** Claude doit faire désigner **un responsable de coordination documentaire** (sans lui attribuer automatiquement une personne) pour consolider les modifications et résoudre les conflits. Chaque agent reste responsable de documenter **ses propres changements**. Avant de travailler, les agents relisent les parties pertinentes du README, d'`AGENTS.md` et de la spécification commune ; ils ne se fondent pas sur une ancienne copie locale lorsqu'une version plus récente a été validée. Les modifications concurrentes des fichiers partagés sont coordonnées via GitHub/PR, sans écraser silencieusement celles d'un autre pôle.

**Maintenance à chaque changement :** chaque modification de code impose la **vérification immédiate** du README et de la documentation associée. Si elle affecte le comportement, les commandes, les prérequis, les API, les contrats, les tests, le statut d'avancement ou la démonstration, **la documentation pertinente est actualisée dans la même modification / Pull Request**. Si aucune mise à jour n'est nécessaire, l'agent le justifie brièvement dans la revue. Tout changement d'interface suit aussi le protocole de notification et d'approbation de la section 9.5 ; les trois documents ne doivent pas se contredire.

**Exactitude impérative :** le README doit décrire l'état **réel, vérifié et actuel** du projet, et évoluer progressivement. Ne jamais documenter comme fonctionnelle une intégration encore non testée ni inventer des commandes, contrats, adresses, résultats ou fonctionnalités futurs. L'exhaustivité des sections attendues ne justifie pas de remplir des informations non encore connues : les indiquer explicitement comme « à définir » ou « non testé ».

**Contrôle systématique avant toute PR / intégration dans `staging` :** (1) code relu et audité via Claudex ; (2) tests appropriés effectués ou limites signalées ; (3) README, `AGENTS.md` et spécification d'interfaces consultés et actualisés si nécessaire ; (4) cohérence entre les trois pôles vérifiée ; (5) validation humaine du merge. Claude doit proposer un protocole **simple, reproductible et proportionné au hackathon**, sans CI complexe ni surcharge administrative.

---

## 10. GitHub et méthode d'intégration

**Dépôt existant :** `https://github.com/Lagouze/keystone` (privé au moment des dernières vérifications ; **il doit être rendu public avant la soumission**, exigence officielle de la section 8.5).  
**Branches déjà créées, noms exacts :**

| Branche | Fonction |
|---|---|
| `main` | Version stable / livraison finale ; branche par défaut |
| `staging` | Intégration et validation commune |
| `front/dashboard` | Travaux du pôle frontend |
| `back/keeper` | Travaux du pôle keeper/backend |
| `contract/collateral` | Travaux du pôle contrats/vault |

**Règle convenue :** chaque pôle travaille dans sa branche, ouvre une **Pull Request vers `staging`**, l'équipe valide et intègre progressivement. Quand l'ensemble est validé, `staging` est proposé vers `main`. **Pas de commit direct sur `main` ou `staging`** dans le développement ordinaire. **Chaque PR doit inclure la trace de la revue Claudex, les vérifications/tests effectués et la confirmation de mise à jour du `README.md` (ou l'explication qu'aucune modification documentaire n'est nécessaire).**

**Dernier état vérifié et non nécessairement toujours actuel :** repo sous forme de squelette avec `app/`, `contracts/`, `keeper/`, `packages/`, `scripts/`, `docs/`, `.github/workflows/` et un `README.md` ; dossiers applicatifs essentiellement vides avec `.gitkeep`. Le fichier `.github/workflows/pr-policy.yml` contrôle principalement la provenance des PR vers `main` (depuis `staging`) et **ne constitue pas à lui seul une CI de build/tests**.

**À faire vérifier par Claude dans son futur plan (sans agir immédiatement) :** manière de définir/stabiliser les interfaces, responsabilités de modification des fichiers partagés, conditions d'intégration, tests minimaux, ordre des jalons et vérification de l'état courant du dépôt. **Le plan GitHub doit commencer par la préparation du README, d’`AGENTS.md` et de la spécification technique commune, puis le kickoff inter-agents (échanges croisés, accord des trois pôles, READY/BLOCKED de chacun, puis GO humain), avant tout commit de code applicatif ; il doit également définir le circuit de notification, validation et mise à jour de cette spécification lors des changements d'interface.**

---

## 11. Priorités explicites : P0, P1 et hors hackathon

### P0 — MVP indispensable [VALIDÉ]

1. **Un scénario** de swap de taux OTC et CSA **supposés préexistants**, simplifiés et cohérents, avec paramètres à définir.
2. **Deux catégories de collatéral** prises en charge : **KMMF fictif** et **`KBOND` fictif** (obligation souveraine tokenisée). Etherfuse est abandonné, faute de livraison sur Testnet avant la deadline.
3. **Choix manuel** dans l'interface de la catégorie utilisée pour le scénario ; pas d'allocation optimale simultanée imposée.
4. **Un vault Soroban** sur Stellar Testnet, gérant le dépôt autorisé et la comptabilité des garanties disponibles/immobilisées.
5. **Un keeper / moteur de calcul minimal** qui simule ou alimente l'exposition et les besoins en marge, puis déclenche des opérations contractuellement permises.
6. **Dépôt, immobilisation et libération** du collatéral, avec résultats vérifiables.
7. **Un scénario de défaut distinct**, déterministe selon les conditions de démo programmées, conduisant au **transfert direct on-chain du collatéral concerné à la banque**.
8. **Transactions authentiques sur Stellar Testnet**, et non simple animation du dashboard.
9. **Dashboard premium, clair et interactif**, montrant le choix d'actif, les étapes métier et les preuves des événements/transferts blockchain.
10. **Intégration effective entre les trois pôles** et preuve de fonctionnement end-to-end ; aucun pôle isolé considéré comme un MVP réussi à lui seul.
11. **Livrables de soumission** conformes aux demandes officielles (section 8.5) : dépôt GitHub **public**, README complet, architecture et usage de Stellar avec ID de contrats, **URL publique explorable par le jury**, vidéo, preuve de transactions Testnet, déclaration du travail antérieur, pitch deck et réponses du portail (formats exacts à confirmer dans ce portail).
12. **Qualité continue de développement :** `README.md` systématiquement revu/actualisé à chaque modification pertinente, code audité et revu via Claudex avant intégration, tests appropriés et PR validées humainement. Cette discipline doit accompagner chaque étape du MVP, pas être repoussée à la fin.

**Les chiffres, formules, seuils, durées, profils, écrans et découpages techniques restent à proposer et faire valider si structurants.** Ne pas les remplir arbitrairement en prétendant qu'ils sont déjà décidés.

### P1 — Améliorations facultatives après MVP complet [OPTION]

- Une **recommandation** de KMMF ou de l'obligation fondée sur des paramètres justifiés, sans promettre d'optimisation magique.
- Un algorithme de **sélection ou allocation automatisée** plus élaboré.
- Des scénarios supplémentaires, variations de taux/prix et vues analytiques additionnelles.
- Plus d'animations, d'outils d'observation et de fonctionnalités UX.
- Des contrôles, tests, automatisations et mécanismes de vérification renforcés.

Ces pistes **ne sont pas des engagements**, ne justifient pas un troisième actif et ne doivent pas retarder la preuve de fonctionnement de la V1.

### P2 — Hors périmètre du hackathon [HORS PÉRIMÈTRE]

- Swap trading, négociation et contractualisation réelle ; implémentation générale de CSA.
- Plateforme financière réglementée, KYC/KYB de production, conformité bancaire exhaustive et mécanismes juridiques réels de garantie.
- Oracle résistant à toutes les attaques, données authentifiées à un niveau bancaire industriel, règlement de litiges complexe.
- Émission et gestion réelles d'un fonds monétaire ou d'une obligation, distribution de revenus réels, marché secondaire.
- Portefeuille multi-actifs optimisé de production, multiples classes et multiples institutions, systèmes de garde et de settlement industriels.
- Mainnet, argent réel, promesse d'une sécurité de niveau bancaire.
- Orchestrateur multi-agents Discord/Telegram/custom inter-machines.

Ces limites doivent être **signalées honnêtement**, pas cachées ; elles définissent la frontière entre MVP démonstratif et produit réel.

---

## 12. Contraintes du concours : éléments officiels vérifiés

**Sources :**
- Page organisateur (Build) : https://www.hackmeridian.com/build
- Programme officiel : https://www.hackmeridian.com/schedule
- Accueil officiel : https://www.hackmeridian.com/

**Informations confirmées le 25 octobre 2026 :**

- HackMeridian a lieu les **25 et 26 octobre 2026**, à Lisbonne.
- **Date limite de soumission : lundi 26 octobre à 12:00, heure de Lisbonne ; aucune soumission tardive** annoncée. Le site décrit une fenêtre de construction intense ; l'équipe la considère opérationnellement comme un hackathon d'environ une journée. Ne pas inventer une autre échéance.
- Le jury examine de manière **asynchrone** la **vidéo de démonstration**, le **pitch deck**, le **dépôt GitHub** et les **réponses de soumission**.
- Les **finalistes seulement** sont annoncés pour un **pitch live mercredi 28 octobre**.
- L'organisation insiste sur un **README clair** expliquant le projet et ses spécifications.
- L'usage des **assistants et agents IA est autorisé**.
- Deux chemins existent : **Genesis** (idée → MVP) et **Scale** (prototype → produit). L'affectation officielle de Keystone à un chemin n'a **pas été communiquée comme décision validée**. Si l'équipe est en Genesis, les axes **Stellar Unlocked** et **Stellar Composed** existent ; leur sélection n'a pas été arrêtée ici.
- Les critères publiés portent notamment sur la **valeur utilisateur/problème (20 %), adéquation au track/écosystème (20 %), exécution technique (15 %), innovation (15 %), progression pendant le hackathon (10 %), potentiel marché/écosystème (10 %) et design/UX (10 %)**.

**Désormais vérifié (section 8.5) :** dépôt public, rubriques du README, architecture avec ID de contrats, URL publique pour une application utilisateur, preuve on-chain, déclaration du travail antérieur, exigences Genesis.

**À ne pas inventer :** longueur limite de la vidéo, nombre de slides, format exact de dépôt, champs requis, éligibilité de l'équipe à un track ou une catégorie de prix. À vérifier dans **le portail de soumission effectif**, avec l'équipe.

Cette section corrige un angle mort du brief précédent : **la vidéo est centrale mais elle ne suffit pas seule à la candidature**.

---

## 13. Questions encore ouvertes à arbitrer pendant la planification

Claude devra **limiter les demandes de clarification aux décisions structurantes** et proposer des défauts techniques raisonnables pour le reste.

### Décisions fonctionnelles / financières

- Quel **scénario minimal** swap + CSA illustre le mieux la valeur de Keystone ? Quelles caractéristiques et règles sont retenues ?
- Comment modéliser **exposition, appel de marge, collatéral requis, variation et libération**, avec une cohérence suffisante pour un jury ?
- Quel scénario distinct permet de démontrer le **défaut simulé** et le transfert à la banque, sans prétendre coder toutes les règles d'un CSA réel ?
- Quels prix, NAV simulées, haircuts, devises et règles de FX simplifiées retenir pour KMMF et l'obligation ?
- Quelle référence Euribor et quelle source de données utiliser, si possible, avec quel comportement de secours si indisponible ?

### Décisions d'intégration

- ~~Quel Stablebond de test sera utilisé via la sandbox Etherfuse ?~~ **Tranché le 25 octobre, 19:45 : `KBOND`**, la sandbox v2 ne livrant pas sur Stellar Testnet avant la deadline.
- Quel mode le plus simple pour émettre et utiliser `KMMF` sur Stellar Testnet ?
- Quelles opérations et données devront échanger les trois pôles avant tout travail indépendant ? Quels critères établissent qu'un scénario est vraiment confirmé on-chain ?
- Quelles permissions minimales empêchent l'usage arbitraire du vault, tout en permettant la démo du défaut ?
- Quelle méthode d'actualisation du flux d'activité blockchain est fiable dans le temps de développement ?

### Décisions organisationnelles et expérience produit

- À qui attribuer les trois pôles entre Liel, Grégoire et Nathan ?
- Quelles règles d'interface, documentation partagée et cadence de communication GitHub pour les agents ? Comment organiser leur **échange croisé avant codage**, les confirmations **READY/BLOCKED** et le **GO humain**, sans réunion ni automatisation excessive ?
- Quelles grandes options visuelles, écrans, animations et interactions ? À soumettre **progressivement** aux trois membres.
- Quel scénario exact filmer pour illustrer successivement les deux classes de collatéral et le transfert en cas de défaut ?
- Quelles exigences précises le portail de soumission affiche-t-il pour vidéo, deck, GitHub et réponses ?

### Ce qui NE justifie PAS une phase interminable de questions

Noms internes de variables, micro-choix de fichiers, bibliothèques triviales, organisation fine des fonctions et composants sans impact majeur, style de logs, etc. Claude peut les trancher ensuite avec justification concise lors de la mise en œuvre.

---

## 14. Ce que nous attendons de Claude après réception de ce brief

**La prochaine mission sera de fournir un PLAN DE DÉVELOPPEMENT, pas de commencer à implémenter.** Ne produis pas spontanément du code, ne crée pas de branches, ne modifie pas GitHub et ne lance aucun déploiement en réponse à la lecture de ce brief.

Le plan demandé ultérieurement devra :

1. **Partir du MVP P0 ci-dessus** et classer les tâches par nécessité ; éviter les systèmes bancaires de production.
2. **Respecter le choix manuel** entre KMMF et l'obligation (`KBOND`), et reléguer la recommandation intelligente en option.
3. **Conserver le contexte swap + CSA supposés déjà signés** et ne pas lancer de projet de trading ou contractualisation.
4. **Proposer une architecture minimale, justifiée et modifiable**, non un schéma surdimensionné figé sans validation.
5. **Donner aux trois pôles des interfaces communes avant codage**, un ordre de tests de bout en bout et une façon de gérer les dépendances. **Prévoir une phase zéro obligatoire où les trois agents échangent réellement via GitHub, co-valident une spécification technique unique et versionnée, confirment chacun leurs missions et les interfaces, se déclarent READY/BLOCKED sur cette référence commune, puis attendent un GO explicite des trois humains avant de coder. Prévoir également l'annonce et la validation des changements d'interface auprès des pôles concernés pendant tout le développement.**
6. **Exploiter GitHub comme outil d'échange asynchrone inter-agents**, avec supervision humaine et PR vers `staging` ; **prévoir la restructuration du README existant dès la phase zéro, avant le GO de codage, avec `AGENTS.md` et une spécification technique partagée cohérents** ; intégrer ensuite **la revue/audit Claudex de chaque changement de code, les tests adaptés et la maintenance documentaire à chaque modification pertinente**, sans imposer une organisation lourde.
7. ~~Éviter de traiter Etherfuse comme un problème insoluble supposé~~ **Test effectué le 25 octobre : la sandbox v2 ne livre pas sur Testnet avant la deadline. `KBOND` est retenu ; Etherfuse est abandonné.**
8. **Proposer un minimum de sécurité crédible** du vault et un défaut de simulation explicitement circonscrit, sans construire d'oracle industriel.
9. **Travailler l'UI/UX par propositions successives**, en réservant les décisions structurantes à Liel, Grégoire et Nathan ; ne pas décider seul d'un design définitif.
10. **Intégrer les livrables officiels** (vidéo, pitch deck, dépôt/README, réponses) et la deadline du 26 octobre à 12:00 heure locale.
11. **Préserver la distinction** entre simulation économique, actions du keeper et transactions réellement confirmées sur Testnet.
12. **Réserver l'optimisation automatique et autres ambitions P1 au temps restant** une fois la preuve P0 réussie.
13. **Proposer uniquement les arbitrages humains importants**, avec quelques options et conséquences ; ne pas exiger des dizaines de réponses secondaires.

**Le plan devra rendre le README opérationnel dès la phase zéro et prévoir son maintien à jour pendant tout le développement**, avec un responsable de coordination documentaire, la contribution de chaque pôle, des renvois cohérents vers `AGENTS.md` et la spécification des interfaces, et un contrôle avant chaque merge. **Les revues Claudex doivent être opérationnelles dès les premiers changements de code.** **Il devra aussi fournir le protocole de kickoff inter-agents, le modèle de spécification partagée et la procédure de gestion des changements d'interface, ainsi que des messages de lancement propres à chaque pôle, à exécuter seulement après accord collectif et GO humain.**

**Principe directeur confirmé par toute l'équipe :**

> **« Construire d'abord un MVP fonctionnel de bout en bout, intégrer les trois pôles au plus tôt, puis enrichir le produit uniquement si le temps disponible le permet. »**

---

## 15. Contrôle des décisions : ce qui a changé par rapport à l'ancien brief

| Sujet | Ancienne formulation pouvant induire en erreur | Décision actualisée |
|---|---|---|
| Choix du collatéral | Sélection/allocation « optimisée » multi-actifs | **Choix manuel KMMF OU obligation (`KBOND`) dans le MVP** |
| Portefeuille | Allocation simultanée de plusieurs classes envisagée | **Non requise** ; capacité de gérer les deux classes, scénario par scénario |
| Smart selection | Valeur centrale décrite comme optimisation | **Simple suggestion facultative après MVP** |
| Swap et CSA | Conventions/contrat à cadrer sans hypothèse explicite de signature | **Swap et CSA supposés déjà conclus** ; scénarios fixés en amont |
| Risque / oracles | Forte emphase sur l'authentification complète du défaut | **Contrôles minimaux crédibles**, pas de sécurité industrielle |
| Défaut | Interprétation possible de validation extérieure exhaustive | **Événement explicitement simulé, conditions déterministes simplifiées sur contrat** |
| Etherfuse | Souvent présenté comme risque majeur pouvant retarder le projet | **Confiance raisonnable** ; intégration pratique encore à tester ; repli `KBOND` |
| Démo | Vidéo parfois traitée comme unique livrable | **Vidéo + pitch deck + GitHub/README + réponses de soumission**, confirmés par l'organisateur ; **dépôt public et URL publique explorable** exigés (section 8.5) |
| Méthode | Évolution vers architecture complète avant livraison | **D'abord un MVP vertical et intégré**, sophistication ensuite |
| Organisation | Répartition proposée sans attribution définitive | **3 pôles / 3 machines / GitHub asynchrone validés**, personnes encore à attribuer |
| Intérêt économique | Coût d'opportunité du cash évoqué brièvement | **Explication renforcée : mobilisation d'actifs tokenisés déjà investis plutôt qu'immobilisation de cash dédié ; revenus et exposition possibles selon les conditions, simulés dans le MVP** |
| Etherfuse (mise à jour 19:45) | Stablebonds Etherfuse comme actif B, `KBOND` en repli | **`KBOND` est l'actif B du MVP** ; livraison sandbox v2 sur Testnet indisponible avant la deadline (confirmé par Etherfuse) ; Etherfuse abandonné, pas de piste P1 |
| Qualité de développement | Revue Claudex évoquée et README surtout comme livrable | **README existant restructuré dès la phase zéro et cohérent avec `AGENTS.md` et les interfaces partagées ; coordinateur documentaire ; maintenance à chaque changement pertinent ; revue/audit Claudex pour chaque changement de code avant merge** |
| Démarrage des trois pôles | Coordination Github décrite, mais aucun handshake avant codage | **Échanges croisés obligatoires entre agents, validation d'une spécification technique unique, READY/BLOCKED sur cette version et GO humain explicite avant le code ; changements d'interfaces communiqués et approuvés ensuite** |

---

## 16. Documents, ressources et limites de provenance

### Sources internes à ce transfert

1. Brief précédent : `KEYSTONE_BRIEF_COMPLET_POUR_CLAUDE.md` — contexte historique, décisions et réserves.
2. Nouvelles décisions d'équipe du 25/10/2026 — consignes de simplification du moteur, hypothèse CSA, approche MVP et priorités.
3. Échanges et vérifications précédentes de l'équipe sur GitHub, Stellar/Soroban, Claudex et les sandboxes ; les résultats de tests non effectués **ne sont pas présumés réussis**.

### Liens de référence externes (non synonymes d'intégration validée)

- Etherfuse Sandbox : https://sandbox.etherfuse.com/dashboard
- Etherfuse Developer Docs : https://app.etherfuse.com/legal/dev-docs
- Etherfuse test environment v2 (lien précédemment identifié) : https://docs.etherfuse.com/v2/test-environment
- Dépôt GitHub Keystone : https://github.com/Lagouze/keystone
- HackMeridian, règlement / évaluation : https://www.hackmeridian.com/build
- HackMeridian, programme / échéance : https://www.hackmeridian.com/schedule

**Prudence finale :** les décisions du groupe sont certaines **comme décisions du groupe** ; elles ne constituent pas une validation factuelle que chaque service externe, token ou API fonctionne déjà dans notre environnement. Inversement, une vérification technique qui reste à réaliser ne doit pas devenir une raison abstraite de repousser tout le travail.

**Fin du brief — à transmettre intégralement à Claude avant sa mission de planification.**
