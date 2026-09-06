# Sibelius プラグイン（ManuScript）

MusicXML の取り込みで落ちる記譜を、取り込み後に置き直すための2本。

| プラグイン | メニュー名 | 役割 |
| --- | --- | --- |
| `TakemitsuFix.plg` | Takemitsu: Apply § Markers | `§` で始まる Technique テキストを本来の記譜に置き換え、マーカーを消す。2回走らせても何も起きない |
| `TakemitsuDump.plg` | Takemitsu: Dump Score Objects | 全譜表の全オブジェクト（音高・臨時記号・符頭・アーティキュレーション・トレモロ・テキスト・線・記号・楽器変更）をテキストに書き出す |

## ビルドと導入

```
node sibelius-plugins/build.mjs --install
```

`src/*.plg`（UTF-8）から `dist/*.plg`（UTF-16BE、Sibelius 同梱プラグインと同じ形式）を作り、
`~/Library/Application Support/Avid/Sibelius/Plugins/Takemitsu/` にコピーする。
Sibelius を再起動すると **Home > Plug-ins**（または Command Search）に2つのメニューが出る。

出力ファイルはどちらも開いているスコアの隣に書かれる: `<score>.sib-fix-log.txt`、`<score>.sib-dump.txt`。
未保存のスコアなら `~/Documents/untitled-score-*.txt`。

## マーカーの文法

exporter は、落ちる要素の代わりに **`<direction-type><words>§…</words>`** を該当位置に置く。
取り込むと Technique テキストになる（実測済み）。プラグインはテキストの位置（小節・小節内位置・声部）で対象を探す。

| マーカー | 効果 | 対象の探し方 |
| --- | --- | --- |
| `§h` | ハーモニクスの○（`HarmonicArtic`） | 同じ位置の NoteRest |
| `§plus` | +（ゲシュトップト・左手 pizz.、`PlusArtic`） | 同上 |
| `§art:<n>` | 任意のアーティキュレーション番号 n（0〜15。7=Harmonic、8=Plus、9=UpBow、10=DownBow、13=Pause、12=SquarePause） | 同上 |
| `§sym:<名前>[:<dy>]` | Sibelius の Symbol を名前で置く。例 `§sym:Snap 2`（Bartók pizz.）、`§sym:Quarter sharp:40`（トリルの補助記号。dy は 1/32 スペース、上が正） | 小節の位置 |
| `§nfrom` | ここから始まるクレッシェンドを「niente から」の線に置き換える | 同じ位置の `line.staff.hairpin.crescendo` |
| `§nto` | ここから始まるデクレッシェンドを「niente へ」の線に置き換える | 同じ位置の `line.staff.hairpin.diminuendo` |
| `§line:<styleId>:<duration>` | 任意の線。duration は 1/256 四分音符単位（四分音符 = 256）。例 `§line:line.staff.dashed:1024`、`§line:line.staff.arrow.black.right:2048`、`§line:line.staff.trill:1024` | 小節の位置 |
| `§inst:<styleId>[:<ラベル>]` | 楽器変更。例 `§inst:instrument.wind.piccolo:Piccolo` | 小節の位置 |
| `§nh:<index>` | 符頭スタイル番号（2=Diamond、1=Cross、7=Headless、8=Stemless 等） | 同じ位置の NoteRest の全音符 |
| `§trem:<n>` | 符尾のトレモロ本数（−1 = z） | 同じ位置の NoteRest |
| `§text:<styleId>:<文字>` | テキストを作る。例 `§text:text.staff.expression:espress.` | 小節の位置 |

位置は取り込み後の `Position`（1/256 四分音符単位）で照合する。マーカーは対象と同じ時点に置くこと。
複数声部で同じ時点に音符があるときは、マーカーの声部が優先され、なければ最初に見つかった音符に付く。

## 参照

線スタイルの ID、楽器の ID、記号名は Sibelius 同梱の `ManuScript Language.pdf`（Line Styles / Instrument Types）と
Create > Symbol ダイアログの名前に従う。取り込みで何が落ちるかは `docs/research/sibelius-musicxml-import.md` 2.5節。
