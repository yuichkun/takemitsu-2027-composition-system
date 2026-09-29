# Orchestral full-score layout: conventions for the MusicXML → Sibelius export

Research date: 2026-09-29. Target: a printed **score in C** (octave-transposing instruments excepted) of a 10–20 min orchestral piece with quarter tones, entered anonymously in the Toru Takemitsu Composition Award, where the jury reads only the printed score.

**How to read this**

- Every claim has a source tag in square brackets with page or section. The full list with URLs is at the end.
- **[assessment]** marks my own judgement, used where the sources don't settle a question such as what is most common after 1950. **[unverified]** marks something I believe but could not confirm from a fetched source.
- **Limits of access.** I could not read Gould's *Behind Bars* directly: there is no legitimate full text online, and Google Books answered with a CAPTCHA, which I did not try to get around. Gould therefore appears here only through secondary quotations: Scoring Notes on system dividers; the Indiana University composition style guide, which names Gould, Read and Stone as its standards; and MOLA, which lists Gould among its resources. I did not access the Norton Manual or Kurt Stone; the only copies I found online were unauthorised, so I did not use them. I found no public house-style documents from Boosey & Hawkes, Schott, Bärenreiter, Faber, UE or Peters. The only publisher-specific evidence is the difference between Chester Novello and Boosey & Hawkes instrumentation shorthand, documented on Wikipedia with a citation to Daniels, *Orchestral Music*.

---

## 1. Score order (top to bottom)

### Convention

- **Family order:** woodwind → brass → timpani/percussion/harp/keyboards → (voices) → strings. Anything that does not fit elsewhere goes in the third group. Within a family, the order is broadly by sounding pitch, high to low. MOLA also notes that many exceptions exist. [MOLA 2017, p. 2]
- **MOLA's model first page (Example 1),** top to bottom: Piccolo · Flutes 1, 2 · Oboes 1, 2 · English Horn · Clarinets 1, 2 in B♭ · Bass Clarinet in B♭ · Alto Saxophone in E♭ · Bassoons 1, 2 · Contrabassoon ‖ Horns 1, 2 in F · Horns 3, 4 in F · Trumpets 1, 2 in C · Trumpet 3 in C · Trombones 1, 2 · Bass Trombone/Tuba ‖ Timpani · Percussion · Glockenspiel · Harp · Piano · Celesta · (guitars, solo voice, choir, solo instrument: not relevant here) ‖ Violin I · Violin II · Viola · Violoncello · Double Bass. [MOLA 2017, Example 1, p. 7]
- **NZSM gives the same order as a list:** piccolo, flutes, oboe, cor anglais, clarinets, saxophones, bassoons, contrabassoon, horns, trumpets, trombones, bass trombone, tuba, timpani, percussion, harp, piano, violins, violas, cellos, double basses. [NZSM, p. 4]
- **Where the auxiliary instruments sit:**
  - Piccolo goes above the flutes. English horn goes below the oboes. Bass clarinet goes directly below the clarinets. Saxophone goes between the clarinets and the bassoons. Contrabassoon goes below the bassoons. [MOLA 2017, Example 1; NZSM, p. 4]
  - Alto flute goes below the flutes and E♭ clarinet above the B♭ clarinets. This follows from the high-to-low rule [MOLA 2017, p. 2]. Wikipedia's lists of auxiliary winds in typical score order are consistent with this, citing the *Harvard Dictionary of Music*, 2nd ed., pp. 604–5. The lists run piccolo, cor anglais, E♭ clarinet, bass clarinet, contrabassoon, then the rarer alto flute, bass flute, oboe d'amore, … saxophones. They do not, however, say where each auxiliary sits relative to its main instrument. [Wikipedia: Woodwind section]
- **Horns above trumpets** in orchestral scores. [MOLA 2017, Ex. 1; NZSM, p. 4] Trumpets or cornets go above horns only in brass quintet, brass band and concert band. [NZSM, p. 4]
- **Timpani directly above the other percussion.** [MOLA 2017, Ex. 1; NZSM, p. 4]
  - Percussion may be laid out by instrument, with pitched-percussion staves kept adjacent (above or below the unpitched ones), or by player. Whichever layout is chosen must stay the same for the whole work. [MOLA 2017, p. 2]
  - The order within the percussion section differs from score to score. [Sibelius Ref, p. 173]
- **Strings:** Violin I, Violin II, Viola, Violoncello, Double Bass. [MOLA 2017, Ex. 1]
- **The competition's one "extra wind"** goes into its family by pitch; for example, a saxophone goes between the clarinets and the bassoons. [MOLA 2017, Ex. 1; NZSM, p. 4]

### Variants

- **Doubling players.** In this orchestra every auxiliary instrument is a doubling [Takemitsu rules], and there are two layouts:
  - **Instrument-based:** each auxiliary has its own fixed staff in its pitch position, as in MOLA Example 1 (a separate Piccolo, English Horn, Bass Clarinet or Contrabassoon staff).
  - **Player-based:** each player keeps one staff in the player's position. The label changes when the player changes instrument, with a "To X" warning beforehand and the new instrument's name at the entry. This is how Sibelius instrument changes and Dorico's player/instrument model work, and NZSM asks for the label change in the score. [Sibelius Ref, pp. 176–177; Dorico: Instrument changes; NZSM, p. 15]
  - **[assessment]** The player-based layout is the norm when a section player switches instrument for some passages. The instrument-based layout is used when the auxiliary instrument plays most of the piece, or plays at the same time as its section.
- **Shared staves for pairs versus one staff per player.**
  - Traditional orchestral scores put pairs on one staff unless the parts are rhythmically independent. [NZSM, p. 14; MOLA 2017, Ex. 1]
  - Dorico automates this as "condensing" (for example Flutes 1–2 or Horns 1–4 on one staff). [Dorico: Hiding/showing empty staves, condensing definition]
  - **[assessment]** Contemporary scores with independent lines usually give each player a staff, which costs vertical space (see the page and staff size section).
- **Harp versus keyboards: genuinely variable.**
  - Harp above the keyboards: MOLA Example 1 (Harp, Piano, Celesta); NZSM (harp, piano); Chester Novello's shorthand for *Pictures at an Exhibition* ("2 hp. cel"). [MOLA 2017, p. 7; NZSM, p. 4; Wikipedia: Shorthand]
  - Keyboards above harp: Boosey & Hawkes' shorthand for the same work ("cel – 2 harps"). [Wikipedia: Shorthand]
  - Celesta versus piano: the pitch rule would put celesta above piano [MOLA 2017, p. 2], but MOLA's own example puts piano above celesta [MOLA 2017, p. 7]. There is no firm rule.
  - Sibelius's short summary of orchestral order even places singers before keyboards. [Sibelius Ref, p. 173]
  - **[assessment]** The layout the verifiable sources show most often is harp(s) directly under the percussion, then the keyboards. Choose one order and keep it.
