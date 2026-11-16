---
audience: dev
title: Eiffel Tower 3D stops and texts
status: planned
---
# Stops and texts (use as is)
> The 12 stops (id, photo, camera distance), the UI strings and the full EN/FR stop texts. Sections keep their numbers from the look file: 9, 10, 11.

## 9. The 12 stops (id, photo, camera distance step)
| # | id | photo | step | label EN |
|---|---|---|---|---|
| 1 | `stop_01_design_elevation_1889` | 55 | 11 | 1884-1889 · Designing the Tower |
| 2 | `1887_05_caissons` | 13 | 0.55 | 21 Apr 1887 · Foundation Caissons |
| 3 | `1887_07_base_shoes` | 09 | 1.5 | 18 Jul 1887 · Base Shoes |
| 4 | `1888_01_14_lattice_closeup` | 51 | 3.55 | 14 Jan 1888 · Central Timber Falsework |
| 5 | `1888_01_07_first_stage_timelapse_1` | 23 | 3.6 | 26 Mar 1888 · First-Floor Belt |
| 6 | `1888_06_12_second_stage_timelapse_2` | 14 | 4.85 | 15 May 1888 · Second-Stage Piers |
| 7 | `1888_09_14_self_supporting_timelapse_3` | 01 | 5.66 | 21 Aug 1888 · Second Platform |
| 8 | `1888_12_26_winter_ascent_timelapse_4` | 46 | 6.52 | 23 Nov 1888 · Upper Shaft at 216 m |
| 9 | `1889_05_completed_axial_timelapse_5` | 18 | 11 | May 1889 · Exposition Opening |
| 10 | `1889_summer_under_the_arch` | 36 | 11 | Summer 1889 · Lower Arch View |
| 11 | `1889_summer_coutan_basin` | 38 | 11 | Summer 1889 · Basin and Piers |
| 12 | `1889_hero_3d_showcase_finale` | none (3D hero) | 11 | 1889 · Complete 3D Tower |

