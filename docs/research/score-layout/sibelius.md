# Sibelius 24.3.1 and the score-layout side of MusicXML

Research date: 2026-09-29. Sibelius 24.3.1 (build 3317) at `/Applications/Sibelius.app`, English UI.
Written for the exporter in `src/notation/musicxml.ts`, which writes MusicXML 4.0 partwise for a score in C
(`docs/decisions/0017-score-in-c.md`).

This is a companion to `docs/research/sibelius-musicxml-import.md` (the repository's note, not modified).
That note already has: the File > Open dialog options, the manual's Limitations table, the measured survival of
notation elements (quarter tones, articulations, text, instrument changes…), and a test plan.
This note does not repeat those. It adds how Sibelius itself models score layout, what the importer is documented
to do with `<part-list>`, names, instruments and page setup, and what that means for the exporter and for the
finishing work in Sibelius.

## How to read this note

Evidence labels:

| Label | Meaning |
| --- | --- |
| [manual] | *Sibelius Reference Guide* bundled with 24.3.1 (`Sibelius Help/Sibelius Reference.pdf`, "Sibelius 2024.3", 812 pp.). Page numbers are the printed ones (PDF page − 5). |
| [ManuScript] | *ManuScript Language* guide bundled with 24.3.1. Printed page numbers (PDF page − 5). |
| [tutorials] | *Sibelius Tutorials* bundled with 24.3.1. Printed page numbers. |
| [6.1 notes] | "Changes in Sibelius 6.1" (sibelius.com PDF, last updated 3 Sep 2009), fetched from the web. |
| [2024.10 notes] | "What's New in Sibelius versions 2024.3–2024.10" (resources.avid.com PDF), fetched. Not in 24.3.1. |
| [forum] | Old sibelius.com help-center threads, fetched. Not verified against 24.3.1. |
| [bundle] | Files inside the app: `Contents/Components/MusicXML/musicxml.xsd` (MusicXML 4.0 XSD), `sounds.xml` (MusicXML 4.0 standard sounds, 894 ids), strings in the executable. |
| [measured] | Results already recorded in the companion note (not re-measured here). |
| [inference] | My reasoning from the above. Needs an import test before relying on it. |

Quotations: the manuals are Avid's copyright, so this note paraphrases and gives section titles and page numbers
instead of quoting sentences (one short quote only). Menu paths and option names are given verbatim because they are UI labels.
The bundled `What's New.pdf` (2024.3) has nothing on MusicXML or score layout.

## Summary

1. **Octave-notated instruments are the largest risk.** In Sibelius the octave transposition of piccolo, double bass,
   etc. belongs to the instrument, not the clef, and stays on in a concert-pitch score ([manual] 2.6 p.187, 4.1 p.331;
   [ManuScript] p.58). The exporter currently writes the octave-shifted written pitch and no `<transpose>`, which in
   MusicXML means "sounds as written". Depending on which Sibelius instrument the importer picks, piccolo, glockenspiel,
   xylophone, crotales, celesta, bass flute, bass and contrabass clarinet, contrabassoon and double basses will be an
   octave off either on the page or in playback. The MusicXML 4.0 XSD bundled with Sibelius explicitly allows
   octave-only `<transpose>` in concert scores. Write it.
2. **How the importer identifies instruments is undocumented.** The manual only says Sibelius *attempts* it (p.52).
   A Sibelius developer (forum, 7.1 era) described it: match each MusicXML instrument definition to the best Sibelius
   instrument; if properties differ, clone the best candidate, change the differing properties, and add a "MusicXML"
   suffix to its name. No document says whether `<instrument-sound>` is read. Give every part consistent identity
   signals, then check Edit Instruments for "(MusicXML)" types. Deterministic fallbacks exist (manual mapping, or
   File > Import into a prepared template).
3. **`<part-group>` has been imported since 6.1** (brackets, sub-brackets, braces, barline groupings). But Sibelius has
   only three bracket kinds (bracket, brace, sub-bracket), barline joins apply to every system, and grand-staff
   instruments always get their brace from the instrument type. `line` has no equivalent; which value becomes a
   sub-bracket needs a test.
4. **Several layout settings have no MusicXML carrier that Sibelius reads**, so they are Sibelius-side work (or a
   ManuScript plug-in): System Object Positions (tempo and rehearsal marks repeated above strings), Hide Empty Staves,
   bar-number frequency and placement, the full/short/no instrument-name policy, the Transposing Score state, system
   separators, bracket style, per-instrument staff size. Most have a documented ManuScript API. The exceptions are
   system separators, bracket style, and bar-number placement (only the frequency is exposed).
5. **Page size and staff size in `<defaults>` are honoured** when "Use page and staff size from MusicXML file" is on
   (the default for files of version 1.1 or later). There is one page size per score. Staff size equals MusicXML
   `millimeters` when `tenths` is 40. The manual's range for orchestral scores is 3–5 mm staves on Letter, Tabloid, A4 or
   A3, portrait (p.639). The exporter currently writes no `<defaults>`.

---

## 1. What the importer does with the score-layout elements

### 1.1 What is documented at all

- The 24.3 manual covers MusicXML import only in **1.9 Opening MusicXML Files** (pp.51–54) and **1.10 Importing Music XML
  Files** (pp.55–58). Neither names `part-list`, `part-group`, `part-symbol`, `part-name-display` or `score-instrument`.
  The companion note §2.1 already summarizes the Open dialog and the Limitations table.
- The converter is based on MusicXML 3.0. Newer files open, but new features are not imported (p.53). So the
  MusicXML 4.0-only layout features should be treated as ignored: `<concert-score>`, `<for-part>`/`<part-transpose>`,
  and the `system` attribute on `<direction>` [inference from p.53].
- **[6.1 notes] p.23–24** lists the import features added in 6.1 that matter here (paraphrased):
  - `part-group` is now imported, covering bracket, sub-bracket, brace and barline groupings.
  - Instrument names with music-text characters (i.e. ♭ ♯ drawn in the music font) are imported for files from
    Dolet 5 for Finale.
  - If the file says instrument names should not appear on any system after the first, Sibelius sets the
    Instruments page of Engraving Rules to match.
  - The heuristic that decides whether an instrument is octave-transposing was improved.
  - The file's default text and music fonts are imported where possible.
  - The `directive` element is now imported. (Note: the 24.3 manual's Limitations table, p.54, says the opposite:
    directive is *not* imported. Do not rely on it.)
- **[2024.10 notes] p.3**: one bullet says instrument names are now interpreted more accurately. That fix is not
  in 24.3.1, so name matching on the installed version may be weaker.

### 1.2 `<part-list>` order → staff order in Sibelius

- In the manual mapping dialog (shown when "Let Sibelius choose instruments" is off), the file's parts are listed in
  file order, and you assign Sibelius instruments in that order (p.52).
- MIDI import is different: it has a **Keep track order** option, off by default, meaning Sibelius reorders MIDI tracks
  itself (p.41). The MusicXML dialog has no such option.
- [inference] File > Open keeps the MusicXML part order. The companion's measurements do not record order; confirm it.
- Sibelius's own vertical order comes from the family order and instrument order inside an *ensemble*. It applies when
  instruments are *added* in Home > Instruments > Add or Remove (p.172, 2.6 pp.184–185). To reorder after import, use
  the Up/Down buttons in that dialog; all staves of one instrument move together (p.172). Dragging staves cannot change
  the order (7.3 p.645).
- File > Import into an existing score keeps the target score's order; tracks are mapped onto its instruments (1.10 pp.55–57).

### 1.3 `<part-group>`: bracket, brace, square, line, group-barline

- Imported since 6.1 ([6.1 notes] p.24).
- Sibelius has exactly three kinds: `BracketFull`, `BracketBrace`, `BracketSub` ([ManuScript] Brackets and Braces, p.45).
  MusicXML's `group-symbol` has five values: `none`, `brace`, `line`, `bracket`, `square` ([bundle] XSD). They must
  collapse onto three. The documents do not say which value (or a nested `bracket`) becomes a Sibelius sub-bracket.
  `line` has no Sibelius counterpart [inference]. Test.
- A Sibelius sub-bracket is a thin bracket drawn left of the main one (4.19 p.402).
- **Barline joins** ([6.1 notes]: "barline groupings"). In Sibelius you change joins by dragging the top or bottom of a
  normal barline, and the change applies to every system in the score (4.5 p.346). So `group-barline yes/no` fits the
  model. `Mensurstrich` does not: Sibelius's between-staves barline is the score-wide *Default barline type* on the
  Barlines page of Engraving Rules (p.345), not a per-group setting [inference: per-group Mensurstrich will not map].
- MusicXML itself says braces for multi-staff parts belong in the part's `<attributes>` (`part-symbol`), not in
  `part-group` ([bundle] XSD, part-group documentation).
- Groups also drive vertical spacing. Sibelius adds *n extra spaces between groups of staves* below each bracketed or
  braced group (7.3 p.642). Wrong groups give wrong gaps too.
- `<group-name>` / `<group-abbreviation>`: Sibelius names belong to instruments and staves (2.4 p.171, 5.4 p.449). It has no
  bracket-level label [inference: not imported]. A label like "Violins" spanning I and II would have to be an
  instrument or staff name in Sibelius.
- If a file has no `part-group`, does Sibelius add its own default brackets by family (its *Bracket with* instrument
  property, p.187)? Not documented. Test.

### 1.4 `<part-symbol>` and multi-staff parts (`<staves>2</staves>`)

- A Sibelius *instrument* is one or more staves with one name at the left. A Violin 1 divided onto two staves is still
  one instrument (2.4 p.171). The name is centred on all its staves (2.5 p.178).
- Pitched instrument types have one staff (flute, violin) or two (piano, harp, celesta, marimba) (2.6 p.186).
  **Two-staff pitched instruments always get a brace and are never bracketed with other instruments** (p.187).
- More staves are added per instrument: Add or Remove > Above/Below, throughout or from a selected bar (2.5 p.178).
  Divided strings are conventionally joined by a sub-bracket (p.402).
- `part-symbol` is not mentioned anywhere. Sibelius derives the grand-staff brace from the instrument type, so
  [inference] it probably has no effect. MusicXML's default is `brace` anyway ([bundle] XSD).
- A two-staff part whose best match is a one-staff type (e.g. violins with a divisi staff): undocumented. From the
  developer's description in §1.6, a cloned "(MusicXML)" type with two staves is a plausible outcome [inference]. Test.

### 1.5 Names: `<part-name>`, `<part-abbreviation>`, `<part-name-display>`

- **Use instrument names from MusicXML file**: on → the names at the start of systems come from the file; off →
  Sibelius's own default names (p.52).
- A Sibelius instrument has a full name (first system, new sections), a short name (later systems), an
  instrument-change name and an instrument-change warning name (2.6 p.186; 5.4 p.449).
  [inference] `part-name` → full name, `part-abbreviation` → short name.
- **Flat and sharp in names.** Sibelius draws them as music-text characters, typed with a caret before `b` or `#`
  (so the name field holds `Clarinet in B^b`) (2.6 p.186; 5.16 p.524; 9.2 p.702). Its own instrument type names use
  plain ASCII "Bb" (e.g. *Clarinet in Bb*, [ManuScript] p.128). [6.1 notes] say music-text characters in names are
  imported for Dolet-for-Finale files, which use the MusicXML `display-text` + `accidental-text` structure
  [inference that this is the trigger]. A Unicode ♭ (U+266D) in plain text depends on the text font
  [inference; the companion already plans a Unicode-text test].
- **Numbering like "Flute 1.2"** is plain text in the name. The manual itself uses names like *Trumpets 1.2.3*,
  *Trumpet 1.2* and *Trumpet 3* (2.4 p.175). There is no numbering feature.
- If the file suppresses names after the first system, Sibelius changes Engraving Rules to match ([6.1 notes] p.24).
  This also means the exporter's preview "strip" mode (names with `print-object="no"`) must never be the file given
  to Sibelius.

### 1.6 Instrument identity: `<score-instrument>`, `<instrument-name>`, `<instrument-sound>`

- **Let Sibelius choose instruments** on: Sibelius tries to identify the instruments. If it picks wrong, the manual says
  to re-import with the option off and map each part in a dialog, much like the Instruments dialog (p.52).
- The executable contains a prompt that says, in substance, that MusicXML files do not precisely specify which
  instruments are used and asks whether Sibelius should choose them ([bundle] strings in `MacOS/Sibelius`).
- **Developer's description** ([forum], thread "Sibelius appends 'MusicXML' to instrument…", Sibelius 7.1 era,
  paraphrased). The importer maps each instrument definition in the file to the Sibelius instrument that matches the
  description. When there is no exact match, it copies the best candidate, changes the properties that do not match in
  the copy, and gives the copy a "MusicXML" suffix to show it was made by the import.