- **Older scores** can differ; MOLA notes that the exceptions are many. [MOLA 2017, p. 2] Its 19th-century example (a Beethoven 9 edition, Example 6) nonetheless follows the same family order, with horns above trumpets. [MOLA 2017, p. 9] Specific historical deviations are not documented in the sources I read **[unverified]**.

**Most common now [assessment]:** MOLA's family order, horns above trumpets, timpani above percussion, and percussion laid out by player.

**Sources:** MOLA 2017 pp. 2, 7, 9 · NZSM p. 4 · Sibelius Ref pp. 173, 176–177 · Dorico: Instrument changes · Wikipedia: Woodwind section; Shorthand for orchestra instrumentation · Takemitsu rules.

---

## 2. Brackets, sub-brackets, braces, barlines

### Convention

- **A thick bracket for each family:** woodwind, brass, percussion, strings. [Sibelius Ref, p. 402 and Glossary "bracket"; IU; Dorico: Brackets according to ensemble type ("Orchestral": bracketed by instrument family)]
- **A sub-bracket (secondary bracket).** It is a thin, square-ended line to the left of the main bracket. It groups:
  - staves of the same instrument type (Flutes, Horns, Trumpets, Violins I + II);
  - divided (divisi) staves.

  [Sibelius Ref, p. 402; Dorico: Secondary brackets; IU] IU also asks for a third level of bracket for violin divisi, and Dorico supports sub-sub-brackets. [IU; Dorico: Secondary brackets]
- **A brace for the staves of one instrument:** piano, harp, celesta, and organ manuals (the organ pedal staff is not braced). [Sibelius Ref, p. 402; MOLA 2017, Ex. 1]
  - Both Sibelius and Dorico prevent a braced instrument from also being bracketed with other instruments. [Sibelius Ref, p. 187; Dorico: Brackets according to ensemble type]
  - So Harp 1 and Harp 2 each get their own brace, and the software defaults do not group them together **[assessment for "not grouped"]**.
- **Timpani:** IU brackets the percussion but not the timpani, piano or harp. [IU] Sibelius says percussion and solo instruments are usually not bracketed, and small groups not at all. [Sibelius Ref, p. 402] See Variants.
- **Barlines:**
  - Barlines are continuous within each family and broken between families. [MOLA 2017, p. 5 and Example 6, p. 9; IU]
  - Staves that are bracketed, sub-bracketed or braced together normally share barlines. [Sibelius Ref, p. 402]
  - The barline runs continuously through divided string staves. [MOLA 2017, p. 5]
  - In Dorico's orchestral grouping, vocal staves are not joined by barlines (not relevant here). [Dorico: Brackets according to ensemble type]
- **A little extra vertical space between bracket groups.** [Sibelius Ref, p. 642]

### Variants

- **Braces instead of sub-brackets in older scores,** especially for horns and for Violins I/II. Sibelius's "draw as brace" option exists for this old-fashioned style. MOLA's Example 6 (a Beethoven 9 edition) braces piccolo+flutes, bassoons+contrabassoon, horns, trombones and Violins I/II. [Sibelius Ref, pp. 402–403 and Glossary "brace"; MOLA 2017, p. 9]
  - **[assessment] Post-1950 and in current software defaults:** sub-brackets.
- **Percussion bracketed or not:**
  - Bracketed: IU, and MOLA Example 6, which brackets triangle with cymbals/bass drum.
  - Not normally bracketed: Sibelius.
  - Whether the timpani joins the percussion bracket: IU says no. **[assessment]** Both occur. With 3–4 percussion players on several staves, bracketing the percussion is the clearer choice.

### Encoding (MusicXML 4.0)

- `<part-group type="start|stop" number="n">`, where `number` distinguishes nested or overlapping groups.
- `group-symbol` takes `none | brace | line | bracket | square`.
- `group-barline` takes `yes | no | Mensurstrich`.
- The brace of a multi-staff part is not a part-group. It is set in that part's `<attributes><part-symbol>` (brace by default). A part-symbol that does not span all the part's staves also changes the barlines inside that part. [MusicXML 4.0]
- How Sibelius imports `square` (as a sub-bracket or not) is **untested**. Sibelius joins barlines according to its brackets anyway. [Sibelius Ref, p. 402]

**Sources:** Sibelius Ref pp. 187, 402–403, 642, Glossary · Dorico: Brackets according to ensemble type; Secondary brackets · IU · MOLA 2017 pp. 5, 7, 9 · MusicXML 4.0 schema.

---

## 3. Instrument names

### Convention

- **Full names on the first system, abbreviations on every later system.** [MOLA 2017, p. 2 and Examples 1–2; MOLA 2006, p. 4; Dorico: Staff labels; NZSM, p. 4]
  - For large scores, Sibelius recommends names on every system (full or short). Dropping names after the first system is recommended only for small scores with no hidden staves. [Sibelius Ref, p. 449]
  - IU wants names in the left margin of every page, including reminders of current doublings and mutes. [IU]
- **MOLA's abbreviations (Example 2):** Picc., Fl. 1, 2, Ob. 1, 2, E. H., Cl. 1, 2 (B♭), Bass Cl. (B♭), Alto Sax., Bsn. 1, 2, Cbsn., Hn. 1, 2 in F, Tpt. 1, 2 in C, Tbn. 1, 2, Bass Tbn./Tba., Timp., Perc., Glock., Hp., Pno., Cel., Vln. I, Vln. II, Vla., Vlc., D. B. [MOLA 2017, p. 7]
  - IU suggests Picc., Fl., Ob., E.Hn., Cl., Bcl., Bn., Hn., Tp., Trb., Btrb., Tba., Timp., Pc., Hp., Pn., Vn., Va., Vc., Cb. [IU]
- **Numbering:**
  - A shared staff must always say how many players it carries; "Flutes" alone is never enough. [Goss 2022; NZSM, p. 14 (full and short names both carry the numbers)]
  - Formats in the sources: "Flutes 1, 2" / "Fl. 1, 2" [MOLA 2017, p. 7]; "Trumpets 1.2.3", "Trumpet 1.2" [Sibelius Ref, p. 175]; "Flutes I, II" / "Fl. I, II" [NZSM, p. 14].
  - Dorico's numbering option uses Arabic numerals for solo players (winds) and Roman for section players (strings). [Dorico: Changing the staff label numbering style]
  - Horn pairs on shared staves: 1, 2 / 3, 4 in both MOLA examples. [MOLA 2017, pp. 7, 9] Pairing 1.3 / 2.4 (high and low horns) also exists **[unverified]**.
