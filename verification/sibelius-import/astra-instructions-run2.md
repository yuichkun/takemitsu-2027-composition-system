# Sibelius 取り込みテスト 第2回 — 作業指示書（Astra 向け）

前回（`astra-instructions.md`）と同じ環境・同じ手順。対象は4本。**楽譜を直さない、観察だけ**は前回どおり。
今回だけ違うのは、**プラグインを導入して1本のファイルで実行する**こと。

出力先: `/Users/yuichkun/workspace/takemitsu-2027-composition-system/artifacts/sibelius-import-run2/<ファイル名>/`

## 0. 準備: プラグインの導入

1. ターミナルで次を実行する（Sibelius は先に終了しておく）:
   ```
   node /Users/yuichkun/workspace/takemitsu-2027-composition-system/sibelius-plugins/build.mjs --install
   ```
   `~/Library/Application Support/Avid/Sibelius/Plugins/Takemitsu/` に `TakemitsuFix.plg` と `TakemitsuDump.plg` が入る。
2. Sibelius を起動し、**Home > Plug-ins** のメニュー（または Command Search）に
   「Takemitsu: Apply § Markers」と「Takemitsu: Dump Score Objects」が出ることを確認。スクリーンショット →
   `artifacts/sibelius-import-run2/plugins-menu.png`。
   出ない場合は、File > Preferences > Other（または Plug-ins）でプラグインフォルダを確認し、状況をスクリーンショットして
   `summary.md` に書く。以降のファイルの作業は続ける。

## 1. 前回と同じ手順で読むもの（3本）

`verification/sibelius-import/fixtures/` の

- `qt-06b-transposing-alter-half.musicxml` — 前回の qt-06 と同じ観察項目（実音表示・移調表示の両方で撮る）
- `qt-07b-accidental-rules-alter-half.musicxml` — 前回の qt-07 と同じ観察項目 + 小節9（オクターヴ違いの C に臨時記号が漏れないか）+ 小節10（2声部で片方だけ四分音）
- `inst-02-instrument-change-variants.musicxml` — 3つのパートを別々に見る:
  - 上段 Flute（方式 a）: 2小節目に `To Picc.` と `§inst:Piccolo` の文字が出るか。3小節目の四分音
  - 中段 Flute（方式 b）: 3小節目で楽器名が Piccolo に変わるか、音符の高さ、四分音
  - 下段 Piccolo（方式 c）: 譜表名が Piccolo か、音符が C5 の位置か、四分音。**移調表示と実音表示の両方で撮る**

File > Open → 警告を撮る → Export Graphics（300 dpi）→ 選択して Keypad / ステータスバー → `.sib` 保存 → MusicXML 再書き出し → `observations.md`。

## 2. プラグインを使うもの（1本）

`fix-01-markers.musicxml`

1. File > Open。取り込み直後を Export Graphics → `fix-01-markers-before.png`。`.sib` を `fix-01-markers-before.sib` に保存。
2. **Takemitsu: Dump Score Objects** を実行。メッセージボックスを撮り、生成された `…-dump.txt` を出力フォルダにコピー
   （`dump-before.txt`）。
3. **Takemitsu: Apply § Markers** を実行。メッセージボックス（found / applied / failed の数）を撮る → `fix-run1-message.png`。
   生成された `…-fix-log.txt` を `fix-log-run1.txt` としてコピー。
4. Export Graphics → `fix-01-markers-after1.png`。
5. **もう一度 Apply § Markers** を実行。メッセージを撮る → `fix-run2-message.png`（found が 1、applied が 0 のはず。
   残る1つは小節12の `§zzz`）。ログを `fix-log-run2.txt` としてコピー。
6. Export Graphics → `fix-01-markers-after2.png`。after1 と after2 が同じであることを確認。
7. Dump をもう一度実行 → `dump-after.txt`。
8. `.sib` を `fix-01-markers-after.sib` に保存。
9. `observations.md` に、小節ごとに「マーカーが消えたか」「期待した記譜が出たか」「見えたもの」を書く。
   観察項目:

| 小節 | 期待 |
| --- | --- |
| 1 | 全音符の上に○（ハーモニクス） |
| 2 | 全音符に + |
| 3 | 四分音符に Bartók pizz. の記号 |
| 4 | クレッシェンドの始点に○（niente） |
| 5 | デクレッシェンドの終点に○ |
| 6 | `cresc. poco a poco` の後ろに破線が小節末まで |
| 7 | `sul pont.` の後ろに矢印つきの線が小節末まで |
| 8 | `ord.` の Technique テキスト |
| 9 | tr の上に四分音の記号、tr の波線が3拍分 |
| 10 | 前半の和音2音が菱形符頭、後半の音に3本斜線 |
| 11 | 下の声部（E4）だけに○。上の声部（C5）には付かない |
| 12 | `§zzz` はそのまま残る。ログに FAIL として記録 |
| 12（Flute） | 楽器変更 → Piccolo。ラベル "Piccolo" |

プラグインがエラーダイアログを出した場合は、その内容をそのまま撮って記録し、可能なら Sibelius の
Plug-in Trace Window（Home > Plug-ins > Show Trace Window、あれば）の内容もコピーする。

## 3. 全部終わったら

`artifacts/sibelius-import-run2/summary.md` に4本の要点と、困ったことを書く。
