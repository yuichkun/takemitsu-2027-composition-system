# takemitsu-2027-composition-system

**2027年度武満徹作曲賞に応募するオーケストラ作品を書くための、専用の作曲システム。**

汎用の作曲環境ではない。この1曲のために作り、この1曲の要求に最適化する。

---

## これは何か

作曲行為はこのシステムの上で行う。Sibelius は**浄書専用**で、作曲は一切行わない。

```
即興・着想 → 作曲システム → MusicXML → Sibelius（浄書） → 製本スコア → 提出
                  ↑              ↓
                  └── 譜面プレビュー / VST オーケストラ再生 ──┘
                            （判断のための装置）
```

作品の正本は**コード**であり、AI が編集主体として対等に参加する。
譜面プレビューと高品質なオーディオ再生は「機能」ではなく、
鳴った音を裁くための**計器**として位置づけられている。

## まず読むもの

**[`docs/proposal.md`](./docs/proposal.md)** — 単体で全体像が分かる。

| | |
| --- | --- |
| [`docs/README.md`](./docs/README.md) | 文書の地図と運用ルール |
| [`docs/architecture.md`](./docs/architecture.md) | 鳴らす仕組みと見せる仕組みの構成 |
| [`docs/commands.md`](./docs/commands.md) | このリポジトリで打つコマンドの一覧 |
| [`docs/competition.md`](./docs/competition.md) | 応募規定。動かせない外形条件 |
| [`docs/open-questions.md`](./docs/open-questions.md) | 未決事項。相談の目次 |
| [`docs/decisions/`](./docs/decisions/) | 決定記録 |
| [`docs/research/`](./docs/research/) | 調査ノート |
| [`docs/worklog/`](./docs/worklog/) | 作業ログ |

## 動かし方

```sh
vp install
vp run host:configure && vp run host:build   # 自作ホスト（C++/JUCE）
vp dev                                        # プレビュー: 楽譜の JSON を譜面で見て BBC SO で聴く
```

コマンドの一覧は [`docs/commands.md`](./docs/commands.md)、構成は [`docs/architecture.md`](./docs/architecture.md)。

## 動かせない条件

正本は [`docs/competition.md`](./docs/competition.md)。ここには要点だけ置く。

- 応募締切 **2026年9月30日［水］18:00 必着**（消印有効ではない。持参可）
- 演奏時間 **10分以上20分未満**、コンチェルトを除くオーケストラ作品
- 本選演奏会（2027年5月30日）時点で**未発表**であること
- 提出は**製本スコア2部**。**匿名審査**（楽譜に作曲者名を書かない）
- 記譜言語は**英・仏・独・伊のみ**
- 提出後の変更・訂正・加筆は**一切不可**