- **Older thread** ([forum], Sibelius 6.2, paraphrased). An expert user advised filling in `instrument-name` as well as
  `part-name`. MusicXML's author (Recordare) replied that MusicXML 2.0 describes how the name looks, not which
  instrument it is, and that 3.0 would add a standard sound list. That list is `<instrument-sound>`.
- **Does the importer read `<instrument-sound>`?** Nothing says so. The bundle ships the standard MusicXML 4.0
  `sounds.xml` beside the XSD, and Sibelius's own exporter writes `<instrument-sound>` for pitched instruments
  ([measured], companion reverse probe). Treat it as unknown. Write it anyway; it costs nothing.
- **Which names match which Sibelius instruments.** [ManuScript] "Instrument Types" (pp.113–129) lists every instrument
  type guaranteed to exist, with its dialog name and style ID. The table in (a) maps this project's catalog onto it.
- MIDI import is documented to guess by track name, then by sound and range (1.7 p.43). The MusicXML section says
  nothing like that. Do not assume the same logic.

### 1.7 Transposition on import (links to §2.5)

- [measured] `<transpose>` is applied. Clarinet and horn transpositions survived. In the instrument-change test, the
  octave-change was applied to the pitch, and the display moved an octave from bar 1 because the instrument stayed a
  Flute.
- [inference] The working model: **sounding pitch = `<pitch>` + `<transpose>`**. Sibelius stores sounding pitch:
  plug-ins add notes by sounding pitch (`Staff.AddNote`, [ManuScript] p.85), and `Note.WrittenPitch` is derived from
  the transposition state (pp.64–65). The page shows that sounding pitch through the *Sibelius instrument's* own
  transposition and the Transposing Score toggle, not through the file's `<transpose>`.

