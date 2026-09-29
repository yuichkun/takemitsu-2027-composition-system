# Sibelius 取り込みテスト — フルスコアの体裁（Codex 向けの作業指示書）

この文書は、Sibelius の画面を操作できる Codex（computer use）にそのまま渡すためのもの。
**楽譜を直さない。開いて、見て、書き出して、記録するだけ。**

## 目的

作曲システムは MusicXML を書き出し、余湖さんはそれを Sibelius で開いて浄書する。
楽器の並び・括弧・段の名前・二人で一段・ディヴィジ・打楽器・オクターヴ記譜の楽器などを、
**MusicXML のどの書き方なら Sibelius がそのとおり読むか**を確かめたい。結果で書き出しの形を決める。

テスト用のファイルは 16 本。15 本は 1 つの問いだけを持つ小さな楽譜で、最後の 1 本は作曲システムが実際に書き出した楽譜。

- ファイル: `/Users/yuichkun/workspace/takemitsu-2027-composition-system/verification/sibelius-layout/fixtures/*.musicxml`
- 作り方: 同じフォルダの `make.ts`（読む必要はない）

## 環境

- Sibelius 24.3.1（`/Applications/Sibelius.app`、英語 UI）。ほかの楽譜は閉じておく
- 出力先: `/Users/yuichkun/workspace/takemitsu-2027-composition-system/verification/sibelius-layout/results/`
  （なければ作る）。ファイルごとにサブフォルダ（例 `results/01a-octave-with-transpose/`）

## 全ファイル共通の手順

1. **File > Open** でファイルを選ぶ
2. MusicXML の取り込みダイアログが出る。次のとおりにする（既定のままのはず。違えば合わせる）:
   - Use page and staff size from MusicXML file: **オン**
   - Use layout and formatting from MusicXML file: **オン**
   - House style: **Unchanged**
   - Let Sibelius choose instruments: **オン**
   - Use instrument names from MusicXML file: **オン**
   - 最初のファイルでだけ、このダイアログの状態を文字で記録する（報告の「共通」の欄）
3. 警告やエラーのダイアログが出たら、文言をそのまま記録する
4. **File > Export > Graphics** で全ページを PNG（150 dpi）に書き出し、そのファイルのサブフォルダに保存する
   （ファイル名は `page` で始める。例 `page-1.png`）。以下「ページを書き出す」はこの操作のこと
5. 下の「ファイルごとの確認」をする
6. **File > Export > MusicXML** で、**非圧縮（.musicxml）**で `reexport.musicxml` としてサブフォルダに保存する
7. 楽譜を閉じる。保存を聞かれたら **Don't Save**

記録は `results/report.md` に書く（形は最後の「報告の形」）。見て判断できないことは、推測せず「判断できない」と書く。

## ファイルごとの確認

### 01a-octave-with-transpose / 01b-octave-without-transpose — オクターヴ記譜の楽器

2 本は同じ楽譜。01a は MusicXML に移調の指定（`<transpose>`）があり、01b にはない。9 つの楽器（チェレスタだけ 2 段）:
Piccolo / Bass Clarinet in B♭ (A) / Bass Clarinet in B♭ (B) / Contrabassoon / Glockenspiel / Crotales / Xylophone /
Celesta（2 段）/ Double Bass。各段の 1 小節目に 4 分音符が 4 つある。

1. ページを書き出す
2. 各段について、1 小節目の**最初の音符をクリック**し、画面下のステータスバーの文字をそのまま写す（音の高さが出ているはず）
3. 各段について、その段の 1 小節目を選んだ状態で **Home > Instruments > Edit Instruments** を開き、
   選ばれている楽器の名前を写す（ダイアログは Cancel で閉じる）。名前に **「MusicXML」** が付いていたら必ず書く。
   Edit Instruments が使えない場合は、その旨を書いて次へ進む
4. **Home > Instruments > Transposing Score** をオンにしてページを書き出す（ファイル名 `transposing-page-1.png`）。
   オフに戻す
5. 報告に書くこと: 段ごとに「譜表上の最初の音符の位置（例: 五線の第 3 間 = C5）」「ステータスバーの文字」
   「Edit Instruments の楽器名」「Transposing Score で音符の位置が変わったか」

### 02a-identity-with-instrument / 02b-identity-names-only — どの楽器として読まれるか

2 本は同じ楽譜（約 36 段）。02a は MusicXML に楽器の種類の情報（`<score-instrument>`）があり、02b は名前だけ。

1. ページを書き出す
2. **Home > Instruments > Edit Instruments** を開き、楽器の一覧に **「MusicXML」を含む名前**があるか探す。
   あれば全部写す
3. 段の名前がファイルの名前（例 `Clarinet 1 in B♭`）と違って表示されている段があれば書く
4. 1 線譜のはずの段（Snare Drum, Bass Drum, Suspended Cymbal, Tam-tam, Triangle, Wood Block）が 1 線で出ているか、
   5 線になっていないか
