# Sibelius 取り込みテスト — 作業指示書（Astra 向け）

あなたは macOS 上の Sibelius Ultimate（英語 UI）を操作して、MusicXML の取り込みテストを行う。
目的は「Sibelius が MusicXML の各要素をどう取り込むか」を**観察して記録する**こと。
**楽譜を直したり整えたりしてはいけない。** 見えたままを記録する。

## 0. 場所

- テストファイル（21本）: `/Users/yuichkun/workspace/takemitsu-2027-composition-system/verification/sibelius-import/fixtures/*.musicxml`
- 出力先（新規作成する）: `/Users/yuichkun/workspace/takemitsu-2027-composition-system/artifacts/sibelius-import/`
  - ファイルごとにサブフォルダ: `artifacts/sibelius-import/<ファイル名から .musicxml を除いたもの>/`
- 各ファイルの各小節には、小節の上に **`ID: 期待される結果`** が太字の英語で書いてある（例: `QT-01-2: quarter-sharp, alter 0`）。
  観察はこの ID 単位で記録する。ラベルのテキスト自体が消えている場合もそれを記録する。

## 1. 最初に1回だけやること

1. Sibelius を起動し、**Help > About Sibelius** を開いて、バージョンとビルド番号をスクリーンショット → `artifacts/sibelius-import/environment-about.png`
2. `artifacts/sibelius-import/environment.md` を作り、次を書く:
   - Sibelius のバージョンとビルド、macOS のバージョン、UI 言語、作業日
   - 取り込みダイアログの全設定（2 の初回で確認したもの）
3. 最初のファイル（`qt-01-sibelius-dialect.musicxml`）を **File > Open** で開くとき、
   取り込みダイアログ（"Open MusicXML File" のオプション）が出たら、**設定を変えずに**スクリーンショット →
   `artifacts/sibelius-import/import-dialog.png`。そのまま OK。
   既定の設定は "Use page and staff size from MusicXML file" と "Use layout and formatting from MusicXML file" がオン、
   "House style" は Unchanged、"Let Sibelius choose instruments" がオン、"Use instrument names from MusicXML file" がオンのはず。
   **以後の全ファイルで同じ設定を使う。**

## 2. 各ファイルで必ずやること（21本すべて）

順番は `fixtures/` のファイル名順でよい。

1. **File > Open** でファイルを開く。取り込みダイアログは既定のまま OK。
2. **警告やエラーのダイアログが出たら、必ずスクリーンショット** → `<出力フォルダ>/warning-<n>.png`。
   内容を `observations.md`（後述）にも書き写す。ダイアログは OK / Continue で閉じて先に進む。
   開けなかった場合はそれを記録して次のファイルへ。
3. 開いたら**何も触らずに**、**File > Export > Graphics** で全ページを PNG に書き出す。
   設定: Format = PNG、Pages = All、Resolution = 300 dpi（選べなければ最大）、出力先 = `<出力フォルダ>/`。
   ファイル名は Sibelius の既定でよい（`<ファイル名> - Full Score - page 1.png` 等）。
4. 画面上でもページ全体が見える倍率にして、スクリーンショットを1枚 → `<出力フォルダ>/screen.png`
   （Export Graphics が失敗したときの保険）。
5. 下の「3. ファイルごとの観察項目」に従って、**オブジェクトを選択して情報を読む**。
   選択して情報が出ている状態のスクリーンショットを撮り、`<出力フォルダ>/select-<ID>.png` と名付ける。
6. **File > Save As** で `<出力フォルダ>/<ファイル名>.sib` に保存する（後でプラグインから読むため）。
7. **File > Export > MusicXML** で `<出力フォルダ>/<ファイル名>-reexport.musicxml` に書き出す（非圧縮）。
8. `<出力フォルダ>/observations.md` を書く（書式は 4 節）。
9. スコアを閉じる。閉じるときに保存を聞かれたら Don't Save（6 で保存済み）。

**やってはいけないこと:** 音符・テキスト・線を動かす、Respace する、Reset Position する、House Style を変える、
Engraving Rules を触る、プラグインを走らせる、Playback を触る。**観察だけ。**

## 3. ファイルごとの観察項目

共通の見方:

- **臨時記号の確認**: 音符を1つクリックして選択し、**Keypad の第6レイアウト（Accidentals）** を表示する。
  どのボタンが点灯しているか（quarter-sharp / quarter-flat / 三重の記号 など）をスクリーンショットして記録する。
  同時に**ステータスバー（画面下）に表示される音高**（例 "C5"）も記録する。