---

## 2. How Sibelius itself handles these things

### 2.1 Brackets, sub-brackets, braces (4.19 Brackets and Braces, pp.402–403)

- **Add:** select the staves, then Notations > Bracket or Brace > **Bracket** / **Sub-bracket** / **Brace**.
- **Change:** click an end so it turns purple, then drag up or down. **Remove:** Delete. A sub-bracket spanning one staff
  is hidden by default (visible with View > Invisibles > Hidden Objects).
- Brackets and braces hide themselves where there is no barline at the left, e.g. when staves are hidden. To hide one
  elsewhere, use the Bars panel of the Inspector (Ultimate).
- **Style:** Appearance > House Style > Engraving Rules, **Brackets** page (thickness, position). Its *Draw as brace*
  option draws sub-brackets as braces (old style for Violin I/II).
- A bracket without hooks (as in some Penderecki scores) is a line made in Edit Lines with no cap, placed by hand. It
  does not repeat on each system.
- The *Bracket with* property of an instrument decides automatic bracketing when instruments are *created* next to each
  other. It does not decide order (2.6 p.187).
- Automation: `Score.BracketsAndBraces.AddBracket(type, top, bottom)`, `ClearAll()`, `DeleteNthBracket(n)`
  ([ManuScript] p.45).

### 2.2 Barline groups (4.5 Barlines, pp.345–348)

- Sibelius joins similar instruments automatically. To change it, click the top or bottom of a normal barline and drag
  the handle; this affects every system (p.346). Deleting the handle hides the barlines of that group (p.347).
- No barlines in one staff only: define an instrument with *Barlines* off in Edit Staff Type, then apply an instrument
  change at the very start (p.347).
- Engraving Rules, Barlines page: *Join barlines at end of systems*, *Barline at start of single staves*,
  *Default barline type* (e.g. *Between Staves* for Mensurstriche, *Invisible*) (pp.345–348).
- Automation: `Score.Barlines.AddBarline(top, bottom)`, `ClearAll()` ([ManuScript] p.42);
  `EngravingRules.BarlineJoinSystemEnd` (p.51).

### 2.3 Instrument names (5.4 Instrument Names, pp.449–452; 2.6 p.186; Engraving Rules, Instruments page)

- Each instrument has a full and a short name. Editing either (click the name) changes it throughout the score (p.449).
- Renaming does not change the instrument type or its transposition. To do that, use Home > Instruments > **Change**
  (p.449).
- **Appearance > Instrument Names**: *Full*, *Short* or *None* at the start of the score, on subsequent systems, and at new
  sections (p.449). For scores with many instruments the manual recommends full names at the start (maybe at new
  sections) and full or short names afterwards (p.449).
- Font and alignment come from the *Instrument names* text style. Names are traditionally centred, sometimes
  right-aligned. The gap to the initial barline is on Engraving Rules > Instruments (p.450).
- **Staff names** label single staves of a multi-staff instrument: double-click just left of the staff (2.5 p.181).
  The manual shows a single Flute with two staves named "1" and "2", and "Violin I" with *divisi* in italics under it
  (p.450).
- After an instrument change, the next system's name updates unless *Change instrument names at start of systems after
  instrument changes* is switched off (Engraving Rules > Instruments; p.177, p.451).
- The left staff margins follow the longest name in the score (7.1 p.640).
- Automation: `Staff.FullInstrumentName`, `ShortInstrumentName`, `FullStaffName`, `ShortStaffName` (read/write, with
  `…WithFormatting` variants) ([ManuScript] pp.86–87); `EngravingRules.InstrumentNamesFirstSystem`,
  `InstrumentNamesSubsequentSystems`, `InstrumentNamesNewSections`,
  `ShowNameOfPrevailingInstrumentChangeAtStartOfSystems` (pp.52–53).

### 2.4 Score order and ensembles (2.4 pp.172–173; 2.6 pp.183–185)

- Add or Remove Instruments has a **Choose from** list (*All*, *Common*, *Band*, *Jazz*, **Orchestral instruments**, …).
  Different ensembles contain different instruments, sometimes in a slightly different order (p.172).
- In an ensemble, the order of families, and of instruments inside each family, sets the default vertical order of
  newly created instruments. You can make your own ensembles in Edit Instruments (Ultimate) (pp.184–185).
- There is a per-instrument **Staff Size** column (*Normal*, *Medium*, *Small*, *Extra-Small*) (p.172, p.181).

### 2.5 Transposing Score and octave-transposing instruments

- **Home > Instruments > Transposing Score** (Ctrl/Cmd+Shift+T) switches between concert and transposed display. Parts
  transpose automatically (2.4 p.174). New scores show concert pitch; the status bar says *Concert Pitch* or
  *Transposing Score* ([tutorials] p.28). The glossary calls a non-transposing score a score "in C" (p.761).
- **Octave transposition is a property of the instrument.** Its *Non-transposing score* setting exists only for
  instruments such as piccolo, double bass and tenor voice, which are "customarily notated an octave higher or lower
  than they sound, even in non-transposing scores" (2.6 p.187). Clefs with a small 8 or 15 are treated as exactly
  equivalent to plain clefs: a hint to the reader with no effect on pitch (4.1 p.331; p.187).
  [ManuScript] `InstrumentType.ChromaticTranspositionInScore` gives +12 for piccolo and −12 for guitar (p.58).
  **Turning Transposing Score on or off does not change octave-notated instruments.**
- *Transposed pitch clef* (used by low wind and brass) applies only when Transposing Score is on (p.187).
- Sibelius has instrument variants for concert-score octave conventions: *Bass Clarinet in Bb [score sounds 8vb]*,
  *Contrabass Clarinet in Bb [score sounds 15mb]*, *Contra Alto Clarinet in Eb [score sounds 8vb]*,
  *Contrabass (Tubax) Saxophone [score sounds 15mb]* ([ManuScript] pp.113–129).
  **The page shows each instrument at the octave its Sibelius definition says, not the octave the exporter meant.**
  If the two conventions differ for an instrument, one of them has to change (the Sibelius side in Edit Instruments >
  Transposition, Ultimate).
- Key signatures in transposing view: remote-key options (p.174). **Open key/Atonal** gives no key signatures on
  transposing instruments either (4.2 p.334). Timpani and horn usually have no key signature (p.334).
- Automation: `Score.TransposingScore` (read/write) ([ManuScript] p.73).

### 2.6 Hide Empty Staves (2.5 Staves, pp.179–180; 7.4 p.648)

- Select staves, a passage or the whole score (Select All), then **Layout > Hide Empty Staves**
  (Ctrl+Alt+Shift+H / Cmd+Option+Shift+H). The rules:
  - A staff is hidden only on systems where it has nothing but bar rests, or only hidden music (e.g. cues) (p.180).
  - If keyboard staves are included, one hand can end up hidden alone. Check afterwards, or leave keyboards out of
    the selection (p.180).
  - The only staff in a system cannot be hidden (p.180).
  - **Layout > Show Empty Staves** brings them back, all at once or selected staves (p.180).
  - Hidden places are drawn as a dashed line when View > Invisibles > Layout Marks is on (p.179).
- Focus on Staves is a different feature: temporary, can hide staves that have music, and applies to the whole score.
  While it is on, Hide Empty Staves works only on the focused staves (p.648).
