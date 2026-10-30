# Verification / Ověření

Version 3.0 · 30 October 2026 / 30. října 2026

## English

The following checks were run locally on the release candidate:

- JavaScript syntax checks
- Field periodicity, E/B orthogonality, positive propagation direction and constant circular-polarization amplitude
- Spherical-shell phase, periodicity and propagation speed
- First-visit language selection: cs-CZ selects Czech; en-US and de-DE select English; a saved manual choice overrides the browser language
- Czech/English switching while retaining frequency and phase settings
- Locale-specific numerical formatting and language persistence after reload
- String, sound and all three electromagnetic display modes
- Help, equation, about and manual installation dialogs
- Viewport widths of 320, 360, 390, 768 and 1440 pixels; mobile landscape at 844 × 390
- Mobile layout and bilingual iOS install instructions in Chromium and Playwright WebKit 26.5
- Simulated install events: dismissed prompt fallback, installed-state persistence and iOS standalone detection
- Service-worker caching and a successful offline reload in English, followed by switching to Czech offline

Browser checks use isolated headless Google Chrome and Playwright WebKit 26.5 with reduced motion enabled. WebKit checks exercise the browser engine on Linux, not Safari on an Apple device. Native installation events are simulated for the UI checks. Representative desktop and mobile screenshots were inspected. These checks do not establish compatibility with every browser, graphics driver or device. Installation on physical iOS/Android devices was not tested in this release pass.

### Manual reproduction

1. Serve the application over localhost and wait for the offline-ready message.
2. Set the string frequency to 2.5 Hz. Check T = 0.40 s and λ = 1.60 m.
3. Pause, step once, and switch between CS and EN. The parameter values and paused state must remain unchanged; the decimal separator follows the language.
4. Select sound. At 80 Hz and 340 m/s, check T = 12.50 ms and λ = 4.25 m.
5. Select each electromagnetic view. The spherical-wavefront view must disable amplitude and label the graph as dimensionless phase.
6. Inspect help, accessible labels and the exported PNG in each language.
7. Reload offline after caching. Both languages must remain available.

The mathematical tests check the implemented ideal model; they do not validate an antenna model, measured sound speed or real optical behaviour. The spherical view is explicitly schematic.

## Česky

Lokálně byly ověřeny syntaxe JavaScriptu, periodicita a geometrie polí, směr šíření, stálá velikost kruhově polarizovaného pole a fáze i rychlost vlnoploch. První návštěva s cs-CZ zvolila češtinu, en-US a de-DE angličtinu; uložená ruční volba měla přednost. Prohlížečové kontroly pokryly oba jazyky, zachování nastavení, formátování čísel, všechny režimy, dialogy, šířky 320/360/390/768/1440 px a telefon na šířku 844 × 390 a offline načtení.

Kontroly proběhly v izolovaném headless Google Chrome a Playwright WebKit 26.5 s omezením pohybu. WebKit na Linuxu ověřil mobilní rozložení a instalační postup v obou jazycích. Instalační události byly simulované; nejde o Safari na zařízení Apple. Reprezentativní snímky desktopu a mobilního zobrazení byly vizuálně zkontrolovány. Nejde o ověření všech prohlížečů, ovladačů a zařízení. Instalace na fyzickém iPhonu nebo Androidu v této revizi ověřena nebyla.

Pro ruční kontrolu spusť lokální server, vyčkej na připravený offline režim a nastav strunu na 2,5 Hz. Perioda má být 0,40 s a vlnová délka 1,60 m. Po pozastavení a kroku přepni jazyk: parametry i pozastavení musí zůstat. U zvuku při 80 Hz a 340 m/s ověř 12,50 ms a 4,25 m. Projdi všechny EM režimy, dialogy, přístupné popisky a PNG export. Po načtení offline musí fungovat oba jazyky.
