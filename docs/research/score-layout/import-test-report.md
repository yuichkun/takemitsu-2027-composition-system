# Sibelius 取り込みテスト（体裁）報告

日時: 2026-09-29（JST）、13時台に実施
Sibelius のバージョン: File > Help の About Sibelius Ultimate欄で `Version: 2024.3.1 build 3317, born on 2024-03-19` を確認。

## 共通
- File > Open で既存の fixtures を取り込み、楽譜の浄書修正はしない。
- 取り込みダイアログ: Use page and staff size from MusicXML file=オン、Use layout and formatting from MusicXML file=オン、Let Sibelius choose instruments=オン、Use instrument names from MusicXML file=オン。
- House style: `Podium` と表示、無効。layout and formatting を一時的にオフにしても無効のまま。オンに戻して取り込んだ。指定の `Unchanged` に設定できなかった。
- PNG: 全ページ、150 dpi、Adjust size to improve staves=オフ、Use smallest bounding box=オフ。最初の出力は自動解像度調整が入ったため150 dpiに設定して再出力した。PNGのpHYs=5906 px/m（約150 dpi）を検査。
- Edit Instruments の一覧ダイアログには Cancel がなく Close があるため、編集せず Close で閉じた。
- 再書き出しは内蔵 File > Export > MusicXML、Uncompressed (*.musicxml)。

## 01a-octave-with-transpose
- 警告: 取り込み時に警告・エラーなし。
- 1ページ。
- ステータスバーの共通部分は `Page 1 of 1 Bars: 2`、各行に続く文字を以下に転記。

| 段 | 最初の音符の譜表位置（実音表示） | ステータスバー（共通部分に続く全文） | Edit Instrumentsで対応する楽器名 | Transposing Scoreで変わったか |
|---|---|---|---|---|
| Piccolo | ト音記号、第3間 C5 | Piccolo Bar 1, beat 1 Timecode: 0.0" Pitch: C6 | Piccolo (MusicXML) | 変化なし |
| Bass Clarinet in B♭ (A) | ト音記号、第4線 D5 | Bass Clarinet in B♭ (A) Bar 1, beat 1 Timecode: 0.0" Pitch: D4 | Bass Clarinet in B♭ (A) (MusicXML) | 変化なし |
| Bass Clarinet in B♭ (B) | ヘ音記号、第3線 D3 | Bass Clarinet in B♭ (B) Bar 1, beat 1 Timecode: 0.0" Pitch: D3 | Bass Clarinet in Bb | E4（ヘ音記号の上第2加線）へ上がる。♯2つの調号が付く |
| Contrabassoon | ヘ音記号、第2間 C3 | Contrabassoon Bar 1, beat 1 Timecode: 0.0" Pitch: C2 | Contrabassoon (MusicXML) | 変化なし |
| Glockenspiel | ト音記号、第2線 G4 | Glockenspiel Bar 1, beat 1 Timecode: 0.0" Pitch: G6 | Glockenspiel (MusicXML) | 変化なし |
| Crotales | ト音記号、第3間 C5 | Crotales Bar 1, beat 1 Timecode: 0.0" Pitch: C7 | Crotales (MusicXML) | 変化なし |
| Xylophone | ト音記号、第3間 C5 | Xylophone Bar 1, beat 1 Timecode: 0.0" Pitch: C6 | Xylophone (MusicXML) | 変化なし |
| Celesta 上段 | ト音記号、第3間 C5 | Celesta (a) Bar 1, beat 1 Timecode: 0.0" Pitch: C6 | Celesta (MusicXML) | 変化なし |
| Celesta 下段 | ヘ音記号、第2間 C3（2分音符） | Celesta (b) Bar 1, beat 1 Timecode: 0.0" Pitch: C4 | Celesta (MusicXML) | 変化なし |
| Double Bass | ヘ音記号、第2間 C3 | Double Bass Bar 1, beat 1 Timecode: 0.0" Pitch: C2 | Double Bass (MusicXML) | 変化なし |