5. 再書き出し（共通の手順 6）を必ずする。楽器の判定はこれで見る

### 03a-brackets / 03b-no-groups — 括弧と小節線のつながり

2 本は同じ段の並び。03a は括弧の指定があり、03b には一つもない。
段: Flute 1, Flute 2, Oboe 1, Oboe 2, Horn 1–4, Timpani, Vibraphone, Harp 1, Harp 2, Piano, Violin I, Violin II, Viola, Violoncello, Double Bass。

1. ページを書き出す
2. 左端の括弧を見て、次の範囲ごとに**何が付いているか**を書く。
   種類は「太い括弧（bracket）」「細い副括弧（sub-bracket）」「波括弧（brace）」「なし」のどれか:
   - Flute 1–2 / Oboe 1–2 / Flute 1〜Oboe 2 全体 / Horn 1–4 / Timpani〜Vibraphone /
     Harp 1 / Harp 2 / Harp 1〜Harp 2 をまとめる何か / Piano / Violin I–II / Violin I〜Double Bass 全体
3. **小節線がどの段からどの段までつながっているか**を書く（例「Flute 1〜Oboe 2 はつながっている。Oboe 2 と Horn 1 のあいだは切れている」）
4. 03b では、Sibelius が自分で付けた括弧と小節線のつながりを同じ形で書く

### 04-names — 段の名前（最初の段と 2 段目以降、♭ の出方）

12 小節。5 小節目と 9 小節目で段が改まる（3 段）。

1. ページを書き出す
2. 1 段目と 2 段目以降で、左の名前がどう出ているかを段ごとに写す
   （例: 1 段目「Flutes 1.2」、2 段目「Fl. 1.2」）
3. `Clarinets 1.2 in B♭` の ♭ が**音楽記号の ♭**に見えるか、文字の「b」か、別のものか
4. `Clarinet in E♭`（こちらは文字としての ♭ を使っている）の ♭ がどう見えるか（記号・四角・空白など）。
   `Trumpet 1 in B♭` の ♭ も 3 と同じ見方で

### 05-open-key — 調号

B♭ クラリネット 3 段。A は調号「C（fifths 0）」、B は空の調号、C は調号の要素なし。

1. ページを書き出す（このときは調号が見えないはず）
2. **Transposing Score** をオンにして書き出す（`transposing-page-1.png`）。オフに戻す
3. Transposing Score のとき、**どの段に調号（♯ 2 つ）が付いたか**を書く

### 06-shared-staff — 二人で一段（Flutes 1.2）

1 段 7 小節。小節ごとの中身:
1: 同じ旋律を二人で（上に「a 2」）/ 2: 同じリズムの和音 / 3: 二声（上「1.」、下「2.」、符尾は上下）/
4: 一人目だけ（二人目の休符は隠してある）/ 5: 二人目だけ（一人目の休符は隠してある、符尾は下）/
6: 一人目が 3 連符、二人目が 5 連符 / 7: 全休符

1. ページを書き出す
2. 小節ごとに、見えたままを書く。とくに:
   - 1: 「a 2」の文字があるか
   - 3: 2 つの声部になっているか、符尾の向き、「1.」「2.」の位置
   - 4 と 5: 隠したはずの休符が見えているか
   - 6: 3 連符と 5 連符の括弧と数字が両方とも正しく出ているか
3. 3 小節目の下の音符（G4）をクリックし、Keypad の声部ボタンでどの声部（1〜4）になっているかを書く
4. 「a 2」「1.」のどれかをクリックし、ステータスバーに出るテキストのスタイル名（Technique など）を書く

### 07-divisi — 弦のディヴィジ

段: Violin I（1〜3 小節と 6 小節）、Violin I 1–8 と Violin I 9–16（4〜5 小節）、Violin II（2 段の楽器として書いてある）。

1. ページを書き出す
2. Violin I の 2 小節目が二声になっているか、「div.」「unis.」の文字が出ているか
3. Violin I 1–8 と 9–16 がどういう括弧でまとめられているか（Violin I とも一緒か）
4. **Violin II** が何段で出ているか、段どうしが何でつながっているか（波括弧・副括弧・なし）、名前は段のどこに出ているか。
   Edit Instruments で、この段の楽器名を写す

### 08-percussion — 打楽器

段: Timpani / Percussion 1（Vibraphone）/ Percussion 1: Snare Drum / Percussion 2: Suspended Cymbal / Percussion 2: Bass Drum。

1. ページを書き出す
2. 段ごとに、名前の出方、五線の本数（1 線か 5 線か）、音符の位置
3. 複数の段が 1 つの「Percussion」楽器にまとめられてしまった所がないか
4. 段の上の文字（「C, G」「Vibraphone」「Snare Drum」）が出ているか

### 09-harp-piano — ハープとピアノ