- **Transposing instruments carry their key** in MOLA's names ("Clarinets 1, 2 in B♭", "Horns … in F", "Trumpets … in C"; abbreviated "Cl. 1, 2 (B♭)"). [MOLA 2017, p. 7] In every case the instrumentation list must give the key of each transposing instrument. [MOLA 2017, p. 4; MOLA 2006, p. 3]
- **Language:**
  - Instructions should be in one conventional language (English, Italian, German, French). [MOLA 2017, p. 2]
  - The competition requires English, French, German or Italian for written instructions. [Takemitsu rules]
  - **[assessment]** Keep the instrument names in one language as well; don't mix "Flute" with "Fagotto".
- **Strings:** "Violin I, Violin II, Viola, Violoncello, Double Bass" / "Vln. I, Vln. II, Vla., Vlc., D. B." [MOLA 2017, p. 7] Dorico stores both singular and plural names ("Violin"/"Violins"). [Dorico: Staff labels]
- **Divisi:** mark "div.", "div. a 3" and so on next to the abbreviated staff or group name. [IU] Sibelius's example adds an italic "divisi" under "Violin I". [Sibelius Ref, p. 450] Dorico labels divisi staves and shows "div."/unison indications. [Dorico: Staff labels on condensed staves]
- **Doublings:**
  - After an instrument change, the labels on later systems show the new instrument. [Sibelius Ref, p. 177; NZSM, p. 15]
  - IU recommends running labels such as "Fl./Picc." [IU]
  - Dorico notes that staff labels cannot show every instrument a player holds, so the doublings must be listed at the front. [Dorico: Staff labels]
- **Percussion:** label by player ("Percussion 1") or by instrument, consistently, and name each instrument where it is taken up. [MOLA 2017, p. 2; IU]

### Variants

- **Key in names in a C score.** Dorico can hide the key in full-score labels while showing it in parts, but it always shows unusual transpositions (Clarinet in A, Trumpet in E) to avoid confusion. [Dorico: Instrument transpositions in staff labels] **[assessment]** Both appear in C scores. The safest choice: key in the full first-system name ("Clarinet in B♭ 1"), optional in abbreviations.
- **Numbering format.** Separators and numerals vary: "1, 2" or "1.2"; I/II or 1/2. **[assessment]** Most common now: Arabic numerals for wind, brass and percussion players, Roman numerals for Violin I/II. Use one separator style throughout.
- **Label alignment.** Names are traditionally centred in a column; right-aligned names are also used. [Sibelius Ref, p. 450]
- **"Cb." or "D. B."; "Violin I" or "Violins I".** Both pairs are current. [IU; MOLA 2017; Dorico: Staff labels] **[assessment]** The singular "Violin I" is the more usual modern label.

**Sources:** MOLA 2017 pp. 2, 4, 7, 9 · MOLA 2006 pp. 3–4 · Sibelius Ref pp. 175, 177, 449–450 · Dorico: Staff labels; Instrument transpositions in staff labels; Changing the staff label numbering style; Staff labels on condensed staves · NZSM pp. 4, 14–15 · IU · Goss 2022 · Takemitsu rules.

---

## 4. "Score in C" / transposed score

### Convention

- **Say explicitly** whether the score is transposed or in C:
  - on the first page of the score [ACA];
  - on the preface pages [NZSM, p. 3];
  - "in the score" [MacDonald 2026].
- **[assessment]** Do both: "Score in C" at the top left of page 1 of the music, plus a sentence in the notes that lists the octave transpositions.
- **Octave-transposing instruments keep their octave transposition** in a C score:
  - Sibelius: piccolo and double bass (and tenor voice) are customarily written an octave from sounding pitch even in a non-transposing score, and they are predefined that way. [Sibelius Ref, p. 187]
  - Dorico: piccolo, double bass and glockenspiel are the conventional examples, and the software applies octave transpositions automatically even without octave clefs. [Dorico: Transposing instruments; Dorico: Clefs with octave indicators] A search-engine summary of the current Dorico 5.1 help says this also applies to concert-pitch layouts. That page only renders with JavaScript, so I could not read it myself **[unverified]**.
  - MusicXML 4.0's `<concert-score/>` allows only octave transpositions (`octave-change`/`double`) in a concert-pitch score and forbids diatonic/chromatic ones. [MusicXML 4.0]
- **Octave transposers in this orchestra:**
  - piccolo (sounds +1 octave), celesta (+1), xylophone (+1), glockenspiel (+2), crotales (+2), contrabassoon (−1), double bass (−1). Guitar (−1) is not used. [Wikipedia: List of transposing instruments (written C4 sounds: piccolo, celesta, xylophone C5; glockenspiel, crotales C6; contrabassoon, double bass C3); Wikipedia: Transposing instrument; Dorico: Transposing instruments; Sibelius Ref, p. 187]
  - Alto flute (written C4 sounds G3) is not an octave transposer, so it is written at sounding pitch in a C score. [Wikipedia: List of transposing instruments]
  - Crotales notation varies between percussion publications; state the octave in the notes. **[assessment]**
- **Written at sounding pitch in a C score:** alto flute, English horn, E♭/B♭/A clarinets, bass clarinet, horns, trumpets in B♭.
  - Clefs follow sounding pitch. Dorico's own example is a bass clarinet shown in treble clef in the part but bass clef in the concert-pitch score. [Dorico: Setting different clefs for concert/transposed pitch]
  - **[assessment]** At sounding pitch, horns need the bass clef more often than in a transposed score.
- **Dorico's defaults:** the full-score layout is at concert pitch and the parts are transposed. [Dorico: Concert vs. transposed pitch]

### Variants

- **Transposed scores** are still the norm in traditional repertoire, and some teaching institutions require them. NZSM insists that student scores be transposed. [NZSM, pp. 3–4]
- **C scores** have been written since the early 20th century; Prokofiev's Piano Concerto No. 1 is the usual example. [Wikipedia: Transposing instrument] **[assessment]** In post-1950 contemporary orchestral music, C scores are very common.
- **Terminology:** German practice distinguishes a "klingend" (sounding) score from a "transponierend" (transposing) one, and practitioners note that piccolo and double bass stay transposed even in a "sounding" score. [Finale forum (practitioners; weak source)]

### Exporter implication

- Sibelius's MusicXML importer is based on MusicXML 3.0 [Sibelius Ref, p. 53], so it most likely ignores the 4.0 `concert-score` flag **[assessment]**.
- **Safer route:** export written (transposed) pitch with a full `<transpose>` for every transposing instrument, then switch *Transposing Score* off in Sibelius.
- Then check in a test import that piccolo, celesta, xylophone, glockenspiel, contrabassoon and double bass stay octave-transposed. Sibelius handles this through a separate "non-transposing score" octave setting in each instrument definition. [Sibelius Ref, p. 187]

**Sources:** ACA · NZSM pp. 3–4 · MacDonald 2026 · Sibelius Ref pp. 53, 187 · Dorico: Transposing instruments; Clefs with octave indicators; Concert vs. transposed pitch; Setting different clefs for concert/transposed pitch · MusicXML 4.0 (`concert-score`, `transpose`) · Wikipedia: Transposing instrument · Finale forum.