- Related rules:
  - Brackets hide themselves (p.402).
  - When players move between differently named staves, put a system break where the number of staves changes,
    otherwise half-used staves appear (2.4 p.175).
- **Cut-away scores:** an instrument change to *No instrument (hidden)* removes the staff lines mid-system. This is the
  manual's method for the "scrapbook" look of Penderecki or Stockhausen scores (2.5 p.181). Show Empty Staves does not
  undo it (p.180).
- The manual states no rule that the first system must show every staff.
- Automation: `Score.HideEmptyStaves(startStave, endStave, startBar, endBar)` and `ShowEmptyStaves(…)`
  ([ManuScript] pp.69, 71).

### 2.7 Instrument changes (2.4, pp.175–177)

- For doubling, use **Home > Instruments > Change** in nearly all cases. The exception is unpitched percussion sharing
  one staff (p.175).
- Select a passage for a temporary change (it reverts at the end), or a single note for a permanent one. Options:
  *Add clef (if necessary)*; *Announce at last note of previous instrument*, which writes a "To …" warning, with the
  word before the name editable (p.176).
- Sibelius then changes the sound, the names on later systems, the name written above the staff, the transposition and
  key, and the staff type (p.177).
- [measured] a MusicXML instrument change imports with the wrong target (companion).
  Automation: `Bar.AddInstrumentChange(pos, styleID, …)` ([ManuScript] p.38).

### 2.8 Divisi, two players on one staff, "a 2" (2.4 p.175; 2.5 p.178; 3.15 Voices; 3.16 Arrange; 1.10)

- **The 24.3 manual has no dedicated divisi feature.** It documents two approaches (p.175):
  - **Fixed grouping:** one instrument per grouping, named e.g. *Trumpets 1.2.3*; or *Trumpet 1.2* and *Trumpet 3*; or
    one instrument *Trumpets* with a second staff.
  - **Changing grouping:** one instrument per name used (e.g. *Trumpets 1.2.3*, *1.2*, *1*, *2*, *3*). Hide the spare
    staves. Mark changes with Technique text ("1.2", "a 2", "div.", "unis."). Put a system break where the number of
    staves changes.
- Two players on one staff are **voices 1 (stems up) and 2 (stems down)**; up to four voices (3.15 p.283). Technique
  text is the style for "a2" and "solo" (5.2 p.441). [measured] `<words>` imports as Technique text.
- **Explode** (Note Input > Arrange > Explode) splits chords onto up to four staves. It reads Technique-text directions
  such as "1.", "2.", "a1.", "a2." on single-note passages to decide which staff gets them, and can write cues
  (p.292).
- **Reduce** merges several staves onto fewer, using as few voices as possible, and marks solo and unison notes with
  "1." and "a 2" in a preset style (p.293).
- **Arrange** is a general tool (pp.289–298). Merging two single-voice staves into voices by hand: p.285.
- **File > Import** (1.10 pp.56–58) can map one track to several instruments; *Explode Music When Arranging to Multiple
  Instruments* splits chords across them. It can also map two tracks to one instrument; with **Use Multiple Voices** they
  become voices 1 and 2 on one staff.

### 2.9 System separators

- Engraving Rules > Instruments: *Draw left/right separator*, the minimum number of staves before they appear, and the
  distance from the margin (2.4 p.173).

---

## 3. System objects, bar numbers, page and staff size

### 3.1 System Object Positions (8.4 p.689; 5.6 p.462; 5.2 p.442; 5.12 p.501; 4.6 pp.351–352)

- System objects apply to all staves and appear in every part: titles, tempo text, metronome marks, rehearsal marks,
  1st/2nd endings, rit./accel. lines, time and key signatures (7.10 p.671; glossary p.760).
- **Appearance > System Objects > System Object Positions**: click the staves that system objects appear above, up to
  eleven. The top staff is compulsory; *Below bottom staff* is optional (p.689).
- Each text style's **Vertical Posn** tab (Text > Style > Edit Text Styles, Ultimate) chooses which of those positions
  it uses, e.g. rehearsal marks at the top, above the strings and below the bottom, but tempo only at the top
  (p.462, p.689).
- The copies follow each other when one is edited. A lower copy can be deleted alone; deleting the top one deletes all;
  Reset Design brings deleted copies back (p.442, p.689, p.501). Magnetic Layout moves copies to avoid collisions (p.442).
- Engraving Rules > Staves: *n extra spaces above for System Object Positions* (7.3 p.643).
- MusicXML side: the importer reads metronome marks only from the top staff of the uppermost part (p.53, in the
  companion). The exporter already writes tempo and rehearsal marks in the first part only, which fits this model.
  The MusicXML 4.0 `system` attribute on directions is 4.0-only [inference: ignored].
- Automation: `Score.SystemObjectPositions.SetNthStaffShowsSystemObjects(n, show)`,
  `ShowSystemObjectsBelowBottomStaff` ([ManuScript] p.88); `EngravingRules.ExtraSpacesAboveForSystemObjectPositions` (p.52).

### 3.2 Bar numbers (5.13 Bar Numbers, pp.502–508)

- Text > Numbering: *Every system* (default in most manuscript papers), *Every n bars*, *No bar numbers* (p.502).
- Engraving Rules > **Bar numbers** (pp.503–504):
  - frequency; *Show on first bar of sections*; *Hide at rehearsal marks*; *Count repeats*; bar ranges on multirests
  - **Show on Staves**: specific staves, up to five including the top staff and *Below bottom staff*; or all staves
  - horizontal: *Center in the bar*; first bar number of the system left-aligned or after the clef
  - vertical: above or below the top, middle or bottom of the staff
  - p.504 gives a recipe for numbers centred below the bottom staff on every bar
- Bar number changes (restart, 1a/1b formats, "no number"); a pick-up bar is numbered 0 automatically (pp.506–507).
- Whether `<measure-numbering>` is imported is not documented (the companion plans a test).
- Automation: `EngravingRules.BarNumberFrequency(category, n)` ([ManuScript] p.51); `Bar.AddBarNumber(…)` (p.37).

### 3.3 Rehearsal marks (5.12 Rehearsal Marks, pp.500–501)

- Rehearsal marks re-letter themselves when marks are added or deleted. The Restart Sequence dialog sets a start mark,
  prefix and suffix (p.500).
- Engraving Rules > **Rehearsal marks**: format *A–Z, A1–Z1…*, *A–Z, AA–ZZ…*, *1, 2, 3…*, *Bar number*, *Hide all*;
  prefix and suffix. The box and font are in the *Rehearsal marks* text style (Border tab: *Boxed*, p.461). The
  file's `enclosure` attribute is therefore not what draws the box.
- [inference] If imported marks come in as fixed "Start at" marks, re-lettering will not work. Check by deleting one.

### 3.4 Page size and staff size (7.1 Document Setup, pp.637–640; 1.9 pp.51, 53)

- **Import.** *Use page and staff size from MusicXML file* is on by default for files of version 1.1 or later and
  keeps the file's page and staff size. Off: you set the paper size and orientation in the dialog, and the staff size
  comes from the chosen house style. A chosen house style's page and staff size are used only if this option is off
  (p.51). Only one page size per imported score (p.53).