## 10. UI strings EN / FR
| key | EN | FR |
|---|---|---|
| intro title | La Tour de 300 Mètres, 1887-1889 Archival Exhibit | La Tour de 300 Mètres, 1887-1889 (exposition d'archives) |
| intro subtitle | The 300-Meter Tower, 1887-1889, Champ-de-Mars, Paris | La Tour de 300 mètres, 1887-1889, Champ-de-Mars, Paris (guessed FR) |
| explore | Explore | Explorer |
| language toggle aria | Switch exhibition language (English / Français) | Changer la langue de l'exposition (English / Français) |
| nav aria | Exhibition language and view controls | Contrôles de langue et d'affichage de l'exposition |
Craftsmanship chips (stop 12), EN / FR: 'Overview - Full 300 m Elevation' / "Vue d'ensemble - Élévation de 300 m"; 'Detail I - Masonry Plinths and Cast Shoes' / 'Détail I - Socles en pierre et sabots de fonte'; the other three FR labels: guessed, translate in the same style.

## 11. Stop texts, EN + FR (use as is)
Each stop has: label, facts (a line of 2-3 facts split by ' · '), headline, caption. Photo ids match `photos/<id>_320.jpg`.

### Stop 1 · 1884–1889 · photo 55
- id: `stop_01_design_elevation_1889` · camera distance step: 11
- label EN: 1884–1889 · Designing the Tower
- label FR: 1884–1889 · Conception de la Tour
- facts EN: 125 m Base Span · Platforms at 58 m, 116 m, and 276 m · 312 m Tip
- facts FR: Emprise de 125 m · Étages à 58 m, 116 m et 276 m · Sommet à 312 m
- headline EN: Designing the 300-Meter Tower
- headline FR: La conception de la Tour de 300 mètres
- caption EN: Conceived in 1884 by engineers Maurice Koechlin and Émile Nouguier and refined with architect Stephen Sauvestre, Gustave Eiffel’s 1-to-1,000 elevation drawing defines the riveted iron structure across a 125-meter base, with platforms at 58, 116, and 276 meters beneath the 300-meter lantern and 312-meter flagpole.
- caption FR: Conçu en 1884 par les ingénieurs Maurice Koechlin et Émile Nouguier puis précisé avec l’architecte Stephen Sauvestre, ce plan d’élévation au millième de Gustave Eiffel fixe la structure en fer riveté sur une base de 125 mètres, avec trois étages à 58, 116 et 276 mètres jusqu’à la lanterne de 300 mètres et au mât de 312 mètres.

### Stop 2 · 21 April 1887 · photo 13
- id: `1887_05_caissons` · camera distance step: 0.55
- label EN: 21 Apr 1887 · Foundation Caissons
- label FR: 21 avr. 1887 · Caissons des fondations
- facts EN: 5 m Below the Seine Bed · West Pier Foundation Caissons
- facts FR: 5 m sous le lit de la Seine · Caissons de la pile ouest
- headline EN: Compressed-Air Foundation Caissons
- headline FR: Caissons à air comprimé des fondations
- caption EN: Photographed on 21 April 1887 during a visit by the Société centrale des architectes, the West Pier foundation pit beside the Seine shows sheet-iron caissons fitted with cylindrical airlocks. Pressurized air kept river water out while workers excavated gravel down to compact sand 5 meters below the riverbed.
- caption FR: Photographiée le 21 avril 1887 lors d’une visite de la Société centrale des architectes, la fouille de la pile ouest côté Seine montre les caissons en tôle équipés d’écluses cylindriques. L’air comprimé maintenait l’eau hors des chambres de travail pendant le creusement jusqu’au sable compact à 5 mètres sous le lit du fleuve.

### Stop 3 · 18 July 1887 · photo 09
- id: `1887_07_base_shoes` · camera distance step: 1.5
- label EN: 18 Jul 1887 · Base Shoes
- label FR: 18 juil. 1887 · Sabots d’appui
- facts EN: 12 m Height · Cast-Iron Base Shoes and Cast-Steel Counter-Shoes
- facts FR: Hauteur 12 m · Sabots en fonte et contre-sabots en acier moulé
- headline EN: Base Girders and Cast-Iron Shoes
- headline FR: Poutrelles de base et sabots d’appui
- caption EN: On 18 July 1887 at the West Pier, erection of the ironwork rises atop the masonry foundation blocks. Four inclined corner box-girders rest via cast-steel counter-shoes inside cast-iron base shoes bolted to sloped Château-Landon stone courses, with recesses in each shoe for 800-ton hydraulic alignment jacks.
- caption FR: Le 18 juillet 1887 à la pile ouest, le montage métallique s’élève sur les massifs de maçonnerie. Les quatre arbalétriers inclinés reposent par des contre-sabots en acier moulé dans des sabots en fonte boulonnés sur des assises inclinées en pierre de Château-Landon, munis de logements pour des vérins hydrauliques de 800 tonnes.

### Stop 4 · 14 January 1888 · photo 51
- id: `1888_01_14_lattice_closeup` · camera distance step: 3.55
- label EN: 14 Jan 1888 · Central Timber Falsework
- label FR: 14 janv. 1888 · Grandes charpentes centrales
- facts EN: 48 m Timber Scaffolds · Sand-Box Supports and Inner Girders
- facts FR: Charpentes de 48 m · Boîtes à sable et poutres intérieures
- headline EN: Central Timber Scaffolds at the First Platform
- headline FR: Grandes charpentes de bois au premier étage
- caption EN: Photographed on 14 January 1888 from the level of the first platform for Plate 5 of Eiffel’s monograph, this view looks across the 48-meter bolted central timber falsework towers and wooden trusses erected between the piers. Sand-box leveling cylinders crown the timber posts to position and rivet the inner box girders.
- caption FR: Prise le 14 janvier 1888 depuis le niveau du premier étage pour la planche 5 de la monographie d’Eiffel, cette vue d’ensemble montre les grandes charpentes centrales boulonnées de 48 mètres dressées entre les piles. Des boîtes à sable coiffent les poteaux de bois pour régler et riveter les poutres intérieures.

### Stop 5 · 26 March 1888 · photo 23
- id: `1888_01_07_first_stage_timelapse_1` · camera distance step: 3.6
- label EN: 26 Mar 1888 · First-Floor Belt
- label FR: 26 mars 1888 · Ceinture du 1er étage
- facts EN: 58 m First Platform Joined · Pier Pylons and Central Falsework
- facts FR: Jonction du 1er étage à 58 m · Pylônes et charpentes de bois
- headline EN: Joining the First-Floor Girders Across the Four Piers
- headline FR: Jonction des poutres du premier étage sur les quatre piles
- caption EN: Taken on 26 March 1888 along the Champ-de-Mars axis, this view records the completed junction of the 58-meter first-floor girders uniting all four inclined piers into a rigid portal. Twelve timber pier pylons and four central wooden scaffolds still support the horizontal belt before the decorative arches begin.
- caption FR: Prise le 26 mars 1888 dans l’axe du Champ-de-Mars, cette vue montre la jonction achevée des poutres horizontales du premier étage à 58 mètres, réunissant les quatre piles inclinées. Douze pylônes de bois et quatre échafaudages centraux soutiennent encore la ceinture avant le montage des arcs décoratifs.

### Stop 6 · 15 May 1888 · photo 14
- id: `1888_06_12_second_stage_timelapse_2` · camera distance step: 4.85
- label EN: 15 May 1888 · Second-Stage Piers
- label FR: 15 mai 1888 · Piles du 2e étage
- facts EN: 89 m Height · Pivoting Creeper Cranes Above the First Platform
- facts FR: Hauteur 89 m · Grues pivotantes au-dessus du premier étage
- headline EN: Second-Stage Piers and Climbing Creeper Cranes
- headline FR: Montée des piles du deuxième étage et grues grimpantes
- caption EN: On 15 May 1888, pivoting creeper cranes mounted on the internal elevator guide rails hoist ironwork up the four second-stage legs to 89 meters toward the 116-meter platform. Beneath the first-floor belt, the central timber scaffolds remain in place prior to erecting the four decorative arches.
- caption FR: Le 15 mai 1888, quatre grues pivotantes déplacées sur les chemins de roulement des ascenseurs hissent les piles du deuxième étage jusqu’à 89 mètres vers la plate-forme de 116 mètres. Sous la ceinture du premier étage, les charpentes centrales demeurent en place avant le levage des quatre arcs décoratifs.

### Stop 7 · 21 August 1888 · photo 01
- id: `1888_09_14_self_supporting_timelapse_3` · camera distance step: 5.66
- label EN: 21 Aug 1888 · Second Platform
- label FR: 21 août 1888 · Deuxième étage
- facts EN: 127 m Height · Second Platform Completed and Scaffolds Cleared
- facts FR: Hauteur 127 m · Deuxième étage achevé et échafaudages déposés
- headline EN: Completion of the Second Platform and Lower Arches
- headline FR: Achèvement du deuxième étage et des grands arcs
- caption EN: Photographed on 21 August 1888 for Plate 8 of Gustave Eiffel’s folio monograph, this axial view records the completed 116-meter second platform and its first upper panel at 127 meters. With all four 74-meter decorative arches closed and ground scaffolds cleared, the Palais du Trocadéro appears cleanly through the base.
- caption FR: Photographiée le 21 août 1888 pour la planche 8 de la monographie de Gustave Eiffel, cette vue axiale montre le deuxième étage achevé à 116 mètres et son premier panneau supérieur à 127 mètres. Les quatre arcs décoratifs de 74 mètres étant fermés et les échafaudages déposés, le Palais du Trocadéro se dégage sous l’arche.

### Stop 8 · 23 November 1888 · photo 46
- id: `1888_12_26_winter_ascent_timelapse_4` · camera distance step: 6.52
- label EN: 23 Nov 1888 · Upper Shaft at 216 m
- label FR: 23 nov. 1888 · Fût supérieur à 216 m
- facts EN: 216 m Height · Intermediate Transfer Deck and Central Arcade Bays
- facts FR: Hauteur 216 m · Plancher intermédiaire et arcades centrales
- headline EN: Upper Shaft Above the Intermediate Platform
- headline FR: Le fût au-dessus de l’étage intermédiaire
- caption EN: Taken on 23 November 1888, this view shows the merged upper iron column rising past the 196-meter intermediate elevator transfer platform to 216 meters, crowned by internal climbing cranes. Along the 58-meter first floor, the three central bays of the arched iron gallery frame are newly erected.
- caption FR: Prise le 23 novembre 1888, cette photographie montre la colonne supérieure élevée au-delà du plancher intermédiaire de transbordement à 196 mètres jusqu’à 216 mètres, coiffée par ses grues grimpantes. Au premier étage, à 58 mètres, les trois travées centrales de la galerie arquée sont déjà montées.

### Stop 9 · May 1889 · photo 18
- id: `1889_05_completed_axial_timelapse_5` · camera distance step: 11
- label EN: May 1889 · Exposition Opening
- label FR: Mai 1889 · Ouverture de l’Exposition
- facts EN: 300 m Lantern Terrace · 312 m Flagpole Tip
- facts FR: Terrasse du phare à 300 m · Sommet du mât à 312 m
- headline EN: Completed Tower from the Champ-de-Mars
- headline FR: La Tour achevée vue du Champ-de-Mars
- caption EN: Completed and inaugurated on 31 March 1889 after 26 months of work—before opening to visitors on 15 May during the 1889 Exposition Universelle—the tower rises in full axial elevation behind the Coutan fountain. Nine-bay glazed galleries and four restaurant pavilions occupy the first platform beneath the 276-meter third floor, the 300-meter electric beacon, and the 312-meter flagpole.
- caption FR: Achevée et inaugurée le 31 mars 1889 après 26 mois de travaux—avant son ouverture aux visiteurs le 15 mai lors de l’Exposition universelle de 1889—la tour s’élève en élévation complète derrière le bassin de Coutan. Galeries vitrées à neuf arcades et quatre restaurants occupent le premier étage, sous le troisième étage à 276 mètres, le phare électrique à 300 mètres et le mât à 312 mètres.

### Stop 10 · Summer 1889 · photo 36
- id: `1889_summer_under_the_arch` · camera distance step: 11
- label EN: Summer 1889 · Lower Arch View
- label FR: Été 1889 · Vue sous l’arc
- facts EN: 74 m Clear Arch Span · 39 m Arch Crown · Radial Spandrel Lattice
- facts FR: Portée libre de 74 m · Clef de l’arc à 39 m · Tympans rayonnants
- headline EN: Lower Arch and Central Dome View
- headline FR: L’arc inférieur et la vue vers le Dôme central
- caption EN: Photographed from beneath the tower looking southeast across the Champ-de-Mars toward Francis de Saint-Vidal’s circular fountain, Jules Coutan’s luminous fountain, and Joseph Bouvard’s Central Dome, this view details the 74-meter decorative arch and radial spandrel lattice just below the first-floor cornice frieze of 72 French scientists.
- caption FR: Prise sous la tour en regardant vers le sud-est à travers le Champ-de-Mars vers le bassin circulaire de Francis de Saint-Vidal, la fontaine lumineuse de Jules Coutan et le Dôme central de Joseph Bouvard, cette vue détaille l’arc décoratif de 74 mètres et ses tympans rayonnants juste sous la corniche portant les noms des 72 savants français.

### Stop 11 · Summer 1889 · photo 38
- id: `1889_summer_coutan_basin` · camera distance step: 11
- label EN: Summer 1889 · Basin and Piers
- label FR: Été 1889 · Bassin et piliers
- facts EN: 125 m Outer Plinth Span · Pier Plinths, Ticket Kiosks, and Lifts
- facts FR: Empattement de 125 m · Socles en pierre, guichets et ascenseurs
- headline EN: Fountain Basin and Pier Entrances
- headline FR: Bassin de la Tour et entrées des piliers
- caption EN: Exposition visitors gather around Francis de Saint-Vidal’s sculptural fountain basin beneath the southeast arch. Flanking the parvis, dressed Château-Landon limestone plinths and ground-level entrance kiosks serve the East and South piers, where staircases and inclined hydraulic elevators rise inside the iron legs.
- caption FR: Les visiteurs de l’Exposition entourent le bassin sculpté par Francis de Saint-Vidal sous l’arche sud-est. De part et d’autre du parvis, les socles en pierre de Château-Landon et les kiosques d’entrée desservent les piles est et sud, d’où montent les escaliers et les ascenseurs hydrauliques inclinés.

### Stop 12 · 1889 in 3D · photo none (hero 3D showcase)
- id: `1889_hero_3d_showcase_finale` · camera distance step: 11
- label EN: 1889 · Complete 3D Tower
- label FR: 1889 · Tour complète en 3D
- facts EN: 125 m Base · 58 m, 116 m, and 276 m Platforms · 312 m Summit
- facts FR: Base de 125 m · Étages à 58 m, 116 m et 276 m · Sommet à 312 m
- headline EN: Complete 1889 Tower in 3D
- headline FR: La Tour complète de 1889 en 3D
- caption EN: Inspect the reconstructed 1889 iron structure in three dimensions. Drag to orbit around the monument, select a structural detail below to examine the masonry plinths, 74-meter arches, 116-meter transfer deck, or 300-meter lighthouse cupola, or continue forward to return to Eiffel’s elevation drawing.
- caption FR: Examinez en trois dimensions la charpente métallique reconstituée dans son état de 1889. Faites pivoter la vue librement, choisissez un détail ci-dessous pour observer les socles maçonnés, les arcs de 74 mètres, le deuxième étage à 116 mètres ou le phare à 300 mètres, ou poursuivez pour revenir au plan d’élévation.