- Bass Clarinet (A) の対応する一覧位置は Singers ファミリー。B は Woodwind。
- Edit Instruments の一覧では、以前見た行も灰色で残って見える場合がある。対象小節を選択して開いた際の対応行と名前を記録した。
- READMEは各段に四分音符4つとするが、Celesta下段は二分音符2つだった。
- 成果物: `01a-octave-with-transpose/page.png`, `transposing-page.png`, `reexport.musicxml`。

## 01b-octave-without-transpose
- 警告: なし。1ページ。
- ステータスバーの共通部分は `Page 1 of 1 Bars: 2`。

| 段 | 最初の音符の譜表位置 | ステータスバー（共通部分に続く全文） | Edit Instrumentsの対応行 | Transposing Score |
|---|---|---|---|---|
| Piccolo | ト音記号、下第1加線 C4 | Piccolo Bar 1, beat 1 Timecode: 0.0" Pitch: C5 | Piccolo | 変化なし |
| Bass Clarinet in B♭ (A) | ト音記号、第4線 D5 | Bass Clarinet in B♭ (A) Bar 1, beat 1 Timecode: 0.0" Pitch: D5 | Bass（Singers） | 変化なし |
| Bass Clarinet in B♭ (B) | ヘ音記号、第3線 D3 | Bass Clarinet in B♭ (B) Bar 1, beat 1 Timecode: 0.0" Pitch: D3 | Bass Clarinet in Bb | E4へ上がり、♯2つの調号が付く |
| Contrabassoon | ヘ音記号、上第1加線 C4 | Contrabassoon Bar 1, beat 1 Timecode: 0.0" Pitch: C3 | Contrabassoon | 変化なし |
| Glockenspiel | ト音記号、下第6加線 G2 | Glockenspiel Bar 1, beat 1 Timecode: 0.0" Pitch: G4 | Glockenspiel | 変化なし |
| Crotales | ト音記号、下第4加線の下 C3 | Crotales Bar 1, beat 1 Timecode: 0.0" Pitch: C5 | Crotales | 変化なし |
| Xylophone | ト音記号、下第1加線 C4 | Xylophone Bar 1, beat 1 Timecode: 0.0" Pitch: C5 | Xylophone | 変化なし |
| Celesta 上段 | ト音記号、下第1加線 C4 | Celesta (a) Bar 1, beat 1 Timecode: 0.0" Pitch: C5 Notehead: Normal (0) | Celesta | 変化なし |
| Celesta 下段 | ヘ音記号、下第2加線 C2 | Celesta (b) Bar 1, beat 1 Timecode: 0.0" Pitch: C3 Notehead: Normal (0) | Celesta | 変化なし |
| Double Bass | ヘ音記号、上第1加線 C4 | Double Bass Bar 1, beat 1 Timecode: 0.0" Pitch: C3 | Contrabass | 変化なし |

- 01aに比べ、オクターヴ楽器の記譜位置・ステータスの実音の両方が変わった。Piccolo/Glockenspiel/Crotalesなどは赤い音域外表示がある。
- 成果物: `01b-octave-without-transpose/page.png`, `transposing-page.png`, `reexport.musicxml`。

## 02a-identity-with-instrument
- 警告: なし。1ページに40譜表が詰まり、木管・金管・打楽器・弦の名前、五線、音部記号が著しく重なる。配置は修正していない。
- Edit Instrumentsで確認した「MusicXML」付き名: Piccolo (MusicXML), Contrabassoon (MusicXML), Glockenspiel (MusicXML), Xylophone (MusicXML), Crotales (MusicXML), Celesta (MusicXML), Double Bass (MusicXML), Snare Drum (MusicXML), Bass Drum (MusicXML), Suspended Cymbal (MusicXML), Tam-tam (MusicXML), Triangle (MusicXML), Wood Block (MusicXML)。木管、金管、オーケストラ打楽器、その他打楽器、有音高打楽器、鍵盤、弦の関連一覧を確認した。
- 段の名前: 元ファイルと異なる名前は確認されなかった。画像では重なりが多いため、全36パートのpart-nameが再書き出しで元と一致することも補助確認した。
- 1線譜: Bass Drum, Suspended Cymbal, Tam-tam, Triangle, Wood Blockは各1線に見える。Snare Drumは前後の五線との重なりが激しく、画像だけでは線の所属を厳密に判断できない。再書き出しのstaff-linesも補助確認する。
- 再書き出し済み。楽器名そのものと、再書き出しのscore-instrument/instrument-nameは同じ表記とは限らない（例: UIのDouble Bass (MusicXML) → XMLのContrabass (2)）。

