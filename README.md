<img src="public/icon.svg" width="72" height="72" alt="Maelzel & Co. Metronome">

# Maelzel & Co. — Historical Mechanical Metronome Atelier

An authentic vintage mechanical metronome web application built with physical-modeled Web Audio synthesis, 60/120fps audio-clock-locked pendulum physics, and a decoupled core architecture ready for native **iPhone (iOS)** deployment via Capacitor or Home Screen PWA.

## Curated Historical Metronome Collection

1. **1815 Maelzel Pyramid** (*J. N. Maelzel, Paris*) — Cuban flame mahogany obelisk, hand-engraved brass scale, trapezoidal sliding brass bob, warm resonant wood soundbox, and side-mounted brass pull-bell.
2. **1895 Viennese Conservatory** (*Conservatorium, Wien*) — French-polished ebonized pearwood & nickel silver, scalloped counterweight, authoritative concert-hall click, and bright silver bell chime.
3. **1928 Manhattan Art Deco** (*Seth Thomas, U.S.A.*) — Stepped ziggurat amber tortoiseshell Bakelite cabinet, cream celluloid scale, octagonal chrome weight, and punchy parlor snap.
4. **1954 Taktell Piccolo** (*Isny im Allgäu, Germany*) — Mid-century vintage ivory pocket column with crimson inner bezel and surgical German spring-steel click.
5. **1796 Breguet Chronometer** (*Quai de l’Horloge, Paris*) — Open-escapement fire-gilded ormolu brass frame with live rotating escapement wheel, blued steel rod, lens bob, and crystalline bell chime.

## Tactile & Acoustic Features

- **Direct Counterweight Dragging**: Grab and slide the counterweight directly up or down the pendulum rod (higher = slower tempo, lower = faster tempo, faithful to compound pendulum physics).
- **Authentic Maelzel Scale Detents**: Toggle between authentic historical Maelzel scale steps (`40, 42, ..., 208`) and continuous `1 BPM` fine tuning.
- **Physical-Modeled Web Audio Engine**: Synthesizes cabinet cavity resonance, double-escapement pallet asymmetry (*tick* vs. *tock*), striker bell partials, weight detent clicks, and mainspring ratchet winding with zero external audio file dependencies.
- **Pull-Bell Drawbar & Beat Matrix**: Pull out the brass bell knob on the cabinet side or click individual beat orbs to cycle between **Bell (`🔔`)**, **Accent (`▲`)**, **Normal (`•`)**, and **Rest (`×`)**, plus Quarter, Eighth, Triplet, Sixteenth, and Swing subdivisions.
- **Web Studio + iPhone App View**: Switch between the multi-column desktop Atelier Studio and a full iPhone 16 Pro interactive frame preview directly in the top bar.

## Development

```bash
npm install
npm run dev
```

## Native iPhone (iOS) Deployment

All timing, physics, and synthesis live in `src/core/` with zero DOM dependencies, paired with `capacitor.config.json` and iOS PWA / WakeLock / touch-unlock support:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npm run build
npx cap add ios
npx cap open ios
```