- **符頭の確認**: 音符を選択し、Inspector（Home > Inspector、または ⌘⇧I）の **Notes** 欄で "Notehead" の種類を読む。
- **テキストの確認**: テキストをクリックし、リボンの **Text > Styles** で選択中のスタイル名（Technique / Expression /
  Tempo / Metronome mark / Plain text など）を読む。
- **線の確認**: 線をクリックし、リボンの **Notations > Lines** または Inspector の Lines 欄で線の種類を読む。
- **記号の確認**: 記号をクリックし、ステータスバーに出るオブジェクトの種類（Symbol / Articulation など）を読む。

| ファイル | 観察すること | 選択して記録するもの |
| --- | --- | --- |
| `qt-01-sibelius-dialect` | 小節2〜5で C・D・F に四分音の臨時記号が出ているか。出ているなら**どの記号か**（quarter-sharp は縦棒1本のシャープ、quarter-flat は左右反転したフラット、three-quarters-sharp は縦棒3本、three-quarters-flat は反転フラット+フラット）。小節1と6の対照は臨時記号なしか | 小節2〜5の各1音目を選択し、Keypad の点灯とステータスバーの音高 |
| `qt-02-alter-half-plus-accidental` | qt-01 と同じ。**警告ダイアログの有無**を必ず記録 | 同上 |
| `qt-03-alter-only` | 臨時記号が出るか、出ないか、通常のシャープ／フラットに化けるか、音符の位置が変わるか。警告の有無 | 同上 |
| `qt-04-accidental-only-and-mismatch` | 小節2〜5: 臨時記号だけで音高が出るか。小節6・7: `alter` と臨時記号が食い違うとき**どちらが表示に勝つか** | 同上 |
| `qt-05-arrow-accidentals` | 矢印つき臨時記号（natural-up 等）が出るか。別の記号に化けるか、消えるか | 同上 |
| `qt-06-transposing` | **2つの表示で撮る**: (a) 開いた直後の状態、(b) **Home > Instruments > Transposing Score** を切り替えた状態。両方で Export Graphics する（2回目は `-transposing` または `-concert` を付ける）。Clarinet 小節2は移調表示で D・E・G に quarter-sharp、実音表示で C・D・F に quarter-sharp になるはず。Horn 小節2、Timpani 小節4も同様に確認 | 各楽器の該当音を選択し、Keypad 点灯と音高。**どちらの表示だったか**を明記 |
| `qt-07-accidental-rules` | 小節1: 4つの C のうちどれに臨時記号が表示されるか。小節2: 全部に出るか。小節3: 4つとも正しいか。小節4→5: タイが小節線をまたいで繋がっているか、5小節目の音に臨時記号が出るか。小節6: 和音の3音それぞれの臨時記号。小節7: 括弧つきで出るか。小節8: C と D の綴りが保たれているか（同じ高さでも D に書き直されていないか） | 小節6の和音、小節7の音、小節8の2音を選択 |
| `tech-01-technical` | 各小節に**何か記号が出ているか**。○、菱形符頭、Bartók pizz. の記号、弓の記号、+、指番号、弦番号。説明書上は「読まれない」ので、何も出ないことも結果として重要 | 小節3・4の菱形符頭の音を選択して符頭の種類。記号が出ていればクリックして種類 |
| `orn-01-ornaments` | 小節1: 斜線の本数（3本と1本）。小節2・3: 2音間トレモロが出るか、音価の見え方（全音符か二分音符か）。小節4: tr。小節5: tr の上に四分音の臨時記号が出るか。小節6: モルデントとターン。小節7→8: 波線が次の小節まで伸びるか | 小節2の音を選択して音価と Notes 欄のトレモロ |
| `art-01-articulations` | 各小節の記号が出ているか、上下どちらに付いたか。小節4・5: フェルマータの形（通常／四角）。小節6: scoop / plop / doit / falloff が出るか | 記号をクリックして種類 |
| `nh-01-noteheads` | 小節1〜4の16種の符頭がそれぞれどう見えるか（同じ見た目に統合されていないか）。小節5・6: 白抜き菱形、括弧つき符頭 | 各音を選択して Inspector の Notehead の種類を記録（16音すべて） |
| `perc-01-one-line` | 譜線が1本か。小節1: 音符が線上か。小節2: X 符頭。小節3: 音符から出て何にも繋がらないタイ（l.v.）が出ているか。小節4: ロールの斜線。小節5: 線の上下に音符が来ているか | 小節2の X の音を選択して符頭の種類。小節3の音を選択してタイの有無 |
| `perc-02-five-line-two-instruments` | 譜線が5本か。Bass Drum と Cymbal の音がどの位置に置かれたか（第1間と上第1線か）。X 符頭。小節2の和音。小節3の2声部（符尾の向き）。譜表名・楽器名に何が出ているか | 各楽器の音を選択して符頭と位置 |
| `line-01-lines` | Flute: 小節1〜3のヘアピン、**小節2・3で niente の○が付いているか**。小節4→5: 破線が伸びるか。小節6: 波線グリッサンド。小節7: 直線スライド。小節8→9: `sul pont.` の線と矢印、`ord.`。Piano: 小節8: 8va 線があり音符が C5 の位置に見えるか（それとも C6 の位置で 8va なしか）。小節9: 下段の 8vb | ヘアピンをクリックして線の種類（niente 付きか）。8va 線をクリックして種類。8va 下の音符を選択して音高 |
| `beam-01-beams` | 小節1・2: 連桁が羽根状（広がる／すぼまる）になっているか。小節3: 付点8分+16分のフック（二次連桁の切れ端）が出ているか、4つの16分の二次連桁。小節4: 休符をまたいで連桁が繋がるか | 小節1の連桁をクリック |
| `text-01-text` | 各テキストが出ているか。**それぞれどのテキストスタイルに入ったか**（小節1 `sul pont.`、小節2 `espress.`、小節4 `sub.`、小節5 `Adagio`、小節7 の `§q+` `§h` `§tr3`、小節8 の BOXED）。小節3: p / f / n が音楽記号のフォントで出ているか、n はどう出たか。小節5: メトロノーム記号。小節6: リハーサルマーク A の囲み。小節7: `§` の文字が化けていないか、3つとも別々の音符の上に付いているか | すべてのテキストをクリックしてスタイル名を記録 |
| `inst-01-instrument-change` | 小節2に "To Picc." が出るか。小節3で楽器名が Piccolo に変わるか（譜表の名前、または楽器変更のラベル）。小節3の音符が C5 の位置に見えるか。小節4の四分音 | 小節3の音を選択してステータスバーの音高。楽器変更オブジェクトがあればクリック |
| `meth-01-no-supports` | `qt-01` と**同じ見た目か**。違いがあれば何が違うか。警告の有無 | 小節2の1音目のみ |
| `meth-02-version-3.1` | 同上 | 同上 |
| `meth-03-version-4.0` | 同上 | 同上 |
| `x31-01-musicxml-3.1-features` | 小節1: 何にも繋がらないタイ（let-ring）。小節2・3: 臨時記号が出るか、どの記号か。小節4: soft-accent（<>）と非計測トレモロ。**警告の有無** | 小節2・3の音を選択して Keypad |