## 02b-identity-names-only
- 警告: なし。1ページ、40譜表。02a同様、名前・音部記号・五線が大きく重なる。
- Edit Instrumentsで見つけたMusicXML付き名は02aと同じ13種類。木管、無音高打楽器、有音高打楽器、その他打楽器、鍵盤、弦の一覧を確認した。
- 段の表示名には元と異なる名前は見つからない。再書き出しでも表示用part-nameは保持。
- 指定の6打楽器は再書き出しで全てstaff-lines=1。画像では隣の譜表が重なり、特にSnare Drumは視覚だけでは線の所属を判断しづらい。
- **表示名が保たれても認識される楽器は変わる。** 再書き出しscore-instrumentの比較（補助証拠）:
  - Clarinet 1 in B♭: 02a=Clarinet in B^b、02b=Clarinet in A。
  - Clarinet in E♭: 02a=Clarinet in E^b、02b=Clarinet in A。
  - Bass Clarinet in B♭: 02a=Bass Clarinet\\n\\in B^b (2)、02b=Bass (2)。
  - Horn 1 in F: 02a=Horn in F (2)、02b=Horn in D。
  - Trumpet 1 in B♭: 02a=Trumpet in B^b (2)、02b=Trumpet in A。
  - 音色定義などにも差があるため、正確な情報は両方のreexport.musicxmlを参照。
- 02a/02bとも指定6打楽器のstaff-lines=1を補助確認した。

## 03a-brackets / 03b-no-groups
- 両方とも警告なし、1ページ。タイトル以外、括弧・譜表配置・小節線の見た目は同じ。

| 確認範囲 | 03a | 03b |
|---|---|---|
| Flute 1–2 | 専用の副括弧なし | 同左 |
| Oboe 1–2 | 専用の副括弧なし | 同左 |
| Flute 1〜Oboe 2 | 太い括弧 | 同左 |
| Horn 1–4 | 太い括弧 | 同左 |
| Timpani〜Vibraphone | 両方を覆う括弧なし。Timpaniだけに太い括弧 | 同左 |
| Harp 1 | 上下段に波括弧 | 同左 |
| Harp 2 | 上下段に波括弧 | 同左 |
| Harp 1〜Harp 2 | 二つをまとめる括弧なし | 同左 |
| Piano | 上下段に波括弧 | 同左 |
| Violin I–II | 専用の副括弧なし | 同左 |
| Violin I〜Double Bass | 太い括弧 | 同左 |

- 小節線: Flute 1〜Oboe 2 は連続。Oboe 2/Horn 1間は切れる。Horn 1〜4 は連続。Horn 4/Timpani、Timpani/Vibraphone間は切れる。各Harp・Pianoの上下段は連続し、Harp 1/Harp 2、Harp 2/Piano、Piano/Violin I間は切れる。Violin I〜Double Bassは連続。
- VibraphoneとHarp 1上段は五線が接触・重なっており、小節線も接して見える。両者を意図的に結合したのか、重なって接して見えるだけかは画像だけでは判断できない。
- 03bでも上記の括弧・小節線が自動で付いた。
- 木管・ホルン・弦の譜表間隔が不足し、音部記号と五線が重なる。修正せず記録。
- 各ファイルのPNGとreexport.musicxmlを保存済み。