1. ページを書き出す
2. ハープ: 波括弧があるか、1 小節目の上にペダルの図（または文字）が出たか、`mp` がどこに出たか（上下の段のあいだか）、
   2 小節目で下の段がト音記号に変わり、3 小節目でヘ音記号に戻っているか
3. ピアノ: 波括弧、`p` の位置、和音がそれぞれ正しい段にあるか

### 10-page-setup — 用紙と五線の大きさ

MusicXML に A2 縦（420 × 594 mm）、五線の大きさ 6 mm、余白 30 mm を書いてある。

1. **Layout > Document Setup** を開き、用紙の名前と幅・高さ、向き、Staff Size、余白の値をそのまま写す。Cancel で閉じる
2. ページを書き出す

### 11-accidentals — 臨時記号をはっきり書いた場合

Violin I、4 小節。MusicXML で、ふつうなら要らない臨時記号（同じ小節で繰り返すナチュラル、四分音）も明示してある。

1. ページを書き出す
2. 小節ごとに、音符ごとの臨時記号を書く（例 1 小節目: C（なし）/ C（♮）/ C♯ / C（(♮)）
   ファイルが指定したもの: 1 小節目 C / C♮ / C♯ / C♮（注意の括弧）、2 小節目 C 四分音シャープ ×2（2 つ目も明示）/ D♮ / D、
   3 小節目 E 四分音フラット / E♮ / E 四分音 3 つフラット / E♮、4 小節目 C D E F（指定なし）
3. **Home > Plug-ins** から、臨時記号をすべての音符に付けるプラグイン（名前の例: *Add Accidentals to All Notes*）を探す。
   あれば、Cmd+A で全体を選んでから実行し、ページを書き出す（`plugin-page-1.png`）。四分音の音符と、変化のない音符（ナチュラル）に
   何が付いたかを書く。なければ、Accidentals の系統にあるプラグインの名前を全部写す

### 12-moving-players — 奏者が段を移る（段の改めと、空の段を隠す）

段: Flutes 1.2 / Flute 1 / Flute 2 / Oboe 1。1〜4 小節と 9〜12 小節は Flutes 1.2 だけが吹き、5〜8 小節は Flute 1 と Flute 2 が別々に吹く。
5 小節目と 9 小節目で段を改める指定がある。

1. ページを書き出す。5 小節目と 9 小節目で段が改まっているか
2. Cmd+A で全体を選び、**Layout > Hide Empty Staves** をする。ページを書き出す（`hidden-page-1.png` …）
3. 段（システム）ごとに、見えている譜表の名前を書く。期待は
   1〜4 小節: Flutes 1.2 と Oboe 1 / 5〜8 小節: Flute 1, Flute 2, Oboe 1 / 9〜12 小節: Flutes 1.2 と Oboe 1

### 13-real-export — 作曲システムの実際の書き出し

パレットのスケッチ「葉が仲間を渡す」を、作曲システムがそのまま書き出したもの（約 1 分 40 秒、30 小節）。
管の二人一段（Flutes 1.2 など）、ディヴィジの段（Violin II 1–7 など）、括弧、A2 の用紙、「Score in C」が入っている。

1. 開いたときの警告を書く
2. ページを書き出す
3. 1 ページ目について:
   - 段の名前を上から順に全部写す
   - 括弧を、上の 03a と同じ見方で書く（どの範囲に太い括弧・細い括弧があるか、小節線のつながり）
   - 「Score in C」の文字がページのどこかに出たか
4. 「Fl. 1.2」「Hn. 1.2」などの二人一段の段で、「1.」「2.」「a 2」の文字と、符尾が上下に分かれている所が出ているか。
   休符が不自然に二重になっている所があれば、小節番号を書く
5. **Layout > Document Setup** の値を写す（10 と同じ）
6. Cmd+A で全体を選び、**Layout > Hide Empty Staves** をしてから、ページを書き出す（`hidden-page-1.png` …）。
   ページ数がいくつからいくつに変わったか
7. 画面で見て、慣習的なオーケストラの総譜として**おかしいと感じる所**があれば、小節番号と段の名前をつけて自由に書く
   （例: 名前の出方、括弧、文字の重なり、休符、音部記号）

## 報告の形

`results/report.md` に、次の形で書く。

```
# Sibelius 取り込みテスト（体裁）報告

日時:
Sibelius のバージョン（Help > About で見えるもの）:

## 共通
- 取り込みダイアログの状態:
- 気づいたこと:

## 01a-octave-with-transpose
- 警告:
- 段ごと（名前 / 最初の音符の位置 / ステータスバー / Edit Instruments の楽器名 / Transposing Score で変わったか）:
  - Piccolo:
  - ...
- ほかに気づいたこと:

## 01b-octave-without-transpose
（同じ形）

...（ファイルごとに、上の「ファイルごとの確認」の番号に答える）
```

全部終わったら、報告の最後に「困ったこと」と「指示どおりにできなかったこと」を書く。
