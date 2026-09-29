# Instrument-by-instrument notation for a contemporary orchestral full score in C, with quarter tones

Research notes for the MusicXML exporter that feeds Sibelius. The target is a paper-only competition score read by a composer-judge. Compiled 29 September 2026.

## How to read this file

- Every claim has a source tag in square brackets. Full URLs are under **Sources** at the end.
- What the tags mean:
  - **Fetched sources** (`[VSL Bassoon]`, `[Dorico: ...]`, `[MOLA p. 3]`, `[MusicXML 4.0: ...]`, `[SMuFL: ...]`, `[Wikipedia: ...]` and the other named web pages): I fetched and read these in this session. Text in quotation marks is the exact wording the fetch returned.
  - **`[Gould, Behind Bars, ch. N "..." > "...", not re-checked]`**: the table of contents on the book's website `[Gould ToC]` confirms the section exists. What I say it contains comes from my knowledge of the book; I did not re-read it in this session. It is probably right, but check the book if a detail matters.
  - **(practice; unsourced)**: my own summary of common engraving practice. I did not check a source for it in this session, so treat it as a recommendation, not a citation.
- Adler (*The Study of Orchestration*), Kurt Stone (*Music Notation in the Twentieth Century*) and the *Norton Manual of Music Notation* are not available online. I cite them only where a web page quotes them.
- Pitch names use scientific pitch notation: C4 is middle C. "Written" means what is printed. "Sounding" means concert pitch.

## The short version

1. **A score in C removes every transposition except octave transpositions.** Piccolo, xylophone and celesta are still written an octave below where they sound. Glockenspiel and crotales are written two octaves below. Contrabassoon and double bass are written an octave above. Dorico's manual: "According to convention, octave-transposing instruments always show transposed pitches, including in concert pitch layouts and without requiring clefs with octave indicators" `[Dorico: Transposing instruments]`. MusicXML 4.0 builds the same rule into `<concert-score>`: a file that has it may not contain `<transpose>` with non-zero `<diatonic>`/`<chromatic>`, but octave transpositions (`<octave-change>`, `<double>`) are allowed `[MusicXML 4.0: concert-score]`.
2. **In a C score the bass clarinet goes in bass clef at sounding pitch, with treble clef for high passages.** Dorico's manual uses exactly this as its example of a clef that differs between the concert-pitch full score (bass clef) and the part (treble clef) `[Dorico: clefs for concert/transposed pitch]`. Some C scores keep a treble clef an octave above sounding instead, so practice varies (see the bass clarinet section).
3. **Winds, brass, timpani and strings change clef; octave lines are for keyboards, harp and mallets.** MOLA asks for "8va" and "8va basso" to be avoided where possible `[MOLA p. 3]`.
4. **Quarter tones use Stein–Zimmermann accidentals** `[SMuFL: Stein–Zimmermann]`. The performance notes must say how long an accidental lasts: for the bar, or only for its note `[Dorico: accidental duration rules]`.
5. **Fixed-pitch instruments (piano, celesta, harp, mallets) cannot play quarter tones unless retuned.** A retuned piano is written at the keys to be pressed. Harp quarter tones come from individually retuned strings. See topics 1 and 2.
6. **Placement.** Dynamics and hairpins go below the staff, or between the staves for grand-staff instruments `[Dorico: positions of dynamics]`. Technique text goes above (practice; Gould, not re-checked). Niente is a circle at the hairpin's point, or the letter "n" `[Dorico: niente]`, `[MusicXML 4.0: wedge]`.

---

## Part A: What a C score does to each instrument

| Instrument | Player's part sounds... | In the C score | Source |
|---|---|---|---|
| Piccolo | an octave higher than written | keeps the octave transposition | [VSL Piccolo], [Dorico: Transposing instruments] |
| Flute, oboe | as written | at pitch | [VSL Flute], [VSL Oboe] |
| Alto flute in G | a perfect 4th lower | concert pitch | [Wikipedia: Alto flute], [MusicXML 4.0: concert-score] |
| Cor anglais (F) | a perfect 5th lower | concert pitch | [VSL English horn] |
| Clarinet in B♭ / A | a major 2nd / minor 3rd lower | concert pitch | [VSL Clarinet] |
| Clarinet in E♭ | a minor 3rd higher | concert pitch | [VSL Clarinet] |
| Bass clarinet in B♭ | a major 9th lower (treble clef, "French notation") | concert pitch in bass clef, with treble for high passages | [VSL Bass clarinet], [Dorico: clefs for concert/transposed pitch] |
| Bassoon | as written | at pitch | [VSL Bassoon] |
| Contrabassoon | an octave lower | keeps the octave transposition | [VSL Contrabassoon], [Sibelius forum: concert pitch and octave instruments] |
| Horn in F | a perfect 5th lower | concert pitch, treble and bass clefs | [VSL Horn] |
| Trumpet in C / B♭ | as written / a major 2nd lower | concert pitch | [VSL Trumpet in C], [MusicXML 4.0: concert-score] |
| Trombone, bass trombone, tuba | as written | at pitch | [VSL Tenor trombone], [VSL Bass trombone], [VSL Bass tuba] |
| Timpani | as written | at pitch | [VSL Timpani] |
| Glockenspiel | two octaves higher | keeps | [VSL Glockenspiel], [Dorico: Transposing instruments] |
| Crotales | two octaves higher | keeps | [Wikipedia: Crotales] |
| Xylophone | an octave higher | keeps; if you ever write it at pitch, say so in the score | [VSL Xylophone] |
| Vibraphone, marimba, tubular bells | as written | at pitch | [VSL Vibraphone], [VSL Marimba], [VSL Tubular bells] |
| Celesta | an octave higher | keeps | [VSL Celesta] |
| Piano, harp | as written | at pitch | [VSL Harp] |
| Violin, viola, cello | as written | at pitch | [VSL Violin], [VSL Viola], [VSL Cello] |
| Double bass | an octave lower | keeps | [VSL Double bass], [Dorico: Transposing instruments] |

- "Keeps" means the staff in the C score shows the same written notes as the player's part. It does **not** use an octave clef: the octave is implied `[Dorico: Transposing instruments]`.
- Sibelius already behaves this way. When "Transposing Score" is switched off, "instruments that transpose by an octave (eg piccolo, guitar) are not treated in the same way as other tranposing instruments and their true pitch is NOT shown when toggling" `[Sibelius forum: concert pitch and octave instruments]`. Bass and guitar "remain where they are written" `[Making the most of notation software]`.
- The score should say it is in C and name the exceptions (Gould, Behind Bars, ch. 17 "Score layout" > "Score transposition", not re-checked). MOLA wants the front matter to list the keys of all transposing instruments `[MOLA p. 4]`. Example wording (mine, not a quotation): *"Score in C. Piccolo, xylophone and celesta sound an octave higher, glockenspiel and crotales two octaves higher, contrabassoon and double bass an octave lower than written."*

---

## Part B: Instrument by instrument

General rule of thumb for all clef changes (practice; Gould, Behind Bars, ch. 1 "Ground rules" > "Using ledger lines or octave signs", not re-checked):

- Choose the clef for a whole phrase, not for single notes.
- Change clef when a phrase would otherwise sit on about 3 or more ledger lines for a sustained stretch.
- Never change clef for one or two notes.
- Don't bounce back and forth within a bar or so.

The thresholds in the rows below apply this rule; they are not quotations.

### Woodwinds

#### Piccolo
| Aspect | Convention |
|---|---|
| Clef | Treble only; "sounds an octave higher than written" `[VSL Piccolo]` |
| Range (sounding) | D5–C8 `[VSL Piccolo]` |
| C score | Keeps the octave transposition, with no octave clef `[Dorico: Transposing instruments]` |
| Octave lines | Avoid; flute-family players read ledger lines. MOLA: avoid 8va where possible `[MOLA p. 3]`. For the score: practice; unsourced |
| Quarter tones | Special fingerings. VSL says this for the concert flute `[VSL Flute]`; applying it to piccolo is my extension (unsourced) |