## 04-names
- 警告: なし。3ページ、各ページ1システム。第5・第9小節で改段かつ改ページ。

| 譜表 | 第1システム | 第2・第3システム |
|---|---|---|
| フルート | Flutes 1.2 | Fl. 1.2 |
| B♭クラリネット | Clarinets 1.2 in B♭ | Cl. 1.2 (B♭) |
| E♭クラリネット | Clarinet in E♭ | E♭ Cl. |
| ホルン | Horns 1.2 | Hn. 1.2 |
| トランペット | Trumpet 1 in B♭ | Tpt. 1 (B♭) |
| ヴァイオリン | Violin I | Vln. I |

- B♭クラリネット・トランペットの♭はフラット記号の形で表示。通常のアルファベットbには見えない。
- 文字の♭を使ったE♭クラリネットもフラット記号として読め、四角や空白にはならない。画像だけから使用フォントの違いまでは判断しない。
- PNG全3ページと再書き出しを保存済み。

## 05-open-key
- 警告なし、1ページ。
- 通常表示: A・B・Cとも調号なし。
- Transposing Score: A（fifths 0）とC（key要素なし）に♯2つが付く。B（空のkey）には付かない。
- 切り替え後のPNGを保存し、オフに戻して再書き出し済み。

## 06-shared-staff
- 警告なし、1ページ、2システム（第6小節で改段）。
- 第1小節: 四分音符の単旋律、上に`a 2`。
- 第2小節: 同リズムの2音和音。
- 第3小節: 上声は二分音符で符尾上、下声は四分音符で符尾下。`1.`は上、`2.`は下。
- 第4小節: 上向き符尾の旋律と上の`1.`。下声の休符は画面では薄い灰色、PNGには出ない。
- 第5小節: 下向き符尾の旋律と下の`2.`。上声の休符は画面では薄い灰色、PNGには出ない。
- 第6小節: 上に3連符の括弧と3、下に5連符の括弧と5が各4組表示。音符は上下声部で分かれるが、途中で音符が接近・重なり、斜めの括弧もある。
- 第7小節: 全休符1つ。
- 第3小節のG4をクリックすると、Sibeliusのアクセシビリティ表示は `Quarter note, Pitch G 4 in voice 2. Bar 3, beat 1.`。第2声部と確認。ただしKeypadパネル自体はViewのチェックがオンでも操作ツールの画像・要素に現れず、声部ボタンでの確認はできなかった。
- `a 2`をクリックするとアクセシビリティ表示は `Instrument Flutes 1.2, Treble clef. a 2 Technique. Bar 1, beat 1.`。Techniqueと確認。ステータスバーは `Page 1 of 1 Bars: 7 Flutes 1.2 Bar 1, beat 1 Timecode: 0.0" Edit Text Concert pitch` で、スタイル名自体は出なかった。
- Keypadを探す途中、コマンド検索への入力が譜面に入ったため、そのスコアを保存せず閉じて破棄。元fixtureを再取り込みし、無編集の状態でreexport.musicxmlを保存。PNGはその誤入力より前に取得済み。

## 07-divisi
- 警告なし、1ページ。
- Violin I第2小節は符尾が上と下に分かれた二声。`div.`は第2小節上、`unis.`は第3・第6小節上に表示。
- Violin I / Violin I 1–8 / Violin I 9–16の3段全体が太い括弧でまとめられる。1–8と9–16だけの細い副括弧はない。
- Violin IIは2段。両方ト音記号、波括弧と連続した小節線でつながる。名前は上下段の中央左に1つ。
- Violin II第1小節を選んでEdit Instrumentsを開くとPitched Percussionの一覧で`Piano`が灰色になっていた（`Harp`行にも灰色が残って見えた）。再書き出しの補助確認ではinstrument-name=`Piano (2)`、instrument-sound=`keyboard.piano.grand`。Violin IIがピアノとして扱われていることを裏付ける。
- PNGと再書き出しを保存済み。