## 4. `observations.md` の書式（ファイルごと）

```markdown
# <ファイル名>

- 開けたか: はい / いいえ
- 警告ダイアログ: なし / あり（内容を書き写す。スクリーンショット名）
- Export Graphics のファイル名: ...

| ID | 見えたもの（そのまま書く） | 判定 | 選択時に読めた情報 |
| --- | --- | --- | --- |
| QT-01-1 | C D F に臨時記号なし | 期待どおり | Keypad: 点灯なし、C5 |
| QT-01-2 | C D F に縦棒1本のシャープ | 生き残った | Keypad: quarter-sharp 点灯、C5 |
| ... | ... | ... | ... |
```

「判定」は次の4つのどれか: **期待どおり** / **生き残った** / **化けた**（別のものになった。何になったかを「見えたもの」に書く）/ **消えた**。
判断に迷うときは「見えたもの」を詳しく書き、判定は「不明」でよい。**推測で埋めない。**

## 5. 全部終わったら

`artifacts/sibelius-import/summary.md` に、21ファイルそれぞれについて「開けたか」「警告の有無」「特に目立った点」を1行ずつ書く。
最後に、作業中に困ったこと（操作できなかった、Sibelius が固まった、ダイアログの意味が分からなかった等）を正直に書く。

## 6. 追加でできれば（任意）

`qt-01-sibelius-dialect.musicxml` を、新規の空のスコア（File > New で任意の楽器1つ）を開いた状態から **File > Import** で
取り込む。File > Open との違い（ダイアログの設定項目、結果）を `artifacts/sibelius-import/qt-01-via-import/` に同じ書式で記録する。