- **In Sibelius:** Layout > Document Setup has *Size*, *Margins* (*Standard*, *Narrow*, *Wide*, *Mirrored*),
  *Orientation* and *Staff Size* (pp.637–638). Sizes include A3 297×420, Tabloid 279×432, B4 250×354 mm (p.637).
  The dialog allows custom width and height, same/mirrored/different margins, and staff margins with a different first
  page (pp.639–640).
- **Staff size** is the distance between the centres of the top and bottom staff lines, and everything scales with it
  (p.638). The MusicXML XSD's own example: 7 mm staff = `millimeters` 7 per 40 `tenths`.
  [inference] Sibelius staff size = `millimeters × 40 / tenths`.
- Page size, orientation and staff size cannot change partway through a score. Margins can, via special page breaks
  (p.640).
- **Recommended for orchestral scores:** Letter, Tabloid, A4 or A3 with 3–5 mm staves; portrait (p.639).
- Importing one of the predefined house styles together with its Document Setup sets A4 paper and 7 mm staves. The
  manual advises noting the Document Setup values first and restoring them afterwards (8.2 p.679).
- Not in 24.3.1: [2024.10 notes] p.3 says margins are taken from the file and applied as fixed.
- The exporter currently writes no `<defaults>`, so there is nothing for Sibelius to preserve [inference: Sibelius
  defaults apply].
- Automation: `DocumentSetup.PageSize`, `PageWidth`, `PageHeight`, `StaffSize`, margins, `Orientation`
  ([ManuScript] pp.48–49).

### 3.5 Layout and breaks from the file

- *Use layout and formatting from MusicXML file*: on by default for files of version 1.1 or later; keeps staff
  distances and system/page breaks from the file. Off: the format is unlocked and Sibelius lays the score out itself (p.51).
- In Sibelius: Layout > Breaks; **Lock Format** / **Unlock Format**; *Make Into System/Page*; *Keep Bars Together*
  (7.9 p.667, Ultimate). Staff spacing: Engraving Rules > Staves, **Optimize**, **Auto-Optimize**, **Align Staves**
  (7.3 pp.642–646).

---

## 4. Orchestral conventions the manuals state (paraphrased)

| Topic | What the manual says | Where |
| --- | --- | --- |
| Instrument order | Orchestral order: woodwind, brass, percussion, singers, keyboards, strings. The order inside each section is as in the Add or Remove Instruments dialog. Exceptions: a predominant soloist on top; percussion order varies; music for two orchestras or choirs. | 2.4 p.173 (box) |
| Brackets | Same-family instruments are bracketed. The same box says percussion and solo instruments are usually not bracketed (it contradicts itself on percussion). Divided instruments get a sub-bracket; sub-brackets also group Fl + Picc or Vn I + II. Older scores sometimes brace the horns. Keyboards are braced (organ pedals not). Small groups are usually not bracketed. Bracketed or braced staves usually share barlines. | 4.19 p.402 (box) |
| Barline joins | In orchestral scores, woodwind, brass, percussion and strings are each joined, and separated from their neighbours. Vocal staves are never joined. Staves of one keyboard are joined, separately from neighbours. Small ensembles use one unbroken barline. | 4.5 p.346 (box) |
| Instrument names | Many instruments: full names at the start, full or short afterwards. Names centred traditionally, sometimes right-aligned. | 5.4 pp.449–450 |
| Paper and staff size | 3–5 mm staves on Letter, Tabloid, A4 or A3; portrait. Landscape is rare. | 7.1 p.639 |
| Vertical spacing | Wider gaps between instrument families in large scores. Align staves across facing pages for the conductor. | 8.1 p.676 |
| Tempo and rehearsal marks | In large scores, repeated lower down, typically above the keyboards or strings. Rehearsal marks at the top and above the strings. | 5.2 p.442; 5.6 p.462 |
| Bar numbers | Above the top staff and above one or more families in orchestral music, sometimes below the bottom staff. Common frequencies: 1, 5, 10. | 5.13 p.503 |
| Double barlines | At new sections and key changes; not at time-signature changes or rehearsal marks unless a new section starts. | 4.5 p.343 (box) |
| Expression / Technique text | Expression below the staff (above for vocal staves); Technique above; keyboard markings between the staves. | 5.2 p.441 (box) |
| Tempo typography | Sudden changes capitalized, gradual ones lower-case. Tempo text left-aligned with the time signature. | 5.2 p.442 (box) |
| Octave clefs | Piccolo with or without the 8 is a matter of taste, the 8 being more common in avant-garde scores. | 4.1 p.331 |
| Key signatures | Transposing scores that look like C major may omit key signatures in transposing instruments (Open key/Atonal). Timpani and horn usually have none. | 4.2 p.334 |
| Several players, divisi | Name staves like *Trumpets 1.2.3*. Mark changes with Technique text ("1.2", "a 2", "div.", "unis."). System break where the staff count changes. | 2.4 p.175 |
| Empty staves | Hiding empty staves per system is what large scores do. | 2.5 p.180 |
| Starting point | Prefer a manuscript paper with instruments over a blank page; the orchestral papers carry sensible name formats and staff sizes. | 1.4 p.30; [tutorials] p.39 |
| Fonts | One font family for all text (titles and instrument names may differ); serif. | 5.6 p.463 |

---

## 5. What MusicXML can carry vs what only Sibelius can do

