# Shared staves and string divisi in orchestral full scores

Research for the MusicXML → Sibelius exporter. Sources consulted 2026-09-29.

---

## 0. How to read this

**Tags.** A claim with a link and no tag is a paraphrase of a source I read in this session.
**[unverified]** marks general engraving knowledge I could not confirm in a source this session.
**[derived]** marks my own inference for the exporter; it is not a published rule.

**Source weight.** Engraving-program manuals that encode editorial conventions (Dorico, Sibelius) and the orchestra librarians' association (MOLA) carry the most weight. Conservatory style guides (NZSM Wellington, Indiana University) come next. Composer-competition and festival guides and orchestration websites come last.

**What I could not read.**
- *Behind Bars* (Gould, Faber 2011): I could read only its official table of contents ([Behind Bars TOC](https://www.behindbarsnotation.co.uk/contents/toc.pdf)) and a few page-cited paraphrases in a secondary source.
- Also not found: Stone, *Music Notation in the Twentieth Century*; the *Norton Manual of Music Notation*; Gardner Read. Indiana's guide and MOLA list these as standard references ([IU style guide](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/); [MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf), "Resources").
- Publishers' internal house styles (Boosey, Schott, UE, Faber) are not public.
- I did not check Lachenmann or Saariaho scores.

**Versions of the manuals.**
- Dorico pages come from the archived Dorico 2, 3 and 3.5 manuals. Later versions may add options.
- The Sibelius Reference Guide 2024.3 ([PDF](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf); 812 pages) was too large for my fetch tool. I read a text extraction of that PDF that another agent had already placed in this scratchpad folder. The page numbers below are the guide's printed page numbers.

---

## 1. Winds and brass: which instruments share a staff

### Convention
- **Why share at all.** Fewer staves let the staff size be larger, and that is easier for the conductor to read. The usual examples are "Flutes 1-2" and "Horns 1-4" ([Dorico: condensing](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_c.html)). Parts are always separate per player, whatever the score does ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 5; [NZSM guide](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14).
- **Which instruments pair (Dorico's defaults).** Dorico groups adjacent single players of the same instrument type *and the same transposition*. The one common exception is trombone plus tuba, which often share a staff in orchestral scores. A group may hold up to 16 players ([Dorico: condensing groups](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_groups_c.html)).
- **Never shared (Dorico).** String section players are never condensed; they use divisi instead. Unpitched percussion is never condensed. Players with different time signatures or key signatures cannot share ([Dorico: condensing considerations](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_calculations_considerations_c.html)).
- **How strongly the guides push sharing.** They differ a lot:
  - *Share by default.* NZSM: every woodwind and brass pair shares a staff in the score unless the two parts are consistently rhythmically independent ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14). NYCC: pair like winds and brass (Fl 1&2, Ob 1&2, …), never more than two instruments per staff, and Vn I / Vn II always on separate staves ([NYCC](https://youngcomposerschallenge.org/preparing_scores.php)).
  - *Share only when trivial.* Indiana: winds and brass may share only if the music is very easy to read; anything at all complex gets one staff per instrument ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)).
  - *Separate by default.* Hugill: separate staves per instrument are generally best where possible ([Hugill, score layouts](https://andrewhugill.com/OrchestraManual/layouts.html)).

### Horns
- **Two layouts exist.**
  - *1.2 / 3.4* is the traditional concert layout. Historically there were two pairs of natural horns crooked in different keys, and each pair was a high player plus a low player seated together ([Goss, "Horn Wars"](https://orchestrationonline.com/horn-wars-scoring-12-34-vs-13-24/)). NYCC prescribes 1&2 / 3&4 ([NYCC](https://youngcomposerschallenge.org/preparing_scores.php)).
  - *1.3 / 2.4* puts the high horns (1 and 3) on one staff and the low horns (2 and 4) on the other. It grew up in band, contemporary and film scores, mainly for visual convenience ([Goss](https://orchestrationonline.com/horn-wars-scoring-12-34-vs-13-24/); [Dorico: condensing groups](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_groups_c.html), where it is called "interlocking").
- **Why.** Horns 1 and 3 are the high specialists and 2 and 4 the low ones; in a four-part chord the order from the top is 1, 3, 2, 4 ([Hugill, brass layouts](https://andrewhugill.com/OrchestraManual/layouts_brass.html)).
- **Most common.** 1.2 / 3.4 in concert scores (Goss). I have no count for recent contemporary scores. 1.3 / 2.4 is a legitimate, documented alternative.

### Trumpets, trombones, tuba
- **Trumpets.** Sibelius's own worked example moves three trumpets between three arrangements: one "Trumpets 1.2.3" staff; "Trumpets 1.2" plus "Trumpet 3"; or three single staves ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.4 p. 175). So 1.2 + 3 and 1.2.3 are both normal.
- **Trombones and tuba.** Trombone plus tuba sharing is a documented convention ([Dorico: condensing groups](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_groups_c.html)). NZSM's score order lists "bass trombone" separately after "trombones" ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 4). The usual pattern is Tbn 1.2 together and Tbn 3 (bass) either alone or with the tuba [unverified as to which is more common].

### A third player on the staff (1.2.3)
- **Supported by the tools.** Dorico's labels cover three or more players on one staff, e.g. "a 3", or "1.2 a 2" for a subset ([Dorico: player labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_player_labels_c.html)). Sibelius's Explode command reads 1., 2., 3., 4. and a1.–a4. ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §3.16 p. 292).
- **Against.** NYCC forbids more than two players per staff.
- **[derived]** With the independent lines and mixed tuplets in this piece, a three-player staff will almost never pass the sharing test in §9. Allow it only for unison or strict homorhythm.

### Doublings (piccolo, alto flute, cor anglais, E♭ clarinet, bass clarinet, contrabassoon)
- **Instrument changes.**
  - *How they are shown.* Text goes both after the last note before the change and at the first note after it ([Dorico: instrument changes](https://archive.steinberg.help/dorico/v3/en/dorico/topics/setup_mode/setup_mode_instrument_changes_c.html)).
  - *NZSM's form.* "TO COR ANGLAIS" after the last notes. In the score the staff name changes to the new instrument; in the part the new name goes over its first note ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 15).
  - *Indiana.* Staff names must show the doubling, e.g. "Fl/Picc.", "Piano/Celesta" ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)).
  - *Sibelius.* Use Home > Instruments > Change wherever the player switches ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.4 p. 175). By default the name above the staff at the change is the full instrument name, and the warning before it is the short name (§2.6 p. 186).
- **Per-layout choice.** Dorico lets each layout decide separately whether a doubling player's instruments share one staff (with instrument changes) or get separate staves ([Dorico: instrument changes](https://archive.steinberg.help/dorico/v3/en/dorico/topics/setup_mode/setup_mode_instrument_changes_c.html)).
- **Order.** Piccolo above the flutes, cor anglais after the oboe, contrabassoon after the bassoons ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 4). Sub-brackets sometimes group Flute and Piccolo ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §4.19 p. 402).
- **Front matter and first page.** List doublings on the instrumentation page as "Oboe II (dbl. cor anglais)". An instrument picked up later does not need a staff on the first page ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14).
- **Principal players.** Avoid doublings in principal parts where possible ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 3).
- **Two ways a score shows doublings:**
  - one staff per *player*, where the staff name changes on the next system;
  - one staff per *instrument*, shown only while it plays.

  Both are documented. Which is more common in current published scores is [unverified].
- **Rule from Dorico's grouping.** A doubling instrument never shares a staff with a different instrument type or transposition ([Dorico: condensing groups](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_groups_c.html)).

---

## 2. How a shared staff is written

### The four textures
Dorico's condensing chooses among four ways to write a pair ([Scoring Notes: Dorico 3 condensing](https://www.scoringnotes.com/reviews/dorico-3-feature-condensing/)):
1. **Unison.** One line, marked "a 2".
2. **Shared stems.** Chords, used when the two parts are rhythmically identical.
3. **Two voices on one staff.** Used when the rhythms differ.
4. **Separate staves.** No condensing.

The other sources agree on the core of this:
- NZSM: identical rhythm → both noteheads on one stem; independent rhythm → stems in opposite directions ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14).
- LilyPond's automatic part combiner: identical pitches become an "a due" note. Same rhythm less than a ninth apart becomes a chord. More than a ninth apart, or crossing parts, become separate voices. It handles two parts only ([LilyPond manual](https://lilypond.org/doc/v2.24/Documentation/notation/multiple-voices), "Automatic part combining").
- Sibelius's worked two-flute example mixes all three in-staff textures: chords, unison (a 2) and two voices ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §9.4 p. 712).
- **Stem direction.** In two voices, player 1 is the up-stem voice and player 2 the down-stem voice, with stems in opposite directions (NZSM p. 14). Dorico places the up-stem voice's label above the staff and the down-stem voice's below ([Dorico: player labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_player_labels_c.html)).

### Labels: exact text
| Situation | Most common text | Variants and sources |
|---|---|---|
| Player 1 alone | `1.` | "1. or Solo" ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14); "1." with period ([NYCC](https://youngcomposerschallenge.org/preparing_scores.php)); primo = "1." or "I°" ([Wikipedia: A due](https://en.wikipedia.org/wiki/A_due)); LilyPond default "Solo" |
| Player 2 alone | `2.` | LilyPond default "Solo II" ([LilyPond](https://lilypond.org/doc/v2.24/Documentation/notation/multiple-voices)) |
| Both, unison | `a 2` or `a2` | "a2" (NZSM, NYCC, Wikipedia, LilyPond). "a 2" is the output of Sibelius Reduce ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §3.16 p. 293) and of Dorico ([Scoring Notes](https://www.scoringnotes.com/reviews/dorico-3-feature-condensing/)). French "à 2" (Wikipedia). |
| All 3 (or 4) players, unison | `a 3` / `a 4` | [Dorico: player labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_player_labels_c.html); [Wikipedia: A due](https://en.wikipedia.org/wiki/A_due) |
| A subset of a 3–4 player staff in unison | `1.2 a 2` (Dorico) | Sibelius's example uses plain "1.2" as a label ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.4 p. 175) |
| Two independent voices | `1.` above the staff, `2.` below | Players are labelled 1 and 2 when on independent voices ([Scoring Notes](https://www.scoringnotes.com/reviews/dorico-3-feature-condensing/)); placement per [Dorico: player labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_player_labels_c.html) |

**When labels appear.**
- **Dorico's rule.** A label appears at the start of every phrase whose condensing differs from the previous phrase, and again at the start of every new system ([Dorico: player labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_player_labels_c.html)). An "a 2" is repeated after a system break ([Scoring Notes](https://www.scoringnotes.com/reviews/dorico-3-feature-condensing/)). Dorico does not repeat an identical label on the same system when no other label comes between ([Steinberg forum, D. Spreadbury](https://forums.steinberg.net/t/condensing-hide-rests-for-inactive-players-sometimes-omits-player-name/151402)).
- **NZSM's rule.** "a2" is needed only above a single line that both players play in unison; elsewhere it would confuse the conductor. These labels go in the score only, never in parts ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14).
- **Label text is configurable.** Dorico lets you change the "to" word and whether numbers take a period ([Dorico: player-label engraving options](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_player_labels_project_wide_engraving_options_c.html)). Sibelius sets such labels in Technique text ("a2", "solo") ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §5.2 p. 441). Staves for pairs must always be clearly labelled, including a2 and solo ([Presser/Dorff tip sheet](https://danieldorff.com/images/haddonfield-tipsheet.pdf) item 3).
- **"1." versus "Solo".**
  - "1." is the majority form: NZSM, NYCC, Dorico, and Sibelius Reduce ("1." and "a 2").
  - "Solo" for one wind player is a minority variant: NZSM allows it as a synonym, and LilyPond uses it by default.
  - For strings, "Solo" means the section principal (§4).
  - Reserve "Solo" for exposed solos [unverified that this is universal].

### Staff names on shared staves
- **Examples in the sources:**
  - "Flutes I, II" on the first page and "Fl. I, II" afterwards ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14);
  - "Flutes 1-2", "Horns 1-4", with the numbers stackable vertically or horizontally ([Dorico: number stacking](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_condensed_staves_number_stacking_changing_t.html));
  - "Trumpets 1.2.3", "Trumpet 1.2" ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.4 p. 175).
- **Label must match the staff.** A condensed staff's label shows every player on it and may change from system to system ([Dorico: condensed staff labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_condensed_staves_c.html)).
- **Full then short.** Full names on the first page, abbreviations afterwards ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 2; [Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §5.4 p. 449).
- **Transposition in the name.** Say whether clarinets are in A or B♭ and trumpets in B♭ or C ([Presser/Dorff](https://danieldorff.com/images/haddonfield-tipsheet.pdf) item 4).

### Rests of the silent player
- **Dorico's options** ([Dorico: condensing notation options](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_notation_options_r.html)):
  - *Player silent for part of a system:* either hide the silent player's rests and label the active player ("1."), or show the rests and omit the labels.
  - *When hiding:* hide only at the start or end of bars, or anywhere. There is also a minimum length of rest before hiding is allowed.
  - *Player silent for a whole system:* pair them with the active player, name them in the staff label, or do not condense.
- **Sibelius.** Hidden rests are a normal tool: its part-extraction workflow deletes unwanted notes, then hides the resulting rests ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §9.4 p. 712).
- **LilyPond.** It can merge the two parts' rests when both rest at the same moment ([LilyPond](https://lilypond.org/doc/v2.24/Documentation/notation/multiple-voices)).
- **Inside two-voice passages [unverified].** Each voice keeps its own rests, displaced up for voice 1 and down for voice 2. When both voices are silent, one rest is shown.

### Dynamics, hairpins, articulations, slurs, ties, techniques
- **Shared stems.** One set of dynamics serves both players. When the dynamics differ, both are shown, in player order ([Scoring Notes](https://www.scoringnotes.com/reviews/dorico-3-feature-condensing/)).
- **What Dorico checks before sharing.** Articulations, dynamics, slurs, grace notes, playing techniques and ornaments, plus forced stem directions and flipped slurs ([Dorico: considerations](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_calculations_considerations_c.html)). It has options for merging slurs and techniques across players ([Dorico: notation options](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_notation_options_r.html)).
- **Two-voice writing [unverified].** Voice 1's dynamics, hairpins, articulations, slurs and ties go above the staff and voice 2's below. *Behind Bars* has sections titled "Double-stemmed writing" and "Tie direction in double-stemmed writing" ([TOC](https://www.behindbarsnotation.co.uk/contents/toc.pdf)); I could not read their content.

### Accidentals and quarter tones on a shared staff
*Behind Bars* has a section "Accidentals in double-stemmed writing" ([TOC](https://www.behindbarsnotation.co.uk/contents/toc.pdf)); I could not read it.
**[derived]** On a shared staff, print every accidental, including quarter-tone accidentals, on every note it applies to. Do not rely on an accidental carrying through the bar across voices. Split the staff when simultaneous notes a second apart both need accidentals, because they collide.

### When not to share: the thresholds the sources give
- **Only if very easy to read** (Indiana). Any complexity → separate staves ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)).
- **Unless consistently rhythmically independent** (NZSM, p. 14). This is more permissive.
- **Dorico's hard stops and defaults.**
  - Different time signature or key signature: never shared ([considerations](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_calculations_considerations_c.html)).
  - Pitch crossing: can be limited; the limit defaults to 1 crossing per region.
  - Unisons: can be allowed or prevented, both for whole phrases and within phrases ([notation options](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_notation_options_r.html)).
- **LilyPond.** Chords only below a ninth; parts wider apart or crossing become voices; never more than two parts ([LilyPond](https://lilypond.org/doc/v2.24/Documentation/notation/multiple-voices)).
- **Tuplets.** Every tuplet must show its number, with a square bracket when needed ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)). Two voices with different tuplets therefore stack two bracket-and-number sets on one staff.
- **[derived] for this piece.** If, in any beat where both players sound, their tuplet grids differ (straight 16ths against 3:2 against 5:4) → separate staves. This is the practical reading of Indiana's "at all complex" rule.

---

## 3. Deciding per piece, per system or per passage, and how a change is shown

- **Dorico: per system.** Dorico evaluates each phrase but condenses one system at a time, so a pair can be shared on one system and split on the next, even within one phrase ([Dorico: considerations](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_calculations_considerations_c.html)). Staff labels then change from system to system ([Dorico: condensed staff labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_condensed_staves_c.html)).
- **Sibelius's method when players move between staves** ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.4 p. 175):
  - create a separate instrument for every staff name you need, e.g. Trumpets 1.2.3, Trumpets 1.2, Trumpet 1, Trumpet 2, Trumpet 3;
  - write each passage on the right staff and hide the spare staves;
  - mark the change with "1.2", "a 2", "div." or "unis.";
  - put a **system break wherever the number of staves changes**, otherwise half-used staves appear.

  This maps one-to-one onto MusicXML (§8).
- **Consistency versus economy.**
  - *For a steady layout.* Frequent changes of staff set-up distract the conductor. Keep a consistent layout, even with some rests, except in passages with unusually heavy string divisi or long stretches where many instruments rest ([Presser/Dorff](https://danieldorff.com/images/haddonfield-tipsheet.pdf) item 5).
  - *For hiding.* "French scoring" (empty staves removed on every page but the first) is acceptable and preferred ([Paterson, Mostly Modern](https://mostlymodernfestival.org/institute/music-preparation-guidelines-composers/)). Staves with no content for long stretches should go ([Hugill](https://andrewhugill.com/OrchestraManual/layouts.html)).
- **How the change is shown.**
  1. The staff names at the left of the new system change: full names on the first system, short names afterwards ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §5.4 p. 449).
  2. Player labels ("1.", "2.", "a 2") appear at the first phrase.
  3. For strings, "div." and "unis." are added.
- **Mid-system splits.**
  - *Dorico's divisi.* A divisi that starts or ends mid-system draws the extra staves across the whole system. The tutti music before or after is copied onto every divided staff ("unison ranges"), and a change label is placed above each staff at the change point ([Dorico: divisi](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_c.html); [unison ranges](https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/notation_reference/notation_reference_divisi_unison_ranges_c.html); [change labels](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_change_labels_c.html)).
  - *Cut-away ("scrapbook") scores.* A contemporary alternative where staff lines appear only where an instrument plays. Sibelius names Penderecki and Stockhausen and makes it with an instrument change to "No instrument (hidden)" ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.5 p. 181). MuseScore offers per-bar cut-away staves ([MuseScore handbook](https://handbook.musescore.org/notation/instruments-staves-and-systems/showing-staves-only-where-needed)). A staff that enters mid-system needs its brace or bracket restated there ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §4.19 p. 402; [Scoring Notes: cut-away scores](https://www.scoringnotes.com/tutorials/creating-cut-away-or-scrapbook-scores-in-sibelius/)).

---

## 4. String divisi

### Markings
| Marking | Meaning | Source |
|---|---|---|
| `div.` | the section divides (into 2) | [NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14; [IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/) |
| `div. a 3` (`a 4` …) | divides into 3 (or more) | NZSM p. 14; IU writes "div. a3", placed near the abbreviated staff or group name; "div. a 6" in [YC wiki](https://wiki.youngcomposers.com/Orchestration:_Introduction_to_Strings) |
| `unis.` | everyone plays together again after a divisi | NZSM; IU; Dorico prints it at the end of a divisi ([change labels](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_change_labels_c.html)); *Behind Bars* p. 430 via [Krycho](https://v5.chriskrycho.com/journal/dorico-tip-solo-parts-in-string-sections/) |
| `non div.` | multiple stops are *not* to be divided | [IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/) |
| `Solo` | the section principal alone | NZSM p. 14 |
| `1 solo`, `2 solo` / `2 soli`, `3 soli` | named single players / several soloists together | *Behind Bars* p. 429 via [Krycho](https://v5.chriskrycho.com/journal/dorico-tip-solo-parts-in-string-sections/) |
| `gli altri` | "the others", the rest of the section while soloists play | [YC wiki](https://wiki.youngcomposers.com/Orchestration:_Introduction_to_Strings); Dorico adds a "gli altri" division automatically with a solo division ([Krycho](https://v5.chriskrycho.com/journal/dorico-tip-solo-parts-in-string-sections/)) |
| `tutti` | everyone again after solo, soli or la metà | IU; *Behind Bars* p. 430 via Krycho |
| `la metà` | half the section | IU; [Wikipedia: Divisi](https://en.wikipedia.org/wiki/Divisi) (Verdi's "metà"; German "die eine Hälfte / die andere Hälfte") |
| `1 desk` / divided by desks | front desk only / each desk takes its own line, desk numbers in the left margin | NZSM p. 14; [YC wiki](https://wiki.youngcomposers.com/Orchestration:_Introduction_to_Strings); Sibelius: strings sometimes divide onto several staves numbered by desk ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.4 p. 175) |
| German `geteilt` (`get.`) / `zusammen` (`zus.`) | div. / tutti | [Wikipedia: Divisi](https://en.wikipedia.org/wiki/Divisi) |

Instructions should be in a conventional language such as English, Italian, German or French ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 2). **[derived]** Keep them to one language throughout.

### One staff or extra staves
- **On one staff.** Simple divisions go on one staff as two voices or chords. Parts that are markedly different get separate staves ([Dorico: divisi](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_c.html)).
- **When to split.** Any complexity → one staff per line ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)). Complicated divisions go on separate staves, with barlines running continuously through them ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 5).
- **Parts.** Divisi should be split onto separate staves in the parts too ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14–15).
- **Who plays which line.** In a two-way divisi the outside player of each desk takes the upper line and the inside player the lower. Alternating desks is the preferred method for a three-way divisi ([Wikipedia: String section](https://en.wikipedia.org/wiki/String_section), citing Del Mar, *Anatomy of the Orchestra*).

### Extreme divisi (one player per line)
- **Ligeti, *Atmosphères*.** The score has up to 87 staves, each one instrumental part, with solo parts for every string player, in a tall, narrow format ([Universal Edition](https://www.universaledition.com/en/Atmospheres/P0006949)). "Up to" suggests the staff count varies from page to page, i.e. staves are dropped when not needed [inference, not checked in the score].
- **Xenakis, *Metastaseis*.** 46 strings (12-12-8-8-6), no two playing the same part, all in conventional notation ([Wikipedia](https://en.wikipedia.org/wiki/Metastaseis_(Xenakis))).
- **Penderecki, *Threnody*.** 52 strings (24 vn, 10 va, 10 vc, 8 cb); graphic ("optical") notation, durations in seconds, quarter tones ([Wikipedia](https://en.wikipedia.org/wiki/Threnody_to_the_Victims_of_Hiroshima)). The cut-away look is associated with Penderecki and Stockhausen ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.5 p. 181).
- **Not verified.** How these scores (and Lachenmann's and Saariaho's) actually label and number their divided staves; this needs the scores themselves.

### Naming divisi staves, showing how many players, and showing changes
- **Staff labels (Dorico).** A divisi staff label can include the player or group name and a section number. Groups of divided staves can have their own full and short group labels. Solo staves go **above** the section staves, and new section divisions are added **below** ([Dorico: divisi staff labels](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_staff_labels_c.html); [Change Divisi dialog](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_divisi_change_divisi_dialog_r.html)).
- **Sibelius's format.** "Violin I" with an italic "divisi" under it, and flute staves named "1" and "2" beside a single flute name ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §5.4 p. 450).
- **Showing the number of players.**
  - "div. a 3" etc. near the staff or group name ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/));
  - desk numbers in the left margin ([YC wiki](https://wiki.youngcomposers.com/Orchestration:_Introduction_to_Strings));
  - "2 soli" / "3 soli" for small groups (*Behind Bars* p. 429 via [Krycho](https://v5.chriskrycho.com/journal/dorico-tip-solo-parts-in-string-sections/)).

  Player-range labels such as "Vn. I 1–4" are widely seen [unverified; I found no source that prescribes them].
- **Showing changes mid-piece.**
  1. The staff labels at the start of the next system change.
  2. A change label goes above *each* affected staff, aligned with the change point.
  3. "unis." marks the return ([Dorico: change labels](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_change_labels_c.html)).

  Sibelius's alternative is to put a system break where the number of staves changes ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.4 p. 175).

### Brackets and barlines for divisi
- **Sibelius.** Divided strings are joined by a sub-bracket, a thin bracket left of the main one. Sub-brackets also group Vn I with Vn II, or Flute with Piccolo. Older scores sometimes use a brace instead, especially for horns ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §4.19 p. 402).
- **Indiana.** A bracket per choir; a second-level bracket on like instruments; a **third-level bracket for violin divisi** ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)).
- **Dorico.** Sub-brackets and sub-sub-brackets are available ([Dorico: secondary brackets](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_secondary_brackets_c.html)).
- **Barlines.** Continuous through the whole family and through divisi staves ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 5).

---

## 5. Percussion in the full score
- **Three documented layouts** ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §4.13 p. 379):
  - one staff per instrument or set of instruments;
  - a single staff with text marking each switch of instrument;
  - one staff, or one set of staves, per player. This last one is what separate player parts need.
- **Order and consistency** ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 2):
  - either arrange by pitch, high to low, with pitched percussion staves adjacent to each other, above or below the unpitched;
  - or arrange by player, to show how the instruments are distributed.
  - Whichever is chosen, staff positions must stay the same for the whole work.
- **Per-player guidance.**
  - Each percussionist gets a separate part. One player's several instruments may share one staff ([NYCC](https://youngcomposerschallenge.org/preparing_scores.php)).
  - Parts are organized as "stations": one large instrument (vibraphone, marimba, bass drum, tam-tam…) plus small ones ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 15).
  - *Behind Bars* has sections on assigning instruments to players, numbering players, labelling, laying out pitched and unpitched instruments for one player, two players on one staff, and "Stave allocation for percussion" in the score chapter ([TOC](https://www.behindbarsnotation.co.uk/contents/toc.pdf)); I could not read their content.
- **Legend and names.**
  - List every percussion instrument and the number of players in the front matter ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 4). List them on the instrumentation page and at the start of the part, and mark each change of instrument where it happens. Staves with fewer lines are fine ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)).
  - Dorico has three staff layouts ([Dorico: kit presentation](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_unpitched_percussion/notation_reference_unpitched_percussion_kit_presentation_types_r.html); [staff labels for kits](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_percussion_kits_r.html)):
    - a five-line staff with one staff name and a percussion legend (a stack of instrument names, [Dorico: legends](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_unpitched_percussion/notation_reference_unpitched_percussion_legends_c.html));
    - a grid, with a small instrument name at each line;
    - single-line staves, each with its own full-size name.
- **Timpani.** Timpani get their own part, separate from the percussion part(s) ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 3). Paterson adds that timpanists should not be asked to double on other percussion ([Paterson](https://mostlymodernfestival.org/institute/music-preparation-guidelines-composers/)).
- **Bracketing varies.** Indiana brackets the percussion but not timpani, piano or harp ([IU](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)). Sibelius's default leaves percussion unbracketed ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §4.19 p. 402).

## 6. Two harps, piano, celesta
- **Braces.** Keyboard staves are joined by a brace, and braced or bracketed staves share barlines ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §4.19 p. 402). Dorico names piano and harp as the usual braced (grand-staff) instruments. In Dorico, braced staves cannot also be inside a bracket group and cannot take sub-brackets ([Dorico: brackets and braces](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_c.html)).
- **Order.**
  - Woodwind, brass, then timpani/percussion/harp/keyboard, then voices, then strings ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 2).
  - NZSM: … timpani, percussion, harp, piano, violins … ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 4).
  - Hugill: woodwind / brass / percussion / others / strings ([Hugill](https://andrewhugill.com/OrchestraManual/layouts.html)).
- **Keyboards and harp details.** State how many players the keyboard parts need, and leave harp pedalling to the harpist ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 3). An initial pedal diagram is fine ([Paterson](https://mostlymodernfestival.org/institute/music-preparation-guidelines-composers/)).
- **Two harps or two pianos.** Each gets its own braced grand staff, named "Harp 1" / "Harp 2" (or I / II). No source I read says whether the two harps should also be joined by a bracket [unverified; practice varies].
- **Hide Empty Staves can hide one hand.** Sibelius's Hide Empty Staves may hide one staff of a keyboard instrument; either leave keyboards out of the command or check them afterwards ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.5 p. 180). **[derived]** The same applies to harps.

## 7. Rests, "tacet", hidden staves
- **What counts as empty.**
  - Sibelius hides a staff on a system only if it holds nothing but bar rests (or only hidden music such as cues) for that whole system ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.5 p. 180).
  - MuseScore: empty means nothing on the staff for the entire system ([MuseScore](https://handbook.musescore.org/notation/instruments-staves-and-systems/showing-staves-only-where-needed)).
  - Leaving out all-rest staves in each system is customary in published scores ("French scoring") ([Finale manual](https://usermanuals.finalemusic.com/Finale2014Mac/Content/Finale/Hiding_staves.htm)).
- **First page.** Showing every staff on the first system is common but not universal ([MuseScore](https://handbook.musescore.org/notation/instruments-staves-and-systems/showing-staves-only-where-needed)). NZSM requires all staves on the first page, except doubling instruments picked up later ([NZSM](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf) p. 14).
- **"Tacet."** "Tacet until…" is not acceptable in parts unless the player has nothing more until the end of the work or an interval ([MOLA 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf) p. 3). In the full score, a silent staff is simply hidden, with no "tacet" text [unverified].
- Rests on shared staves: see §2.

---

## 8. What this means for MusicXML → Sibelius

- **Importer version.** Sibelius 2024.3 imports MusicXML with a **MusicXML 3.0** converter ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §1.9 p. 51). **[derived]** Do not rely on 4.0-only features.
- **Import options** (p. 51–52).
  - *Use layout and formatting from MusicXML file* is on by default. It keeps system and page breaks and staff distances.
  - *Use instrument names from MusicXML file* sets the names at the left of each system from the file.
- **Parts are fixed.** A MusicXML `<part>` runs for the whole piece [MusicXML structure]. So sharing that changes during the piece follows Sibelius's own method (§3):
  - one `<part>` per staff configuration ("Flutes 1.2", "Flute 1", "Flute 2");
  - music written into whichever applies in each passage, with bar rests elsewhere;
  - `<print new-system="yes"/>` at every change;
  - after import, Layout > Hide Empty Staves (Ctrl+Alt+Shift+H) ([Sibelius Ref](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) §2.5 p. 180).

  **[derived]** On the first system, hide only the *redundant* configuration staves, so that each player still appears once.
- **A second route to test.** MusicXML `<print>` can carry `<part-name-display>` / `<part-abbreviation-display>`, which change the displayed part name from the next system onward ([MusicXML: print](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/print/)). This could relabel a divisi "slot" staff mid-piece. Whether Sibelius's importer honours it is [unverified].
- **Brackets.**
  - `<part-group>` takes a symbol: `bracket`, `square` (sub-bracket), `brace`, `line` or `none` ([MusicXML: group-symbol-value](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/group-symbol-value/)).
  - Nest groups with the `number` attribute, and set barline joins with `<group-barline>` ([MusicXML: part-group](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-group/)).
  - Whether Sibelius turns `square` into a sub-bracket is [unverified].
- **Hiding a staff in the file.** `<staff-details print-object="no">` exists ([MusicXML: staff-details](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-details/)). Whether Sibelius obeys it on import is [unverified]; Hide Empty Staves after import is the documented route.
- **Encoding a shared staff [MusicXML standard; Sibelius import details unverified].**
  - Voices: `<voice>1</voice>` stems up, then `<backup>`, then `<voice>2</voice>` stems down; chords with `<chord/>`.
  - Labels: `<direction placement="above">` (voice 1) or `placement="below"` (voice 2) holding `<words>1.</words>`, `<words>a 2</words>` and so on.
  - Hidden rests: `print-object="no"` on the `<note>`.
- **Empty bars [derived].** Use whole-bar rests (`<rest measure="yes"/>`) and no directions in bars that should count as empty, so Hide Empty Staves can remove them.

---

## 9. Rules an exporter can implement

All thresholds below are **[derived]** from the sources above unless a source is named. Items marked *option* are choices for the composer, and every option is listed.

### 9.1 Pairing table (candidates only; the share test in 9.4 still decides)
| Staff candidate | Default | Options |
|---|---|---|
| Fl 1+2 | shareable | — |
| Fl 3 (or Fl 3/Picc player) | own staff | *option:* Fl 1.2.3, unison or homorhythm only |
| Ob 1+2 · Cl 1+2 (same key) · Bsn 1+2 | shareable | 3rd player: same as Fl 3 |
| Picc, A.Fl, C.A., E♭ Cl, B.Cl, Cbsn | own staff, never shared with another type or transposition (Dorico) | *option:* per-player staff with instrument changes, or per-instrument staff hidden when silent |
| Hn | 1+2 and 3+4 | *option:* 1+3 and 2+4 (Goss; Dorico) |
| Tpt 1+2; Tpt 3 own staff | shareable | *option:* 1.2.3 (Sibelius example) |
| Tbn 1+2; Tbn 3 own staff; Tuba own staff | shareable | *option:* Tbn 3 + Tuba (Dorico) |
| Percussion 1–4 | never shared across players (Dorico excludes unpitched percussion) | — |
| Harp 1, Harp 2, Piano, Celesta | never shared | — |
| String sections | never combined across sections (NYCC; Dorico) | divisi within a section: 9.7 |

### 9.2 Choose the decision window
- *Option A, whole piece.* Each pair is either shared everywhere or split everywhere. This gives the steadiest layout (Presser/Dorff item 5).
- *Option B, per system.* This is Dorico's granularity. The exporter fixes the system breaks itself and emits `<print new-system="yes"/>`, which Sibelius keeps on import. Every pair is decided per system.
- *Option C, per passage.* Switch only where needed, and force a system break at each switch, as Sibelius recommends. Line the switch points of all pairs up onto one shared set of break bars, so the score does not fill with short systems.

Within B and C, add hysteresis: do not split for one system and rejoin on the next unless the share test forces it.

### 9.3 Build the MusicXML parts
- **Winds and brass.** For every pair that can be shared anywhere, emit three parts in score order: the shared part ("Flutes 1.2") and the single parts ("Flute 1", "Flute 2"). In each window write the music into either the shared part or the single parts; the unused parts get whole-bar rests.
- **Doubling instruments.** Either per-instrument parts (e.g. "Piccolo" above the flutes) or per-player parts with instrument changes (option in 9.1).
- **Strings.**
  - One tutti part per section.
  - Plus one part for each divisi staff configuration actually used, e.g. "Vn. I 1–8" and "Vn. I 9–16" for a divisi a 2, or "Vn. I 1" … "Vn. I 16" for one player per part.
  - Alternatively, a fixed number of "slot" parts relabelled per system with `part-name-display` (untested, §8).

### 9.4 The share test for players A (lower number) and B in one window
The pair shares a staff in the window only if all of the following hold:
1. Same time signature everywhere in the window, and same key signature and transposition (Dorico).
2. In every beat where both sound, the tuplet structure is identical: same ratio, same span, no nesting on either side. Otherwise split. (This follows Indiana's "any complexity → separate".)
3. Neither player has chords or multiphonics while the other sounds.
4. Pitch crossings ≤ `maxCross` in the window. The default 1 follows Dorico; 0 is stricter.
5. No two simultaneous notes a second apart both need accidentals (quarter-tone or otherwise).
6. The two players do not carry *different* technique texts at the same time (e.g. "sul pont." against "flz.").
7. *Optional density limit.* Each voice has at most `maxOnsetsPerBeat` onsets per beat whenever both play. This is a tunable heuristic, not a published rule.

If any condition fails anywhere in the window → split for the whole window.

### 9.5 Inside a shared window: texture per phrase
A phrase is a run of notes between rests (Dorico's definition). For each span where the set of active players or the texture changes:
1. **Only A sounds** → single voice. Label `1.` above. Rests of B:
   - *Hide* them, preferably only at the start or end of bars, and label the active player (Dorico option);
   - *or show* them and omit labels (the other Dorico option).
2. **Only B sounds** → single voice with normal stems, labelled `2.` above [unverified which is more common: this, or keeping B's notes in a down-stem voice with its label below].
3. **Same pitches** (including microtone), same rhythm, ties, articulations and dynamics → single voice, labelled `a 2`. The "a 2" versus "a2" spelling is a house-style choice; be consistent.
4. **Same rhythm, different pitches**, interval ≤ ninth, no crossing, same articulations → chords on shared stems. One dynamic (Scoring Notes). No label needed; the chord shows that both play [derived]. If dynamics or articulations differ → rule 5.
5. **Otherwise** → two voices. Voice 1 = A, stems up; voice 2 = B, stems down (NZSM). Labels `1.` above and `2.` below at the phrase start (Dorico). A's dynamics, hairpins, slurs and articulations above; B's below [unverified detail]. Each voice shows its own rests; when both rest together, show one rest.

**Label emission.**
- Print the label at the first note of every phrase whose texture or active player set differs from the previous phrase on that staff.
- Always print it at the first note on each new system.
- Never repeat an identical label consecutively on the same system (Dorico).
- Labels are score-only (NZSM).

### 9.6 Label strings
| Purpose | Text |
|---|---|
| Staff name, shared pair | full `Flutes 1.2`, short `Fl. 1.2` (variants: `Flutes I, II` NZSM; `Flutes 1-2` Dorico) |
| Staff name, single | `Flute 1` / `Fl. 1` |
| Staff name, transposing | include the key, e.g. `Clarinets 1.2 in B♭` / `Cl. 1.2 (B♭)` (Presser/Dorff item 4) |
| Horns | `Horns 1.2`, `Horns 3.4` (or `1.3`, `2.4`) |
| Player labels | `1.` `2.` `3.` `a 2` `a 3` `1.2 a 2` |
| Instrument change | after the last note: `to Picc.`; at the first note of the new instrument: `Piccolo` (Dorico; NZSM uses "TO COR ANGLAIS" in capitals) |
| Strings | `div.` · `div. a 3` · `unis.` · `non div.` · `Solo` / `1 solo` · `2 soli` · `gli altri` · `tutti` · `la metà` · `1 desk` (or desk ranges) |

### 9.7 String divisi
1. **Divided into 2**, rhythmically identical or two simple voices (the 9.4 test applied to the two halves) → stay on the section staff. `div.` above at the split, `unis.` at the rejoin.
2. **Anything else** → one staff per line.
   - `div. a N` above the top divided staff at the split (IU: near the staff or group name).
   - Staff names state who plays. Use player ranges `Vn. I 1–4`, or desk ranges, or single players `Vn. I 7`. Use a single number only when it cannot be mistaken for a division index [derived; no source prescribes the format].
   - Explain in the performance notes how players are counted, e.g. outside players of desks 1–4 [unverified convention; outside = upper line per Wikipedia and Del Mar].
3. **A solo staff goes above the section staves** (Dorico). The remaining players are labelled `gli altri`, and `tutti` marks the rejoin (Behind Bars p. 430).
4. **Mid-system change.** Either put a system break at the change (Sibelius), or draw the divided staves across the whole system, copy the tutti music onto all of them, and put change labels above each staff (Dorico).
5. **When the grouping changes.** Put new labels above each affected staff at the change point (e.g. `1–4`, `5–8`) and new staff names from the next system (Dorico).
6. **Brackets.** Strings bracket → sub-bracket (`square`) around each section's divided staves → third level for further subdivision (IU). Barlines continuous (MOLA).

### 9.8 Percussion, harps, keyboards
- **Percussion.**
  - A staff group per player, named `Percussion 1` / `Perc. 1`. Inside it, a 5-line staff for pitched instruments and 1-line (or grid) staves for unpitched, with the instrument name above each staff at every entry and change.
  - The same instrument stays at the same staff position throughout (MOLA).
  - On the instrumentation page, list each player's instruments and the key to staff positions (MOLA, IU, Dorico legends).
  - Whether the percussion is bracketed is a house-style option (IU yes, Sibelius default no).
- **Harps and keyboards.** Each Harp 1, Harp 2, Piano and Celesta part is a braced grand staff (a 2-staff part), outside the bracketed groups. Order: percussion → harps → keyboards (MOLA, NZSM).

### 9.9 Rests and hiding
- Empty bars are whole-bar rests with no directions attached [derived].
- After import, run Hide Empty Staves on all systems (Sibelius). On the first system every *player* must appear at least once, but hide the redundant configuration staves there.
- Exclude harps and keyboards from the command, or check them afterwards (Sibelius).
- No "tacet" text in the full score.

### 9.10 Decisions left to the composer
- The window for sharing decisions: whole piece, per system, or per passage (9.2).
- Horn pairing: 1.2 / 3.4 or 1.3 / 2.4.
- Trombone 3 with tuba or alone. Three players on one staff allowed or not.
- Doublings: per-player staves with instrument changes, or per-instrument staves.
- Silent player's rests: hidden with "1." labels, or shown.
- "a 2" or "a2"; "1." or "Solo".
- Divisi staff naming: player ranges, desk ranges, or division numbers.
- Percussion bracket: yes or no.
- Two harps joined by an extra bracket or not.

---

## Appendix: sources
- Dorico manuals (archived):
  - [condensing](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_c.html)
  - [considerations](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_calculations_considerations_c.html)
  - [notation options](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_notation_options_r.html)
  - [groups](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_groups_c.html)
  - [player labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_player_labels_c.html)
  - [label engraving options](https://archive.steinberg.help/dorico/v3/en/dorico/topics/page_formatting/page_formatting_condensing_player_labels_project_wide_engraving_options_c.html)
  - [condensed staff labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_condensed_staves_c.html)
  - [number stacking](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_condensed_staves_number_stacking_changing_t.html)
  - [divisi](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_c.html)
  - [divisi change labels](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_change_labels_c.html)
  - [divisi staff labels](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/notation_reference/notation_reference_divisi/notation_reference_divisi_staff_labels_c.html)
  - [unison ranges](https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/notation_reference/notation_reference_divisi_unison_ranges_c.html)
  - [Change Divisi dialog](https://archive.steinberg.help/dorico/v2/en/dorico/topics/notation_reference/notation_reference_divisi_change_divisi_dialog_r.html)
  - [brackets and braces](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_c.html)
  - [ensemble types](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_ensemble_type_r.html)
  - [secondary brackets](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_brackets_braces/notation_reference_brackets_braces_secondary_brackets_c.html)
  - [percussion legends](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_unpitched_percussion/notation_reference_unpitched_percussion_legends_c.html)
  - [kit presentation types](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_unpitched_percussion/notation_reference_unpitched_percussion_kit_presentation_types_r.html)
  - [kit staff labels](https://archive.steinberg.help/dorico/v3/en/dorico/topics/notation_reference/notation_reference_staff_labels/notation_reference_staff_labels_percussion_kits_r.html)
  - [instrument changes](https://archive.steinberg.help/dorico/v3/en/dorico/topics/setup_mode/setup_mode_instrument_changes_c.html)
- Sibelius Reference Guide 2024.3, §§1.9, 2.4, 2.5, 3.16, 4.13, 4.19, 5.2, 5.4, 9.4: [PDF](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf).
- Other software manuals and articles:
  - Scoring Notes: [Dorico 3 condensing](https://www.scoringnotes.com/reviews/dorico-3-feature-condensing/); [cut-away scores in Sibelius](https://www.scoringnotes.com/tutorials/creating-cut-away-or-scrapbook-scores-in-sibelius/)
  - [Steinberg forum thread with D. Spreadbury](https://forums.steinberg.net/t/condensing-hide-rests-for-inactive-players-sometimes-omits-player-name/151402)
  - [Hinchey, Sibelius extra staves](https://hincheymusic.com/sibelius-tutorial-working-with-large-scores-part-3-extra-staves-now-you-see-them-now-you-dont/)
  - [MuseScore handbook](https://handbook.musescore.org/notation/instruments-staves-and-systems/showing-staves-only-where-needed)
  - [Finale manual](https://usermanuals.finalemusic.com/Finale2014Mac/Content/Finale/Hiding_staves.htm)
  - [LilyPond manual](https://lilypond.org/doc/v2.24/Documentation/notation/multiple-voices)
- MusicXML 4.0 reference: [print](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/print/), [part-group](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/part-group/), [group-symbol-value](https://www.w3.org/2021/06/musicxml40/musicxml-reference/data-types/group-symbol-value/), [staff-details](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/staff-details/).
- Librarians and publishers:
  - [MOLA Guidelines 2017](https://mola-inc.s3.eu-west-1.amazonaws.com/files/mola3/MOLA-Guidelines-for-Music-Preparation.pdf)
  - [MOLA 1993/2001 reprint](https://composersforum.org/wp-content/uploads/2017/04/MOLA-Guidelines-for-Music-Preparation.pdf)
  - [Dorff, Presser / Symphony in C tip sheet](https://danieldorff.com/images/haddonfield-tipsheet.pdf)
  - [Universal Edition, *Atmosphères*](https://www.universaledition.com/en/Atmospheres/P0006949)
- Style guides:
  - [NZSM Guide to Music Notation (Norris), pp. 4, 14–15](https://www.wgtn.ac.nz/nzsm/study/support/student-guides/NZSM-Guide-to-Notation-2019.pdf)
  - [Indiana University Music Notation Style Guide (Dzubay/Freund, rev. 5/20)](https://blogs.iu.edu/jsomcomposition/music-notation-style-guide/)
  - [National Young Composers Challenge](https://youngcomposerschallenge.org/preparing_scores.php)
  - [Paterson, Mostly Modern Festival](https://mostlymodernfestival.org/institute/music-preparation-guidelines-composers/)
  - [Young Composers wiki, strings](https://wiki.youngcomposers.com/Orchestration:_Introduction_to_Strings)
- *Behind Bars*:
  - [official table of contents](https://www.behindbarsnotation.co.uk/contents/toc.pdf)
  - pp. 429–430 as cited by [Krycho](https://v5.chriskrycho.com/journal/dorico-tip-solo-parts-in-string-sections/)
- Orchestration:
  - [Goss, Horn Wars](https://orchestrationonline.com/horn-wars-scoring-12-34-vs-13-24/)
  - Hugill, [score layouts](https://andrewhugill.com/OrchestraManual/layouts.html) and [brass](https://andrewhugill.com/OrchestraManual/layouts_brass.html)
  - Wikipedia: [A due](https://en.wikipedia.org/wiki/A_due), [Divisi](https://en.wikipedia.org/wiki/Divisi), [String section](https://en.wikipedia.org/wiki/String_section), [Metastaseis](https://en.wikipedia.org/wiki/Metastaseis_(Xenakis)), [Threnody](https://en.wikipedia.org/wiki/Threnody_to_the_Victims_of_Hiroshima)