## 08-percussion
- 警告なし、1ページ。

| 表示された名前 | 線数 | 音符の位置 |
|---|---|---|
| Timpani | 5 | ヘ音記号、第1小節 C3/G2/C3/G2 |
| Percussion 1 | 5 | ト音記号、第1小節 C5/E5/G5/E5 |
| Percussion 1: Snare Drum | 1 | 第2小節の四分音符4つが線より上（約2間分） |
| Percussion 2: Suspended Cymbal | 1 | 第1小節の全音符が線より上（約2間分） |
| Percussion 2: Bass Drum | 1 | 第3小節の二分音符2つが線より上（約2間分） |

- 5段が別々の名前で残り、1つのPercussion楽器への統合は見えない。Percussion 1〜Bass Drumは太い括弧でまとめられ、Timpaniには別の太い括弧。
- `C, G`、`Vibraphone`、`Snare Drum`はいずれも該当小節・譜表の上に表示。

## 09-harp-piano
- 警告なし、1ページ。
- Harp 1: 波括弧あり。第1小節上にペダル図・ペダル文字は見当たらない。`mp`は上段の下、上下段の間。
- Harp 1下段: 第2小節前にト音記号、第3小節前にヘ音記号が表示され、指定どおり切り替わる。
- Piano: 波括弧あり。`p`は上段の下、上下段の間。第1・第2小節の和音は上段3音、下段2音に分かれて表示される。

## 10-page-setup
- 警告なし、1ページ。
- Layout > Document Setupを開き、以下を転記してCancelで閉じた。
  - 単位: Millimeters
  - Page size: Custom（A2という名前ではない）
  - Width: 420
  - Height: 594
  - Portrait: オン、Landscape: オフ
  - Staff size: 6
  - Page Margins: Same、上下左右すべて30
- 寸法は指示されたA2縦・五線6 mm・余白30 mmと一致。

## 11-accidentals
- 警告なし、1ページ。
- 取り込み後の画像で観察した各音の臨時記号:

| 小節 | 第1音 | 第2音 | 第3音 | 第4音 |
|---|---|---|---|---|
| 1 | C（なし） | C（なし） | C♯ | C♮（括弧なし） |
| 2 | C四分音シャープ | C（記号なし） | D（記号なし） | D（記号なし） |
| 3 | E四分音フラット | E♮ | E四分音3つフラット | E♮ |
| 4 | C（なし） | D（なし） | E（なし） | F（なし） |

- 第1小節第2音の明示ナチュラル、第1小節第4音の注意括弧、第2小節第2音の繰り返し四分音記号、第2小節第3音の明示ナチュラルは表示されない。
- 初回の自動検証ではHome > Plug-insを探して実行できなかった。後日確認で、この案内は誤りと判明。正しい場所は **Note Input > Plug-ins > Accidentals > Add Accidentals to All Notes**。操作ツールの問題だけを原因として扱わない。
- 補助調査として英語版同梱Plugins/Accidentalsのファイルを読み、次のメニュー名を確認した（UIからの転記ではない）:
  - Add Accidentals to All Notes
  - Add Accidentals to All Sharp and Flat Notes
  - Add Ficta Above Note
  - Respell Flats as Sharps
  - Respell Sharps as Flats
  - Simplify Accidentals
- 自動検証のpage.pngとreexport.musicxmlはプラグイン未実行の状態。

### ユーザーによる追加検証（2026-09-29）

ユーザーがプラグイン実行前・実行後のスクリーンショットを提供。以下はその画像の目視比較であり、実行後のMusicXMLや再生音高は未確認。

| 小節 | 第1音 | 第2音 | 第3音 | 第4音 |
|---|---|---|---|---|
| 1 | C♮が付く | C♮が付く | C♯のまま | C♮、括弧なしのまま |
| 2 | C四分音シャープが残り、上にQ | 記号なしのまま、上にQ | D♮が付く | D♮が付く |
| 3 | E四分音フラットが残り、上にQ | E♮のまま | E四分音3つフラットが残り、上にQ | E♮のまま |
| 4 | C♮が付く | D♮が付く | E♮が付く | F♮が付く |

