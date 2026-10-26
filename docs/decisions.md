# Journal des décisions

Chaque décision structurante est consignée ici : date, décision, qui l'a prise. Une décision prise en commentaire d'Issue n'est valable qu'une fois recopiée dans ce fichier.

| # | Date | Décision | Par |
| --- | --- | --- | --- |
| A1 | 2026-10-25 | Attribution des pôles. Contrat : Liel (Windows, Codex seul). Keeper et coordination documentaire : Grégoire (Mac). Front : Nathan (Mac). | Équipe |
| A2 | 2026-10-25 | Le fonds signe ses dépôts et retraits dans **Freighter**. Le keeper prépare ces transactions, puis les soumet. Il signe lui-même ses propres opérations : déploiement d'un vault, `post_margin`, `settle_default`. Le mode `SIGNER=keeper` (le keeper signe avec la clé du fonds de démo) sert au script e2e, à l'URL publique et au repli. | Équipe |
| A3 | 2026-10-25 | Défaut = appel de marge non couvert à l'expiration d'un délai de grâce fixé au déploiement du vault (90 s en démo). Le règlement est vérifié on-chain et n'importe qui peut le soumettre. | Équipe |
| A4 | 2026-10-25 | Notionnel de 10 M€. Les prix unitaires des tokens sont simulés et affichés comme tels. | Équipe |
| A5 | 2026-10-25 | Claudex installé sur les trois machines. Le Windows n'a que Codex. Chaque Mac a son propre Claude Pro. Le compte ChatGPT Plus est partagé entre les trois machines. Les PR du contrat sont relues par Claude Code sur le Mac de Grégoire. | Équipe |
| A6 | 2026-10-25 | Paramètres financiers validés : le fonds paie le fixe et reçoit l'Euribor 3 mois ; 10 M€ ; 5 ans, trimestriel ; K égal au taux de départ ; seuil 0 ; MTA 50 000 € ; délai de grâce 90 s. KMMF : 1 000 € par part, décote 2 %. | Équipe |
| A7 | 2026-10-25 | Deux actifs fictifs émis par l'équipe sur Testnet, en EUR : **KMMF** (fonds monétaire tokenisé) et **KBOND** (obligation souveraine tokenisée, 1 000 € par unité, décote 2 %, pas de décote de change). **Etherfuse est abandonné**, détail ci-dessous. | Équipe |
| A8 | à trancher | Hébergement de l'URL publique exigée par le règlement : front statique + keeper Node en `SIGNER=keeper`. Décision au jalon J2 (01:30), confiée au pôle keeper. | — |
| A9 | 2026-10-25 | **Claudex abandonné** ; Codex n'est plus utilisé sur les Mac (quota épuisé, réservé à Liel). Un seul agent par machine : Claude Code sur les Mac, Codex sur le Windows de Liel. La revue de chaque PR est faite par un sous-agent Claude neuf sur la machine de l'auteur (session Codex neuve sur le Windows, qui n'a pas Claude). Les PR du contrat sont relues par Liel lui-même avec la grille renforcée, et Codex fait une passe de relecture en fin de tâche ; plus de relecture depuis le Mac de Grégoire. Les agents ne relisent que les sections utiles des documents, jamais `docs/brief.md` en entier. Remplace A5 pour la revue. Détail dans `AGENTS.md` section 7. | Grégoire |
| A10 | 2026-10-26 | **Autorisation exceptionnelle de fusion donnée à l'agent keeper** (Claude Code, Mac de Grégoire), limitée aux PR #15 (keeper C1) et #16 (contrat C2), dans cet ordre, après vérification de l'intégration commune sur `staging` (`npm ci`, typecheck, 93 tests TypeScript, `cargo test --locked` 18 verts, `stellar contract build`, builds, absence de secrets et de doublons iCloud). Déroge à AGENTS.md section 3 pour ces deux PR seulement. Aucune revue humaine du diff n'a été faite par l'agent ; la lecture du diff du contrat par Liel reste due. Fusions : #15 `02accc0`, #16 `92dabc5`. Les crédits Codex de la machine du contrat étant épuisés, l'agent keeper intervient aussi sur `contracts/` et `packages/vault-client/` pour cette mission uniquement. | Grégoire |
| A11 | 2026-10-26 | **Délégation exceptionnelle de la revue C2** : Liel, responsable du pôle contrat, remplace pour la finalisation de la PR #18 sa lecture humaine du diff C2 (A9, AGENTS.md section 7) par une revue de sécurité indépendante et renforcée faite par un sous-agent Claude neuf (grille renforcée, contrat `lib.rs`, `test.rs`, bindings, compatibilité keeper). **Cette revue est automatisée, pas une revue humaine de Liel.** Verdict : PASS, aucun défaut bloquant ; 18 tests Rust verts. Réserves à traiter : (1) test de borne `call_deadline - 1` refusé / `call_deadline` accepté ; (2) documenter dans interfaces 3.7 le risque d'une banque ou d'un fonds sans trustline ou gelé par l'émetteur (règlement ou retrait bloqué) ; (3) le TTL d'instance n'est prolongé que par les écritures : prévoir un bump pour une démo longue. La PR #18 est fusionnée (`e91bda6`) sur cette base. | Liel (délégation à l'agent keeper) |

## Détail A7 : test Etherfuse du 25 octobre

Test réalisé par Grégoire entre 18:35 et 19:40, dans la sandbox Etherfuse (API v2) :

1. KYB sandbox validé.
2. Wallet Freighter Stellar Testnet enregistré.
3. Compte bancaire fictif ajouté.
4. Ordre « Buy CETES » de 500 MXN créé, puis financé avec « Simulate Fiat Received ».

L'ordre est resté en « Processing ». Aucune livraison et aucune claimable balance n'ont été constatées sur Horizon Testnet. Le lien « Transaction » de l'ordre renvoyait vers stellar.expert Testnet, avec un identifiant qui n'a pas le format d'un hash Stellar.

Réponse de l'équipe Etherfuse sur le groupe de support du hackathon : cette fonctionnalité fait partie de celles de la nouvelle API v2 encore incomplètes, et devrait fonctionner en fin de journée le 26 octobre, donc après la deadline de soumission (26 octobre, 12:00).

## Exigences officielles de soumission (vérifiées le 25 octobre, 19:48)

**Pour tous les projets :**

- dépôt GitHub public ;
- README couvrant le résumé, le problème, le setup, l'installation, les variables d'environnement et les instructions de démo ;
- vue d'ensemble de l'architecture et de l'usage de Stellar (actifs, ID de contrats, wallets, intégrations, API) ;
- démo live ou vidéo, plus une URL publique pour une application utilisateur ;
- preuve d'une transaction on-chain sur Testnet ;
- déclaration du travail antérieur.

**Pour le chemin Genesis :**

- un MVP fonctionnel (une maquette interactive seule est insuffisante) ;
- sur Testnet ;
- au moins une primitive ou intégration Stellar ;
- un travail technique significatif réalisé pendant le hackathon ;
- l'explication du problème, de l'utilisateur cible et de la proposition de valeur.