---

## 5. Front matter

### Convention

**Title page and cover.** Give the title exactly as it would appear in a concert programme, with correct capitalisation and diacritics. [MOLA 2017, p. 4] (MOLA also asks for the composer's name. For this competition it must be left out; see below.)

**Information pages** [MOLA 2017, p. 4; MOLA 2006, pp. 3–4] should give:

- the full instrumentation, including optional instruments;
- doublings;
- the key of every transposing instrument;
- a list of all percussion instruments, with the ranges required;
- how many percussionists are needed;
- special equipment, prepared or unusual instruments, and extended techniques;
- staging diagrams if relevant;
- the approximate duration of each movement and of the whole work;
- a contents list for multi-movement works.

An explanation of any non-standard notation follows the instrumentation page.

**Further detail from other sources:**

- List the percussion by player, giving each instrument that player uses. [MacDonald 2026]
- List every musician and every auxiliary instrument, and every percussion instrument. String numbers are not needed unless the string section is reduced. [Goss 2022]
- The percussion list also appears at the start of the percussion part. [IU]
- State how many keyboard players are needed. [MOLA 2017, p. 3]
- **Doubling format:** NZSM writes "Oboe II (dbl. cor anglais)". [NZSM, p. 14] Publishers' catalogue shorthand differs: Chester writes "3(pic)", Boosey & Hawkes "4(II,III,IV=picc)". [Wikipedia: Shorthand]

**Performance notes:**

- Explain non-standard notation. [MOLA 2017, p. 4]
- Also put short instructions in the score itself, because players skip prefaces. [NZSM, p. 3]
- **For quarter tones:** show each accidental glyph with its meaning, and state how long an accidental is valid. MusicXML's names for the glyphs are `quarter-sharp`, `three-quarters-sharp`, `quarter-flat` and `three-quarters-flat` (Tartini-style), plus arrow variants (`sharp-up`, `flat-down`, …). [MusicXML 4.0 `accidental-value`]

**Production:** make the front matter in a document or DTP program rather than the notation program, keep graphics as vector, and use running headers that identify the work. [MacDonald 2026]

**First page of the music:**

- It shows every instrument, including doublings. In a multi-movement work, each movement's first page shows the instruments used in that movement. [Goss 2022]
- Variant: NZSM exempts doubling instruments that only enter later, provided they are in the instrument list. [NZSM, p. 14]

### Competition requirements [Takemitsu rules]

- The title must appear on the score. The composer's name must not, because scores are screened anonymously.
- Submit 2 bound copies with the application form. Scores are not returned.
- Written instructions must be in English, French, German or Italian.
- Duration: 10–20 minutes.
- **Maximum forces:**
  - 3 flutes (may double piccolo or alto flute), 3 oboes (English horn), 3 clarinets (E♭ or bass clarinet), 3 bassoons (contrabassoon);
  - 4 horns, 3 trumpets, 3 trombones, 1 tuba, plus 1 extra wind instrument;
  - 2 harps; 2 keyboard players (piano(s), celesta, synthesizer); 4 percussion players including timpani;
  - strings: violins 30, violas 12, cellos 10, double basses 8.
- The entry page I fetched specifies no paper size.

**[assessment] Anonymity checks:**

- no name in headers or footers;
- no copyright line carrying a name;
- no "Composer" text frame;
- no dedication or commission line;
- no identifying programme note;
- no file name printed in a footer;
- no name in MusicXML `<identification><creator>`, `<rights>` or `<credit>`. Sibelius may turn these into page text **[unverified]**, so they have to be left empty in any case.

### Example instrumentation block [assessment, built from the MOLA contents in score order]

```
Duration: c. 15 minutes                                   Score in C
3 Flutes (2nd also Alto Flute, 3rd also Piccolo)
3 Oboes (3rd also English Horn)
3 Clarinets in B♭ (2nd also E♭ Clarinet, 3rd also Bass Clarinet in B♭)
3 Bassoons (3rd also Contrabassoon)
4 Horns in F · 3 Trumpets in C · 3 Trombones (3rd = bass trombone) · Tuba
Timpani
Percussion (3 players): 1: …  2: …  3: …   (pitched instruments with ranges)
2 Harps
Keyboards (2 players): 1: Celesta  2: Piano
Strings (competition maximum: 30 violins in total, 12 violas, 10 cellos, 8 basses;
         state the Violin I/II split, e.g. 16/14, and the divisi requirements)
Piccolo, celesta and xylophone sound 1 octave, glockenspiel and crotales 2 octaves higher,
contrabassoon and double bass 1 octave lower than written.
```

**Sources:** MOLA 2017 pp. 3–4 · MOLA 2006 pp. 3–4 · MacDonald 2026 · Goss 2022 · IU · NZSM pp. 3, 14 · Wikipedia: Shorthand · MusicXML 4.0 · Takemitsu rules.

---

## 6. Page size, staff size, margins, systems per page

### Convention

- **Paper.**
  - North America: 9×12 in up to 11×17 in. Europe: JIS B4 (257×364 mm) or A3 (297×420 mm). [MOLA 2017, p. 6]
  - Sibelius recommends Letter, Tabloid, A4 or A3 for orchestral scores. [Sibelius Ref, p. 639]
  - **Note:** the "B4" preset in Sibelius is ISO B4, 250×354 mm, not JIS B4 (257×364 mm). A custom page size is needed for JIS B4. [Sibelius Ref, p. 637; MOLA 2017, p. 6]
  - A large orchestra may need A3. [NZSM, p. 3] ACA gives 10×13 in or Tabloid for 20+ players. [ACA]
  - Portrait orientation. [IU]
- **Staff size** (the height from the top staff line to the bottom one):
  - at least 4 mm [MOLA 2017, p. 5; IU; MacDonald 2026];
  - 3–5 mm for orchestral scores [Sibelius Ref, p. 639];
  - 4.5–5.0 mm for orchestral or large-ensemble scores [NZSM, p. 5].
- **Margins.**
  - ACA: ½–¾ in. [ACA]
  - IU (thesis rules): at least 0.5 in, with at least 0.625 in on the binding side (1.25 in if hard-bound). [IU]
  - MOLA's 20 mm margin is stated for parts. [MOLA 2017, p. 5]
  - **[assessment]** For bound copies: at least about 15 mm on the outer edges and at least about 20 mm at the binding edge.
- **Printing and binding.** Print double-sided. Odd pages go on the right with the page number top right; even pages on the left with the number top left. Bind with saddle stitch, staples or coil. [MOLA 2017, pp. 5–6]
- **Systems per page.**
  - Orchestral scores usually have one system per page. [NZSM, p. 4]
  - Sibelius's spacing model treats a full orchestra as one system per page, with system objects repeated down the system. [Sibelius Ref, p. 643]
  - With hidden staves, two or more systems can share a page, separated by system dividers (see the section on system dividers and French scores).

### Space arithmetic [assessment]

- **Staff count.** With one staff per wind/brass player, timpani, 3 percussion staves, 2 harps × 2, 2 keyboards × 2, and 5 string staves, the score has about 40–44 staves before any divisi. With heavy divisi it can pass 55.
- **On A3**, about 390 mm of height is usable:
  - 40 staves leave about 9.7 mm per staff: a 4 mm staff plus about 5.7 mm of gap, which works.
  - 55 staves leave about 7 mm per staff: a 4 mm staff plus about 3 mm of gap, which is too tight for dynamics and text.
- **Remedies:** put wind pairs on shared staves, hide empty staves after the first page, or accept fewer bars per system. Do not go below 4 mm. [MOLA 2017, p. 5]

### Encoding

- `<scaling>`: the `millimeters` value for 40 tenths is the staff height (the spec's own example: 7 mm = 40 tenths). [MusicXML 4.0]
- Sibelius keeps the file's page and staff size while "Use page and staff size from MusicXML file" is on; it can use only one page size per score. [Sibelius Ref, pp. 51, 53]

### Variants

B4 or A3, and 4 mm or 5 mm staves, are house choices. **[assessment]** For this many staves: A3 portrait with staves of about 4–4.5 mm.

**Sources:** MOLA 2017 pp. 5–6 · Sibelius Ref pp. 51, 53, 637, 639, 643 · NZSM pp. 3–5 · IU · ACA · MacDonald 2026 · MusicXML 4.0.

---

## 7. Tempo marks, rehearsal marks, bar numbers

### Convention

- **Tempo marks** go above the top staff and above Violin I (or an equivalent staff) on every score page. [MOLA 2017, p. 2; MOLA 2006, p. 4]
  - IU: at least at the top and above the strings; possibly also above brass and percussion, depending on the size of the orchestra. [IU]
  - Dorico can show "system objects" above several families (e.g. woodwind, brass, percussion, strings) so that no staff is far from them. They appear only above bracketed or braced groups. [Dorico: System objects]
  - Sibelius allows up to 11 positions, including below the bottom staff; each text style chooses which positions it uses. [Sibelius Ref, p. 689]
  - Write tempo marks in bold with a metronome mark [NZSM, p. 7], using real metronome values [IU].
- **Rehearsal marks** use the same positions: the top of the system and above the strings, optionally also below the bottom staff. [Sibelius Ref, pp. 501, 689; Dorico: System objects]
  - Frequency varies by source:
    - at musical landmarks, in addition to bar numbers [MOLA 2017, p. 2];
    - about every 10–15 bars, preferably as boxed bar numbers [IU];
    - every 15–20 bars [NZSM, p. 14];
    - so that one is always visible within one page turn [MacDonald 2026].
  - Formats: A–Z then A1… or AA…; numbers; or bar numbers. [Sibelius Ref, p. 501] MusicXML draws `<rehearsal>` in a square box by default. [MusicXML 4.0]
- **Bar numbers** restart with each movement and keep the same position throughout the work. [MOLA 2017, p. 2] The position depends on how many are numbered:
  - If every bar is numbered, the numbers go below the system.
  - Otherwise the first bar of each system is numbered at the upper left, sometimes also above Violin I.

  [MOLA 2017, p. 2]

### Variants

- **MOLA's older edition** wanted every bar numbered (above, below, or above Violin I). [MOLA 2006, p. 4]
- **IU and NZSM** number every system. [IU; NZSM, final checklist] IU also warns against numbering every 5 or 10 bars, in parts. [IU]
- **Sibelius:**
  - Normally bar numbers go above the top staff and above other families, or below the bottom staff.
  - Typical published frequencies are 1, 5 and 10 bars; every system is the default.
  - Numbers on all staves are very rare.
  - Film scores centre a number under every bar.
  - An option hides bar numbers that fall on rehearsal marks.

  [Sibelius Ref, pp. 502–504]
- **[assessment]** Contemporary full scores use both "every system (top left + above strings)" and "every bar below the system". Pick one and keep it.

### Exporter implication

Sibelius reads metronome marks only from the top staff of the uppermost part and places them at default positions. [Sibelius Ref, p. 53] So:

- emit tempo and rehearsal directions once, in the top part;
- then set *System Object Positions* (top, Horn 1, Violin I; optionally Percussion 1) and the bar-number rules in Sibelius.

**Sources:** MOLA 2017 p. 2 · MOLA 2006 p. 4 · IU · NZSM pp. 7, 14, checklist · Dorico: System objects · Sibelius Ref pp. 53, 501–504, 689 · MacDonald 2026 · MusicXML 4.0.

---

## 8. System dividers and "French" scores (hiding empty staves)

### Convention

- **System dividers** are a pair of thick diagonal strokes placed midway between two systems, reaching halfway into the left margin. [Gould via Scoring Notes]
  - They are used when two or more orchestral or ensemble systems share a page.
  - They are not standard where every system shows all staves (chamber or choral music), but they help whenever space is tight.
  - Sibelius's "system separators" are drawn at the left, with a minimum staff count before they appear. Right-hand separators are rarely needed. [Sibelius Ref, p. 173]
- **Hiding empty staves** on individual systems is normal in large scores. [Sibelius Ref, p. 180] MusicXML's `staff-details print-object="no"` exists for exactly this purpose. [MusicXML 4.0] The rules:
  - **The first system (page) shows every staff.** [NZSM, p. 14 and checklist; Dorico: Hiding/showing empty staves (option "After first system"); NOTATIO forum]
    - Goss adds that the first page shows every instrument including doublings, and that in a multi-movement work each movement's first page shows that movement's instruments. [Goss 2022]
    - NZSM exempts doubling instruments that only enter later. [NZSM, p. 14]
  - **Every system carries staff labels** (abbreviated) once staves come and go. [Sibelius Ref, p. 449; IU]
  - **Never hide just one hand of a grand-staff instrument** (piano, harp, celesta). [Sibelius Ref, p. 180] In Dorico this needs a separate option. [Dorico: Hiding/showing empty staves]
  - **Divisi:** start a new system where the number of staves changes, to avoid half-used staves. [Sibelius Ref, p. 175] Dorico always shows systems that contain divisi changes. [Dorico: Hiding/showing empty staves]
- **"Cut-away" (scrapbook) scores** show staff lines only where an instrument plays (Penderecki, Stockhausen). This is a separate contemporary style. [Sibelius Ref, p. 181] In MusicXML it is `print-object="no"` combined with `print-spacing="yes"`. [MusicXML 4.0]

### Variants

- **Practitioners** rarely hide strings, most often hide percussion, and some show a staff one page before the instrument re-enters. [NOTATIO forum; weak source]
- **Dorico** can keep a full-staff score for the conductor alongside a hidden-staff reference score. [Dorico: Hiding/showing empty staves]
- **[assessment]** For a score read by one judge, hiding empty staves after page 1 is acceptable and common in contemporary scores, provided brackets, order and labels stay consistent. A full score with every staff on every page is the conservative choice.

**Sources:** Scoring Notes (Gould on system dividers) · Sibelius Ref pp. 173, 175, 180–181, 449 · Dorico: Hiding/showing empty staves · MusicXML 4.0 (`staff-details`) · NZSM p. 14, checklist · Goss 2022 · IU · NOTATIO forum.

---

## 9. Multirests and empty bars

### Convention

- **Multirests belong in parts.** They appear only very rarely in full scores; Sibelius cites Sibelius's *Tapiola*, bars 28–29. [Sibelius Ref, p. 663] MOLA and NZSM discuss multirests only for parts. [MOLA 2017, p. 3; NZSM, p. 14]
- **In the score**, every empty bar on a visible staff shows a whole-bar rest. An empty staff is removed for that system (a French score) rather than compressed into a multirest. **[assessment, consistent with Sibelius Ref, p. 180]**

### Variants

A multi-bar rest across the whole score is possible only when the entire orchestra is silent, as in *Tapiola*. [Sibelius Ref, p. 663]

### Encoding

Never emit `<multiple-rest>` in the score. Write `<rest measure="yes"/>` in each empty bar. [MusicXML 4.0]

**Sources:** Sibelius Ref pp. 180, 663 · MOLA 2017 p. 3 · NZSM p. 14 · MusicXML 4.0.

---

## 10. Instrument changes (doublings)

### Convention

- **The warning** "To [instrument]" goes right after the last note of the old instrument. [Sibelius Ref, p. 176; NZSM, p. 15 (for example "TO COR ANGLAIS")]
  - Sibelius places it at the start of the rests before the change, and the word "To" can be replaced. [Sibelius Ref, p. 176] (The Italian "muta in" is my example, not Sibelius's.)
  - Dorico prints change labels both after the last note before the change and at the first note after it, with the prefix in the language of the instrument names. [Dorico: Instrument changes]
- **At the entry:**
  - The new instrument's name goes above the staff where it starts playing.
  - From the next system on, the staff label shows the new instrument.
  - A clef change is added if needed.

  [Sibelius Ref, pp. 176–177] In the score the label changes; in the part the name appears over the first note. [NZSM, p. 15]
- **MOLA:** give a clear indication of when to change, followed by which instrument plays the next entry. [MOLA 2017, p. 3]
- **Allow at least 6 seconds** for instrument and mute changes. [NZSM, final checklist]
- **The first system** shows the instrument the player starts on, and the full doubling list goes on the instrumentation page. [Dorico: Staff labels]

### Variants

- **Language of the warning:** English "to Picc.", Italian "muta in …", German "nach …". Keep it consistent with the instrument-name language. [Dorico: Instrument changes (prefix follows the name language); Sibelius Ref, p. 176] The specific wording examples are **[assessment]**.
- **In a C score,** a change of transposition (e.g. B♭ clarinet → E♭ clarinet) does not change the notation, but the label must still change. **[assessment]**

### Encoding

- **Label change:** `<print>` with `<part-name-display>`/`<part-abbreviation-display>`, which takes effect when the current or a following bar begins a new system. [MusicXML 4.0 `print`]
- **Warning and entry names:** `<direction><words>` for "to Picc." and "Piccolo".
- **`<instrument-change>`** changes only the playback (virtual) instrument. [MusicXML 4.0]
- **Test needed:** whether Sibelius imports these label changes. Fallback: *Home › Instruments › Change* in Sibelius with "Announce at last note of previous instrument" switched on. [Sibelius Ref, pp. 176–177]

**Sources:** Sibelius Ref pp. 176–177 · Dorico: Instrument changes; Staff labels · NZSM p. 15, checklist · MOLA 2017 p. 3 · MusicXML 4.0.

---

## 11. Other things a professional engraver would flag

- **Sibelius edition.** Sibelius Artist allows at most 16 staves per system and has no quarter-tone accidentals; both need **Sibelius Ultimate**. [Sibelius Ref, pp. 6–7]
- **Sibelius MusicXML import limits that matter here** [Sibelius Ref, pp. 53–54]:
  - Metronome marks are read only from the top staff of the uppermost part and placed at default positions.
  - Heavy barlines are not imported.
  - The `technical` and `ornaments` elements are not imported. The same table does say that mordents, trills and turns are imported. `technical` includes `up-bow`, `down-bow`, `harmonic`, `open-string`, `stopped`, `snap-pizzicato`, `fingering`, `double-tongue`/`triple-tongue` and more [MusicXML 4.0], so these marks need a post-import plan.
  - Symbols are not imported, and neither are staff-type changes.
  - Compound time signatures such as 2/4+6/8 and senza-misura are not imported.
  - When different staves have different time signatures at the same moment, the uppermost one is used.
  - Tuplet `bracket`/`show-number` attributes are not imported.
- **Clutter.** Tempo or rehearsal marks repeated on every staff clutter an orchestral score; that is why they are system objects. [Dorico: System objects]
- **Missing extra space between families.** [Sibelius Ref, p. 642]
- **Shared-staff indications.** Use "1.", "2." and "a2" in the score only; for strings use "div.", "unis.", "1 desk" and "Solo". [NZSM, p. 14]
- **Big time signatures** between staves are common in large modern scores with frequent metre changes. [Sibelius Ref, p. 339] MusicXML has `<group-time>` for time signatures spanning a group. [MusicXML 4.0] Import is untested.
- **Key signatures.** Horns, tuned percussion and timpani traditionally have no key signature [MOLA 2017, p. 3]. Use an open key throughout for atonal music. [NZSM, p. 4]
- **Percussion consistency.** Staff positions for percussion must not move during the work. [MOLA 2017, p. 2] The timpani part is kept separate from the percussion. [MOLA 2017, p. 3]
- **Proofreading.** Proofread both vertically and horizontally. [MOLA 2017, p. 6]
- **Page numbering and headers.** Odd pages on the right. [MOLA 2017, p. 5] Running headers carry the title only, never the composer's name here. [MacDonald 2026; Takemitsu rules]
- **Mute and doubling reminders** at the left of each page (IU); these are optional.
- **Harp pedalling.** MOLA says to leave pedalling to the player (parts). [MOLA 2017, p. 3] **[assessment]** Contemporary scores often print pedal settings where a specific tuning matters.

---

## Sources

- **MOLA 2017.** Major Orchestra Librarians' Association, *Guidelines for Music Preparation* (edited 2017, version 4). https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf. Pages cited: p. 2 (full score: names, tempo marks, bar numbers, percussion, score order); p. 3 (parts, doublings, key signatures); p. 4 (cover and front matter); p. 5 (formatting: 4 mm, barlines by family); p. 6 (paper and binding); p. 7 (Examples 1–2); p. 9 (Example 6).
- **MOLA 2006.** MOLA Publication Committee, *Music Preparation Guidelines for Orchestral Music* (1993 edition, revised 2001 and 2006), hosted by the NJ Symphony: https://www.njsymphony.org/assets/doc/Music-Preparation-Guidelines-for-Orchestral-Music-1-b9203af5a3.pdf (pp. 3–4).
- **Sibelius Ref.** Avid, *Sibelius Reference Guide* 2024.3: https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf. Pages cited:
  - pp. 6–7: edition comparison.
  - pp. 51–54: §1.9 Opening MusicXML files.
  - pp. 173, 175–177: §2.4 Instruments (standard orders, system separators, divisi, instrument changes).
  - pp. 180–181: §2.5 Staves (hiding empty staves; cut-away scores).
  - p. 187: §2.6 Edit Instruments (non-transposing octave; braced instruments).
  - p. 339: big time signatures.
  - pp. 402–403: §4.19 Brackets and braces.
  - pp. 449–450: §5.4 Instrument names.
  - p. 501: §5.12 Rehearsal marks.
  - pp. 502–504: §5.13 Bar numbers.
  - pp. 637, 639: §7.1 Document setup.
  - pp. 642–643: staff spacing.
  - p. 663: §7.8 Multirests.
  - p. 689: System object positions.
  - Glossary: "brace", "bracket".
- **Dorico (Steinberg) manual, archived versions:**
  - Brackets according to ensemble type: https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_ensemble_type_r.html
  - Secondary brackets: https://archive.steinberg.help/dorico/v3.5/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_secondary_brackets_c.html
  - Transposing instruments: https://archive.steinberg.help/dorico_pro/v4/en/dorico/topics/setup_mode/setup_mode_instruments_transposing_c.html
  - Concert vs. transposed pitch: https://archive.steinberg.help/dorico_pro/v4/en/dorico/topics/setup_mode/setup_mode_layouts_concert_vs_transposed_pitch_c.html
  - Clefs with octave indicators: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_clefs/notation_reference_clefs_transposing_c.html
  - Setting different clefs for concert/transposed pitch: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_clefs/notation_reference_clefs_pitch_concert_transposed_specifying_t.html
  - Instrument transpositions in staff labels: https://archive.steinberg.help/dorico_pro/v4/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_instrument_transpositions_c.html
  - Staff labels: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_c.html
  - Staff labels on condensed staves: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_condensed_staves_c.html
  - Changing the staff label numbering style: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_numbering_style_changing_t.html
  - System objects: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_staves/notation_reference_staves_system_objects_c.html
  - Hiding/showing empty staves: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/page_formatting/page_formatting_staves_hiding_showing_empty_t.html
  - Instrument changes: https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/setup_mode/setup_mode_instrument_changes_c.html
- **NZSM.** New Zealand School of Music, *NZSM Guide to Notation 2019*: https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf. Pages cited: p. 3 submission and preface; p. 4 transposition, staff names, layout, staff order; p. 5 staff size; p. 7 tempo; p. 14 orchestral scores; p. 15 parts and doublings; final checklist page.
- **IU.** Indiana University Jacobs School of Music, Composition Department, *Music Notation Style Guide* (cites Gould, Read, Stone): https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/
- **ACA.** American Composers Alliance, *Score Preparation Guidelines*: https://composers.com/pages/score-preparation-guidelines
- **MacDonald 2026.** David MacDonald, "Score preparation and production notes", Scoring Notes (June 2026): https://www.scoringnotes.com/tips/score-preparation-production-notes/
- **Goss 2022.** Thomas Goss, "Orchestra librarians want you to know about instrument names", Scoring Notes (20 June 2022): https://www.scoringnotes.com/tips/orchestra-librarians-want-you-to-know-about-instrument-names/
- **Gould via Scoring Notes.** "Score system divider plug-in in Finale", Scoring Notes; quotes Gould, *Behind Bars*, on system dividers, without page numbers: https://www.scoringnotes.com/tips/score-system-divider-plug-in-in-finale/
- **Takemitsu rules.** Tokyo Opera City, Toru Takemitsu Composition Award, "How to entry": https://www.operacity.jp/en/concert/award/entry/
- **MusicXML 4.0.** W3C Music Notation CG, MusicXML 4.0 schema: https://www.w3.org/2021/06/musicxml40/listings/musicxml.xsd/. Items used: `part-group`, `group-symbol-value`, `group-barline-value`, `part-symbol`, `staff-details`, `print`, `measure-numbering-value`, `concert-score`, `transpose`, `scaling`, `rehearsal`, `accidental-value`, `multiple-rest`, `instrument-change`, `group-time`. Element page: https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-group/
- **Wikipedia: Shorthand.** "Shorthand for orchestra instrumentation" (cites Daniels, *Orchestral Music*): https://en.wikipedia.org/wiki/Shorthand_for_orchestra_instrumentation
- **Wikipedia: Woodwind section.** Cites the *Harvard Dictionary of Music*, 2nd ed., pp. 604–5: https://en.wikipedia.org/wiki/Woodwind_section
- **Wikipedia: Transposing instrument.** https://en.wikipedia.org/wiki/Transposing_instrument
- **Wikipedia: List of transposing instruments.** Tagged "more citations needed" but used here only for standard octave intervals: https://en.wikipedia.org/wiki/List_of_transposing_instruments
- **NOTATIO forum.** "The hide staves or not to hide them?" (practitioners; weak source): https://notat.io/viewtopic.php?t=1181
- **Finale forum.** "Partitur in C notiert" (practitioners; weak source): https://finaleforum.superflexible.net/v3/viewtopic.php?t=4756
- **Not accessed:** Gould, *Behind Bars* (Faber, 2011), except through the secondary quotations above; Heussenstamm, *Norton Manual of Music Notation*; Stone, *Music Notation in the Twentieth Century*; publisher house-style guides (B&H, Schott, Bärenreiter, Faber, UE, Peters).

---

## Checklist for the exporter

### Reference layout for this piece [assessment, assembled from the conventions above]

| # | First system (full) | Later systems | Level 1 (bracket, barline) | Level 2 (sub-bracket) | Brace |
|---|---|---|---|---|---|
| 1–3 | Flute 1 · Flute 2 · Flute 3 | Fl. 1 · Fl. 2 · Fl. 3 (label changes to Picc./A. Fl. when doubling) | Woodwind | Flutes | – |
| 4–6 | Oboe 1 · Oboe 2 · Oboe 3 | Ob. 1–3 (→ E. H.) | Woodwind | Oboes | – |
| 7–9 | Clarinet in B♭ 1 · 2 · 3 | Cl. 1–3 (→ E♭ Cl. / Bass Cl.) | Woodwind | Clarinets | – |
| (10) | extra wind by family and pitch (e.g. saxophone here) | | Woodwind | – | – |
| 11–13 | Bassoon 1 · 2 · 3 | Bsn. 1–3 (→ Cbsn.) | Woodwind | Bassoons | – |
| 14–17 | Horn in F 1–4 | Hn. 1–4 | Brass | Horns | – |
| 18–20 | Trumpet in C (or B♭) 1–3 | Tpt. 1–3 | Brass | Trumpets | – |
| 21–23 | Trombone 1–3 | Tbn. 1–3 | Brass | Trombones | – |
| 24 | Tuba | Tba. | Brass | – | – |
| 25 | Timpani | Timp. | own (or Percussion) | – | – |
| 26–28 | Percussion 1–3 | Perc. 1–3 | Percussion | – | – |
| 29–30 | Harp 1 · Harp 2 | Hp. 1 · Hp. 2 | none | – | each |
| 31–32 | Celesta · Piano (or Keyboard 1/2) | Cel. · Pno. | none | – | each |
| 33+ | Violin I · Violin II · Viola · Violoncello · Double Bass (+ divisi staves) | Vln. I · Vln. II · Vla. · Vlc. · D. B. | Strings | Vln. I+II; level 3 for divisi | – |

If the auxiliary instruments get their own staves instead: Picc. above the flutes, A. Fl. below them; E. H. below the oboes; E♭ Cl. above the clarinets, Bass Cl. below them; Cbsn. below the bassoons.

### In the MusicXML

**Order and grouping**

1. Emit the parts exactly in the order above: one staff per player, with the doublings shown by label changes. If an auxiliary instrument gets its own staff instead, place it as described under the table.
2. **Brackets:** one `part-group number="1"` per family, with `group-symbol=bracket` and `group-barline=yes`. No group spans two families, so barlines break between families.
3. **Sub-brackets:** a `part-group number="2"` with `group-symbol=square` and `group-barline=yes` around each set of same-instrument staves (Fl, Ob, Cl, Bsn, Hn, Tpt, Tbn, Vln I+II).
   - A `number="3"` group around the divisi staves of one string section.
   - **Test** how Sibelius maps `square`.
4. **Braced instruments:** harps, celesta and piano are single parts with `<staves>2</staves>` and `<part-symbol>brace</part-symbol>`, outside any bracket group.

**Names**

5. `part-name` holds the full name and `part-abbreviation` the short one. Keep Sibelius's "Use instrument names from MusicXML file" on.
6. Use one language for all names (English here), one numbering style (Arabic for winds, Roman for Violin I/II), and one separator style. Write "B♭" with `part-name-display` and `<accidental-text>flat</accidental-text>`.
7. **Divisi:** label the divisi staves (for example "Vln. I 1–8 / 9–16", or desks). Write "div."/"unis." as text at splits and joins. Put a system break wherever the number of staves changes.
8. **Doublings:**
   - "to Picc." (one prefix language) after the last note of the old instrument;
   - "Piccolo" above the entry;
   - `<print><part-name-display>`/`<part-abbreviation-display>` updated at the next system.
   - **Test** the import. Fallback: Sibelius *Instruments › Change*.

**Pitch**

9. **C score.** Every instrument sounds as written except the octave transposers: piccolo +8, celesta +8, xylophone +8, glockenspiel +15, crotales +15, contrabassoon −8, double bass −8. State them in the notes.
   - Preferred encoding for Sibelius (MusicXML 3.0 importer): written pitch with a full `<transpose>` for every transposing instrument, then switch *Transposing Score* off.
   - Alternative: MusicXML 4.0 `<concert-score/>`.
   - **Test** that the sounding pitches and the octave transposers come out right.
10. **Concert-pitch clefs:** bass clarinet and contrabassoon in bass clef (tenor clef where useful), horns in treble and bass, alto flute in treble.
11. **Accidentals:** no key signatures. Quarter tones as `quarter-sharp`, `three-quarters-sharp`, `quarter-flat`, `three-quarters-flat`; **test** the import. This needs Sibelius Ultimate.

**Page and systems**

12. **Page:** A3 portrait 297×420 mm, or JIS B4 257×364 mm (not Sibelius's ISO "B4").
    - Margins at least 15 mm, binding side at least 20 mm **[assessment]**.
    - Staff height at least 4 mm (`<scaling><millimeters>4–4.5</millimeters><tenths>40</tenths>`).
    - Keep "Use page and staff size from MusicXML file" on in Sibelius.
13. **First system:** every staff (including tacet instruments), full names, indented.
14. **Later systems:** either every staff (safest) or hidden empty staves.
    - Hide per whole system (`staff-details print-object="no"`, or Sibelius *Hide Empty Staves* from the second system onwards).
    - Never hide one hand of a grand staff.
    - Abbreviated labels on every system.
15. **Tutti pages:** one system per page. Where hidden staves allow two systems, switch on left system separators.
16. **Breaks:** explicit `<print new-system/new-page>` at identical places in every part.
17. **Rests:** no `<multiple-rest>`. Every empty bar gets `<rest measure="yes"/>`.

**System objects**

18. Emit tempo (bold words plus `<metronome>`) and rehearsal marks once, in the top part.
19. Rehearsal marks at structural points, roughly every 10–20 bars, boxed.
20. Bar numbers: either every system (top left, plus above Violin I) or every bar below the bottom staff. One scheme for the whole work.

### After import, in Sibelius Ultimate (house style)

21. Set *System Object Positions* to top staff, Horn 1, Violin I (optionally Percussion 1 and, for rehearsal marks, below the bottom staff).
22. Set the bar-number frequency and position, and hide bar numbers at rehearsal marks.
23. Check the brackets and sub-brackets and the barline breaks between families, and add a little extra space between groups.
24. Switch concert pitch on (*Transposing Score* off) and check that the octave transposers keep their octave.
25. Optionally use large time signatures if the metre changes often.

### Front matter (made outside Sibelius)

26. **Title page:** title only (no name, dedication, commission or copyright holder), plus "Duration: c. … minutes".
27. **"Score in C":** at the top left of page 1 of the music, and in the notes together with the list of octave transposers.
28. **Instrumentation page**, in score order:
    - doublings per player;
    - keys of the transposing instruments;
    - number of keyboard players;
    - percussion by player, each instrument named, with ranges for pitched percussion;
    - string numbers and divisi requirements.
29. **Performance notes:** a legend of the quarter-tone accidentals and the rule for how long an accidental lasts; special techniques; staff legends for the percussion.
30. **Language:** only English, French, German or Italian for written instructions. Remove every trace of the composer from the MusicXML `creator`, `rights` and `credit`, from Sibelius *File › Info* and text frames, and from headers and footers.
