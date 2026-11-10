# Jokerito — prototype inspiré de Balatro

Prototype jouable de roguelike de poker (type Balatro) en HTML/CSS/JavaScript vanilla, sans dépendance ni build.

> Hommage non affilié à LocalThunk / Playstack. Mécaniques réimplémentées, aucun asset ni texte original repris.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur (double-clic suffit, aucun serveur requis).

## Règles implémentées

- Deck de 52 cartes, main de 8, sélection de 1 à 5 cartes
- 4 mains et 3 défausses par blinde
- 9 mains de poker détectées (Carte Haute → Quinte Flush), scoring **Jetons × Mult**
- 3 Antes × 3 Blindes (Petite / Grosse / Boss), cibles croissantes : 300 → 800 → 2000 (×1 / ×1.5 / ×2)
- 8 Blindes Boss : suit débuffée, 5 cartes obligatoires, -1 carte en main, 0 défausse, cible ×2…
- 15 Jokers à effets déclaratifs (+Jetons, +Mult, ×Mult conditionnels)
- Boutique : 2 Jokers + 1 carte Planète (améliore un niveau de main), recharge à 5 $
- Économie : récompense de blinde + 1 $ par main restante + intérêts (1 $ par 5 $ détenus, max 5)
- Vente de Jokers (moitié du prix d'achat), tri de la main par rang ou couleur

## Structure

```
index.html        Point d'entrée
style.css         Habillage (feutre vert, cartes, animations)
engine.js         Moteur pur, sans DOM : deck, RNG à seed, détection de mains,
                  scoring Jetons × Mult, Jokers, Planètes
game.js           Interface et boucle de jeu (machine à états : menu → blindes → boutique → fin)
test-engine.js    Tests Node du moteur
```

## Tests

```bash
node test-engine.js
```

31 tests : détection des 9 mains (dont quinte As bas/haut), cartes scorées par type de main,
chaque catégorie de Joker, débuff de Boss, niveaux de main, reproductibilité du RNG,
et simulation de 500 tirages aléatoires (scores finis et positifs).

## Points d'architecture

- **Jokers déclaratifs** : chaque Joker est une donnée `{ id, name, cost, desc, onCardScore?, onHandScore? }`.
  Le moteur d'évaluation parcourt les cartes scorées puis les Jokers de gauche à droite —
  ajouter un Joker = ajouter un objet, sans toucher au moteur.
- **Journal de scoring** : `evaluate()` renvoie un `log` pas à pas que l'UI anime
  (carte par carte, Joker par Joker), comme le décompte de Balatro.
- **RNG à seed** (mulberry32) : parties reproductibles, utile pour le debug et l'équilibrage.

## Extensions naturelles

- Économie élargie : paquets/Vouchers, cartes Tarot (enhancements du deck)
- Éditions de cartes (Foil, Holo, Néon) et enhancements (Verre, Acier, Dorée)
- Plus d'Antes avec courbe exponentielle, challenges, seed partageable
- Sauvegarde `localStorage`, sons, animations plus riches