| Item | MusicXML carrier | Sibelius import (evidence) | Where it is set in Sibelius | Automation ([ManuScript]) |
| --- | --- | --- | --- | --- |
| Staff order | part-list order | Probably kept [inference, p.52] | Add or Remove, Up/Down | `CreateInstrumentAtBottom` when building a template (p.68) |
| Instrument type | name, instrument-name, instrument-sound, transpose, clefs, staves | Heuristic; unmatched → "(MusicXML)" clone [forum]; manual mapping available (p.52) | Home > Instruments > Change at the very start; Edit Instruments (Ultimate) | `Staff.InitialStyleId` to check (p.86); `Bar.AddInstrumentChange` (p.38) |
| Octave-notated display | `<transpose><octave-change>` | Applied to pitch [measured]; display follows the Sibelius instrument [inference] | Edit Instruments > Transposition | `InstrumentType.ChromaticTranspositionInScore` to check (p.58) |
| Concert vs transposed view | (4.0 `concert-score`: not imported) | — | Home > Instruments > Transposing Score | `Score.TransposingScore` (p.73) |
| Brackets, sub-brackets, braces | part-group (+ part-symbol) | Imported since 6.1; three kinds only | Notations > Bracket or Brace; Engraving Rules > Brackets | `BracketsAndBraces.AddBracket` (p.45) |
| Barline joins | group-barline | Imported since 6.1; score-wide | Drag barline handles | `Barlines.AddBarline` (p.42) |
| Full / short names | part-name, part-abbreviation (+ `-display`) | With *Use instrument names from MusicXML file* (p.52) | Click the name; Edit Instruments | `Staff.FullInstrumentName` etc. (pp.86–87) |
| ♭ / ♯ in names | `display-text` + `accidental-text` | Likely, for the Dolet style [6.1 notes; inference] | Type `B^b` | Same, with `^b` |
| Name policy (full/short/none) | per-system name display | Partly: "no names after first system" is mapped [6.1 notes] | Appearance > Instrument Names | `EngravingRules.InstrumentNames…` (p.52) |
| Staff names ("1", "2", "div.") | none | — | Double-click left of the staff | `Staff.FullStaffName` (p.86) |
| Hide empty staves | only `staff-details print-object` | Unknown (companion test) | Layout > Hide Empty Staves | `Score.HideEmptyStaves` (p.69) |
| System Object Positions | none in 3.0 | — | Appearance > System Objects > System Object Positions; text style Vertical Posn | `SystemObjectPositions.SetNthStaffShowsSystemObjects` (p.88) |
| Tempo / metronome | direction words + metronome, top part | Read from the top staff of the uppermost part only (p.53) | Tempo / Metronome mark text | — |
| Rehearsal marks | `<rehearsal>` | Imported [measured] | Engraving Rules > Rehearsal marks; text style | `Bar.AddRehearsalMark` |
| Bar numbers | `<measure-numbering>` | Unknown (companion test) | Engraving Rules > Bar numbers | `EngravingRules.BarNumberFrequency` (p.51) |
| Page size, staff size | `<defaults>` scaling, page-layout | Honoured with the option on; one page size (pp.51, 53) | Layout > Document Setup | `DocumentSetup.*` (pp.48–49) |
| System / page breaks | `<print new-system/new-page>` | Kept with *Use layout and formatting* on (p.51) | Layout > Breaks; Lock Format | — |
| Staff spacing | system-layout, staff-layout | Kept with the same option (p.51) | Engraving Rules > Staves; Optimize; Align Staves | `EngravingRules.SpacesBetweenStaves` etc. (p.53) |
| Per-instrument staff size | `staff-details/staff-size` | Unknown | Add or Remove, Staff Size column | `Staff.ScaleFactorChange` (p.86) |
| System separators | none that 24.3 reads | — | Engraving Rules > Instruments | — |
| Key signature "atonal" | omit `<fifths>` | Imported as atonal (p.53) | Notations > Key Signature > Open key/Atonal | `Bar.AddKeySignature` |
| Doubling / instrument change | `<instrument>` + `<transpose>` + words | Target wrong [measured] | Home > Instruments > Change | `Bar.AddInstrumentChange` (p.38) |
| "a 2", "1.", "div." | `<words>` | → Technique text [measured] | Technique text; Explode and Reduce read and write them | `Bar.AddText(…, "Technique")` |
| House style (rules, text styles, instrument definitions) | fonts only | Default fonts imported [6.1 notes] | Appearance > House Style > Import/Export; the Open dialog's House style | `Score.ApplyStyle(file, "HOUSE", "TEXT", …)` (p.68) |

---

## (a) What the exporter should write so Sibelius imports it right

Items are ordered by how much damage their absence does. Anything musical (naming, grouping, sharing staves) is
listed as options for the composer, not decided here.

1. **`<transpose>` for every octave-notated instrument, octave only**, in the first measure's `<attributes>`, after
   `<clef>` and `<staff-details>`:
   `<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>N</octave-change></transpose>`.
   Here N = −(the catalog's `writtenOctave`). `<pitch>` stays the written, displayed pitch, as now.
   - MusicXML defines `<transpose>` as what must be added to the written pitch to get the sounding pitch. The bundled
     4.0 XSD says concert scores may still contain octave transpositions ([bundle] `concert-score` documentation).
   - Do not write `<for-part>` in the same `<attributes>` (it is an either/or with `<transpose>` in the 4.0 XSD). Do
     not rely on `<concert-score/>`.
   - For B♭/F/E♭ instruments, write no `<transpose>` (score in C). Consequence: nothing in MusicXML 3.0 tells Sibelius
     "this is a B♭ clarinet shown at concert pitch" except the instrument identity (item 2). If that match fails, the
     C-score page is still right, but Transposing Score would not produce transposed parts.
2. **Identity signals, consistent with each other:**
   - `<score-instrument>` with `<instrument-name>` = the Sibelius dialog name from the table below
   - `<instrument-sound>` = the standard MusicXML id from the table below
   - `<part-name>` / `<part-abbreviation>` = the printed names
   - ids unique across the document (the companion already notes this)
3. **Names with ♭/♯:** plain ASCII in `<part-name>` (e.g. `Clarinet in Bb`), plus
   `<part-name-display><display-text>Clarinet in B</display-text><accidental-text>flat</accidental-text></part-name-display>`
   (and the same for `<part-abbreviation-display>`). Avoid U+266D in name text. The current catalog prints
   "Clarinet in E♭" and "E♭ Cl." with U+266D.
   - Open naming question for the composer: in a C score, should parts print their key ("Clarinet in B♭", "Horn in F",
     "Trumpet in C") or not ("Clarinet", as now)? The Sibelius type chosen is the same either way.
4. **`<part-group>`:**
   - family brackets with `<group-barline>yes</group-barline>`, as now
   - do not put grand-staff instruments (celesta, piano, harp, marimba) inside a bracket group unless the composer wants
     it; Sibelius braces them by type and the manual's convention does not bracket keyboards (currently celesta and
     piano would share a "keyboard" bracket if adjacent)
   - sub-brackets (e.g. Picc. + Fl., Vn I + II) as a nested group: candidate `square`, to be tested against a nested
     `bracket`
   - avoid `line` and `Mensurstrich`; do not rely on `<group-name>`
5. **Multi-staff parts:** keep `<staves>` + numbered clefs. `part-symbol` is optional (brace is the default). For a
   divisi *second staff* on a one-staff instrument, test before relying on it. Alternatives: separate parts named per
   §2.8, or add the staff in Sibelius.
6. **Two players on one staff.** Three candidates, for the composer to choose:
   - one part named e.g. "Flutes 1.2" with voices 1/2 and `<words>` "a 2", "1.", "2." (these become Technique text,
     which Explode reads)
   - separate parts per player, merged in Sibelius with Reduce, which writes "1." and "a 2" itself
   - separate parts mapped onto one instrument via File > Import with *Use Multiple Voices*
7. **System objects:** tempo, metronome and rehearsal marks once, in the top part only (as now). Their repetition down
   the system is set in Sibelius, not in the file.
