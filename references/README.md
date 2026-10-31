# nexpot商品ページの参考資料

`nexpot/` のページを作るときに参照した資料と情報をまとめたフォルダです。サイトの一部ではありません。

**本番（`nodi-an.com`）へ反映するときは、このフォルダを含めないでください。** `nodi-an.com/references/` として公開されてしまいます。

## 一時公開について

| 項目 | 内容 |
|---|---|
| 確認用URL | https://geennodian.github.io/nodian-site-preview/nexpot/ |
| 公開元のブランチ | `temp-pages`（サイトだけを置いたブランチ） |
| 検索エンジン | `noindex` を指定 |
| 本番 | `nodi-an.com/nexpot/` は未公開 |

`nexpot-product-page` には本番用の `CNAME` が入っています。このブランチをそのままGitHub Pagesで配信すると `nodi-an.com` と競合するおそれがあるため、配信には使わないでください。

## 依頼の経緯

1. **最初の依頼**：冒険、発見、伝統文化、自然といったnexpotの体験に合わせて、躍動感があり、疑似体験ができるページを作る。
2. **作り直し**：もっとリアルにする。日本の文化らしい表現はすべて取り除く。アニメーションは主役にせず、トランジションのアクセントにとどめる。
3. **改善**：タップのデモは不要。国内の風景をできるだけリアルに生成して使う。提携先の写真は掲載してよい。

## デザインの方針

- 主役は実写の質感の風景と、本物のアプリの画面です。
- 3D演出や派手な動き、和のモチーフは使いません。
- 動きはヘッダーの切り替え、セクションの表示、画面内の映像の再生だけに絞ります。

## 外部の参考

| 参照先 | 見た内容 | 使い方 |
|---|---|---|
| [Threadsの投稿](https://www.threads.com/share/BAY6mLITX8/) | AIに動画を指示するときのカメラワークと演出の名前 | 最初の版の参考。最終版の演出には使っていない |
| [Xの投稿](https://x.com/showheyohtaki/status/2108065874511077598) | AIにLPを指示するときのアニメーションの名前 | 最初の版の参考。最終版は動きを絞った |
| [Motionsites-AI/claude-skill](https://github.com/Motionsites-AI/claude-skill) | LP制作の手順をまとめたスキル | 内容を読んだだけで導入していない |
| [Unsplash](https://unsplash.com/) | 風景写真の候補 | 途中で検討したが不採用。最終版の風景はすべて生成画像 |
| [GitHub Pagesのドキュメント](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | 公開設定とリポジトリの公開範囲の関係 | 公開方法の判断に使用 |
| [Google Fonts](https://fonts.google.com/) | Inter、Noto Sans JP | ページの書体 |

## ページの素材

| 素材 | 出どころ | このフォルダ内の資料 |
|---|---|---|
| `img/{hero,ride,town,lake,coast,dusk}-*.webp` | ChatGPTのアカウントでCodex CLIから生成。実在の場所ではない | `image-generation/` に元画像、プロンプト、生成コマンド |
| `video/*.mp4`、`img/poster-*.jpg` | 実機の画面録画から切り出し。ログイン画面とデバッグ表示は使っていない | `video/` に変換コマンド |
| `img/bikes.webp` | 提携先の自転車の写真（掲載の了承あり） | なし |
| `img/favicon-48.png`、`img/apple-touch-icon.png`、`img/logo-*.svg` | nexpotアプリのアイコンとロゴ | なし |
| `index.html` | `page/build_html.py` から生成 | `page/` に生成スクリプトと画像の説明文 |

## 文言の出どころ

- 機能の説明、導入の流れ、よくある質問は、社内の営業資料とアプリの実際の画面をもとに書いています。
- 「利用者に料金はかかりますか？」と「いま使っている自転車でも導入できますか？」の2問は、内容の確認中です。
- ページに料金の金額は載せていません。

## 作り直すとき

```bash
# 風景画像を1枚生成する
references/image-generation/generate.sh hero
```

```bash
# 映像を切り出す（第1引数は作業フォルダ、第2引数は元の録画）
references/video/encode.sh /path/to/workdir /path/to/recording.mp4
```

```bash
# nexpotフォルダで実行し、HTMLを生成する
cd nexpot && python3 ../references/page/build_html.py ../references/page/alt.json
```

## このリポジトリに入れていないもの

次の資料は参照しましたが、公開すると困る内容を含むため、非公開の別リポジトリに置いています。

- 営業資料の原本：料金などを含みます。
- 実機の録画の原本：ログイン画面やデバッグ表示が映っています。
- アプリのデザイン案：第三者の写真が含まれる可能性があります。
- 提携先の写真の元ファイル

社内の配分などの情報は、ページ制作の材料にしていません。GitHubのどのリポジトリにも入れていません。