- 四分音4音（第2小節第1・第2音、第3小節第1・第3音）の上に黒い`Q`と薄い`~PI Warning`の表示が見える。
- **自然音へのナチュラル追加は確認できたが、繰り返しの四分音記号は補完されない。** このプラグインだけで「四分音を含むすべての音に臨時記号を明示する」仕上げは完了しない。
- [実行前のスクリーンショット](11-accidentals/human-before-plugin.png) / [実行後のスクリーンショット](11-accidentals/human-after-plugin.png)
- 追加画像はユーザー提供の画面キャプチャで、150 dpiの全ページ書き出しとは区別する。


## 12-moving-players
- 警告なし。通常画像は1ページ・3システム。第5・第9小節で指定どおり改段。
- Cmd+Aで全体を選択し、Layout > Hide Empty Stavesを実行。非表示前後とも1ページ。

| システム | 非表示後に見える譜表名（画像どおり） |
|---|---|
| 1〜4小節 | Flutes 1.2 / Oboe 1 |
| 5〜8小節 | Fl. 1 / Fl. 2 / Ob. 1 |
| 9〜12小節 | Fl. 1.2 / Ob. 1 |

- 意図した奏者の組み替えと一致。
- page.png（操作前）、hidden-page.png（操作後）、reexport.musicxml（操作後）を保存。

## 13-real-export
- 取り込み時の警告・エラーなし。読み込み停止・強制終了は不要だった。
- 取り込み直後のステータスは一時的に3ページと表示したが、通常PNG書き出しは4ページ生成され、Hide Empty Stavesの前の全選択でも`Pages 1 to 4 of 4`を確認。比較に用いる確定ページ数は **4 → 4**。
- 第1ページ（1〜10小節）の段名を上から転記:
  1. Flutes 1.2
  2. Flute 3
  3. Oboes 1.2
  4. Clarinets 1.2 in B♭
  5. Clarinet 3 in B♭
  6. Horns 1.2 in F
  7. Horns 3.4 in F
  8. Trombones 1.2
  9. Bass Trombone
  10. Tuba
  11. Violin I
  12. Violin II 1–7
  13. Violin II 8–14
  14. Viola 1–6
  15. Viola 7–12
  16. Violoncello
- 第1ページの括弧・小節線:
  - Flutes 1.2〜Clarinet 3 in B♭に太い括弧。小節線はその範囲で連続。
  - Horns 1.2 in F〜Tubaに太い括弧。小節線はその範囲で連続。
  - Violin I〜Violoncelloに太い括弧。小節線はその範囲で連続。
  - 木管/金管、金管/弦の境界では小節線が切れる。
  - フルート、クラリネット、ホルン、分割したViolin II、分割したViolaに個別の細い副括弧は見当たらない。波括弧もない。
- `Score in C`は第1ページ左上、タイトルより上に表示。
- 二人一段の文字・符尾:
  - 第6小節のFlutes 1.2 / Oboes 1.2 / Clarinets 1.2に`1.`・`2.`。
  - 第13小節のHorns 1.2 / Trombones 1.2、第14小節のHorns 3.4にも`1.`・`2.`。
  - 第29小節のFlutes 1.2、第30小節のTrombones 1.2に`2.`。
  - 二声の上下に分かれた符尾を確認（例: 第16小節Horns 1.2、第18小節Horns 1.2、第26小節Oboes 1.2）。
  - `a 2`は全4ページで見当たらない。補助的に元MusicXMLも確認したところ、この実曲fixtureには`a 2`のwords自体がなかったため、取り込みで失われたとは言えない。
