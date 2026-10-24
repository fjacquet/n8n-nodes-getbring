# n8n-nodes-getbring — conception v1

Date : 2026-10-24 · Auteur : Fred Jacquet (avec Claude)

## Intention

Nœud communautaire n8n pour les listes de courses Bring!. Aucun nœud Bring n'existe dans n8n : chaque workflow doit aujourd'hui refaire login, headers `X-BRING-*`, clé API, choix de liste et traduction catalogue à la main (cas réel : workflow « paprika-to-bring » de Fred, construit en HTTP Request).

Le nœud est un **portage TypeScript de [miaucl/bring-api](https://github.com/miaucl/bring-api)** (Python, MIT). Toute la logique (endpoints, headers, format batch, traduction) vient de là ; le crédit leur revient.

Esprit : projet open source, publié sur npm à la fin, propre et vérifiable par n8n. « Généreux » = rendre le travail à la communauté et créditer honnêtement, **pas** couvrir toute l'API ni en faire trop.

## Objectifs v1

Trois ressources, chacune dans le nœud `Bring`.

**List**
- *Get Many* : listes de l'utilisateur (`GET /rest/bringusers/{uuid}/lists`).
- *Get Items* : articles d'une liste (`GET /rest/v2/bringlists/{listUuid}`), noms retraduits clé → langue de la liste. *(Choix Claude)* Une sortie n8n unique, un item n8n par article, avec champ `status` (`purchase` / `recently`), plus `key` (clé allemande), `name` (traduit), `specification`, `uuid`. Option « Include Recently » (défaut : non).

Sélection de liste *(choix Claude)* : `resourceLocator` standard n8n, modes « From List » (dropdown, stocke l'UUID), « By Name » (lookup à chaque exécution ; nom introuvable ou en double = erreur explicite) et « By ID ». Le mode By Name sert les workflows comme paprika-to-bring.

**Item** — tout passe par `PUT /rest/v2/bringlists/{listUuid}/items` (`batch_update_list`, `bring.py` ~l.1071), un seul appel pour tous les items d'entrée.
- *Add* (`TO_PURCHASE`), *Remove* (`REMOVE`), *Complete* (`TO_RECENTLY`).
- Champs : liste (dropdown via loadOptions, sélection par nom), nom de l'article, spécification (optionnelle).
- Traduction activée par défaut (option pour la couper).
- *(Choix Claude)* Batch : items d'entrée regroupés par liste résolue, un PUT par liste. Si un PUT échoue, tous ses items sont en erreur (avec `continueOnFail` : item d'erreur pour chacun ; sinon le nœud échoue). En succès, chaque item sort avec son entrée + `key` envoyée, `name`, `specification`, `uuid`, `listUuid`, `operation`.
- *(Choix Claude)* UUID d'article : Add génère un `uuid` (`crypto.randomUUID()`) et le renvoie. Remove/Complete acceptent un `uuid` optionnel ; sans UUID, ciblage par nom comme bring-api (Bring agit sur la correspondance la plus récente) — documenté dans le README.
- Champ nom : suggestions depuis le catalogue (loadOptions / resourceLocator avec saisie libre autorisée) — à confirmer si l'UX n8n le permet proprement ; sinon champ texte simple.

**Catalog**
- *Get* : paires `{ key, name }` pour une locale (défaut : langue de la liste choisie, ou locale explicite). Usage libre : validation, dropdown, prompt d'IA. Le nœud ne suppose aucune IA.

## Traduction (cœur du nœud)

Bring n'accepte comme article catalogue que la **clé interne allemande** (`Zwiebeln`) ; l'appli l'affiche ensuite traduite (« Oignons ») avec icône et rayon. Un autre nom crée un article perso sans icône.

Reprendre la logique de bring-api (`__translate`, `__locale`, `__load_article_translations`, `bring.py` l.761-1008) :
- Locale de la liste = `listArticleLanguage` dans `GET /rest/bringusersettings/{uuid}`, sinon locale du compte (`GET /rest/v2/bringusers/{uuid}` → `userLocale`, mappée via `MAP_LANG_TO_LOCALE`).
- `de-CH` (défaut Bring) : pas de traduction.
- Nom absent du catalogue : envoyé tel quel (article perso). Une clé allemande envoyée telle quelle doit aussi passer.
- **Écart volontaire** : comparaison insensible à la casse (« oignons » → `Zwiebeln`). Pas de correspondance floue (singulier/pluriel) : erreurs silencieuses, reste du ressort de l'amont.
- **Catalogues embarqués** : copier les 20 `bring_api/locales/articles.*.json` (252 Ko, MIT, crédités) dans le paquet. Raison : le fichier embarqué fr-CH a 385 entrées, celui de `web.getbring.com/locale/` est plus petit (9 Ko vs 11 Ko) ; bring-api privilégie aussi le fichier local. Pas de téléchargement à l'exécution.

## Credential « Bring API »

- Email + mot de passe (password masqué).
- Test du credential = `POST /rest/v2/bringauth` (form-urlencoded `email`, `password`).
- Login à chaque exécution du nœud (une fois par exécution, pas par item) ; pas de stockage/rafraîchissement de token.
- Headers après login, comme `bring.py` l.200-295 : `X-BRING-API-KEY` (constante de `const.py`), `X-BRING-CLIENT: android`, `X-BRING-APPLICATION: bring`, `X-BRING-COUNTRY` (pays de `userLocale`), `X-BRING-USER-UUID`, `X-BRING-PUBLIC-USER-UUID`, `Authorization: <token_type> <access_token>`.

## Crédits et licence

- **README**, section « Credits » courte : portage TypeScript de miaucl/bring-api, avec lien. Pas de liens sponsor, pas de chaîne de dérivation complète (leur README la cite déjà).
- **Disclaimer mot pour mot** : « The developers of this module are in no way endorsed by or affiliated with Bring! Labs AG, or any associated subsidiaries, logos or trademarks. »
- **LICENSE** MIT : lignes de copyright de bring-api (Cyrill Raccaud 2024, Manfred Dennerlein Rodelo 2024) conservées, puis Fred Jacquet 2026.
- Commentaire en tête des fichiers qui portent du code bring-api, renvoyant à la fonction Python d'origine.

## Contraintes

- Conventions nœud communautaire n8n : scaffold `@n8n/node-cli`, `n8n-node lint` vert, `npx @n8n/scan-community-package` vert, nom `n8n-nodes-getbring`, mot-clé `n8n-community-node-package`, licence MIT.
- **Zéro dépendance runtime** (exigence vérification) : HTTP via `this.helpers.httpRequest` / `httpRequestWithAuthentication`.
- Erreurs : `NodeApiError` / `NodeOperationError` avec message Bring lisible ; 401 au login = message « identifiants invalides ». Supporter `continueOnFail`.
- Jamais de mot de passe ou token dans la sortie ni dans les logs.

## Non-objectifs v1

Notifications, compte/réglages utilisateur, existence d'un email, membres et activité de liste, langue de liste, recettes (`parse_recipe`), modèles, inspirations, renommage d'article, attributs d'article. À ajouter si demandé.

## Anti-objectifs

- Dépendre d'une IA ou d'un service externe autre que Bring.
- Faux succès : un PUT en erreur doit faire échouer l'item.
- Laisser croire à un produit officiel Bring! (nom, icône, texte).

## Publication (fin de projet)

Repo GitHub public, publication npm depuis GitHub Actions avec provenance (exigence vérification n8n), puis demande de vérification n8n.

## Vérification

1. Tests unitaires (mock HTTP) : traduction (exacte, casse, absent, clé allemande directe, de-CH), construction du body batch, choix de locale.
2. Lint + scan communautaire verts.
3. Test réel sur instance n8n locale (Docker) : Add de 2 articles « Oignons » + « Test n8n » sur une liste de test → « Oignons » avec icône, l'autre perso ; Get Items les relit ; Remove les enlève.

## Laissé au builder

Structure des fichiers, découpage interne (client, traduction, descriptions), framework de test, icône SVG (générique panier, pas le logo Bring!), version n8n minimale, texte du README.
