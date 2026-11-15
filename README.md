# A.S.T.R.A. Space · Version publique

A.S.T.R.A. Space relie une station de suivi des séances à son compagnon Expo. Cette version web permet de faire tourner le parcours complet avec un profil fictif, dans un navigateur et sans inscription. La station FastAPI calcule l’ajustement à partir des séances. Les deux écrans interrogent la même base SQLite pour le visiteur.

## Lancer sous Windows

1. Extraire le ZIP dans un dossier. Installer Python 3.13 et le lanceur Windows `py` si nécessaire.
2. Dans PowerShell, depuis le dossier extrait, lancer les commandes ci-dessous. Le premier lancement installe les dépendances Python. Le compagnon Expo Web est déjà compilé.

```powershell
.\Demarrer_ASTRA.cmd --check
.\Demarrer_ASTRA.cmd
```

Ouvrir [le compagnon](http://127.0.0.1:8010/), [la station](http://127.0.0.1:8010/station) ou [la présentation en anglais](http://127.0.0.1:8010/presentation). Pour changer de port, utiliser `.\Demarrer_ASTRA.cmd --port 8011`. Arrêter le serveur avec Ctrl+C. Si le code Expo est modifié, exécuter `.\Construire_web.cmd` avec Node.js et npm pour régénérer `station/web`.

## Parcours de vérification · environ deux minutes

1. Ouvrir le compagnon et choisir **Inès Diallo**. Vérifier que le programme initial est à **100 W** et que Nova est **Bébé**.
2. Depuis **Profil et station**, **Importer la séance 3**. Relancer l’import et vérifier que la même séance n’est comptée qu’une fois.
3. Choisir **Calculer l’ajustement**, puis **Simuler la revue spécialiste** et **Simuler l’approbation de bord**. Entre le calcul et l’approbation, le plan actif est toujours à **100 W**.
4. Revenir dans **Mon suivi**, ouvrir **GO** et vérifier **105 W**. Poser une question guidée. Dans **Mon chat**, vérifier que Nova est devenue **Jeune**. Dans la console, choisir **Mode repos** pour essayer le rappel.
5. Ouvrir `/station` dans un autre onglet du même navigateur. Il affiche le même dossier. En navigation privée, un nouveau profil Inès démarre à **100 W**.

Le scénario CEVIS est fictif. Les validations et la période de repos sont simulées. La discussion utilise des réponses locales. Les espaces expirent après 30 minutes et un redémarrage les efface. La version accueille jusqu’à 32 espaces simultanés sur un processus. Le portail d’envoi par les proches et les interfaces d’équipement sont hors du périmètre public. Utiliser les scénarios et des images d’essai pour les interactions avec Nova.

## Mettre en ligne

1. Créer un dépôt GitHub vide. Depuis le dossier extrait qui contient le Dockerfile, exécuter les commandes ci-dessous en remplaçant TON-COMPTE par le nom de ton compte GitHub. Conserver `station/web` dans le dépôt, car le conteneur embarque cet export. Vérifier vos droits et attributions pour les ressources figurant dans les dossiers sources.

   ```powershell
   git init -b main
   git config core.longpaths true
   git add .
   git commit -m "Publier la version web ASTRA Space"
   git remote add origin https://github.com/TON-COMPTE/astra-space-public.git
   git push -u origin main
   ```

2. Sur un hébergeur de conteneurs, créer un **service web** depuis le Dockerfile à la racine. Sur Render, choisir le runtime **Docker**, une instance et le chemin de contrôle **`/healthz`**. La commande du Dockerfile est déjà configurée. [Déploiement Docker sur Render](https://render.com/docs/docker)
3. Configurer le proxy HTTPS de l’hébergeur pour transmettre le nom d’hôte et `X-Forwarded-Proto: https`. Définir `FORWARDED_ALLOW_IPS` sur les adresses du proxy. Sur un service Render où seul le proxy de l’hébergeur peut accéder au port d’écoute du conteneur, `FORWARDED_ALLOW_IPS=*` permet à Uvicorn de récupérer ce protocole. [Services web Render](https://render.com/docs/web-services) · [Paramètres Uvicorn](https://www.uvicorn.org/settings/)
4. Sur un autre réseau, ouvrir l’URL publique en navigation privée, vérifier `/healthz` et refaire le parcours. Utiliser l’URL HTTPS de l’application dans le champ **Projet**. Utiliser un lien public distinct pour la vidéo ou le diaporama.

## Présentation de candidature · proposition de montage

| Temps | À montrer à l’écran | Texte anglais |
|---|---|---|
| 0–5 s | Historique d’Inès avec son objectif | “On long missions, crew members need to understand how their training compares with their individual plan.” |
| 5–13 s | Import CEVIS et calcul dans la station | “A.S.T.R.A. Space compares three exercise sessions against the crew member’s target.” |
| 13–21 s | Revue spécialiste et approbation de bord | “The station proposes a bounded adjustment. A specialist and mission lead review it before release.” |
| 21–30 s | GO à 105 W, puis Nova | “The companion shows the approved plan. Nova grows as sessions are confirmed.” |

Afficher « Synthetic data · Simulated CEVIS » à l’image. Les valeurs illustrent le parcours. La base documentaire cite notamment le [NASA Exercise Overview](https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/).
