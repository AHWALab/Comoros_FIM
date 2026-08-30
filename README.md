# Comoros_FIM

Visionneuse de probabilité d'inondation (FIM) pour l'Union des Comores, produite avec la chaîne TITO (EF5 CREST à 30 m, 50 membres StormLab et 10 membres d'analyse STREAM-Sat par cycle) pour les rétro-prévisions du 26 au 28 avril 2024 (72 cycles) et du 4 au 7 mai 2025 (96 cycles).

Flood inundation likelihood (FIM) viewer for the Union of the Comoros, produced with the TITO chain (EF5 CREST at 30 m, 50 StormLab members and 10 STREAM-Sat analysis members per cycle) for the hindcasts of 26 to 28 April 2024 (72 cycles) and 4 to 7 May 2025 (96 cycles).

Site: https://ahwalab.github.io/Comoros_FIM/ (page d'accueil bilingue / bilingual landing page), https://ahwalab.github.io/Comoros_FIM/fr/ (français), https://ahwalab.github.io/Comoros_FIM/en/ (English).

## Contenu / Content

| Chemin / Path | Contenu / Content |
|---|---|
| `index.html` | Page d'accueil, choix de la langue / landing page, language choice |
| `fr/index.html`, `en/index.html` | Visionneuse (Leaflet, rendu sur canevas des images de votes) / viewer |
| `assets/layers/<island>/<cycle>_v.png` | Votes des membres par seuil 0,10 / 0,30 / 0,70 m (RVB), EPSG 3857 / member votes per threshold (RGB) |
| `assets/layers/<island>/<cycle>_w.png` | Votes au seuil de 1,00 m / votes at the 1.00 m threshold |
| `assets/layers/<island>/static.png` | Masques de débordement, index des communes, couverture / overbank masks, commune index, coverage |
| `assets/data/cycles_<event>.js` | Statistiques par cycle, île et commune / per cycle, island and commune statistics |
| `assets/data/communes.js`, `reports.js`, `grid.js` | Limites des 55 communes, impacts rapportés, géométrie des grilles / commune boundaries, reported impacts, grid geometry |

Les 55 communes sont couvertes par des mosaïques par île (EPSG 5629, règle de la commune propre, commune la plus proche sur la frange côtière), pour les quatre seuils de profondeur, les variantes brute et débordement, et les 168 cycles. La légende, les tableaux par commune, la chronologie du débit unitaire maximal par île et les impacts rapportés du SIDS Flash Flood Compendium sont disponibles dans les deux langues.

The 55 communes are covered by island mosaics (EPSG 5629, own commune rule, nearest commune on the coastal fringe), for the four depth thresholds, the raw and overbank variants and the 168 cycles. Legend, commune tables, island timeline of the maximum unit streamflow and reported impacts from the SIDS Flash Flood Compendium are available in both languages.

## Notes

- Les produits FIM des 54 communes absentes de l'archive de rétro-prévision ont été recalculés à partir des membres archivés et des bibliothèques du dépôt, et validés sur la commune conservée (Vouani, 168 cycles identiques). / The FIM products of the 54 communes missing from the hindcast archive were recomputed from the archived members and the repository stores, and validated on the surviving commune (Vouani, 168 identical cycles).
- Le fond de carte nécessite une connexion; les couches du produit fonctionnent hors ligne. / The basemap needs a connection; the product layers work offline.
- Démonstration en rétro-prévision, pas une alerte officielle. / Hindcast demonstration, not an official warning.

Produits associés / related products: [Comoros_Warnings](https://ahwalab.github.io/Comoros_Warnings/), [Comoros_IFB](https://ahwalab.github.io/Comoros_IFB/).

AHWA Laboratory, The University of Iowa. Projet EWS-F financé par l'OMM / EWS-F project funded by the WMO.