#### Flute
| Aspect | Convention |
|---|---|
| Clef | "non-transposing instrument notated in treble clef" `[VSL Flute]` |
| Range | B3–D7; up to F7 with forced attacks, not orchestral `[VSL Flute]` |
| Octave lines | Avoid; use ledger lines `[MOLA p. 3]`; practice |
| Harmonics | "a ring above the note" `[VSL Flute]` |
| Quarter tones | Played with special fingerings; VSL points to Robert Dick's fingering charts `[VSL Flute]` |

#### Alto flute in G
| Aspect | Convention |
|---|---|
| Transposition | "a transposing instrument in G, which is sounding a perfect fourth lower than written" `[Wikipedia: Alto flute]` |
| Range | G3–G6, with altissimo up to D♭7 `[Wikipedia: Alto flute]` |
| C score | Concert pitch in treble clef, because a concert score removes non-octave transpositions `[MusicXML 4.0: concert-score]`. The lowest notes are 2–3 ledger lines below the staff, so no clef change is needed (practice; unsourced) |
| Quarter tones | Same fingering approach as the flute; the alto flute uses flute fingerings `[Wikipedia: Alto flute]` |

#### Oboe
| Aspect | Convention |
|---|---|
| Clef | "notated in treble clef (non-transposing)" `[VSL Oboe]` |
| Range | B♭3–G6 (A6) `[VSL Oboe]` |
| Octave lines | None (practice) |
| Quarter tones | Special fingerings (practice; VSL covers multiphonics but not quarter tones) |

#### Cor anglais (English horn)
| Aspect | Convention |
|---|---|
| Player's notation | Treble clef; "sounds a fifth lower than written" `[VSL English horn]` |
| Historical clefs | Alto clef at pitch (Bach); bass clef sounding an octave higher (Italian); mezzo-soprano clef (French, 1820–40). Henze wrote it at sounding pitch `[VSL English horn]` |
| Range (sounding) | E3–A5 (B5) `[VSL English horn]` |
| C score | Concert pitch in treble clef. The lowest notes (E3–G3) need about 3 ledger lines; stay in treble (practice; unsourced) |

#### Clarinet in B♭ / A
| Aspect | Convention |
|---|---|
| Player's notation | Treble clef. B♭ sounds a major 2nd lower, A a minor 3rd lower. Written compass E3–C7 `[VSL Clarinet]` |
| C score | Concert pitch. The lowest notes (sounding D3 / C♯3) sit about 4 ledger lines below the treble staff. Dorico: "some instruments require clef changes in concert pitch scores to avoid excess ledger lines, but do not require those clef changes in their transposed pitch parts" `[Dorico: clefs for concert/transposed pitch]`. So a bass clef for **sustained** low passages in the C score is legitimate; keep treble for short dips (practice) |
| Octave lines | None (practice) |
| Quarter tones | Special fingerings (practice; unsourced) |

#### Clarinet in E♭
| Aspect | Convention |
|---|---|
| Player's notation | Treble clef; sounds a minor 3rd higher `[VSL Clarinet]` |
| C score | Concert pitch in treble; ledger lines above, no 8va (practice) |

#### Bass clarinet in B♭
| Aspect | Convention |
|---|---|
| Player's notation | "French notation" is the modern norm: treble clef, sounding a major 9th lower. "German notation": bass clef, sounding a major 2nd lower. Mixed notation combines the two (Rimsky-Korsakov) `[VSL Bass clarinet]`. A notation guide describes the bass-clef "German notation" as belonging to older parts `[Mozart notation guide]` |
| C score, most common | **Bass clef at sounding pitch; treble clef for high passages.** This is Dorico's example of a concert-pitch-only clef: treble in the part, bass in the full score `[Dorico: clefs for concert/transposed pitch]`. A search-result summary, probably drawn from a film-scoring forum thread `[VI-Control: bass clarinets]` that I did not fetch, says the same: "Typically for "C" or "Concert" scores bass clarinet is written in bass clef where it sounds." |
| C score, variant | Some C scores instead write treble clef an octave above sounding, treating the instrument like an octave transposer. **Practice varies** (unsourced). For a composer-judge reading at pitch, bass clef at pitch is the unambiguous choice |
| Clef threshold (C score) | Bass clef by default; treble when a phrase lies mostly above about E4 (practice) |
| Octave lines | None (practice) |

#### Bassoon
| Aspect | Convention |
|---|---|
| Clefs | "Notation is in bass clef, with tenor clef being used for the higher registers. Notation in treble clef is rare." `[VSL Bassoon]` |
| Range | B♭1–E♭5 (F5); upper register B3–E♭5 `[VSL Bassoon]` |
| Threshold | Tenor clef for phrases lying mostly from about A3/B♭3 upward, which matches where VSL's upper register starts. Treble only for sustained writing above the tenor clef's comfortable range, roughly C5 and up (practice) |
| Octave lines | Never (practice) |

#### Contrabassoon
| Aspect | Convention |
|---|---|
| Clefs | "Notation is in bass clef (only rarely in tenor clef), the sound is an octave lower than written" `[VSL Contrabassoon]` |
| Range | B0–C4 (A0 with an A bell) `[VSL Contrabassoon]` |
| C score | Keeps the octave transposition `[Sibelius forum: concert pitch and octave instruments]`, `[Mozart notation guide]` (lists it as "P8 down") |

### Brass

#### Horn in F
| Aspect | Convention |
|---|---|
| Player's notation | Written a 5th above sounding in both treble and bass clef (modern, "new" notation). Traditionally no key signature. Older bass-clef parts were written a 4th *below* sounding ("old notation"). "o" = open, "+" = stopped `[VSL Horn]` |
| C score | Concert pitch in treble and bass clef. Because the C score is at sounding pitch, the old/new bass-clef question disappears. Dorico names the horn among instruments whose clefs differ between concert and transposed layouts `[Dorico: clefs for concert/transposed pitch]` |
| Threshold (C score) | Treble clef by default; bass clef when a phrase lies mostly below about A3/G3 (practice) |
| Key signature | None. MOLA: "horns, tuned percussion, and timpani use any required accidentals rather than a key signature" `[MOLA p. 3]` |
| Octave lines | Never (practice) |
| Quarter tones | Hand or lip adjustment, notated with the same accidentals (practice; unsourced) |

#### Trumpet (in C or B♭)
| Aspect | Convention |
|---|---|
| Clef | Treble. The C trumpet is non-transposing. Trumpet parts have "always been written without key signature" `[VSL Trumpet in C]` |
| Range (C trumpet) | F♯3–C6, occasionally F6 `[VSL Trumpet in C]` |
| C score | B♭ trumpet at concert pitch `[MusicXML 4.0: concert-score]` |
| Octave lines | Never (practice) |

#### Trombone (tenor)
| Aspect | Convention |
|---|---|
| Clefs | "Notation in the tenor and bass clefs, no transposition. All three trombone parts are usually written in tenor clef for the upper register and in bass clef for the lower." `[VSL Tenor trombone]` |
| Alto clef | The alto clef belongs to the *alto* trombone `[Wikipedia: Clef]`. Alto clef for tenor-trombone parts appears in older, especially German, scores (Gould, Behind Bars, ch. 9 "Woodwind and brass" > "Brass" > "Clefs, transposition and key signatures", not re-checked). Don't use it in a modern score (practice) |
| Threshold | Tenor clef when a phrase lies mostly above about E4/F4 (practice) |
| Quarter tones | Slide adjustment (practice; unsourced) |

#### Bass trombone
| Aspect | Convention |
|---|---|
| Clefs | "Notation in the tenor and bass clefs, no transposition" `[VSL Bass trombone]`. In practice almost always bass clef |
| Range | B♭0–F5 `[VSL Bass trombone]` |

