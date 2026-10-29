# استعادة نسخة احتياطية من «Database backup»

**لا يُنفَّذ أي شيء هنا على الإنتاج إلا بموافقة صاحب المشروع.**

## ما تحتويه النسخة

ملف `wasel-backup-<الوقت>-VERIFIED.tar.gpg`، مشفّر بـAES-256 بعبارة `BACKUP_PASSPHRASE`، ويحتوي:

| الملف | المحتوى |
|---|---|
| `schema.sql` | هيكل مخطط `public` كاملًا: الجداول، السياسات، الدوال، الصلاحيات، وسجل الترحيلات |
| `data.sql` | كل صفوف `public` وسجل الترحيلات، من لحظة واحدة (snapshot) |
| `auth-storage-data.sql` | حسابات الدخول وسجلات الملفات. يوجد **فقط** إن سُمح لدور القراءة بقراءتها (الجزء الاختياري في `readonly_role.sql`) |
| `fingerprints.*.txt` | عدد صفوف وبصمة كل جدول: في الإنتاج، وبعد الاستعادة التجريبية |
| `manifest.txt` | وقت النسخة، والإصدار، و`verified=yes` |

**لا تشمل النسخة:** ملفات التخزين نفسها (الصور)، وأسرار دوال Edge، وإعدادات المشروع.

## التحقق من الملف قبل أي استخدام

```bash
sha256sum -c wasel-backup-<…>.sha256
gpg --decrypt wasel-backup-<…>.tar.gpg | tar -x     # يطلب العبارة
grep verified manifest.txt                          # يجب أن تكون verified=yes
```

## الاستعادة في قاعدة جديدة (التجربة الآمنة)

```bash
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f schema.sql
PGOPTIONS='-c session_replication_role=replica' \
  psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f data.sql
psql "$NEW_DB_URL" -XqAt -v schemas=public,supabase_migrations -v tables= \
  -f .github/scripts/db-fingerprints.sql | diff - fingerprints.source.txt && echo مطابقة
```

## الاستعادة على الإنتاج

قرار يتخذه المالك، ويسبقه دائمًا:

1. **نسخة جديدة** من الحالة الراهنة، حتى لا يضيع ما حدث بعد النسخة القديمة.
2. **تحديد النطاق:** استعادة كاملة، أو جداول بعينها.
3. **تجربة الاستعادة** على `wasel-staging` أو قاعدة جديدة.
