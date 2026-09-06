# Sibelius 取り込みテスト

`fixtures/` の MusicXML を Sibelius に読ませ、何が生き残るかを見る。
生成元は `generate.mjs`（依存なし。`node verification/sibelius-import/generate.mjs` で再生成）。
全ファイルは Sibelius 同梱の MusicXML 4.0 XSD で妥当性検証済み。

## 手順（各ファイル）

1. Sibelius で **File > Open** し、取り込みダイアログは既定のまま OK
   （初回だけダイアログの全設定をスクリーンショットしておく）
2. 警告ダイアログが出たら、その内容をスクリーンショット
3. 取り込み結果の全ページをスクリーンショット。各小節の上に **ID と期待結果** が太字で書いてあるので、
   そのまま見比べられる
4. ファイルを `.sib` で保存する（後でプラグインで読み出すため）
5. スクリーンショットと `.sib` を `artifacts/sibelius-import/<fixture名>/` に置く

## ファイルと見るところ

| ファイル | 見るところ |
| --- | --- |
| `qt-01-sibelius-dialect` | **本命。** 四分音の臨時記号が出るか。Sibelius 自身の書き出し方言 |
| `qt-02-alter-half-plus-accidental` | `<alter>` に 0.5 を書いた場合との差 |
| `qt-03-alter-only` | 臨時記号要素なしで `<alter>` 0.5 だけの場合 |
| `qt-04-accidental-only-and-mismatch` | `<alter>` なし／食い違い。どちらが勝つか |
| `qt-05-arrow-accidentals` | 矢印系の臨時記号値がどう出るか |
| `qt-06-transposing` | クラリネット・ホルン・ティンパニ。移調表示と Concert Pitch 表示の両方を見る |
| `qt-07-accidental-rules` | 小節内の省略規則、タイ、和音、括弧、異名同音 |
| `tech-01-technical` | ○・ハーモニクス・Bartók pizz.・弓・+・指番号。説明書では「読まれない」 |
| `orn-01-ornaments` | トレモロ・トリル・モルデント・ターン・波線 |
| `art-01-articulations` | アーティキュレーション・フェルマータ・ブレス・チェズーラ・ベンド類 |
| `nh-01-noteheads` | 符頭16種 |
| `perc-01-one-line` | 1線打楽器、X 符頭、l.v.、ロール |
| `perc-02-five-line-two-instruments` | 5線打楽器に2楽器、和音、2声部 |
| `line-01-lines` | ヘアピン（niente 含む）、破線、グリッサンド、スライド、カスタム線、8va / 8vb |
| `beam-01-beams` | 羽根連桁、二次連桁、休符をまたぐ連桁 |
| `text-01-text` | テキストのスタイル振り分け、強弱、テンポ、リハーサルマーク、プラグイン用マーカー `§` |
| `inst-01-instrument-change` | Flute → Piccolo の持ち替え |
| `meth-01-no-supports` | `qt-01` と同内容。`<supports>` 宣言なしで差が出るか |
| `meth-02-version-3.1` / `meth-03-version-4.0` | `qt-01` と同内容。バージョン宣言の差 |
| `x31-01-musicxml-3.1-features` | let-ring タイ、SMuFL 指定の臨時記号、soft-accent、非計測トレモロ |

結果は `docs/research/sibelius-musicxml-import.md` の4章に `[実測]` で記録する。
