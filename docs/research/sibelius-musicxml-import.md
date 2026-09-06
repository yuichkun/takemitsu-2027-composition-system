# 調査 — Sibelius の MusicXML 取り込みで何が生き残るか（検証計画）

調査日: 2026-09-05。**計画の段階。実測はまだ1件もない。**
実測が入り次第、各項目の「結果」列を埋め、この文書を更新する。

確度の記号は [`../README.md`](../README.md) の「3. 調査ノート」にある。
`[文献]` 出典が言っていること / `[実測]` 自分で確認した / `[導出]` 計算・推論 / `[推測]` 根拠のない見込み

効く論点: [Q12](../open-questions.md#q12)（四分音の記譜）/ [Q5](../open-questions.md#q5)（プレビュー）/
[Q8](../open-questions.md#q8)（奏法の語彙）/
決定 [0003](../decisions/0003-musicxml-one-way.md)・[0006](../decisions/0006-verify-before-build.md)・
[0008](../decisions/0008-quarter-tone-native.md)。
調査キューの R1・R2・R9・R12 はこのファイルに統合した。

観点の列挙は Claude が行い、独立に Codex（gpt-6-astra）にも同じ問いを投げて突き合わせた。
Codex が挙げた出典のうち、手元の Sibelius 同梱文書で原文確認できたものは `[文献]`、
確認できていないものは `[文献・原典未確認]` と書く。

---

## 0. 要約

**目的:** 作曲システムが出す MusicXML を Sibelius に読ませたとき、何が生き残り、何が化け、何が消えるかを、
実装より先に実機で確定する。結果が MusicXML 射影の実装範囲を決める。

**文献で既に分かっていて、優先順位を変える事実（詳細は 2章）:**

1. Sibelius の内蔵取り込みは **MusicXML 3.0 ベース**で、それ以降の新機能は取り込まれない
2. **`<technical>` と `<ornaments>` は取り込まれない**（トリル・モルデント・ターンは例外）。
   ハーモニクス記号・Bartók ピツィカート・弓の上下・ゲシュトップト・トレモロ（ornaments 内）が全部ここに落ちる
3. **`<symbol>` は取り込まれない。** SMuFL 記号を名前で送る経路は閉じている
4. **譜表タイプの変更は取り込まれない。** 打楽器の譜線数変更や、途中で有音高⇄無音高を切り替える書き方が効かない
5. 四分音の取り込み可否は文献上**不明**（旧版で非対応という一次報告がある）
6. **ManuScript プラグインは四分音の音符を作れる**（浮動小数の音高で `AddNote` できる）。
   符頭・アーティキュレーション・トレモロ・線・テキスト・記号・楽器変更も作れる

**方針（[導出]）:** 2つの経路を並行して検証する。

| 経路 | 中身 |
| --- | --- |
| **A. MusicXML 直接** | 標準の要素で書き、Sibelius がそのまま読むことを期待する。生き残る要素だけを exporter が出す |
| **B. マーカー + ManuScript 修復** | 取り込みで落ちるものは、Sibelius が確実に読む要素（テキスト等）に機械可読のマーカーとして埋め、取り込み後に Claude が書くプラグインが本来の記譜に置き換える |

四分音が経路 A で通らなくても、**経路 B が文献上成立する**ので作品は止まらない。
ただし経路 B は「プラグインが本当に動くか」を含めて実機検証が要る。

**逆方向のプローブは完了した（2.4節）。** Sibelius 自身の書き出し方言が分かった。
四分音は `<accidental>` だけが運び、`<alter>` は半音に切り捨てられる。
Symbols・niente・羽根連桁・l.v. の意味は書き出しで失われる。

**次にやること:** 取り込みテスト。Claude が一要因の最小 MusicXML 群と ManuScript のダンププラグインを作り、
余湖さんが Sibelius に読ませて結果を渡す。

---

## 1. 検証環境 `[実測]`

| 項目 | 値 |
| --- | --- |
| Sibelius | Sibelius.app **24.3.1.3317**（2024年3月版）。`/Applications/Sibelius.app` |
| OS | macOS 26.2 |
| 同梱の MusicXML スキーマ | `Sibelius.app/Contents/Components/MusicXML/musicxml.xsd` は **MusicXML 4.0 の XSD**。取り込み時の妥当性検証に使われていると見られる（`[推測]`）。converter 自体は 3.0 ベース（2.1節） |
| 同梱文書 | `Contents/Resources/en.lproj/Sibelius Help/Sibelius Reference.pdf`、`ManuScript Language.pdf`（いずれも 2024-03-20 付） |
| 手元の道具 | `xmllint`（libxml 2.9.13）、`pdftotext`。MuseScore・Verovio の CLI は**ない** |

`[文献]` Avid のリリースノート PDF（`https://resources.avid.com/SupportFiles/Sibelius/<版>/Whats_New_in_Sibelius.pdf`、
2024.10 / 2025.2 / 2025.7 / 2025.10 / 2025.12 / 2026.2 / 2026.5 / 2026.6 / 2026.8 を取得して読んだ）のうち、
**MusicXML の取り込みに触れているのは 2024.10 だけ**。内容:
レイアウトと余白の忠実な再現、ハウススタイルの合成、複数小節休符の正しい表示、
**楽器名の解釈の改善**、**警告ダイアログで取り込みが止まらない**、`.mxl` の File > Import 対応。
四分音・`<technical>`・`<ornaments>`・`<symbol>`・譜表タイプについての記述はどの版にもない。
浄書側では 2026.2（譜表またぎの連桁、2音トレモロの音価表示ルール）、2026.6（**譜表またぎの臨時記号**）、
2026.8（譜表またぎのタイ、線スタイルの継続テキスト）が効く。2024.10 で ManuScript に
`Bar.Respace` / `Selection.Respace` が追加された（修復プラグインで使える）。
→ **手元の 24.3.1 はこれより前の版。** 検証をどの版で行うかは余湖さんの判断（6章）。

---

## 2. 文献と実測で分かっていること

### 2.1 Sibelius Reference（24.3 同梱、1.9 Opening MusicXML Files）`[文献]`

原文からの要点。引用は英語原文のまま。

**基本**

- "Sibelius's built-in MusicXML 3.0 file converter"
- "Sibelius's MusicXML converter is based around MusicXML 3.0. Files created in earlier MusicXML formats open correctly,
  provided they are valid. Files created with future versions of MusicXML should also open, though new features will not be imported."
- "Sibelius can only open MusicXML files that use the partwise.dtd top-level DTD"
- "The purpose of the file converter is to save you time, not to convert every score so that it is identical to the original."
- 取り込み経路は **File > Open**。`.xml` と `.mxl` の両方を開ける
- 取り込みダイアログの選択肢:
  **Use page and staff size from MusicXML file** / **Use layout and formatting from MusicXML file** /
  **House style**（Unchanged か任意のハウススタイル）/ **Let Sibelius choose instruments**
  （オフにすると、パートごとに Sibelius の楽器を手で割り当てるダイアログが出る）/
  **Use instrument names from MusicXML file**
- エラーは Fatal（XML として不正）/ Validation（MusicXML の構文誤り。開くが結果は保証しない）/ Warning の3段階で表示される

**Limitations 表（原文の要約。取り込みで落ちるもの）**

| 領域 | 原文の内容 |
| --- | --- |
| Articulations | 一部が音符の反対側に付くことがある。**"The technical and ornaments elements are not imported."** |
| Barlines | 譜表ごとに小節線が違うときは最上段のものを使う。**heavy / heavy-light / heavy-heavy は取り込まれない** |
| Beams | **"Sub-beams do not import."** |
| Clefs | MusicXML 特有の打楽器・タブ用音部記号は最も近いものに置き換わる。小節頭と小節末の音部記号を区別できない |
| Cross-stave notes | 複数声部が譜表をまたぐと一部の音符が誤った譜表に乗る。**譜表をまたぐ和音は正しく取り込まれない** |
| Key signatures | mode は major / minor のみ。**`<fifths>` がなければ無調の調号として取り込む。`<key-step>` / `<key-alter>` 等は無視される。**複数譜表のパートでは一部の譜表の調号が落ちることがある |
| Layout | スコア全体で1つのページサイズしか使えない |
| Metronome marks | **最上パートの最上段にあるものしか読まない。**最上パートが複数譜表だと重複することがある。256分・128分・64分・倍全音符を含むものは取り込まれない。位置は Sibelius の既定になる |
| Ornaments | 一部は取り込まれない。**モルデント・トリル・ターンは取り込まれる** |
| Rests | 多声部で生じる余分な休符は自動で消すが、譜表またぎでは残ることがある |
| Slur | `continue`、`position`、`bezier`、`placement`、`orientation` は取り込まれない |
| Symbols | **"Symbols are not imported."** |
| Staves | **"Changes of staff type are not imported."** |

**[導出] この表からほぼ確定で経路 B 送りになるもの:**
`<technical>` 全般（`<harmonic>`、`<snap-pizzicato>`、`<up-bow>`／`<down-bow>`、`<stopped>`、`<open-string>`、
`<string>`、`<fingering>`、`<harmon-mute>`、`<hole>`、`<bend>`、`<brass-bend>` 等）、
`<ornaments>` 内の `<tremolo>`（トリル・モルデント・ターン以外）、`<symbol>`、譜表タイプの途中変更、
二次以降の連桁の分割、heavy 系小節線、微分音の調号、譜表をまたぐ和音。
ただし Reference の記述が 24.3.1 の挙動と一致するかは実測で確かめる（文書が古いまま残っている可能性がある）。

### 2.2 ManuScript Language（24.3 同梱）`[文献]`

取り込みで落ちたものをプラグインで直せるかを決める事実。

**音高・臨時記号**

- `Note.Pitch` は **read only**。`Note.Accidental` も **read only**（`WrittenAccidental` も同様）。
  → 既存の音符の音高や臨時記号を書き換えることはできない。**消して作り直す**ことになる
- `Note.AccidentalStyle` は read/write（`NormalAcc` / `HiddenAcc` / `CautionaryAcc` / `BracketedAcc`）
- 臨時記号の定数に **`QuarterSharp` (0.5) / `ThreeQuarterSharp` (1.5) / `QuarterFlat` (−0.5) / `ThreeQuarterFlat` (−1.5)** がある
- **`SetInterpreterOption(SupportHalfSemitonePitchValues)`** を有効にすると、
  "floating-point values are accepted as 'Pitch' so that scripts can add and manipulate quarter-tone values.
  Pitch is still specified and returned as a semitone, but 0.5 semitone is a quartertone."
  対象: `NoteRest.AddNote`、`Bar.AddNote`、`Stave.AddNote`（追加側）、
  `Note.Pitch`、`Note.WrittenPitch`、`Note.Accidental`、`Note.WrittenAccidental`（読み出し側）
- `Bar.AddNote(pos, sounding pitch, duration[, tied[, voice[, diatonic pitch[, string number]]]])`。
  diatonic pitch を指定できるので**綴り（C↑ か D↓ か）を制御できる**
- `NoteRest.Delete()` で和音の全音符を休符に変える。個々の音符の削除は `Note` 側の操作を確認する（未確認）

**符頭・アーティキュレーション・トレモロ**

- `Note.NoteStyle` は read/write。定数に `NormalNoteStyle` / `CrossNoteStyle` / `DiamondNoteStyle` /
  `HeadlessNoteStyle` / `StemlessNoteStyle` / `SilentNoteStyle` / `CueNoteStyle` / `SlashedNoteStyle` /
  `BackSlashedNoteStyle` / `ArrowDownNoteStyle` / `ArrowUpNoteStyle` / `InvertedTriangleNoteStyle` /
  `CrossOrDiamondNoteStyle` / `BlackAndWhiteDiamondNoteStyle` / `BeatNoteStyle` 等がある
- `Note.SetArticulation` の定数に `HarmonicArtic`（○）/ `PlusArtic`（+）/ `UpBowArtic` / `DownBowArtic` /
  `AccentArtic` / `MarcatoArtic` / `TenutoArtic` / `StaccatoArtic` / `StaccatissimoArtic` / `WedgeArtic` /
  `PauseArtic` / `SquarePauseArtic` / `TriPauseArtic` / `Custom1Artic`〜`Custom3Artic` がある
- `NoteRest.SingleTremolos`（−1 = z on stem 〜 7）、`NoteRest.DoubleTremolos`（0〜7）は read/write

**作れるもの（`Bar` の `Add*`）**

`AddText(pos, text, style)`（例: `"Technique"`）、`AddLine(pos, duration, line style[, dx, dy, voice, hidden])`
（`"line.staff.hairpin.crescendo"` のような識別子を推奨）、`AddSymbol(pos, index or name)`、
`AddInstrumentChange(pos, styleID[, add_clef, show_text, text_label, ...])`、`AddClef`、`AddKeySignature`、
`AddTimeSignature`、`AddRehearsalMark`、`AddSpecialBarline`、`AddBarline`、`AddGraphic`、
`AddNestedTuplet`、`AddAcciaccaturaBefore` / `AddAppoggiaturaBefore`、`AddComment`

**ファイル入出力**

`Sibelius.ReadTextFile(filename)`（行の配列を返す）、`CreateTextFile`、`AppendTextFile`、`SelectFileToOpen`。
→ サイドカーファイル方式も可能。ただし本文中のテキストをマーカーにする方が自己完結する（3章）。

### 2.3 Codex 経由で得た、原典未確認の出典 `[文献・原典未確認]`

| 内容 | 出典 |
| --- | --- |
| Sibelius 7 時代の公式フォーラムで、担当者が「MusicXML 取り込みで四分音は取り込まれない」と回答している（回答自体に留保あり） | https://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&groupid=3&guest=1&start=581238 |
| Sibelius 6.1 で `<part-group>` の取り込みが追加された。`<other-direction>` は Comment として取り込まれる | https://www.sibelius.com/helpcenter/updates/sib610_changes.pdf |
| Sibelius 2020.6 で、開いているスコアへの MusicXML 取り込み（File > Import）が拡張され、ページ・譜表サイズ／レイアウト／音部記号／複数声部／間隔／複数楽器への振り分けの選択肢がある | https://resources.avid.com/SupportFiles/Sibelius/2020.9/Whats_New_in_Sibelius.pdf |
| Dolet 8（MusicXML 書き出しプラグイン）は ManuScript が公開する情報に制約され、カスタムアーティキュレーション・ユーザー定義の線と記号・符尾長・ハウススタイル情報へのアクセスに制限がある | https://www.musicxml.com/dolet-plugin/dolet-plugin-for-sibelius/release-notes/ |
| Sibelius 2025.2 Reference（p.99）の Limitations は 24.3 同梱版と同内容（Codex の読みと 2.1節が一致） | https://resources.avid.com/SupportFiles/Sibelius/2025.2/Sibelius_Reference.pdf |

### 2.4 Sibelius 24.3.1 の MusicXML 書き出し方言（逆方向プローブ）`[実測]`

2026-09-06。Sibelius 上で20小節のスコアを手入力し（操作は GPT-6 Astra の computer-use、英語 UI）、
非圧縮 MusicXML と PDF に書き出した。ファイルは `artifacts/sibelius-probe/`（git 管理外）。
`sibelius-probe-notes.md` に小節ごとの入力内容がある。

**書き出しの外形**

- `<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.0 Partwise//EN">`、`<score-partwise version="3.0">`
- `<divisions>256</divisions>`。`<encoding>` に `<software>Sibelius 24.3.1</software>` と `<software>Direct export, not from Dolet</software>`
- `<supports>` は `print` の `new-system` / `new-page`、`accidental`、`beam`、`stem`。exporter はこれと同じ集合を出す
- **`<encoder>` に Sibelius のユーザ名（余湖さんの実名）が入る。** 作曲システム → Sibelius の経路では出てこないが、
  Sibelius から MusicXML を書き出す作業を挟むときは要注意
- PDF の Info には Author が入っていない（`pdfinfo` で確認。Creator は "Sibelius version 24.3.1 on macOS 26.2"）

**小節ごとの結果**

| 小節 | 入力 | Sibelius が書き出したもの | 含意 |
| --- | --- | --- | --- |
| 1–4, 20 | 四分音（Keypad の臨時記号） | `<accidental>quarter-sharp / quarter-flat / three-quarters-sharp / three-quarters-flat</accidental>`。**`<alter>` は半音に切り捨て**（quarter-sharp → `0`、three-quarters-sharp → `1`、quarter-flat → `0`、three-quarters-flat → `-1`）。`<alter>0.5</alter>` は一度も出ない | 四分音の情報は臨時記号要素だけが運ぶ。取り込みテストは「Sibelius 方言（alter 切り捨て + accidental）」を第一候補にし、alter 0.5 併記・alter のみと比較する（QT-01〜03） |
| 1–4 Cl. | 四分音 + 移調 | `<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>`。`<pitch>` は**記譜音**（実音 C↑ が written D↑ で出る）。四分音の臨時記号は移調後の音に正しく付く | MusicXML の `<pitch>` は記譜音で、`<transpose>` を足すと実音。Sibelius 内部で四分音が移調に追従する（QT-14 に有利） |
| 5 | Symbols の矢印つき臨時記号 | `<other-direction print-object="no">Three-quarter sharp 2</other-direction>`。音符は `<accidental>sharp</accidental>` のまま | Symbols は不可視の other-direction に化ける。矢印系は Sibelius の書き出しで表現できず、取り込みでも `<symbol>` は読まれない（2.1節）。矢印系は ManuScript の `AddSymbol` でしか付かない |
| 6, 7 | 菱形符頭、人工ハーモニクス | `<notehead filled="no">diamond</notehead>`。7小節は `<chord/>` で通常符頭 + 菱形。`<harmonic>` 要素は出ない | 符頭は素直。ハーモニクスの意味は符頭でしか運ばれない（STR-01, 05） |
| 8 | ○（Harmonic/Open アーティキュレーション） | `<technical><open-string/></technical>` | Sibelius は ○ を `open-string` に対応づける。取り込みで `<technical>` が読まれないなら落ちるが、自分の書き出しと対称な例外がありうる（STR-09 に `<open-string/>` を含める） |
| 9 | Snap（Bartók pizz.）Symbol | `<other-direction print-object="no">Snap 2</other-direction>` | 5小節と同じ。`AddSymbol` 前提（STR-11） |
| 10 | 3本斜線トレモロ | `<ornaments><tremolo type="single">3</tremolo></ornaments>` | 標準どおり。取り込みは要確認（STR-17） |
| 11 | 2音間トレモロ | `<tremolo type="start">3</tremolo>` / `stop`。各音 `<type>whole</type>` `<duration>512</duration>`（表示音価の半分） | 標準どおり |
| 12 | X 符頭、1線打楽器 | `<clef><sign>percussion</sign><line>2</line></clef>`、`<staff-details><staff-lines>1</staff-lines>`、`<unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched>`、`<notehead>x</notehead>`。`<instrument-sound>` と `<midi-instrument>` はなし | 1線譜の音は E4 に置く（PERC-01, 02, 07） |
| 13 | l.v. タイ | `<tie type="start"/>` + `<tied type="start" orientation="under"/>` だけ。`let-ring` なし。後続の休符に stop なし | 3.0 に let-ring はない。**始点だけのタイ**が Sibelius 方言。取り込みでこれが l.v. になるかを PERC-12 に加える |
| 14 | niente つきヘアピン | `<wedge type="crescendo">` + `stop`。`niente` 属性なし | 書き出しで niente が落ちる。取り込みも期待薄。`AddLine` の niente 系スタイル前提（DYN-06） |
| 15 | 羽根連桁 | `<beam number="1">begin / continue / end</beam>`。`fan` 属性なし | 書き出しで落ちる。取り込みも期待薄（RHY-12） |
| 16, 17 | Technique / Expression テキスト | どちらも `<words>`。差は `font-style="normal"` + `default-y="20"`（上）vs `font-style="italic"` + `default-y="-70"`（下）。`font-family="Palatino"` | スタイル名は運ばれない。取り込み側の振り分けは DYN-09 で確認 |
| 17, 18 | 楽器変更 Fl → Picc | Flute パートに `<score-instrument>` が2つ（`P1-I1` Flute、`P1-I2` Piccolo）。18小節の音符に `<instrument id="P1-I2"/>`、18小節の `<attributes><transpose><octave-change>1</octave-change></transpose>`、17小節の `<print>` に `<part-name-display><display-text>Piccolo</display-text></part-name-display>`。「To Picc.」は `<words>`。「Piccolo」のラベル自体は出ない | これが Sibelius の持ち替え方言。取り込みテストの第一候補（WIND-14） |
| 19 | 8va | `<octave-shift type="down" size="8" number="1"/>` + `stop`。`<pitch>` は C6（鳴る高さ。表示は C5 + 8va） | オッターヴァ下の音高は鳴る高さで書く（KEY-09） |
| 全体 | 調号・グループ | `<key><fifths>0</fifths><mode>major</mode></key>`、`<part-group>` bracket（木管、ティンパニ）と brace（ピアノ）、`<instrument-sound>` は有音高楽器に付く（`wind.flutes.flute` 等） | — |

**要約:** 四分音・符頭・トレモロ・移調・楽器変更・8va は Sibelius 自身が MusicXML で表現できる。
Symbols（矢印臨時記号、Bartók pizz.）・niente・羽根連桁・l.v. の意味は書き出しで失われる。
書き出せるものは同じ形で読める可能性が高い（`[推測]`。取り込みは別実装）。次の取り込みテストで確かめる。

`[実測]` GPT-6 Astra の computer-use は Sibelius の GUI 操作を安定してこなした（このプローブの入力は全部それ）。
ManuScript でも直せないものが残った場合の**最終手段**として、Astra に Sibelius を直接操作させる選択肢がある。
ただし何度もやり直す作業には向かないので、これに依存する経路は取らない（余湖さんの方針）。

---

## 3. 経路 B（マーカー + ManuScript 修復）の設計案 `[導出]`

実機検証の対象なので、ここでは骨だけ書く。

1. exporter は、取り込みで落ちると分かった要素を**標準要素で出さず**、
   代わりに Sibelius が確実に読む要素（第一候補: `<direction-type><words>` のテキスト）に、
   予約接頭辞つきの短いマーカーとして埋める。例: `§q+`（四分音上げ）、`§h`（自然ハーモニクス ○）、`§tr3`（3本斜線）
2. 取り込み後、Claude が書く ManuScript プラグインが全譜表を走査し、マーカーを見つけては
   本来の記譜に置き換え、マーカーを消す
   - 四分音: `SetInterpreterOption(SupportHalfSemitonePitchValues)` の上で、対象の音符を消して
     `Bar.AddNote(pos, pitch ± 0.5, duration, tied, voice, diatonic pitch)` で作り直す
   - 符頭: `Note.NoteStyle`。アーティキュレーション: `Note.SetArticulation`。トレモロ: `SingleTremolos` / `DoubleTremolos`
   - 線・記号・楽器変更: `AddLine` / `AddSymbol` / `AddInstrumentChange`
3. プラグインは**冪等**にする（2回走らせても二重にならない）。マーカーが消えていれば何もしない
4. マーカーの位置合わせは、小節通し番号・譜表・声部・小節内位置（1/256 四分音符単位）で行う

検証すべき前提: (a) `<words>` が位置と譜表を保って取り込まれるか（DYN-14〜18）、
(b) 削除→再追加でタイ・スラー・連桁・連符が壊れないか（METHOD-19〜21）、
(c) 四分音の音符を作った直後に Sibelius が正しい臨時記号を描くか（METHOD-22）。

---

## 4. 検証項目

書式: ID / 検証すること / MusicXML の構文（verbatim）/ 文献上の見込み / 落ちた場合の経路 B。
「見込み」が空欄のものは未知。**値を列挙した行は、値ごとに別ケースにする。**
「結果」列は実測後に埋める（生き残る／化ける／消える + スクリーンショット参照）。

### 4.1 四分音（最優先）

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| QT-01 | `<alter>` の小数だけで四分音になるか。臨時記号要素なし | `<pitch><step>C</step><alter>0.5</alter><octave>4</octave></pitch>` | 未知。旧版で非対応の報告 `[文献・原典未確認]` | AddNote で作り直し | |
| QT-02 | 負・1.5・−1.5 で丸め方が変わらないか | `<alter>-0.5</alter>` / `1.5` / `-1.5` | 未知 | 同上 | |
| QT-03 | **本命。** alter と標準の臨時記号値の併記 | `<alter>0.5</alter>` + `<accidental>quarter-sharp</accidental>`、同様に `quarter-flat` / `three-quarters-sharp` / `three-quarters-flat` | 未知 | 同上 | |
| QT-04 | alter と accidental が食い違うときどちらが勝つか（診断用） | alter 0.5 + `<accidental>sharp</accidental>`、`<accidental>quarter-sharp</accidental>` だけで alter なし | 未知 | 本番では一致させる | |
| QT-05 | 矢印系の臨時記号値 | `<accidental>natural-up</accidental>` / `natural-down` / `sharp-up` / `sharp-down` / `flat-up` / `flat-down` / `arrow-up` / `arrow-down` | 未知 | 記譜法を Stein 系に寄せるか、AddNote 後に記号を差し替え | |
| QT-06 | その他の値（体系選定の探索用） | `slash-quarter-sharp` / `slash-sharp` / `slash-flat` / `double-slash-flat` / `sori` / `koron` / `double-sharp-up` 等 | 未知 | 採用しない | |
| QT-07 | SMuFL 名の指定 | `<accidental smufl="accidentalQuarterToneSharpStein">quarter-sharp</accidental>`、`accidentalQuarterToneFlatStein`、`accidentalThreeQuarterTonesSharpStein`、`accidentalThreeQuarterTonesFlatZimmermann`、`<accidental smufl="…">other</accidental>` | `[推測]` 3.0 ベースの取り込みは `smufl` 属性を無視する | 同上 | |
| QT-08 | 括弧・注意的・編集用の属性 | `<accidental parentheses="yes">` / `cautionary="yes"` / `editorial="yes"` / `bracket="yes"` | 未知 | `AccidentalStyle` で修正 | |
| QT-09 | 小節内の同音反復と臨時記号の省略規則 | 同小節の同音で `<accidental>` を最初だけ／毎回、`<alter>` を 0 → 0.5 → 1 → 0.5 → 0 と往復 | 未知 | `AccidentalStyle` | |
| QT-10 | 別オクターブ・別声部・別譜表への効力の漏れ | 同音名で異なる `<alter>` を別 `<voice>` / `<staff>` / octave に | 未知 | 明示記号を追加 | |
| QT-11 | 小節線・段・ページをまたぐ | `<tie>` + `<tied>` で次小節へ、`<print new-system="yes"/>` の直後 | 未知 | 改行確定後に校正 | |
| QT-12 | 和音内の混在 | `<chord/>` で半音と四分音、四分音だけの和音、同じ `<step>` で異なる `<alter>` | 未知 | 和音を作り直し | |
| QT-13 | 異名同音の綴りが保たれるか | C + 0.5 と D + (−1.5)、B/C・E/F 境界 | 未知 | diatonic pitch を指定して作り直し | |
| QT-14 | **移調楽器。** 記譜音側で四分音の臨時記号が保存されるか | Cl in B♭ `<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>`、Hr in F・E.Hr `<diatonic>-4</diatonic><chromatic>-7</chromatic>`、Alto Fl、`<octave-change>`（Picc / Cb / Cfg / Glock / Celesta）。Concert pitch 表示との往復 | 未知 | 作り直し。最終手段は記譜音を直接置いて移調機能を使わない | |
| QT-15 | 譜表途中の持ち替え + 四分音 | 小節途中の `<transpose>` 変更 + `<instrument id>` + タイまたぎ | 未知 | `AddInstrumentChange` 後に作り直し | |
| QT-16 | ハーモニクスの触弦点・実音が四分音 | STR-05〜08 と組み合わせ。base だけ／touching だけ／両方 | `[文献]` `<technical>` は取り込まれない → 経路 B 前提 | 作り直し + `DiamondNoteStyle` + `HarmonicArtic` | |
| QT-17 | 装飾音・キュー・連符・トレモロ・譜表またぎの中の四分音 | `<grace>`、`<cue/>`、`<time-modification>`、`<tremolo>`、`<staff>` 変更 | 未知 | 文脈ごとに作り直し | |
| QT-18 | 四分音間のグリッサンド・スライド・ベンド | `<glissando type="start">gliss.</glissando>`、`<slide>`、`<bend><bend-alter>0.5</bend-alter></bend>` | 未知（bend は `<technical>` 内 → 落ちる） | `AddLine` | |
| QT-19 | トリルの補助臨時記号が四分音 | `<ornaments><trill-mark/><accidental-mark>quarter-sharp</accidental-mark></ornaments>`、`<notations><accidental-mark>` 単独 | `[文献]` トリル自体は取り込まれる。accidental-mark は未知 | `AddSymbol` | |
| QT-20 | 微分音の調号 | `<key><key-step>F</key-step><key-alter>0.5</key-alter><key-accidental>quarter-sharp</key-accidental></key>` | `[文献]` `<key-step>` / `<key-alter>` は無視される | 使わない。音符ごとに明示 | |
| QT-21 | 調号なしの無調表示 | `<key><fifths>0</fifths><mode>none</mode></key>`、`<key>` 省略 | `[文献]` `<fifths>` がなければ無調として取り込む | — | |
| QT-22 | 音価・符尾方向・加線・密集による字形欠落 | 全音符〜32分、上下符尾、加線多数、密集和音の四分音 | 未知 | ハウススタイル調整 | |
| QT-23 | 記譜法の流儀の比較 | Stein-Zimmermann 系（QT-03）と矢印系（QT-05）を同一ファイルに並べる | — | 流儀の決定材料（R12） | |

**合格条件:** ①記譜上の音名と octave ②指定した記号 ③正しい音符への結びつき ④注意的記号と省略規則 ⑤PDF 上の可読性。
再生は判定に使わない。

### 4.2 打楽器

`<midi-unpitched>` は `<score-instrument>` の子ではなく、対応する `<midi-instrument>` の子。
`<score-instrument id>` は文書全体で一意にする（共有楽器でも別パートで同じ ID を再利用しない）。

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| PERC-01 | 無音高打楽器の基本 | `<clef><sign>percussion</sign></clef>` + `<unpitched><display-step>E</display-step><display-octave>4</display-octave></unpitched>` + `<score-instrument><instrument-name>` | `[文献]` 特殊な打楽器音部記号は最も近いものに置換 | 事前に打楽器譜表を用意して取り込み | |
| PERC-02 | 譜線数 | `<staff-details><staff-lines>1</staff-lines></staff-details>`、`2`、`3`、`5`、`0` | 未知 | 楽器定義側で用意 | |
| PERC-03 | 譜線数の途中変更 | 小節境界・小節途中で `<staff-details>` を変更 | `[文献]` **譜表タイプの変更は取り込まれない** | `AddInstrumentChange` | |
| PERC-04 | 1譜表に複数楽器 | 1つの `<score-part>` に複数 `<score-instrument id>`、音符ごとに `<instrument id>` | 未知 | 演奏者ごとのカスタム打楽器定義を先に作る | |
| PERC-05 | 楽器の当たり方に効く情報 | `<instrument-name>` / `<instrument-abbreviation>` / `<instrument-sound>` / `<midi-instrument><midi-unpitched>` の有無で比較 | 未知 | Let Sibelius choose instruments をオフにして手で割り当て | |
| PERC-06 | 位置と符頭の組み合わせで楽器を表す記譜 | 同じ `<instrument>` で `<display-step>` 変更、同じ位置で `<notehead>` 変更、`<instrument>` だけ変更 | 未知 | `NoteStyle` | |
| PERC-07 | 符頭の全種 | `<notehead>x</notehead>` / `cross` / `circle-x` / `diamond` / `triangle` / `inverted triangle` / `square` / `arrow up` / `arrow down` / `slash` / `slashed` / `back slashed` / `none` / `cluster` / `circled` / `normal`、`filled="no"`、`parentheses="yes"`、`<notehead smufl="…">other</notehead>`（値の空白は仕様どおり。ハイフンにしない） | 未知 | `NoteStyle`（Cross / Diamond / Headless / Slashed / BackSlashed / ArrowUp / ArrowDown / InvertedTriangle 等） | |
| PERC-08 | 同時打撃 | `<chord/>` で異なる `<instrument>`、同じ位置で異なる符頭 | 未知 | 別声部へ分離 | |
| PERC-09 | 打楽器譜表の多声部 | `<voice>1`〜`4`、`<backup>`、`<stem>` | 未知 | 声部を整理 | |
| PERC-10 | ロール | `<ornaments><tremolo type="single">3</tremolo></ornaments>`、`1` / `2`、`<tremolo type="unmeasured" smufl="buzzRoll">0</tremolo>`、`tr` 表記 | `[文献]` `<ornaments>` は取り込まれない（トリルは例外）→ トレモロは落ちる可能性が高い | `SingleTremolos` | |
| PERC-11 | フラム・ドラッグ、ロール + アクセント／ヘアピン／タイ | `<grace>` + 本音符、複合 | 未知 | 個別に再設定 | |
| PERC-12 | 消音・余韻 | `<technical><damp/></technical>`、`<damp-all/>`、`<tied type="let-ring"/>`、`<words>l.v.</words>` | `[文献]` `<technical>` は落ちる。let-ring は 3.1 → 未知 | `AddSymbol` / l.v. タイ / テキスト | |
| PERC-13 | マレット・スティック指示 | `<words>soft mallets</words>` vs `<direction-type><percussion><stick><stick-type>…</stick-type><stick-material>…</stick-material></stick></percussion>`、`<beater>`、`<stick-location>` | `[推測]` ピクトグラムは描かれない | テキスト | |
| PERC-14 | 楽器ピクトグラム | `<percussion><timpani/></percussion>`、`<metal>`、`<wood>`、`<membrane>` | `[推測]` 描かれない | テキストか `AddSymbol` | |
| PERC-15 | ティンパニ | 有音高 `<pitch>` + F clef + 四分音 `<alter>`。チューニング変更を `<words>` / 小音符 / `<accidental-text>` で。ペダルグリッサンド `<glissando>` + `<words>pedal gliss.</words>` | 未知。無音高譜表に誤分類されないか | 楽器を明示 | |
| PERC-16 | 有音高⇄無音高の切り替え（Tam-tam → Glock 等） | 同一パート内で `<pitch>` と `<unpitched>`、`<clef>`、`<staff-details>` を切替 | `[文献]` 譜表タイプの変更は取り込まれない | `AddInstrumentChange`、または同一奏者の別譜表 | |
| PERC-17 | 鍵盤打楽器の移調 | Glock `<octave-change>2`、Xylo `1`、Crotales `2`、Celesta `1` | `[推測]` 通常の移調は通る | 楽器定義で担保 | |
| PERC-18 | ヴィブラフォンのペダル・モーター、弓奏 | `<pedal type="start" line="yes">`、`<words>motor on</words>`、`<words>bowed</words>` | 未知 | `AddLine` / テキスト | |
| PERC-19 | 4奏者の楽器共有 | 4つの `<score-part>`。共有楽器も各パート内で別 `<score-instrument id>`。受け渡しを `<words>` で | 未知 | 演奏者パートを固定 | |
| PERC-20 | 実編成の相互作用 | 4人 × 複数譜表、長い休符、持ち替え、改ページ | 未知 | 譜表構造を固定 | |
| PERC-21 | クラスター・特殊符頭の描画 | `<notehead>cluster</notehead>` + 和音、矩形 | 未知 | `AddSymbol` | |

### 4.3 弦

`<harmonic>` は `<technical>` 内。`<natural/>` / `<artificial/>` と `<base-pitch/>` / `<touching-pitch/>` / `<sounding-pitch/>` は
その音符の `<pitch>` の役割を指定する空要素で、中に音高を入れるのではない。
**`[文献]` `<technical>` は取り込まれない**ので、この節の記号要素はほぼ経路 B 前提。テキスト経路が本命。

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| STR-01 | 菱形符頭だけ | `<notehead>diamond</notehead>` | `[推測]` 通る | `DiamondNoteStyle` | |
| STR-02 | ○記号 | `<technical><harmonic/></technical>`、`<harmonic><natural/></harmonic>` | `[文献]` 落ちる | `HarmonicArtic` | |
| STR-03 | 自然ハーモニクスの役割指定 | `<harmonic><natural/><base-pitch/></harmonic>` / `<touching-pitch/>` / `<sounding-pitch/>` | `[文献]` 落ちる。音高が勝手に変換されないかを見る | 作り直し | |
| STR-04 | 人工ハーモニクスの役割指定 | `<harmonic><artificial/><base-pitch/></harmonic>` / `<touching-pitch/>` / `<sounding-pitch/>` | 同上 | 同上 | |
| STR-05 | 人工ハーモニクスの2音和音 | `<chord/>` で押弦（通常符頭）+ 触弦（`<notehead>diamond</notehead>` + `<harmonic><artificial/><touching-pitch/></harmonic>`） | 未知。2音が保持されるか、両方菱形にならないか | 和音を再構築 | |
| STR-06 | 実音の小音符併記 | STR-05 + `<type size="cue">` + `<notehead parentheses="yes">` | 未知 | 別声部または注記 | |
| STR-07 | ○を隠して菱形だけ | `<harmonic print-object="no">` + 菱形 | 未知 | — | |
| STR-08 | ハーモニクスと線・装飾の組み合わせ | STR-05 + タイ / スラー / トレモロ / グリッサンド / 装飾音 | 未知 | 音符→符頭→線→記号の順で修復 | |
| STR-09 | 弓の記号要素 | `<technical><up-bow/></technical>`、`<down-bow/>`、`<open-string/>`、`<thumb-position/>` | `[文献]` 落ちる | `UpBowArtic` / `DownBowArtic` / `AddSymbol` | |
| STR-10 | 指番号・弦番号 | `<fingering>`、`<fingering substitution="yes">`、`<string>4</string>` | `[文献]` 落ちる | テキスト（sul G、IV） | |
| STR-11 | Bartók ピツィカート | `<technical><snap-pizzicato/></technical>` | `[文献]` 落ちる | `AddSymbol` | |
| STR-12 | 左手ピツィカート | `<technical><stopped/></technical>`（+） | `[文献]` 落ちる | `PlusArtic` | |
| STR-13 | 奏法テキスト | `<words>pizz.</words>` / `arco` / `sul pont.` / `sul tasto` / `ord.` / `col legno battuto` / `col legno tratto` / `flautando` / `molto sul pont.` | `[推測]` 通る。Technique スタイルに入るか | `AddText(…, "Technique")` | |
| STR-14 | ミュート | `<string-mute type="on"/>` / `off` vs `<words>con sord.</words>` / `senza sord.` | 未知 | テキスト | |
| STR-15 | 弓圧・スクラッチ・その他の独自技法 | `<other-technical>overpressure</other-technical>` vs `<words>overpressure</words>`、符頭変更 | `[文献]` `<other-technical>` は落ちる | テキスト + `NoteStyle` | |
| STR-16 | 奏法遷移の線 | `<words>sul pont.</words>` + `<dashes type="start" number="1"/>` / `stop`、`<bracket type="start" line-end="arrow">` | 未知 | `AddLine`（カスタム線） | |
| STR-17 | トレモロ | `<ornaments><tremolo type="single">1</tremolo></ornaments>`、`2`、`3`、2音間 `<tremolo type="start">3</tremolo>` / `stop` + 2:1 の `<time-modification>` | `[文献]` `<ornaments>` は落ちる（要確認） | `SingleTremolos` / `DoubleTremolos` | |
| STR-18 | グリッサンド・スライド | `<glissando type="start" number="1" line-type="wavy">gliss.</glissando>` / `stop`、`<slide type="start" line-type="solid">`、和音間の複数線、不定音高への線（X 符頭・矢印）、休符・段またぎ | 未知 | `AddLine` | |
| STR-19 | ディヴィジ | (a) 1譜表2声部 + `<words>div.</words>` / `unis.` / `a 2` / `solo` / `tutti` (b) `<staves>2</staves>` + `<staff>` (c) 別 `<score-part>`、`<staff-divide type="down"/>` / `up` / `up-down` | (a) `[推測]` 通る。(b)(c) 未知 | 譜表を事前に用意 | |
| STR-20 | ユニゾン二声・逆向き符尾 | 同一譜表で異音価の共有符頭、`<stem>up</stem>` / `down` | 未知 | 声部整理 | |
| STR-21 | アルペジオ | `<arpeggiate direction="up" number="1"/>` / `down`、大譜表をまたぐ同一 `number`、`<non-arpeggiate type="top"/>` / `bottom` | 未知 | `AddLine` | |
| STR-22 | スコルダトゥーラ | `<scordatura><accord string="1"><tuning-step>…</tuning-step><tuning-alter>…</tuning-alter><tuning-octave>…</tuning-octave></accord></scordatura>` | 未知。想定外だが挙動を知る | 手動 | |
| STR-23 | リコシェ・ジュテ・ハーモニクス・グリッサンド | トレモロ + スラー + テキスト、菱形 + `<glissando>` | 未知 | 組み合わせで修復 | |

### 4.4 木管・金管

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| WIND-01 | マルチフォニクス | 複数 `<note>` + `<chord/>` + 各 `<accidental>`（四分音含む）、`<words>M17</words>` 等の識別子 | 未知 | 和音を再構築 | |
| WIND-02 | 運指図 | `<technical><hole><hole-type>…</hole-type><hole-closed>yes</hole-closed></hole></technical>`（`no` / `half`）、`<direction-type><image source="…" type="image/png"/></direction-type>` | `[文献]` `<hole>` は落ちる。画像は未知 | `AddGraphic` か手作業 | |
| WIND-03 | キークリック・スラップ | `<pitch>` または `<unpitched>` + `<notehead>x</notehead>` / `triangle` + `<words>key clicks</words>` | 未知 | `NoteStyle` + テキスト | |
| WIND-04 | エアサウンド | `<notehead>none</notehead>` / `x` / `diamond` + `<words>air only</words>` | 未知 | `HeadlessNoteStyle` + テキスト | |
| WIND-05 | フラッタータンギング | `<words>flz.</words>` + `<tremolo type="single">3</tremolo>` | `[文献]` トレモロ側が落ちる可能性 | `SingleTremolos` | |
| WIND-06 | タンギング記号 | `<technical><double-tongue/></technical>`、`<triple-tongue/>` | `[文献]` 落ちる | `AddSymbol` / テキスト | |
| WIND-07 | 独自技法のテキスト | slap tongue / tongue ram / whistle tone / sing and play を `<words>` で | `[推測]` 通る | — | |
| WIND-08 | 歌唱 + 演奏の二系統 | 別 `<voice>` + 異種符頭 + 四分音 | 未知 | 声部整理 | |
| WIND-09 | ブレス・チェズーラ | `<articulations><breath-mark>comma</breath-mark></articulations>`（`tick` / `upbow` / `salzedo`）、`<caesura/>`、`<caesura>thick</caesura>` 等 | 未知（`<articulations>` は「一部が反対側に付く」のみ言及） | `AddSymbol` | |
| WIND-10 | ミュート指示 | `<words>straight mute</words>` / `cup mute` / `Harmon mute, stem out` / `senza sord.`、`<technical><harmon-mute><harmon-closed>yes</harmon-closed></harmon-mute>`（`no` / `half`。`<harmon-closed>` は必須） | テキストは `[推測]` 通る。harmon-mute は `[文献]` 落ちる | テキスト / `AddSymbol` | |
| WIND-11 | ホルンのゲシュトップト・開放 | `<technical><stopped/></technical>`、`<open/>`、`<half-muted/>` | `[文献]` 落ちる | `PlusArtic` / `HarmonicArtic` | |
| WIND-12 | 金管のベンド類 | `<articulations><scoop/></articulations>`、`<plop/>`、`<doit/>`、`<falloff/>`（`line-shape` / `line-type` / `line-length`）、`<technical><brass-bend/></technical>`、`<flip/>`、`<smear/>`、`<bend><bend-alter>0.5</bend-alter></bend>` | articulations 側は未知。technical 側は落ちる | `AddLine` / `AddSymbol` | |
| WIND-13 | トリル線 | `<ornaments><trill-mark/></ornaments>` + `<wavy-line type="start"/>` / `stop` | `[文献]` トリルは取り込まれる。波線の長さは未知 | `AddLine` | |
| WIND-14 | 持ち替え | `<instrument>` + `<transpose>` + `<clef>` + `<words>to Picc.</words>` を同位置に（Picc / Fl、Ob / E.Hr、Cl 各調）、4.0 の `<sound><instrument-change>` | 未知。`<instrument-change>` は音源変更の要素であり、記譜上の持ち替えを表す要素ではない | `AddInstrumentChange` | |

### 4.5 鍵盤・ハープ

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| KEY-01 | 大譜表 | `<staves>2</staves>`、`<clef number="1">` / `number="2"`、`<part-symbol top-staff="1" bottom-staff="2">brace</part-symbol>` | `[推測]` 通る | — | |
| KEY-02 | 譜表またぎ | 同一 `<voice>` で `<staff>1</staff>` と `<staff>2</staff>` を行き来 + 共通 `<beam>`、`<backup>` | `[文献]` 複数声部の譜表またぎは誤った譜表に乗ることがある | 音符を移動して連桁修復 | |
| KEY-03 | 譜表をまたぐ和音 | 1つの `<chord/>` を複数譜表に | `[文献]` **正しく取り込まれない** | 1譜表に置いて取り込み後に移動 | |
| KEY-04 | ペダル | `<pedal type="start" line="yes" sign="no"/>`、`stop`、`change`、`continue`、`sostenuto`、`number="2"`、`abbreviated`、`<words>una corda</words>` / `tre corde` | 未知 | `AddLine` | |
| KEY-05 | クラスター | `<notehead>cluster</notehead>` + 和音、白鍵／黒鍵を `<words>` で | 未知 | `AddSymbol` | |
| KEY-06 | 内部奏法 | テキスト + 符頭 | `[推測]` 通る | — | |
| KEY-07 | ハープのペダル図 | `<harp-pedals><pedal-tuning><pedal-step>D</pedal-step><pedal-alter>-1</pedal-alter></pedal-tuning>…</harp-pedals>` | 未知 | 手動 | |
| KEY-08 | ハープの奏法 | près de la table / bisbigliando / étouffé をテキストで、ハーモニクス ○、グリッサンド + ペダル設定テキスト | ○は `[文献]` 落ちる | `HarmonicArtic` | |
| KEY-09 | オッターヴァ | `<octave-shift type="down" size="8" number="1"/>` + `type="stop"`（`down` が通常の 8va。方向を取り違えない）、`type="up"`、`size="15"`、`type="continue"`、大譜表の片側だけ、重なり、四分音との併用 | 未知。音高の二重変更に注意 | `AddLine`（ottava） | |

### 4.6 強弱・テキスト・テンポ

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| DYN-01 | 基本強弱 | `<direction><direction-type><dynamics><p/></dynamics></direction-type></direction>`。`ppp`〜`fff` | `[推測]` 通る。Expression スタイルに入るか | `AddText(…, "Expression")` | |
| DYN-02 | 極端・複合強弱 | `<pppp/>`〜`<pppppp/>`、`<ffff/>`〜`<ffffff/>`、`<sf/>` / `<sfp/>` / `<sfpp/>` / `<sfz/>` / `<sffz/>` / `<fp/>` / `<rf/>` / `<rfz/>` / `<fz/>` / `<pf/>` / `<sfzp/>`、`<n/>`、`<other-dynamics>` | 未知 | テキスト | |
| DYN-03 | 音符付属の強弱 | `<notations><dynamics><p/></dynamics></notations>` vs direction | 未知 | direction に統一 | |
| DYN-04 | 配置・声部・譜表 | `<direction placement="above">` / `below` + `<staff>` / `<voice>`、大譜表の中央 | 未知 | 明示して配置 | |
| DYN-05 | ヘアピン基本 | `<wedge type="crescendo" number="1"/>` + `<wedge type="stop" number="1"/>`、`diminuendo` | `[推測]` 通る | `AddLine("line.staff.hairpin.crescendo")` | |
| DYN-06 | niente | `<wedge type="crescendo" niente="yes"/>`、dim. の終端 `<wedge type="stop" niente="yes"/>`（開始側に付けない） | 未知 | niente 用の線 | |
| DYN-07 | ヘアピンの属性・重なり・またぎ | `spread`、`line-type="dashed"`、別 `number` で重なり、`type="continue"`、小節・段・ページまたぎ、短い `< >`、休符上 | 未知 | 線を再作成 | |
| DYN-08 | テキスト強弱と延長線 | `<words>cresc. poco a poco</words>` + `<dashes type="start"/>`、`rit.` / `accel.` + `<dashes>` / `<bracket>` | 未知 | `AddLine` | |
| DYN-09 | テキストのスタイル振り分け | `<words font-style="italic">espressivo</words>`、`font-weight="bold"`、`font-size`、`font-family`、正体の奏法テキスト | `[推測]` テキストは通る。Expression / Technique / Tempo のどれに入るか | スタイルを指定して作り直し | |
| DYN-10 | 複合テキスト | 1つの `<direction-type>` に複数 `<words>`、部分的なフォント変更、`<words>sub.</words>` + `<dynamics><p/>` | 未知 | 1つのテキストにまとめる | |
| DYN-11 | 囲み・整列 | `<words justify="center" halign="center" valign="baseline" enclosure="rectangle">` | 未知 | スタイル調整 | |
| DYN-12 | オフセット | `<offset>` の正負、音符のない時点のテキスト | 未知 | 位置を修正 | |
| DYN-13 | システムテキスト | 4.0 の `<direction system="only-top">` / `also-top` / `none`、`directive="yes"`（整列の属性であってシステムテキスト指定ではない）、全パートに複製した版 vs 最上パートだけの版 | `[文献]` メトロノーム記号は最上パートの最上段しか読まない | System text を作り直し | |
| DYN-14 | 音楽記号入りテキスト | `<words>` + `<symbol>accidentalQuarterToneSharpStein</symbol>` の混在 | `[文献]` Symbols は取り込まれない | 音楽テキストで手動 | |
| DYN-15 | メトロノーム基本 | `<metronome><beat-unit>quarter</beat-unit><per-minute>60</per-minute></metronome>` | `[推測]` 通る。位置は Sibelius 既定 `[文献]` | — | |
| DYN-16 | メトロノームの変種 | `<beat-unit-dot/>`、`<per-minute>60-66</per-minute>`、`<metronome parentheses="yes">`、`<beat-unit>` = `<beat-unit>` のメトリック・モジュレーション、`<metronome-note>` / `<metronome-relation>` / `<metronome-tuplet>`、`<beat-unit-tied>` / `<metronome-arrows>` | `[文献]` 256分・128分・64分・倍全音符入りは落ちる。他は未知 | 音楽テキスト | |
| DYN-17 | `<sound tempo>` の影響 | `<sound tempo="60"/>` だけ／`<metronome>` だけ／両方 | 未知 | 印刷用は必ず `<metronome>` | |
| DYN-18 | リハーサルマーク | `<rehearsal enclosure="square">A</rehearsal>`、数字、複数文字 | `[文献・原典未確認]` 2024.10 で改善 | `AddRehearsalMark` | |
| DYN-19 | 主声部記号 | `<principal-voice type="start" symbol="Hauptstimme">H</principal-voice>`、`Nebenstimme`、`stop` | 未知 | `AddSymbol` | |
| DYN-20 | その他の direction | `<other-direction>`、`<other-notation type="single">` | `[文献・原典未確認]` 6.1 では Comment になる | 使わない | |
| DYN-21 | アーティキュレーション | `<articulations>` 内の `<accent/>`、`<strong-accent type="up"/>`、`<staccato/>`、`<staccatissimo/>`、`<tenuto/>`、`<detached-legato/>`、`<spiccato/>`、`<stress/>`、`<unstress/>`、`<soft-accent/>`、積み重ね | `[文献]` 一部が反対側に付く | `SetArticulation` | |
| DYN-22 | フェルマータ | `<fermata type="upright">normal</fermata>`、`inverted`、`angled` / `square` / `double-angled` / `double-square` / `half-curve` / `curlew`、小節線上 | 未知 | `PauseArtic` / `SquarePauseArtic` / `TriPauseArtic` | |
| DYN-23 | Unicode | テキスト中の é / ü / ß / ♭ / ♯ / → / ≈ / non-breaking space | 未知 | フォント統一 | |

### 4.7 リズム・連符・連桁・装飾音・休符

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| RHY-01 | 基本音価 | `<divisions>`、`<duration>`、`<type>`、`<dot/>`。見た目に加えて小節長と開始位置を照合 | `[推測]` 通る | — | |
| RHY-02 | 特殊音価 | 複付点・三重付点、`<type>breve</type>`、`long`、`128th` / `256th` / `512th` / `1024th` | 未知 | 分割 | |
| RHY-03 | divisions | 大きい値（例 10080）、パート・小節ごとの変更 | 未知 | 文書内で一定にする | |
| RHY-04 | 多声部の時間位置 | `<backup>` / `<forward>` / `<voice>` / `<staff>`、隠れ休符 | `[文献]` 余分な休符は自動で消す | 声部ごとに整列 | |
| RHY-05 | 単純連符 | `<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification>` + `<tuplet type="start"/>` / `stop` | `[推測]` 通る | `AddNestedTuplet` | |
| RHY-06 | 複雑な比率 | 5:4、7:4、7:6、11:8、13:8、`<normal-type>` / `<normal-dot/>`、`<tuplet-actual>` / `<tuplet-normal>` 内の `<tuplet-number>` / `<tuplet-type>` / `<tuplet-dot/>` | 未知 | 手動 | |
| RHY-07 | 入れ子連符 | `<tuplet number="1">` と `number="2"`、累積比率の `<time-modification>` | 未知 | `AddNestedTuplet` | |
| RHY-08 | 連符の表示属性 | `bracket="yes"` / `no`、`show-number="actual"` / `both` / `none`、`show-type`、`placement`、`line-shape` | 未知 | 表示オプション | |
| RHY-09 | 連符の中身と境界 | 休符・和音・タイ・装飾音・トレモロを含む、小節線・段・ページまたぎ | 未知 | 最小例へ分解 | |
| RHY-10 | 明示連桁 | `<beam number="1">begin</beam>` / `continue` / `end`、`<supports element="beam" type="yes">` の有無 | `[推測]` 通る。拍子で引き直すか | Beaming 再設定 | |
| RHY-11 | 二次連桁・フック | `<beam number="2">`、`forward hook` / `backward hook` | `[文献]` **Sub-beams は取り込まれない** | 手動 | |
| RHY-12 | 羽根連桁 | `<beam number="1" fan="accel">begin</beam>`、`fan="rit"`、`fan="none"`、群の途中で方向反転 | 未知 | Feathered beam を手動 | |
| RHY-13 | 連桁の特殊ケース | 休符をまたぐ、小節をまたぐ、装飾音の連桁、異音価混在 | 未知 | 修復 | |
| RHY-14 | 符尾 | `<stem>up</stem>` / `down` / `none` / `double`、`default-y` | 未知 | `StemlessNoteStyle` 等 | |
| RHY-15 | 装飾音 | `<grace slash="yes"/>` / `no`、複数、装飾和音、小節線前後、`<grace make-time>` / `steal-time-*`、装飾音内の四分音 | `[推測]` 基本は通る | `AddAcciaccaturaBefore` | |
| RHY-16 | キュー音符 | `<cue/>`、`<type size="cue">`、`<grace/>` + `<cue/>` | 未知 | `CueNoteStyle` | |
| RHY-17 | 休符 | `<rest measure="yes"/>`、通常 `<rest/>`、`<rest><display-step>…</display-step><display-octave>…</display-octave></rest>`、`print-object="no"` | 未知 | 再設定 | |
| RHY-18 | 非表示・符頭なし | `<note print-object="no" print-spacing="yes">` / `print-spacing="no"`、`<notehead>none</notehead>` | 未知 | `HeadlessNoteStyle` / `SilentNoteStyle` | |
| RHY-19 | 拍子 | 毎小節の変拍子、5/8・7/16、`<beats>3+2+3</beats><beat-type>8</beat-type>`、複数の `<beats>` / `<beat-type>` 対、`<time symbol="common">` / `cut` / `single-number`、`<interchangeable>` | 未知 | `AddTimeSignature` | |
| RHY-20 | 非拍節 | `<time><senza-misura/></time>`、無符尾音、非表示小節線、任意長の小節 | 未知 | 隠した拍子で表現 | |
| RHY-21 | ポリメーター | 譜表ごとに異なる `<time>` | 未知。想定外だが挙動を知る | 共通格子 + 局所記号 | |
| RHY-22 | 小節線 | `<barline location="right"><bar-style>light-light</bar-style></barline>`、`light-heavy`、`dashed`、`dotted`、`heavy`、`heavy-light`、`heavy-heavy`、`tick`、`short`、`none`、`location="middle"`、譜表ごとに異なる小節線 | `[文献]` heavy 系は落ちる。譜表ごとに違えば最上段を使う | `AddSpecialBarline` | |
| RHY-23 | 小節番号・弱起 | `<measure number="0" implicit="yes">`、重複番号、`text` 属性、途中からの番号 | 未知 | `AddBarNumber` | |
| RHY-24 | 複数小節休符・反復記号 | `<measure-style><multiple-rest>4</multiple-rest></measure-style>`、`<measure-repeat>`、`<beat-repeat>`、`<slash>` | `[文献・原典未確認]` 2024.10 で multirest 改善 | 再設定 | |
| RHY-25 | 偶然性の枠 | `<bracket>` + `<other-notation>` + `<words>` + 非表示音符 | 未知 | カスタム線・図形 | |

### 4.8 タイ・スラー・線

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| LINE-01 | タイ | `<tie>` + `<tied>`、`<tied type="continue">`、`<tied type="let-ring"/>`、和音の一部だけ、段またぎ | 未知（let-ring は 3.1） | タイ再設定 | |
| LINE-02 | スラー | `<slur type="start" number="1"/>` / `stop`、重なり、入れ子、声部間、譜表またぎ、`line-type="dashed"`、`placement` / `orientation` / `bezier-*` | `[文献]` `continue` / `position` / `bezier` / `placement` / `orientation` は落ちる | 再接続 | |
| LINE-03 | 汎用の線 | `<bracket type="start" line-end="down" line-type="solid">`、`line-end="arrow"`、`<dashes>` | 未知 | `AddLine` | |
| LINE-04 | 段・ページの分割指定 | `<print new-system="yes"/>`、`new-page="yes"`、`page-number`、`blank-page`、全パートの同位置に揃えた版、`<supports element="print" attribute="new-system">` | 取り込みダイアログの Use layout and formatting と連動 `[文献]` | Lock Format | |

### 4.9 編成・グループ・移調・譜表設定

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| PART-01 | パート構造 | `<part-list>`、`<score-part id>`、対応する `<part id>`、順序、空パート | `[推測]` 通る | — | |
| PART-02 | パート名 | `<part-name>` / `<part-abbreviation>`、`<part-name-display><display-text>Clarinet in B</display-text><accidental-text>flat</accidental-text></part-name-display>`、`<part-abbreviation-display>` | `[文献・原典未確認]` 2024.10 で名前の認識改善。♭ の出方は未知 | 手動修正 | |
| PART-03 | 楽器の当て方 | `<score-instrument><instrument-name>` / `<instrument-sound>wind.reed.clarinet.bflat</instrument-sound>` / `<solo/>` / `<ensemble>`、Let Sibelius choose instruments のオン／オフ | `[文献]` オフにすると手で割り当てるダイアログ | 手で割り当て | |
| PART-04 | 同種楽器の分け方 | Fl 1–3 を個別パート／1譜表にまとめる両方式 | 未知 | 印刷譜表の対応を固定 | |
| PART-05 | 弦の人数・ディヴィジ譜表 | `<part-name>`、`<ensemble>`、ディヴィジ用の譜表 | 未知。人数から譜表が自動構成されるとは期待しない | 元モデルで確定 | |
| PART-06 | ハープ・鍵盤 ×2 | 各々独立 `<score-part>` + `<staves>2</staves>` | 未知 | テンプレートで明示 | |
| PART-07 | パートグループ | `<part-group type="start" number="1"><group-symbol>bracket</group-symbol></part-group>` + `stop`、`brace` / `square` / `line` / `none`、入れ子、`<group-name>` / `<group-abbreviation>`、`<group-barline>yes</group-barline>` / `no` / `Mensurstrich` | `[文献・原典未確認]` 6.1 で `<part-group>` 取り込み追加 | `AddBracket` | |
| PART-08 | 番号つき属性 | `<clef number="1">`、`<key number="1">`、`<time number="1">`、`<transpose number="1">` と `number="2"` | 未知 | 譜表別に修正 | |
| PART-09 | 移調 | `<transpose><diatonic>…</diatonic><chromatic>…</chromatic><octave-change>…</octave-change></transpose>`（値は記譜音に足して実音を得る量。B♭ 管は −2、F 管は −7）、全移調楽器で written / concert を比較 | `[推測]` 通る | 楽器と移調を適用 | |
| PART-10 | 4.0 の concert-score 方式 | `<defaults><concert-score/></defaults>` + `<for-part><part-transpose>…</part-transpose></for-part>`、`<part-clef>` | `[文献]` 3.0 以降の新機能は取り込まれない | 従来方式を基準 | |
| PART-11 | 音部記号 | `<clef><sign>G</sign><line>2</line></clef>`、F / C（alto, tenor）、`<clef-octave-change>`、小節途中、`additional="yes"`、`after-barline="yes"`、`print-object="no"` | `[文献]` 小節頭と小節末を区別できない | `AddClef` | |
| PART-12 | 譜表の種類・大きさ | `<staff-type>cue</staff-type>` / `ossia` / `regular`、`<staff-size>`、`<staff-details print-object="no">` → 後で `yes` | `[文献]` 譜表タイプの変更は落ちる | 手動 | |

### 4.10 レイアウト・印刷

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| LAY-01 | 縮尺・用紙 | `<defaults><scaling><millimeters>…</millimeters><tenths>40</tenths></scaling></defaults>`、`<page-layout><page-height>` / `<page-width>`、`<page-margins type="both">` / `odd` / `even` | `[文献]` 1つのページサイズのみ。`[文献・原典未確認]` 2024.10 で余白改善 | Document Setup | |
| LAY-02 | 段・譜表の間隔 | `<system-layout><system-margins>` / `<system-distance>` / `<top-system-distance>`、`<staff-layout number="…"><staff-distance>` | 未知 | 手動 | |
| LAY-03 | 位置ヒント | `<measure width="…">`、`default-x` / `default-y` / `relative-x` / `relative-y` / `placement` の優先関係 | 未知 | Sibelius 側で調整 | |
| LAY-04 | 外観 | `<appearance><line-width type="…">` / `<note-size type="cue">` / `<distance type="…">`、`<music-font>` / `<word-font>`、局所 `font-family` | 未知 | House Style | |
| LAY-05 | 段区切り記号・小節番号の頻度 | `<system-dividers>`、`<measure-numbering>system</measure-numbering>` / `measure` / `none` | 未知 | 設定 | |
| LAY-06 | クレジット | `<credit page="1"><credit-words>…</credit-words></credit>`、複数ページのヘッダ・フッタ | 未知 | Title / Header / Footer | |
| LAY-07 | 可視性属性 | `color`、`print-object`、`print-dot`、`print-leger` | 未知 | 校正 | |
| LAY-08 | 実編成での密度 | 全編成、最大ディヴィジ、密集した四分音和音、奏法テキスト、譜表またぎが同一ページ | 未知 | 譜表サイズ・段数・改ページを設計 | |
| LAY-09 | 取り込み設定の比較 | 同一入力で Use page and staff size / Use layout and formatting の各オン・オフ、House style の指定あり・なし | `[文献]` 選択肢の存在 | 内容取り込みと本番レイアウトを二段階に分ける | |
| LAY-10 | 最終出力 | PDF 書き出し後の再オープン、実寸紙出力、両面 | 未知 | フォント・線幅・余白を修正 | |

### 4.11 匿名性・言語

規定（[`../competition.md`](../competition.md)）の「作曲者名を書かない」「英・仏・独・伊のみ」を合格基準にする。
テストでは実名を使わず `TEST_COMPOSER` 等の目印文字列を使う。

| ID | 検証すること | MusicXML | 見込み | 経路 B | 結果 |
| --- | --- | --- | --- | --- | --- |
| META-01 | creator の転記先 | `<identification><creator type="composer">TEST_COMPOSER</creator></identification>`、`arranger` / `lyricist`、複数 | 未知。Score Info・可視テキスト・ヘッダのワイルドカード | 本番では `<creator>` を出さない | |
| META-02 | encoding・rights 等 | `<encoding><encoder>TEST_ENCODER</encoder><software>…</software><encoding-date>…</encoding-date>`、`<rights>`、`<source>`、`<miscellaneous-field name="…">` | 未知 | 個人識別情報を出さない | |
| META-03 | パート単位の identification | `<score-part><identification>…</identification></score-part>` | 未知 | 除去 | |
| META-04 | タイトル類 | `<work><work-title>`、`<work-number>`、`<movement-title>`、`<movement-number>` | 未知 | 作品名だけに統一 | |
| META-05 | credit 由来の名前 | `<credit><credit-type>composer</credit-type><credit-words>TEST_COMPOSER</credit-words></credit>`、`<credit-image>` | 未知 | 全 credit を監査 | |
| META-06 | 言語属性 | `<words xml:lang="en">` / `fr` / `de` / `it` | 未知。`xml:lang` だけで言語適合を判定しない | 表示内容を校正 | |
| META-07 | ワイルドカードの展開 | `<credit-words>` に Sibelius のワイルドカードに似た文字列（`\$Composer\` 等） | 未知 | 除去 | |
| META-08 | 隠れた注記 | `<footnote>`、`<level>`、XML コメント、`<other-direction>`（Comment になりうる） | `[文献・原典未確認]` | 本番から除去。Comments も確認 | |
| META-09 | リンク・パス | `<link xlink:href>`、`<bookmark>`、`<image source>`、`.mxl` 内のファイル名 | 未知 | 中立な名前 | |
| META-10 | テンプレート側の残留 | creator を完全省略した MusicXML を本番テンプレートに取り込む。テンプレートの Composer / Copyright / Header | 未知 | 匿名化済みテンプレートを確定 | |
| META-11 | **`.sib` と PDF のメタデータ** | 最終 `.sib` の Score Info・Comments・Versions、PDF の Author / Title / Subject / Keywords / XMP。**OS のユーザ名が Author に入らないか** | 未知 | 匿名化した作業コピーから PDF を作り、メタデータを検査 | |

### 4.12 方法・経路・形式

| ID | 検証すること | 内容 | 見込み | 結果 |
| --- | --- | --- | --- | --- |
| METHOD-01 | 最小の基準入力 | `<score-partwise version="3.1">`、最小の `<part-list>`、1パート数小節。**開けることだけを合格にしない** | `[推測]` 通る | |
| METHOD-02 | バージョン宣言 | 同一内容を `version="3.0"` / `3.1` / `4.0` の各スキーマに適合させた文書。宣言だけ変えて中身に非対応要素を残した文書は比較に使わない | `[文献]` 3.0 ベース、将来版は新機能を落とす | |
| METHOD-03 | partwise / timewise | `<score-timewise>` と同値の `<score-partwise>` | `[文献]` partwise のみ | |
| METHOD-04 | XML 宣言・DOCTYPE・BOM | あり／なし、UTF-8 | 未知 | |
| METHOD-05 | `<supports>` | `<encoding><supports element="accidental" type="yes"/>`、`beam`、`stem`、`print`（attribute="new-system"）あり／なし | 未知。Dolet 系はこれで信用する要素を切り替える慣習 | |
| METHOD-06 | File > Open と File > Import | 同一ファイルを両経路で。楽器割当・House Style・声部・レイアウトの差 | `[文献・原典未確認]` 2020.6 で Import が拡張 | |
| METHOD-07 | 取り込みダイアログの全設定 | LAY-09 と同じ。設定と結果を毎回記録 | `[文献]` | |
| METHOD-08 | 拡張子・圧縮 | `.musicxml` / `.xml` / `.mxl`（`META-INF/container.xml` の `<rootfile full-path="…" media-type="application/vnd.recordare.musicxml+xml"/>`）。`.mxl` 内の画像・相対パス | `[推測]` 同じ XML なら記譜は変わらない。`[文献・原典未確認]` File > Import の `.mxl` は 2024.10 から | |
| METHOD-09 | 再書き出しの diff | 取り込み直後に Sibelius から MusicXML を再書き出しして入力と比較。Dolet 8 があれば両方 | 補助証拠にとどめる（5.5節） | |
| METHOD-10 | ManuScript による読み出し | 取り込み後の Note / Text / Line を ManuScript でダンプ | `[文献]` `Accidental`、`NoteStyle`、`IsAccidentalVisible` 等が読める | |
| METHOD-11 | 保存・再オープン | 取り込み → 保存 → 終了 → 再オープン → PDF | 未知 | |
| METHOD-12 | 3層の相互作用 | 一要因版 → カテゴリ集約版 → 複合版 → 全編成版 | — | |
| METHOD-13 | 版の比較 | 同一 XML を複数の Sibelius ビルドで（24.3.1 と更新後） | 未知 | |
| METHOD-14 | 事前の妥当性検証 | Sibelius 同梱の `musicxml.xsd`（4.0）と `xmllint --schema` で取り込み前に検証し、自分の書き損じと Sibelius の癖を切り分ける | — | |
| METHOD-15 | 第二の描画器 | Verovio（npm 経由）または MuseScore で同じ XML を描き、「XML は正しいのに Sibelius が落とす」ことを確認する | — | |
| METHOD-17 | 逆方向プローブ | 5.3節 | — | |
| METHOD-18 | 経路 B の前提 (a) | `<words>` マーカーが小節・譜表・声部・小節内位置を保って取り込まれるか | `[推測]` 通る | |
| METHOD-19 | 経路 B の前提 (b) | 音符を消して `AddNote` で作り直したとき、タイ・スラー・連桁・連符・アーティキュレーションが壊れないか | 未知 | |
| METHOD-20 | 経路 B の前提 (c) | `SupportHalfSemitonePitchValues` の上で作った四分音の音符に、Sibelius が正しい臨時記号を描くか。綴り（diatonic pitch）の指定が効くか | `[文献]` API はある。描画は未知 | |
| METHOD-21 | 経路 B の冪等性 | 修復プラグインを1回／2回実行して二重記号・重複線・累積移動が出ないか | — | |
| METHOD-22 | 修復後の耐性 | 修復後に Respace、改ページ、Concert Pitch 切り替えを行っても保たれるか | 未知 | |

---

## 5. 方法

### 5.1 テストファイルの構成（3層）

1. **一要因の最小ファイル。** 1パート、1〜4小節。対照音 → 対象の構文 → 対照音の順に置く。
   タイ・改行・状態の継承を見る項目だけ必要な長さに伸ばす。
   例: QT-03 は C natural → C quarter-sharp → 次小節の C natural
2. **カテゴリ別の集約ファイル。** 四分音一覧、符頭一覧、ハーモニクス一覧。字形と間隔を横並びで比べる。最小例が通ってから
3. **相互作用・実編成ファイル。** 本番相当の楽器数、ディヴィジ、密度、改ページ、長い休符、持ち替え

各ケースの前提は明示的にリセットする。とくに `<transpose>`、`<key>`、`<clef>`、`<staff-details>`、`<divisions>`、
ペダル、オッターヴァ、ヘアピンの終了漏れで次のケースを汚さない。

**ID の規則:** 表の ID を親にして `QT-03-C4`、`QT-03-system-break` のように派生させる。
**各小節にテキストで ID と期待結果を書いておき**、スクリーンショットが自己記述になるようにする。
テキスト自体が落ちても特定できるよう、パート番号・小節通し番号・時点でも対応づける。

四分音は最低限、次を広く展開する: C〜B の全音名 × 正負の四分音・四分音3つ分 × 複数 octave、
単音・和音・同度異音・複数声部、小節内反復・小節またぎ・段またぎ、Cl・Hr・E.Hr・octave 移調楽器、
ハーモニクス・キュー・装飾音・譜表またぎ。

### 5.2 観測の軸

1つの「成功／失敗」ではなく、次の軸で記録する。exporter の設計に直接使える。

| 軸 | 記録すること |
| --- | --- |
| 時間 | パート、譜表、声部、開始位置、音価、小節長、連符比率 |
| 記譜音 | step、octave、四分音の方向、異名同音の綴り |
| 表示記号 | 正式な臨時記号／符頭／アーティキュレーション／Symbol／Text のどれになったか |
| 接続 | タイ・スラー・グリッサンド・ヘアピンの始点と終点 |
| 可視性 | 表示・非表示・括弧・注意的記号 |
| 幾何 | 譜表位置、衝突、段またぎ、PDF 上の大きさ |
| 修復 | 経路 B で直せるか、手作業か、修復後の再検査、所要時間 |

観測手段: 元モデル由来の期待値 / Sibelius で手入力した少数の基準譜 / 同じ zoom・ページ・フォントでのスクリーンショット
（オブジェクトを選択して種類も確認）/ PDF（実寸・拡大・紙）/ ManuScript ダンプ / 再書き出しの MusicXML（補助）。

似た字形が印刷されていても、それが Text なら四分音の合格条件を満たさない。
再生用の MIDI 音高だけを比較しても、正式な臨時記号の有無は判別できない。

### 5.3 逆方向プローブ（最初にやる）

Sibelius 自身の MusicXML 方言を知る最短の方法。余湖さんの手作業が要る。

1. Sibelius で新規スコアを作る。譜表: Flute / Clarinet in B♭ / Horn in F / Timpani / Percussion（1線）/ Violin / Piano
2. 手で入力する:
   四分音（Keypad の臨時記号レイアウトの quarter-sharp / quarter-flat / three-quarter 系、C・D・F の各音）、
   矢印つき臨時記号（Symbols から）、自然ハーモニクス（菱形符頭）、人工ハーモニクス（2音和音）、○記号、
   Bartók ピツィカート記号、3本斜線のトレモロ、2音間トレモロ、無音高打楽器の X 符頭、l.v. タイ、
   niente つきヘアピン、羽根連桁、`sul pont.` の Technique テキスト、`espress.` の Expression テキスト、
   楽器変更（Fl → Picc）、オッターヴァ線
3. File > Export > MusicXML で**非圧縮**の `.musicxml` に書き出す。あわせて `.sib` と PDF も残す
4. Claude が書き出された XML を読み、Sibelius がそれぞれを**どの要素・どの値で表現するか**を記録する

Sibelius が書き出せるものは、同じ形で読める可能性が高い（`[推測]`。取り込みと書き出しは別実装なので保証ではない）。
書き出しで消えたものは、取り込みでも期待しない。

### 5.4 ManuScript ダンププラグイン

Claude が書き、余湖さんが実行する。取り込み後のスコアを走査し、音符ごとに
`Pitch` / `Accidental` / `WrittenAccidental` / `DiatonicPitch` / `NoteStyle` / `IsAccidentalVisible` / `AccidentalStyle` /
アーティキュレーション / `SingleTremolos` / `DoubleTremolos`、テキストごとに内容とスタイル名、線ごとに種類を
テキストファイルに書き出す（`Sibelius.CreateTextFile` / `AppendTextFile`）。
`SetInterpreterOption(SupportHalfSemitonePitchValues)` を有効にして四分音を読む。
目視より客観的で、diff が取れる。

### 5.5 再書き出し diff の落とし穴

往復一致を唯一の判定にしない。

- `<divisions>` と `<duration>` が違っても比率が同じなら同じ時間
- XML ID、voice 番号、子要素の順序、既定値の明示・省略は変わりうる。意味の差分と分ける
- 同じ見た目が `<accidental>` / `<accidental-mark>` / Symbol / Text の別表現になっている場合を区別する
- 「出力にない」は、取り込みで失われたのか exporter が出せないのか区別できない。「出力にある」も、元のオブジェクトか見た目からの再構成か区別できない
- Dolet 8 の出力も ManuScript の公開情報に制約される `[文献・原典未確認]`
- 2回目の取り込みまで行うと新たな変換が加わる。最初の取り込み結果の評価と混ぜない

### 5.6 記録すること

Sibelius の完全な版とビルド / OS / File > Open か Import か / Manuscript Paper・House Style・音楽フォント・テキストフォント /
取り込みダイアログの全設定と楽器割当 / 取り込み直後か Respace 後か保存再オープン後か / 内蔵 exporter か Dolet か / PDF の生成経路と紙面寸法。

### 5.7 判定の分類と exporter への反映

| 分類 | exporter への反映 |
| --- | --- |
| 直接保持 | 試験済みの構文をそのまま出す（経路 A） |
| 内容保持、配置修正 | 音楽情報は出し、Sibelius 側で浄書だけ直す |
| 別エンコーディングで保持 | 意味を損なわない代替構文に統一する |
| 決定的な後処理が必要 | 経路 B。元データから対象を特定できる修復処理を設計し、冪等性を試す |
| 手動作業が必要 | 件数と作業時間を把握し、提出前点検表に残す |
| 現行経路では許容不能 | 四分音の消失、音符欠落、誤った移調。本番 export の前に経路を再設計する |

四分音は「後で人が見つけて直す」を既定にしない。欠落した全音を元データから特定して正式な記号に復元できるところまで先に試す。

---

## 6. 余湖さんに決めてもらうこと

- **どの版の Sibelius で検証するか。** 手元は 24.3.1。2024.10 以降の取り込み改善を含めるなら更新してから
- **記譜法の流儀。** Stein-Zimmermann 系と矢印系を両方検証する前提でよいか（決定は結果を見てから。[R12]）。
  逆方向プローブの結果、矢印系は Sibelius の書き出しでも取り込みでも表現できず、ManuScript の `AddSymbol` 頼みになる（2.4節）

Sibelius の UI は英語（`[実測]` プローブの作業メモ）。

## 7. 未取得・未確認

- Sibelius 7 時代のフォーラム回答の原文（Codex 経由）
- 2024.10 / 2025.x / 2026.x の What's New の原文
- File > Import の設定項目の原文（2020.6）
- `Note` オブジェクト単位の削除 API（`NoteRest.Delete()` は和音全体を休符にする）
- ManuScript の Text オブジェクトの位置（小節内オフセット）の読み出し精度