#### Tuba
| Aspect | Convention |
|---|---|
| Clef | Bass clef, non-transposing in the orchestra, "no octave designation needed despite the low pitch" `[VSL Bass tuba]` |
| Range | D1–G4 `[VSL Bass tuba]` |
| Octave lines | Avoid 8vb; use ledger lines `[VSL Bass tuba]` |

### Timpani and percussion

#### Timpani
| Aspect | Convention |
|---|---|
| Clef | "Non-transposing, always in bass clef" `[VSL Timpani]` |
| Key signature | None; accidentals are written in the staff `[Wikipedia: Timpani]`, `[MOLA p. 3]` |
| Octave lines | Never (practice) |
| Tuning and quarter tones | See topic 3 |

#### Glockenspiel
| Aspect | Convention |
|---|---|
| Notation | Mallet glockenspiel: "notated on one system in treble clef ... sounds two octaves higher than written" `[VSL Glockenspiel]` |
| C score | Keeps the two-octave transposition. Dorico names the glockenspiel as an octave-transposing instrument that stays transposed in concert-pitch layouts `[Dorico: Transposing instruments]` |
| Octave lines | Rarely needed, because the written range sits around the staff (practice) |
| Quarter tones | Impossible: the bars are fixed pitch (practice; unsourced) |