- Document Setup: Millimeters / Custom / Width 420 / Height 594 / Portrait / Staff size 6 / Page Margins Same、上下左右30。値を変えずCancelで閉じた。
- Cmd+A → Layout > Hide Empty Staves後、第1ページから休んでいる金管5段（Horns 1.2、Horns 3.4、Trombones 1.2、Bass Trombone、Tuba）が消え、11段になる。第2〜第4ページは全16段のまま。ページ数は4のまま。
- 見た目で気になった箇所（修正はしていない）:
  - 第6小節、Oboes 1.2の下側の`2.`とClarinets 1.2の上側の`1.`が接近して、`2.1.`のように読める。
  - 第6小節Flutes 1.2、第13小節Horns 1.2、第14小節Horns 3.4では奏者番号と`senza vib.`が接近し、`1.senza vib.`のように見える。第14小節は3連符の括弧・数字も近い。
  - 同じ休止を二声それぞれで示す休符が上下に重複し、整理できそうに見える。例: 第6小節冒頭Flutes 1.2、第25小節冒頭Clarinets 1.2、第25小節末Horns 1.2。弦でも第20小節Violin I・Violoncelloに上下の休符が並ぶ。二声が異なるリズムで休む部分は、重複だけで誤りとは判定しない。
  - 同種楽器・ディヴィジをまとめる副括弧がなく、Violin IIの2段とViolaの2段のまとまりが視覚的に弱い（第1ページ以降）。
  - 第13小節Horns 1.2、第14小節Horns 3.4からヘ音記号になる。表示された事実として記録し、この検証だけでは変更の音楽的妥当性を断定しない。
- 通常4枚と非表示後4枚、非表示後のreexport.musicxmlを保存。

## 保存物の確認
- 全16ケースに通常PNGと非圧縮reexport.musicxmlがある。
- 自動検証の全ページ書き出しPNG計29枚。これらの解像度メタデータは5906 pixels/m、約150 dpi。別途、ユーザー提供の実行前後スクリーンショット2枚を保存。
- 全16のreexport.musicxmlがXMLとして読め、パート数と小節数を確認した。
- 06の開き直し後の再書き出しは第1小節C5/D5/E5/F5で、コマンド入力で生じた一時的変更が残っていないことを補助確認した。
- 1ページの場合はSibeliusが`page.png`、複数ページでは`page_0001.png`などと命名した。比較画像も同様に`transposing-page`、`hidden-page`を接頭辞にした。
- 元fixture、make.ts、作曲システムのコードは編集していない。検証譜はすべて保存せず閉じた。

## 困ったこと
- リボンの一部のチェック項目は、アクセシビリティ上の値と実画面の反映に差があった。移調表示は譜面・ステータスを確認し、PNGのdpiもファイルで検査した。
- Edit Instrumentsの一覧では以前の選択行も灰色に見える場合があり、対象譜表の選択、一覧で対応する名前、再書き出しを区別して記録した。
- 02と03は譜表の重なりが激しく、一部の線の所属が画像だけでは判断しづらい。
- KeypadパネルとPlug-insのポップアップは、表示操作を試しても操作ツールから内容を取得できなかった。
- 大きなファイルでのフリーズは今回発生せず、Sibeliusの強制終了はしていない。

## 指示どおりにできなかったこと
- 共通House styleは無効欄の`Podium`表示のため、指定の`Unchanged`に変更できなかった。この条件差がある結果として扱う。
- 06の第2声部はアクセシビリティ表示で確認したが、Keypadの声部ボタンそのものでは確認できなかった。Techniqueもアクセシビリティ表示で確認し、ステータスバー自体にはスタイル名が出なかった。
- 11は初回未実施だったが、ユーザーの実行前後スクリーンショットにより表示結果を追加確認済み（11節参照）。150 dpiのplugin-page出力と実行後のMusicXMLは未取得。正しいメニューはHomeではなくNote Input。
- Edit InstrumentsはCancelがないため、無編集でClose。保存確認もDon't SaveではなくYes/No/CancelのためNoを選んだ。
- 06のパネル操作中の誤入力は、保存せず破棄してfixtureから開き直すことで検証結果から除外した。
