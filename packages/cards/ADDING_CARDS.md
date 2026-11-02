# إضافة بطاقة جديدة

1. افتح `data/set1.json` (أو أنشئ مجموعة جديدة).
2. أضف كائن JSON بالشكل التالي:

```json
{
  "id": "my_new_card",
  "nameAr": "اسم عربي",
  "nameEn": "English Name",
  "type": "monster",
  "element": "flame",
  "level": 3,
  "atk": 1400,
  "def": 1000,
  "tags": ["beast"],
  "textAr": "عند الاستدعاء: اسحب ورقة.",
  "effects": [
    { "trigger": "on_summon", "ops": [{ "op": "draw", "count": 1 }] }
  ]
}
```

3. نفّذ: `npm run validate:cards`
4. أعد تشغيل السيرفر لتظهر البطاقة في اللعبة.

## العمليات الجاهزة (ops)

| op | حقول مهمة | مثال |
| --- | --- | --- |
| `draw` | `count` | سحب أوراق |
| `damage` | `target`, `amount` | ضرر حياة |
| `heal` | `target`, `amount` | شفاء |
| `buff_stat` | `target`, `stat`, `amount` | تعزيز ATK/DEF |
| `destroy_target` | `target` | تدمير |
| `change_position` | `target`, `position` | تغيير وضعية |
| `summon_token` | `tokenId` | استدعاء رمزي |

## المحفزات (trigger)

`on_summon` · `on_play` · `on_activate` · `on_destroy` · `on_attack_declare` · `start_turn` · `end_turn`

إذا احتجت قدرة غير موجودة، أضف `op` جديداً مرة واحدة في `packages/game-core/src/effects.ts` ثم استخدمه من JSON.
