# أثيريون (Aetherion)

لعبة بطاقات عربية أصلية — Flutter للموبايل، Vue للويب، وخادم Node/Socket.IO.

## التشغيل

```bash
npm install
npm run build -w @aetherion/game-core
npm run build -w @aetherion/cards
npm run dev:server
```

في طرفية ثانية:

```bash
npm run dev:web
```

الموبايل:

```bash
cd apps/mobile
flutter pub get
flutter run
```

- السيرفر: `http://localhost:8787`
- الويب: عادة `http://localhost:5173`

## الحسابات والمجموعات والتقدم

- تسجيل / دخول من الواجهة (ويب أو موبايل)
- حفظ مجموعات 40 ورقة (حد أقصى 3 نسخ لكل بطاقة)
- المجموعة المفعّلة تُستخدم تلقائياً في المباريات
- التقدم: فوز / خسارة / XP يُحدَّث بعد انتهاء المباراة للحساب المسجّل
- البيانات محلية في `server/data/aetherion.sqlite`

API:
- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- `GET/POST /api/decks` · `PUT /api/decks/:id` · `POST /api/decks/:id/activate`
- `GET /api/progress`

## إضافة بطاقة

راجع [packages/cards/ADDING_CARDS.md](packages/cards/ADDING_CARDS.md) ثم:

```bash
npm run validate:cards
```
