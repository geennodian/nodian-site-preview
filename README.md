# 株式会社NODIAN コーポレートサイト

STUDIOで作成していたサイト（gold621218.studio.site）を、維持費ゼロで運用するために静的サイト（HTML/CSS/JS）として再構築したものです。

## 構成

- `index.html` — 全セクション（Mission / Service / Value / Works / Company / Recruit / Contact）を含む1ページ構成
- `style.css` — スタイル一式（レスポンシブ対応）
- `script.js` — ハンバーガーメニューとスクロールフェードイン
- `assets/` — ロゴ・写真

外部依存はGoogle Fonts（無料）とFormSubmit（無料のフォーム送信サービス）のみ。ビルド不要でそのまま公開できます。

## nexpot サービスページ（/nexpot/）

スクロールで自転車のライドを体験できる、nexpotの商品ページ。ビルド不要の静的ファイルで動く。

- `nexpot/index.html` — 文言とスマホ画面のマークアップ
- `nexpot/nexpot.css` — スタイル一式
- `nexpot/js/world.js` — 3Dの世界（Three.js）。地形・建物・光はすべてコードで作っている
- `nexpot/js/main.js` — スクロール連動、スマホ画面のデモ、自動走行
- `nexpot/vendor/` — Three.js r170（MIT）
- `nexpot/img/` — ロゴと、3Dの世界から書き出した静止画

## 公開状態（GitHub Pages・無料）

- リポジトリ: https://github.com/geennodian/nodian-site （geennodianアカウント）
- 公開URL: https://nodi-an.com/ （カスタムドメイン設定済み・`CNAME`ファイル）
- ホスティング費用: 0円（かかるのはドメイン更新料のみ）

### DNS設定（Squarespace Domains側で必要）

`nodi-an.com` はSquarespace Domainsで管理。以下のレコードに変更するとサイトが表示される:

| 種別 | ホスト | 値 |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | geennodian.github.io |

既存のSquarespace向けAレコード（198.185.159.x / 198.49.23.x）と `www → ext-sq.squarespace.com` は削除する。
DNS反映後、リポジトリ → Settings → Pages で「Enforce HTTPS」を有効にする（証明書は自動発行・無料）。

## お問い合わせフォームについて

フォームは [FormSubmit](https://formsubmit.co/)（無料）を使い、`g.sugimura@nodi-an.com` にメールが届く設定です。

- **初回のみ**: 最初の送信時にFormSubmitから確認メールが届くので、リンクをクリックして有効化してください
- 有効化後、メールアドレスを隠したい場合はFormSubmitが発行するランダムなエイリアスに `index.html` の `action` を書き換えられます
- 宛先を変えたい場合は `index.html` 内の `formsubmit.co/...` の部分を編集してください

## 更新方法

HTMLを直接編集して push するだけで反映されます。

```bash
git add -A && git commit -m "update" && git push
```