8. **`<defaults>`, optional:**
   - `<scaling>`: `millimeters` = intended staff size (the manual's orchestral range is 3–5 mm) with `tenths` 40
   - `<page-layout>`: page width and height in tenths, plus margins
   - honoured only with *Use page and staff size from MusicXML file* on; a single page size
   - otherwise leave it out and set Document Setup in Sibelius
9. **Breaks, optional:** either none (then import with *Use layout and formatting from MusicXML file* off), or
   `<print new-system="yes"/>` / `new-page` only where the composer wants a fixed break. One example: where the set of
   staves changes, for Hide Empty Staves and divisi (p.175).
10. **Key:** `<key><fifths>0</fifths></key>` gives a C major key signature. Omitting `<fifths>` gives Open key/Atonal
    (p.53). The difference shows only if Transposing Score is used. The companion already has this test.
11. **Never hand Sibelius a strip-mode document.** Its names are `print-object="no"`, and Sibelius would turn that into
    "no names after the first system" (§1.5).

**Catalog → Sibelius instrument type → MusicXML sound** (types from [ManuScript] pp.113–129, sounds from the bundled
`sounds.xml`; octave-change = −`writtenOctave` in `src/instruments/catalog.ts`)

| Catalog id | Sibelius type (dialog name) | Style ID | `instrument-sound` | `octave-change` |
| --- | --- | --- | --- | --- |
| piccolo | Piccolo | instrument.wind.piccolo | wind.flutes.flute.piccolo | 1 |
| flute | Flute | instrument.wind.flute | wind.flutes.flute | — |
| alto-flute | Alto Flute | instrument.wind.flute.alto | wind.flutes.flute.alto | — |
| bass-flute | Bass Flute | instrument.wind.flute.bass | wind.flutes.flute.bass | −1 |
| oboe | Oboe | instrument.wind.oboe | wind.reed.oboe | — |
| cor-anglais | Cor Anglais (or English Horn) | instrument.wind.coranglais | wind.reed.english-horn | — |
| clarinet | Clarinet in Bb (catalog range D3 up fits B♭) | instrument.wind.clarinet.bflat | wind.reed.clarinet.bflat | — |
| eb-clarinet | Clarinet in Eb | instrument.wind.clarinet.eflat | wind.reed.clarinet.eflat | — |
| bass-clarinet | Bass Clarinet in Bb [score sounds 8vb] | instrument.wind.clarinet.bass.bflat.8vb-score | wind.reed.clarinet.bass | −1 |
| contrabass-clarinet | Contrabass Clarinet in Bb [score sounds 15mb] | instrument.wind.clarinet.contrabass.bflat.15mb-score | wind.reed.clarinet.contrabass | −2 |
| bassoon | Bassoon | instrument.wind.bassoon | wind.reed.bassoon | — |
| contrabassoon | Contrabassoon | instrument.wind.bassoon.contrabassoon | wind.reed.contrabassoon | −1 |
| horn | Horn in F (or Horn in F [no key]) | instrument.brass.horn.f | brass.french-horn | — |
| trumpet | Trumpet in C or Trumpet in Bb (catalog range starts F♯3, which fits C; the name should say which) | instrument.brass.trumpet.c / .bflat | brass.trumpet.c / brass.trumpet.bflat | — |
| trombone | Trombone (or Tenor Trombone) | instrument.brass.trombone | brass.trombone | — |
| bass-trombone | Bass Trombone | instrument.brass.trombone.bass | brass.trombone.bass | — |
| contrabass-trombone | Contrabass Trombone | instrument.brass.trombone.contrabass | brass.trombone.contrabass | — |
| cimbasso | Cimbasso in F / Bb / Eb (no key-less type) | instrument.brass.cimbasso.f … | brass.cimbasso | — |
| tuba, contrabass-tuba | Tuba (no contrabass type) | instrument.brass.tuba | brass.tuba | — |
| timpani | Timpani [no key] | instrument.pitchedpercussion.timpani.nokeysig | drum.timpani | — |
| glockenspiel | Glockenspiel | instrument.pitchedpercussion.glockenspiel | pitched-percussion.glockenspiel | 2 |
| xylophone | Xylophone | instrument.pitchedpercussion.xylophone | pitched-percussion.xylophone | 1 |
| marimba | Marimba [grand staff] | instrument.pitchedpercussion.marimba | pitched-percussion.marimba | — |
| vibraphone | Vibraphone | instrument.pitchedpercussion.vibraphone | pitched-percussion.vibraphone | — |
| crotales | Crotales | instrument.pitchedpercussion.crotales | metal.crotales | 2 |
| tubular-bells | Tubular Bells | instrument.pitchedpercussion.bells.tubular | pitched-percussion.tubular-bells | — |
| celesta | Celesta | instrument.keyboard.celesta | keyboard.celesta | 1 |
| piano | Piano | instrument.keyboard.piano | keyboard.piano | — |
| harp | Harp | instrument.pitchedpercussion.harp | pluck.harp | — |
| snare-drum | Snare Drum | instrument.unpitched.drums.snare | drum.snare-drum | — |
| military-drum | Side Drum (closest; no military type) | instrument.unpitched.drums.side | drum.snare-drum (no military id) | — |
| tenor-drum | Tenor Drum | instrument.unpitched.drums.tenor | drum.tenor-drum | — |
| bass-drum | Bass Drum | instrument.unpitched.drums.bass | drum.bass-drum | — |
| suspended-cymbal | Cymbals (closest) | instrument.unpitched.drums.cymbal | metal.cymbal.suspended | — |
| clash-cymbals | Cymbals | instrument.unpitched.drums.cymbal | metal.cymbal.clash | — |
| tam-tam | Tam-tam | instrument.unpitched.tam-tam | metal.tamtam | — |
| triangle | Triangle | instrument.unpitched.triangle | metal.triangle | — |
| tambourine | Tambourine | instrument.unpitched.tambourine | drum.tambourine | — |
| anvil | Anvil | instrument.unpitched.anvil | metal.anvil | — |
| castanets | Castanets | instrument.unpitched.castanets | wood.castanets | — |
| woodblock-high/-medium/-low | Wood Block [1 line] (or one pitched-percussion *Wood Blocks [5 lines]*) | instrument.unpitched.woodblock.1line | wood.wood-block | — |
| vibraslap | Percussion [1 line] (no type) | instrument.unpitched.drums.1line | rattle.vibraslap | — |
| cowbell | Percussion [1 line] (no type) | instrument.unpitched.drums.1line | metal.bells.cowbell | — |
| sleigh-bells | Sleigh Bells | instrument.unpitched.bells.sleigh | metal.bells.sleigh-bells | — |
| guiro | Guiro (Medium) [1 line] | instrument.unpitched.guiro.medium | wood.guiro | — |
| ratchet | Percussion [1 line] (no type) | instrument.unpitched.drums.1line | rattle.ratchet | — |
| violins-1 | Violin I | instrument.strings.violin.I | strings.violin | — |
| violins-2 | Violin II | instrument.strings.violin.ii | strings.violin | — |
| violas | Viola | instrument.strings.viola | strings.viola | — |
| cellos | Violoncello | instrument.strings.violoncello | strings.cello | — |
| basses | Contrabass (or Double Bass) | instrument.strings.contrabass | strings.contrabass | −1 |

The octave column follows the exporter's convention. The manual confirms Sibelius's octave setting only for piccolo and
double bass (p.187) and piccolo (ManuScript p.58). For the others (bass flute, celesta, glockenspiel, xylophone,
crotales, contrabassoon, the "[score sounds …]" clarinets), check the Sibelius definition in Edit Instruments >
Transposition after the first import. Where it differs from the catalog, the page will follow Sibelius (§2.5).

---

## (b) Finishing steps in Sibelius

**Three candidate workflows** (all documented; to be chosen by the composer):

- **A. File > Open each export**, then the checklist below by hand or by a ManuScript plug-in. Most checklist steps have
  an API (see §5). `Sibelius.Open(filename, quiet)` exists ([ManuScript] p.80). The bundled *Convert Folder of MusicXML
  Files* plug-in shows MusicXML can be opened from a plug-in (p.53). Which dialog options a quiet open uses: unknown.
- **B. File > Import into a prepared template score** (1.10 pp.55–58).
  - Build the template once from an orchestral manuscript paper (1.4 p.30), with the right Sibelius types (including
    the octave variants), names, brackets, barline joins, System Object Positions, bar numbers, Document Setup and name
    rules.
  - For each export: map tracks to its instruments. *Auto Assign* matches by track name (Ultimate only), so part names
    identical to the template's names help.
  - Keep *Use Page and Staff Size* and *Use Layout and Formatting* off to keep the template's. *Import Initial Clef* and
    *Use Multiple Voices* as needed.
  - Unknown on this route: how tempo text, rehearsal marks and `<transpose>` import. Test first.
- **C. File > Open with a house style exported from a finished score** (Appearance > House Style > Export, 8.2 p.680),
  chosen in the Open dialog's *House style* field (p.51). It carries Engraving Rules, text styles, instrument
  definitions and ensembles, note spacing, and (only with *Use page and staff size* off) Document Setup (8.2 p.678).
  The per-score items (brackets, barline joins, System Object Positions, hidden staves) still need A's steps or a
  plug-in. `Score.ApplyStyle(file, "HOUSE", "TEXT", …)` does the same from a plug-in ([ManuScript] p.68).

**Checklist** (with the Sibelius place for each):

1. **Import dialog:** *Use page and staff size* (on only if the file has `<defaults>`); *Use layout and formatting*
   (off unless the file has deliberate breaks); *House style*; *Let Sibelius choose instruments* (on; if anything is
   wrong, re-import with it off and map each part); *Use instrument names from MusicXML file* on (pp.51–52).
2. **Check the instruments.**
   - Select a bar in each staff and open Edit Instruments; the type is pre-selected (2.6 p.183, Ultimate).
   - Look for "(MusicXML)" types.
   - Check every octave-notated instrument for display octave and playback octave.
   - Fix a wrong type with Home > Instruments > Change at the very start of the staff (method on p.347).
3. **Transposing Score off** (status bar reads *Concert Pitch*), and add the "Score in C" note on the first page.
4. **Order:** Home > Instruments > Add or Remove, Up/Down (p.172).
5. **Brackets, sub-brackets, braces:** Notations > Bracket or Brace; drag the ends; Engraving Rules > Brackets
   (pp.402–403).
6. **Barline joins:** drag the barline handles (p.346).
7. **Names:**
   - Appearance > Instrument Names: full at the start and at new sections, short afterwards (p.449)
   - fix ♭/♯ as `B^b` (p.186)
   - staff names ("1", "2", "div.") by double-clicking left of the staff (p.181)
   - Engraving Rules > Instruments: name gap, name change after instrument changes, system separators
     (pp.173, 177, 450)
8. **Key signature:** Notations > Key Signature > Open key/Atonal at bar 1, if transposed parts will ever be made (p.334).
9. **Document Setup:** page size, orientation, staff size, margins, and first-page staff margins for the title
   (pp.637–640).
10. **Staff spacing:** Engraving Rules > Staves (spaces between staves and systems, extra space between groups,
    justification); Layout > Staff Spacing > Optimize / Auto-Optimize; Align Staves for facing pages (pp.642–646, 676).
11. **System Object Positions:**
    - Appearance > System Objects > System Object Positions, e.g. add the top staff of the strings (p.689)
    - Vertical Posn per text style: Rehearsal marks, Tempo, Metronome mark (p.462)
    - Engraving Rules > Staves: *n extra spaces above for System Object Positions* (p.643)
12. **Bar numbers:** Engraving Rules > Bar numbers: frequency, staves (up to five, including below the bottom staff),
    *Hide at rehearsal marks*, centring (pp.502–504).
13. **Rehearsal marks:** Engraving Rules > Rehearsal marks format; delete-and-undo one mark to confirm re-lettering (p.501).
14. **Breaks and lock:** Layout > Breaks; Lock Format where the layout must not reflow (p.667).
15. **Hide Empty Staves:**
    - after the layout has settled: Select All, then Layout > Hide Empty Staves (p.180)
    - re-show keyboard staves where one hand disappeared (p.180)
    - system breaks where the staff count changes (p.175)
    - optionally, cut-away staves with *No instrument (hidden)* (p.181)
16. **Shared staves and divisi:** voices; Technique text "a 2", "1.", "div.", "unis."; Explode / Reduce / Arrange;
    extra staves from a given bar (pp.175, 178, 283, 292–293).
17. **Instrument changes:** Home > Instruments > Change with *Announce at last note of previous instrument*
    (pp.176–177). The companion already covers why the imported ones are wrong.
18. **Title and anonymity:** Title text only. File > Info fields, wildcards such as `\$Composer\` and `\$User\`
    (5.16 pp.521–522), and PDF metadata: see the companion's anonymity section.
19. **Final look:** View > Invisibles > Hidden Objects and Layout Marks, to find hidden brackets, instrument changes and
    hidden-staff markers (pp.179, 402).

---

## New points to test (not in the companion's test plan)

- Is the MusicXML part order kept on File > Open?
- For each octave-notated instrument, with and without `<transpose><octave-change>`:
  - displayed octave and playback octave
  - which Sibelius type it becomes, and whether a "(MusicXML)" type appears
- Does `<instrument-sound>` affect the match? Same `part-name`, different sound ids (e.g. "Flute" with
  `wind.flutes.flute.piccolo`).
- Brackets:
  - which `group-symbol` value gives a Sibelius sub-bracket (`square`, or a nested `bracket`)
  - `group-symbol none` with `group-barline yes`
  - whether Sibelius adds default family brackets when there is no `part-group`
- Does `display-text` + `accidental-text` give a music-text ♭ in the name?
- A violin part with `<staves>2</staves>`: what instrument and bracket result?
- File > Import route: tempo text, metronome marks, rehearsal marks, `<transpose>`, names; Auto Assign by `part-name`.
- Are imported rehearsal marks consecutive (re-lettering) or fixed?
- Which import options does a ManuScript `Sibelius.Open(file, true)` use?

## Sources

Local (all inside `/Applications/Sibelius.app/Contents/`):

- `Resources/en.lproj/Sibelius Help/Sibelius Reference.pdf` (Reference Guide, "Sibelius 2024.3")
- `Resources/en.lproj/Sibelius Help/ManuScript Language.pdf`
- `Resources/en.lproj/Sibelius Help/Sibelius Tutorials.pdf`
- `Resources/en.lproj/Sibelius Help/What's New.pdf` (2024.3; nothing relevant)
- `Components/MusicXML/musicxml.xsd` and `sounds.xml` (MusicXML 4.0)
- `MacOS/Sibelius` (strings)

Repository context: `src/notation/musicxml.ts`, `src/instruments/catalog.ts`, `docs/decisions/0017-score-in-c.md`,
`docs/research/sibelius-musicxml-import.md`.

Web (five fetches in total):

- [Changes in Sibelius 6.1 (PDF)](https://www.sibelius.com/helpcenter/updates/sib610_changes.pdf), §9.6 Opening MusicXML files, pp.23–24
- [What's New in Sibelius 2024.3–2024.10 (PDF)](https://resources.avid.com/SupportFiles/Sibelius/2024.10/Whats_New_in_Sibelius.pdf), MusicXML Improvements, p.3
- [Sibelius forum: "Sib. 7.1: Bug? – Sibelius appends 'MusicXML' to instrument…"](http://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=575846&groupid=3&guest=1)
- [Sibelius forum: "Sib. 6.2: Music XML import instruments"](http://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=518747&groupid=3&guest=1)
- One web search (Sibelius MusicXML import instrument-sound); it only found the two threads above.
