# 調査ノート

調べてわかったことを、トピック単位で置く場所。

書き方のルール（出典の書き方、`[文献]` / `[実測]` / `[導出]` / `[推測]` の使い分け）は
[`../README.md`](../README.md) の「3. 調査ノート」にある。

## ある調査

| ファイル | 内容 | 効く論点 |
| --- | --- | --- |
| [`takemitsu-award-2027.md`](./takemitsu-award-2027.md) | **賞の選考実態、審査員が毎年書く総評、シェパードの人物** | 作品の方向性全般 |
| [`orchestral-libraries.md`](./orchestral-libraries.md) | **音源の選定。四分音を出す手段の調査と推薦** | Q1 / Q12 / 決定0010 |
| [`bbcso.md`](./bbcso.md) | **BBC SO Professional を自作ホストで鳴らす実測。**状態の生成、四分音（ピッチベンド不可・調律は可）、打楽器の鍵盤、全奏法の走査 | 決定0012 / 0013 |
| [`sibelius-musicxml-import.md`](./sibelius-musicxml-import.md) | **Sibelius の MusicXML 取り込みで何が生き残るかの検証計画。**文献で判明した取り込みの制限と、ManuScript で修復できる範囲 | Q12 / Q5 / Q8 / 決定0006 |

---

## 調査キュー

着手したらファイルを作り、上の表へ移す。番号は連番で、欠番を作らない。

R1 / R2 / R9 / R12 は [`sibelius-musicxml-import.md`](./sibelius-musicxml-import.md) に統合した（検証計画の段階。実測待ち）。
R10 は [`orchestral-libraries.md`](./orchestral-libraries.md) と
[`../decisions/0010`](../decisions/0010-pitch-bend-quarter-tones.md) で決着した。
R6 の文献調査部分も `sibelius-musicxml-import.md` の 2.2節にある。

| # | 調べること | 効く論点 |
| --- | --- | --- |
| **R13** | **VSL と Orchestral Tools の調査。**R3 で WebSearch 予算切れにより未調査のまま残った穴。VSL は歴史的に最も奏法数が多い | Q1 |
| R5 | Verovio と OSMD の MusicXML 対応範囲。**四分音の臨時記号を描けるか。**強弱・奏法・打楽器はどこまで出るか | Q5 |
| R6 | Sibelius ManuScript で何が自動化できるか。**実機での動作確認**（API の存在は文献で確認済み） | Q12 / 浄書引き渡し |
| R7 | シェパードのオーケストラ作品の実音源とスコア。作風の一次確認 | 作品の方向性 |
| R8 | 打楽器4奏者での持ち替え動線の実務的な制約（設置・移動・時間） | Q9 / 配器の検査 |
| R11 | 四分音の**運指上の実現可能性**。楽器・音域ごとの出しやすさ。とくに木管 | Q9 / 演奏可能性検査 |