#### Crotales
| Aspect | Convention |
|---|---|
| Notation | "music for crotales is written two octaves lower than the sounding pitch to minimize ledger lines"; range up to two octaves `[Wikipedia: Crotales]`. Treble clef (practice; the article doesn't name the clef) |
| C score | Keeps the transposition, by the same octave convention `[Dorico: Transposing instruments]` |
| Quarter tones | Impossible (fixed pitch) |

#### Xylophone
| Aspect | Convention |
|---|---|
| Notation | "sounds an octave higher than written ... Notation in treble clef on a single staff is customary. Some composers write actual pitch. This is then indicated in the score." `[VSL Xylophone]` |
| C score | Keeps the octave transposition. If it is written at pitch, say so explicitly `[VSL Xylophone]` |
| Octave lines | Acceptable for the extreme top, but usually unnecessary (practice) |

#### Vibraphone
| Aspect | Convention |
|---|---|
| Notation | "written in treble clef on one staff and sounds as written"; range F3–F6, or C3–F6 `[VSL Vibraphone]` |
| Pedal and motor | The pedal works like a piano damper pedal; the motor runs at 0–12 rotations per second `[VSL Vibraphone]`. How to mark them: pedal lines or "l.v.", and "motor on/off" text (practice; unsourced). "l.v." = laissez vibrer `[Wikipedia: Glossary of musical terminology]` |

#### Marimba
| Aspect | Convention |
|---|---|
| Notation | "Notation is as for the piano – in treble and bass clef – and sounds as written"; commonly C3–C7 `[VSL Marimba]` |
| Staff | Grand staff; a single staff is also common for simple writing (practice) |
| Octave lines | Acceptable, as on keyboards (practice) |

#### Tubular bells
| Aspect | Convention |
|---|---|
| Notation | "the strike note is notated ... The sound is therefore as written, without transposition"; notated F3–F5 depending on the set `[VSL Tubular bells]`. Treble clef (practice) |
| Damping | Damper pedal like a piano's; individual notes can be damped by hand `[VSL Tubular bells]` |

#### Unpitched percussion
| Aspect | Convention |
|---|---|
| Staff | One-line staff for a single instrument, or a multi-line staff with a legend for a group (Gould, Behind Bars, ch. 10 "Percussion" > "Instruments of indefinite pitch" and "Layout of instruments of definite and indefinite pitch for one player", not re-checked) |
| Order | "Percussion instruments should be notated on the staff from high to low, according to their relative pitch." Keep pitched percussion staves adjacent. Lay out by instrument or by player, but consistently `[MOLA p. 2]` |
| Notation key | Helpful to print a notation key `[MOLA p. 3]`. The front matter should list all percussion instruments, with required ranges `[MOLA p. 4]` |
| C score | Unaffected |

### Keyboards

#### Celesta
| Aspect | Convention |
|---|---|
| Notation | "As for the piano, notation for the celesta is in treble and bass clef. The sound is an octave higher than written." `[VSL Celesta]` |
| C score | Keeps the octave transposition. This follows the octave convention in `[Dorico: Transposing instruments]`; Dorico's list of examples doesn't name the celesta |
| Pedal | Works like the piano's damper pedal `[VSL Celesta]` |
| Octave lines, dynamics | As for piano (topic 2) |
| Quarter tones | Impossible (fixed pitch) |

#### Piano: see topic 2. Harp: see topic 1.

### Strings

#### Violin
| Aspect | Convention |
|---|---|
| Clef | "non-transposing instrument notated in treble clef"; range G3–A7, with harmonics to D8 `[VSL Violin]` |
| Octave lines | Ledger lines are normal very high up. 8va appears in scores for extreme passages, but MOLA asks parts to avoid it `[MOLA p. 3]`. **Practice varies** (unsourced) |
| Harmonics, techniques | See topic 4 |

#### Viola
| Aspect | Convention |
|---|---|
| Clefs | "notated in alto clef, and in treble clef from the second octave above middle C"; treble only when higher passages warrant it `[VSL Viola]` |
| Threshold | Treble for phrases lying mostly above about E5/F5, which is 3 or more ledger lines in alto clef (practice) |
| Range | C3–A6, with harmonics to E7 `[VSL Viola]` |

#### Cello
| Aspect | Convention |
|---|---|
| Clefs | "notated mainly in bass clef. Because of its huge range tenor and treble clef are also used." `[VSL Cello]` |
| Tenor clef | The tenor-clef register starts at the open D string, which is the tenor clef's bottom line `[Orchestration Online: cello clefs]`. In practice, use it for phrases centred on roughly D4–B♭4 (practice) |
| Treble clef | "Notes from C in the staff and up are a general benchmark for justifying its use", i.e. C5 and up `[Orchestration Online: cello clefs]` |
| Obsolete | The 19th-century treble clef sounding an octave lower (Bruckner and others) `[VSL Cello]`, `[Orchestration Online: cello clefs]`. Never use it |
| Secondary quote | Adler, quoted by Orchestration Online, calls the tenor clef "useful essentially for reducing ledger lines" `[Orchestration Online: cello clefs]` |
| Range | C2–A5, with harmonics to A7 `[VSL Cello]` |

#### Double bass
| Aspect | Convention |
|---|---|
| Clefs and transposition | "written an octave higher than it sounds in bass clef"; tenor and treble clefs for high passages `[VSL Double bass]` |
| Treble clef: history vs modern | From Viennese Classicism to the later 19th century, treble-clef passages sounded **two** octaves lower. If a treble passage continued straight from tenor clef, it sounded one octave lower `[VSL Double bass]`. Modern practice is one octave-lower transposition in every clef (practice; Gould, Behind Bars, ch. 14 "Strings" > "Clefs", not re-checked) |
| Harmonics | Two conventions. (a) Treble clef at actual pitch, marked "actual pitch" or "sounding". (b) Bass clef, written an octave above sounding. VSL says (a) is "generally preferred by composers" `[VSL Double bass]`. **Pick one and state it in the preface.** |
| C score | Keeps the octave transposition `[Dorico: Transposing instruments]` |
| Range | B0–G4, with harmonics to G6 (five-string) `[VSL Double bass]` |

### Summary: clef sets and octave-line policy

| Instrument | Clefs allowed in the C score | Octave lines | Source |
|---|---|---|---|
| Piccolo, flute, alto flute, oboe, cor anglais | treble | avoid | [VSL ...], [MOLA p. 3] |
| Clarinets in B♭/A/E♭ | treble; bass only for sustained low passages in the C score | no | [Dorico: clefs for concert/transposed pitch]; practice |
| Bass clarinet | bass and treble | no | [Dorico: clefs for concert/transposed pitch] |
| Bassoon | bass, tenor (treble rare) | no | [VSL Bassoon] |
| Contrabassoon | bass (tenor rare) | no | [VSL Contrabassoon] |
| Horn | treble and bass | no | [VSL Horn] |
| Trumpet | treble | no | [VSL Trumpet in C] |
| Trombone | bass and tenor | no | [VSL Tenor trombone] |
| Bass trombone | bass (tenor rare) | no | [VSL Bass trombone] |
| Tuba | bass | no | [VSL Bass tuba] |
| Timpani | bass | no | [VSL Timpani] |
| Glockenspiel, crotales, xylophone, vibraphone, tubular bells | treble | acceptable but rarely needed | [VSL ...]; practice |
| Marimba, celesta, piano, harp | grand staff; either staff may be treble or bass | yes (8va/15ma/8vb/15mb) | [VSL Harp], [Dorico: Octave lines]; Gould, ch. 11 "Keyboard" > "Octave signs", not re-checked |
| Violin | treble | extreme passages only; practice varies | [MOLA p. 3] |
| Viola | alto and treble | no | [VSL Viola] |
| Cello | bass, tenor, treble | no | [VSL Cello] |
| Double bass | bass, tenor, treble | no | [VSL Double bass] |

---

## Part C: Topics

### 1. Harp (one or two harps)

**Staves and clefs**
- "As with the piano harp notation is written on two staves and is non-transposing. The lower staff is in bass clef, the upper in treble clef." And: "If required by the register both staves can be in the same clef, either bass or treble." `[VSL Harp]`
- The Timbre and Orchestration Resource says the same: grand staff, usually treble on top and bass below `[T&O Resource: Harp scoring]`.
- The grand staff is joined by a brace (practice).

**Hands and staves**
- "the right hand plays the short strings, the left hand the long ones", but "both hands can be active over the entire range" `[VSL Harp]`.
- Harpists can reach tenths, and both thumbs are on top. Divide arpeggios into groups of no more than four pitches per hand `[T&O Resource: Harp scoring]`.
- Upper staff = right hand, lower staff = left hand; cross-staff writing is fine (practice).

**Pedals**
- There are seven pedals, each controlling one pitch class in all octaves: three for the left foot and four for the right. The flat position lowers a semitone, natural is the middle position, and sharp raises a semitone `[Dorico: Harp pedaling]`. Wikipedia: "The seven pedals each affect the tuning of all strings of one pitch-class" `[Wikipedia: Pedal harp]`.
- Pedal order is D C B (left foot) | E F G A (right foot). MusicXML `<harp-pedals>` should follow "standard harp pedal order, with `<pedal-step>` values of D, C, B, E, F, G, and A" `[MusicXML 4.0: harp-pedals]`, `[MuseScore handbook: Harp]`.
- Two display forms `[Dorico: Harp pedaling]`:
  - a **diagram**, with a vertical line splitting the feet and a horizontal line for natural (above = flat, below = sharp)
  - **note names** in two lines (right foot on top)
- **Whether the composer prints pedal changes: practice varies.**
  - VSL: "Changes in pedal position should also be written into the score and are most conveniently effected during rests" `[VSL Harp]`.
  - MOLA, speaking of parts: "Harp pedaling should be left to the performer and not printed." `[MOLA p. 3]`
  - My recommendation for a chromatic or microtonal contemporary score: print the opening setting as a diagram, plus the changes the writing requires, so the judge can see the part is playable (practice; unsourced).
- **Where the pedal marks go: practice varies.**
  - "should be written above the top staff, or below the bottom one, but not in between the two" `[T&O Resource: Harp introduction]`.
  - MuseScore's defaults put diagrams above the staves and text markings between them `[MuseScore handbook: Harp]`.
  - I couldn't check Gould's rule (ch. 12 "Harp" > "Pedal settings", not re-checked).

**Spelling**
- "Proper enharmonic spellings are critical", because B♭ and A♯ are played on different strings. "Double sharps and double flats may never be written for harp—notate these enharmonically." `[T&O Resource: Harp introduction]`
- Gould has a section on this (ch. 12 "Harp" > "Note-spelling", not re-checked).

**Harmonics**
- "Harmonics are indicated by a small circle over the note and sound an octave higher than written." `[VSL Harp]`
- They "should be notated where they are played, not where they sound" `[T&O Resource: Harp scoring]`.
- So the written note is the string that is plucked, and the sound is an octave higher.

**Quarter tones on the harp**
- A pedal moves a whole pitch class by a semitone `[Wikipedia: Pedal harp]`, `[Dorico: Harp pedaling]`. Quarter tones therefore need **individual strings retuned** (scordatura). Wikipedia gives standard scordatura instructions such as "Tune low C to C♭" `[Wikipedia: Pedal harp]`.
- A standard solution is **two instruments tuned a quarter tone apart**. "much quarter toned music is written for pairs of pianos, violins, harps, etc."; retuning is "harder for harps" than for violins `[Microtonal Encyclopedia: Quarter tone]`.
- Harpists are not used to reading quarter tones. One harpist describes "reading quartertones and knowing which pedal setting it refers to" as outside "a harpists natural comfort zone", and made a chart linking quarter-tone accidentals to pedal settings `[Lauren Scott: quarter tones and harp pedals]`. So the notation must make the string and the pedal obvious.
- **Recommended notation.** This is my inference from the spelling rule above and the harpist's account; I found no single authority:
  1. Print a scordatura box in the preface and at the harp's first entry. Name each retuned string **with its octave**, e.g. "Harp 2: C4 and F3 tuned ¼ tone low; all other strings normal". Only that one string is altered; the same letter in other octaves is normal.
  2. Write the **sounding pitch** with a quarter-tone accidental, **spelled on the letter of the retuned string**. Then the letter tells the harpist which string, and the accidental tells them which pedal.
  3. Example: a C string tuned ¼ tone low gives C three-quarter-tones flat, C quarter-tone flat and C quarter-tone sharp with the pedal at flat, natural and sharp. A C string tuned ¼ tone high gives C quarter-tone flat, C quarter-tone sharp and C three-quarter-tones sharp.
  4. Never respell such a pitch onto a neighbouring letter: it would point to the wrong string.
  5. A pedal change on that pitch class moves both the retuned string and the normal strings of that letter.
  6. A harmonic on a retuned string keeps the ¼-tone offset, an octave up (physics; unsourced).
- **Two harps.**
  - Give each harp its own braced grand staff, labelled "Harp 1" and "Harp 2 (scordatura, see preface)" (practice).
  - Explain any non-standard setup in the front matter: MOLA asks for instructions for "uncommon instruments" and an explanation of deviations from standard notation `[MOLA p. 4]`.

### 2. Piano and celesta

- **Grand staff with brace; right hand upper, left hand lower.** Either staff may change clef; both can be treble or both bass (Gould, Behind Bars, ch. 11 "Keyboard" > "The system and clefs" and "Distributing notes between the hands", not re-checked). Marimba and harp use the same system `[VSL Marimba]`, `[VSL Harp]`. The celesta uses it too and sounds an octave higher `[VSL Celesta]`.
- **Octave lines are normal on keyboards.**
  - They are dashed lines with "8" (one octave) or "15" (two octaves): above the staff for higher, below for lower `[Dorico: Octave lines]`.
  - They are "usually placed outside all other notations", and it is customary to repeat the numeral at the start of each system `[Dorico: Octave lines]`.
  - "loco" cancels an 8va or 8vb `[Wikipedia: Glossary of musical terminology]`.
- **Dynamics.** "For grand staff instruments, such as piano or harp, dynamics are usually placed between the two staves, but can be placed both above and below when each staff requires separate dynamics." `[Dorico: positions of dynamics]`
- **Pedal.**
  - Pedal marks go below the lower staff, outside the dynamics. Dorico places dynamics "inside pedal lines, which can be placed further from noteheads and still be clearly understood" `[Dorico: positions of dynamics]`.
  - Forms: "Ped. ... ✱" or bracket lines with retakes. Lines are preferred in contemporary music for exact release points (Gould, Behind Bars, ch. 11 "Piano notation" > "Pedalling", not re-checked).
  - Una corda ("u.c.") / "tre corde" and sostenuto ("Sost. Ped.") are text or lines (practice).
  - The celesta pedal works like the piano's damper pedal `[VSL Celesta]`.
- **Quarter tones.** Impossible on a normally tuned piano or celesta. The known solutions are retuning and pairs of instruments:
  - Two pianos a quarter tone apart: Ives, *Three Quarter-Tone Pieces*, "for two pianos, one tuned a quarter-tone sharp"; Wyschnegradsky; Haas, "3 Hommages, for piano player on two pianos tuned a quarter tone apart"; Corigliano; Tenney `[Wikipedia: List of quarter tone pieces]`.
  - In the orchestra: Adès, *Asyla*: "3 pianos (a grand piano and 2 upright pianos, one tuned a quarter tone lower, ...)" `[Wikipedia: Asyla]`. Corigliano, *Three Hallucinations*, asks "a piano tuner to tune 9 pitches to be a quarter tone flat" `[Wikipedia: Scordatura]`.
  - For strings, Ligeti's *Ramifications* tunes string group I "a quarter tone higher (approximately A=453)" `[Wikipedia: Ramifications (Ligeti)]`.
  - **How to indicate it (practice; unsourced):** put it in the instrument name ("Piano 2 (upright, tuned ¼ tone lower)"), in the instrumentation page, and as a short note at the first entry. MOLA asks the front matter to explain special instruments and non-standard notation `[MOLA p. 4]`.
  - **How to write the part:** at the **keys to be pressed**, never with quarter-tone accidentals. This follows the general scordatura convention: "It is common to notate the finger position as if played in regular tuning, while the actual pitch resulting is altered" `[Wikipedia: Scordatura]`.
  - In a C score, a reader-friendly option is a note at the first entry such as "sounds ¼ tone lower than written" (practice; unsourced).
  - For a piano tuned ¼ tone low: key pitch = sounding pitch + ¼ tone. A sounding "X quarter-tone flat" is played on key X, and a sounding "X quarter-tone sharp" on key X♯.

### 3. Timpani

- **Clef and key signature:** bass clef, non-transposing, "always in bass clef" `[VSL Timpani]`. No key signature; accidentals are written `[Wikipedia: Timpani]`, `[MOLA p. 3]`.
- **Tuning indications.**
  - State the opening tuning at the start of each movement or section (Gould, Behind Bars, ch. 10 "Percussion" > "Timpani", not re-checked).
  - Mark retuning with *muta*: "Change [to...]: an instruction either to change instrument ... or to change tuning" `[Wikipedia: Glossary of musical terminology]`.
  - Usual forms: "muta B♭ in A", "B♭ → A" or "change B♭ to A", placed above the staff in the rest before the change (practice; unsourced).
- **Pedal glissando.** Modern pedal drums allow a "resonance glissando" (pedal moved just after the stroke) and a glissando roll; both need pedal instruments `[VSL Timpani]`.
- **Ranges (VSL's Viennese set).** D drum C2–C3, G drum E2–E3, C drum A♭2–A♭3, F drum C3–G♯3, A drum C3–C♯4, B drum G3–C4 `[VSL Timpani]`.
- **Quarter tones.**
  - VSL does not cover microtones `[VSL Timpani]`.
  - Pedal timpani change pitch continuously (hence the glissando), so quarter-tone tunings can be set. That is my inference; the notation practice is unsourced.
  - There is no special symbol: use the score's quarter-tone accidentals in both the tuning indication and the notes, and give time to set and check the tuning (practice).
- The timpani are a separate part and a separate staff from the percussion `[MOLA p. 3]`.

### 4. Strings: harmonics, techniques, quarter tones

**Natural harmonics** can be written three ways `[VSL Violin]`, `[VSL Viola]`, `[VSL Cello]`:
- (a) "Pitch notation": a small circle above the note;
- (b) "finger notation": a diamond notehead at the touched node;
- (c) a diamond with the sounding pitch in brackets above.

Dorico's default is (a), a circle that "Usually indicates the desired sounding pitch of the harmonic". Its alternative diamond "Usually indicates the touched pitch required" `[Dorico: harmonic styles]`.

**Artificial harmonics**
- "The finger that firmly presses the string is notated as a pitch with the desired note value. The finger that lies lightly on the string ... is notated as an empty, 'white' diamond", so the diamond always looks like a whole note `[VSL Violin]`.
- Dorico's default is the same two-notehead form, stopped plus touched `[Dorico: harmonic styles]`. Dorico computes touched pitches for partials 2–6 `[Dorico: Harmonics]`.
- Usual form: diamond a perfect 4th above the stopped note, sounding two octaves above it (practice).
- Adding the sounding pitch as a small bracketed notehead above is common and helps a reader of a C score (practice; this matches VSL's combined approach for natural harmonics).
- **Double bass harmonics:** see the double bass row. Pick one convention and state it.

**Technique text** (definitions from `[Wikipedia: Glossary of musical terminology]`)
- "sul ponticello (pont.)" means bow or pluck very near the bridge.
- "sul tasto or tasto, tastiera (tast.)" means over the fingerboard.
- "ordinario (ord.)" ends extended techniques "and return[s] to normal playing". "naturale (nat.)" means the same.
- "pizzicato"/"arco", "col legno" (battuto/tratto), "con sordina" and "divisi (div.)".
- The glossary notes that "con sordino" is incorrect Italian, though often seen.
- Technique text goes above the staff (Gould, Behind Bars, ch. 14 "Strings" > "Technical instructions", not re-checked; practice).
- A gradual change is usually shown as "ord. → sul pont." with an arrow or dashed line (practice; unsourced).

**Quarter tones:** fully playable on strings, with the same accidentals as everywhere else (topic 5).

### 5. Quarter-tone accidentals in an orchestral score

**Symbols: the Stein–Zimmermann set** (SMuFL range "Stein-Zimmermann accidentals (24-EDO)", U+E280–U+E28F) `[SMuFL: Stein–Zimmermann]`:

| Meaning | SMuFL name | Codepoint | Shape |
|---|---|---|---|
| quarter-tone sharp | accidentalQuarterToneSharpStein | U+E282 | half sharp (one vertical stroke) |
| three-quarter-tones sharp | accidentalThreeQuarterTonesSharpStein | U+E283 | one and a half sharps (three vertical strokes) |
| quarter-tone flat | accidentalQuarterToneFlatStein | U+E280 | reversed flat |
| three-quarter-tones flat | accidentalThreeQuarterTonesFlatZimmermann | U+E281 | reversed flat and flat |
| alternates | accidentalNarrowReversedFlat / ...AndFlat | U+E284 / U+E285 | narrow reversed flat (and flat) |

- These are "the standard system of quarter-tone notation known as the Stein-Zimmermann accidentals" `[Wikipedia: Richard Heinrich Stein]`.
- Arrow accidentals (sharp-up, flat-down and so on) are a separate system `[MusicXML 4.0: accidental-value]`. Don't mix the two.

**MusicXML**
- `<alter>` takes decimals, "0.5 (quarter tone sharp)", so use ±0.5 and ±1.5 `[MusicXML 4.0: alter]`.
- `<accidental>` values are `quarter-sharp`, `three-quarters-sharp`, `quarter-flat` and `three-quarters-flat`. The spec calls these "Tartini-style quarter-tone accidentals" `[MusicXML 4.0: accidental-value]`.
- The `smufl` attribute can pin the exact glyph `[MusicXML 4.0: accidental]`.

**How long an accidental lasts** (Dorico's definitions) `[Dorico: accidental duration rules]`:
- *Common practice:* "an accidental applies for the duration of a bar and only to the pitch at which it is written, meaning each octave requires a separate accidental."
- *Second Viennese School:* "an accidental applies only to the note on which it is written. All notes show an accidental regardless of key signature, including unaltered notes which show naturals."
- *Modernist:* only altered notes show accidentals and naturals are not shown, but accidentals "only apply to the notes on which they are written."

Gould covers this under ch. 3 "Accidentals and key signatures" > "Use of accidentals in an atonal context", and "Microtones" > "Quarter-tones" and "Cancelling microtonal alteration" `[Gould ToC]`. I did not re-check that content.

**What contemporary scores do: practice varies** (unsourced; I found no count). Two approaches are both widespread:
- the bar rule with generous cautionary accidentals;
- a note-only rule, often with "except immediately repeated notes".

Whichever is used, the performance notes must say so. MOLA asks for any deviation from standard notation to be explained after the instrumentation page `[MOLA p. 4]`.

**Recommendation for this score** (a microtonal score read on paper by a judge): give every note an explicit accidental, naturals included. The only exceptions are an immediately repeated note of the same pitch and tied continuations. State this in the notes. It is Dorico's "Second Viennese School" rule plus the repeated-note exception. It removes all doubt about whether a note without an accidental is natural or still quarter-tone altered.

**Cautionary accidentals**
- If you keep the bar rule, mark cautionaries with `cautionary="yes"`, optionally `parentheses="yes"` `[MusicXML 4.0: accidental]`.
- Give one on the first return to a natural or semitone pitch after a quarter-tone alteration, within the bar and in the next bar (practice).

**Key signatures:** none. Horns, tuned percussion and timpani conventionally use accidentals rather than key signatures anyway `[MOLA p. 3]`.

**Performance-note templates** (my wording; not quotations)
- "Accidentals: [quarter-tone sharp] = ¼ tone sharp, [three-quarter-tones sharp] = ¾ tone sharp, [quarter-tone flat] = ¼ tone flat, [three-quarter-tones flat] = ¾ tone flat."
- "Each accidental applies only to the note it precedes, except immediately repeated notes. Naturals are always written."
- "Score in C. Piccolo, xylophone and celesta sound an octave higher, glockenspiel and crotales two octaves higher, contrabassoon and double bass an octave lower than written."
- "String harmonics: o = natural harmonic, written at sounding pitch; diamond = touching position."
- "Harp harmonics sound an octave higher than written."
- "Hairpins with a circle: from/to niente."
- "Harp 2 / Piano 2: retuning as listed; see the tuning box at the first entry."

### 6. Dynamics and text placement

- **Dynamics** go below the staff for instruments, "where they can be read alongside the notes", and above for voices so they "do not clash with lyrics". For grand-staff instruments they go between the staves, or above and below when each staff needs its own. They are not placed inside the staff, since "hairpins in particular become very hard to read". They sit outside slurs and inside pedal lines `[Dorico: positions of dynamics]`.
- **Hairpins** follow the same placement (practice).
- **Technique and expressive text** go above the staff (Gould, Behind Bars, ch. 16 "Preparing materials" > "Performance instructions", and ch. 14 "Strings" > "Technical instructions", not re-checked; practice).
- **Tempo** marks go "above the top staff and above the first violin line (or similarly positioned staff in the absence of strings) on each score page" `[MOLA p. 2]`.
- **Language:** instructions should be "in a conventional language such as English, Italian, German, or French" `[MOLA p. 2]`.
- **Niente**
  - "niente markings can be shown as either a circle, or the letter 'n'". As text, "dal niente" for crescendos and "al niente" for diminuendos `[Dorico: niente]`.
  - MusicXML `<wedge niente="yes">`: "a circle appears at the point of the wedge, indicating a crescendo from nothing or diminuendo to nothing". Use it on the crescendo start, or on the stop of a diminuendo `[MusicXML 4.0: wedge]`.
  - "a niente" = "to nothing" `[Wikipedia: Glossary of musical terminology]`.
  - Dorico notes that wind players cannot literally start from silence `[Dorico: niente]`. That is a performance fact, not a reason to avoid the mark.

### 7. Instrument names and abbreviations

- **First page vs later pages:** "At the beginning of the full score, the full name of each instrument should be listed to the left of the corresponding staff/staves ... On subsequent pages, abbreviations of the instrument names should be used." `[MOLA p. 2]`
- **Front matter:** full instrumentation, doublings, "keys of all transposing instruments", and a list of all percussion instruments with required ranges `[MOLA p. 4]`.
- **Language:** English and Italian are both common. Use one language consistently for names (Gould, Behind Bars, ch. 17 "Score layout" > "Instrument labelling", not re-checked). An Italian example: "Ob. for oboe, Fag. for bassoon (Italian: fagotto)" `[Wikipedia: Abbreviation (music)]`.
- **Score order:** "Woodwind / Brass / Timpani/Percussion/Harp/Keyboard instruments / Vocal / Strings". Within each group, "by sounding pitch high to low" `[MOLA p. 2]`.
- Even in a C score, the name keeps the instrument's key ("Clarinet in B♭", "Horn in F"). The front matter lists those keys anyway `[MOLA p. 4]`; the naming itself is practice.

Common forms are listed below. This is practice, not checked against one authority; check against Gould's labelling tables if it matters.

| English (full / short) | Italian (full / short) |
|---|---|
| Piccolo / Picc. | Ottavino / Ott. |
| Flute / Fl. | Flauto / Fl. |
| Alto Flute / A. Fl. | Flauto contralto / Fl. c. |
| Oboe / Ob. | Oboe / Ob. |
| Cor anglais (UK), English Horn (US) / C. a., E. H. | Corno inglese / C. ingl. |
| Clarinet in B♭ / Cl. | Clarinetto in Si♭ / Cl. |
| Clarinet in E♭ / E♭ Cl. | Clarinetto piccolo in Mi♭ / Cl. picc. |
| Bass Clarinet / B. Cl. | Clarinetto basso / Cl. b. |
| Bassoon / Bsn. | Fagotto / Fg. (Fag.) |
| Contrabassoon / Cbsn. | Controfagotto / Cfg. |
| Horn in F / Hn. | Corno / Cor. |
| Trumpet in C / Tpt. | Tromba / Tr. |
| Trombone / Tbn. | Trombone / Trb. |
| Bass Trombone / B. Tbn. | Trombone basso / Trb. b. |
| Tuba / Tba. | Tuba / Tb. |
| Timpani / Timp. | Timpani / Timp. |
| Percussion / Perc. | Percussione / Perc. |
| Glockenspiel / Glock. | Campanelli / Camp. |
| Crotales / Crot. | Crotali / Crot. |
| Xylophone / Xyl. | Xilofono / Xil. |
| Vibraphone / Vib. | Vibrafono / Vib. |
| Marimba / Mar. | Marimba / Mar. |
| Tubular Bells / Tub. B. | Campane tubolari / Camp. tub. |
| Celesta / Cel. | Celesta / Cel. |
| Piano / Pno. | Pianoforte / Pf. |
| Harp / Hp. | Arpa / Arp. |
| Violin I, II / Vln. I, II | Violino I, II / Vl. I, II |
| Viola / Vla. | Viola / Vla. |
| Violoncello / Vc. | Violoncello / Vc. |
| Double Bass / D.B. (Cb.) | Contrabbasso / Cb. |

---

## Part D: Checklist for the exporter

### Score level
1. [ ] Print "Score in C" on the first page and in the preface, and list the octave exceptions (Part A; Gould ch. 17, not re-checked).
2. [ ] Score order: woodwinds, brass, timpani, percussion, harp, keyboards, strings; high to low within each group `[MOLA p. 2]`.
3. [ ] First system: full names, including the key of transposing instruments (`<part-name>`). Later systems: abbreviations (`<part-abbreviation>`). One language throughout `[MOLA p. 2]`.
4. [ ] Tempo marks above the top staff and above Violin I. In Sibelius, set this with its system-object positions rather than trying to encode it in MusicXML (Sibelius feature; not verified this session) `[MOLA p. 2]`.
5. [ ] No key signatures anywhere `[MOLA p. 3]`.

### Transposition in the C score
6. [ ] All non-octave transpositions are removed: clarinets, cor anglais, alto flute, horn and trumpet are written at concert pitch `[MusicXML 4.0: concert-score]`.
7. [ ] Keep the octave transpositions `[Dorico: Transposing instruments]`. Encode each with `<transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>N</octave-change></transpose>` ("what must be added to a written pitch to get a correct sounding pitch" `[MusicXML 4.0: transpose]`). N = +1 for piccolo, xylophone and celesta; +2 for glockenspiel and crotales; −1 for contrabassoon and double bass. `<pitch>` is the written octave.
8. [ ] Never draw an octave clef (`<clef-octave-change>`) on those staves; the octave is implied `[Dorico: Transposing instruments]`, `[MusicXML 4.0: clef-octave-change]`.
9. [ ] Optionally add `<concert-score/>` in `<defaults>` (it allows exactly octave-only transposes) `[MusicXML 4.0: concert-score]`. **Test whether Sibelius reads it.**
10. [ ] **Round-trip test in Sibelius** with a one-bar file per octave-transposing instrument. Check that the displayed octave matches the conventional written octave and that playback is at sounding pitch. Sibelius keeps octave instruments at written pitch in concert view `[Sibelius forum: concert pitch and octave instruments]`.

### Clefs and octave lines
11. [ ] Enforce the per-instrument clef sets from the summary table in Part B. Highlights:
    - bass clarinet: bass clef at pitch, plus treble;
    - bassoon: bass and tenor;
    - trombone: bass and tenor, never alto;
    - viola: alto and treble;
    - cello: bass, tenor and treble; never the old octave-treble clef;
    - double bass: bass, tenor and treble, one consistent octave transposition;
    - timpani and tuba: bass only;
    - horn: treble and bass at sounding pitch.
12. [ ] Clef-change algorithm: decide per phrase with hysteresis. Change only if a sustained stretch (roughly a bar, or 4 or more notes) would need 3 or more ledger lines. Never change for 1–2 notes (practice; Gould ch. 1, not re-checked).
13. [ ] Octave lines only on piano, celesta, harp, marimba and (rarely) mallets. Never on brass, timpani, bassoons, clarinets, viola, cello or bass. Avoid on flute, piccolo and violin (`[MOLA p. 3]`; practice).
14. [ ] MusicXML octave-line semantics. Note pitches are the performed pitches, and an 8va line is an `<octave-shift>` of type **"down"**: "Thus a treble clef line noted with 8va will be indicated with an `<octave-shift>` down from the pitch data indicated in the notes". Sizes are 8, 15 and 22 `[MusicXML 4.0: octave-shift]`. Getting up/down backwards is a classic bug.

### Accidentals
15. [ ] Map microtones as `<alter>` ±0.5 / ±1.5 and `<accidental>` `quarter-sharp` / `three-quarters-sharp` / `quarter-flat` / `three-quarters-flat` `[MusicXML 4.0: alter]`, `[MusicXML 4.0: accidental-value]`. Optionally add `smufl="accidentalQuarterToneSharpStein"` and the like `[MusicXML 4.0: accidental]`, `[SMuFL: Stein–Zimmermann]`. **Test that Sibelius shows Stein–Zimmermann shapes, not arrows.**
16. [ ] Accidental policy: write an explicit accidental on every note, naturals included, except immediately repeated same-pitch notes and tie continuations. Print the matching performance note (topic 5) `[Dorico: accidental duration rules]`, `[MOLA p. 4]`.
17. [ ] Keep the spelling chosen by the composition layer. Never respell a quarter-tone pitch onto another letter automatically (this matters most on the harp).
18. [ ] Fixed-pitch instruments (piano, celesta, glockenspiel, crotales, xylophone, vibraphone, marimba, tubular bells, and harp without scordatura) must never get quarter-tone accidentals. If one arrives, fail loudly unless a retuning has been declared (topics 1 and 2).
19. [ ] Retuned piano: write key pitch (for a piano tuned ¼ tone low, sounding + ¼ tone), with plain 12-note accidentals. Add the retuning to the instrument name and the preface, plus a first-entry note "sounds ¼ tone lower than written" `[Wikipedia: Scordatura]`, `[Wikipedia: Asyla]`.
20. [ ] Retuned harp strings: write sounding pitch with quarter-tone accidentals, **spelled on the retuned string's letter**. Print a scordatura box that names the retuned strings by octave (topic 1, inference).

### Harp
21. [ ] Grand staff with brace; either staff may be treble or bass `[VSL Harp]`.
22. [ ] No double sharps or double flats; the letter name equals the string `[T&O Resource: Harp introduction]`.
23. [ ] Work out a pedal setting that is consistent in every bar. Print the opening setting (and the changes, placed in rests) as `<harp-pedals>` with `<pedal-tuning>` in the order D C B E F G A `[MusicXML 4.0: harp-pedals]`, `[VSL Harp]`. **Test Sibelius import.** If it fails, fall back to a text line such as "D♮ C♮ B♭ | E♭ F♮ G♮ A♮". Where the marks go varies; above the top staff or below the bottom one is the safe choice `[T&O Resource: Harp introduction]`.
24. [ ] Harp harmonics: write the plucked string pitch with a circle; it sounds an octave higher `[VSL Harp]`, `[T&O Resource: Harp scoring]`. In MusicXML: `<technical><harmonic><natural/><base-pitch/></harmonic></technical>` (element names from `[MusicXML 4.0: harmonic]`; mapping it this way is my reading).

### Strings
25. [ ] Natural harmonics at **sounding pitch** with a circle: `<harmonic><natural/><sounding-pitch/></harmonic>`. This is Dorico's default style `[Dorico: harmonic styles]`, `[MusicXML 4.0: harmonic]`.
26. [ ] Artificial harmonics as a chord:
    - the stopped note with a normal notehead and `<harmonic><artificial/><base-pitch/>`;
    - the touched note a perfect 4th above, as a diamond (`<notehead filled="no">diamond</notehead>`) with `<harmonic><artificial/><touching-pitch/>`.
    - Optionally add the sounding pitch as a small bracketed note `[VSL Violin]`, `[Dorico: harmonic styles]`.
27. [ ] Double-bass harmonics: pick one convention (sounding pitch in treble marked "sounding", or the transposed octave) and state it `[VSL Double bass]`.
28. [ ] Technique text as `<direction placement="above"><words>`, using "sul pont.", "sul tasto", "ord.", "pizz.", "arco", "col legno batt./tratto", "con sord./senza sord.", "div./unis." `[Wikipedia: Glossary of musical terminology]`.

### Dynamics
29. [ ] Dynamics and wedges: `placement="below"`. On grand-staff instruments (piano, celesta, harp, marimba), put them between the staves, i.e. below staff 1 when they apply to both hands `[Dorico: positions of dynamics]`.
30. [ ] Niente: `<wedge type="crescendo" niente="yes"/>` for dal niente, and `niente="yes"` on the stop of a diminuendo for al niente `[MusicXML 4.0: wedge]`. **Test Sibelius import.** If needed, fall back to the letter "n" or "dal/al niente" text `[Dorico: niente]`.

### Percussion and timpani
31. [ ] Unpitched: percussion clef, one-line staves (`<staff-lines>1</staff-lines>`, `<unpitched>`), and a notation key in the preface `[MOLA p. 3]`, `[MOLA p. 4]`.
32. [ ] Timpani: bass clef, no key signature. Print the opening tuning, and put "muta X in Y" / "X → Y" text above the staff in the rests before each retuning. Quarter-tone tunings use the same accidentals (`[VSL Timpani]`, `[Wikipedia: Glossary of musical terminology]`; practice).

### Things that must be tested in Sibelius (unverified assumptions)
33. [ ] Whether Sibelius matches imported parts to its own instrument definitions, for example through `<instrument-sound>`. Those definitions decide whether its octave transpositions and concert-pitch clefs apply. I did not check how Sibelius treats the bass clarinet's concert-pitch clef.
34. [ ] Whether `<concert-score/>`, `<harp-pedals>`, `<wedge niente>`, `<harmonic>` and the `smufl` accidental attribute survive import.
35. [ ] Whether imported clef changes show correctly in Sibelius's concert-pitch view. This is a paper-only C score, so choose every clef for the C score and ignore how the parts would look. Dorico can give the score and the parts different clefs `[Dorico: clefs for concert/transposed pitch]`; I did not check whether Sibelius can.

---

## Sources

Fetched and read in this session unless noted.

**Vienna Symphonic Library Academy** (instrument pages; see each page's "Notation" section)
- VSL Piccolo: https://www.vsl.co.at/academy/woodwinds/piccolo
- VSL Flute: https://www.vsl.co.at/academy/woodwinds/concert-flute
- VSL Oboe: https://www.vsl.co.at/academy/woodwinds/oboe
- VSL English horn: https://www.vsl.co.at/academy/woodwinds/english-horn
- VSL Clarinet: https://www.vsl.co.at/academy/woodwinds/clarinet
- VSL Bass clarinet: https://www.vsl.co.at/academy/woodwinds/bass-clarinet
- VSL Bassoon: https://www.vsl.co.at/academy/woodwinds/bassoon
- VSL Contrabassoon: https://www.vsl.co.at/academy/woodwinds/contrabassoon
- VSL Horn: https://www.vsl.co.at/academy/brass/horn-f
- VSL Trumpet in C: https://www.vsl.co.at/academy/brass/trumpet-c
- VSL Tenor trombone: https://www.vsl.co.at/academy/brass/tenor-trombone
- VSL Bass trombone: https://www.vsl.co.at/academy/brass/bass-trombone
- VSL Bass tuba: https://www.vsl.co.at/academy/brass/bass-tuba
- VSL Timpani: https://www.vsl.co.at/academy/percussion/timpani
- VSL Glockenspiel: https://www.vsl.co.at/academy/percussion/glockenspiel
- VSL Xylophone: https://www.vsl.co.at/academy/percussion/xylophone
- VSL Vibraphone: https://www.vsl.co.at/academy/percussion/vibraphone
- VSL Marimba: https://www.vsl.co.at/academy/percussion/marimba
- VSL Tubular bells: https://www.vsl.co.at/academy/percussion/tubular-bells
- VSL Celesta: https://www.vsl.co.at/academy/percussion/celesta
- VSL Harp: https://www.vsl.co.at/academy/strings/harp
- VSL Violin: https://www.vsl.co.at/academy/strings/violin
- VSL Viola: https://www.vsl.co.at/academy/strings/viola
- VSL Cello: https://www.vsl.co.at/academy/strings/cello
- VSL Double bass: https://www.vsl.co.at/academy/strings/double-bass

**Dorico documentation** (Steinberg; archived manual pages)
- Dorico: Transposing instruments (Dorico Pro 5): https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/setup_mode/setup_mode_instruments_transposing_c.html
- Dorico: clefs for concert/transposed pitch: https://archive.steinberg.help/dorico_pro/v4/en/dorico/topics/notation_reference/notation_reference_clefs/notation_reference_clefs_pitch_concert_transposed_specifying_t.html
- Dorico: accidental duration rules: https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_accidentals/notation_reference_accidentals_duration_rules_r.html
- Dorico: positions of dynamics: https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/notation_reference/notation_reference_dynamics_positions_c.html
- Dorico: niente: https://archive.steinberg.help/dorico_pro/v4/en/dorico/topics/notation_reference/notation_reference_dynamics/notation_reference_dynamics_niente_hairpins_c.html
- Dorico: Octave lines: https://archive.steinberg.help/dorico_pro/v4/en/dorico/topics/notation_reference/notation_reference_octave_lines/notation_reference_octave_lines_c.html
- Dorico: Harp pedaling: https://archive.steinberg.help/dorico_pro/v4/en/dorico/topics/notation_reference/notation_reference_harp_pedaling/notation_reference_harp_pedaling_c.html
- Dorico: harmonic styles: https://archive.steinberg.help/dorico_se/v3/en/dorico/topics/notation_reference/notation_reference_harmonics/notation_reference_notes_harmonics_styles_appearances_r.html
- Dorico: Harmonics: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_harmonics/notation_reference_notes_harmonics_c.html

**MusicXML 4.0 reference** (W3C)
- concert-score: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/concert-score/
- transpose: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/transpose/
- octave-shift: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/octave-shift/
- clef-octave-change: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/clef-octave-change/
- alter: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/alter/
- accidental-value: https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/accidental-value/
- accidental: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/accidental/
- wedge: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/wedge/
- harmonic: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/harmonic/
- harp-pedals: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/harp-pedals/

**SMuFL**
- SMuFL: Stein–Zimmermann: https://www.w3.org/2021/03/smufl14/tables/stein-zimmermann-accidentals-24-edo.html

**Guidelines and books**
- MOLA Guidelines for Music Preparation (Major Orchestra Librarians' Association). Page numbers are the PDF's printed pages: p. 2 = full score, p. 3 = parts, p. 4 = front matter. https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf
- Gould ToC: Elaine Gould, *Behind Bars* (Faber, 2011), table of contents on the book's website: https://www.behindbarsnotation.co.uk/contents/toc.pdf. I confirmed only the section titles online; the content attributed to Gould above is marked "not re-checked".

**Sibelius-related pages**
- Sibelius forum: concert pitch and octave instruments. Sibelius Help Center thread "Sib. 6.1: Concert Pitch Scores and Transposing Instruments" (user forum): https://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=487450&groupid=3&guest=1
- Making the most of notation software, "Concert and Transposed View in Finale and Sibelius": https://makingthemostofnotationsoftware.blog/2013/10/06/concert-and-transposed-view-in-finale-and-sibelius/
- Mozart notation guide, "Transposing Instruments": https://www.mozart.co.uk/music-theory/transposing-instruments.htm
- VI-Control: bass clarinets (forum; seen only as a search-result summary, not fetched): https://vi-control.net/community/threads/bass-clarinets.34027/

**Harp**
- T&O Resource: Harp introduction: https://timbreandorchestration.org/isfee/extreme-orchestration/harp/introduction
- T&O Resource: Harp scoring: https://timbreandorchestration.org/isfee/extreme-orchestration/harp/scoring
- MuseScore handbook: Harp: https://handbook.musescore.org/idiomatic-notation/harp
- Lauren Scott: quarter tones and harp pedals: https://www.lauren-scott-harp.co.uk/harpyness/quarter-tones-harp-pedals

**Other**
- Orchestration Online: cello clefs: https://orchestrationonline.com/cello-registers-as-defined-by-clefs/
- Microtonal Encyclopedia: Quarter tone: https://microtonal.miraheze.org/wiki/Quarter_tone

**Wikipedia**
- Alto flute: https://en.wikipedia.org/wiki/Alto_flute
- Crotales: https://en.wikipedia.org/wiki/Crotales
- Timpani: https://en.wikipedia.org/wiki/Timpani
- Clef: https://en.wikipedia.org/wiki/Clef
- Pedal harp: https://en.wikipedia.org/wiki/Pedal_harp
- Glossary of musical terminology: https://en.wikipedia.org/wiki/Glossary_of_musical_terminology
- Abbreviation (music): https://en.wikipedia.org/wiki/Abbreviation_(music)
- Richard Heinrich Stein: https://en.wikipedia.org/wiki/Richard_Heinrich_Stein
- List of quarter tone pieces: https://en.wikipedia.org/wiki/List_of_quarter_tone_pieces
- Asyla: https://en.wikipedia.org/wiki/Asyla
- Scordatura: https://en.wikipedia.org/wiki/Scordatura
- Ramifications (Ligeti): https://en.wikipedia.org/wiki/Ramifications_(Ligeti)

**Gaps.** Things I could not verify online in this session:
- Gould's actual wording on accidentals in atonal music, octave signs, pedal-mark placement, harp scordatura and timpani tuning marks.
- Adler's, Stone's and the Norton Manual's clef thresholds.
- A publisher's printed "score in C" preface.
- How Sibelius imports each of the MusicXML features above.
