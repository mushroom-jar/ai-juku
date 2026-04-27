# 永愛塾 (ai-juku)

AIが毎日の自習をサポートする学習塾サービスです。

## Tech Stack

- Next.js (App Router)
- Supabase (Auth + PostgreSQL)
- Stripe (Billing)
- Vercel (Hosting)

## Development

```bash
npm install
npm run dev
```

## Mobile Workflow

スマホで画面確認しながら AI に修正依頼を出したいときは、次のコマンドでローカルサーバーを公開できます。

```bash
npm run dev:mobile
```

同じ Wi-Fi のスマホから `http://PCのIPv4アドレス:3000` を開いて確認してください。

詳しい手順:

- [docs/mobile-ai-workflow.md](./docs/mobile-ai-workflow.md)

GitHub Issue から AI に依頼しやすいように、`AI Task` テンプレートも追加しています。
