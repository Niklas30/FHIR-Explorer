# FHIR-Explorer / Logo und Icons

Die gemeinsame Bildmarke ist ein kräftiges **F**, abgeleitet aus dem ersten
Buchstaben der Archivo-700-Wortmarke. Ein kompakter Pfeil nach rechts oben
ergänzt das F im freien Bereich. Er greift die Richtungspfeile der Website auf
und steht für das Entdecken und Verstehen des Modells.

Das F bleibt die dominante, auch klein erkennbare Form. Der Akzent ist auf
hellen Flächen dunkelorange, auf dunklen Flächen hellorange und im App-Icon
orange. Die einfarbige Variante integriert den Pfeil in derselben Farbe.
Diese Fassung ersetzt das bisherige Sechseck mit Pulslinie (Version 1).

## Quelle und Ausgabe

- `brand.json`: Name, Farben und skalierbare Flächenpfade für F und Pfeil.
- `type-paths.json`: Archivo-700-Schriftzüge als Vektorpfade. Abgeleitet aus
  der beigefügten OFL-lizenzierten Schrift; die SVG-Logos benötigen keine Fonts.
- `brand.css`: gemeinsame Wortmarke in Website und Web-App. Ihre Schrift wird
  lokal geladen und betrifft nur die Marke, nicht die übrige Produktoberfläche.
- `assets/`: erzeugte Varianten; `index.html` zeigt sie in tatsächlichen Größen.
- `../packages/ui/src/brand/BrandMark.tsx`: generierte gemeinsame React-Komponente.

```sh
npm run brand:build
# Mit separatem Checkout der Marketing-Website:
node scripts/build-brand-icons.mjs --marketing ../fhir-explorer-marketing
```

Der zweite Aufruf synchronisiert auch Website-Logo, Favicons, Apple-Icon,
Installations-Icons, Manifest-Assets und die Vorschau beim Teilen eines Links.
Die Marketing-Website enthält die erzeugten Dateien und kann unabhängig bauen.
`brand.json` und die Pfade werden hier gepflegt, nicht in den Ausgaben.

## Einsatz

- `logo.svg`: vollständiges Logo auf hellen Flächen; `logo-on-dark.svg` auf dunklen.
- `mark.svg`: transparentes Symbol; `mark-mono.svg` einfarbig.
- `icon.svg` und PNGs: dunkle Icon-Fläche, weißes F, orangefarbener Pfeil.
- `favicon.ico`: 16, 32, 48 und 256 Pixel, jeweils eigens gerastert.
- `apple-icon.png`: 180 Pixel; Installations-Icons 192/512 Pixel.
- `icon-maskable-512.png`: gefüllte Fläche, Symbol innerhalb des sicheren Kreises.
- VS-Code-Activity-Bar: einfarbig; Package-Tree: helle und dunkle Variante.

Keine Farbverläufe, Schatten oder Animationen im Logo. Nicht verzerren oder
als Fehler-/Warnsymbol verwenden. VS Code kontrolliert die Farbe seiner
Activity-Bar. Produktfarben und fachliche Statusfarben bleiben eigenständig.

Die Vorschau und ein lokales VSIX dienen der Prüfung. Die Veröffentlichung
der Website und ein Marketplace-Update sind separate Release-Schritte.
