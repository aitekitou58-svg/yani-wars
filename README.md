# ヤニウォーズ

公開URL：[https://yaniwars.pages.dev/](https://yaniwars.pages.dev/)

**お前には、もう奪わせない。**

吸いたいと思った。でも、吸わなかった。その1回から、お金も、時間も、そして命も。

既存の静的PWAを継続しています。吸った記録を追加しても過去の成果や景色は減りません。アカウント登録、外部AI、Push通知、サーバーへの利用記録送信はありません。広告は初期状態で無効です。

## ローカルで動かす

Node.js 24を使います。このREADMEのあるフォルダで `npm ci` → `npm run build` → `npm run dev`。ブラウザで http://localhost:4173 を開きます。ソース変更後は再buildしてください。開発用ビルドは環境変数 `YANI_ENV=development` を指定します。localhostではproductionビルドでも広告は読み込みません。

## Cloudflare Pagesへ公開する方法

1. GitHubの既存 `yani-wars` リポジトリを使います。mainにこのフォルダのファイル一式を置きます。node_modules、work、test-results、debug.logは含めません。
2. Cloudflareにログイン → Workers & Pages → Create application → **Pagesに続行**。Workersは作りません。
3. **既存Gitリポジトリをインポート** → GitHubを接続。許可するリポジトリはyani-warsだけにします。
4. プロジェクト名 `yaniwars`（利用可能な場合）、本番ブランチ `main`、Framework preset **None**。
5. Build command **npm run build**、Build output directory **dist**、Root directoryは空欄。Node.jsは `.node-version` の24を使用します。
6. Save and Deploy。成功した画面の `https://プロジェクト名.pages.dev` が公開URLです。Workers、Functions、Firebase、VPS、データベース設定は不要です。
7. 公開URLで初回設定→1回記録→再読み込み→オフラインで再起動を確認します。Safari/Chromeからホーム画面へ追加してください。
8. GitHub main更新でCloudflareが自動ビルドします。Deploymentsで同じコミットが成功したか確認できます。シェアURLは公開先から自動生成するため `public/config.json` の `publicUrl` は空欄のままで構いません。

Netlify設定・ライブラリは使いません。GitHub Pagesへのデプロイ処理はworkflowから外し、GitHubはソース保管とテスト・商品更新に使います。既存GitHub Pagesの古い公開物はCloudflareへの切り替えだけでは消えません。

参照：[Cloudflare静的HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) / [Git連携](https://developers.cloudflare.com/pages/get-started/git-integration/)

### 既存の記録を引き継ぐ

同じURLのアプリ更新では既存のIndexedDB・OPFSをそのまま使います。データ形式version 1とDB名は変更していません。

公開URLが異なるとブラウザの保存領域も異なります。記録のファイル書き出しは利用できますが、ファイル読み込み機能はありません。元のURLの記録はそのURLで確認してください。

## GitHub Actionsについて

- `.github/workflows/pages.yml`：main更新・手動実行でPython解析テスト、JSテスト、build、iPhone/Android相当のブラウザテストを実行。完成したdistをartifactに保存します。名前は **Test static PWA for Cloudflare Pages**。
- `.github/workflows/products.yml`：毎日日本時間6:17（UTC21:17）に商品情報を確認。**Daily official product update** → Run workflowで手動実行できます。
- 変更がある場合のみ価格履歴を含む商品マスターをcommit。CloudflareのGit連携がそのmain更新を受信して再公開します。GitHubのGITHUB_TOKENによるcommitでは別のGitHub push workflowは起動しないため、商品更新workflow自身でもテストとbuildを実行します。Cloudflare側の受信結果は初回の商品変更commit時にDeploymentsで確認してください。
- 公式資料の解析エラー時は推測で価格を書き換えず処理を止めます。Actionsの赤い実行とartifact `official-catalog-report` を確認してください。
- GitHub都合で予約が遅れる場合や、公開リポジトリの長期無活動でscheduleが無効化される場合があります。毎日の操作は不要ですが失敗通知は確認してください。

### 商品の収録範囲

現在 **322商品**。財務省の認可一覧から遡ったPDF **280件**、抽出採用357行、曖昧な225行は保留しています。範囲は `public/data/catalog-coverage.json`。紙巻き・加熱式が対象で、大手3社以外の輸入銘柄も含みます。英字・カタカナ・ひらがな・全半角・部分一致で検索できます。別名辞書はDAVIDOFF／ダビドフ等にも対応しています。ただし、正式価格を確認できない紙巻き商品は未収録です。名前だけを理由に推測登録しません。

主ソースは財務省。JTは表の構造を解析し、PMI・BATは公式サイトの可用性・変更を監視します。PMI/BATの全商品・全終売情報を自動で構造化するものではありません。新規認可・適用日付き価格/入り数変更は財務省経由で追従します。資料から消えただけでは終売と判定しません。正式な終了情報が確認できた範囲だけ状態へ反映します。メーカー・輸入元・製造国・英名が資料にない場合は推測しません。

認可済みでも販売継続未確認の商品はその旨表示します。現行一覧から辿れない古い資料、曖昧な行、正式価格不明の商品は未収録です。手動登録へフォールバックしてください。価格は各記録時点で保存され、後の値上げで過去の成果を再計算しません。

## Google AdSenseを有効にする方法

現在は**所有確認のみ有効、広告枠は無効**です。正式なPublisher IDとads.txtは設定済みです。以下は運営者用です。AdSense審査・実広告配信は未確認で、審査通過を保証しません。

### ホームのバナー広告

ホームの「奪われていたものを取り戻すほど、世界に色が戻る。」の下に高さ100pxのバナーを用意しています。Google公式の幅可変・高さ固定コードを使い、スマホでも大きな四角い広告にならない配置にします。[公式コード例](https://support.google.com/adsense/answer/9183363?hl=ja) AdSenseは表示回数に基づく収益に対応しますが、毎回の収益は保証されません。広告の自動更新は行いません。

開始するにはAdSenseで公開サイトを登録し審査を受け、Google認定CMP/Privacy & Messagingを設定してください。`public/config.json` の `adsense.clientId` に実際のPublisher ID、`slotHome` にディスプレイ広告ユニットのSlot IDを設定し、自動広告とモバイル広告サイズの自動最適化は無効にします。その後、`enabled` と `consentConfigured` をtrueにします。`public/ads.txt` はGoogleが指定する実際の販売者行に置き換えて再build・公開します。お問い合わせ窓口も公開前に準備してください。

広告ユニットはID未設定・開発環境・HTTP・オフラインでは動作しません。所有確認コードは、本番サイトでのみSlot IDとは独立して読み込みます。配信失敗時は枠を畳みます。広告モジュールは記録や統計の保存処理を参照せず、喫煙履歴・銘柄・節約額・時間帯統計を広告へ渡しません。ただし通常のAdSenseは同じページで動作するため、ブラウザによる物理的な別オリジン隔離ではありません。Googleが禁止する広告専用iframeは使用しません。`hostUrl` は旧設定でホームバナーには不要です。別サイト公開は不要です。記録ページ末尾は `slotRecord`、このアプリについて・寿命換算ページ末尾は `slotInfo` で任意に設定できます。共通広告モジュールを使い、1画面1枠です。


## 時間帯統計・風景・シェア

`src/patterns.js` は両種の記録を1時間ごとに集計します。今週は月曜から。3時間窓の合計・中心時間の記録数でピークを判定し、8件未満または累計/今週で3日未満なら断定しません。24本の棒はタップとキーボード操作に対応します。

`src/world.js` と `src/landscape.js` がホームとPNGに共通です。20本ではまだ黄ばみ、300〜500本まで大きく色が変わり、その後も透明感が増します。600本で若木、1800〜5400本では奥の森と両岸の花畑が成長します。医療上の回復測定ではありません。寿命換算は `public/config.json` の `lifeMinutesPerStick: 20`、初期自由時間は `defaultFreeMinutes: 5`。

PNGは1080×1350。今日・累計で数字を切り替え、風景はどちらも現在の累計を使います。銘柄や喫煙日時は含めません。Web Share API非対応時は保存・コピーに切り替わります。Xボタンは投稿画面を開くだけで自動投稿しません。InstagramのURLはストーリーズのリンクスタンプ等へ貼り付けます。

## 保存・PWA・テスト

IndexedDB主保存、対応端末ではOPFS3世代バックアップ。Cache APIはアプリ本体だけ。Persistent Storage非対応でも動作します。全削除は記録と設定・バックアップを消し、広告の静的設定やPWAファイルは維持します。

- `npm test`：計算・保存・商品解析・時間帯統計・移行・広告設定の単体テスト
- `npm run build`：Cloudflare用完全静的ファイルをdistへ生成
- `npx playwright install chromium`（初回のみ）→ `npm run test:e2e`
- Python 3.12以上：`python -m pip install -r scripts/requirements-catalog.txt` → `python -m unittest discover -s tests -p '*_test.py'`

ブラウザテストは隔離したテスト用データを使います。実ユーザーの記録は変更しません。iPhone/AndroidはChromiumでの画面・タッチ環境の模擬です。実機Safariのホーム画面追加や各SNSアプリでの共有、実際のGoogle広告・CMPは別途確認が必要です。

説明ページはJSなしでも読める静的HTMLです。`scripts/information.mjs` から `/about/`、`/guide/`、`/life/`、`/patterns/`、`/privacy/`、`/advertising/` を生成します。Service Workerはこれらもオフライン対応します。新バージョンは全タブを閉じた後に切り替わり、古い画面を途中で壊しません。

### AdSenseサイト所有確認

public/config.jsonのadsense.clientIdはca-pub-8745360624658964。siteVerification=trueで所有確認のみ有効。scripts/adsense-head.mjsが本番build時に共通index.htmlと公開説明ページのheadへ確認コードと公式メタタグを挿入します。GoogleコードはHTTPSのyaniwars.pages.devでのみ読み込み、開発build・localhost・他のプレビューでは読み込みません。既存の広告ローダーとscriptを共有し、Slot ID・enabled・consentConfiguredは未設定/falseのままです。ads.txtは正式な販売者行へ更新済み。AdSenseの自動広告も無効のまま審査してください。
